const router = require("express").Router();
const { z } = require("zod");
const { query, tx } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");
const { nextNo } = require("../utils/counter");

// coerce.number() turns "100" from an HTML input into 100 — the bug that used to
// make saving fail with "Expected number, received string".
const itemSchema = z.object({
  name: z.string().min(1, "nama material wajib diisi"),
  spec: z.string().optional().nullable(),
  unit: z.string().min(1, "satuan wajib diisi"),
  qty: z.coerce.number({ invalid_type_error: "jumlah harus angka" }).positive("jumlah harus lebih dari 0"),
  purpose: z.string().optional().nullable(),
});

const createSchema = z.object({
  project: z.string().min(1, "nama proyek wajib diisi"),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, "minimal 1 baris material"),
});

const SELECT_REQUEST = `
  SELECT r.*,
         u.name  AS requested_by_name,
         sm.name AS approved_sm_name,
         pm.name AS approved_pm_name,
         COALESCE(
           (SELECT json_agg(i ORDER BY i.name) FROM request_items i WHERE i.request_id = r.id),
           '[]'
         ) AS items
  FROM material_requests r
  JOIN users u  ON u.id  = r.requested_by_id
  LEFT JOIN users sm ON sm.id = r.approved_sm_id
  LEFT JOIN users pm ON pm.id = r.approved_pm_id
`;

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const params = [];
  let where = "";
  if (req.query.status) {
    params.push(req.query.status);
    where = " WHERE r.status = $1";
  }
  const { rows } = await query(`${SELECT_REQUEST}${where} ORDER BY r.date DESC`, params);
  res.json(rows);
}));

router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT_REQUEST} WHERE r.id = $1`, [req.params.id]);
  if (rows.length === 0) throw new ApiError(404, "Permintaan tidak ditemukan.");
  res.json(rows[0]);
}));

router.post("/", requireAuth, requireRole("LAPANGAN", "SITE_MANAGER"), asyncHandler(async (req, res) => {
  const { project, notes, items } = createSchema.parse(req.body);
  const no = await nextNo("PM", "material_requests");

  const id = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO material_requests (no, project, notes, requested_by_id)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [no, project.trim(), notes || null, req.user.id]
    );
    const requestId = rows[0].id;

    for (const i of items) {
      await c.query(
        `INSERT INTO request_items (request_id, name, spec, unit, qty, purpose)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [requestId, i.name.trim(), i.spec ? i.spec.trim() : null, i.unit.trim(), i.qty, i.purpose ? i.purpose.trim() : null]
      );
    }
    return requestId;
  });

  const { rows } = await query(`${SELECT_REQUEST} WHERE r.id = $1`, [id]);
  res.status(201).json(rows[0]);
}));

router.delete("/:id", requireAuth, requireRole("LAPANGAN"), asyncHandler(async (req, res) => {
  const { rows } = await query("SELECT status FROM material_requests WHERE id = $1", [req.params.id]);
  if (rows.length === 0) throw new ApiError(404, "Permintaan tidak ditemukan.");
  if (rows[0].status !== "DIAJUKAN") {
    throw new ApiError(400, `Hanya permintaan berstatus DIAJUKAN yang bisa dihapus. Status saat ini: ${rows[0].status}.`);
  }
  await query("DELETE FROM material_requests WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

module.exports = { router, SELECT_REQUEST };
