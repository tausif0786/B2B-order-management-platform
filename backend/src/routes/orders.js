import { Router } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { pool } from "../config/db.js";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

const router = Router();

// Get all orders
router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const admin = req.user.role === "admin";

    const [rows] = await pool.execute(
      `SELECT o.*, u.name AS customer_name, u.company_name
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE (? = 1 OR o.user_id = ?)
       ORDER BY o.created_at DESC`,
      [admin ? 1 : 0, req.user.id],
    );

    res.json({ orders: rows });
  }),
);

// Get all cancellation requests (Admin only)
router.get(
  "/cancellation-requests",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT
         cr.id AS request_id,
         cr.order_id,
         cr.user_id,
         cr.reason,
         cr.status AS request_status,
         cr.requested_at,
         cr.reviewed_at,
         cr.review_note,
         o.order_number,
         o.total_amount,
         o.status AS order_status,
         u.name AS customer_name,
         u.email AS customer_email,
         reviewer.name AS reviewed_by_name
       FROM cancellation_requests cr
       JOIN orders o ON o.id = cr.order_id
       JOIN users u ON u.id = cr.user_id
       LEFT JOIN users reviewer ON reviewer.id = cr.reviewed_by
       ORDER BY cr.requested_at DESC`,
    );

    res.json({ requests: rows });
  }),
);

// Get customer's cancellation history
router.get(
  "/my/cancellation-requests",
  authenticate,
  allowRoles("customer"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT
         cr.id AS request_id,
         cr.order_id,
         o.order_number,
         cr.reason,
         cr.status AS request_status,
         cr.review_note,
         cr.requested_at,
         cr.reviewed_at,
         o.total_amount,
         o.status AS order_status,
         r.id AS refund_id,
         r.amount AS refund_amount,
         r.status AS refund_status,
         r.refund_reference,
         r.processed_at
       FROM cancellation_requests cr
       JOIN orders o ON o.id = cr.order_id
       LEFT JOIN refunds r ON r.cancellation_request_id = cr.id
       WHERE cr.user_id = ?
       ORDER BY cr.requested_at DESC`,
      [req.user.id],
    );

    res.json({ requests: rows });
  }),
);

// Admin refund dashboard
router.get(
  "/refunds",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({
        status: z.enum(["pending", "completed", "failed"]).optional(),
      })
      .parse(req.query);

    const [rows] = await pool.execute(
      `SELECT
         r.id AS refund_id,
         r.order_id,
         o.order_number,
         r.cancellation_request_id,
         u.name AS customer_name,
         u.email AS customer_email,
         r.amount,
         r.status,
         r.refund_reference,
         r.created_at,
         r.processed_at,
         admin.name AS processed_by_name
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       JOIN users u ON u.id = o.user_id
       LEFT JOIN users admin ON admin.id = r.processed_by
       WHERE (? IS NULL OR r.status = ?)
       ORDER BY r.created_at DESC`,
      [status || null, status || null],
    );

    const summary = {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      completed: rows.filter((r) => r.status === "completed").length,
      failed: rows.filter((r) => r.status === "failed").length,
    };

    res.json({ summary, refunds: rows });
  }),
);


