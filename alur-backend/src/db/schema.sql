-- ALUR - Skema Database Sistem Pengadaan Material
-- Dijalankan otomatis oleh: npm run setup

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Pengguna
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN
                  ('ADMIN','LAPANGAN','SITE_MANAGER','PROJECT_MANAGER','PURCHASING','LOGISTIK')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Vendor
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,
  category   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Permintaan Material
-- Alur status:
--   DIAJUKAN -> PENDING_PROJECT_MANAGER -> DISETUJUI
--            -> RFQ_TERKIRIM -> PO_TERBIT -> SELESAI
--   (bisa ke DITOLAK dari dua tahap approval pertama)
-- ============================================================
CREATE TABLE IF NOT EXISTS material_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no                TEXT NOT NULL UNIQUE,
  project           TEXT NOT NULL,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'DIAJUKAN' CHECK (status IN
                      ('DIAJUKAN','PENDING_PROJECT_MANAGER','DISETUJUI',
                       'RFQ_TERKIRIM','PO_TERBIT','SELESAI','DITOLAK')),
  requested_by_id   UUID NOT NULL REFERENCES users(id),
  approved_sm_id    UUID REFERENCES users(id),
  approved_sm_at    TIMESTAMPTZ,
  approved_pm_id    UUID REFERENCES users(id),
  approved_pm_at    TIMESTAMPTZ,
  rejected_reason   TEXT,
  date              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  spec       TEXT,
  unit       TEXT NOT NULL,
  qty        NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  purpose    TEXT
);

-- ============================================================
-- RFQ ke vendor (token unik per vendor, vendor tidak perlu login)
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_blasts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  vendor_id  UUID NOT NULL REFERENCES vendors(id),
  token      TEXT NOT NULL UNIQUE,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blast_id     UUID NOT NULL UNIQUE REFERENCES vendor_blasts(id) ON DELETE CASCADE,
  request_id   UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  vendor_id    UUID NOT NULL REFERENCES vendors(id),
  note         TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
  unit_price      NUMERIC(16,2) NOT NULL CHECK (unit_price >= 0)
);

-- ============================================================
-- Purchase Order (satu PO per vendor pemenang)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no         TEXT NOT NULL UNIQUE,
  request_id UUID NOT NULL REFERENCES material_requests(id),
  vendor_id  UUID NOT NULL REFERENCES vendors(id),
  status     TEXT NOT NULL DEFAULT 'TERBIT' CHECK (status IN
               ('TERBIT','DITERIMA_SEBAGIAN','DITERIMA')),
  date       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS po_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  request_item_id UUID NOT NULL REFERENCES request_items(id),
  qty             NUMERIC(14,2) NOT NULL CHECK (qty > 0),
  unit_price      NUMERIC(16,2) NOT NULL CHECK (unit_price >= 0)
);

-- ============================================================
-- Penerimaan barang (boleh parsial)
-- ============================================================
CREATE TABLE IF NOT EXISTS goods_receives (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no             TEXT NOT NULL UNIQUE,
  po_id          UUID NOT NULL REFERENCES purchase_orders(id),
  received_by_id UUID NOT NULL REFERENCES users(id),
  note           TEXT,
  date           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gr_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id      UUID NOT NULL REFERENCES goods_receives(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES po_items(id),
  qty        NUMERIC(14,2) NOT NULL CHECK (qty > 0)
);

-- ============================================================
-- Pengeluaran barang
-- ============================================================
CREATE TABLE IF NOT EXISTS goods_issues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no           TEXT NOT NULL UNIQUE,
  project      TEXT NOT NULL,
  issued_by_id UUID NOT NULL REFERENCES users(id),
  note         TEXT,
  date         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gi_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gi_id           UUID NOT NULL REFERENCES goods_issues(id) ON DELETE CASCADE,
  request_item_id UUID NOT NULL REFERENCES request_items(id),
  qty             NUMERIC(14,2) NOT NULL CHECK (qty > 0)
);

-- ============================================================
-- Index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_request_items_request  ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_requests_status        ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_blasts_request         ON vendor_blasts(request_id);
CREATE INDEX IF NOT EXISTS idx_quotes_request         ON quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote      ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po            ON po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_gr_items_gr            ON gr_items(gr_id);
CREATE INDEX IF NOT EXISTS idx_gi_items_gi            ON gi_items(gi_id);
