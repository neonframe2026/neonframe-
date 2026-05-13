-- ╔══════════════════════════════════════════════════════════════╗
-- ║  NeonFrame – Supabase Setup                                  ║
-- ║  Kopiere alles hier in den Supabase SQL-Editor und klicke   ║
-- ║  auf "Run"                                                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1. Tabelle erstellen
CREATE TABLE IF NOT EXISTS offers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  offer_num       TEXT,
  offer_date      TEXT,
  project         TEXT,

  width           TEXT,
  height          TEXT,
  backplate       TEXT,
  usage           TEXT,
  colors          TEXT,

  base_price      NUMERIC(10,2) DEFAULT 0,
  disc_type       TEXT DEFAULT 'pct',
  disc_val        NUMERIC(10,2) DEFAULT 20,
  vat_pct         NUMERIC(5,2)  DEFAULT 19,
  net_price       NUMERIC(10,2) DEFAULT 0,
  final_price     NUMERIC(10,2) DEFAULT 0,
  rrp_price       NUMERIC(10,2) DEFAULT 0,

  delivery        TEXT,
  note            TEXT,
  valid_until     TEXT,
  checkout_url    TEXT,
  preview_image   TEXT,

  published       BOOLEAN DEFAULT FALSE
);

-- 2. Row Level Security (öffentlich lesen, anon schreiben – da kein Auth)
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published offers"
  ON offers FOR SELECT
  USING (published = true);

CREATE POLICY "Anon insert"
  ON offers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon update"
  ON offers FOR UPDATE
  USING (true);

-- 3. Storage Bucket für Bilder
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-images', 'offer-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public read offer images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'offer-images');

CREATE POLICY "Anon upload offer images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'offer-images');
