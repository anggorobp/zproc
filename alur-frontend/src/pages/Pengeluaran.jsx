import React, { useState } from "react";
import { api, angka, tanggal } from "../lib.js";
import { Page, Alert, Modal, Loading, useLoader } from "../ui.jsx";

export default function Pengeluaran() {
  const { data, loading, error, reload, setError } = useLoader(async () => {
    const [list, tersedia] = await Promise.all([api.get("/goods-issue"), api.get("/goods-issue/tersedia")]);
    return { list, tersedia };
  }, []);

  const [formOpen, setFormOpen] = useState(false);
  const [project, setProject] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([{ key: Math.random(), requestItemId: "", qty: "" }]);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");

  if (loading) return <Loading />;

  function reset() {
    setProject(""); setNote(""); setRows([{ key: Math.random(), requestItemId: "", qty: "" }]);
  }

  async function simpan() {
    setError("");
    if (!project.trim()) return setError("Proyek tujuan wajib diisi.");
    const isi = rows.filter((r) => r.requestItemId && r.qty !== "");
    if (isi.length === 0) return setError("Pilih minimal satu material dan isi jumlahnya.");
    for (const r of isi) {
      if (!(Number(r.qty) > 0)) return setError("Jumlah harus lebih dari 0.");
    }

    setBusy(true);
    try {
      const res = await api.post("/goods-issue", {
        project, note,
        items: isi.map((r) => ({ requestItemId: r.requestItemId, qty: Number(r.qty) })),
      });
      setPesan(`Pengeluaran ${res.no} berhasil dicatat.`);
      setFormOpen(false);
      reset();
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const tersediaMap = Object.fromEntries(data.tersedia.map((t) => [t.request_item_id, t]));

  return (
    <Page
      title="Pengeluaran Barang"
      sub="Catat material yang keluar dari gudang ke proyek. Jumlah divalidasi terhadap stok."
      action={
        <button className="btn btn-primary" onClick={() => { setFormOpen(true); setPesan(""); setError(""); }}
          disabled={data.tersedia.length === 0}>
          + Catat Pengeluaran
        </button>
      }
    >
      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>
      <Alert kind="ok" onClose={() => setPesan("")}>{pesan}</Alert>

      {data.tersedia.length === 0 && (
        <Alert kind="info">Belum ada material dengan stok tersedia untuk dikeluarkan.</Alert>
      )}

      {data.list.length === 0 ? (
        <div className="card empty">Belum ada riwayat pengeluaran barang.</div>
      ) : (
        <div className="card">
          <table>
            <thead><tr><th>Nomor</th><th>Proyek Tujuan</th><th>Petugas</th><th>Tanggal</th><th>Material</th></tr></thead>
            <tbody>
              {data.list.map((gi) => (
                <tr key={gi.id}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{gi.no}</td>
                  <td>{gi.project}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{gi.petugas}</td>
                  <td>{tanggal(gi.date)}</td>
                  <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                    {gi.items.map((i) => `${i.name} (${angka(i.qty)} ${i.unit})`).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <Modal
          title="Catat Pengeluaran Barang"
          onClose={() => setFormOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setFormOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={simpan} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
            </>
          }
        >
          <Alert kind="error">{error}</Alert>

          <div className="field">
            <label>Proyek Tujuan *</label>
            <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="contoh: Proyek Gedung A - Lantai 1" />
          </div>
          <div className="field">
            <label>Catatan (opsional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <label style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>Material</label>
          {rows.map((r, i) => {
            const sisa = r.requestItemId ? tersediaMap[r.requestItemId] : null;
            return (
              <div key={r.key} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 30px", gap: 8, marginTop: 6, alignItems: "center" }}>
                <select value={r.requestItemId}
                  onChange={(e) => { const n = [...rows]; n[i].requestItemId = e.target.value; n[i].qty = ""; setRows(n); }}>
                  <option value="">— pilih material —</option>
                  {data.tersedia.map((t) => (
                    <option key={t.request_item_id} value={t.request_item_id}>
                      {t.name} {t.spec ? `(${t.spec})` : ""} — tersedia {angka(t.tersedia)} {t.unit}
                    </option>
                  ))}
                </select>
                <input type="number" min="0" max={sisa?.tersedia} step="any"
                  placeholder={sisa ? `maks ${angka(sisa.tersedia)}` : "jumlah"}
                  value={r.qty}
                  onChange={(e) => { const n = [...rows]; n[i].qty = e.target.value; setRows(n); }} />
                <button className="x" style={{ background: "none", border: 0, color: "var(--danger)", fontSize: 17 }}
                  onClick={() => setRows(rows.length === 1 ? [{ key: Math.random(), requestItemId: "", qty: "" }] : rows.filter((_, x) => x !== i))}>×</button>
              </div>
            );
          })}
          <button className="btn btn-sm" style={{ marginTop: 8 }}
            onClick={() => setRows([...rows, { key: Math.random(), requestItemId: "", qty: "" }])}>
            + Tambah Material
          </button>
        </Modal>
      )}
    </Page>
  );
}
