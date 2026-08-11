import React, { useEffect, useState } from "react";
import { api, angka, rupiah } from "../lib.js";
import { Alert } from "../ui.jsx";

// Public page reached by the token link. No login, no sidebar.
export default function Penawaran({ token }) {
  const [data, setData] = useState(null);
  const [harga, setHarga] = useState({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sukses, setSukses] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/rfq/public/${token}`, false)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  async function kirim() {
    setError("");
    const items = data.items.map((i) => ({ requestItemId: i.id, unitPrice: Number(harga[i.id]) }));
    const kosong = items.find((i) => !(i.unitPrice >= 0) || harga[i.requestItemId] === undefined || harga[i.requestItemId] === "");
    if (kosong) return setError("Semua harga satuan wajib diisi.");

    setBusy(true);
    try {
      const res = await api.post(`/rfq/public/${token}`, { note, items }, false);
      setSukses(res.pesan);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="login-wrap">
        <div className="login-box">
          <Alert kind="error">{error}</Alert>
        </div>
      </div>
    );
  }

  if (!data) return <div className="login-wrap"><div className="card empty">Memuat…</div></div>;

  const total = data.items.reduce((s, i) => s + (Number(harga[i.id]) || 0) * Number(i.qty), 0);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px 70px" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div className="login-mark" style={{ margin: "0 auto 10px" }}>A</div>
        <h1 style={{ margin: "0 0 2px", fontSize: 24 }}>Formulir Penawaran Harga</h1>
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
          {data.permintaan.no} — {data.permintaan.project}
        </p>
      </div>

      {sukses || data.sudahMengisi ? (
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
          <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>Penawaran Terkirim</h2>
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>
            {sukses || "Penawaran untuk permintaan ini sudah pernah Anda kirimkan."}
          </p>
        </div>
      ) : (
        <>
          <Alert kind="info">
            Yth. <b>{data.vendor}</b> — silakan isi harga satuan untuk setiap material di bawah ini.
          </Alert>
          <Alert kind="error" onClose={() => setError("")}>{error}</Alert>

          <div className="card" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Material</th><th>Spesifikasi</th><th className="num">Jumlah</th>
                  <th style={{ width: 160 }}>Harga Satuan (Rp)</th><th className="num" style={{ width: 140 }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td><b>{i.name}</b></td>
                    <td style={{ color: "var(--ink-soft)" }}>{i.spec || "-"}</td>
                    <td className="num">{angka(i.qty)} {i.unit}</td>
                    <td>
                      <input
                        type="number" min="0" step="any" placeholder="0"
                        value={harga[i.id] ?? ""}
                        onChange={(e) => setHarga({ ...harga, [i.id]: e.target.value })}
                        style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 6, padding: "7px 9px" }}
                      />
                    </td>
                    <td className="num">{rupiah((Number(harga[i.id]) || 0) * Number(i.qty))}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>Total Penawaran</td>
                  <td className="num" style={{ fontWeight: 700 }}>{rupiah(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            <div className="field">
              <label>Catatan (opsional) — masa berlaku harga, waktu kirim, dan lain-lain</label>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="contoh: Harga berlaku 14 hari, pengiriman 3 hari kerja." />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={kirim} disabled={busy}>
              {busy ? "Mengirim…" : "Kirim Penawaran"}
            </button>
            <p className="hint" style={{ textAlign: "center" }}>
              Penawaran hanya bisa dikirim satu kali. Periksa kembali sebelum mengirim.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
