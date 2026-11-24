#!/usr/bin/env node
// تقرير تغطية الأحياء المسجلة صراحة في سجلات OpenStreetMap، دون تخمين أو إثراء خارجي.
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadModel,
  MIN_NEIGHBOURHOOD_PLACES,
  MIN_NEIGHBOURHOOD_CATEGORIES,
} from "../src/lib/data.mjs";
import { summariseNeighbourhoodCoverage } from "../src/lib/neighbourhood-audit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const model = await loadModel(ROOT);
const report = summariseNeighbourhoodCoverage(model.cities, model.meta, {
  minimumPlaces: MIN_NEIGHBOURHOOD_PLACES,
  minimumCategories: MIN_NEIGHBOURHOOD_CATEGORIES,
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const summary = report.summary;
  const thresholds = report.thresholds;
  console.log("تقرير تغطية الأحياء — وسوم OSM الصريحة فقط");
  console.log(
    "المدن: " + summary.cityCount +
    " | مدن بها وسوم أحياء: " + summary.citiesWithTaggedPlaces +
    " | بلا وسوم: " + summary.citiesWithoutTaggedPlaces,
  );
  console.log(
    "الأماكن: " + summary.totalPlaces +
    " | أماكن مرتبطة بحي: " + summary.taggedPlaces +
    " | أسماء أحياء: " + summary.distinctNeighbourhoods +
    " | أحياء مستوفية شرط الصفحة: " + summary.indexableNeighbourhoods,
  );
  console.log(
    "شرط صفحة الحي: " + thresholds.minimumPlaces +
    " أماكن على الأقل وتصنيفان على الأقل.\n",
  );
  console.log(
    "المدينة | إجمالي الأماكن | أماكن بوسم حي | نسبة التغطية | أسماء الأحياء | أحياء مؤهلة | آخر جلب | الحالة",
  );
  for (const city of report.cities) {
    const fetchedAt = city.fetchedAt ? city.fetchedAt.slice(0, 10) : "غير متاح";
    const freshness = city.stale === true
      ? "قديمة"
      : city.stale === false
        ? "حديثة"
        : "غير معروفة";
    console.log(
      city.nameAr + " | " + city.totalPlaces +
      " | " + city.taggedPlaces +
      " | " + city.coveragePercent + "%" +
      " | " + city.distinctNeighbourhoods +
      " | " + city.indexableNeighbourhoods +
      " | " + fetchedAt +
      " | " + freshness,
    );
  }

  console.log("\nالأحياء التي حققت شروط صفحة الحي:");
  const eligible = report.cities.flatMap((city) =>
    city.neighbourhoods
      .filter((neighbourhood) => neighbourhood.indexable)
      .map((neighbourhood) => ({ city: city.nameAr, ...neighbourhood })),
  );
  if (eligible.length === 0) {
    console.log("لا توجد أحياء مؤهلة في لقطة البيانات الحالية.");
  }
  for (const neighbourhood of eligible) {
    console.log(
      "- " + neighbourhood.nameAr + " — " + neighbourhood.city +
      ": " + neighbourhood.totalPlaces + " مكانًا، " +
      neighbourhood.categoryCount + " تصنيفًا",
    );
  }

  const missing = report.cities
    .filter((city) => city.taggedPlaces === 0)
    .map((city) => city.nameAr);
  console.log("\nمدن لا تحتوي حاليًا على أي مكان يحمل وسم حي صريح:");
  console.log(missing.length ? missing.join("، ") : "لا توجد");
}
