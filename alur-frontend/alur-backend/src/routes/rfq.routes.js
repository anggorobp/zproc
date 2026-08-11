const router = require("express").Router();
const crypto = require("crypto");
const { z } = require("zod");
const { query, tx } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");
const { sendRfq, isConfigured } = require("../services/email");

const blastSchema = z.object({ vendorIds: z.array(z.string()).min(1, "pilih minimal 1 vendor") });

// Each vendor gets its own link. The token is the credential — vendors never log in.
router.post("/:id/blast", requireAuth, requireRole("PURCHASING"), asyncHandler(async (req, res) => {
  const { vendorIds } = blastSchema.parse(req.body);

  const reqRows = await query("SELECT * FROM material_requests WHERE id = $1", [req.params.id]);
  if (reqRows.rows.length === 0) throw new ApiError(404, "Permintaan tidak ditemukan.");
  const request = reqRows.rows[0];

  if (!["DISETUJUI", "RFQ_TERKIRIM"].includes(request.status)) {
    throw new ApiError(400, `RFQ hanya untuk permintaan yang sudah DISETUJUI. Status sekarang: ${request.status}.`);
  }

  const items = (await query("SELECT * FROM request_items WHERE request_id = $1 ORDER BY name", [request.id])).rows;
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const hasil = [];

  for (const vendorId of vendorIds) {
    const v = await query("SELECT * FROM vendors WHERE id = $1", [vendorId]);
    if (v.rows.length === 0) continue;
    const vendor = v.rows[0];

    let blast = (await query("SELECT * FROM vendor_blasts WHERE request_id=$1 AND vendor_id=$2", [request.id, vendorId])).rows[0];
    if (!blast) {
      const token = crypto.randomBytes(24).toString("hex");
      blast = (await query(
        "INSERT INTO vendor_blasts (request_id, vendor_id, token) VALUES ($1,$2,$3) RETURNING *",
        [request.id, vendorId, token]
      )).rows[0];
    }

    const link = `${base}/penawaran/${blast.token}`;
    const mail = await sendRfq({ to: vendor.email, vendorName: vendor.name, request, items, link });
    if (mail.sent) await query("UPDATE vendor_blasts SET email_sent = true WHERE id = $1", [blast.id]);

    hasil.push({ vendor: vendor.name, email: vendor.email, link, emailTerkirim: mail.sent, keterangan: mail.reason });
  }

  await query("UPDATE material_requests SET status='RFQ_TERKIRIM' WHERE id=$1", [request.id]);

  res.json({
    ok: true,
    emailAktif: isConfigured(),
    catatan: isConfigured()
      ? "Email penawaran sudah dikirim ke vendor."
      : "SMTP belum diatur. Salin link di bawah dan kirim ke vendor secara manual (WhatsApp/email).",
    hasil,
  });
}));

// Daftar link RFQ yang sudah dibuat untuk satu permintaan.
router.get("/:id/links", requireAuth, requireRole("PURCHASING"), asyncHandler(async (req, res) => {
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const { rows } = await query(
    `SELECT b.token, b.email_sent, v.name AS vendor_name, v.email AS vendor_email,
            (q.id IS NOT NULL) AS sudah_menawar
     FROM vendor_blasts b
     JOIN vendors v ON v.id = b.vendor_id
     LEFT JOIN quotes q ON q.blast_id = b.id
     WHERE b.request_id = $1
     ORDER BY v.name`,
    [req.params.id]
  );
  res.json(rows.map((r) => ({ ...r, link: `${base}/penawaran/${r.token}` })));
}));

// ---- Endpoint publik: tanpa login, hanya bermodal token ----
router.get("/public/:token", asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT b.id AS blast_id, b.request_id, v.name AS vendor_name,
            r.no, r.project, (q.id IS NOT NULL) AS sudah_mengisi
     FROM vendor_blasts b
     JOIN vendors v ON v.id = b.vendor_id
     JOIN material_requests r ON r.id = b.request_id
     LEFT JOIN quotes q ON q.blast_id = b.id
     WHERE b.token = $1`,
    [req.params.token]
  );
  if (rows.length === 0) throw new ApiError(404, "Link tidak valid atau sudah tidak berlaku.");

  const b = rows[0];
  const items = (await query(
    "SELECT id, name, spec, unit, qty FROM request_items WHERE request_id = $1 ORDER BY name",
    [b.request_id]
  )).rows;

  res.json({
    vendor: b.vendor_name,
    permintaan: { no: b.no, project: b.project },
    sudahMengisi: b.sudah_mengisi,
    items,
  });
}));

const quoteSchema = z.object({
  note: z.string().optional().nullable(),
  items: z.array(z.object({
    requestItemId: z.string().min(1),
    unitPrice: z.coerce.number({ invalid_type_error: "harga harus angka" }).nonnegative("harga tidak boleh negatif"),
  })).min(1, "isi minimal 1 harga"),
});

router.post("/public/:token", asyncHandler(async (req, res) => {
  const { note, items } = quoteSchema.parse(req.body);

  const { rows } = await query(
    `SELECT b.id, b.request_id, b.vendor_id, (q.id IS NOT NULL) AS sudah
     FROM vendor_blasts b LEFT JOIN quotes q ON q.blast_id = b.id
     WHERE b.token = $1`,
    [req.params.token]
  );
  if (rows.length === 0) throw new ApiError(404, "Link tidak valid atau sudah tidak berlaku.");
  if (rows[0].sudah) throw new ApiError(400, "Penawaran untuk link ini sudah pernah dikirim.");

  const blast = rows[0];
  await tx(async (c) => {
    const q = await c.query(
      "INSERT INTO quotes (blast_id, request_id, vendor_id, note) VALUES ($1,$2,$3,$4) RETURNING id",
      [blast.id, blast.request_id, blast.vendor_id, note || null]
    );
    for (const i of items) {
      await c.query(
        "INSERT INTO quote_items (quote_id, request_item_id, unit_price) VALUES ($1,$2,$3)",
        [q.rows[0].id, i.requestItemId, i.unitPrice]
      );
    }
  });

  res.status(201).json({ ok: true, pesan: "Terima kasih, penawaran Anda sudah kami terima." });
}));

module.exports = router;
