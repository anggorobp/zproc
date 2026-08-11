require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { errorHandler, ApiError } = require("./middleware/errorHandler");

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

module.exports = app;
