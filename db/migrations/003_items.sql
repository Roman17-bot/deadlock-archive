CREATE TABLE item_catalogues (
  snapshot_id bigint PRIMARY KEY REFERENCES archive_snapshots(id) ON DELETE CASCADE,
  meta jsonb NOT NULL,
  statistics_meta jsonb NOT NULL
);
CREATE TABLE shop_items (
  snapshot_id bigint NOT NULL REFERENCES item_catalogues(snapshot_id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  item_id bigint NOT NULL,
  slug text NOT NULL,
  category text NOT NULL CHECK (category IN ('weapon', 'vitality', 'spirit')),
  tier integer NOT NULL CHECK (tier BETWEEN 1 AND 4),
  data jsonb NOT NULL,
  PRIMARY KEY (snapshot_id, item_id),
  UNIQUE (snapshot_id, ordinal),
  UNIQUE (snapshot_id, slug)
);
CREATE TABLE item_purchase_statistics (
  snapshot_id bigint NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  item_id bigint NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (snapshot_id, item_id),
  UNIQUE (snapshot_id, ordinal),
  FOREIGN KEY (snapshot_id, item_id) REFERENCES shop_items(snapshot_id, item_id) ON DELETE CASCADE
);
