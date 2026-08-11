import React, { useState } from "react";
import { api, tanggal } from "../lib.js";
import { Page, Chip, Alert, Modal, Loading, useLoader } from "../ui.jsx";

export default function Rfq() {
  const { data, loading, error, reload, setError } = useLoader(async () => {
    const [requests, vendors] = await Promise.all([api.get("/requests"), api.get("/vendors")]);
    return { requests, vendors };
  }, []);

  const [target, setTarget] = useState(null);
  const [pilih, setPilih] = useState([]);
  const [hasil, setHasil] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");

  if (loading) return <Loading />;
  if (!data) return <Alert kind="error">{error}</Alert>;

  const siap = data.requests.filter((r) => ["DISETUJUI", "RFQ_TERKIRIM"].includes(r.status));

  async function kirim() {
    if (pilih.length === 0) return setError("Pilih minimal satu vendor.");
    setBusy(true); setError("");
    try {
      const res = await api.post(`/rfq/${target.id}/blast`, { vendorIds: pilih });
      setHasil(res);
      setTarget(null);
      setPilih([]);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function lihatLink(r) {
    setBusy(true); setError("");
    try {
      const links = await api.get(`/rfq/${r.id}/links`);
      setHasil({ hasil: links.map((l) => ({ vendor: l.vendor_name, email: l.vendor_email, link: l.link, emailTerkirim: l.email_sent, sudahMenawar: l.sudah_menawar })), catatan: "Daftar link penawaran untuk permintaan ini." });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="RFQ ke Vendor" sub="Kirim permintaan penawaran. Vendor mengisi harga lewat link, tanpa perlu login.">
      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>
      <Alert kind="ok" onClose={() => setPesan("")}>{pesan}</Alert>

      {siap.length === 0 ? (
        <div className="card empty">
          Belum ada permintaan yang siap dikirim RFQ.<br />
          <span style={{ fontSize: 12.5 }}>Permintaan harus berstatus <b>Disetujui</b> (lolos Site Manager dan Project Manager).</span>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr><th>Nomor</th><th>Proyek</th><th>Tanggal</th><th className="num">Item</th><th>Status</th><th style={{ width: 210 }}></th></tr>
            </thead>
            <tbody>
              {siap.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{r.no}</td>
                  <td>{r.project}</td>
                  <td>{tanggal(r.date)}</td>
                  <td className="num">{r.items.length}</td>
                  <td><Chip status={r.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => { setTarget(r); setPilih([]); setError(""); }}>
                        Kirim RFQ
                      </button>
                      {r.status === "RFQ_TERKIRIM" && (
                        <button className="btn btn-sm" disabled={busy} onClick={() => lihatLink(r)}>Lihat Link</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <Modal
          title={`Kirim RFQ — ${target.no}`}
          onClose={() => setTarget(null)}
          footer={
            <>
              <button className="btn" onClick={() => setTarget(null)}>Batal</button>
              <button className="btn btn-primary" onClick={kirim} disabled={busy}>
                {busy ? "Mengirim…" : `Kirim ke ${pilih.length} vendor`}
              </button>
            </>
          }
        >
          <Alert kind="error">{error}</Alert>
          <p style={{ marginTop: 0, fontSize: 13, color: "var(--ink-soft)" }}>
            Proyek: <b style={{ color: "var(--ink)" }}>{target.project}</b> — {target.items.length} item material.
          </p>

          <div style={{ marginBottom: 10, fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>Pilih vendor:</div>
          {data.vendors.map((v) => (
            <label key={v.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #f0ede6", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={pilih.includes(v.id)}
                onChange={(e) => setPilih(e.target.checked ? [...pilih, v.id] : pilih.filter((x) => x !== v.id))}
                style={{ marginTop: 3 }}
              />
              <span>
                <b>{v.name}</b>
                <span style={{ color: "var(--ink-soft)" }}> — {v.category || "umum"}</span>
                <br />
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{v.email}</span>
              </span>
            </label>
          ))}
        </Modal>
      )}

      {hasil && (
        <Modal title="Link Penawaran Vendor" wide onClose={() => setHasil(null)}
          footer={<button className="btn" onClick={() => setHasil(null)}>Tutup</button>}>
          <Alert kind="info">{hasil.catatan}</Alert>
          {hasil.hasil.map((h, i) => (
            <div key={i} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #f0ede6" }}>
              <div style={{ fontWeight: 600 }}>
                {h.vendor}
                {h.sudahMenawar && <span style={{ color: "var(--ok)", fontSize: 12, fontWeight: 500 }}> — sudah mengisi harga</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
                {h.email} · email {h.emailTerkirim ? "terkirim" : "tidak dikirim (SMTP nonaktif)"}
              </div>
              <div className="link-box">{h.link}</div>
              <button className="btn btn-sm" style={{ marginTop: 6 }}
                onClick={() => { navigator.clipboard?.writeText(h.link); setPesan("Link disalin."); }}>
                Salin link
              </button>
            </div>
          ))}
        </Modal>
      )}
    </Page>
  );
}
