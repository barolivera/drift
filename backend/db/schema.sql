-- Drift database schema
-- Surf trips in Brazil for crypto nomads

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- enums ----------
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'settled', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('usdc', 'pix_p2pkit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE surf_level AS ENUM ('beginner', 'intermediate', 'advanced', 'all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- users ----------
-- One row per Privy identity. privy_did is the stable id (did:privy:...)
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_did       TEXT NOT NULL UNIQUE,
  email           TEXT UNIQUE,
  wallet_address  TEXT UNIQUE,
  display_name    TEXT,
  avatar_url      TEXT,
  surf_level      surf_level NOT NULL DEFAULT 'beginner',
  is_host         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- spots ----------
CREATE TABLE IF NOT EXISTS spots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  state       TEXT NOT NULL,            -- e.g. 'SC', 'BA', 'CE'
  city        TEXT NOT NULL,
  description TEXT,
  latitude    NUMERIC(9,6),
  longitude   NUMERIC(9,6),
  best_season TEXT,                     -- free text: 'Apr–Oct'
  level       surf_level NOT NULL DEFAULT 'all',
  capacity    INTEGER CHECK (capacity > 0),      -- beds at the house
  daily_rate_usdc NUMERIC(12,2) CHECK (daily_rate_usdc >= 0),
  cover_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE spots ADD COLUMN IF NOT EXISTS capacity INTEGER CHECK (capacity > 0);
ALTER TABLE spots ADD COLUMN IF NOT EXISTS daily_rate_usdc NUMERIC(12,2) CHECK (daily_rate_usdc >= 0);

-- ---------- trips ----------
CREATE TABLE IF NOT EXISTS trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  spot_id         UUID NOT NULL REFERENCES spots(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  description     TEXT,
  starts_on       DATE NOT NULL,
  ends_on         DATE NOT NULL,
  capacity        INTEGER NOT NULL CHECK (capacity > 0),
  price_usdc      NUMERIC(12,2) NOT NULL CHECK (price_usdc >= 0),
  includes        TEXT[] NOT NULL DEFAULT '{}',   -- 'board', 'lodging', 'coaching', 'coworking'
  level           surf_level NOT NULL DEFAULT 'all',
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  slug             TEXT UNIQUE,
  location         TEXT,
  description_long TEXT,
  included         JSONB NOT NULL DEFAULT '[]'::jsonb,
  not_included     JSONB NOT NULL DEFAULT '[]'::jsonb,
  who_its_for      TEXT,
  daily_schedule   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trips_dates_chk CHECK (ends_on >= starts_on)
);

-- Editorial content (added for the 2027 editions). `capacity` doubles as spots_total.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS slug             TEXT UNIQUE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS location         TEXT;          -- 'Itamambuca, Ubatuba, Brazil'
ALTER TABLE trips ADD COLUMN IF NOT EXISTS description_long TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS included         JSONB NOT NULL DEFAULT '[]'::jsonb;  -- string[]
ALTER TABLE trips ADD COLUMN IF NOT EXISTS not_included     JSONB NOT NULL DEFAULT '[]'::jsonb;  -- string[]
ALTER TABLE trips ADD COLUMN IF NOT EXISTS who_its_for      TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS daily_schedule   JSONB NOT NULL DEFAULT '[]'::jsonb;  -- {time,title,detail,highlight?}[]

CREATE INDEX IF NOT EXISTS trips_spot_idx    ON trips(spot_id);
CREATE INDEX IF NOT EXISTS trips_host_idx    ON trips(host_id);
CREATE INDEX IF NOT EXISTS trips_starts_idx  ON trips(starts_on) WHERE is_published;

-- ---------- bookings ----------
CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seats       INTEGER NOT NULL DEFAULT 1 CHECK (seats > 0),
  status      booking_status NOT NULL DEFAULT 'pending',
  notes       TEXT,
  -- Registration form (filled before checkout; does not affect the status machine)
  full_name        TEXT,
  email            TEXT,
  telegram         TEXT,          -- stored without the leading '@'
  country          TEXT,
  surf_level       TEXT,          -- 'never' | 'beginner' | 'intermediate' | 'advanced'
  working_on       TEXT,
  dietary          TEXT,
  agreed_terms_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS full_name       TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram        TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS country         TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS surf_level      TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS working_on      TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dietary         TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agreed_terms_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_trip_idx ON bookings(trip_id);

-- ---------- payments ----------
-- One booking may have several payment attempts. p2pkit_order_id links to the
-- on/off-ramp order; tx_hash is the on-chain settlement (USDC).
CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  method            payment_method NOT NULL,
  status            payment_status NOT NULL DEFAULT 'pending',
  amount_usdc       NUMERIC(12,2) NOT NULL CHECK (amount_usdc >= 0),
  amount_brl        NUMERIC(12,2),            -- only for PIX flows
  fx_rate           NUMERIC(12,6),            -- BRL per USDC at quote time
  chain             TEXT,                     -- 'base', 'polygon', ...
  tx_hash           TEXT UNIQUE,
  p2pkit_order_id   TEXT UNIQUE,
  p2pkit_payload    JSONB,                    -- raw provider response / webhook
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON payments(status);

-- ---------- reviews ----------
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'trips', 'bookings', 'payments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ---------- views ----------
CREATE OR REPLACE VIEW trip_availability AS
SELECT
  t.id AS trip_id,
  t.capacity,
  COALESCE(SUM(b.seats) FILTER (WHERE b.status IN ('pending', 'confirmed')), 0)::INT AS seats_taken,
  t.capacity - COALESCE(SUM(b.seats) FILTER (WHERE b.status IN ('pending', 'confirmed')), 0)::INT AS seats_left
FROM trips t
LEFT JOIN bookings b ON b.trip_id = t.id
GROUP BY t.id;
