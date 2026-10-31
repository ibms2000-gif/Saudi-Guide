#!/usr/bin/env node
// مولّد الموقع الثابت: يقرأ data/*.json ويكتب ملفات HTML في dist/
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModel } from "../src/lib/data.mjs";
import { buildSitemap } from "../src/lib/sitemap.mjs";
import { SITE } from "../src/lib/config.mjs";
import { isPlacePageIndexable, placePath } from "../src/lib/place-page.mjs";
import {
  homePage,
  regionsIndexPage,
  regionPage,
  categoriesIndexPage,
  cityPage,
  cityCategoryPage,
  cityCategorySubPage,
  categoryNationalPage,
  categoryNationalSubPage,
  dataSourcesPage,
  weatherNoticePage,
  notFoundPage,
} from "../src/lib/pages.mjs";
import { calendarHomePage, annualEventPage, salarySchedulePage } from "../src/lib/calendar.mjs";
import { prayerTimesIndexPage } from "../src/lib/prayer-times.mjs";
import { benefitsIndexPage, benefitDetailPage } from "../src/lib/benefits.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "..");

export async function build({ root = DEFAULT_ROOT, dataRoot = root, distDir, allowEmptyData = process.env.ALLOW_EMPTY_DATA === "true" } = {}) {
  const ROOT = root;
  const DIST = distDir || path.join(ROOT, "dist");
  const model = await loadModel(dataRoot);
  const citiesWithData = model.cities.filter((city) => city.totalPlaces > 0).length;
  const totalPlaces = model.cities.reduce((sum, city) => sum + city.totalPlaces, 0);
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
  add("/legal/weather-notice/", weatherNoticePage());

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
  add("/benefits/", benefitsIndexPage(model.benefits));
  for (const benefit of model.benefits) {
    add(`/benefits/${benefit.slug}/`, benefitDetailPage(benefit));
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

  // خريطة الموقع: الصفحات الثابتة وصفحات الأماكن والمواقيت المؤهلة فقط.
  const indexablePaths = [
    ...pages.filter((p) => p.indexable).map((p) => p.urlPath),
    ...placePaths,
    ...prayerPaths,
  ];
  await fs.writeFile(path.join(DIST, "sitemap.xml"), buildSitemap(indexablePaths));

  // robots.txt
  await fs.writeFile(
    path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`,
  );

  // نسخ الملفات الثابتة ولقطات بيانات الأماكن التي يقرأها Worker عند طلب صفحة مكان.
  await copyDir(path.join(ROOT, "public"), DIST);
  await copyDir(path.join(dataRoot, "data", "places"), path.join(DIST, "data", "places"));
  await fs.mkdir(path.join(DIST, "styles"), { recursive: true });
  await fs.copyFile(path.join(ROOT, "src/styles/site.css"), path.join(DIST, "styles/site.css"));
  await fs.copyFile(path.join(ROOT, "src/client/app.js"), path.join(DIST, "app.js"));

  const report = {
    generatedAt: new Date().toISOString(),
    totalPages: pages.length,
    indexablePages: indexablePaths.length,
    cities: model.cities.length,
    citiesWithData: model.cities.filter((c) => c.totalPlaces > 0).length,
    totalPlaceRecords: model.cities.reduce((sum, city) => sum + city.totalPlaces, 0),
    dynamicPlacePages: model.cities.reduce((sum, city) => sum + city.places.filter((place) => placePath(city.slug, place)).length, 0),
    indexablePlacePages: placePaths.length,
    dynamicPrayerPages: prayerPaths.length,
    totalIndexableUrls: indexablePaths.length,
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
