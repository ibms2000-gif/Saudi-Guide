import test from "node:test";
import assert from "node:assert/strict";
import { buildQuery, elementToRecord } from "../src/lib/overpass.mjs";

test("Overpass query includes node, way and relation features", () => {
  const query = buildQuery(24, 46, 5000, [
    { osmQueries: ["amenity=restaurant"] },
  ]);
  assert.match(query, /node\(around:5000,24,46\)\["amenity"="restaurant"\];/);
  assert.match(query, /way\(around:5000,24,46\)\["amenity"="restaurant"\];/);
  assert.match(query, /relation\(around:5000,24,46\)\["amenity"="restaurant"\];/);
});

test("elementToRecord reads relation center coordinates", () => {
  const record = elementToRecord({
    type: "relation",
    id: 123,
    center: { lat: 24.7136, lon: 46.6753 },
    tags: { name: "Place" },
  });
  assert.deepEqual(record, {
    osmType: "relation",
    osmId: 123,
    lat: 24.7136,
    lon: 46.6753,
    tags: { name: "Place" },
  });
});
