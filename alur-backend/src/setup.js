require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

// One command does everything: create the database if missing, build the tables,
// then insert the starter accounts and vendors. Safe to run more than once.

const USERS = [
  { role: "ADMIN",           name: "Administrator",   email: "admin@perusahaan.co.id",       password: "admin123" },
  { role: "LAPANGAN",        name: "Tim Lapangan",    email: "lapangan@perusahaan.co.id",    password: "lapangan123" },
  { role: "SITE_MANAGER",    name: "Site Manager",    email: "sitemanager@perusahaan.co.id", password: "sitemanager123" },
  { role: "PROJECT_MANAGER", name: "Project Manager", email: "pm@perusahaan.co.id",          password: "pm123456" },
  { role: "PURCHASING",      name: "Purchasing",      email: "purchasing@perusahaan.co.id",  password: "purchasing123" },
  { role: "LOGISTIK",        name: "Logistik",        email: "logistik@perusahaan.co.id",    password: "logistik123" },
];

const VENDORS = [
  { name: "CV Sumber Bangunan Jaya", email: "sales@sumberbangunan.co.id", phone: "021-5551001", address: "Jakarta Timur", category: "Besi & Baja" },
  { name: "PT Beton Karya Utama",    email: "quote@betonkarya.co.id",     phone: "021-5552002", address: "Bekasi",        category: "Beton & Semen" },
  { name: "UD Mitra Material",       email: "mitra.material@gmail.com",   phone: "021-5553003", address: "Tangerang",     category: "Material Umum" },
];

function line(char = "=") {
  console.log(char.repeat(70));
}

function fail(judul, saran) {
  console.log("");
  line();
  console.log(`  GAGAL: ${judul}`);
  line();
  saran.forEach((s) => console.log(`  ${s}`));
  console.log("");
  process.exit(1);
}

function parseUrl(url) {
  try {
    const u = new URL(url);
    return {
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      host: u.hostname,
      port: Number(u.port || 5432),
      database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    };
  } catch {
    return null;
  }
}

async function main() {
  console.log("");
  line();
  console.log("  ALUR — Penyiapan Database");
  line();

  if (!process.env.DATABASE_URL) {
    fail("File .env belum ada atau DATABASE_URL kosong", [
      "Jalankan perintah ini lebih dulu:",
      "",
      "    copy .env.example .env",
      "    notepad .env",
      "",
      "Lalu ganti PASSWORD_ANDA dengan password PostgreSQL Anda.",
    ]);
  }

  const cfg = parseUrl(process.env.DATABASE_URL);
  if (!cfg || !cfg.database) {
    fail("Format DATABASE_URL salah", [
      "Bentuk yang benar:",
      "",
      '    DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/alur_procurement?schema=public"',
    ]);
  }

  if (cfg.password === "PASSWORD_ANDA") {
    fail("Password di .env belum diganti", [
      "Buka file .env, ganti PASSWORD_ANDA dengan password PostgreSQL Anda:",
      "",
      "    notepad .env",
    ]);
  }

  // Step 1 — reach the target database directly first. This is the only path
  // that works on managed providers like Neon, which give you one database
  // per project and don't expose a "postgres" maintenance database to create
  // others from. Only fall back to create-it-ourselves for local PostgreSQL.
  console.log(`  Menghubungi PostgreSQL di ${cfg.host}:${cfg.port} ...`);
  const isLocal = /localhost|127\.0\.0\.1/.test(cfg.host);
  const ssl = isLocal ? undefined : { rejectUnauthorized: false };

  let db = new Client({ connectionString: process.env.DATABASE_URL, ssl });
  try {
    await db.connect();
    console.log(`  Database "${cfg.database}" ditemukan.`);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      fail("PostgreSQL tidak merespons", [
        isLocal
          ? "Service PostgreSQL kemungkinan mati. Cara menyalakan:"
          : "Server database tidak bisa dihubungi. Cek alamat di DATABASE_URL.",
        ...(isLocal ? [
          "",
          "    1. Tekan Windows + R",
          "    2. Ketik: services.msc  lalu Enter",
          "    3. Cari baris yang namanya diawali 'postgresql'",
          "    4. Klik kanan -> Start",
          "",
          "Setelah itu jalankan lagi: npm run setup",
        ] : []),
      ]);
    }
    if (err.code === "28P01") {
      fail("Password PostgreSQL salah", [
        "Password di file .env tidak cocok.",
        "",
        "    notepad .env",
        "",
        "Perbaiki bagian setelah tanda ':' pada DATABASE_URL.",
      ]);
    }

    if (err.code === "3D000" && isLocal) {
      // Database doesn't exist yet — fine for local Postgres, we can create it
      // via a superuser connection to the always-present "postgres" database.
      const admin = new Client({ ...cfg, database: "postgres", ssl });
      try {
        await admin.connect();
      } catch (adminErr) {
        fail("Database belum ada dan tidak bisa dibuat otomatis", [adminErr.message]);
      }
      await admin.query(`CREATE DATABASE "${cfg.database}"`);
      await admin.end();
      console.log(`  Database "${cfg.database}" dibuat.`);
      db = new Client({ connectionString: process.env.DATABASE_URL, ssl });
      await db.connect();
    } else if (err.code === "3D000") {
      fail(`Database "${cfg.database}" belum ada di server ini`, [
        "Provider database cloud (Neon, Supabase, dll) sudah membuatkan satu database untuk Anda saat project dibuat.",
        "Buka dashboard provider tersebut, salin connection string yang sudah menunjuk ke database itu,",
        "lalu tempelkan ke DATABASE_URL di file .env.",
      ]);
    } else {
      fail("Tidak bisa terhubung ke database", [err.message]);
    }
  }

  // Step 2 — build the tables.
  const sql = fs.readFileSync(path.join(__dirname, "db", "schema.sql"), "utf8");
  await db.query(sql);
  console.log("  Tabel siap (12 tabel).");

  // Step 3 — starter accounts. Upsert keeps existing transaction data intact.
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role`,
      [u.name, u.email, hash, u.role]
    );
  }
  console.log(`  ${USERS.length} akun pengguna siap.`);

  for (const v of VENDORS) {
    const found = await db.query("SELECT id FROM vendors WHERE name = $1", [v.name]);
    if (found.rows.length === 0) {
      await db.query(
        "INSERT INTO vendors (name, email, phone, address, category) VALUES ($1,$2,$3,$4,$5)",
        [v.name, v.email, v.phone, v.address, v.category]
      );
    }
  }
  console.log(`  ${VENDORS.length} vendor contoh siap.`);

  await db.end();

  console.log("");
  line();
  console.log("  DAFTAR AKUN — catat atau cetak bagian ini");
  line("-");
  console.log("  ROLE              EMAIL                                PASSWORD");
  line("-");
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(16)}  ${u.email.padEnd(35)}  ${u.password}`);
  }
  line();
  console.log("");
  console.log("  Penyiapan selesai. Langkah berikutnya:");
  console.log("");
  console.log("      npm run dev");
  console.log("");
}

main().catch((err) => {
  console.log("");
  line();
  console.log("  GAGAL:", err.message);
  line();
  console.log("");
  process.exit(1);
});
