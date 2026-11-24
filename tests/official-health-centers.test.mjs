import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadOfficialHealthCenters,
  officialHealthCentersIndexPage,
  officialHealthCentersRegionPage,
} from "../src/lib/official-health-centers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("بيانات وزارة الصحة تحتوي 13 قائمة إقليمية وتطابق أعداد المراكز المنشورة", async () => {
  const data = await loadOfficialHealthCenters(ROOT);
  assert.ok(data);
  const expectedCounts = {
    jeddah: 35,
    makkah: 27,
    riyadh: 44,
    madinah: 23,
    tabuk: 12,
    hail: 9,
    najran: 14,
    "al-jouf": 9,
    jazan: 18,
    "al-baha": 13,
    "al-qassim": 25,
    "eastern-region": 15,
    asir: 54,
  };
  assert.equal(data.pages.length, 13);
  for (const [slug, count] of Object.entries(expectedCounts)) {
    assert.equal(data.pages.find((page) => page.slug === slug)?.centers.length, count, slug);
  }
  assert.equal(data.pages.reduce((sum, page) => sum + page.centers.length, 0), 298);
  assert.equal(data.sourceLastUpdatedHijri, "08 ذو الحجة 1447 هـ");
  assert.equal(data.verifiedAt, "2026-11-24");

  for (const page of data.pages) {
    assert.match(page.sourceUrl, /^https:\/\/www\.moh\.gov\.sa\//);
    assert.ok(page.sourceLastUpdatedHijri || data.sourceLastUpdatedHijri);
    assert.ok(page.centers.every((center) => center.nameAr && center.clusterAr && center.id));
  }
});

test("دليل الفهرس وصفحات النطاق تعرض المصدر والتنبيهات دون ادعاء ساعات أو إحداثيات غير منقولة", async () => {
  const data = await loadOfficialHealthCenters(ROOT);
  const index = officialHealthCentersIndexPage(data);
  const jeddah = data.pages.find((page) => page.slug === "jeddah");
  const region = officialHealthCentersRegionPage(data, jeddah);

  assert.match(index, /المراكز الصحية المناوبة/);
  assert.match(index, /نطاق جدة/);
  assert.match(index, /مكة المكرمة والضواحي/);
  assert.match(index, /24\/11\/2026/);
  assert.match(index, /يظهر تاريخ آخر تعديل لدى الوزارة داخل صفحة كل منطقة/);
  assert.match(region, /08 ذو الحجة 1447 هـ/);
  assert.match(region, /مركز صحي الواحة في شرق جدة/);
  assert.match(region, /تجمع جدة الأول/);
  assert.match(region, /فتح جدول وزارة الصحة الأصلي/);
  assert.match(region, /يرجى التحقق قبل التوجه/);
  assert.match(region, /لم ننقل مؤشرات ساعات العمل/);
  assert.ok(region.includes(jeddah.sourceUrl));

  const riyadh = data.pages.find((page) => page.slug === "riyadh");
  const riyadhHtml = officialHealthCentersRegionPage(data, riyadh);
  assert.match(riyadhHtml, /المراكز الصحية المناوبة في منطقة الرياض/);
  assert.match(riyadhHtml, /مراكز المحافظات — التجمع الثالث/);
  assert.match(riyadhHtml, /مركز صحي الرفايع بالجمش - الدوادمي/);
  assert.match(riyadhHtml, /08 ذو الحجة 1447 هـ/);

  const madinah = data.pages.find((page) => page.slug === "madinah");
  const madinahHtml = officialHealthCentersRegionPage(data, madinah);
  assert.match(madinahHtml, /مركز صحي الصويدرة/);
  assert.match(madinahHtml, /مركز صحي باقدو/);
  assert.match(madinahHtml, /22 ذو القعدة 1447 هـ/);

  const qassim = data.pages.find((page) => page.slug === "al-qassim");
  const qassimHtml = officialHealthCentersRegionPage(data, qassim);
  assert.match(qassimHtml, /المراكز الصحية المناوبة في منطقة القصيم/);
  assert.match(qassimHtml, /مركز صحي ضليع رشيد/);
  assert.match(qassimHtml, /مركز صحي البسيتين/);
  assert.match(qassimHtml, /22 ذو القعدة 1447 هـ/);

  const east = data.pages.find((page) => page.slug === "eastern-region");
  const eastHtml = officialHealthCentersRegionPage(data, east);
  assert.match(eastHtml, /المراكز الصحية المناوبة في المنطقة الشرقية/);
  assert.match(eastHtml, /مركز صحي الدخل المحدود في القطيف/);
  assert.match(eastHtml, /مركز صحي الجسر في الخبر/);
  assert.match(eastHtml, /08 ذو الحجة 1447 هـ/);

  const asir = data.pages.find((page) => page.slug === "asir");
  const asirHtml = officialHealthCentersRegionPage(data, asir);
  assert.match(asirHtml, /المراكز الصحية المناوبة في منطقة عسير/);
  assert.match(asirHtml, /مركز صحي وادي بن هشبل في خميس مشيط/);
  assert.match(asirHtml, /مركز صحي الغول في الحرجة/);
  assert.match(asirHtml, /22 ذو القعدة 1447 هـ/);
});
