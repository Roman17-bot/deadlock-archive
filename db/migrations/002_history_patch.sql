ALTER TABLE history_entries
  ADD COLUMN patch jsonb CHECK (patch IS NULL OR jsonb_typeof(patch) = 'object');