// Download Invoice PDF
router.get(
  "/:id/invoice",
  authenticate,
  asyncHandler(async (req, res) => {
    // Get order, customer and invoice details
    const [orders] = await pool.execute(
      `SELECT
         o.*,
         u.name AS customer_name,
         u.company_name,
         u.email AS customer_email,
         i.invoice_number,
         i.due_at
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN invoices i ON i.order_id = o.id
       WHERE o.id = ?`,
      [req.params.id],
    );

    const order = orders[0];

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Customers can download only their own invoices
    if (req.user.role !== "admin" && order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!order.invoice_number) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Get order items
    const [items] = await pool.execute(
      "SELECT * FROM order_items WHERE order_id = ?",
      [order.id],
    );

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${order.invoice_number}.pdf"`,
    );

    doc.pipe(res);

    // Company heading
    doc
      .fontSize(24)
      .fillColor("#1e3a8a")
      .text("B2B ORDER MANAGEMENT", { align: "center" });

    doc
      .fontSize(12)
      .fillColor("#555555")
      .text("TAX INVOICE", { align: "center" });

    doc.moveDown(2);

    // Invoice details
    doc.fillColor("#000000").fontSize(11);

    doc.text(`Invoice Number: ${order.invoice_number}`);
    doc.text(`Order Number: ${order.order_number}`);
    doc.text(
      `Invoice Date: ${new Date(order.created_at).toLocaleDateString("en-IN")}`,
    );
    doc.text(
      `Due Date: ${order.due_at ? new Date(order.due_at).toLocaleDateString("en-IN") : "N/A"}`,
    );

    doc.moveDown();

    // Customer details
    doc.fontSize(13).fillColor("#1e3a8a").text("BILL TO");
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor("#000000");
    doc.text(`Customer: ${order.customer_name}`);
    doc.text(`Company: ${order.company_name || "N/A"}`);
    doc.text(`Email: ${order.customer_email}`);
    doc.text(`Mobile: ${order.shipping_mobile}`);
    doc.text(`Address: ${order.shipping_address}`, {
      width: 480,
    });

    doc.moveDown(1.5);

    // Items table heading
    const tableTop = doc.y;

    doc.fontSize(10).fillColor("#ffffff");
    doc.rect(50, tableTop, 495, 25).fill("#1e3a8a");

    doc.fillColor("#ffffff");
    doc.text("Product", 55, tableTop + 8, { width: 180 });
    doc.text("Qty", 245, tableTop + 8, { width: 40 });
    doc.text("Unit Price", 300, tableTop + 8, { width: 85 });
    doc.text("Total", 405, tableTop + 8, { width: 130 });

    let y = tableTop + 35;

    // Items
    doc.fillColor("#000000");

    for (const item of items) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(9);
      doc.text(item.product_name, 55, y, { width: 180 });
      doc.text(String(item.quantity), 245, y, { width: 40 });
      doc.text(`Rs. ${Number(item.unit_price).toFixed(2)}`, 300, y, {
        width: 85,
      });
      doc.text(`Rs. ${Number(item.line_total).toFixed(2)}`, 405, y, {
        width: 130,
      });

      y += 25;
    }

    // Amount summary
    y += 15;

    if (y > 680) {
      doc.addPage();
      y = 50;
    }

    doc
      .moveTo(350, y)
      .lineTo(545, y)
      .strokeColor("#cccccc")
      .stroke();

    y += 15;

    doc.fontSize(10).fillColor("#000000");
    doc.text(`Subtotal: Rs. ${Number(order.subtotal).toFixed(2)}`, 350, y);
    y += 20;

    doc.text(`GST (18%): Rs. ${Number(order.tax_amount).toFixed(2)}`, 350, y);
    y += 25;

    doc
      .fontSize(13)
      .fillColor("#1e3a8a")
      .text(`Grand Total: Rs. ${Number(order.total_amount).toFixed(2)}`, 350, y);

    // Footer
    doc
      .fontSize(9)
      .fillColor("#666666")
      .text("Thank you for your business!", 50, 760, {
        align: "center",
        width: 495,
      });

    doc.end();
  }),
);


// Get single order with items and status history
router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute("SELECT * FROM orders WHERE id = ?", [
      req.params.id,
    ]);

    const order = rows[0];

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user.role !== "admin" && order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const [items] = await pool.execute(
      "SELECT * FROM order_items WHERE order_id = ?",
      [order.id],
    );

    const [history] = await pool.execute(
      `SELECT h.id, h.status, h.created_at,
              u.name AS changed_by_name
       FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.order_id = ?
       ORDER BY h.created_at ASC, h.id ASC`,
      [order.id],
    );

    res.json({ order, items, history });
  }),
);

