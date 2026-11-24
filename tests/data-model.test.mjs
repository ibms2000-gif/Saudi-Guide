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
  {
    slug: "health",
    nameAr: "صحة",
    singularAr: "مرفق صحي",
    minForPage: 4,
    osmQueries: ["amenity=clinic"],
    subcategories: [],
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


test("لا ينشئ صفحات أحياء إلا عند وجود 8 أماكن في قسمين على الأقل", () => {
  const items = [
    ...Array.from({ length: 4 }, (_, i) => place(i + 1, { neighbourhood: "حي النرجس" })),
    ...Array.from({ length: 4 }, (_, i) => place(i + 5, { categorySlug: "health", neighbourhood: "حي النرجس" })),
  ];
  const model = buildModel({
    regions, cities, categories,
    placesByCity: { "test-city": items, "empty-city": [] },
    meta: null,
  });
  const city = model.citiesBySlug["test-city"];
  assert.equal(city.totalNeighbourhoods, 1);
  assert.equal(city.neighbourhoods[0].indexable, true);
  assert.equal(city.neighbourhoods[0].totalPlaces, 8);
  assert.equal(city.neighbourhoods[0].categoryCount, 2);
  assert.equal(city.neighbourhoods[0].slug, "حي-النرجس");
});

test("يمنع إنشاء صفحة حي إذا كان العدد أقل من 8 أو كان كله من قسم واحد", () => {
  const tooFew = [
    ...Array.from({ length: 3 }, (_, i) => place(i + 1, { neighbourhood: "حي الندى" })),
    ...Array.from({ length: 4 }, (_, i) => place(i + 4, { categorySlug: "health", neighbourhood: "حي الندى" })),
  ];
  const oneCategory = Array.from({ length: 9 }, (_, i) => place(i + 1, { neighbourhood: "حي المروج" }));
  const model = buildModel({
    regions, cities, categories,
    placesByCity: { "test-city": [...tooFew, ...oneCategory], "empty-city": [] },
    meta: null,
  });
  const neighbourhoods = model.citiesBySlug["test-city"].neighbourhoods;
  assert.equal(neighbourhoods.find((item) => item.slug === "حي-الندى").indexable, false);
  assert.equal(neighbourhoods.find((item) => item.slug === "حي-المروج").indexable, false);
  assert.equal(model.citiesBySlug["test-city"].totalNeighbourhoods, 0);
});

test("يستبعد اسم المدينة من تجميع الأحياء", () => {
  const items = Array.from({ length: 10 }, (_, i) =>
    place(i + 1, { categorySlug: i < 5 ? "restaurants" : "health", neighbourhood: "مدينة تجريبية" }),
  );
  const model = buildModel({
    regions, cities, categories,
    placesByCity: { "test-city": items, "empty-city": [] },
    meta: null,
  });
  assert.equal(model.citiesBySlug["test-city"].neighbourhoods.length, 0);
});

test("يعين الأماكن الواقعة داخل مضلع OSM إلى الحي وينشئ الصفحة عند اجتياز بوابة الجودة", () => {
  const boundary = {
    id: "relation/700",
    placeType: "neighbourhood",
    nameAr: "حي الحدود",
    sourceTag: "boundary=place",
    area: 4,
    polygons: [{
      outer: [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]],
      inners: [],
    }],
  };
  const items = [
    ...Array.from({ length: 4 }, (_, index) =>
      place(index + 1, { categorySlug: "restaurants", lat: 1, lon: 1 }),
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      place(index + 5, { categorySlug: "health", lat: 1.2, lon: 1.2 }),
    ),
    place(9, { categorySlug: "health", lat: 3, lon: 3 }),
  ];
  const model = buildModel({
    regions, cities, categories,
    placesByCity: { "test-city": items, "empty-city": [] },
    neighbourhoodBoundariesByCity: { "test-city": [boundary] },
    meta: null,
  });
  const city = model.citiesBySlug["test-city"];
  const indexed = city.neighbourhoods.find((item) => item.nameAr === "حي الحدود");
  assert.ok(indexed);
  assert.equal(indexed.totalPlaces, 8);
  assert.equal(indexed.categoryCount, 2);
  assert.equal(indexed.indexable, true);
  assert.equal(city.places.find((item) => item.id === "p9").neighbourhood, undefined);
});
