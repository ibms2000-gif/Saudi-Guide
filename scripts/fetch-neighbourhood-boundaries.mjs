#!/usr/bin/env node
// يجلب مضلعات الأحياء المرسومة صراحة في OSM، ولا يستخدم نقاط مركز الحي لتعيين الأماكن.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchOverpass } from "../src/lib/overpass.mjs";
import { selectBootstrapBatch, selectRefreshBatch } from "../src/lib/data-refresh.mjs";
import { elementToNeighbourhoodBoundary } from "../src/lib/neighbourhood-boundaries.mjs";
import { sleep } from "../src/lib/util.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cities = JSON.parse(await fs.readFile(path.join(ROOT, "data/cities.json"), "utf8"));
const onlyCity = process.argv.find((argument) => argument.startsWith("--city="))?.split("=")[1];
const runAll = process.argv.includes("--all");

if (onlyCity && !cities.some((city) => city.slug === onlyCity)) {
  throw new Error("مدينة غير معروفة في --city: " + onlyCity);
}

const dataDirectory = path.join(ROOT, "data/neighbourhood-boundaries");
await fs.mkdir(dataDirectory, { recursive: true });
const metaPath = path.join(dataDirectory, "_meta.json");
let meta = { source: "openstreetmap-overpass", license: "ODbL-1.0", cities: {} };
try {
  meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
} catch {
  // يبدأ الملف عند أول جلب ناجح.
}
meta = {
  ...meta,
  source: "openstreetmap-overpass",
  license: "ODbL-1.0",
  cities: { ...(meta.cities || {}) },
};

const batchSizeValue = Number(process.env.NEIGHBOURHOOD_BOUNDARY_BATCH_SIZE ?? 5);
const batchSize = Number.isInteger(batchSizeValue) && batchSizeValue >= 1 && batchSizeValue <= 10
  ? batchSizeValue
  : 5;
const refreshBatchOnly = process.env.NEIGHBOURHOOD_BOUNDARY_REFRESH_BATCH_ONLY === "true";
const bootstrapOnly = process.env.NEIGHBOURHOOD_BOUNDARY_BOOTSTRAP_ONLY !== "false";
let targets = cities;

if (onlyCity) {
  targets = cities.filter((city) => city.slug === onlyCity);
} else if (!runAll && refreshBatchOnly) {
  const batch = selectRefreshBatch(cities, meta.cities, batchSize);
  targets = batch.cities;
  console.log(
    "دفعة تحديث الحدود: " + targets.map((city) => city.nameAr).join("، ") +
    "؛ المدن المتبقية في الدورات القادمة: " + batch.remaining,
  );
} else if (!runAll && bootstrapOnly) {
  const completed = new Set();
  for (const city of cities) {
    const filePath = path.join(dataDirectory, city.slug + ".json");
    try {
      const saved = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (Array.isArray(saved) && meta.cities[city.slug]?.stale === false) {
        completed.add(city.slug);
      }
    } catch {
      // Missing or invalid snapshots remain eligible for the bootstrap batch.
    }
  }
  const batch = selectBootstrapBatch(cities, completed, batchSize);
  targets = batch.cities;
  console.log(
    "دفعة تهيئة الحدود: " + targets.map((city) => city.nameAr).join("، ") +
    "؛ المدن المكتملة: " + batch.skipped +
    "؛ المدن المتبقية: " + batch.remaining,
  );
}

function buildQuery(city) {
  const placeValues = "^(neighbourhood|quarter|suburb)$";
  return [
    "[out:json][timeout:60];",
    "(",
    "  way(around:" + city.radius + "," + city.latitude + "," + city.longitude + ")[\"place\"~\"" + placeValues + "\"];",
    "  relation(around:" + city.radius + "," + city.latitude + "," + city.longitude + ")[\"boundary\"=\"place\"][\"place\"~\"" + placeValues + "\"];",
    ");",
    "out geom;",
  ].join("\n");
}

const configuredDelay = Number(process.env.OVERPASS_DELAY_MS);
const delayMs = Number.isFinite(configuredDelay) && configuredDelay >= 10_000
  ? configuredDelay
  : 10_000;
let attempted = 0;
let successful = 0;
let rateLimited = false;

for (const city of targets) {
  attempted += 1;
  process.stdout.write("جلب مضلعات الأحياء: " + city.nameAr + " (" + city.slug + ") ... ");
  try {
    const elements = await fetchOverpass(buildQuery(city));
    const seen = new Set();
    const boundaries = [];
    for (const element of elements) {
      const boundary = elementToNeighbourhoodBoundary(element);
      if (!boundary || seen.has(boundary.id)) continue;
      seen.add(boundary.id);
      boundaries.push(boundary);
    }

    boundaries.sort((a, b) =>
      a.placeType.localeCompare(b.placeType) ||
      a.nameAr.localeCompare(b.nameAr, "ar") ||
      a.id.localeCompare(b.id),
    );

    await fs.writeFile(
      path.join(dataDirectory, city.slug + ".json"),
      JSON.stringify(boundaries, null, 2) + "\n",
    );

    const fetchedAt = new Date().toISOString();
    meta.cities[city.slug] = {
      fetchedAt,
      total: boundaries.length,
      ways: boundaries.filter((item) => item.osmType === "way").length,
      relations: boundaries.filter((item) => item.osmType === "relation").length,
      stale: false,
    };
    meta.fetchedAt = fetchedAt;
    successful += 1;
    console.log(boundaries.length + " مضلعًا صالحًا");
  } catch (error) {
    const message = String(error?.message || error).slice(0, 500);
    meta.cities[city.slug] = {
      ...(meta.cities[city.slug] || {}),
      lastAttemptAt: new Date().toISOString(),
      lastError: message,
      stale: true,
    };
    console.log("فشل: " + message);
    if (/HTTP 429|rate.?limit/i.test(message)) {
      rateLimited = true;
      console.log("أُوقفت الدفعة لاحترام قيود Overpass.");
      break;
    }
  }

  if (city !== targets[targets.length - 1] && !rateLimited) {
    await sleep(delayMs);
  }
}

if (attempted > 0) {
  meta.lastAttemptAt = new Date().toISOString();
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n");
}

if (attempted === 0) {
  console.log("لا توجد مدن ناقصة في هذه الدفعة.");
} else {
  console.log(
    "اكتملت معالجة " + successful + " مدينة من " + attempted +
    "؛ ملفات الحدود محفوظة في data/neighbourhood-boundaries/." +
    (rateLimited ? " أوقف التقييد بقية الدفعة." : ""),
  );
  if (successful === 0) process.exitCode = 1;
}
