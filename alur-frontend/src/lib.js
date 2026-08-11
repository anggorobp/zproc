export const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

// Every response goes through here so a failure always becomes a readable
// Indonesian sentence instead of "[object Object]" or a raw stack trace.
async function unwrap(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    if (res.status === 401) {
      const err = new Error(body?.error || "Sesi berakhir. Silakan login ulang.");
      err.unauthorized = true;
      throw err;
    }
    throw new Error(body?.error || `Gagal (kode ${res.status}).`);
  }
  return body;
}

function headers(auth = true) {
  const h = { "Content-Type": "application/json" };
  const token = localStorage.getItem("alur_token");
  if (auth && token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request(method, path, body, auth = true) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: headers(auth),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Tidak bisa menghubungi server. Pastikan backend sudah jalan di " + API.replace("/api", "") + ".");
  }
  return unwrap(res);
}

export const api = {
  get: (p, auth = true) => request("GET", p, undefined, auth),
  post: (p, body, auth = true) => request("POST", p, body ?? {}, auth),
  put: (p, body) => request("PUT", p, body),
  del: (p) => request("DELETE", p, undefined),
};

export const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n) || 0);

export const angka = (n) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(n) || 0);

export const tanggal = (iso) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export const STATUS = {
  DIAJUKAN:                { label: "Diajukan",        color: "#55637f" },
  PENDING_PROJECT_MANAGER: { label: "Menunggu PM",     color: "#b8860b" },
  DISETUJUI:               { label: "Disetujui",       color: "#2f6b4f" },
  RFQ_TERKIRIM:            { label: "RFQ Terkirim",    color: "#d4552a" },
  PO_TERBIT:               { label: "PO Terbit",       color: "#d4552a" },
  SELESAI:                 { label: "Selesai",         color: "#2f6b4f" },
  DITOLAK:                 { label: "Ditolak",         color: "#b23a2f" },
  TERBIT:                  { label: "Terbit",          color: "#d4552a" },
  DITERIMA_SEBAGIAN:       { label: "Diterima Sebagian", color: "#b8860b" },
  DITERIMA:                { label: "Diterima",        color: "#2f6b4f" },
};

export const ROLE_LABEL = {
  ADMIN: "Administrator",
  LAPANGAN: "Tim Lapangan",
  SITE_MANAGER: "Site Manager",
  PROJECT_MANAGER: "Project Manager",
  PURCHASING: "Purchasing",
  LOGISTIK: "Logistik",
};

// ADMIN passes every check, mirroring the backend, so one account can walk the whole flow.
export const can = (user, ...roles) => Boolean(user) && (user.role === "ADMIN" || roles.includes(user.role));
