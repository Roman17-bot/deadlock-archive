-- Optional versioned public reference catalogues. Row data is authoritative without bundle payloads.
CREATE TABLE reference_catalogues (
    snapshot_id bigint NOT NULL REFERENCES archive_snapshots(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('heroProfiles','heroStatistics','worldMap')),
    header jsonb NOT NULL CHECK (jsonb_typeof(header) = 'object'),
    PRIMARY KEY (snapshot_id, kind)
);
CREATE TABLE reference_catalogue_rows (
    snapshot_id bigint NOT NULL,
    kind text NOT NULL,
    collection text NOT NULL,
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
    PRIMARY KEY (snapshot_id, kind, collection, ordinal),
    FOREIGN KEY (snapshot_id, kind) REFERENCES reference_catalogues(snapshot_id,kind) ON DELETE CASCADE
);
