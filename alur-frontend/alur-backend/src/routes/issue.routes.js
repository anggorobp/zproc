const router = require("express").Router();
const { z } = require("zod");
const { query, tx } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");
const { nextNo } = require("../utils/counter");
const { getAvailableItems } = require("../services/stock");

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT gi.id, gi.no, gi.project, gi.date, gi.note, u.name AS petugas,
            COALESCE((SELECT json_agg(json_build_object(
              'name', ri.name, 'qty', it.qty, 'unit', ri.unit))
              FROM gi_items it JOIN request_items ri ON ri.id = it.request_item_id
              WHERE it.gi_id = gi.id), '[]') AS items
     FROM goods_issues gi
     JOIN users u ON u.id = gi.issued_by_id
     ORDER BY gi.date DESC`
  );
  res.json(rows);
}));

// Material yang benar-benar punya stok, untuk pilihan di form pengeluaran.
router.get("/tersedia", requireAuth, asyncHandler(async (req, res) => {
  res.json(await getAvailableItems());
}));

const issueSchema = z.object({
  project: z.string().min(1, "proyek tujuan wajib diisi"),
  note: z.string().optional().nullable(),
  items: z.array(z.object({
    requestItemId: z.string().min(1),
    qty: z.coerce.number({ invalid_type_error: "jumlah harus angka" }).positive("jumlah harus lebih dari 0"),
  })).min(1, "pilih minimal 1 material"),
});

router.post("/", requireAuth, requireRole("LOGISTIK"), asyncHandler(async (req, res) => {
  const { project, note, items } = issueSchema.parse(req.body);

  // Validasi stok sebelum menulis apa pun.
  const tersedia = await getAvailableItems();
  for (const line of items) {
    const stok = tersedia.find((t) => t.request_item_id === line.requestItemId);
    if (!stok) throw new ApiError(400, "Ada material yang stoknya kosong atau tidak dikenal.");
    if (line.qty > stok.tersedia + 1e-9) {
      throw new ApiError(400, `Stok "${stok.name}" tidak cukup. Tersedia: ${stok.tersedia} ${stok.unit}.`);
    }
  }

  const no = await nextNo("GI", "goods_issues");
  const id = await tx(async (c) => {
    const gi = await c.query(
      "INSERT INTO goods_issues (no, project, issued_by_id, note) VALUES ($1,$2,$3,$4) RETURNING id",
      [no, project.trim(), req.user.id, note || null]
    );
    for (const i of items) {
      await c.query("INSERT INTO gi_items (gi_id, request_item_id, qty) VALUES ($1,$2,$3)", [gi.rows[0].id, i.requestItemId, i.qty]);
    }
    return gi.rows[0].id;
  });

  res.status(201).json({ ok: true, id, no });
}));

module.exports = router;
