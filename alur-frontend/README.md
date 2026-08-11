# ALUR — Frontend (v4)

## Prasyarat
Backend sudah jalan di `http://localhost:4000` (lihat README backend).

## Instalasi

```powershell
npm install
copy .env.example .env
npm run dev
```

Tunggu sampai muncul `Local: http://localhost:5173/`, lalu buka alamat itu di browser.

---

## Login

Halaman login menampilkan daftar akun — **klik salah satu email untuk mengisi form otomatis**, tidak perlu mengetik manual.

---

## Menguji alur lengkap

1. Login **Tim Lapangan** → menu **Permintaan** → **+ Permintaan Baru** → isi proyek & minimal satu material → **Simpan**
2. Keluar → login **Site Manager** → menu **Permintaan** → tombol **Setujui (SM)**
3. Keluar → login **Project Manager** → tombol **Setujui (PM)** → status jadi **Disetujui**
4. Keluar → login **Purchasing** → menu **RFQ & Vendor** → **Kirim RFQ** → pilih vendor → salin link yang muncul
5. Buka link itu di tab baru (mensimulasikan vendor, tanpa login) → isi harga → **Kirim Penawaran**
6. Kembali ke Purchasing → menu **Evaluasi & PO** → **Buka Evaluasi** → harga termurah otomatis ditandai → **Terbitkan PO**
7. Keluar → login **Logistik** → menu **Penerimaan** → **Terima** → isi jumlah → **Simpan Penerimaan**
8. Menu **Stok** → material yang diterima langsung muncul
9. Menu **Pengeluaran** → **Catat Pengeluaran** → pilih material, isi jumlah (dibatasi otomatis sesuai stok)
10. Menu **Laporan** → pilih periode → lihat grafik nilai PO per vendor

---

## Kalau ada masalah

**Halaman kosong / "Tidak bisa menghubungi server"**
→ Backend belum jalan. Cek jendela PowerShell backend, harus ada `ALUR backend siap.`

**Ketendang ke halaman login setelah refresh**
→ Seharusnya tidak terjadi lagi di versi ini (sesi dipulihkan otomatis lewat token tersimpan). Jika masih terjadi: tekan F12 → Console → ketik `localStorage.clear()` → Enter → refresh.

---

## Struktur

```
src/
  main.jsx          Entry point
  App.jsx            Routing sederhana (tab) + halaman publik /penawaran/:token
  lib.js             Pemanggil API, format Rupiah/tanggal, label status & role
  ui.jsx             Komponen kecil dipakai ulang: Chip, Modal, Alert, Page
  styles.css         Semua styling (tanpa framework CSS eksternal)
  pages/
    Login.jsx
    Dashboard.jsx
    Permintaan.jsx    Buat & approve permintaan material
    Rfq.jsx            Kirim RFQ, lihat link vendor
    Penawaran.jsx      Halaman publik vendor (tanpa login)
    Evaluasi.jsx       Matriks harga, terbitkan PO
    Penerimaan.jsx     Catat barang masuk (boleh bertahap)
    Pengeluaran.jsx    Catat barang keluar (divalidasi ke stok)
    Stok.jsx
    Laporan.jsx
    Vendors.jsx
```

## Sudah diuji

20 pengujian lewat browser sungguhan (Playwright + Chromium) yang mengklik tombol dan mengisi form seperti pengguna — bukan memanggil API secara langsung. Mencakup seluruh alur dari login sampai laporan.
