import test from "node:test";
import assert from "node:assert/strict";
import {
  schoolCalendarsIndexPage,
  schoolCalendarPage,
} from "../src/lib/calendar.mjs";

const calendar = {
  slug: "1448-1449-test",
  academicYear: "1448–1449 هـ / 2026–2027 م",
  titleAr: "التقويم الدراسي التجريبي",
  regionNameAr: "نطاق جغرافي محدد",
  descriptionAr: "وصف يوضح النطاق وحدود هذا التقويم.",
  sourceName: "جهة تعليمية رسمية",
  sourceUrl: "https://example.com/calendar",
  verifiedAt: "2026-11-03",
  status: "official-published",
  events: [
    {
      slug: "autumn",
      titleAr: "إجازة الخريف",
      startDate: "2026-11-20",
      endDate: "2026-11-28",
      status: "official",
      noteAr: "الفترة كما وردت في المصدر.",
    },
    {
      slug: "midyear",
      titleAr: "إجازة منتصف العام",
      startDate: "2027-01-08",
      endDate: "2027-01-16",
      status: "official",
    },
  ],
};

test("school calendar page renders its regional scope, date ranges, source and verification date", () => {
  const html = schoolCalendarPage(calendar, new Date("2026-11-03T12:00:00+03:00"));
  assert.match(html, /التقويم الدراسي التجريبي/);
  assert.match(html, /نطاق جغرافي محدد/);
  assert.match(html, /2026-11-20/);
  assert.match(html, /2026-11-28/);
  assert.match(html, /إجازة منتصف العام/);
  assert.match(html, /آخر تاريخ تحقق من المصدر: 2026-11-03/);
  assert.match(html, /example.com\/calendar/);
  assert.match(html, /<meta name="robots" content="index, follow">/);
  assert.match(html, /rel="canonical"/);
});

test("school calendar page marks events ended, upcoming or current according to Riyadh date", () => {
  const ended = schoolCalendarPage(calendar, new Date("2026-12-01T12:00:00+03:00"));
  assert.match(ended, /إجازة الخريف/);
  assert.match(ended, /انتهت/);
  assert.match(ended, /المناسبة الدراسية القادمة/);
  const during = schoolCalendarPage(calendar, new Date("2026-11-22T12:00:00+03:00"));
  assert.match(during, /جارية الآن/);
});

test("school calendar index lists only calendars with a valid source and sufficient events", () => {
  const html = schoolCalendarsIndexPage([
    calendar,
    { ...calendar, slug: "missing-source", sourceUrl: null },
    { ...calendar, slug: "thin", events: [calendar.events[0]] },
  ]);
  assert.match(html, /1448-1449-test/);
  assert.doesNotMatch(html, /missing-source/);
  assert.doesNotMatch(html, />thin</);
});

test("school calendar renderer rejects missing sources and malformed date ranges", () => {
  assert.throws(() => schoolCalendarPage({ ...calendar, sourceUrl: "" }), /غير مكتملة/);
  assert.throws(() => schoolCalendarPage({
    ...calendar,
    events: [{ ...calendar.events[0], startDate: "2026-11-28", endDate: "2026-11-20" }],
  }), /غير مكتملة/);
});
