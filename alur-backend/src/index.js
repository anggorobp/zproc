require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { errorHandler, ApiError } = require("./middleware/errorHandler");

// Berhenti dengan pesan yang jelas, bukan stack trace, kalau konfigurasi kurang.
for (const key of ["DATABASE_URL", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.log("");
    console.log("=".repeat(70));
    console.log(`  GAGAL START — ${key} belum ada di file .env`);
    console.log("=".repeat(70));
    console.log("");
    console.log("  Jalankan dua perintah ini:");
    console.log("");
    console.log("      copy .env.example .env");
    console.log("      notepad .env");
    console.log("");
    process.exit(1);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.type("html").send(`<!doctype html><meta charset="utf-8">
    <div style="font-family:system-ui,sans-serif;max-width:620px;margin:64px auto;line-height:1.7;color:#16233F">
      <h1 style="margin:0 0 4px;font-size:26px">ALUR Backend</h1>
      <p style="color:#5b6b85;margin:0 0 28px">Server API berjalan normal.</p>
      <p style="background:#f3f1ec;padding:14px 16px;border-radius:8px;margin:0 0 20px">
        Ini halaman server, <b>bukan</b> tampilan aplikasi.<br>
        Buka aplikasinya di <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}">${process.env.FRONTEND_URL || "http://localhost:5173"}</a>
      </p>
      <p style="font-size:14px;color:#5b6b85">Cek kesehatan: <a href="/api/health">/api/health</a></p>
    </div>`);
});

app.get("/api/health", (req, res) => res.json({ ok: true, waktu: new Date().toISOString() }));

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/vendors", require("./routes/vendors.routes"));
app.use("/api/requests", require("./routes/requests.routes").router);
app.use("/api/approval", require("./routes/approval.routes"));
app.use("/api/rfq", require("./routes/rfq.routes"));
app.use("/api/evaluation", require("./routes/evaluation.routes"));
app.use("/api/purchase-orders", require("./routes/po.routes"));
app.use("/api/goods-issue", require("./routes/issue.routes"));
app.use("/api/stock", require("./routes/stock.routes"));
app.use("/api/reports", require("./routes/reports.routes"));

app.use((req, res, next) => next(new ApiError(404, `Endpoint tidak ada: ${req.method} ${req.path}`)));
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);
const server = app.listen(PORT, () => {
  console.log("");
  console.log("  " + "-".repeat(50));
  console.log("   ALUR backend siap.");
  console.log(`   Cek  : http://localhost:${PORT}/api/health`);
  console.log(`   Web  : ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
  console.log("  " + "-".repeat(50));
  console.log("");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log("");
    console.log("=".repeat(70));
    console.log(`  GAGAL START — port ${PORT} sedang dipakai program lain`);
    console.log("=".repeat(70));
    console.log("");
    console.log("  Tutup dulu dengan dua perintah ini:");
    console.log("");
    console.log(`      netstat -ano | findstr :${PORT}`);
    console.log("      taskkill /PID <angka_paling_kanan> /F");
    console.log("");
    process.exit(1);
  }
  throw err;
});
