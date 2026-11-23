import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";
const router = Router();
const productSchema = z.object({
  sku: z.string().min(2).max(60),
  name: z.string().min(2).max(180),
  description: z.string().optional(),
  category: z.string().min(2),
  price: z.number().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative().default(5),
});
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const [rows] = await pool.execute(
      `SELECT id,sku,name,description,category,price,stock_quantity,reorder_level FROM products WHERE is_active=TRUE AND (?='' OR name LIKE CONCAT('%',?,'%') OR sku LIKE CONCAT('%',?,'%')) AND (?='' OR category=?) ORDER BY name`,
      [q, q, q, category, category],
    );
    res.json({ products: rows });
  }),
);
router.get(
  "/admin/all",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      "SELECT * FROM products ORDER BY created_at DESC",
    );
    res.json({ products: rows });
  }),
);
router.post(
  "/",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const d = productSchema.parse(req.body);
    const [r] = await pool.execute(
      "INSERT INTO products (sku,name,description,category,price,stock_quantity,reorder_level) VALUES (?,?,?,?,?,?,?)",
      [
        d.sku,
        d.name,
        d.description || null,
        d.category,
        d.price,
        d.stockQuantity,
        d.reorderLevel,
      ],
    );
    await audit(req, "PRODUCT_CREATED", "product", r.insertId, { sku: d.sku });
    res.status(201).json({ id: r.insertId, message: "Product created" });
  }),
);
router.put(
  "/:id",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const d = productSchema.parse(req.body);
    const [r] = await pool.execute(
      "UPDATE products SET sku=?,name=?,description=?,category=?,price=?,stock_quantity=?,reorder_level=? WHERE id=?",
      [
        d.sku,
        d.name,
        d.description || null,
        d.category,
        d.price,
        d.stockQuantity,
        d.reorderLevel,
        req.params.id,
      ],
    );
    if (!r.affectedRows)
      return res.status(404).json({ message: "Product not found" });
    await audit(req, "PRODUCT_UPDATED", "product", req.params.id);
    res.json({ message: "Product updated" });
  }),
);
router.patch(
  "/:id/stock",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const d = z
      .object({ adjustment: z.number().int(), reason: z.string().min(3) })
      .parse(req.body);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        "SELECT stock_quantity FROM products WHERE id=? FOR UPDATE",
        [req.params.id],
      );
      if (!rows[0]) {
        await conn.rollback();
        return res.status(404).json({ message: "Product not found" });
      }
      const next = rows[0].stock_quantity + d.adjustment;
      if (next < 0) {
        await conn.rollback();
        return res.status(400).json({ message: "Stock cannot be negative" });
      }
      await conn.execute("UPDATE products SET stock_quantity=? WHERE id=?", [
        next,
        req.params.id,
      ]);
      await conn.commit();
      await audit(req, "STOCK_ADJUSTED", "product", req.params.id, {
        adjustment: d.adjustment,
        reason: d.reason,
      });
      res.json({ stockQuantity: next });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);
export default router;
