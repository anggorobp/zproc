import React from "react";
import { api, rupiah, tanggal } from "../lib.js";
import { Page, Chip, Alert, Loading, useLoader } from "../ui.jsx";

export default function Dashboard({ user, go }) {
  const { data, loading, error } = useLoader(async () => {
    const [requests, pos, laporan] = await Promise.all([
      api.get("/requests"),
      api.get("/purchase-orders"),
      api.get("/reports?period=bulanan"),
    ]);
    return { requests, pos, laporan };
  }, []);

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const { requests, pos, laporan } = data;
  const aktif = requests.filter((r) => !["SELESAI", "DITOLAK"].includes(r.status));

  // Rows this user can act on right now — the main reason to open the app.
  const tugas = [];
  if (user.role === "SITE_MANAGER" || user.role === "ADMIN")
    tugas.push(...requests.filter((r) => r.status === "DIAJUKAN").map((r) => ({ r, aksi: "Perlu persetujuan Anda (Site Manager)" })));
  if (user.role === "PROJECT_MANAGER" || user.role === "ADMIN")
    tugas.push(...requests.filter((r) => r.status === "PENDING_PROJECT_MANAGER").map((r) => ({ r, aksi: "Perlu persetujuan Anda (Project Manager)" })));
  if (user.role === "PURCHASING" || user.role === "ADMIN") {
    tugas.push(...requests.filter((r) => r.status === "DISETUJUI").map((r) => ({ r, aksi: "Siap dikirim RFQ ke vendor" })));
    tugas.push(...requests.filter((r) => r.status === "RFQ_TERKIRIM").map((r) => ({ r, aksi: "Menunggu evaluasi harga" })));
  }
  if (user.role === "LOGISTIK" || user.role === "ADMIN")
    tugas.push(...pos.filter((p) => p.status !== "DITERIMA").map((p) => ({ po: p, aksi: "Barang belum diterima penuh" })));

  return (
    <Page title="Ringkasan" sub={`Selamat datang, ${user.name}.`}>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Permintaan Aktif</div>
          <div className="kpi-value">{aktif.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Nilai PO Bulan Ini</div>
          <div className="kpi-value money">{rupiah(laporan.ringkasan.nilaiPO)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">PO Belum Lengkap</div>
          <div className="kpi-value">{pos.filter((p) => p.status !== "DITERIMA").length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Permintaan</div>
          <div className="kpi-value">{requests.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-pad" style={{ borderBottom: "1px solid var(--line)", fontWeight: 600 }}>
          Perlu Tindakan Anda
        </div>
        {tugas.length === 0 ? (
          <div className="empty">Tidak ada yang menunggu tindakan Anda saat ini.</div>
        ) : (
          <table>
            <tbody>
              {tugas.slice(0, 8).map((t, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5, width: 120 }}>
                    {t.r ? t.r.no : t.po.no}
                  </td>
                  <td>{t.r ? t.r.project : `${t.po.vendor_name} — ${t.po.project}`}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{t.aksi}</td>
                  <td style={{ width: 130 }}>
                    <Chip status={t.r ? t.r.status : t.po.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: "1px solid var(--line)", fontWeight: 600 }}>
          Permintaan Terbaru
        </div>
        {requests.length === 0 ? (
          <div className="empty">Belum ada permintaan material.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nomor</th><th>Proyek</th><th>Tanggal</th><th>Item</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 6).map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{r.no}</td>
                  <td>{r.project}</td>
                  <td>{tanggal(r.date)}</td>
                  <td>{r.items.length} item</td>
                  <td><Chip status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  );
}
