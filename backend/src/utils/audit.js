
import { pool } from "../config/db.js";

export async function audit(
  req,
  action,
  entityType,
  entityId = null,
  details = {},
) {
  try {
    await pool.execute(
      `INSERT INTO activity_logs
       (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id ?? null,
        action,
        entityType,
        entityId == null ? null : String(entityId),
        JSON.stringify(details),
        req.ip,
      ],
    );
  } catch (error) {
    console.error("Audit logging failed:", error.message);
  }
}
