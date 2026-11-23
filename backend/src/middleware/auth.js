import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    if (!token)
      return res.status(401).json({ message: "Authentication required" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      "SELECT id, name, email, role, company_name, is_active FROM users WHERE id = ?",
      [payload.id],
    );
    if (!rows[0] || !rows[0].is_active)
      return res.status(401).json({ message: "Account unavailable" });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
export const allowRoles =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res
          .status(403)
          .json({
            message: "You do not have permission to perform this action",
          });
