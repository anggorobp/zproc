import React, { useState } from "react";
import { Alert } from "../ui.jsx";

const AKUN = [
  ["Tim Lapangan",    "lapangan@perusahaan.co.id",    "lapangan123"],
  ["Site Manager",    "sitemanager@perusahaan.co.id", "sitemanager123"],
  ["Project Manager", "pm@perusahaan.co.id",          "pm123456"],
  ["Purchasing",      "purchasing@perusahaan.co.id",  "purchasing123"],
  ["Logistik",        "logistik@perusahaan.co.id",    "logistik123"],
  ["Administrator",   "admin@perusahaan.co.id",       "admin123"],
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-head">
          <div className="login-mark">A</div>
          <h1 style={{ margin: "0 0 2px", fontSize: 26 }}>ALUR</h1>
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>Sistem Pengadaan Material</p>
        </div>

        <form onSubmit={submit} className="card card-pad">
          <Alert kind="error" onClose={() => setError("")}>{error}</Alert>

          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <div className="login-accounts card card-pad" style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Akun bawaan — klik untuk mengisi otomatis</div>
          <table>
            <tbody>
              {AKUN.map(([label, mail, pass]) => (
                <tr key={mail}>
                  <td style={{ width: 118 }}>{label}</td>
                  <td>
                    <span className="pick" onClick={() => { setEmail(mail); setPassword(pass); setError(""); }}>
                      {mail}
                    </span>
                  </td>
                  <td style={{ color: "var(--ink-soft)" }}>{pass}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
