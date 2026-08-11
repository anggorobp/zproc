class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function errorHandler(err, req, res, next) {
  // Zod validation -> plain Indonesian sentence the UI can show directly.
  if (err.name === "ZodError" && Array.isArray(err.errors)) {
    const detail = err.errors
      .map((e) => `${(e.path || []).filter((p) => typeof p === "string").join(".") || "isian"}: ${e.message}`)
      .join("; ");
    return res.status(400).json({ error: `Data belum lengkap — ${detail}` });
  }

  // PostgreSQL error codes
  if (err.code === "23505") return res.status(409).json({ error: "Data sudah ada (duplikat)." });
  if (err.code === "23503") return res.status(400).json({ error: "Data terkait tidak ditemukan." });
  if (err.code === "23514") return res.status(400).json({ error: "Nilai tidak valid (melanggar aturan kolom)." });
  if (err.code === "ECONNREFUSED" || err.code === "28P01" || err.code === "3D000") {
    return res.status(500).json({ error: "Tidak bisa terhubung ke database. Cek PostgreSQL dan file .env." });
  }

  const status = err.status || 500;
  if (status >= 500) console.error("[error]", err);

  res.status(status).json({
    error: status >= 500 ? "Terjadi kesalahan pada server." : err.message,
  });
}

module.exports = { ApiError, errorHandler };
