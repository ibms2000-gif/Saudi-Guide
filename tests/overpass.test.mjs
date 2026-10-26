import test from "node:test";
import assert from "node:assert/strict";
import { buildQuery, elementToRecord, fetchOverpass } from "../src/lib/overpass.mjs";

test("Overpass query includes node, way and relation features", () => {
  const query = buildQuery(24, 46, 5000, [
    { osmQueries: ["amenity=restaurant"] },
  ]);
  assert.match(query, /nwr\(around:5000,24,46\)\["amenity"="restaurant"\];/);
  assert.match(query, /out center tags;/);
  assert.doesNotMatch(query, /\nnode\(/);
  assert.doesNotMatch(query, /\nway\(/);
  assert.doesNotMatch(query, /\nrelation\(/);
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

test("fetchOverpass honors Retry-After and retries the same endpoint once", async () => {
  const calls = [];
  const waits = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "2" },
      });
    }
    return new Response(JSON.stringify({ elements: [{ type: "node", id: 7 }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const elements = await fetchOverpass("test-query", {
    fetchImpl: fakeFetch,
    sleepFn: async (ms) => waits.push(ms),
    rateLimitFallbackMs: 1000,
  });

  assert.equal(elements.length, 1);
  assert.deepEqual(waits, [2000]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1], "a 429 must not switch endpoints to bypass throttling");
});

test("fetchOverpass stops after a second 429 instead of creating a retry storm", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": "1" },
    });
  };

  await assert.rejects(
    fetchOverpass("test-query", {
      fetchImpl: fakeFetch,
      sleepFn: async () => {},
      rateLimitFallbackMs: 1,
    }),
    /HTTP 429/,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
});
