#!/usr/bin/env node
// مولّد الموقع الثابت: يقرأ data/*.json ويكتب ملفات HTML في dist/
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModel } from "../src/lib/data.mjs";
import { buildSitemapBundle } from "../src/lib/sitemap.mjs";
import { SITE } from "../src/lib/config.mjs";
import { isPlacePageIndexable, placePath } from "../src/lib/place-page.mjs";
import {
  homePage,
  regionsIndexPage,
  regionPage,
  categoriesIndexPage,
  cityPage,
  neighbourhoodPage,
  cityCategoryPage,
  cityCategorySubPage,
  categoryNationalPage,
  categoryNationalSubPage,
  dataSourcesPage,
  weatherNoticePage,
  notFoundPage,
} from "../src/lib/pages.mjs";
import { calendarHomePage, annualEventPage, salarySchedulePage } from "../src/lib/calendar.mjs";
import { prayerTimesIndexPage, prayerTimesPage } from "../src/lib/prayer-times.mjs";
import { renderPlacePage } from "../src/lib/place-page.mjs";
import { benefitsIndexPage, benefitDetailPage } from "../src/lib/benefits.mjs";
import { statisticsIndexPage, statisticDetailPage } from "../src/lib/statistics.mjs";
import { newsIndexPage, newsRegionPage, newsDetailPage } from "../src/lib/news.mjs";
import { toolsIndexPage, toolPages } from "../src/lib/tools.mjs";
import { loadOfficialHealthCenters, officialHealthCentersIndexPage, officialHealthCentersRegionPage } from "../src/lib/official-health-centers.mjs";
import { loadOfficialMentalHealthHospitals, officialMentalHealthHospitalsPage } from "../src/lib/official-mental-health-hospitals.mjs";
import { officialDirectoriesPage } from "../src/lib/official-directories.mjs";
import { officialRehabilitationPage } from "../src/lib/official-rehabilitation.mjs";
import { officialHealthWorkingHoursPage } from "../src/lib/official-health-working-hours.mjs";
import { loadOfficialEducationStatistics, officialEducationPage } from "../src/lib/official-education.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "..");
const STATIC_PAGES_BUILD = process.env.STATIC_PAGES_BUILD === "true";
const PAGES_FREE_FILE_LIMIT = 20_000;

