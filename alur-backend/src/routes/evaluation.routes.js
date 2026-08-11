const router = require("express").Router();
const { z } = require("zod");
const { query, tx } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");
const { nextNo } = require("../utils/counter");

// Matriks perbandingan: satu baris per material, satu kolom per vendor yang menawar.
router.get("/:id", requireAuth, requireRole("PURCHASING"), asyncHandler(async (req, res) => {
  const r = await query("SELECT id, no, project, status FROM material_requests WHERE id = $1", [req.params.id]);
  if (r.rows.length === 0) throw new ApiError(404, "Permintaan tidak ditemukan.");

  const items = (await query(
    "SELECT id, name, spec, unit, qty FROM request_items WHERE request_id = $1 ORDER BY name",
    [req.params.id]
  )).rows;

  const vendors = (await query(
    `SELECT q.id AS quote_id, q.vendor_id, v.name AS vendor_name, q.note, q.submitted_at
     FROM quotes q JOIN vendors v ON v.id = q.vendor_id
     WHERE q.request_id = $1 ORDER BY v.name`,
    [req.params.id]
  )).rows;

  const prices = (await query(
    `SELECT qi.request_item_id, q.vendor_id, qi.unit_price
     FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id
     WHERE q.request_id = $1`,
    [req.params.id]
  )).rows;

  const matrix = items.map((item) => {
    const harga = vendors.map((v) => {
      const p = prices.find((x) => x.request_item_id === item.id && x.vendor_id === v.vendor_id);
      return {
        vendorId: v.vendor_id,
        vendorName: v.vendor_name,
        unitPrice: p ? Number(p.unit_price) : null,
        total: p ? Number(p.unit_price) * Number(item.qty) : null,
      };
    });
    const valid = harga.filter((h) => h.unitPrice !== null);
    const termurah = valid.length ? valid.reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a)) : null;
    return {
      requestItemId: item.id,
      name: item.name,
      spec: item.spec,
      unit: item.unit,
      qty: Number(item.qty),
      harga,
      termurahVendorId: termurah ? termurah.vendorId : null,
      termurahHarga: termurah ? termurah.unitPrice : null,
    };
  });

  res.json({ permintaan: r.rows[0], vendors, matrix });
}));

const approveSchema = z.object({
  pilihan: z.array(z.object({
    requestItemId: z.string().min(1),
    vendorId: z.string().min(1),
  })).min(1, "pilih minimal 1 item"),
});

// Mengelompokkan item terpilih per vendor, lalu menerbitkan satu PO per vendor.
router.post("/:id/approve", requireAuth, requireRole("PURCHASING"), asyncHandler(async (req, res) => {
  const { pilihan } = approveSchema.parse(req.body);

  const r = await query("SELECT * FROM material_requests WHERE id = $1", [req.params.id]);
  if (r.rows.length === 0) throw new ApiError(404, "Permintaan tidak ditemukan.");
  if (r.rows[0].status !== "RFQ_TERKIRIM") {
    throw new ApiError(400, `Evaluasi hanya untuk status RFQ_TERKIRIM. Status sekarang: ${r.rows[0].status}.`);
  }

  const perVendor = new Map();
  for (const p of pilihan) {
    const item = (await query("SELECT * FROM request_items WHERE id=$1 AND request_id=$2", [p.requestItemId, req.params.id])).rows[0];
    if (!item) throw new ApiError(400, "Ada item yang bukan bagian dari permintaan ini.");

    const price = (await query(
      `SELECT qi.unit_price FROM quote_items qi
       JOIN quotes q ON q.id = qi.quote_id
       WHERE q.request_id=$1 AND q.vendor_id=$2 AND qi.request_item_id=$3`,
      [req.params.id, p.vendorId, p.requestItemId]
    )).rows[0];
    if (!price) throw new ApiError(400, `Vendor terpilih tidak menawarkan harga untuk "${item.name}".`);

    if (!perVendor.has(p.vendorId)) perVendor.set(p.vendorId, []);
    perVendor.get(p.vendorId).push({ requestItemId: item.id, qty: Number(item.qty), unitPrice: Number(price.unit_price) });
  }

  const poIds = [];
  for (const [vendorId, items] of perVendor) {
    const no = await nextNo("PO", "purchase_orders");
    const id = await tx(async (c) => {
      const po = await c.query(
        "INSERT INTO purchase_orders (no, request_id, vendor_id) VALUES ($1,$2,$3) RETURNING id",
        [no, req.params.id, vendorId]
      );
      for (const i of items) {
        await c.query(
          "INSERT INTO po_items (po_id, request_item_id, qty, unit_price) VALUES ($1,$2,$3,$4)",
          [po.rows[0].id, i.requestItemId, i.qty, i.unitPrice]
        );
      }
      return po.rows[0].id;
    });
    poIds.push(id);
  }

  await query("UPDATE material_requests SET status='PO_TERBIT' WHERE id=$1", [req.params.id]);

  const pos = (await query(
    `SELECT p.*, v.name AS vendor_name FROM purchase_orders p
     JOIN vendors v ON v.id = p.vendor_id WHERE p.id = ANY($1)`,
    [poIds]
  )).rows;

  res.status(201).json({ ok: true, jumlahPO: pos.length, purchaseOrders: pos });
}));

module.exports = router;
