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

test("بيانات وزارة الصحة تحتوي قائمتي جدة ومكة وتطابق الأعداد المنشورة", async () => {
  const data = await loadOfficialHealthCenters(ROOT);
  assert.ok(data);
  assert.equal(data.pages.length, 2);
  assert.equal(data.pages.find((page) => page.slug === "jeddah").centers.length, 35);
  assert.equal(data.pages.find((page) => page.slug === "makkah").centers.length, 27);
  assert.equal(data.pages.reduce((sum, page) => sum + page.centers.length, 0), 62);
  assert.equal(data.sourceLastUpdatedHijri, "08 ذو الحجة 1447 هـ");

  for (const page of data.pages) {
    assert.match(page.sourceUrl, /^https:\/\/www\.moh\.gov\.sa\//);
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
  assert.match(index, /نطاق مكة المكرمة/);
  assert.match(index, /08 ذو الحجة 1447 هـ/);
  assert.match(region, /مركز صحي الواحة في شرق جدة/);
  assert.match(region, /تجمع جدة الأول/);
  assert.match(region, /فتح جدول وزارة الصحة الأصلي/);
  assert.match(region, /يرجى التحقق قبل التوجه/);
  assert.match(region, /لم ننقل مؤشرات ساعات العمل/);
  assert.ok(region.includes(jeddah.sourceUrl));
});
