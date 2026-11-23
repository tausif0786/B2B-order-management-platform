import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.get(
  "/summary",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (_req, res) => {
    const [[sales]] = await pool.query(
      "SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS total_orders FROM orders WHERE status <> 'cancelled'",
    );
    const [[customers]] = await pool.query(
      "SELECT COUNT(*) AS total_customers FROM users WHERE role='customer' AND is_active=TRUE",
    );
    const [[inventory]] = await pool.query(
      "SELECT COUNT(*) AS total_products, COALESCE(SUM(stock_quantity),0) AS units_in_stock, SUM(stock_quantity <= reorder_level) AS low_stock FROM products WHERE is_active=TRUE",
    );
    const [recent] = await pool.query(
      "SELECT o.id,o.order_number,o.status,o.total_amount,o.created_at,u.name AS customer_name FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 6",
    );
    res.json({
      revenue: sales.revenue,
      totalOrders: sales.total_orders,
      totalCustomers: customers.total_customers,
      ...inventory,
      recentOrders: recent,
    });
  }),
);
router.get(
  "/activity",
  authenticate,
  allowRoles("admin"),
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      "SELECT a.*,u.name AS user_name FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 50",
    );
    res.json({ activities: rows });
  }),
);
export default router;
