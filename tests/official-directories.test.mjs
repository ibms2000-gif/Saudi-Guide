import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { officialDirectoriesPage } from "../src/lib/official-directories.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("صفحة الأدلة الحكومية تعرض المصادر الرسمية وتفصلها عن بيانات OSM", () => {
  const html = officialDirectoriesPage();
  assert.match(html, /الأدلة الحكومية الرسمية للمنشآت والخدمات/);
  assert.match(html, /الخريطة التفاعلية للمنشآت الصحية/);
  assert.match(html, /الخارطة التعليمية للمدارس/);
  assert.match(html, /خريطة بحث رسمية لا كبيانات منسوخة/);
  assert.match(html, /البيانات المفتوحة لوزارة التعليم/);
  assert.match(html, /البيانات اللحظية لوزارة التعليم/);
  assert.match(html, /لا تمثل سجلاً حكومياً/);
  assert.match(html, /OpenStreetMap/);
  assert.match(html, /rel="canonical" href="[^"]+\/official-directories\//);

  for (const url of [
    "https://www.moh.gov.sa/eservices/interactive-maps/pages/default.aspx",
    "https://www.moh.gov.sa/healthawareness/on-duty-healthcare-centers/pages/default.aspx",
    "https://www.moh.gov.sa/awarenessplateform/VariousTopics/Documents/PTHospitals.pdf",
    "https://www.moh.gov.sa/Ministry/Information-and-services/Documents/Psychological-health.pdf",
    "https://www.moh.gov.sa/ministry/opendata/pages/open-data-library.aspx",
    "https://www.moe.gov.sa/ar/education/educationinksa/gis/pages/default.aspx",
    "https://moe.gov.sa/ar/services/data-and-statistics-center/opendata",
    "https://www.moe.gov.sa/ar/services/data-and-statistics-center/reatltimedata",
  ]) {
    assert.ok(html.includes(url), `المصدر الرسمي غير موجود: ${url}`);
  }
});

test("البناء وقائمة التنقل يسجلان مسار الأدلة الحكومية", async () => {
  const buildSource = await fs.readFile(path.join(ROOT, "scripts/build.mjs"), "utf8");
  const layoutSource = await fs.readFile(path.join(ROOT, "src/lib/layout.mjs"), "utf8");
  assert.match(buildSource, /officialDirectoriesPage/);
  assert.match(buildSource, /add\("\/official-directories\/", officialDirectoriesPage\(\)\)/);
  assert.match(layoutSource, /href="\/official-directories\/"/);
});
