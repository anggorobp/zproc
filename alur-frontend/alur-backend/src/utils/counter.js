const { query } = require("../db/pool");

// Builds a document number like PM/2026/001, counting existing rows for this year.
async function nextNo(prefix, table) {
  const year = new Date().getFullYear();
  const start = `${prefix}/${year}/`;
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE no LIKE $1`, [`${start}%`]);
  return `${start}${String(rows[0].n + 1).padStart(3, "0")}`;
}

module.exports = { nextNo };
