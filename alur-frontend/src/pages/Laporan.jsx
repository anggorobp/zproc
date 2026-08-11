import React, { useState } from "react";
import { api, rupiah, angka } from "../lib.js";
import { Page, Alert, Loading, useLoader } from "../ui.jsx";

const PERIODE = [
  { value: "harian", label: "Harian" },
  { value: "mingguan", label: "Mingguan" },
  { value: "bulanan", label: "Bulanan" },
];

export default function Laporan() {
  const [period, setPeriod] = useState("bulanan");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, loading, error, reload } = useLoader(
    () => api.get(`/reports?period=${period}&date=${date}`),
    [period, date]
  );

  const maxVendor = data ? Math.max(1, ...data.perVendor.map((v) => v.nilai)) : 1;

  return (
    <Page title="Laporan" sub="Ringkasan aktivitas pengadaan per periode.">
      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODE.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn btn-sm" onClick={reload}>Terapkan</button>
      </div>

      <Alert kind="error">{error}</Alert>

      {loading || !data ? (
        <Loading />
      ) : (
        <>
          <p className="hint" style={{ marginTop: -6, marginBottom: 16 }}>
            Periode: {new Date(data.periode.mulai).toLocaleDateString("id-ID")} – {new Date(data.periode.sampai).toLocaleDateString("id-ID")}
          </p>

          <div className="kpis">
            <div className="kpi"><div className="kpi-label">Permintaan</div><div className="kpi-value">{data.ringkasan.jumlahPermintaan}</div></div>
            <div className="kpi"><div className="kpi-label">Purchase Order</div><div className="kpi-value">{data.ringkasan.jumlahPO}</div></div>
            <div className="kpi"><div className="kpi-label">Nilai PO</div><div className="kpi-value money">{rupiah(data.ringkasan.nilaiPO)}</div></div>
            <div className="kpi"><div className="kpi-label">Penerimaan</div><div className="kpi-value">{data.ringkasan.jumlahPenerimaan}</div></div>
            <div className="kpi"><div className="kpi-label">Pengeluaran</div><div className="kpi-value">{data.ringkasan.jumlahPengeluaran}</div></div>
          </div>

          <div className="card card-pad" style={{ marginBottom: 22 }}>
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Nilai PO per Vendor</div>
            {data.perVendor.length === 0 ? (
              <p style={{ color: "var(--ink-soft)", margin: 0 }}>Tidak ada PO pada periode ini.</p>
            ) : (
              data.perVendor.map((v, i) => (
                <div className="bar-row" key={i}>
                  <div className="bar-name">{v.name}</div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(v.nilai / maxVendor) * 100}%` }} /></div>
                  <div className="bar-val">{rupiah(v.nilai)}</div>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-pad" style={{ borderBottom: "1px solid var(--line)", fontWeight: 600 }}>Stok Saat Ini</div>
            {data.stock.length === 0 ? (
              <div className="empty">Belum ada data stok.</div>
            ) : (
              <table>
                <thead><tr><th>Material</th><th className="num">Masuk</th><th className="num">Keluar</th><th className="num">Sisa</th></tr></thead>
                <tbody>
                  {data.stock.map((s, i) => (
                    <tr key={i}>
                      <td>{s.name} <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>({s.unit})</span></td>
                      <td className="num">{angka(s.masuk)}</td>
                      <td className="num">{angka(s.keluar)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{angka(s.sisa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
