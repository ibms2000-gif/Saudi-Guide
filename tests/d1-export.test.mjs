import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildD1SeedSql } from "../scripts/export-d1-snapshot.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "saudi-guide-d1-"));
  await fs.mkdir(path.join(root, "data/places"), { recursive: true });
  await fs.mkdir(path.join(root, "data/paydays"), { recursive: true });

  const write = (file, value) => fs.writeFile(path.join(root, file), JSON.stringify(value, null, 2));
  await write("data/regions.json", [{ slug: "riyadh", nameAr: "منطقة الرياض" }]);
  await write("data/cities.json", [{
    slug: "riyadh",
    nameAr: "الرياض",
    regionSlug: "riyadh",
    regionAr: "منطقة الرياض",
    latitude: 24.7136,
    longitude: 46.6753,
    radius: 20000,
    overview: "عاصمة المملكة.",
  }]);
  await write("data/categories.json", [{
    slug: "restaurants",
    nameAr: "مطاعم ومقاهي",
    singularAr: "مطعم أو مقهى",
    minForPage: 4,
    color: "#ff5a36",
    subcategories: [{ slug: "coffee", nameAr: "قهوة" }],
  }]);
  await write("data/places/_meta.json", {
    fetchedAt: "2026-11-03T10:00:00.000Z",
    cities: { riyadh: { fetchedAt: "2026-11-03T10:00:00.000Z", total: 2, stale: false } },
  });
  await write("data/places/riyadh.json", [
    {
      id: "node-123-cafe",
      name: "O'Brian Cafe",
      categorySlug: "restaurants",
      subcategorySlug: "coffee",
      lat: 24.7,
      lon: 46.6,
      address: "King's Road",
      phone: "+966 50 123 4567",
      website: "https://example.com",
      openingHours: "Mo-Su 08:00-23:00",
      osmType: "node",
      osmId: 123,
    },
    {
      id: "node-456-sparse",
      name: "مكان بلا تفاصيل",
      categorySlug: "restaurants",
      subcategorySlug: null,
      lat: 24.71,
      lon: 46.61,
      address: null,
      phone: null,
      website: null,
      openingHours: null,
      osmType: "node",
      osmId: 456,
    },
  ]);
  await write("data/events.json", [{
    slug: "founding-day",
    nameAr: "يوم التأسيس",
    descriptionAr: "مناسبة وطنية.",
    month: 2,
    day: 22,
    kind: "fixed-annual",
    status: "official",
    sourceName: "مصدر رسمي",
    sourceUrl: "https://example.com/event",
    scopeAr: "السعودية",
  }]);
  await write("data/school-calendars.json", [{
    slug: "1448-1449-test",
    academicYear: "1448-1449",
    titleAr: "التقويم الدراسي التجريبي",
    regionNameAr: "نطاق تجريبي",
    sourceName: "جهة تعليمية",
    sourceUrl: "https://example.com/school",
    verifiedAt: "2026-11-03",
    events: [
      { titleAr: "إجازة الخريف", startDate: "2026-11-20", endDate: "2026-11-28" },
      { titleAr: "إجازة منتصف العام", startDate: "2027-01-08", endDate: "2027-01-16" }
    ]
  }]);
  await write("data/paydays/2026.json", {
    year: 2026,
    nameAr: "رواتب 2026",
    verifiedAt: "2026-11-03",
    sourceName: "وزارة المالية",
    sourceUrl: "https://example.com/payday",
    dates: [{ month: 11, date: "2026-11-26" }],
  });
  await write("data/benefits.json", [{
    slug: "social-security",
    nameAr: "الضمان الاجتماعي",
    summaryAr: "شرح الخدمة.",
    verifiedAt: "2026-11-03",
    sourceName: "وزارة الموارد البشرية",
    sourceUrl: "https://example.com/benefit",
  }]);
  await write("data/statistics.json", [{
    slug: "population",
    titleAr: "السكان",
    value: "100",
    periodAr: "2026",
    summaryAr: "مؤشر سكاني.",
    sourceName: "هيئة الإحصاء",
    sourceUrl: "https://example.com/stat",
    verifiedAt: "2026-11-03",
  }]);
  await write("data/news.json", [{
    slug: "riyadh-local-update",
    titleAr: "خبر محلي",
    summaryAr: "ملخص الخبر.",
    localContextAr: "سياق محلي.",
    regionSlug: "riyadh",
    publishedAt: "2026-11-02",
    sourceName: "واس",
    sourceUrl: "https://example.com/news",
    verifiedAt: "2026-11-03",
  }]);
  return root;
}

test("builds a D1 seed from places and reference datasets without nested transaction statements", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await buildD1SeedSql({ root, generatedAt: "2026-11-03T12:00:00.000Z" });
  assert.equal(result.counts.regions, 1);
  assert.equal(result.counts.cities, 1);
  assert.equal(result.counts.categories, 1);
  assert.equal(result.counts.places, 2);
  assert.equal(result.counts.indexablePlacePages, 1);
  assert.equal(result.counts.referenceRecords, 6);
  assert.equal(result.counts.indexableReferencePages, 6);
  assert.ok(result.counts.sources >= 6);
  assert.equal(result.counts.pageRegistry, 8);

  assert.match(result.sql, /^-- Saudi Guide D1 snapshot export/m);
  assert.doesNotMatch(result.sql, /BEGIN TRANSACTION|COMMIT;/);
  assert.match(result.sql, /O''Brian Cafe/);
  assert.match(result.sql, /King''s Road/);
  assert.match(result.sql, /'riyadh:node-123-cafe'/);
  assert.match(result.sql, /'insufficient_supporting_details'/);
  assert.match(result.sql, /\/place\/riyadh\/node\/123\//);
  assert.match(result.sql, /\/calendar\/events\/founding-day\//);
  assert.match(result.sql, /\/calendar\/schools\/1448-1449-test\//);
  assert.match(result.sql, /\/calendar\/salaries\/2026\//);
  assert.match(result.sql, /\/benefits\/social-security\//);
  assert.match(result.sql, /\/statistics\/population\//);
  assert.match(result.sql, /\/news\/riyadh-local-update\//);
  assert.match(result.sql, /OpenStreetMap contributors/);
  assert.equal(result.snapshotSha256.length, 64);
  assert.ok(result.sql.length > 1000);
});

test("is deterministic when the same snapshot and generation time are supplied", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const a = await buildD1SeedSql({ root, generatedAt: "2026-11-03T12:00:00.000Z" });
  const b = await buildD1SeedSql({ root, generatedAt: "2026-11-03T12:00:00.000Z" });
  assert.equal(a.sql, b.sql);
  assert.equal(a.snapshotSha256, b.snapshotSha256);
});
