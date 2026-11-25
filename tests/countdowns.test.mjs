import test from "node:test";
import assert from "node:assert/strict";
import { nextMonthlyOccurrence, countdownsToolPage } from "../src/lib/countdowns.mjs";

test("يحسب أول يوم من الشهر التالي حسب التاريخ السعودي", () => {
  const result = nextMonthlyOccurrence(1, new Date("2026-11-25T20:00:00.000Z"));
  assert.equal(result.isoDate, "2026-12-01");
  assert.equal(result.targetIso, "2026-12-01T00:00:00+03:00");
});

test("يقدم حساب المواطن إلى الخميس إذا صادف اليوم العاشر الجمعة", () => {
  // 10 September 2027 is Friday, so the expected date is Thursday 9 September.
  const result = nextMonthlyOccurrence(10, new Date("2027-09-01T09:00:00+03:00"), "citizen-account");
  assert.equal(result.isoDate, "2027-09-09");
});

test("يؤخر حساب المواطن إلى الأحد إذا صادف اليوم العاشر السبت", () => {
  // 10 April 2027 is Saturday, so the expected date is Sunday 11 April.
  const result = nextMonthlyOccurrence(10, new Date("2027-04-01T09:00:00+03:00"), "citizen-account");
  assert.equal(result.isoDate, "2027-04-11");
});

test("يعرض العدادات الثابتة والتقديرية والمواعيد السنوية", () => {
  const html = countdownsToolPage({
    countdowns: {
      fixedEvents: [{
        slug: "ramadan-1448", group: "المناسبات الإسلامية", nameAr: "رمضان 1448",
        descriptionAr: "موعد متوقع.", date: "2027-02-08", statusAr: "متوقع",
        sourceName: "تقويم أم القرى", sourceUrl: "https://example.com", noteAr: "قد يختلف يومًا."
      }],
      monthlyEvents: [{
        slug: "social-security", group: "الرواتب والدعم", nameAr: "الضمان",
        descriptionAr: "موعد شهري.", day: 1, rule: "none", statusAr: "رسمي",
        sourceName: "الوزارة", sourceUrl: "https://example.com", noteAr: "تحقق."
      }]
    },
    events: [{
      slug: "founding-day", nameAr: "يوم التأسيس", descriptionAr: "مناسبة وطنية.",
      month: 2, day: 22, kind: "fixed-annual", status: "official",
      sourceName: "جهة رسمية", sourceUrl: "https://example.com"
    }],
    salarySchedules: [{
      year: 2026, sourceName: "وزارة المالية", sourceUrl: "https://example.com",
      dates: [{ date: "2026-11-26" }]
    }],
    now: new Date("2026-11-25T10:00:00+03:00")
  });
  assert.match(html, /راتب الموظفين الحكوميين/);
  assert.match(html, /data-countdown-recurring-day="1"/);
  assert.match(html, /رمضان 1448/);
  assert.match(html, /يوم التأسيس/);
  assert.match(html, /data-private-salary-form/);
});

test("يرفض أيام الصرف الشهرية غير الصحيحة", () => {
  assert.throws(() => nextMonthlyOccurrence(0, new Date()), /بين 1 و31/);
  assert.throws(() => nextMonthlyOccurrence(32, new Date()), /بين 1 و31/);
});
