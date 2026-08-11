const router = require("express").Router();
const { z } = require("zod");
const { query, tx } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");
const { nextNo } = require("../utils/counter");

// Setiap baris PO membawa jumlah yang sudah diterima dan sisanya.
const SELECT_PO_ITEMS = `
  SELECT pi.id, pi.qty, pi.unit_price,
         ri.name, ri.spec, ri.unit,
         COALESCE((SELECT SUM(g.qty) FROM gr_items g WHERE g.po_item_id = pi.id), 0) AS diterima
  FROM po_items pi
  JOIN request_items ri ON ri.id = pi.request_item_id
  WHERE pi.po_id = $1
  ORDER BY ri.name
`;

async function loadPO(id) {
  const { rows } = await query(
    `SELECT p.*, v.name AS vendor_name, v.email AS vendor_email,
            r.no AS request_no, r.project
     FROM purchase_orders p
     JOIN vendors v ON v.id = p.vendor_id
     JOIN material_requests r ON r.id = p.request_id
     WHERE p.id = $1`,
    [id]
  );
  if (rows.length === 0) return null;

  const items = (await query(SELECT_PO_ITEMS, [id])).rows.map((i) => ({
    ...i,
    qty: Number(i.qty),
    unit_price: Number(i.unit_price),
    diterima: Number(i.diterima),
    sisa: Number(i.qty) - Number(i.diterima),
    subtotal: Number(i.qty) * Number(i.unit_price),
  }));

  return { ...rows[0], items, total: items.reduce((s, i) => s + i.subtotal, 0) };
}

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query("SELECT id FROM purchase_orders ORDER BY date DESC");
  const pos = [];
  for (const r of rows) pos.push(await loadPO(r.id));
  res.json(pos);
}));

router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const po = await loadPO(req.params.id);
  if (!po) throw new ApiError(404, "PO tidak ditemukan.");
  res.json(po);
}));

const receiveSchema = z.object({
  note: z.string().optional().nullable(),
  items: z.array(z.object({
    poItemId: z.string().min(1),
    qty: z.coerce.number({ invalid_type_error: "jumlah harus angka" }).positive("jumlah harus lebih dari 0"),
  })).min(1, "isi minimal 1 item yang diterima"),
});

// Penerimaan boleh bertahap. Status jadi DITERIMA hanya bila semua baris lengkap.
router.post("/:id/receive", requireAuth, requireRole("LOGISTIK"), asyncHandler(async (req, res) => {
  const { note, items } = receiveSchema.parse(req.body);

  const po = await loadPO(req.params.id);
  if (!po) throw new ApiError(404, "PO tidak ditemukan.");
  if (po.status === "DITERIMA") throw new ApiError(400, "PO ini sudah diterima seluruhnya.");

  for (const line of items) {
    const poItem = po.items.find((i) => i.id === line.poItemId);
    if (!poItem) throw new ApiError(400, "Ada item yang bukan bagian dari PO ini.");
    if (line.qty > poItem.sisa + 1e-9) {
      throw new ApiError(400, `Jumlah "${poItem.name}" melebihi sisa PO. Sisa: ${poItem.sisa} ${poItem.unit}.`);
    }
  }

  const no = await nextNo("GR", "goods_receives");
  await tx(async (c) => {
    const gr = await c.query(
      "INSERT INTO goods_receives (no, po_id, received_by_id, note) VALUES ($1,$2,$3,$4) RETURNING id",
      [no, po.id, req.user.id, note || null]
    );
    for (const i of items) {
      await c.query("INSERT INTO gr_items (gr_id, po_item_id, qty) VALUES ($1,$2,$3)", [gr.rows[0].id, i.poItemId, i.qty]);
    }
  });

  const after = await loadPO(po.id);
  const lengkap = after.items.every((i) => i.diterima >= i.qty - 1e-9);
  const status = lengkap ? "DITERIMA" : "DITERIMA_SEBAGIAN";
  await query("UPDATE purchase_orders SET status=$1 WHERE id=$2", [status, po.id]);

  // Permintaan dianggap selesai bila seluruh PO-nya sudah diterima penuh.
  const sisaPO = await query(
    "SELECT COUNT(*)::int AS n FROM purchase_orders WHERE request_id=$1 AND status <> 'DITERIMA'",
    [po.request_id]
  );
  if (lengkap && sisaPO.rows[0].n === 0) {
    await query("UPDATE material_requests SET status='SELESAI' WHERE id=$1", [po.request_id]);
  }

  res.status(201).json({ ok: true, no, statusPO: status, po: await loadPO(po.id) });
}));

router.get("/riwayat/penerimaan", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT gr.id, gr.no, gr.date, gr.note,
            p.no AS po_no, v.name AS vendor_name, u.name AS petugas,
            COALESCE((SELECT json_agg(json_build_object(
              'name', ri.name, 'qty', gi.qty, 'unit', ri.unit))
              FROM gr_items gi
              JOIN po_items pi ON pi.id = gi.po_item_id
              JOIN request_items ri ON ri.id = pi.request_item_id
              WHERE gi.gr_id = gr.id), '[]') AS items
     FROM goods_receives gr
     JOIN purchase_orders p ON p.id = gr.po_id
     JOIN vendors v ON v.id = p.vendor_id
     JOIN users u ON u.id = gr.received_by_id
     ORDER BY gr.date DESC`
  );
  res.json(rows);
}));

module.exports = router;
