import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

async function makeFixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sg-build-test-"));

  await fs.mkdir(path.join(root, "data/places"), { recursive: true });
  await fs.mkdir(path.join(root, "public"), { recursive: true });
  await fs.mkdir(path.join(root, "src/styles"), { recursive: true });
  await fs.mkdir(path.join(root, "src/client"), { recursive: true });

  const regions = [{ slug: "test-region", nameAr: "منطقة تجريبية" }];
  const categories = [
    {
      slug: "restaurants",
      nameAr: "مطاعم",
      singularAr: "مطعم",
      minForPage: 4,
      osmQueries: ["amenity=restaurant", "amenity=cafe"],
      subcategories: [{ slug: "coffee", nameAr: "قهوة", match: { amenity: ["cafe"] } }],
    },
  ];
  const cities = [
    {
      slug: "city-with-data",
      nameAr: "مدينة فيها بيانات",
      regionSlug: "test-region",
      regionAr: "منطقة تجريبية",
      latitude: 24.0,
      longitude: 46.0,
      radius: 5000,
      overview: "مدينة تجريبية للاختبار.",
    },
    {
      slug: "city-without-data",
      nameAr: "مدينة بلا بيانات كافية",
      regionSlug: "test-region",
      regionAr: "منطقة تجريبية",
      latitude: 25.0,
      longitude: 47.0,
      radius: 5000,
      overview: "مدينة تجريبية أخرى.",
    },
  ];

  const richPlaces = [
    { id: "p1", name: "مطعم واحد", categorySlug: "restaurants", subcategorySlug: null, lat: 24, lon: 46 },
    { id: "p2", name: "مطعم اثنان", categorySlug: "restaurants", subcategorySlug: null, lat: 24, lon: 46 },
    { id: "p3", name: "مقهى واحد", categorySlug: "restaurants", subcategorySlug: "coffee", lat: 24, lon: 46 },
    { id: "p4", name: "مقهى اثنان", categorySlug: "restaurants", subcategorySlug: "coffee", lat: 24, lon: 46 },
    { id: "p5", name: "مقهى ثلاثة", categorySlug: "restaurants", subcategorySlug: "coffee", lat: 24, lon: 46 },
  ];
  const sparsePlaces = [
    { id: "q1", name: "مطعم فقير أول", categorySlug: "restaurants", subcategorySlug: null, lat: 25, lon: 47 },
  ];

  await fs.writeFile(path.join(root, "data/regions.json"), JSON.stringify(regions));
  await fs.writeFile(path.join(root, "data/categories.json"), JSON.stringify(categories));
  await fs.writeFile(path.join(root, "data/cities.json"), JSON.stringify(cities));
  await fs.writeFile(path.join(root, "data/places/city-with-data.json"), JSON.stringify(richPlaces));
  await fs.writeFile(path.join(root, "data/places/city-without-data.json"), JSON.stringify(sparsePlaces));
  await fs.writeFile(
    path.join(root, "data/places/_meta.json"),
    JSON.stringify({ fetchedAt: new Date().toISOString(), source: "overpass", cities: {} }),
  );

  await fs.cp(path.join(REPO_ROOT, "public"), path.join(root, "public"), { recursive: true });
  await fs.cp(path.join(REPO_ROOT, "src/styles/site.css"), path.join(root, "src/styles/site.css"));
  await fs.cp(path.join(REPO_ROOT, "src/client/app.js"), path.join(root, "src/client/app.js"));

  return root;
}

test("البناء ينتج صفحات ويحترم عتبة الفهرسة وإسناد المصدر وغياب محتوى الطقس", async (t) => {
  const root = await makeFixtureRoot();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const report = await build({ root });
  const dist = path.join(root, "dist");

  assert.ok(report.totalPages > 0);

  // الصفحة الرئيسية موجودة
  const home = await fs.readFile(path.join(dist, "index.html"), "utf8");
  assert.match(home, /دليل/);

  // صفحة مدينة بها بيانات كافية تحتوي قسم المطاعم وإسناد المصدر
  const cityCategory = await fs.readFile(
    path.join(dist, "city/city-with-data/restaurants/index.html"),
    "utf8",
  );
  assert.match(cityCategory, /OpenStreetMap/);
  assert.match(cityCategory, /ODbL|رخصة/);

  // الفئة الفرعية (قهوة) تولدت لأنها بلغت 3 عناصر
  const sub = await fs.readFile(
    path.join(dist, "city/city-with-data/restaurants/coffee/index.html"),
    "utf8",
  );
  assert.match(sub, /قهوة/);

  // مدينة ببيانات أقل من العتبة: لا تُولَّد صفحة فئة restaurants لها
  await assert.rejects(
    fs.readFile(path.join(dist, "city/city-without-data/restaurants/index.html"), "utf8"),
  );

  // لا صفحة واحدة (غير صفحة سياسة الطقس) تذكر درجات الحرارة
  const allFiles = await walk(dist);
  for (const file of allFiles) {
    if (!file.endsWith(".html")) continue;
    const content = await fs.readFile(file, "utf8");
    if (file.includes("weather-notice")) continue;
    assert.doesNotMatch(content, /درجة الحرارة|توقعات الطقس الحالية|حالة الطقس الآن/, `وُجد محتوى طقس حيّ في ${file}`);
  }

  // خريطة الموقع لا تحتوي مسار فئة المدينة التي لم تبلغ العتبة
  const sitemap = await fs.readFile(path.join(dist, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /city-without-data\/restaurants/);
  assert.match(sitemap, /city-with-data\/restaurants/);

  // 404 وrobots.txt موجودان
  await fs.readFile(path.join(dist, "404.html"), "utf8");
  const robots = await fs.readFile(path.join(dist, "robots.txt"), "utf8");
  assert.match(robots, /Sitemap:/);
});

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}
