ALTER TABLE archive_snapshots ADD COLUMN calculator_rules jsonb
  CHECK (calculator_rules IS NULL OR jsonb_typeof(calculator_rules) = 'object');
ALTER TABLE heroes ADD COLUMN calculation jsonb
  CHECK (calculation IS NULL OR jsonb_typeof(calculation) = 'object');

-- Preserve metadata already saved before these normalized columns existed.
-- The supplemental payload table is optional in older archives and fresh schemas.
DO $$
BEGIN
  IF to_regclass('archive_bundle_payloads') IS NOT NULL THEN
    UPDATE archive_snapshots AS s
    SET calculator_rules = p.data #> '{heroes,calculatorRules}'
    FROM archive_bundle_payloads AS p
    WHERE p.snapshot_id = s.id
      AND jsonb_typeof(p.data #> '{heroes,calculatorRules}') = 'object';

    UPDATE heroes AS h
    SET calculation = source.hero -> 'calculation'
    FROM archive_bundle_payloads AS p,
      LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(p.data #> '{heroes,heroes}') = 'array'
          THEN p.data #> '{heroes,heroes}' ELSE '[]'::jsonb END
      ) AS source(hero)
    WHERE p.snapshot_id = h.snapshot_id
      AND source.hero ->> 'id' = h.hero_id::text
      AND jsonb_typeof(source.hero -> 'calculation') = 'object';
  END IF;
END
$$;
