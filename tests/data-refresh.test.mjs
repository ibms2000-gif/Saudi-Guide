import test from "node:test";
import assert from "node:assert/strict";
import { selectBootstrapBatch, selectRefreshBatch } from "../src/lib/data-refresh.mjs";

test("bootstrap batch selects only the first five pending cities", () => {
  const cities = ["riyadh", "jeddah", "makkah", "dammam", "khobar", "abha", "jazan"]
    .map((slug) => ({ slug }));
  const completed = new Set(["riyadh", "dammam"]);

  const batch = selectBootstrapBatch(cities, completed, 5);

  assert.deepEqual(batch.cities.map((city) => city.slug), [
    "jeddah", "makkah", "khobar", "abha", "jazan",
  ]);
  assert.equal(batch.skipped, 2);
  assert.equal(batch.remaining, 0);
});

test("bootstrap batch keeps remaining cities for the next run", () => {
  const cities = ["riyadh", "jeddah", "makkah", "dammam", "khobar", "abha"]
    .map((slug) => ({ slug }));

  const first = selectBootstrapBatch(cities, new Set(["riyadh"]), 3);
  assert.deepEqual(first.cities.map((city) => city.slug), ["jeddah", "makkah", "dammam"]);
  assert.equal(first.remaining, 2);

  const second = selectBootstrapBatch(cities, new Set(["riyadh", "jeddah", "makkah", "dammam"]), 3);
  assert.deepEqual(second.cities.map((city) => city.slug), ["khobar", "abha"]);
  assert.equal(second.remaining, 0);
});

test("invalid batch sizes fall back to five", () => {
  const cities = Array.from({ length: 8 }, (_, index) => ({ slug: `city-${index}` }));
  const batch = selectBootstrapBatch(cities, new Set(), 99);

  assert.equal(batch.cities.length, 5);
  assert.equal(batch.remaining, 3);
});


test("scheduled refresh prioritises failed and missing snapshots before old successful snapshots", () => {
  const cities = ["riyadh", "jeddah", "makkah", "dammam", "khobar"]
    .map((slug) => ({ slug }));
  const meta = {
    riyadh: { fetchedAt: "2026-11-10T00:00:00.000Z", stale: false },
    jeddah: { fetchedAt: "2026-11-20T00:00:00.000Z", stale: false },
    dammam: { fetchedAt: "2026-11-21T00:00:00.000Z", stale: true },
    khobar: { fetchedAt: "2026-11-01T00:00:00.000Z", stale: false },
  };

  const batch = selectRefreshBatch(cities, meta, 3);

  assert.deepEqual(batch.cities.map((city) => city.slug), ["dammam", "makkah", "khobar"]);
  assert.equal(batch.remaining, 2);
});

test("scheduled refresh selects all cities when fewer than the batch size remain", () => {
  const cities = [{ slug: "riyadh" }, { slug: "jeddah" }];
  const batch = selectRefreshBatch(cities, {}, 5);

  assert.deepEqual(batch.cities, cities);
  assert.equal(batch.remaining, 0);
});

test("invalid refresh batch sizes fall back to five", () => {
  const cities = Array.from({ length: 8 }, (_, index) => ({ slug: `city-${index}` }));
  const batch = selectRefreshBatch(cities, {}, 99);

  assert.equal(batch.cities.length, 5);
  assert.equal(batch.remaining, 3);
});
