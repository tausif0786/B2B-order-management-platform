import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

const router = Router();

// All customer-management routes are admin-only.
router.use(authenticate, allowRoles("admin"));

// Customer statistics and directory
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all");

    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*) AS total_customers,
        COALESCE(SUM(is_active = TRUE), 0) AS active_customers,
        COALESCE(SUM(is_active = FALSE), 0) AS inactive_customers
      FROM users
      WHERE role = 'customer'
    `);

    let where = "WHERE u.role = 'customer'";
    const params = [];

    if (q) {
      where +=
        " AND (u.name LIKE ? OR u.email LIKE ? OR u.company_name LIKE ?)";
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    if (status === "active") {
      where += " AND u.is_active = TRUE";
    } else if (status === "inactive") {
      where += " AND u.is_active = FALSE";
    }

    const [customers] = await pool.execute(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.company_name,
        u.mobile,
        u.is_active,
        u.created_at,
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(
          CASE WHEN o.status <> 'cancelled'
          THEN o.total_amount ELSE 0 END
        ), 0) AS total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      ${where}
      GROUP BY
        u.id, u.name, u.email, u.company_name,
        u.mobile, u.is_active, u.created_at
      ORDER BY u.created_at DESC`,
      params,
    );

    res.json({ stats, customers });
  }),
);

// Customer Performance Analytics
router.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const [[summary]] = await pool.query(`
      SELECT
        COUNT(DISTINCT u.id) AS total_customers,
        COALESCE(SUM(o.total_amount), 0) AS total_purchases,
        COUNT(DISTINCT o.id) AS total_orders,
        COALESCE(
          SUM(o.total_amount) / NULLIF(COUNT(o.id), 0), 0
        ) AS average_order_value
      FROM users u
      LEFT JOIN orders o
        ON o.user_id = u.id
        AND o.status <> 'cancelled'
      WHERE u.role = 'customer'
    `);

    const [[repeatData]] = await pool.query(`
      SELECT
        COUNT(*) AS purchasing_customers,
        SUM(order_count >= 2) AS repeat_customers
      FROM (
        SELECT user_id, COUNT(*) AS order_count
        FROM orders
        WHERE status <> 'cancelled'
        GROUP BY user_id
      ) AS customer_orders
    `);

    const repeatPercentage = repeatData.purchasing_customers
      ? (Number(repeatData.repeat_customers) /
          Number(repeatData.purchasing_customers)) *
        100
      : 0;

    const [monthlyPurchases] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%b %Y') AS month,
        DATE_FORMAT(created_at, '%Y-%m') AS month_key,
        SUM(total_amount) AS sales
      FROM orders
      WHERE status <> 'cancelled'
        AND created_at >= DATE_SUB(
          DATE_FORMAT(CURDATE(), '%Y-%m-01'),
          INTERVAL 5 MONTH
        )
      GROUP BY month_key, month
      ORDER BY month_key ASC
    `);

    const [topCustomers] = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.company_name,
        COUNT(o.id) AS total_orders,
        SUM(o.total_amount) AS total_purchases
      FROM users u
      JOIN orders o ON o.user_id = u.id
      WHERE u.role = 'customer'
        AND o.status <> 'cancelled'
      GROUP BY u.id, u.name, u.company_name
      ORDER BY total_purchases DESC
      LIMIT 5
    `);

    res.json({
      summary: {
        ...summary,
        repeat_percentage: Number(repeatPercentage.toFixed(1)),
      },
      monthlyPurchases,
      topCustomers,
    });
  }),
);

// Customer details and order history
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email, company_name, mobile, address,
              is_active, created_at
       FROM users
       WHERE id = ? AND role = 'customer'`,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const [orders] = await pool.execute(
      `SELECT id, order_number, status, subtotal, tax_amount,
              total_amount, shipping_address, shipping_mobile,
              created_at, updated_at
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [id],
    );

    const [[totals]] = await pool.execute(
      `SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(
          CASE WHEN status <> 'cancelled'
          THEN total_amount ELSE 0 END
        ), 0) AS total_spent
       FROM orders
       WHERE user_id = ?`,
      [id],
    );

    res.json({
      customer: rows[0],
      orders,
      totals,
    });
  }),
);

// Activate or deactivate a customer account
router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET is_active = ?
       WHERE id = ? AND role = 'customer'`,
      [isActive ? 1 : 0, id],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Customer not found" });
    }

    await audit(
      req,
      isActive ? "CUSTOMER_ACTIVATED" : "CUSTOMER_DEACTIVATED",
      "user",
      id,
    );

    res.json({
      message: isActive
        ? "Customer account activated successfully"
        : "Customer account deactivated successfully",
      is_active: isActive,
    });
  }),
);

export default router;
