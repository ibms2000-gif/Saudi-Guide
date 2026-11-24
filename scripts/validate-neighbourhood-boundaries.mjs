#!/usr/bin/env node
// يتحقق من سلامة ملفات مضلعات الأحياء المحفوظة من OSM.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cities = JSON.parse(await fs.readFile(path.join(ROOT, "data/cities.json"), "utf8"));
const directory = path.join(ROOT, "data/neighbourhood-boundaries");
const errors = [];
const totals = { files: 0, boundaries: 0, ways: 0, relations: 0 };

function validCoordinate(point) {
  return Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 &&
    Math.abs(point[1]) <= 90;
}

function validRing(ring) {
  return Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(validCoordinate) &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
}

for (const city of cities) {
  const filePath = path.join(directory, city.slug + ".json");
  let boundaries;
  try {
    boundaries = JSON.parse(await fs.readFile(filePath, "utf8"));
    totals.files += 1;
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    errors.push(city.slug + ": تعذر قراءة JSON: " + error.message);
    continue;
  }

  if (!Array.isArray(boundaries)) {
    errors.push(city.slug + ": ملف الحدود ليس مصفوفة JSON");
    continue;
  }

  const ids = new Set();
  for (const boundary of boundaries) {
    if (!boundary || typeof boundary !== "object") {
      errors.push(city.slug + ": سجل حدود غير صالح");
      continue;
    }
    if (typeof boundary.id !== "string" || !/^(way|relation)\/\d+$/.test(boundary.id)) {
      errors.push(city.slug + ": معرف OSM غير صالح");
    } else if (ids.has(boundary.id)) {
      errors.push(city.slug + ": معرف حدود مكرر " + boundary.id);
    } else {
      ids.add(boundary.id);
    }
    if (!["way", "relation"].includes(boundary.osmType) ||
        !Number.isSafeInteger(boundary.osmId) ||
        boundary.id !== boundary.osmType + "/" + boundary.osmId) {
      errors.push(city.slug + ": مصدر OSM غير متطابق");
    }
    if (typeof boundary.nameAr !== "string" || !boundary.nameAr.trim()) {
      errors.push(city.slug + ": مضلع بلا اسم");
    }
    if (!["neighbourhood", "quarter", "suburb"].includes(boundary.placeType)) {
      errors.push(city.slug + ": نوع مكان غير مدعوم");
    }
    if (!Array.isArray(boundary.polygons) || boundary.polygons.length === 0) {
      errors.push(city.slug + ": لا توجد أشكال مساحية");
      continue;
    }
    for (const polygon of boundary.polygons) {
      if (!validRing(polygon?.outer)) {
        errors.push(city.slug + ": حلقة خارجية غير مغلقة أو بإحداثيات غير صالحة");
      }
      for (const inner of polygon?.inners || []) {
        if (!validRing(inner)) errors.push(city.slug + ": حلقة داخلية غير صالحة");
      }
    }
    totals.boundaries += 1;
    if (boundary.osmType === "way") totals.ways += 1;
    if (boundary.osmType === "relation") totals.relations += 1;
  }
}

if (errors.length) {
  console.error("فشل التحقق من مضلعات الأحياء:");
  for (const error of errors.slice(0, 30)) console.error("- " + error);
  if (errors.length > 30) console.error("... وأخطاء أخرى عددها " + (errors.length - 30));
  process.exit(1);
}

console.log(
  "الحدود سليمة: " + totals.boundaries + " مضلعًا (" +
  totals.ways + " ways، " + totals.relations + " relations) في " +
  totals.files + " ملفات مدن.",
);
