import React, { useState } from "react";
import { api, tanggal, angka, can } from "../lib.js";
import { Page, Chip, Alert, Modal, Loading, useLoader } from "../ui.jsx";

const barisKosong = () => ({ key: Math.random(), name: "", spec: "", unit: "", qty: "", purpose: "" });

export default function Permintaan({ user }) {
  const { data: list, loading, error, reload, setError } = useLoader(() => api.get("/requests"), []);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [pesan, setPesan] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  // Form state
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState([barisKosong()]);

  function resetForm() {
    setProject(""); setNotes(""); setRows([barisKosong()]);
  }

  async function simpan() {
    setError("");
    if (!project.trim()) return setError("Nama proyek wajib diisi.");
    const isi = rows.filter((r) => r.name.trim() || r.unit.trim() || String(r.qty).trim());
    if (isi.length === 0) return setError("Isi minimal satu baris material.");
    for (const r of isi) {
      if (!r.name.trim()) return setError("Ada baris yang nama materialnya kosong.");
      if (!r.unit.trim()) return setError(`Satuan untuk "${r.name}" belum diisi.`);
      if (!(Number(r.qty) > 0)) return setError(`Jumlah untuk "${r.name}" harus lebih dari 0.`);
    }

    setBusy(true);
    try {
      const hasil = await api.post("/requests", {
        project,
        notes,
        items: isi.map((r) => ({
          name: r.name,
          spec: r.spec || null,
          unit: r.unit,
          qty: Number(r.qty),
          purpose: r.purpose || null,
        })),
      });
      setPesan(`Permintaan ${hasil.no} berhasil dibuat.`);
      setFormOpen(false);
      resetForm();
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function aksi(id, path, label) {
    setError(""); setBusy(true);
    try {
      const hasil = await api.post(path);
      setPesan(`${label} — ${hasil.no} sekarang berstatus ${hasil.status.replace(/_/g, " ")}.`);
      setDetail(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function tolak(id) {
    const alasan = window.prompt("Alasan penolakan (boleh dikosongkan):", "");
    if (alasan === null) return;
    setError(""); setBusy(true);
    try {
      await api.post(`/approval/${id}/reject`, { reason: alasan });
      setPesan("Permintaan ditolak.");
      setDetail(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  const tampil = filter ? list.filter((r) => r.status === filter) : list;

  return (
    <Page
      title="Permintaan Material"
      sub="Alur: Diajukan → Site Manager → Project Manager → Disetujui"
      action={
        can(user, "LAPANGAN", "SITE_MANAGER") && (
          <button className="btn btn-primary" onClick={() => { setFormOpen(true); setPesan(""); setError(""); }}>
            + Permintaan Baru
          </button>
        )
      }
    >
      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>
      <Alert kind="ok" onClose={() => setPesan("")}>{pesan}</Alert>

      <div className="filters">
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Saring status:</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Semua ({list.length})</option>
          <option value="DIAJUKAN">Diajukan</option>
          <option value="PENDING_PROJECT_MANAGER">Menunggu PM</option>
          <option value="DISETUJUI">Disetujui</option>
          <option value="RFQ_TERKIRIM">RFQ Terkirim</option>
          <option value="PO_TERBIT">PO Terbit</option>
          <option value="SELESAI">Selesai</option>
          <option value="DITOLAK">Ditolak</option>
        </select>
      </div>

      {tampil.length === 0 ? (
        <div className="card empty">
          {list.length === 0 ? "Belum ada permintaan material." : "Tidak ada permintaan dengan status tersebut."}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Nomor</th><th>Proyek</th><th>Pemohon</th><th>Tanggal</th>
                <th className="num">Item</th><th>Status</th><th style={{ width: 250 }}></th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{r.no}</td>
                  <td>{r.project}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{r.requested_by_name}</td>
                  <td>{tanggal(r.date)}</td>
                  <td className="num">{r.items.length}</td>
                  <td><Chip status={r.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-sm" onClick={() => setDetail(r)}>Detail</button>

                      {r.status === "DIAJUKAN" && can(user, "SITE_MANAGER") && (
                        <button className="btn btn-sm btn-ok" disabled={busy}
                          onClick={() => aksi(r.id, `/approval/${r.id}/site-manager`, "Disetujui Site Manager")}>
                          Setujui (SM)
                        </button>
                      )}

                      {r.status === "PENDING_PROJECT_MANAGER" && can(user, "PROJECT_MANAGER") && (
                        <button className="btn btn-sm btn-ok" disabled={busy}
                          onClick={() => aksi(r.id, `/approval/${r.id}/project-manager`, "Disetujui Project Manager")}>
                          Setujui (PM)
                        </button>
                      )}

                      {["DIAJUKAN", "PENDING_PROJECT_MANAGER"].includes(r.status) &&
                        can(user, "SITE_MANAGER", "PROJECT_MANAGER") && (
                          <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => tolak(r.id)}>
                            Tolak
                          </button>
                        )}

                      {r.status === "DITOLAK" && can(user, "LAPANGAN", "SITE_MANAGER") && (
                        <button className="btn btn-sm" disabled={busy}
                          onClick={() => aksi(r.id, `/approval/${r.id}/ajukan-ulang`, "Diajukan ulang")}>
                          Ajukan Ulang
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <Modal
          title="Permintaan Material Baru"
          wide
          onClose={() => setFormOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setFormOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={simpan} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </>
          }
        >
          <Alert kind="error">{error}</Alert>

          <div className="field">
            <label>Proyek / Lokasi *</label>
            <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="contoh: Proyek Gedung A" />
          </div>

          <div className="field">
            <label>Catatan (opsional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="contoh: kebutuhan tahap fondasi" />
          </div>

          <label style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>Daftar Material *</label>
          <div className="row-grid" style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
            <div>Nama material</div><div>Spesifikasi</div><div>Satuan</div><div>Jumlah</div><div>Keperluan</div><div></div>
          </div>

          {rows.map((r, i) => (
            <div className="row-grid" key={r.key}>
              <input value={r.name} placeholder="Besi Beton"
                onChange={(e) => { const n = [...rows]; n[i].name = e.target.value; setRows(n); }} />
              <input value={r.spec} placeholder="D10 SNI"
                onChange={(e) => { const n = [...rows]; n[i].spec = e.target.value; setRows(n); }} />
              <input value={r.unit} placeholder="batang"
                onChange={(e) => { const n = [...rows]; n[i].unit = e.target.value; setRows(n); }} />
              <input value={r.qty} type="number" min="0" step="any" placeholder="100"
                onChange={(e) => { const n = [...rows]; n[i].qty = e.target.value; setRows(n); }} />
              <input value={r.purpose} placeholder="Fondasi"
                onChange={(e) => { const n = [...rows]; n[i].purpose = e.target.value; setRows(n); }} />
              <button className="x" title="Hapus baris"
                onClick={() => setRows(rows.length === 1 ? [barisKosong()] : rows.filter((_, x) => x !== i))}>×</button>
            </div>
          ))}

          <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setRows([...rows, barisKosong()])}>
            + Tambah Baris
          </button>
        </Modal>
      )}

      {detail && (
        <Modal title={`Permintaan ${detail.no}`} onClose={() => setDetail(null)}>
          <div className="meta">
            <div><div className="meta-label">Proyek</div><div className="meta-value">{detail.project}</div></div>
            <div><div className="meta-label">Pemohon</div><div className="meta-value">{detail.requested_by_name}</div></div>
            <div><div className="meta-label">Tanggal</div><div className="meta-value">{tanggal(detail.date)}</div></div>
            <div><div className="meta-label">Status</div><div><Chip status={detail.status} /></div></div>
          </div>

          {detail.notes && (
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 0 }}>Catatan: {detail.notes}</p>
          )}

          <div className="card" style={{ marginBottom: 14 }}>
            <table>
              <thead>
                <tr><th>Material</th><th>Spesifikasi</th><th className="num">Jumlah</th><th>Keperluan</th></tr>
              </thead>
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td style={{ color: "var(--ink-soft)" }}>{i.spec || "-"}</td>
                    <td className="num">{angka(i.qty)} {i.unit}</td>
                    <td style={{ color: "var(--ink-soft)" }}>{i.purpose || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
            <div>Site Manager: {detail.approved_sm_name ? `${detail.approved_sm_name} — ${tanggal(detail.approved_sm_at)}` : "belum"}</div>
            <div>Project Manager: {detail.approved_pm_name ? `${detail.approved_pm_name} — ${tanggal(detail.approved_pm_at)}` : "belum"}</div>
            {detail.rejected_reason && (
              <div style={{ color: "var(--danger)", marginTop: 6 }}>Alasan ditolak: {detail.rejected_reason}</div>
            )}
          </div>
        </Modal>
      )}
    </Page>
  );
}
