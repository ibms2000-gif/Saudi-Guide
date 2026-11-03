-- دليل السعودية — قاعدة D1 الأساسية
-- بيانات الأماكن مشتقة من OpenStreetMap وتظل خاضعة لترخيص ODbL.
CREATE TABLE IF NOT EXISTS regions (
  slug TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  slug TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  region_slug TEXT NOT NULL,
  region_ar TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  radius_m INTEGER,
  overview TEXT,
  total_places INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT,
  is_stale INTEGER NOT NULL DEFAULT 0 CHECK (is_stale IN (0, 1)),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (region_slug) REFERENCES regions(slug)
);

CREATE INDEX IF NOT EXISTS idx_cities_region ON cities(region_slug, name_ar);

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  singular_ar TEXT,
  min_for_page INTEGER NOT NULL DEFAULT 4,
  color TEXT,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS places (
  place_id TEXT PRIMARY KEY,
  city_slug TEXT NOT NULL,
  osm_type TEXT,
  osm_id TEXT,
  name TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  subcategory_slug TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  opening_hours TEXT,
  detail_count INTEGER NOT NULL DEFAULT 0,
  is_indexable INTEGER NOT NULL DEFAULT 0 CHECK (is_indexable IN (0, 1)),
  fetched_at TEXT,
  source_name TEXT NOT NULL DEFAULT 'OpenStreetMap',
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (city_slug) REFERENCES cities(slug),
  FOREIGN KEY (category_slug) REFERENCES categories(slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_places_city_osm
  ON places(city_slug, osm_type, osm_id);
CREATE INDEX IF NOT EXISTS idx_places_city_category
  ON places(city_slug, category_slug, name);
CREATE INDEX IF NOT EXISTS idx_places_city_subcategory
  ON places(city_slug, category_slug, subcategory_slug, name);
CREATE INDEX IF NOT EXISTS idx_places_name
  ON places(name);

CREATE TABLE IF NOT EXISTS reference_records (
  record_type TEXT NOT NULL,
  slug TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  summary_ar TEXT,
  region_slug TEXT,
  published_at TEXT,
  verified_at TEXT,
  status TEXT,
  source_name TEXT,
  source_url TEXT,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (record_type, slug)
);

CREATE INDEX IF NOT EXISTS idx_reference_type_date
  ON reference_records(record_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_reference_region_date
  ON reference_records(region_slug, published_at DESC);

CREATE TABLE IF NOT EXISTS data_sources (
  source_key TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  license_name TEXT,
  license_url TEXT,
  role TEXT,
  verified_at TEXT,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS page_registry (
  canonical_path TEXT PRIMARY KEY,
  page_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  is_indexable INTEGER NOT NULL DEFAULT 0 CHECK (is_indexable IN (0, 1)),
  noindex_reason TEXT,
  lastmod TEXT,
  content_hash TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_registry_indexable
  ON page_registry(is_indexable, page_type, canonical_path);
CREATE INDEX IF NOT EXISTS idx_page_registry_lastmod
  ON page_registry(lastmod);

CREATE TABLE IF NOT EXISTS data_imports (
  import_id TEXT PRIMARY KEY,
  source_revision TEXT,
  imported_at TEXT NOT NULL,
  counts_json TEXT NOT NULL,
  snapshot_sha256 TEXT NOT NULL
);
