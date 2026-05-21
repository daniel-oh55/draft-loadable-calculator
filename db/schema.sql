-- Draft Loadable Calculator / Neon PostgreSQL Schema
-- Run this file first in Neon SQL Editor.

CREATE TABLE IF NOT EXISTS vessels (
  vessel_code TEXT PRIMARY KEY,
  vessel_name TEXT NOT NULL,
  design_capa TEXT NOT NULL,
  builder_model TEXT NOT NULL,
  design_teu INTEGER,
  homo14 INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS series_master (
  design_capa TEXT NOT NULL,
  builder_model TEXT NOT NULL,
  representative_vessel_code TEXT,
  default_ballast NUMERIC(12,3) NOT NULL DEFAULT 0,
  default_fresh_water NUMERIC(12,3) NOT NULL DEFAULT 0,
  default_fo NUMERIC(12,3) NOT NULL DEFAULT 0,
  default_mgo NUMERIC(12,3) NOT NULL DEFAULT 0,
  default_lube_oil NUMERIC(12,3) NOT NULL DEFAULT 0,
  default_constant NUMERIC(12,3) NOT NULL DEFAULT 0,
  default_other_weight NUMERIC(12,3) NOT NULL DEFAULT 0,
  data_status TEXT NOT NULL DEFAULT 'ACTIVE',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (design_capa, builder_model)
);

CREATE TABLE IF NOT EXISTS scenarios (
  scenario_code TEXT PRIMARY KEY,
  scenario_name TEXT NOT NULL,
  port_code TEXT,
  water_density NUMERIC(5,3) NOT NULL,
  default_draft NUMERIC(6,3),
  is_fixed_draft BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  data_note TEXT,
  data_pending_message TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scenario_series (
  scenario_code TEXT NOT NULL REFERENCES scenarios(scenario_code) ON DELETE CASCADE,
  design_capa TEXT NOT NULL,
  builder_model TEXT NOT NULL,
  default_draft NUMERIC(6,3),
  PRIMARY KEY (scenario_code, design_capa, builder_model),
  FOREIGN KEY (design_capa, builder_model) REFERENCES series_master(design_capa, builder_model) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_scenario_dwt (
  id BIGSERIAL PRIMARY KEY,
  design_capa TEXT NOT NULL,
  builder_model TEXT NOT NULL,
  scenario_code TEXT NOT NULL REFERENCES scenarios(scenario_code) ON DELETE CASCADE,
  draft_m NUMERIC(6,3) NOT NULL,
  dwt_mt NUMERIC(12,3) NOT NULL,
  displacement_mt NUMERIC(12,3),
  water_density NUMERIC(5,3),
  data_source TEXT,
  confidence_level TEXT NOT NULL DEFAULT 'PRELIMINARY',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (design_capa, builder_model, scenario_code, draft_m),
  FOREIGN KEY (design_capa, builder_model) REFERENCES series_master(design_capa, builder_model) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS draft_caps (
  id BIGSERIAL PRIMARY KEY,
  design_capa TEXT NOT NULL,
  builder_model TEXT NOT NULL,
  scenario_code TEXT NOT NULL REFERENCES scenarios(scenario_code) ON DELETE CASCADE,
  max_draft_m NUMERIC(6,3) NOT NULL,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (design_capa, builder_model, scenario_code),
  FOREIGN KEY (design_capa, builder_model) REFERENCES series_master(design_capa, builder_model) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vessels_series ON vessels(design_capa, builder_model);
CREATE INDEX IF NOT EXISTS idx_dwt_series_scenario ON series_scenario_dwt(design_capa, builder_model, scenario_code, draft_m);
