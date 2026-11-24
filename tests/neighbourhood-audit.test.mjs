import test from "node:test";
import assert from "node:assert/strict";
import { summariseNeighbourhoodCoverage } from "../src/lib/neighbourhood-audit.mjs";

function taggedPlace(neighbourhood, sourceTag, categorySlug) {
  return { neighbourhood, neighbourhoodSourceTag: sourceTag, categorySlug };
}

test("يلخص تغطية الأحياء الصريحة ومصدر الوسم والأحياء المؤهلة", () => {
  const groupPlaces = [
    ...Array.from({ length: 4 }, () => taggedPlace("حي الاختبار", "addr:neighbourhood", "food")),
    ...Array.from({ length: 4 }, () => taggedPlace("حي الاختبار", "addr:suburb", "services")),
  ];
  const cities = [
    {
      slug: "sample",
      nameAr: "مدينة تجريبية",
      places: [...groupPlaces, { neighbourhood: null }, { neighbourhood: "  " }],
      neighbourhoods: [{
        nameAr: "حي الاختبار",
        totalPlaces: 8,
        categoryCount: 2,
        indexable: true,
        places: groupPlaces,
      }],
    },
    { slug: "empty", nameAr: "مدينة بلا وسوم", places: [], neighbourhoods: [] },
  ];
  const report = summariseNeighbourhoodCoverage(cities, {
    cities: { sample: { fetchedAt: "2026-11-24T00:00:00Z", stale: false } },
  });

  assert.deepEqual(report.summary, {
    cityCount: 2,
    citiesWithTaggedPlaces: 1,
    citiesWithoutTaggedPlaces: 1,
    totalPlaces: 10,
    taggedPlaces: 8,
    distinctNeighbourhoods: 1,
    indexableNeighbourhoods: 1,
  });
  assert.equal(report.cities[0].coveragePercent, 80);
  assert.deepEqual(report.cities[0].sourceTagCounts, {
    "addr:neighbourhood": 4,
    "addr:suburb": 4,
  });
  assert.equal(report.cities[0].neighbourhoods[0].indexable, true);
  assert.equal(report.cities[0].fetchedAt, "2026-11-24T00:00:00Z");
  assert.equal(report.cities[0].stale, false);
});

test("لا يحتسب القيم الفارغة أو المدن بلا بيانات ضمن تغطية الأحياء", () => {
  const report = summariseNeighbourhoodCoverage([
    {
      slug: "one",
      nameAr: "الأولى",
      places: [{ neighbourhood: null }, { neighbourhood: "  " }],
      neighbourhoods: [],
    },
    { slug: "two", nameAr: "الثانية", places: null, neighbourhoods: null },
  ]);
  assert.equal(report.summary.taggedPlaces, 0);
  assert.equal(report.summary.citiesWithoutTaggedPlaces, 2);
  assert.equal(report.cities[0].coveragePercent, 0);
  assert.equal(report.cities[1].totalPlaces, 0);
});
