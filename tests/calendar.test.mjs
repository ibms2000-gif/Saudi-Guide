import test from "node:test";
import assert from "node:assert/strict";
import {
  riyadhDateIso,
  nextAnnualOccurrence,
  formatSaudiDate,
} from "../src/lib/calendar.mjs";

const foundingDay = { month: 2, day: 22 };
const nationalDay = { month: 9, day: 23 };

test("uses Asia/Riyadh when determining today's calendar date", () => {
  const instant = new Date("2026-10-30T22:00:00.000Z");
  assert.equal(riyadhDateIso(instant), "2026-10-31");
});

test("finds the next annual Founding Day occurrence after the current date", () => {
  const now = new Date("2026-10-31T12:00:00.000Z");
  assert.deepEqual(nextAnnualOccurrence(foundingDay, now), {
    year: 2027,
    isoDate: "2027-02-22",
    targetIso: "2027-02-22T00:00:00+03:00",
  });
});

test("returns the current year's event when it has not passed in Riyadh", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");
  assert.equal(nextAnnualOccurrence(nationalDay, now).isoDate, "2026-09-23");
});

test("rejects invalid annual dates", () => {
  assert.throws(() => nextAnnualOccurrence({ month: 13, day: 1 }), /شهر المناسبة/);
  assert.throws(() => nextAnnualOccurrence({ month: 2, day: 30 }), /تاريخ المناسبة/);
});

test("formats the published date using the Saudi timezone", () => {
  assert.match(formatSaudiDate("2027-02-22"), /٢٢|22/);
});
