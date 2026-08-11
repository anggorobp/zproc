const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");

const ROLES = ["ADMIN", "LAPANGAN", "SITE_MANAGER", "PROJECT_MANAGER", "PURCHASING", "LOGISTIK"];

const loginSchema = z.object({
  email: z.string().min(1, "email wajib diisi").email("format email tidak valid"),
  password: z.string().min(1, "password wajib diisi"),
});

const registerSchema = z.object({
  name: z.string().min(1, "nama wajib diisi"),
  email: z.string().email("format email tidak valid"),
  password: z.string().min(6, "password minimal 6 karakter"),
  role: z.enum(ROLES, { errorMap: () => ({ message: `pilih salah satu: ${ROLES.join(", ")}` }) }),
});

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
  if (rows.length === 0) throw new ApiError(401, "Email atau password salah.");

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new ApiError(401, "Email atau password salah.");

  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  });
  res.json({ token, user: payload });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query("SELECT id, name, email, role FROM users WHERE id = $1", [req.user.id]);
  if (rows.length === 0) throw new ApiError(401, "Akun tidak ditemukan. Silakan login ulang.");
  res.json({ user: rows[0] });
}));

router.get("/users", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const { rows } = await query("SELECT id, name, email, role FROM users ORDER BY created_at");
  res.json(rows);
}));

router.post("/register", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const { name, email, password, role } = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1,$2,$3,$4) RETURNING id, name, email, role`,
    [name.trim(), email.toLowerCase().trim(), hash, role]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
