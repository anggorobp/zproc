import React, { useState } from "react";
import { api } from "../lib.js";
import { Page, Alert, Modal, Loading, useLoader } from "../ui.jsx";

const kosong = { name: "", email: "", phone: "", address: "", category: "" };

export default function Vendors() {
  const { data: vendors, loading, error, reload, setError } = useLoader(() => api.get("/vendors"), []);
  const [form, setForm] = useState(null); // null = closed, object = editing/creating
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");

  if (loading) return <Loading />;

  async function simpan() {
    if (!form.name.trim()) return setError("Nama vendor wajib diisi.");
    if (!form.email.trim()) return setError("Email vendor wajib diisi.");
    setBusy(true); setError("");
    try {
      if (form.id) await api.put(`/vendors/${form.id}`, form);
      else await api.post("/vendors", form);
      setPesan(form.id ? "Vendor diperbarui." : "Vendor ditambahkan.");
      setForm(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function hapus(v) {
    if (!window.confirm(`Hapus vendor "${v.name}"?`)) return;
    setBusy(true); setError("");
    try {
      await api.del(`/vendors/${v.id}`);
      setPesan("Vendor dihapus.");
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Vendor" sub="Daftar vendor yang bisa menerima RFQ."
      action={<button className="btn btn-primary" onClick={() => { setForm({ ...kosong }); setError(""); }}>+ Tambah Vendor</button>}>
      <Alert kind="error" onClose={() => setError("")}>{error}</Alert>
      <Alert kind="ok" onClose={() => setPesan("")}>{pesan}</Alert>

      {vendors.length === 0 ? (
        <div className="card empty">Belum ada vendor terdaftar.</div>
      ) : (
        <div className="card">
          <table>
            <thead><tr><th>Nama</th><th>Kategori</th><th>Email</th><th>Telepon</th><th style={{ width: 130 }}></th></tr></thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td><b>{v.name}</b></td>
                  <td style={{ color: "var(--ink-soft)" }}>{v.category || "-"}</td>
                  <td>{v.email}</td>
                  <td>{v.phone || "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => { setForm(v); setError(""); }}>Ubah</button>
                      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => hapus(v)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal
          title={form.id ? "Ubah Vendor" : "Tambah Vendor"}
          onClose={() => setForm(null)}
          footer={<>
            <button className="btn" onClick={() => setForm(null)}>Batal</button>
            <button className="btn btn-primary" onClick={simpan} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
          </>}
        >
          <Alert kind="error">{error}</Alert>
          <div className="field"><label>Nama Vendor *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label>Telepon</label>
            <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>Alamat</label>
            <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="field"><label>Kategori</label>
            <input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="contoh: Besi & Baja" /></div>
        </Modal>
      )}
    </Page>
  );
}
