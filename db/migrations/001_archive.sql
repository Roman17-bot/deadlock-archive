CREATE TABLE archive_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_hash text NOT NULL UNIQUE CHECK (length(content_hash) = 64),
  client_version integer NOT NULL CHECK (client_version > 0),
  hero_meta jsonb NOT NULL,
  provenance jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_reason text
);

CREATE TABLE archive_current (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  snapshot_id bigint NOT NULL REFERENCES archive_snapshots(id)
);

CREATE TABLE archive_import_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_id bigint NOT NULL REFERENCES archive_snapshots(id),
  outcome text NOT NULL CHECK (outcome IN ('imported', 'unchanged', 'repointed')),
  reason text,
  finished_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE heroes (
  snapshot_id bigint NOT NULL REFERENCES archive_snapshots(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  hero_id integer NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  aliases text NOT NULL,
  tags jsonb NOT NULL,
  is_new boolean NOT NULL,
  portrait text NOT NULL,
  base_health double precision NOT NULL,
  base_spirit double precision NOT NULL,
  base_regen double precision NOT NULL,
  base_bullet_damage double precision NOT NULL,
  base_move_speed double precision NOT NULL,
  base_stamina double precision NOT NULL,
  growth_health double precision NOT NULL,
  growth_spirit double precision NOT NULL,
  growth_regen double precision NOT NULL,
  growth_bullet_damage double precision NOT NULL,
  scaling_bullet_damage_per_spirit double precision NOT NULL,
  scaling_regen_per_spirit double precision NOT NULL,
  scaling_fire_rate_percent_per_spirit double precision NOT NULL,
  weapon_class_name text NOT NULL,
  weapon_projectiles integer NOT NULL,
  weapon_burst integer NOT NULL,
  weapon_cycle_time double precision NOT NULL,
  weapon_intra_burst_time double precision NOT NULL,
  weapon_shots_per_second double precision NOT NULL,
  weapon_spins_up boolean NOT NULL,
  weapon_full_spin_cycle double precision,
  weapon_hit_once boolean NOT NULL,
  weapon_clip_size double precision NOT NULL,
  weapon_reload_seconds double precision NOT NULL,
  weapon_notes jsonb NOT NULL,
  source_hero_url text NOT NULL,
  source_weapon_url text NOT NULL,
  source_hero_line integer NOT NULL,
  source_weapon_line integer NOT NULL,
  PRIMARY KEY (snapshot_id, hero_id),
  UNIQUE (snapshot_id, ordinal),
  UNIQUE (snapshot_id, slug)
);
CREATE INDEX heroes_name_search ON heroes (snapshot_id, lower(name));

CREATE TABLE mechanics_catalogues (
  snapshot_id bigint NOT NULL REFERENCES archive_snapshots(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('ru', 'en')),
  meta jsonb NOT NULL,
  PRIMARY KEY (snapshot_id, language)
);

CREATE TABLE mechanics_sources (
  snapshot_id bigint NOT NULL,
  language text NOT NULL,
  ordinal integer NOT NULL,
  source_id text NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('raw', 'community', 'official')),
  PRIMARY KEY (snapshot_id, language, source_id),
  UNIQUE (snapshot_id, language, ordinal),
  FOREIGN KEY (snapshot_id, language) REFERENCES mechanics_catalogues(snapshot_id, language) ON DELETE CASCADE
);

CREATE TABLE mechanics_formulas (
  snapshot_id bigint NOT NULL,
  language text NOT NULL,
  ordinal integer NOT NULL,
  formula_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  expression text NOT NULL,
  variables jsonb NOT NULL,
  explanation jsonb NOT NULL,
  example text NOT NULL,
  caveats jsonb NOT NULL,
  confidence text NOT NULL,
  PRIMARY KEY (snapshot_id, language, formula_id),
  UNIQUE (snapshot_id, language, ordinal),
  FOREIGN KEY (snapshot_id, language) REFERENCES mechanics_catalogues(snapshot_id, language) ON DELETE CASCADE
);

CREATE TABLE mechanics_formula_sources (
  snapshot_id bigint NOT NULL,
  language text NOT NULL,
  formula_id text NOT NULL,
  ordinal integer NOT NULL,
  source_id text NOT NULL,
  PRIMARY KEY (snapshot_id, language, formula_id, source_id),
  UNIQUE (snapshot_id, language, formula_id, ordinal),
  FOREIGN KEY (snapshot_id, language, formula_id) REFERENCES mechanics_formulas(snapshot_id, language, formula_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, language, source_id) REFERENCES mechanics_sources(snapshot_id, language, source_id)
);

CREATE TABLE history_entries (
  snapshot_id bigint NOT NULL REFERENCES archive_snapshots(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  client_version integer NOT NULL,
  build_date text NOT NULL,
  first_published_at text NOT NULL,
  provenance_kind text NOT NULL CHECK (provenance_kind IN ('repository-commit', 'snapshot-save')),
  provenance_reference text NOT NULL,
  PRIMARY KEY (snapshot_id, client_version),
  UNIQUE (snapshot_id, ordinal)
);
