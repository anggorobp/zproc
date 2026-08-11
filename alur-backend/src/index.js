// Titik masuk untuk menjalankan server secara lokal (npm run dev / npm start).
// Deploy di Vercel TIDAK memakai file ini — lihat api/index.js.

for (const key of ["DATABASE_URL", "JWT_SECRET"]) {
  if (!process.env[key]) {
    require("dotenv").config();
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
}

const app = require("./app");

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
