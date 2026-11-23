import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { audit } from "../utils/audit.js";
const router = Router();
const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().max(160).optional(),
});
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(data.password, 12);
    const [result] = await pool.execute(
      "INSERT INTO users (name,email,password_hash,role,company_name) VALUES (?,?,?,'customer',?)",
      [data.name, data.email.toLowerCase(), hash, data.companyName || null],
    );
    const user = {
      id: result.insertId,
      name: data.name,
      email: data.email.toLowerCase(),
      role: "customer",
      company_name: data.companyName || null,
    };
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });
    req.user = user;
    await audit(req, "USER_REGISTERED", "user", user.id);
    res.status(201).json({ token, user });
  }),
);
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE email = ? AND is_active = TRUE",
      [data.email.toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(data.password, user.password_hash)))
      return res
        .status(401)
        .json({ message: "Email or password is incorrect" });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company_name: user.company_name,
    };
    req.user = safeUser;
    await audit(req, "USER_LOGIN", "user", user.id);
    res.json({ token, user: safeUser });
  }),
);
router.get("/me", authenticate, (req, res) => res.json({ user: req.user }));

// Get customer profile
router.get(
  "/profile",
  authenticate,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      "SELECT id, name, email, role, company_name, mobile, address FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: rows[0] });
  }),
);

// Update customer profile
router.put(
  "/profile",
  authenticate,
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(2).max(120),
        companyName: z.string().max(160).optional(),
        mobile: z
          .string()
          .regex(/^$|^[0-9]{10}$/, "Enter a valid 10-digit mobile number"),
        address: z.string().max(500),
      })
      .parse(req.body);

    await pool.execute(
      "UPDATE users SET name = ?, company_name = ?, mobile = ?, address = ? WHERE id = ?",
      [
        data.name,
        data.companyName || null,
        data.mobile || null,
        data.address,
        req.user.id,
      ],
    );

    const [rows] = await pool.execute(
      "SELECT id, name, email, role, company_name, mobile, address FROM users WHERE id = ?",
      [req.user.id],
    );

    res.json({
      message: "Profile updated successfully",
      user: rows[0],
    });
  }),
);

export default router;
