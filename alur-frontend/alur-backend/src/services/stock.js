const { query } = require("../db/pool");

// Stok tidak disimpan sebagai kolom. Selalu dihitung: total masuk - total keluar,
// digabung per nama material + satuan agar material sama dari permintaan berbeda menyatu.
async function getStock() {
  const { rows } = await query(`
    WITH masuk AS (
      SELECT ri.name, ri.unit, SUM(g.qty) AS qty
      FROM gr_items g
      JOIN po_items pi ON pi.id = g.po_item_id
      JOIN request_items ri ON ri.id = pi.request_item_id
      GROUP BY ri.name, ri.unit
    ),
    keluar AS (
      SELECT ri.name, ri.unit, SUM(gi.qty) AS qty
      FROM gi_items gi
      JOIN request_items ri ON ri.id = gi.request_item_id
      GROUP BY ri.name, ri.unit
    )
    SELECT COALESCE(m.name, k.name) AS name,
           COALESCE(m.unit, k.unit) AS unit,
           COALESCE(m.qty, 0)::float AS masuk,
           COALESCE(k.qty, 0)::float AS keluar,
           (COALESCE(m.qty, 0) - COALESCE(k.qty, 0))::float AS sisa
    FROM masuk m
    FULL OUTER JOIN keluar k ON k.name = m.name AND k.unit = m.unit
    ORDER BY 1
  `);
  return rows;
}

// Stok per baris material, dipakai form pengeluaran barang.
async function getAvailableItems() {
  const { rows } = await query(`
    SELECT ri.id AS request_item_id, ri.name, ri.spec, ri.unit,
           (COALESCE(m.qty, 0) - COALESCE(k.qty, 0))::float AS tersedia
    FROM request_items ri
    LEFT JOIN (
      SELECT pi.request_item_id, SUM(g.qty) AS qty
      FROM gr_items g JOIN po_items pi ON pi.id = g.po_item_id
      GROUP BY pi.request_item_id
    ) m ON m.request_item_id = ri.id
    LEFT JOIN (
      SELECT request_item_id, SUM(qty) AS qty FROM gi_items GROUP BY request_item_id
    ) k ON k.request_item_id = ri.id
    WHERE COALESCE(m.qty, 0) - COALESCE(k.qty, 0) > 0
    ORDER BY ri.name
  `);
  return rows;
}

module.exports = { getStock, getAvailableItems };
