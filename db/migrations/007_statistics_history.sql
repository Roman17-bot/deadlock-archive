-- Compact daily observations are exported as individually bounded cohort files.
ALTER TABLE reference_catalogues DROP CONSTRAINT reference_catalogues_kind_check;
ALTER TABLE reference_catalogues ADD CONSTRAINT reference_catalogues_kind_check
    CHECK (kind IN ('heroProfiles','heroStatistics','heroHistory','worldMap'));
