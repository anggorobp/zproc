const router = require("express").Router();
const { z } = require("zod");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");
const { SELECT_REQUEST } = require("./requests.routes");

async function getStatus(id) {
  const { rows } = await query("SELECT status FROM material_requests WHERE id = $1", [id]);
  if (rows.length === 0) throw new ApiError(404, "Permintaan tidak ditemukan.");
  return rows[0].status;
}

async function reload(id, res) {
  const { rows } = await query(`${SELECT_REQUEST} WHERE r.id = $1`, [id]);
  res.json(rows[0]);
}

// Tahap 1 dari 2 — Site Manager. DIAJUKAN -> PENDING_PROJECT_MANAGER
router.post("/:id/site-manager", requireAuth, requireRole("SITE_MANAGER"), asyncHandler(async (req, res) => {
  const status = await getStatus(req.params.id);
  if (status !== "DIAJUKAN") {
    throw new ApiError(400, `Belum bisa disetujui Site Manager. Status sekarang: ${status}.`);
  }
  await query(
    `UPDATE material_requests
     SET status='PENDING_PROJECT_MANAGER', approved_sm_id=$1, approved_sm_at=now(), rejected_reason=NULL
     WHERE id=$2`,
    [req.user.id, req.params.id]
  );
  await reload(req.params.id, res);
}));

// Tahap 2 dari 2 — Project Manager. PENDING_PROJECT_MANAGER -> DISETUJUI
router.post("/:id/project-manager", requireAuth, requireRole("PROJECT_MANAGER"), asyncHandler(async (req, res) => {
  const status = await getStatus(req.params.id);
  if (status !== "PENDING_PROJECT_MANAGER") {
    throw new ApiError(400, `Belum bisa disetujui Project Manager. Status sekarang: ${status}.`);
  }
  await query(
    `UPDATE material_requests
     SET status='DISETUJUI', approved_pm_id=$1, approved_pm_at=now(), rejected_reason=NULL
     WHERE id=$2`,
    [req.user.id, req.params.id]
  );
  await reload(req.params.id, res);
}));

const rejectSchema = z.object({ reason: z.string().optional().nullable() });

router.post("/:id/reject", requireAuth, requireRole("SITE_MANAGER", "PROJECT_MANAGER"), asyncHandler(async (req, res) => {
  const { reason } = rejectSchema.parse(req.body || {});
  const status = await getStatus(req.params.id);
  if (!["DIAJUKAN", "PENDING_PROJECT_MANAGER"].includes(status)) {
    throw new ApiError(400, `Tidak bisa ditolak pada tahap ini. Status sekarang: ${status}.`);
  }
  await query(
    `UPDATE material_requests
     SET status='DITOLAK', rejected_reason=$1,
         approved_sm_id=NULL, approved_sm_at=NULL,
         approved_pm_id=NULL, approved_pm_at=NULL
     WHERE id=$2`,
    [reason || "Tanpa keterangan", req.params.id]
  );
  await reload(req.params.id, res);
}));

// Mengembalikan permintaan yang ditolak ke antrean approval.
router.post("/:id/ajukan-ulang", requireAuth, requireRole("LAPANGAN", "SITE_MANAGER"), asyncHandler(async (req, res) => {
  const status = await getStatus(req.params.id);
  if (status !== "DITOLAK") {
    throw new ApiError(400, `Hanya permintaan DITOLAK yang bisa diajukan ulang. Status sekarang: ${status}.`);
  }
  await query("UPDATE material_requests SET status='DIAJUKAN', rejected_reason=NULL WHERE id=$1", [req.params.id]);
  await reload(req.params.id, res);
}));

module.exports = router;
