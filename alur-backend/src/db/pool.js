const { Pool } = require("pg");

// Cloud Postgres providers (Neon, Render, Supabase, etc.) require SSL and use
// certificates that node-postgres won't validate by default. A local database
// on localhost never needs this, so we only turn it on when the host isn't local.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => console.error("[db] koneksi bermasalah:", err.message));

// query() for normal reads/writes; tx() when several writes must succeed together.
const query = (text, params) => pool.query(text, params);

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
