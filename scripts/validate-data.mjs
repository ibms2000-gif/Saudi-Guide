#!/usr/bin/env node
// Release gate: refuse deployment when the place data snapshot is missing or effectively empty.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cities = JSON.parse(await fs.readFile(path.join(ROOT, "data/cities.json"), "utf8"));
const categories = JSON.parse(await fs.readFile(path.join(ROOT, "data/categories.json"), "utf8"));
const knownCategories = new Set(categories.map((category) => category.slug));
let totalPlaces = 0;
let citiesWithData = 0;
let filesPresent = 0;
const errors = [];

for (const city of cities) {
  const filePath = path.join(ROOT, "data/places", city.slug + ".json");
  let places;
  try {
    places = JSON.parse(await fs.readFile(filePath, "utf8"));
    filesPresent += 1;
  } catch {
    continue;
  }
  if (!Array.isArray(places)) {
    errors.push(city.slug + ": ملف الأماكن ليس مصفوفة JSON");
    continue;
  }
  const ids = new Set();
  for (const place of places) {
    if (!place || typeof place.name !== "string" || !place.name.trim()) {
      errors.push(city.slug + ": يوجد عنصر بلا اسم صالح");
      continue;
    }
    if (!knownCategories.has(place.categorySlug)) {
      errors.push(city.slug + ": تصنيف غير معروف " + String(place.categorySlug));
    }
    if (place.id && ids.has(place.id)) {
      errors.push(city.slug + ": معرّف مكرر " + place.id);
    }
    if (place.id) ids.add(place.id);
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon) || Math.abs(place.lat) > 90 || Math.abs(place.lon) > 180) {
      errors.push(city.slug + ": إحداثيات غير صالحة لعنصر " + place.name);
    }
  }
  totalPlaces += places.length;
  if (places.length > 0) citiesWithData += 1;
}

if (errors.length) {
  console.error("فشل التحقق من بيانات الأماكن:");
  for (const error of errors.slice(0, 30)) console.error("- " + error);
  if (errors.length > 30) console.error("... وأخطاء أخرى عددها " + (errors.length - 30));
  process.exit(1);
}
console.log("ملخص البيانات: " + totalPlaces + " مكانًا، " + citiesWithData + " مدينة بها بيانات، " + filesPresent + " ملف مدينة.");
if (filesPresent === 0 || citiesWithData < 5 || totalPlaces < 50) {
  console.error("رفض النشر: البيانات غير كافية. المطلوب على الأقل 5 مدن بها بيانات و50 مكانًا، بعد تشغيل npm run data.");
  process.exit(1);
}
console.log("اجتازت البيانات الحد الأدنى للنشر.");