// Place new order
router.post(
  "/",
  authenticate,
  allowRoles("customer"),
  asyncHandler(async (req, res) => {
    const d = z
      .object({
        items: z
          .array(
            z.object({
              productId: z.number().int().positive(),
              quantity: z.number().int().positive().max(500),
            }),
          )
          .min(1),
        shippingAddress: z.string().min(10),
        shippingMobile: z
          .string()
          .regex(/^[0-9]{10}$/, "Enter a valid 10-digit mobile number"),
        notes: z.string().max(500).optional(),
      })
      .parse(req.body);

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const quantityMap = new Map();

      for (const item of d.items) {
        const currentQty = quantityMap.get(item.productId) || 0;
        const totalQty = currentQty + item.quantity;

        if (totalQty > 500) {
          await conn.rollback();
          return res.status(400).json({
            message: "Maximum quantity per product is 500",
          });
        }

        quantityMap.set(item.productId, totalQty);
      }

      const normalizedItems = [...quantityMap.entries()].map(
        ([productId, quantity]) => ({ productId, quantity }),
      );

      const ids = normalizedItems.map((item) => item.productId);
      const placeholders = ids.map(() => "?").join(",");

      const [products] = await conn.query(
        `SELECT * FROM products
         WHERE id IN (${placeholders})
         AND is_active = TRUE
         FOR UPDATE`,
        ids,
      );

      if (products.length !== ids.length) {
        await conn.rollback();
        return res
          .status(400)
          .json({ message: "One or more products are unavailable" });
      }

      const byId = new Map(products.map((p) => [p.id, p]));
      let subtotal = 0;
      const orderItems = [];

      for (const item of normalizedItems) {
        const p = byId.get(item.productId);

        if (p.stock_quantity < item.quantity) {
          await conn.rollback();
          return res
            .status(400)
            .json({ message: `Insufficient stock for ${p.name}` });
        }

        const line = Number((p.price * item.quantity).toFixed(2));
        subtotal += line;
        orderItems.push({ p, quantity: item.quantity, line });
      }

      subtotal = Number(subtotal.toFixed(2));
      const tax = Number((subtotal * 0.18).toFixed(2));
      const total = Number((subtotal + tax).toFixed(2));
      const orderNo = `ORD-${Date.now()}`;

      const [r] = await conn.execute(
        `INSERT INTO orders
         (order_number, user_id, subtotal, tax_amount, total_amount,
          shipping_address, shipping_mobile, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNo,
          req.user.id,
          subtotal,
          tax,
          total,
          d.shippingAddress,
          d.shippingMobile,
          d.notes || null,
        ],
      );

      // Save initial tracking status
      await conn.execute(
        `INSERT INTO order_status_history
         (order_id, status, changed_by)
         VALUES (?, ?, ?)`,
        [r.insertId, "pending", req.user.id],
      );

      for (const item of orderItems) {
        await conn.execute(
          `INSERT INTO order_items
           (order_id, product_id, product_name, sku, quantity,
            unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            r.insertId,
            item.p.id,
            item.p.name,
            item.p.sku,
            item.quantity,
            item.p.price,
            item.line,
          ],
        );

        await conn.execute(
          "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?",
          [item.quantity, item.p.id],
        );
      }

      await conn.execute(
        `INSERT INTO invoices (invoice_number, order_id, due_at)
         VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL 15 DAY))`,
        [`INV-${orderNo}`, r.insertId],
      );

      await conn.commit();

      await audit(req, "ORDER_PLACED", "order", r.insertId, {
        orderNumber: orderNo,
        total,
      });

      res.status(201).json({
        id: r.insertId,
        orderNumber: orderNo,
        total,
        message: "Order placed successfully",
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);

// Customer cancellation request
router.post(
  "/:id/cancellation-request",
  authenticate,
  allowRoles("customer"),
  asyncHandler(async (req, res) => {
    const { reason } = z
      .object({
        reason: z.string().trim().min(5).max(500),
      })
      .parse(req.body);

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Lock order to prevent duplicate concurrent requests
      const [rows] = await conn.execute(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [req.params.id],
      );

      const order = rows[0];

      if (!order) {
        await conn.rollback();
        return res.status(404).json({
          message: "Order not found",
        });
      }

      // Customer can request cancellation only for their own order
      if (order.user_id !== req.user.id) {
        await conn.rollback();
        return res.status(403).json({
          message: "You cannot cancel another customer's order",
        });
      }

      // Initially allow cancellation only before processing
      if (!["pending", "confirmed"].includes(order.status)) {
        await conn.rollback();
        return res.status(400).json({
          message: "Cancellation is not allowed for this order status",
        });
      }

      // Check whether a request already exists
      const [existing] = await conn.execute(
        "SELECT id FROM cancellation_requests WHERE order_id = ?",
        [order.id],
      );

      if (existing.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          message: "Cancellation request already exists",
        });
      }

      const [result] = await conn.execute(
        `INSERT INTO cancellation_requests
         (order_id, user_id, reason)
         VALUES (?, ?, ?)`,
        [order.id, req.user.id, reason],
      );

      await conn.commit();

      await audit(req, "CANCELLATION_REQUESTED", "order", order.id, {
        cancellationRequestId: result.insertId,
        reason,
      });

      return res.status(201).json({
        message: "Cancellation request submitted successfully",
        cancellationRequestId: result.insertId,
        status: "pending",
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);

// Review cancellation request (Admin only)
router.patch(
  "/cancellation-requests/:id/review",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const { action, reviewNote } = z
      .object({
        action: z.enum(["approved", "rejected"]),
        reviewNote: z.string().max(500).optional(),
      })
      .parse(req.body);

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [requests] = await conn.execute(
        `SELECT * FROM cancellation_requests
         WHERE id = ? FOR UPDATE`,
        [req.params.id],
      );

      const request = requests[0];

      if (!request) {
        await conn.rollback();
        return res.status(404).json({
          message: "Cancellation request not found",
        });
      }

      if (request.status !== "pending") {
        await conn.rollback();
        return res.status(400).json({
          message: "This request has already been reviewed",
        });
      }

      const [orders] = await conn.execute(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [request.order_id],
      );

      const order = orders[0];

      if (!order || !["pending", "confirmed"].includes(order.status)) {
        await conn.rollback();
        return res.status(400).json({
          message: "This order can no longer be cancelled",
        });
      }

      if (action === "approved") {
        const [items] = await conn.execute(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
          [order.id],
        );

        for (const item of items) {
          await conn.execute(
            `UPDATE products
             SET stock_quantity = stock_quantity + ?
             WHERE id = ?`,
            [item.quantity, item.product_id],
          );
        }

        await conn.execute(
          "UPDATE orders SET status = 'cancelled' WHERE id = ?",
          [order.id],
        );

        await conn.execute(
          `INSERT INTO order_status_history
           (order_id, status, changed_by)
           VALUES (?, 'cancelled', ?)`,
          [order.id, req.user.id],
        );

        await conn.execute(
          `INSERT INTO refunds
           (order_id, cancellation_request_id, amount)
           VALUES (?, ?, ?)`,
          [order.id, request.id, order.total_amount],
        );
      }

      await conn.execute(
        `UPDATE cancellation_requests
         SET status = ?, reviewed_by = ?, review_note = ?,
             reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [action, req.user.id, reviewNote || null, request.id],
      );

      await conn.commit();

      await audit(req, "CANCELLATION_REVIEWED", "order", order.id, {
        requestId: request.id,
        action,
      });

      return res.json({
        message: `Cancellation request ${action} successfully`,
        requestId: request.id,
        orderId: order.id,
        status: action,
        ...(action === "approved" && {
          refundStatus: "pending",
        }),
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);

// Update refund status (Admin only)
router.patch(
  "/refunds/:id/status",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const { status, refundReference } = z
      .object({
        status: z.enum(["completed", "failed"]),
        refundReference: z.string().trim().max(100).optional(),
      })
      .parse(req.body);

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        "SELECT * FROM refunds WHERE id = ? FOR UPDATE",
        [req.params.id],
      );

      const refund = rows[0];

      if (!refund) {
        await conn.rollback();
        return res.status(404).json({
          message: "Refund not found",
        });
      }

      if (refund.status !== "pending") {
        await conn.rollback();
        return res.status(400).json({
          message: "This refund has already been processed",
        });
      }

      await conn.execute(
        `UPDATE refunds
         SET status = ?,
             refund_reference = ?,
             processed_by = ?,
             processed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, refundReference || null, req.user.id, refund.id],
      );

      await conn.commit();

      await audit(req, "REFUND_STATUS_UPDATED", "order", refund.order_id, {
        refundId: refund.id,
        status,
        refundReference: refundReference || null,
      });

      return res.json({
        message: `Refund marked as ${status} successfully`,
        refundId: refund.id,
        orderId: refund.order_id,
        status,
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);

// Update order status (Admin only)
router.patch(
  "/:id/status",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({
        status: z.enum(["confirmed", "processing", "shipped", "delivered"]),
      })
      .parse(req.body);

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [req.params.id],
      );

      const o = rows[0];

      if (!o) {
        await conn.rollback();
        return res.status(404).json({ message: "Order not found" });
      }

      if (o.status === "cancelled" || o.status === "delivered") {
        await conn.rollback();
        return res
          .status(400)
          .json({ message: "This order can no longer be changed" });
      }

      if (o.status === status) {
        await conn.rollback();
        return res
          .status(400)
          .json({ message: "Order already has this status" });
      }

      await conn.execute("UPDATE orders SET status = ? WHERE id = ?", [
        status,
        o.id,
      ]);

      // Save every status change in tracking history
      await conn.execute(
        `INSERT INTO order_status_history
         (order_id, status, changed_by)
         VALUES (?, ?, ?)`,
        [o.id, status, req.user.id],
      );

      await conn.commit();

      await audit(req, "ORDER_STATUS_CHANGED", "order", o.id, {
        from: o.status,
        to: status,
      });

      res.json({ message: "Order status updated" });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);

export default router;
