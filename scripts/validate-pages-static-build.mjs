#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DIST = path.join(ROOT, "dist");
const REPORT_PATH = path.join(DIST, "_build-report.json");
const LIMIT = 20_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const report = JSON.parse(await fs.readFile(REPORT_PATH, "utf8"));
assert(report.staticPagesMode === true, "رفض النشر: البناء ليس في وضع Pages الثابت.");
assert(Number.isInteger(report.siteFileCount), "تقرير البناء لا يحتوي عدد الملفات.");
assert(report.siteFileCount <= LIMIT, `رفض النشر: ${report.siteFileCount} ملفًا يتجاوز حد Pages Free البالغ ${LIMIT}.`);
assert(report.dynamicPlacePages === 0, "رفض النشر: ما زالت صفحات الأماكن تعتمد على Worker ديناميكي.");
assert(report.dynamicPrayerPages === 0, "رفض النشر: ما زالت مواقيت الصلاة تعتمد على Worker ديناميكي.");
assert(report.preRenderedPlacePages > 0, "لم تُنشأ صفحات الأماكن مسبقًا.");
assert(report.preRenderedPrayerPages > 0, "لم تُنشأ صفحات مواقيت الصلاة مسبقًا.");

const homeHtml = await fs.readFile(path.join(DIST, "index.html"), "utf8");
assert(homeHtml.includes('<link rel="canonical" href="https://saudi-guide.pages.dev/">'), "Canonical URL does not point to the Pages free domain.");
assert(!homeHtml.includes("saudi-guide.ibms2000.workers.dev"), "The build still references the legacy Workers domain.");

const prayerPage = path.join(DIST, "prayer-times", "riyadh", "index.html");
const prayerHtml = await fs.readFile(prayerPage, "utf8");
assert(prayerHtml.includes('id="prayer-times-schedule"'), "جدول مواقيت الرياض المسبق غير موجود.");
assert(prayerHtml.includes('src="/prayer-times.js"'), "ملف تحديث المواقيت للمتصفح غير موجود.");

for (const forbidden of [
  path.join(DIST, "data", "places"),
  path.join(DIST, "functions"),
  path.join(DIST, "_worker.js"),
  path.join(DIST, "_routes.json"),
]) {
  try {
    await fs.access(forbidden);
    throw new Error("رفض النشر: يوجد ملف أو مجلد غير ثابت داخل dist: " + path.relative(DIST, forbidden));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log("Pages Free static build validation passed.");
console.log(JSON.stringify({
  siteFileCount: report.siteFileCount,
  freeFileLimit: LIMIT,
  staticPagesMode: report.staticPagesMode,
  preRenderedPlacePages: report.preRenderedPlacePages,
  preRenderedPrayerPages: report.preRenderedPrayerPages,
  dynamicPlacePages: report.dynamicPlacePages,
  dynamicPrayerPages: report.dynamicPrayerPages,
}, null, 2));
