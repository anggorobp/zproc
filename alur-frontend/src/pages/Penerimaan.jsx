import React, { useState } from "react";
import { api, rupiah, angka, tanggal } from "../lib.js";
import { Page, Chip, Alert, Modal, Loading, useLoader } from "../ui.jsx";

export default function Penerimaan() {
  const { data: pos, loading, error, reload, setError } = useLoader(() => api.get("/purchase-orders"), []);
  const [target, setTarget] = useState(null);
  const [qty, setQty] = useState({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");

  function buka(po) {
    setTarget(po);
    setNote("");
    const isi = {};
    po.items.forEach((i) => { if (i.sisa > 0) isi[i.id] = ""; });
    setQty(isi);
    setError("");
  }

  async function terima() {
    const items = Object.entries(qty)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([poItemId, v]) => ({ poItemId, qty: Number(v) }));
    if (items.length === 0) return setError("Isi jumlah untuk minimal satu item.");

    setBusy(true); setError("");
    try {
      const res = await api.post(`/purchase-orders/${target.id}/receive`, { note, items });
      setPesan(`Penerimaan ${res.no} tercatat. Status PO: ${res.statusPO.replace(/_/g, " ")}.`);
      setTarget(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  const belumLengkap = pos.filter((p) => p.status !== "DITERIMA");
  const selesai = pos.filter((p) => p.status === "DITERIMA");

  return (
    <Page title="Penerimaan Barang" sub="Catat barang masuk dari vendor berdasarkan Purchase Order. Penerimaan boleh bertahap.">
      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>
      <Alert kind="ok" onClose={() => setPesan("")}>{pesan}</Alert>

      {pos.length === 0 ? (
        <div className="card empty">Belum ada Purchase Order. PO terbit otomatis setelah evaluasi harga disetujui.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: belumLengkap.length && selesai.length ? 22 : 0 }}>
            <div className="card-pad" style={{ borderBottom: "1px solid var(--line)", fontWeight: 600 }}>
              Belum Diterima Penuh ({belumLengkap.length})
            </div>
            {belumLengkap.length === 0 ? (
              <div className="empty">Semua PO sudah diterima penuh.</div>
            ) : (
              <table>
                <thead><tr><th>No. PO</th><th>Vendor</th><th>Proyek</th><th className="num">Nilai</th><th>Status</th><th style={{ width: 100 }}></th></tr></thead>
                <tbody>
                  {belumLengkap.map((po) => (
                    <tr key={po.id}>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{po.no}</td>
                      <td>{po.vendor_name}</td>
                      <td>{po.project}</td>
                      <td className="num">{rupiah(po.total)}</td>
                      <td><Chip status={po.status} /></td>
                      <td><button className="btn btn-sm btn-primary" onClick={() => buka(po)}>Terima</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selesai.length > 0 && (
            <div className="card">
              <div className="card-pad" style={{ borderBottom: "1px solid var(--line)", fontWeight: 600 }}>
                Sudah Diterima Penuh ({selesai.length})
              </div>
              <table>
                <thead><tr><th>No. PO</th><th>Vendor</th><th>Proyek</th><th className="num">Nilai</th></tr></thead>
                <tbody>
                  {selesai.map((po) => (
                    <tr key={po.id}>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{po.no}</td>
                      <td>{po.vendor_name}</td>
                      <td>{po.project}</td>
                      <td className="num">{rupiah(po.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {target && (
        <Modal
          title={`Terima Barang — ${target.no}`}
          onClose={() => setTarget(null)}
          footer={
            <>
              <button className="btn" onClick={() => setTarget(null)}>Batal</button>
              <button className="btn btn-primary" onClick={terima} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan Penerimaan"}
              </button>
            </>
          }
        >
          <Alert kind="error">{error}</Alert>
          <p style={{ marginTop: 0, fontSize: 13, color: "var(--ink-soft)" }}>Vendor: <b style={{ color: "var(--ink)" }}>{target.vendor_name}</b></p>

          <table style={{ marginBottom: 14 }}>
            <thead><tr><th>Material</th><th className="num">Dipesan</th><th className="num">Sudah Diterima</th><th style={{ width: 140 }}>Diterima Sekarang</th></tr></thead>
            <tbody>
              {target.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td className="num">{angka(i.qty)} {i.unit}</td>
                  <td className="num">{angka(i.diterima)} {i.unit}</td>
                  <td>
                    {i.sisa <= 0 ? (
                      <span style={{ color: "var(--ok)", fontSize: 12.5 }}>Lengkap</span>
                    ) : (
                      <input type="number" min="0" max={i.sisa} step="any" placeholder={`maks ${angka(i.sisa)}`}
                        value={qty[i.id] ?? ""}
                        onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                        style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 6, padding: "6px 8px" }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="field">
            <label>Catatan (opsional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="contoh: kondisi barang baik, kiriman ke-1" />
          </div>
        </Modal>
      )}
    </Page>
  );
}
