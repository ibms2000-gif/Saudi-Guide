import test from "node:test";
import assert from "node:assert/strict";
import { buildModel } from "../src/lib/data.mjs";

const regions = [{ slug: "riyadh", nameAr: "منطقة الرياض" }];
const cities = [
  { slug: "test-city", nameAr: "مدينة تجريبية", regionSlug: "riyadh", regionAr: "منطقة الرياض", latitude: 1, longitude: 1, radius: 5000, overview: "" },
  { slug: "empty-city", nameAr: "مدينة فارغة", regionSlug: "riyadh", regionAr: "منطقة الرياض", latitude: 2, longitude: 2, radius: 5000, overview: "" },
];
const categories = [
  {
    slug: "restaurants",
    nameAr: "مطاعم",
    singularAr: "مطعم",
    minForPage: 4,
    osmQueries: ["amenity=restaurant"],
    subcategories: [{ slug: "coffee", nameAr: "قهوة", match: { amenity: ["cafe"] } }],
  },
];

function place(i, extra = {}) {
  return { id: `p${i}`, name: `مكان ${i}`, categorySlug: "restaurants", subcategorySlug: null, lat: 1, lon: 1, ...extra };
}

test("فئة بعدد أماكن أقل من الحد الأدنى لا تُعتبر قابلة للفهرسة", () => {
  const placesByCity = { "test-city": [place(1), place(2)], "empty-city": [] };
  const model = buildModel({ regions, cities, categories, placesByCity, meta: null });
  const city = model.citiesBySlug["test-city"];
  assert.equal(city.byCategory.restaurants.indexable, false);
  assert.equal(city.byCategory.restaurants.all.length, 2);
});

test("فئة بعدد أماكن يبلغ الحد الأدنى تصبح قابلة للفهرسة", () => {
  const placesByCity = { "test-city": [place(1), place(2), place(3), place(4)], "empty-city": [] };
  const model = buildModel({ regions, cities, categories, placesByCity, meta: null });
  assert.equal(model.citiesBySlug["test-city"].byCategory.restaurants.indexable, true);
});

test("الفئة الفرعية تظهر فقط عند وجود 3 أماكن أو أكثر", () => {
  const placesByCity = {
    "test-city": [
      place(1, { subcategorySlug: "coffee" }),
      place(2, { subcategorySlug: "coffee" }),
      place(3),
      place(4),
    ],
    "empty-city": [],
  };
  const model = buildModel({ regions, cities, categories, placesByCity, meta: null });
  assert.equal(model.citiesBySlug["test-city"].byCategory.restaurants.subcategories.coffee, undefined);

  placesByCity["test-city"].push(place(5, { subcategorySlug: "coffee" }));
  const model2 = buildModel({ regions, cities, categories, placesByCity, meta: null });
  assert.equal(model2.citiesBySlug["test-city"].byCategory.restaurants.subcategories.coffee.length, 3);
});

test("nationalByCategory يضم فقط المدن التي لديها صفحة قسم قابلة للفهرسة", () => {
  const placesByCity = { "test-city": [place(1)], "empty-city": [] };
  const sparseModel = buildModel({ regions, cities, categories, placesByCity, meta: null });
  assert.deepEqual(sparseModel.nationalByCategory.restaurants.map((c) => c.slug), []);

  placesByCity["test-city"].push(place(2), place(3), place(4));
  const richModel = buildModel({ regions, cities, categories, placesByCity, meta: null });
  assert.deepEqual(richModel.nationalByCategory.restaurants.map((c) => c.slug), ["test-city"]);
});
