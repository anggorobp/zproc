const router = require("express").Router();
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { getStock } = require("../services/stock");

// Mengubah ?period=harian|mingguan|bulanan dan ?date=YYYY-MM-DD menjadi rentang tanggal.
function range(period, dateStr) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(base)) throw Object.assign(new Error("Tanggal tidak valid."), { status: 400 });

  const start = new Date(base);
  const end = new Date(base);

  if (period === "mingguan") {
    const day = (start.getDay() + 6) % 7; // Senin = 0
    start.setDate(start.getDate() - day);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (period === "bulanan") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const period = req.query.period || "bulanan";
  const { start, end } = range(period, req.query.date);
  const p = [start, end];

  const [permintaan, po, gr, gi, perVendor, stock] = await Promise.all([
    query("SELECT COUNT(*)::int AS n FROM material_requests WHERE date BETWEEN $1 AND $2", p),
    query(
      `SELECT COUNT(DISTINCT p.id)::int AS n,
              COALESCE(SUM(pi.qty * pi.unit_price), 0)::float AS nilai
       FROM purchase_orders p LEFT JOIN po_items pi ON pi.po_id = p.id
       WHERE p.date BETWEEN $1 AND $2`, p),
    query("SELECT COUNT(*)::int AS n FROM goods_receives WHERE date BETWEEN $1 AND $2", p),
    query("SELECT COUNT(*)::int AS n FROM goods_issues WHERE date BETWEEN $1 AND $2", p),
    query(
      `SELECT v.name, COALESCE(SUM(pi.qty * pi.unit_price), 0)::float AS nilai
       FROM purchase_orders p
       JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN po_items pi ON pi.po_id = p.id
       WHERE p.date BETWEEN $1 AND $2
       GROUP BY v.name ORDER BY nilai DESC`, p),
    getStock(),
  ]);

  res.json({
    periode: { period, mulai: start, sampai: end },
    ringkasan: {
      jumlahPermintaan: permintaan.rows[0].n,
      jumlahPO: po.rows[0].n,
      nilaiPO: po.rows[0].nilai,
      jumlahPenerimaan: gr.rows[0].n,
      jumlahPengeluaran: gi.rows[0].n,
    },
    perVendor: perVendor.rows,
    stock,
  });
}));

module.exports = router;
