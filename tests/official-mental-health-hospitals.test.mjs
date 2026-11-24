import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadOfficialMentalHealthHospitals,
  officialMentalHealthHospitalsPage,
} from "../src/lib/official-mental-health-hospitals.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("قائمة الصحة النفسية تطابق الملف الرسمي وتحتوي 19 منشأة", async () => {
  const data = await loadOfficialMentalHealthHospitals(ROOT);
  assert.ok(data);
  assert.equal(data.facilities.length, 19);
  assert.match(data.sourceUrl, /^https:\/\/www\.moh\.gov\.sa\//);
  assert.equal(data.verifiedAt, "2026-11-24");
  assert.ok(data.facilities.every((item) => item.id && item.nameAr && item.areaAr));
  assert.equal(new Set(data.facilities.map((item) => item.id)).size, 19);
});

test("صفحة الصحة النفسية تعرض المصدر والأسماء دون ادعاء ساعات أو أرقام اتصال", async () => {
  const data = await loadOfficialMentalHealthHospitals(ROOT);
  const html = officialMentalHealthHospitalsPage(data);
  assert.match(html, /مواقع مجمعات ومستشفيات الصحة النفسية في السعودية/);
  assert.match(html, /(?:19|١٩) منشأة/);
  assert.match(html, /مجمع إرادة والصحة النفسية بالرياض/);
  assert.match(html, /مستشفى الصحة النفسية بحفر الباطن/);
  assert.match(html, /مستشفى إرادة والصحة النفسية بنجران/);
  assert.match(html, /فتح ملف وزارة الصحة الأصلي وروابط المواقع الجغرافية/);
  assert.match(html, /لا تثبت ساعات العمل أو حالة التشغيل الحالية/);
  assert.doesNotMatch(html, /العمل من الساعة|رقم الهاتف/);
  assert.ok(html.includes(data.sourceUrl));
});
