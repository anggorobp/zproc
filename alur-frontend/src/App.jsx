import React, { useCallback, useEffect, useState } from "react";
import { api, ROLE_LABEL, can } from "./lib.js";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Permintaan from "./pages/Permintaan.jsx";
import Rfq from "./pages/Rfq.jsx";
import Evaluasi from "./pages/Evaluasi.jsx";
import Penerimaan from "./pages/Penerimaan.jsx";
import Pengeluaran from "./pages/Pengeluaran.jsx";
import Stok from "./pages/Stok.jsx";
import Laporan from "./pages/Laporan.jsx";
import Vendors from "./pages/Vendors.jsx";
import Penawaran from "./pages/Penawaran.jsx";

const NAV = [
  { id: "dashboard",   label: "Ringkasan",        roles: null },
  { id: "permintaan",  label: "Permintaan",       roles: null },
  { id: "rfq",         label: "RFQ & Vendor",     roles: ["PURCHASING"] },
  { id: "evaluasi",    label: "Evaluasi & PO",    roles: ["PURCHASING"] },
  { id: "penerimaan",  label: "Penerimaan",       roles: ["LOGISTIK"] },
  { id: "pengeluaran", label: "Pengeluaran",      roles: ["LOGISTIK"] },
  { id: "stok",        label: "Stok",             roles: null },
  { id: "laporan",     label: "Laporan",          roles: null },
  { id: "vendor",      label: "Vendor",           roles: ["PURCHASING"] },
];

function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Token survives a page refresh in localStorage; the user object does not.
  // /auth/me restores it, and this also catches a token that no longer matches
  // the database (e.g. after re-seeding) instead of silently 401-ing later.
  useEffect(() => {
    const token = localStorage.getItem("alur_token");
    if (!token) { setReady(true); return; }
    api.get("/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => localStorage.removeItem("alur_token"))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password }, false);
    localStorage.setItem("alur_token", res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("alur_token");
    setUser(null);
  }, []);

  return { user, login, logout, ready };
}

export default function App() {
  // The vendor quote link (/penawaran/:token) must work with no login at all.
  const path = window.location.pathname;
  const publicMatch = path.match(/^\/penawaran\/([a-f0-9]+)$/i);
  if (publicMatch) return <Penawaran token={publicMatch[1]} />;

  const { user, login, logout, ready } = useAuth();
  const [tab, setTab] = useState("dashboard");

  if (!ready) {
    return <div className="login-wrap"><div style={{ color: "var(--ink-soft)" }}>Memuat…</div></div>;
  }
  if (!user) {
    return <Login onLogin={login} />;
  }

  const items = NAV.filter((n) => !n.roles || can(user, ...n.roles));
  if (!items.find((n) => n.id === tab)) setTimeout(() => setTab("dashboard"), 0);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <div className="brand-name">ALUR</div>
            <div className="brand-sub">Pengadaan Material</div>
          </div>
        </div>

        <nav className="nav">
          {items.map((n) => (
            <button key={n.id} className={tab === n.id ? "active" : ""} onClick={() => setTab(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="who">
          <div className="who-name">{user.name}</div>
          <div className="who-role">{ROLE_LABEL[user.role] || user.role}</div>
          <button onClick={logout}>Keluar</button>
        </div>
      </aside>

      <main className="main">
        {tab === "dashboard" && <Dashboard user={user} go={setTab} />}
        {tab === "permintaan" && <Permintaan user={user} />}
        {tab === "rfq" && <Rfq />}
        {tab === "evaluasi" && <Evaluasi />}
        {tab === "penerimaan" && <Penerimaan />}
        {tab === "pengeluaran" && <Pengeluaran />}
        {tab === "stok" && <Stok />}
        {tab === "laporan" && <Laporan />}
        {tab === "vendor" && <Vendors />}
      </main>
    </div>
  );
}
