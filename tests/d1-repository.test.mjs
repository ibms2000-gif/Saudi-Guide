import test from "node:test";
import assert from "node:assert/strict";
import {
  FIND_PLACE_BY_OSM_ID_SQL,
  findPlaceByOsmId,
} from "../src/lib/d1-repository.mjs";

function fakeDb(row, capture = {}) {
  return {
    prepare(query) {
      capture.query = query;
      return {
        bind(...values) {
          capture.values = values;
          return {
            async first() {
              return row;
            },
          };
        },
      };
    },
  };
}

test("D1 place lookup uses the city and OSM composite index", async () => {
  const capture = {};
  const found = await findPlaceByOsmId(fakeDb({
    id: "riyadh:node-123",
    osmType: "node",
    osmId: "123",
    name: "مقهى الاختبار",
    categorySlug: "restaurants",
    subcategorySlug: "coffee",
    lat: 24.7,
    lon: 46.6,
    address: "شارع الاختبار",
    phone: "+966 50 123 4567",
    website: null,
    openingHours: "Mo-Su 08:00-23:00",
    fetchedAt: "2026-11-03T10:00:00.000Z",
  }, capture), "riyadh", "node", "123");

  assert.deepEqual(capture.values, ["riyadh", "node", "123"]);
  assert.match(capture.query, /WHERE p\.city_slug = \?1 AND p\.osm_type = \?2 AND p\.osm_id = \?3/);
  assert.equal(found.place.osmId, "123");
  assert.equal(found.place.categorySlug, "restaurants");
  assert.equal(found.place.lat, 24.7);
  assert.equal(found.fetchedAt, "2026-11-03T10:00:00.000Z");
});

test("returns null for a missing place", async () => {
  const found = await findPlaceByOsmId(fakeDb(null), "jeddah", "way", "999");
  assert.equal(found, null);
});

test("rejects invalid identifiers before making a D1 query", async () => {
  await assert.rejects(() => findPlaceByOsmId({}, "riyadh", "node", "123"), /D1 binding/);
  const db = fakeDb(null);
  await assert.rejects(() => findPlaceByOsmId(db, "../riyadh", "node", "123"), /City slug/);
  await assert.rejects(() => findPlaceByOsmId(db, "riyadh", "invalid", "123"), /OSM element type/);
  await assert.rejects(() => findPlaceByOsmId(db, "riyadh", "node", "12/3"), /OSM element ID/);
});

test("lookup SQL includes the city metadata join and returns one row", () => {
  assert.match(FIND_PLACE_BY_OSM_ID_SQL, /LEFT JOIN cities/);
  assert.match(FIND_PLACE_BY_OSM_ID_SQL, /LIMIT 1/);
});
