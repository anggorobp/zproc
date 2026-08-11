const router = require("express").Router();
const { z } = require("zod");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");

const vendorSchema = z.object({
  name: z.string().min(1, "nama vendor wajib diisi"),
  email: z.string().email("format email tidak valid"),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query("SELECT * FROM vendors ORDER BY name");
  res.json(rows);
}));

router.post("/", requireAuth, requireRole("PURCHASING"), asyncHandler(async (req, res) => {
  const v = vendorSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO vendors (name, email, phone, address, category)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [v.name.trim(), v.email.trim(), v.phone || null, v.address || null, v.category || null]
  );
  res.status(201).json(rows[0]);
}));

router.put("/:id", requireAuth, requireRole("PURCHASING"), asyncHandler(async (req, res) => {
  const v = vendorSchema.parse(req.body);
  const { rows } = await query(
    `UPDATE vendors SET name=$1, email=$2, phone=$3, address=$4, category=$5
     WHERE id=$6 RETURNING *`,
    [v.name.trim(), v.email.trim(), v.phone || null, v.address || null, v.category || null, req.params.id]
  );
  if (rows.length === 0) throw new ApiError(404, "Vendor tidak ditemukan.");
  res.json(rows[0]);
}));

router.delete("/:id", requireAuth, requireRole("PURCHASING"), asyncHandler(async (req, res) => {
  const { rowCount } = await query("DELETE FROM vendors WHERE id = $1", [req.params.id]);
  if (rowCount === 0) throw new ApiError(404, "Vendor tidak ditemukan.");
  res.json({ ok: true });
}));

module.exports = router;
