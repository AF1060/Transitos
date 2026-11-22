-- Esquema inicial para a Trânsitos Solares e Lunares, versão Netlify.
-- App de um só utilizador (sem login) — por isso não há colunas "owner"/user_id
-- como havia no Zite. "observer_settings" tem sempre, no máximo, UMA linha (id = 1).

CREATE TABLE IF NOT EXISTS observer_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- força uma única linha
  use_gps BOOLEAN NOT NULL DEFAULT true,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  default_target TEXT NOT NULL DEFAULT 'Sol',
  margin_degrees DOUBLE PRECISION NOT NULL DEFAULT 2,
  max_travel_km DOUBLE PRECISION NOT NULL DEFAULT 30,
  min_elevation_degrees DOUBLE PRECISION NOT NULL DEFAULT 10,
  focal_length_mm DOUBLE PRECISION NOT NULL DEFAULT 600,
  sensor TEXT NOT NULL DEFAULT 'Micro 4/3',
  iss_alert_minutes DOUBLE PRECISION NOT NULL DEFAULT 15,
  aircraft_alert_seconds DOUBLE PRECISION NOT NULL DEFAULT 60,
  voice_alerts BOOLEAN NOT NULL DEFAULT true,
  aircraft_offset_percent DOUBLE PRECISION NOT NULL DEFAULT 80,
  iss_offset_percent DOUBLE PRECISION NOT NULL DEFAULT 67,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planned_passes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  object TEXT NOT NULL,              -- 'ISS' | 'Avião'
  target TEXT NOT NULL,              -- 'Sol' | 'Lua'
  disc_entry_time TIMESTAMPTZ NOT NULL,
  seconds_in_disc DOUBLE PRECISION NOT NULL,
  site_latitude DOUBLE PRECISION NOT NULL,
  site_longitude DOUBLE PRECISION NOT NULL,
  quality TEXT NOT NULL,
  alarm_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passes_entry_time ON planned_passes (disc_entry_time);

CREATE TABLE IF NOT EXISTS aircraft_sightings (
  id BIGSERIAL PRIMARY KEY,
  callsign TEXT NOT NULL,
  icao24 TEXT NOT NULL,
  airline TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL,
  weekday SMALLINT NOT NULL,
  minute_of_day INTEGER NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude_m DOUBLE PRECISION NOT NULL,
  track DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sightings_seen_at ON aircraft_sightings (seen_at);
CREATE INDEX IF NOT EXISTS idx_sightings_minute_weekday ON aircraft_sightings (minute_of_day, weekday);

-- Orçamento partilhado da adsb.lol (ver netlify/functions/_aircraftSources.ts).
-- Mantido tal como no Zite: a infraestrutura de funções da Netlify também corre sobre IPs
-- partilhados (é hospedagem serverless multi-tenant), por isso o mesmo risco de bloqueio
-- por IP da adsb.lol/adsb.fi pode continuar a existir aqui — ver nota no README.
CREATE TABLE IF NOT EXISTS api_budget (
  key TEXT NOT NULL,
  day TEXT NOT NULL,
  used DOUBLE PRECISION NOT NULL DEFAULT 0,
  remaining DOUBLE PRECISION,
  reset_at TEXT,
  PRIMARY KEY (key, day)
);
