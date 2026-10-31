import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCityPrayerTimes,
  nextPrayerForCity,
  prayerTimesPage,
  prayerTimesIndexPage,
} from "../src/lib/prayer-times.mjs";

const riyadh = {
  slug: "riyadh",
  nameAr: "الرياض",
  regionAr: "منطقة الرياض",
  latitude: 24.7136,
  longitude: 46.6753,
};

test("calculates ordered Umm al-Qura times for a Saudi city", () => {
  const now = new Date("2026-10-31T12:00:00.000Z");
  const result = calculateCityPrayerTimes(riyadh, now);
  const times = result.prayers;

  assert.equal(result.dateIso, "2026-10-31");
  assert.ok(times.fajr instanceof Date);
  assert.ok(times.fajr < times.sunrise);
  assert.ok(times.sunrise < times.dhuhr);
  assert.ok(times.dhuhr < times.asr);
  assert.ok(times.asr < times.maghrib);
  assert.ok(times.maghrib <= times.sunset || times.sunset <= times.maghrib);
  assert.ok(times.isha > times.maghrib);
});

test("finds a future prayer time and uses tomorrow's Fajr after Isha", () => {
  const evening = new Date("2026-10-31T21:30:00.000Z");
  const next = nextPrayerForCity(riyadh, evening);
  assert.equal(next.key, "fajr");
  assert.ok(next.time.getTime() > evening.getTime());
  assert.equal(next.dateIso, "2026-11-01");
});

test("rejects cities with missing or invalid coordinates", () => {
  assert.throws(
    () => calculateCityPrayerTimes({ ...riyadh, latitude: 120 }),
    /خط العرض/,
  );
});

test("renders a city prayer page with local times, source and countdown", () => {
  const html = prayerTimesPage(riyadh, new Date("2026-10-31T12:00:00.000Z"));
  assert.match(html, /مواقيت الصلاة في الرياض/);
  assert.match(html, /data-countdown-target/);
  assert.match(html, /Umm al-Qura/);
  assert.match(html, /ummulqura\.org\.sa/);
  assert.match(html, /canonical/);
});

test("renders the index of Saudi cities with internal links", () => {
  const html = prayerTimesIndexPage([riyadh]);
  assert.match(html, /مواقيت الصلاة في مدن المملكة/);
  assert.match(html, /href="\/prayer-times\/riyadh\//);
});
