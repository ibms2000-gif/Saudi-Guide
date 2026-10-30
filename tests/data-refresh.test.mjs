import test from "node:test";
import assert from "node:assert/strict";
import { selectBootstrapBatch } from "../src/lib/data-refresh.mjs";

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
