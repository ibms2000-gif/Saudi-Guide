#!/usr/bin/env node
// Export the current JSON snapshot as a repeatable SQL seed file for Cloudflare D1.
// This script is deliberately export-only: it never writes to a remote database.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isPlacePageIndexable, placePath } from "../src/lib/place-page.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function json(value) {
  return sql(JSON.stringify(value ?? null));
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function insert(table, columns, values) {
  return `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`;
}

function sourceKey(name, url) {
  return createHash("sha256").update(`${name || ""}\n${url || ""}`).digest("hex").slice(0, 24);
}

function pageHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function placeDetailCount(place) {
  return ["address", "phone", "website", "openingHours"].filter((key) =>
    place?.[key] !== null && place?.[key] !== undefined && String(place[key]).trim() !== "",
  ).length;
}

function placeNoindexReason(place) {
  const validName = typeof place?.name === "string" && place.name.trim();
  const validIdentity = ["node", "way", "relation"].includes(place?.osmType) && /^\d+$/.test(String(place?.osmId ?? ""));
  const lat = Number(place?.lat);
  const lon = Number(place?.lon);
  const validCoordinates = Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lon) && lon >= -180 && lon <= 180;
  if (!validName || !validIdentity || !validCoordinates) return "invalid_identity_or_coordinates";
  if (placeDetailCount(place) < 2) return "insufficient_supporting_details";
  return null;
}

