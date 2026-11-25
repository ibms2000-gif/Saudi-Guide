#!/usr/bin/env node
// يجلب بيانات الأماكن من OpenStreetMap عبر Overpass API لكل مدينة ويكتبها
// كملفات JSON ثابتة في data/places/. لا يتم جلب أي بيانات أرصاد جوية هنا.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildQuery, fetchOverpass, elementToRecord } from "../src/lib/overpass.mjs";
import { classifyElement, placeName, extractNeighbourhood } from "../src/lib/classify.mjs";
import { slugify, sleep } from "../src/lib/util.mjs";
import { selectBootstrapBatch, selectRefreshBatch } from "../src/lib/data-refresh.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function readTag(tags, keys, maxLength = 300) {
  for (const key of keys) {
    const raw = tags?.[key];
    if (raw === null || raw === undefined) continue;
    const value = String(raw).replace(/[\\u0000-\\u001F\\u007F]/g, " ").replace(/\\s+/g, " ").trim();
    if (value) return value.slice(0, maxLength);
  }
  return null;
}

function addressFromTags(tags) {
  const full = readTag(tags, ["addr:full"], 300);
  if (full) return full;
  const number = readTag(tags, ["addr:housenumber"], 40);
  const street = readTag(tags, ["addr:street", "addr:place"], 160);
  const city = readTag(tags, ["addr:city", "addr:town", "addr:village"], 100);
  const postcode = readTag(tags, ["addr:postcode"], 20);
  const streetLine = [number, street].filter(Boolean).join(" ");
  const parts = [streetLine || null, city, postcode ? `الرمز البريدي ${postcode}` : null].filter(Boolean);
  return parts.length ? parts.join("، ") : null;
}

const cities = JSON.parse(await fs.readFile(path.join(ROOT, "data/cities.json"), "utf8"));
const categories = JSON.parse(await fs.readFile(path.join(ROOT, "data/categories.json"), "utf8"));

const onlyCity = process.argv.find((a) => a.startsWith("--city="))?.split("=")[1];
const targets = onlyCity ? cities.filter((c) => c.slug === onlyCity) : cities;
if (onlyCity && targets.length === 0) {
  throw new Error(`مدينة غير معروفة في --city: ${onlyCity}`);
}
const bootstrapOnly = process.env.BOOTSTRAP_ONLY === "true";
const configuredBatchSize = Number(process.env.BOOTSTRAP_BATCH_SIZE ?? 5);
const bootstrapBatchSize = Number.isInteger(configuredBatchSize) &&
  configuredBatchSize >= 1 && configuredBatchSize <= 10
  ? configuredBatchSize
  : 5;
const refreshBatchOnly = process.env.REFRESH_BATCH_ONLY === "true";
const configuredRefreshBatchSize = Number(process.env.REFRESH_BATCH_SIZE ?? 5);
const refreshBatchSize = Number.isInteger(configuredRefreshBatchSize) &&
  configuredRefreshBatchSize >= 1 && configuredRefreshBatchSize <= 10
  ? configuredRefreshBatchSize
  : 5;

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
let remainingBootstrapCities = 0;
let remainingRefreshCities = 0;
let rateLimited = false;

let citiesToProcess = targets;
if (bootstrapOnly) {
  const completedSlugs = new Set();
  for (const city of targets) {
    const cityPath = path.join(ROOT, "data/places", `${city.slug}.json`);
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
      completedSlugs.add(city.slug);
    }
  }

  const batch = selectBootstrapBatch(targets, completedSlugs, bootstrapBatchSize);
  citiesToProcess = batch.cities;
  skippedExistingCities = batch.skipped;
  remainingBootstrapCities = batch.remaining;
  console.log(
    `دفعة التهيئة: ${citiesToProcess.length} مدن، تخطي ${skippedExistingCities} مكتملة، والمتبقي بعد هذه الدفعة ${remainingBootstrapCities} مدينة.`,
  );
} else if (refreshBatchOnly) {
  const batch = selectRefreshBatch(targets, meta.cities, refreshBatchSize);
  citiesToProcess = batch.cities;
  remainingRefreshCities = batch.remaining;
  console.log(
    "دفعة التحديث: " + citiesToProcess.map((city) => city.nameAr).join("، ") +
    "؛ المتبقي للدورات القادمة: " + remainingRefreshCities + " مدينة.",
  );
}

for (const city of citiesToProcess) {
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
    const neighbourhood = extractNeighbourhood(rec.tags, city.nameAr);

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
      address: addressFromTags(rec.tags),
      postcode: readTag(rec.tags, ["addr:postcode"], 20),
      phone: readTag(rec.tags, ["contact:phone", "phone", "contact:mobile", "mobile"], 80),
      email: readTag(rec.tags, ["contact:email", "email"], 160),
      website: readTag(rec.tags, ["contact:website", "website"], 300),
      openingHours: readTag(rec.tags, ["opening_hours"], 200),
      cuisine: readTag(rec.tags, ["cuisine"], 160),
      brand: readTag(rec.tags, ["brand:ar", "brand"], 160),
      operator: readTag(rec.tags, ["operator:ar", "operator"], 160),
      description: readTag(rec.tags, ["description:ar", "description"], 500),
      wheelchair: readTag(rec.tags, ["wheelchair"], 40),
      delivery: readTag(rec.tags, ["delivery"], 40),
      takeaway: readTag(rec.tags, ["takeaway"], 40),
      capacity: readTag(rec.tags, ["capacity"], 40),
      neighbourhood: neighbourhood?.name || null,
      neighbourhoodSourceTag: neighbourhood?.sourceTag || null,
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
  if (city !== citiesToProcess[citiesToProcess.length - 1]) await sleep(interCityDelayMs);
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
  console.log(
    `نجح جلب بيانات ${successfulCities} مدينة من أصل ${attemptedCities} مدينة تمت محاولة جلبها. ` +
    `${bootstrapOnly ? `بقي ${remainingBootstrapCities} مدينة لدفعات لاحقة. ` : ""}` +
    `${rateLimited ? "أُوقفت الدفعة بسبب تقييد المعدل. " : ""}راجع data/places/_meta.json لآخر تحديث ناجح لكل مدينة.`,
  );
}
