import React from "react";
import { api, angka } from "../lib.js";
import { Page, Alert, Loading, useLoader } from "../ui.jsx";

export default function Stok() {
  const { data: stock, loading, error, reload } = useLoader(() => api.get("/stock"), []);

  if (loading) return <Loading />;

  return (
    <Page title="Stok Material" sub="Dihitung otomatis: total masuk (penerimaan) dikurangi total keluar (pengeluaran).">
      <Alert kind="error">{error}</Alert>

      {stock.length === 0 ? (
        <div className="card empty">Belum ada data stok. Stok muncul setelah ada penerimaan barang.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th className="num">Masuk</th>
                <th className="num">Keluar</th>
                <th className="num">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s, i) => (
                <tr key={i}>
                  <td><b>{s.name}</b> <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>({s.unit})</span></td>
                  <td className="num" style={{ color: "var(--ok)" }}>+{angka(s.masuk)}</td>
                  <td className="num" style={{ color: "var(--danger)" }}>-{angka(s.keluar)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{angka(s.sisa)} {s.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={reload}>Segarkan</button>
    </Page>
  );
}
