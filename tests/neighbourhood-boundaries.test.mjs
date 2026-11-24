import test from "node:test";
import assert from "node:assert/strict";
import {
  elementToNeighbourhoodBoundary,
  boundaryContainsPoint,
  assignNeighbourhoodsToPlaces,
} from "../src/lib/neighbourhood-boundaries.mjs";

const square = [
  { lon: 46.0, lat: 24.0 },
  { lon: 46.1, lat: 24.0 },
  { lon: 46.1, lat: 24.1 },
  { lon: 46.0, lat: 24.1 },
  { lon: 46.0, lat: 24.0 },
];

function way(id, name, place = "neighbourhood", geometry = square) {
  return {
    type: "way",
    id,
    tags: { place, name, "name:ar": name },
    geometry,
  };
}

test("يستخرج مضلع حي من way مغلق ذي اسم ونوع معروف", () => {
  const result = elementToNeighbourhoodBoundary(way(101, "حي الاختبار"));
  assert.equal(result.id, "way/101");
  assert.equal(result.nameAr, "حي الاختبار");
  assert.equal(result.placeType, "neighbourhood");
  assert.equal(result.polygons.length, 1);
  assert.equal(result.sourceTag, "place=neighbourhood (area)");
});

test("يرفض النقاط والطرق المفتوحة والعناصر بلا اسم أو نوع حي", () => {
  assert.equal(elementToNeighbourhoodBoundary({
    type: "node", id: 1, tags: { place: "neighbourhood", name: "حي" }, lat: 24, lon: 46,
  }), null);
  assert.equal(elementToNeighbourhoodBoundary(way(102, "حي مفتوح", "neighbourhood", square.slice(0, 3))), null);
  assert.equal(elementToNeighbourhoodBoundary({
    ...way(103, ""), tags: { place: "neighbourhood" },
  }), null);
  assert.equal(elementToNeighbourhoodBoundary(way(104, "سكن", "residential")), null);
});

test("لا يقبل relation إلا إذا كانت boundary=place ويستخرج outer وinner", () => {
  const inner = [
    { lon: 46.03, lat: 24.03 },
    { lon: 46.07, lat: 24.03 },
    { lon: 46.07, lat: 24.07 },
    { lon: 46.03, lat: 24.07 },
    { lon: 46.03, lat: 24.03 },
  ];
  const relation = {
    type: "relation",
    id: 201,
    tags: { type: "boundary", boundary: "place", place: "quarter", name: "الحي الأوسط" },
    members: [
      { type: "way", role: "outer", geometry: square },
      { type: "way", role: "inner", geometry: inner },
    ],
  };
  const result = elementToNeighbourhoodBoundary(relation);
  assert.equal(result.polygons.length, 1);
  assert.equal(result.polygons[0].inners.length, 1);
  assert.equal(boundaryContainsPoint(result, 24.02, 46.02), true);
  assert.equal(boundaryContainsPoint(result, 24.05, 46.05), false);
  assert.equal(elementToNeighbourhoodBoundary({
    ...relation, id: 202, tags: { place: "quarter", name: "حدود غير موثقة" },
  }), null);
});

test("يجمع أجزاء relation المتصلة لتكوين حلقة مغلقة", () => {
  const relation = {
    type: "relation",
    id: 301,
    tags: { boundary: "place", place: "neighbourhood", name: "حي الأجزاء" },
    members: [
      { type: "way", role: "outer", geometry: square.slice(0, 3) },
      { type: "way", role: "outer", geometry: square.slice(2, 5) },
      { type: "way", role: "outer", geometry: [square[4], square[0]] },
    ],
  };
  const result = elementToNeighbourhoodBoundary(relation);
  assert.ok(result);
  assert.equal(result.polygons.length, 1);
  assert.equal(boundaryContainsPoint(result, 24.05, 46.05), true);
});

test("يربط المكان داخل المضلع ويترك المكان خارجه دون تخمين", () => {
  const boundary = elementToNeighbourhoodBoundary(way(401, "حي النرجس"));
  const places = [
    { id: "inside", lat: 24.05, lon: 46.05 },
    { id: "outside", lat: 24.2, lon: 46.2 },
  ];
  const assigned = assignNeighbourhoodsToPlaces(places, [boundary]);
  assert.equal(assigned[0].neighbourhood, "حي النرجس");
  assert.equal(assigned[0].neighbourhoodBoundaryId, "way/401");
  assert.equal(assigned[0].neighbourhoodSourceTag, "place=neighbourhood (area)");
  assert.equal(assigned[1].neighbourhood, undefined);
});

test("يحافظ على وسم الحي الصريح ويختار الحي الأدق عند تداخل الحدود", () => {
  const outer = elementToNeighbourhoodBoundary(way(501, "المنطقة الأوسع", "suburb"));
  const inner = elementToNeighbourhoodBoundary(way(502, "حي أدق", "neighbourhood", [
    { lon: 46.02, lat: 24.02 },
    { lon: 46.08, lat: 24.02 },
    { lon: 46.08, lat: 24.08 },
    { lon: 46.02, lat: 24.08 },
    { lon: 46.02, lat: 24.02 },
  ]));
  const assigned = assignNeighbourhoodsToPlaces([
    { id: "explicit", lat: 24.05, lon: 46.05, neighbourhood: "اسم موثق", neighbourhoodSourceTag: "addr:neighbourhood" },
    { id: "inside", lat: 24.05, lon: 46.05 },
  ], [outer, inner]);

  assert.equal(assigned[0].neighbourhood, "اسم موثق");
  assert.equal(assigned[1].neighbourhood, "حي أدق");
  assert.equal(assigned[1].neighbourhoodBoundaryId, "way/502");
});
