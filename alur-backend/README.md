# ALUR — Backend (v4)

## Instalasi

1. **Extract folder ini**, buka PowerShell di dalamnya (Shift + klik kanan pada area kosong folder → *Open PowerShell window here*).

2. **Buat file konfigurasi:**
   ```powershell
   copy .env.example .env
   notepad .env
   ```
   Ganti `PASSWORD_ANDA` dengan password PostgreSQL Anda. Simpan, tutup.

3. **Install & siapkan database — satu perintah:**
   ```powershell
   npm install
   npm run setup
   ```
   `npm run setup` akan **membuat database, membuat 12 tabel, dan mengisi 6 akun + 3 vendor** secara otomatis. Aman dijalankan berulang kali — tidak menghapus data transaksi yang sudah ada.

4. **Jalankan:**
   ```powershell
   npm run dev
   ```
   Tunggu sampai muncul `ALUR backend siap.` — jangan tutup jendela ini.

---

## Cara memastikan backend benar-benar jalan

Buka browser: `http://localhost:4000`

Anda akan melihat halaman info server (bukan aplikasi). Itu **normal** — backend adalah API, aplikasinya ada di `http://localhost:5173` (frontend).

---

## Akun bawaan

| Role | Email | Password |
|---|---|---|
| Administrator | admin@perusahaan.co.id | admin123 |
| Tim Lapangan | lapangan@perusahaan.co.id | lapangan123 |
| Site Manager | sitemanager@perusahaan.co.id | sitemanager123 |
| Project Manager | pm@perusahaan.co.id | pm123456 |
| Purchasing | purchasing@perusahaan.co.id | purchasing123 |
| Logistik | logistik@perusahaan.co.id | logistik123 |

Ganti password-password ini sebelum dipakai sungguhan.

---

## Kalau ada masalah

`npm run setup` mendeteksi masalah paling umum sendiri dan menuliskan solusinya di layar — PostgreSQL mati, password salah, file `.env` belum dibuat. Baca pesannya, ikuti langkahnya.

Masalah lain:

**`listen EADDRINUSE :::4000`** — port 4000 dipakai proses lama.
```powershell
netstat -ano | findstr :4000
taskkill /PID <angka_paling_kanan> /F
```

---

## Struktur

```
src/
  index.js         Entry point
  setup.js         Skrip satu-perintah: buat DB + tabel + akun awal
  db/
    pool.js        Koneksi PostgreSQL (paket "pg", tanpa ORM)
    schema.sql     Definisi 12 tabel
  middleware/       auth (JWT + role), errorHandler (pesan Indonesia)
  routes/           auth, vendors, requests, approval, rfq,
                    evaluation, po, issue, stock, reports
  services/         email (RFQ, opsional), stock (hitung stok)
  utils/            asyncHandler, counter (nomor dokumen)
```

## Endpoint utama

| Method | Path | Keterangan |
|---|---|---|
| GET | /api/health | Cek server hidup |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Profil user aktif |
| GET/POST | /api/requests | Permintaan material |
| POST | /api/approval/:id/site-manager | Approve Site Manager |
| POST | /api/approval/:id/project-manager | Approve Project Manager |
| POST | /api/approval/:id/reject | Tolak |
| POST | /api/rfq/:id/blast | Kirim RFQ ke vendor terpilih |
| GET/POST | /api/rfq/public/:token | Form vendor (tanpa login) |
| GET | /api/evaluation/:id | Matriks perbandingan harga |
| POST | /api/evaluation/:id/approve | Terbitkan PO |
| GET | /api/purchase-orders | Daftar PO |
| POST | /api/purchase-orders/:id/receive | Penerimaan barang |
| GET/POST | /api/goods-issue | Pengeluaran barang |
| GET | /api/stock | Stok real-time |
| GET | /api/reports | Laporan periodik |

## Alur status permintaan

`DIAJUKAN` → (Site Manager) → `PENDING_PROJECT_MANAGER` → (Project Manager) → `DISETUJUI` → (RFQ) → `RFQ_TERKIRIM` → (evaluasi) → `PO_TERBIT` → (semua PO diterima) → `SELESAI`

Bisa `DITOLAK` dari dua tahap approval pertama, lalu diajukan ulang.

## Sudah diuji

36 pengujian API otomatis dan 20 pengujian browser (klik tombol sungguhan lewat Playwright) — mencakup seluruh alur dari pembuatan permintaan sampai laporan, termasuk kasus gagal: qty kosong, password salah, penawaran ganda, stok tidak cukup, penerimaan melebihi PO.