function addSource(map, name, url, role, verifiedAt, extra = {}) {
  if (!name || !url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
  const key = sourceKey(name, url);
  const existing = map.get(key) || {
    sourceKey: key,
    name,
    url,
    role: role || null,
    verifiedAt: verifiedAt || null,
    extra,
  };
  if (role && !existing.role) existing.role = role;
  if (verifiedAt && (!existing.verifiedAt || verifiedAt > existing.verifiedAt)) existing.verifiedAt = verifiedAt;
  map.set(key, existing);
}

function referencePage(recordType, record) {
  if (!record || !record.slug) return null;
  switch (recordType) {
    case "event":
      return record.kind === "fixed-annual" && record.status === "official"
        ? `/calendar/events/${record.slug}/`
        : null;
    case "payroll_schedule":
      return Number.isInteger(Number(record.year))
        ? `/calendar/salaries/${record.year}/`
        : null;
    case "benefit":
      return `/benefits/${record.slug}/`;
    case "statistic":
      return record.titleAr && record.value !== undefined && record.periodAr &&
        record.summaryAr && record.sourceUrl && record.sourceName && record.verifiedAt
        ? `/statistics/${record.slug}/`
        : null;
    case "news":
      return record.titleAr && record.summaryAr && record.localContextAr &&
        record.publishedAt && record.sourceName && record.sourceUrl && record.verifiedAt
        ? `/news/${record.slug}/`
        : null;
    default:
      return null;
  }
}

function genericRecordFields(recordType, record) {
  const title = record.nameAr || record.titleAr || record.shortNameAr || record.title || record.name || recordType;
  const summary = record.summaryAr || record.descriptionAr || record.introAr || record.explanationAr || null;
  const primarySource = record.sourceName
    ? { name: record.sourceName, url: record.sourceUrl }
    : Array.isArray(record.sources) ? record.sources[0] : null;

  return {
    title,
    summary,
    regionSlug: record.regionSlug || null,
    publishedAt: record.publishedAt || null,
    verifiedAt: record.verifiedAt || null,
    status: record.status || (record.verifiedAt ? "verified" : "unverified"),
    sourceName: primarySource?.name || null,
    sourceUrl: primarySource?.url || null,
  };
}

export async function buildD1SeedSql({ root = ROOT, generatedAt = new Date().toISOString() } = {}) {
  const dataDir = path.join(root, "data");
  const [regions, cities, categories, meta, events, benefits, statistics, news] = await Promise.all([
    readJson(path.join(dataDir, "regions.json"), []),
    readJson(path.join(dataDir, "cities.json"), []),
    readJson(path.join(dataDir, "categories.json"), []),
    readJson(path.join(dataDir, "places", "_meta.json"), { cities: {} }),
    readJson(path.join(dataDir, "events.json"), []),
    readJson(path.join(dataDir, "benefits.json"), []),
    readJson(path.join(dataDir, "statistics.json"), []),
    readJson(path.join(dataDir, "news.json"), []),
  ]);

  const paydayDir = path.join(dataDir, "paydays");
  let paydayFiles = [];
  try {
    paydayFiles = (await fs.readdir(paydayDir)).filter((name) => /^\d{4}\.json$/.test(name)).sort();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const paydaySchedules = await Promise.all(
    paydayFiles.map((name) => readJson(path.join(paydayDir, name), null)),
  );

  const placesByCity = new Map();
  for (const city of cities) {
    const places = await readJson(path.join(dataDir, "places", `${city.slug}.json`), []);
    if (!Array.isArray(places)) throw new TypeError(`ملف الأماكن للمدينة ${city.slug} ليس مصفوفة JSON.`);
    placesByCity.set(city.slug, places);
  }

  const counts = {
    regions: regions.length,
    cities: cities.length,
    categories: categories.length,
    places: [...placesByCity.values()].reduce((sum, places) => sum + places.length, 0),
    indexablePlacePages: 0,
    referenceRecords: 0,
    indexableReferencePages: 0,
    sources: 0,
    pageRegistry: 0,
  };

  const lines = [
    "-- Saudi Guide D1 snapshot export",
    `-- Generated at: ${generatedAt}`,
    "-- Source place data: OpenStreetMap contributors, ODbL 1.0",
    "-- This file replaces the imported snapshot inside one transaction.",
    "PRAGMA foreign_keys = ON;",
    "BEGIN TRANSACTION;",
    "DELETE FROM page_registry;",
    "DELETE FROM places;",
    "DELETE FROM reference_records;",
    "DELETE FROM data_sources;",
    "DELETE FROM categories;",
    "DELETE FROM cities;",
    "DELETE FROM regions;",
    "DELETE FROM data_imports;",
  ];

  const add = (statement) => lines.push(statement);

  for (const region of regions) {
    add(insert("regions", ["slug", "name_ar", "payload_json", "updated_at"], [
      sql(region.slug), sql(region.nameAr), json(region), sql(generatedAt),
    ]));
  }

  const places = [];
  for (const city of cities) {
    const cityPlaces = placesByCity.get(city.slug) || [];
    const cityMeta = meta?.cities?.[city.slug] || {};
    add(insert("cities", [
      "slug", "name_ar", "region_slug", "region_ar", "latitude", "longitude",
      "radius_m", "overview", "total_places", "fetched_at", "is_stale", "payload_json", "updated_at",
    ], [
      sql(city.slug), sql(city.nameAr), sql(city.regionSlug), sql(city.regionAr),
      sql(num(city.latitude)), sql(num(city.longitude)), sql(num(city.radius)),
      sql(city.overview || null), sql(cityPlaces.length), sql(cityMeta.fetchedAt || null),
      sql(Boolean(cityMeta.stale)), json(city), sql(generatedAt),
    ]));
    for (const place of cityPlaces) places.push({ city, place, fetchedAt: cityMeta.fetchedAt || meta?.fetchedAt || null });
  }

  for (const category of categories) {
    add(insert("categories", [
      "slug", "name_ar", "singular_ar", "min_for_page", "color", "payload_json", "updated_at",
    ], [
      sql(category.slug), sql(category.nameAr), sql(category.singularAr || null),
      sql(Number(category.minForPage) || 4), sql(category.color || null), json(category), sql(generatedAt),
    ]));
  }

  const sourceMap = new Map();
  addSource(sourceMap, "OpenStreetMap contributors", "https://www.openstreetmap.org/copyright",
    "بيانات الأماكن والإحداثيات", meta?.fetchedAt || generatedAt,
    { licenseName: "ODbL 1.0", licenseUrl: "https://opendatacommons.org/licenses/odbl/" });

  for (const { city, place, fetchedAt } of places) {
    const detailCount = placeDetailCount(place);
    const noindexReason = placeNoindexReason(place);
    const eligible = Boolean(isPlacePageIndexable(place));
    const validPath = placePath(city.slug, place);
    if (eligible) counts.indexablePlacePages += 1;

    add(insert("places", [
      "place_id", "city_slug", "osm_type", "osm_id", "name", "category_slug",
      "subcategory_slug", "latitude", "longitude", "address", "phone", "website",
      "opening_hours", "detail_count", "is_indexable", "fetched_at", "source_name",
      "payload_json", "updated_at",
    ], [
      sql(place.id || `${place.osmType || "unknown"}-${place.osmId || pageHash(place).slice(0, 16)}`),
      sql(city.slug), sql(place.osmType || null), sql(place.osmId === null || place.osmId === undefined ? null : String(place.osmId)),
      sql(place.name), sql(place.categorySlug), sql(place.subcategorySlug || null),
      sql(num(place.lat)), sql(num(place.lon)), sql(place.address || null), sql(place.phone || null),
      sql(place.website || null), sql(place.openingHours || null), sql(detailCount), sql(eligible),
      sql(fetchedAt), sql("OpenStreetMap"), json(place), sql(generatedAt),
    ]));

    if (validPath) {
      const entityKey = `place:${city.slug}:${place.osmType}:${place.osmId}`;
      add(insert("page_registry", [
        "canonical_path", "page_type", "entity_key", "is_indexable", "noindex_reason",
        "lastmod", "content_hash", "updated_at",
      ], [
        sql(validPath), sql("place"), sql(entityKey), sql(eligible),
        sql(noindexReason), sql(fetchedAt), sql(pageHash({
          name: place.name, categorySlug: place.categorySlug, address: place.address,
          phone: place.phone, website: place.website, openingHours: place.openingHours,
          lat: place.lat, lon: place.lon,
        })), sql(generatedAt),
      ]));
      counts.pageRegistry += 1;
    }
  }

  const allReferences = [
    ...events.map((record) => ({ recordType: "event", record })),
    ...paydaySchedules.filter(Boolean).map((record) => ({ recordType: "payroll_schedule", record: { ...record, slug: `payroll-${record.year}`, nameAr: record.nameAr || `جدول الرواتب ${record.year}` } })),
    ...benefits.map((record) => ({ recordType: "benefit", record })),
    ...statistics.map((record) => ({ recordType: "statistic", record })),
    ...news.map((record) => ({ recordType: "news", record })),
  ];

  for (const { recordType, record } of allReferences) {
    const fields = genericRecordFields(recordType, record);
    const slug = String(record.slug || "");
    if (!slug) continue;
    add(insert("reference_records", [
      "record_type", "slug", "title_ar", "summary_ar", "region_slug",
      "published_at", "verified_at", "status", "source_name", "source_url",
      "payload_json", "updated_at",
    ], [
      sql(recordType), sql(slug), sql(fields.title), sql(fields.summary), sql(fields.regionSlug),
      sql(fields.publishedAt), sql(fields.verifiedAt), sql(fields.status),
      sql(fields.sourceName), sql(fields.sourceUrl), json(record), sql(generatedAt),
    ]));
    counts.referenceRecords += 1;

    const sourceCandidates = [];
    if (record.sourceName && record.sourceUrl) {
      sourceCandidates.push({ name: record.sourceName, url: record.sourceUrl, role: recordType });
    }
    for (const source of record.sources || []) {
      sourceCandidates.push({ name: source.name, url: source.url, role: source.role || recordType });
    }
    for (const source of sourceCandidates) {
      addSource(sourceMap, source.name, source.url, source.role, record.verifiedAt || null);
    }

    const canonicalPath = referencePage(recordType, record);
    if (canonicalPath) {
      const entityKey = `${recordType}:${slug}`;
      add(insert("page_registry", [
        "canonical_path", "page_type", "entity_key", "is_indexable", "noindex_reason",
        "lastmod", "content_hash", "updated_at",
      ], [
        sql(canonicalPath), sql(recordType), sql(entityKey), sql(true), sql(null),
        sql(record.verifiedAt || record.publishedAt || generatedAt), sql(pageHash(record)), sql(generatedAt),
      ]));
      counts.indexableReferencePages += 1;
      counts.pageRegistry += 1;
    }
  }

  for (const source of sourceMap.values()) {
    const licenseName = source.extra?.licenseName || null;
    const licenseUrl = source.extra?.licenseUrl || null;
    add(insert("data_sources", [
      "source_key", "source_name", "source_url", "license_name", "license_url",
      "role", "verified_at", "payload_json", "updated_at",
    ], [
      sql(source.sourceKey), sql(source.name), sql(source.url), sql(licenseName), sql(licenseUrl),
      sql(source.role), sql(source.verifiedAt), json(source.extra), sql(generatedAt),
    ]));
    counts.sources += 1;
  }

  const snapshotPayload = {
    regions, cities, categories, meta, events, paydaySchedules, benefits, statistics, news,
    placeCounts: Object.fromEntries([...placesByCity].map(([slug, records]) => [slug, records.length])),
  };
  const snapshotSha = pageHash(snapshotPayload);
  const importId = `snapshot-${generatedAt.replace(/[^0-9]/g, "").slice(0, 14)}-${snapshotSha.slice(0, 8)}`;
  add(insert("data_imports", [
    "import_id", "source_revision", "imported_at", "counts_json", "snapshot_sha256",
  ], [
    sql(importId), sql(process.env.GITHUB_SHA || null), sql(generatedAt), json(counts), sql(snapshotSha),
  ]));

  lines.push("COMMIT;");
  lines.push("");
  return {
    sql: lines.join("\n"),
    counts,
    snapshotSha256: snapshotSha,
    importId,
  };
}

async function main() {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 && process.argv[outputIndex + 1]
    ? path.resolve(process.argv[outputIndex + 1])
    : path.join(ROOT, ".tmp", "d1-snapshot.sql");
  const result = await buildD1SeedSql();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, result.sql, "utf8");
  console.log("تم إنشاء ملف SQL محلي للتجهيز فقط؛ لم يتم الاتصال بقاعدة بيانات أو إرسال أي بيانات.");
  console.log(`الملف: ${outputPath}`);
  console.log("الإحصاءات:", JSON.stringify(result.counts));
  console.log(`SHA-256: ${result.snapshotSha256}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
