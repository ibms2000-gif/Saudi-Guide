#!/usr/bin/env node
// يجلب بيانات الأماكن من OpenStreetMap عبر Overpass API لكل مدينة ويكتبها
// كملفات JSON ثابتة في data/places/. لا يتم جلب أي بيانات أرصاد جوية هنا.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildQuery, fetchOverpass, elementToRecord } from "../src/lib/overpass.mjs";
import { classifyElement, placeName } from "../src/lib/classify.mjs";
import { slugify, sleep } from "../src/lib/util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const cities = JSON.parse(await fs.readFile(path.join(ROOT, "data/cities.json"), "utf8"));
const categories = JSON.parse(await fs.readFile(path.join(ROOT, "data/categories.json"), "utf8"));

const onlyCity = process.argv.find((a) => a.startsWith("--city="))?.split("=")[1];
const targets = onlyCity ? cities.filter((c) => c.slug === onlyCity) : cities;
if (onlyCity && targets.length === 0) {
  throw new Error(`مدينة غير معروفة في --city: ${onlyCity}`);
}
const bootstrapOnly = process.env.BOOTSTRAP_ONLY === "true";

await fs.mkdir(path.join(ROOT, "data/places"), { recursive: true });

const metaPath = path.join(ROOT, "data/places/_meta.json");
let meta = { source: "overpass", cities: {} };
try {
  meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
} catch {
  // First data refresh: start a new metadata file.
}
meta = { ...meta, source: "overpass", cities: { ...(meta.cities || {}) } };
const runStartedAt = new Date().toISOString();
const configuredDelay = Number(process.env.OVERPASS_DELAY_MS);
const interCityDelayMs = Number.isFinite(configuredDelay) && configuredDelay >= 10_000
  ? configuredDelay
  : 10_000;
let successfulCities = 0;
let attemptedCities = 0;
let skippedExistingCities = 0;
let rateLimited = false;

for (const city of targets) {
  const cityPath = path.join(ROOT, "data/places", `${city.slug}.json`);
  if (bootstrapOnly) {
    let existingPlaces;
    try {
      existingPlaces = JSON.parse(await fs.readFile(cityPath, "utf8"));
    } catch {
      existingPlaces = null;
    }
    const knownEmptySnapshot =
      meta.cities[city.slug]?.stale === false &&
      Number(meta.cities[city.slug]?.total) === 0;
    if (Array.isArray(existingPlaces) && (existingPlaces.length > 0 || knownEmptySnapshot)) {
      skippedExistingCities += 1;
      console.log(`تخطي ${city.nameAr}: توجد بيانات محفوظة مسبقًا.`);
      continue;
    }
  }
  attemptedCities += 1;
  process.stdout.write(`جلب بيانات: ${city.nameAr} (${city.slug}) ... `);
  const query = buildQuery(city.latitude, city.longitude, city.radius, categories);
  let elements = [];
  try {
    elements = await fetchOverpass(query);
  } catch (err) {
    const message = String(err?.message || err);
    console.log(`فشل: ${message}`);
    const previous = meta.cities[city.slug] || {};
    meta.cities[city.slug] = {
      ...previous,
      lastAttemptAt: new Date().toISOString(),
      lastError: message,
      stale: true,
    };

    if (/HTTP 429|rate.?limit/i.test(message)) {
      rateLimited = true;
      console.log("أُوقف جلب بقية المدن بعد تقييد المعدل لتجنّب إرسال طلبات إضافية إلى الخدمة.");
      break;
    }

    // Keep failed requests from turning into a rapid burst of retries.
    await sleep(interCityDelayMs);
    continue;
  }

  const seen = new Set();
  const seenLocations = new Set();
  const places = [];
  for (const el of elements) {
    const rec = elementToRecord(el);
    if (!rec) continue;
    const key = `${rec.osmType}/${rec.osmId}`;
    if (seen.has(key)) continue;
    const name = placeName(rec.tags, "");
    if (!name) continue; // نتجاهل العناصر بلا اسم لضمان جودة المحتوى
    const cls = classifyElement(rec.tags, categories);
    if (!cls) continue;

    // Relations, ways and nodes can all describe the same named place.
    // Collapse same-category records whose names and rounded coordinates match.
    const normalizedName = name.normalize("NFKC").trim().toLocaleLowerCase("ar");
    const locationKey = `${cls.categorySlug}/${normalizedName}/${Number(rec.lat).toFixed(4)}/${Number(rec.lon).toFixed(4)}`;
    if (seenLocations.has(locationKey)) continue;

    seen.add(key);
    seenLocations.add(locationKey);
    places.push({
      id: slugify(`${key}-${name}`).slice(0, 80),
      name,
      categorySlug: cls.categorySlug,
      subcategorySlug: cls.subcategorySlug,
      lat: rec.lat,
      lon: rec.lon,
      address: rec.tags["addr:street"] || rec.tags["addr:full"] || null,
      phone: rec.tags.phone || rec.tags["contact:phone"] || null,
      website: rec.tags.website || rec.tags["contact:website"] || null,
      openingHours: rec.tags.opening_hours || null,
      osmType: rec.osmType,
      osmId: rec.osmId,
    });
  }

  await fs.writeFile(
    path.join(ROOT, "data/places", `${city.slug}.json`),
    JSON.stringify(places, null, 2) + "\n",
  );
  const fetchedAt = new Date().toISOString();
  meta.cities[city.slug] = { fetchedAt, total: places.length, stale: false };
  meta.fetchedAt = fetchedAt;
  successfulCities += 1;
  console.log(`${places.length} عنصر`);

  // Be deliberately gentle to the public Overpass service.
  if (city !== targets[targets.length - 1]) await sleep(interCityDelayMs);
}

if (attemptedCities > 0) {
  meta.lastAttemptAt = runStartedAt;
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n");
}

if (attemptedCities === 0 && bootstrapOnly) {
  console.log(`اكتملت مرحلة التهيئة: لا توجد مدن ناقصة البيانات ضمن ${targets.length} مدينة. تم تخطي ${skippedExistingCities} مدينة.`);
} else if (successfulCities === 0) {
  console.error("لم ينجح جلب البيانات لأي مدينة؛ احتُفظ بالبيانات السابقة إن وُجدت.");
  process.exitCode = 1;
} else {
  console.log(`نجح جلب بيانات ${successfulCities} مدينة من أصل ${attemptedCities} مدينة تمت محاولة جلبها. ${rateLimited ? "أُوقفت الدفعة بسبب تقييد المعدل." : ""} راجع data/places/_meta.json لآخر تحديث ناجح لكل مدينة.`);
}