export async function build({ root = DEFAULT_ROOT, dataRoot = root, distDir, allowEmptyData = process.env.ALLOW_EMPTY_DATA === "true" } = {}) {
  const ROOT = root;
  const DIST = distDir || path.join(ROOT, "dist");
  const model = await loadModel(dataRoot);
  const citiesWithData = model.cities.filter((city) => city.totalPlaces > 0).length;
  const totalPlaces = model.cities.reduce((sum, city) => sum + city.totalPlaces, 0);
  const officialHealthCenters = await loadOfficialHealthCenters(dataRoot);
  const officialMentalHealthHospitals = await loadOfficialMentalHealthHospitals(dataRoot);
  const officialEducationStatistics = await loadOfficialEducationStatistics(dataRoot);
  if (!allowEmptyData && (citiesWithData < 5 || totalPlaces < 50)) {
    throw new Error(
      `رفض بناء نسخة الإنتاج: بيانات الأماكن غير كافية (${totalPlaces} مكانًا في ${citiesWithData} مدن). ` +
      "شغّل npm run data ثم npm run validate:data. للمعاينة المحلية فقط، استخدم ALLOW_EMPTY_DATA=true.",
    );
  }
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  const pages = []; // { urlPath, html, indexable }

  const add = (urlPath, html, indexable = true) => pages.push({ urlPath, html, indexable });

  add("/", homePage(model));
  add("/regions/", regionsIndexPage(model));
  add("/categories/", categoriesIndexPage(model));
  add("/about/data-sources/", dataSourcesPage(model));
  add("/official-directories/", officialDirectoriesPage());
  add("/health/rehabilitation/", officialRehabilitationPage());
  add("/health/working-hours/", officialHealthWorkingHoursPage());
  if (officialEducationStatistics) add("/education/", officialEducationPage(officialEducationStatistics));
  add("/legal/weather-notice/", weatherNoticePage());
  if (officialHealthCenters?.pages.length) {
    add("/health/on-duty/", officialHealthCentersIndexPage(officialHealthCenters));
    for (const page of officialHealthCenters.pages) {
      add(`/health/on-duty/${encodeURIComponent(page.slug)}/`, officialHealthCentersRegionPage(officialHealthCenters, page));
    }
  }
  if (officialMentalHealthHospitals?.facilities.length) {
    add("/health/mental-health-hospitals/", officialMentalHealthHospitalsPage(officialMentalHealthHospitals));
  }

  // تقويم المناسبات والمواعيد الرسمية الموثقة.
  add("/calendar/", calendarHomePage({
    events: model.events,
    salarySchedules: model.salarySchedules,
  }));
  for (const event of model.events) {
    if (event.kind === "fixed-annual" && event.status === "official") {
      add(`/calendar/events/${event.slug}/`, annualEventPage(event));
    }
  }
  for (const schedule of model.salarySchedules) {
    add(`/calendar/salaries/${schedule.year}/`, salarySchedulePage(schedule));
  }
  add("/prayer-times/", prayerTimesIndexPage(model.cities));
  add("/tools/", toolsIndexPage());
  for (const tool of toolPages()) add(tool.path, tool.html);
  add("/benefits/", benefitsIndexPage(model.benefits));
  for (const benefit of model.benefits) {
    add(`/benefits/${benefit.slug}/`, benefitDetailPage(benefit));
  }

  // مؤشرات إحصائية موثقة للفترة والنطاق والمصدر.
  const qualifiedStatistics = model.statistics.filter((item) =>
    item && /^[a-z0-9-]+$/.test(String(item.slug || "")) &&
    item.titleAr && item.value !== undefined && item.periodAr &&
    item.summaryAr && item.sourceUrl && item.sourceName && item.verifiedAt
  );
  add("/statistics/", statisticsIndexPage(qualifiedStatistics), qualifiedStatistics.length > 0);
  for (const item of qualifiedStatistics) {
    add(`/statistics/${item.slug}/`, statisticDetailPage(item));
  }

  // الأخبار تعرض ملخصًا تحريريًا أصليًا ورابطًا للمصدر؛ لا ننسخ محتوى المصدر أو صوره.
  const qualifiedNews = model.news.filter((item) =>
    item && /^[a-z0-9-]+$/.test(String(item.slug || "")) &&
    item.titleAr && item.summaryAr && item.localContextAr &&
    item.publishedAt && item.sourceName && item.sourceUrl && item.verifiedAt
  );
  add("/news/", newsIndexPage(qualifiedNews), qualifiedNews.length > 0);
  for (const item of qualifiedNews) {
    add(`/news/${item.slug}/`, newsDetailPage(item));
  }
  for (const region of model.regions) {
    const regionNews = qualifiedNews.filter((item) => item.regionSlug === region.slug);
    // لا ننشئ صفحة منطقة إلا عند وجود خبرين أو أكثر لتجنب الصفحات الرقيقة.
    if (regionNews.length >= 2) {
      add(`/news/region/${region.slug}/`, newsRegionPage(region, regionNews));
    }
  }

  for (const region of model.regions) {
    add(`/region/${region.slug}/`, regionPage(model, region));
  }

  for (const category of model.categories) {
    const cities = model.nationalByCategory[category.slug];
    add(`/category/${category.slug}/`, categoryNationalPage(model, category), cities.length > 0);

    for (const sub of category.subcategories || []) {
      const subCities = cities.filter((c) => c.byCategory[category.slug].subcategories[sub.slug]);
      // National subcategory hubs need coverage in multiple cities to provide real value.
      if (subCities.length < 2) continue;
      add(
        `/category/${category.slug}/${sub.slug}/`,
        categoryNationalSubPage(model, category, sub, subCities),
      );
    }
  }

  for (const city of model.cities) {
    add(`/city/${city.slug}/`, cityPage(model, city), city.totalPlaces >= 5);

    for (const neighbourhood of city.neighbourhoods || []) {
      if (!neighbourhood.indexable) continue;
      add(
        `/city/${city.slug}/neighbourhood/${encodeURIComponent(neighbourhood.slug)}/`,
        neighbourhoodPage(model, city, neighbourhood),
      );
    }

    for (const category of model.categories) {
      const data = city.byCategory[category.slug];
      if (!data.indexable) continue;
      add(`/city/${city.slug}/${category.slug}/`, cityCategoryPage(model, city, category));

      for (const [subSlug, places] of Object.entries(data.subcategories)) {
        const sub = category.subcategories.find((s) => s.slug === subSlug);
        add(
          `/city/${city.slug}/${category.slug}/${subSlug}/`,
          cityCategorySubPage(model, city, category, sub, places),
        );
      }
    }
  }

  for (const { urlPath, html, indexable } of pages) {
    const filePath = path.join(DIST, urlPath.replace(/^\//, ""), "index.html");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    // Pages retained for navigation but lacking enough data must not index.
    const outputHtml = indexable
      ? html
      : html.replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex, follow">');
    await fs.writeFile(filePath, outputHtml);
  }

  // صفحة 404
  await fs.writeFile(path.join(DIST, "404.html"), notFoundPage());

  // صفحات الأماكن تُعرض ديناميكيًا عبر Worker؛ لا ننشئ ملف HTML مستقل لكل سجل.
  // لا نضيف إلى sitemap إلا السجلات التي اجتازت بوابة جودة صفحة المكان.
  const placePaths = model.cities.flatMap((city) =>
    city.places
      .filter(isPlacePageIndexable)
      .map((place) => placePath(city.slug, place))
      .filter(Boolean),
  );

  // صفحات مواقيت الصلاة تُعرض ديناميكيًا حسب تاريخ الطلب وتوقيت السعودية.
  const prayerPaths = model.cities
    .filter((city) =>
      Number.isFinite(Number(city.latitude)) &&
      Number.isFinite(Number(city.longitude)),
    )
    .map((city) => `/prayer-times/${city.slug}/`);

  // في وضع Pages الثابت نولّد صفحات الأماكن والمواقيت كملفات HTML فعلية؛ لا نحتاج Worker أو Functions.
  if (STATIC_PAGES_BUILD) {
    const categoryBySlug = new Map(model.categories.map((category) => [category.slug, category]));
    for (const city of model.cities) {
      const fetchedAt = model.meta?.cities?.[city.slug]?.fetchedAt || null;
      for (const place of city.places) {
        const urlPath = placePath(city.slug, place);
        if (!urlPath) continue;
        const html = renderPlacePage({
          place,
          city,
          category: categoryBySlug.get(place.categorySlug) || null,
          siteUrl: SITE.url,
          fetchedAt,
        });
        add(urlPath, html, isPlacePageIndexable(place));
      }
      if (Number.isFinite(Number(city.latitude)) && Number.isFinite(Number(city.longitude))) {
        add(`/prayer-times/${city.slug}/`, prayerTimesPage(city, new Date(), { includeSchedule: true }));
      }
    }
  }

  // خريطة الموقع لا تكرر روابط صفحات الأماكن/المواقيت المولدة مسبقًا.
  const indexablePaths = [
    ...pages.filter((p) => p.indexable).map((p) => p.urlPath),
    ...(STATIC_PAGES_BUILD ? [] : placePaths),
    ...(STATIC_PAGES_BUILD ? [] : prayerPaths),
  ];
  const sitemapBundle = buildSitemapBundle(indexablePaths);
  await fs.writeFile(path.join(DIST, "sitemap.xml"), sitemapBundle.index);
  for (const sitemapFile of sitemapBundle.files) {
    const sitemapPath = path.join(DIST, sitemapFile.path.replace(/^\//, ""));
    await fs.mkdir(path.dirname(sitemapPath), { recursive: true });
    await fs.writeFile(sitemapPath, sitemapFile.content);
  }

  // robots.txt
  await fs.writeFile(
    path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`,
  );

  // نسخ الأصول العامة. ملفات JSON للأماكن مطلوبة فقط لوضع Worker الديناميكي؛ Pages يستخدم HTML المسبق فقط.
  await copyDir(path.join(ROOT, "public"), DIST);
  if (!STATIC_PAGES_BUILD) {
    await copyDir(path.join(dataRoot, "data", "places"), path.join(DIST, "data", "places"));
  }
  await fs.mkdir(path.join(DIST, "styles"), { recursive: true });
  await fs.copyFile(path.join(ROOT, "src/styles/site.css"), path.join(DIST, "styles/site.css"));
  await fs.copyFile(path.join(ROOT, "src/client/app.js"), path.join(DIST, "app.js"));
  if (STATIC_PAGES_BUILD) {
    await fs.copyFile(path.join(ROOT, "src/client/prayer-times.js"), path.join(DIST, "prayer-times.js"));
  }
  await fs.copyFile(path.join(ROOT, "src/client/tools.js"), path.join(DIST, "tools.js"));
  await fs.copyFile(path.join(ROOT, "src/lib/tool-calculations.mjs"), path.join(DIST, "tool-calculations.mjs"));

  const siteFileCount = STATIC_PAGES_BUILD ? (await countFiles(DIST)) + 1 : null;
  if (STATIC_PAGES_BUILD && siteFileCount > PAGES_FREE_FILE_LIMIT) {
    throw new Error(`رفض نشر Pages المجاني: ${siteFileCount} ملفًا يتجاوز حد ${PAGES_FREE_FILE_LIMIT} ملف.`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    staticPagesMode: STATIC_PAGES_BUILD,
    siteFileCount,
    totalPages: pages.length,
    indexablePages: indexablePaths.length,
    cities: model.cities.length,
    citiesWithData: model.cities.filter((c) => c.totalPlaces > 0).length,
    totalPlaceRecords: model.cities.reduce((sum, city) => sum + city.totalPlaces, 0),
    dynamicPlacePages: STATIC_PAGES_BUILD ? 0 : model.cities.reduce((sum, city) => sum + city.places.filter((place) => placePath(city.slug, place)).length, 0),
    preRenderedPlacePages: STATIC_PAGES_BUILD ? model.cities.reduce((sum, city) => sum + city.places.filter((place) => placePath(city.slug, place)).length, 0) : 0,
    indexablePlacePages: placePaths.length,
    dynamicPrayerPages: STATIC_PAGES_BUILD ? 0 : prayerPaths.length,
    preRenderedPrayerPages: STATIC_PAGES_BUILD ? model.cities.filter((city) => Number.isFinite(Number(city.latitude)) && Number.isFinite(Number(city.longitude))).length : 0,
    neighbourhoodPages: model.cities.reduce((sum, city) => sum + (city.totalNeighbourhoods || 0), 0),
    neighbourhoodsByCity: Object.fromEntries(model.cities.map((city) => [city.slug, city.totalNeighbourhoods || 0]).filter(([, count]) => count > 0)),
    officialHealthCenterPages: officialHealthCenters?.pages.length || 0,
    officialHealthCenterRecords: officialHealthCenters?.pages.reduce((sum, page) => sum + page.centers.length, 0) || 0,
    officialMentalHealthHospitalPages: officialMentalHealthHospitals?.facilities.length ? 1 : 0,
    officialMentalHealthHospitalRecords: officialMentalHealthHospitals?.facilities.length || 0,
    statisticsPages: 1 + qualifiedStatistics.length,
    newsPages: 1 + qualifiedNews.length + model.regions.filter((region) => qualifiedNews.filter((item) => item.regionSlug === region.slug).length >= 2).length,
    totalIndexableUrls: indexablePaths.length,
    sitemapFileCount: sitemapBundle.files.length || 1,
    sitemapShards: sitemapBundle.files.map((file) => ({ path: file.path, urlCount: file.urlCount })),
    byCategory: Object.fromEntries(
      model.categories.map((cat) => [
        cat.slug,
        model.cities.reduce((sum, c) => sum + c.byCategory[cat.slug].all.length, 0),
      ]),
    ),
  };
  await fs.writeFile(path.join(DIST, "_build-report.json"), JSON.stringify(report, null, 2));
  return report;
}

async function countFiles(directory) {
  let count = 0;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) count += await countFiles(entryPath);
    else count += 1;
  }
  return count;
}

async function copyDir(src, dest) {
  let entries;
  try {
    entries = await fs.readdir(src, { withFileTypes: true });
  } catch {
    return;
  }
  await fs.mkdir(dest, { recursive: true });
  for (const entry of entries) {
    if (entry.name === ".assetsignore") continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(d, { recursive: true });
      await copyDir(s, d);
    } else {
      await fs.copyFile(s, d);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await build();
  console.log(`تم بناء ${report.totalPages} صفحة (${report.indexablePages} قابلة للفهرسة).`);
  console.log(`مدن تحتوي بيانات: ${report.citiesWithData} من ${report.cities}.`);
  console.log("تفاصيل حسب القسم:", report.byCategory);
}
