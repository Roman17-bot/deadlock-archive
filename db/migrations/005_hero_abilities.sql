-- Optional catalogue: absence means a legacy version has not been enriched.
CREATE TABLE ability_catalogues (
  snapshot_id bigint PRIMARY KEY REFERENCES archive_snapshots(id) ON DELETE CASCADE,
  meta jsonb NOT NULL CHECK (jsonb_typeof(meta) = 'object')
);
CREATE TABLE hero_abilities (
  snapshot_id bigint NOT NULL REFERENCES ability_catalogues(snapshot_id) ON DELETE CASCADE,
  hero_ordinal integer NOT NULL CHECK (hero_ordinal >= 0),
  hero_id bigint NOT NULL,
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 4),
  ability_id bigint NOT NULL CHECK (ability_id > 0),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  PRIMARY KEY (snapshot_id, hero_id, slot),
  UNIQUE (snapshot_id, ability_id),
  UNIQUE (snapshot_id, hero_ordinal, slot)
);
-- Backfill every saved version, without moving the current pointer or importing files.
DO $$
BEGIN
  IF to_regclass('archive_bundle_payloads') IS NOT NULL THEN
    INSERT INTO ability_catalogues(snapshot_id, meta)
      SELECT snapshot_id, data #> '{abilities,meta}' FROM archive_bundle_payloads
      WHERE jsonb_typeof(data #> '{abilities,meta}') = 'object';
    INSERT INTO hero_abilities(snapshot_id, hero_ordinal, hero_id, slot, ability_id, data)
      SELECT p.snapshot_id, h.ordinality::integer - 1, (h.value->>'heroId')::bigint,
        (a.value->>'slot')::integer, (a.value->>'id')::bigint, a.value
      FROM archive_bundle_payloads p
      JOIN ability_catalogues c ON c.snapshot_id=p.snapshot_id,
      LATERAL jsonb_array_elements(p.data #> '{abilities,heroes}') WITH ORDINALITY h(value, ordinality),
      LATERAL jsonb_array_elements(h.value->'abilities') a(value);
  END IF;
END
$$;
