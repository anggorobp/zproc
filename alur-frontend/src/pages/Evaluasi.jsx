import React, { useState } from "react";
import { api, rupiah, angka, tanggal } from "../lib.js";
import { Page, Chip, Alert, Modal, Loading, useLoader } from "../ui.jsx";

export default function Evaluasi() {
  const { data: requests, loading, error, reload, setError } = useLoader(
    () => api.get("/requests?status=RFQ_TERKIRIM"),
    []
  );
  const [target, setTarget] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [pilihan, setPilihan] = useState({}); // requestItemId -> vendorId
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");
  const [hasilPO, setHasilPO] = useState(null);

  async function buka(r) {
    setError(""); setBusy(true);
    try {
      const ev = await api.get(`/evaluation/${r.id}`);
      setMatrix(ev);
      const auto = {};
      ev.matrix.forEach((m) => { if (m.termurahVendorId) auto[m.requestItemId] = m.termurahVendorId; });
      setPilihan(auto);
      setTarget(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function terbitkanPO() {
    const daftar = Object.entries(pilihan).filter(([, v]) => v);
    if (daftar.length === 0) return setError("Pilih vendor pemenang untuk minimal satu item.");
    setBusy(true); setError("");
    try {
      const res = await api.post(`/evaluation/${target.id}/approve`, {
        pilihan: daftar.map(([requestItemId, vendorId]) => ({ requestItemId, vendorId })),
      });
      setHasilPO(res);
      setTarget(null);
      setMatrix(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <Page title="Evaluasi Harga & Penerbitan PO" sub="Bandingkan penawaran vendor, pilih pemenang per item, lalu terbitkan PO.">
      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>
      <Alert kind="ok" onClose={() => setPesan("")}>{pesan}</Alert>

      {requests.length === 0 ? (
        <div className="card empty">Tidak ada permintaan yang menunggu evaluasi harga.</div>
      ) : (
        <div className="card">
          <table>
            <thead><tr><th>Nomor</th><th>Proyek</th><th>Tanggal</th><th className="num">Item</th><th style={{ width: 140 }}></th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{r.no}</td>
                  <td>{r.project}</td>
                  <td>{tanggal(r.date)}</td>
                  <td className="num">{r.items.length}</td>
                  <td><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => buka(r)}>Buka Evaluasi</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target && matrix && (
        <Modal
          title={`Evaluasi — ${target.no}`}
          wide
          onClose={() => { setTarget(null); setMatrix(null); }}
          footer={
            <>
              <button className="btn" onClick={() => { setTarget(null); setMatrix(null); }}>Batal</button>
              <button className="btn btn-primary" onClick={terbitkanPO} disabled={busy}>
                {busy ? "Menerbitkan…" : "Terbitkan PO"}
              </button>
            </>
          }
        >
          <Alert kind="error">{error}</Alert>
          {matrix.vendors.length === 0 ? (
            <Alert kind="info">Belum ada vendor yang mengirim penawaran untuk permintaan ini.</Alert>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    {matrix.vendors.map((v) => <th key={v.vendor_id}>{v.vendor_name}</th>)}
                    <th>Pilih Pemenang</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.matrix.map((m) => (
                    <tr key={m.requestItemId}>
                      <td>
                        <b>{m.name}</b>
                        <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{angka(m.qty)} {m.unit}</div>
                      </td>
                      {m.harga.map((h) => (
                        <td key={h.vendorId}
                          style={h.vendorId === m.termurahVendorId ? { color: "var(--ok)", fontWeight: 700 } : undefined}>
                          {h.unitPrice === null ? <span style={{ color: "var(--ink-soft)" }}>—</span> : rupiah(h.unitPrice)}
                        </td>
                      ))}
                      <td>
                        <select
                          value={pilihan[m.requestItemId] || ""}
                          onChange={(e) => setPilihan({ ...pilihan, [m.requestItemId]: e.target.value || null })}
                        >
                          <option value="">— tidak dipesan —</option>
                          {m.harga.filter((h) => h.unitPrice !== null).map((h) => (
                            <option key={h.vendorId} value={h.vendorId}>
                              {h.vendorName} ({rupiah(h.unitPrice)}){h.vendorId === m.termurahVendorId ? " · termurah" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hint">Item tanpa vendor terpilih tidak akan masuk PO.</p>
        </Modal>
      )}

      {hasilPO && (
        <Modal title="PO Diterbitkan" onClose={() => setHasilPO(null)}
          footer={<button className="btn btn-primary" onClick={() => setHasilPO(null)}>Tutup</button>}>
          <Alert kind="ok">{hasilPO.jumlahPO} Purchase Order berhasil diterbitkan.</Alert>
          {hasilPO.purchaseOrders.map((po) => (
            <div key={po.id} style={{ padding: "8px 0", borderBottom: "1px solid #f0ede6" }}>
              <b>{po.no}</b> — {po.vendor_name}
            </div>
          ))}
        </Modal>
      )}
    </Page>
  );
}
