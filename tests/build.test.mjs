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
  await fs.mkdir(path.join(root, "src/lib"), { recursive: true });

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
    {
      slug: "health",
      nameAr: "صحة",
      singularAr: "مرفق صحي",
      minForPage: 4,
      osmQueries: ["amenity=clinic"],
      subcategories: [],
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
    { id: "p1", name: "مطعم واحد", categorySlug: "restaurants", subcategorySlug: null, osmType: "node", osmId: 100, lat: 24, lon: 46, address: "شارع الاختبار", phone: "+966 50 123 4567", neighbourhood: "حي الاختبار", neighbourhoodSourceTag: "addr:neighbourhood" },
    { id: "p2", name: "مطعم اثنان", categorySlug: "restaurants", subcategorySlug: null, lat: 24, lon: 46, neighbourhood: "حي الاختبار" },
    { id: "p3", name: "مقهى واحد", categorySlug: "restaurants", subcategorySlug: "coffee", lat: 24, lon: 46, neighbourhood: "حي الاختبار" },
    { id: "p4", name: "مقهى اثنان", categorySlug: "restaurants", subcategorySlug: "coffee", lat: 24, lon: 46, neighbourhood: "حي الاختبار" },
    { id: "p5", name: "مقهى ثلاثة", categorySlug: "restaurants", subcategorySlug: "coffee", lat: 24, lon: 46, neighbourhood: "حي الاختبار" },
    { id: "s1", name: "عيادة واحد", categorySlug: "health", subcategorySlug: null, lat: 24, lon: 46, neighbourhood: "حي الاختبار" },
    { id: "s2", name: "عيادة اثنان", categorySlug: "health", subcategorySlug: null, lat: 24, lon: 46, neighbourhood: "حي الاختبار" },
    { id: "s3", name: "عيادة ثلاثة", categorySlug: "health", subcategorySlug: null, lat: 24, lon: 46, neighbourhood: "حي الاختبار" },
    { id: "s4", name: "عيادة أربعة", categorySlug: "health", subcategorySlug: null, lat: 24, lon: 46, neighbourhood: "حي الاختبار" },
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
  await fs.mkdir(path.join(root, "data/paydays"), { recursive: true });
  await fs.writeFile(
    path.join(root, "data/events.json"),
    JSON.stringify([{
      slug: "founding-day",
      nameAr: "يوم التأسيس",
      descriptionAr: "مناسبة وطنية للاختبار.",
      month: 2,
      day: 22,
      kind: "fixed-annual",
      status: "official",
      sourceName: "مصدر تجريبي",
      sourceUrl: "https://example.com/source",
      scopeAr: "السعودية"
    }]),
  );
  await fs.writeFile(
    path.join(root, "data/paydays/2026.json"),
    JSON.stringify({
      year: 2026,
      nameAr: "رواتب 2026",
      statusAr: "جدول اختبار",
      descriptionAr: "جدول تجريبي.",
      sourceName: "مصدر تجريبي",
      sourceUrl: "https://example.com/payday",
      dates: [{ month: 11, date: "2026-11-26", weekdayAr: "الخميس", hijri: "1448/06/16" }]
    }),
  );
  await fs.writeFile(
    path.join(root, "data/benefits.json"),
    JSON.stringify([{
      slug: "social-security",
      nameAr: "الضمان الاجتماعي المطور",
      categoryAr: "الدعم الحكومي",
      summaryAr: "ملخص تجريبي.",
      introAr: "مقدمة تجريبية.",
      keyPoints: ["نقطة اختبار"],
      steps: ["خطوة اختبار"],
      timingTitleAr: "موعد الصرف",
      timingAr: "معلومة موعد تجريبية.",
      cautions: ["تنبيه اختبار"],
      serviceName: "الخدمة الرسمية",
      serviceUrl: "https://example.com/service",
      verifiedAt: "2026-11-24",
      sources: [{ name: "مصدر رسمي", url: "https://example.com/source", role: "الأساس النظامي" }]
    }, {
      slug: "housing-support",
      nameAr: "الدعم السكني",
      categoryAr: "السكن والتمويل",
      summaryAr: "دليل تجريبي للسكن.",
      introAr: "مقدمة الدعم السكني.",
      keyPoints: ["أن يكون المتقدم سعودي الجنسية وألا يقل عمره عن 25 سنة."],
      documents: ["بيانات الأسرة والملكية."],
      relatedTools: [{ slug: "installment-calculator", labelAr: "حاسبة القسط الشهري", descriptionAr: "تقدير القسط." }],
      steps: ["الدخول إلى سكني."],
      timingTitleAr: "التحقق",
      timingAr: "الخدمة فورية.",
      cautions: ["القرار النهائي للجهة."],
      serviceName: "سكني",
      serviceUrl: "https://sakani.sa/services/check-eligibility",
      verifiedAt: "2026-11-24",
      sources: [{ name: "سكني", url: "https://sakani.sa/services/check-eligibility", role: "التحقق" }]
    }, {
      slug: "saned-unemployment",
      nameAr: "ساند",
      categoryAr: "التأمينات",
      summaryAr: "دليل ساند.",
      introAr: "تعويض التعطل.",
      keyPoints: ["التسجيل خلال 90 يومًا.", "60% ثم 50% من متوسط الأجر."],
      documents: ["بيانات الاشتراك."],
      steps: ["التحقق من الأهلية."],
      timingTitleAr: "المهلة",
      timingAr: "90 يومًا.",
      cautions: ["شروط الاشتراك تختلف."],
      serviceName: "ساند",
      serviceUrl: "https://www.gosi.gov.sa/GOSIOnline/SANED",
      verifiedAt: "2026-11-24",
      sources: [{ name: "التأمينات", url: "https://beta.gosi.gov.sa/saned", role: "النظام" }]
    }, {
      slug: "job-search-subsidy",
      nameAr: "إعانة البحث عن عمل",
      categoryAr: "التوظيف",
      summaryAr: "إعانة البحث عن عمل.",
      introAr: "دعم الباحثين عن عمل.",
      keyPoints: ["مدة الدعم 15 شهرًا.", "يبدأ الدعم بمبلغ 2000 ريال."],
      documents: ["بيانات التعليم والحساب البنكي."],
      steps: ["التقديم عبر هدف."],
      timingTitleAr: "مدة الدعم",
      timingAr: "15 شهرًا.",
      cautions: ["تطبق حدود الدخل."],
      serviceName: "هدف",
      serviceUrl: "https://www.hrdf.org.sa/products-and-services/programs/individuals/other/job-search-subsidy/apply/",
      verifiedAt: "2026-11-24",
      sources: [{ name: "هدف", url: "https://www.hrdf.org.sa/products-and-services/programs/individuals/other/job-search-subsidy/", role: "الشروط" }]
    }, {
      slug: "maternity-benefit",
      nameAr: "منفعة الأمومة",
      categoryAr: "التأمينات",
      summaryAr: "منفعة الأمومة.",
      introAr: "تعويض الولادة.",
      keyPoints: ["12 شهر اشتراك خلال 36 شهرًا.", "الصرف 3 أشهر."],
      documents: ["بيانات الاشتراك والأجر."],
      steps: ["متابعة الإشعار في التأمينات."],
      timingTitleAr: "موعد الصرف",
      timingAr: "بداية شهر الولادة.",
      cautions: ["لا تجمع مع الراتب."],
      serviceName: "منفعة الأمومة",
      serviceUrl: "https://beta.gosi.gov.sa/maternity-benefit",
      verifiedAt: "2026-11-24",
      sources: [{ name: "التأمينات", url: "https://beta.gosi.gov.sa/maternity-benefit", role: "الشروط" }]
    }, {
      slug: "retirement-pensions",
      nameAr: "التقاعد والتأمينات",
      categoryAr: "التقاعد",
      summaryAr: "أنظمة التقاعد.",
      introAr: "تختلف الأنظمة بحسب تاريخ الاشتراك.",
      keyPoints: ["النظام الجديد بدأ في 3 يوليو 2024.", "السن النظامية للمشمولين 65 سنة."],
      documents: ["بيانات مدة الاشتراك."],
      relatedTools: [{ slug: "gosi-deduction-calculator", labelAr: "حاسبة استقطاع التأمينات" }],
      steps: ["تحقق من الفئة النظامية."],
      timingTitleAr: "السن النظامية",
      timingAr: "65 سنة للمشمولين بالنظام الجديد.",
      cautions: ["المعادلات تختلف حسب النظام."],
      serviceName: "التأمينات",
      serviceUrl: "https://awareness.gosi.gov.sa/",
      verifiedAt: "2026-11-24",
      sources: [{ name: "التأمينات", url: "https://beta.gosi.gov.sa/new-system", role: "النظام الجديد" }]
    }]),
  );
  await fs.writeFile(
    path.join(root, "data/statistics.json"),
    JSON.stringify([{
      slug: "population-test",
      titleAr: "عدد السكان التجريبي",
      categoryAr: "السكان",
      value: "1000",
      unitAr: "نسمة",
      periodAr: "عام 2026",
      scopeAr: "مدينة تجريبية",
      summaryAr: "مؤشر سكاني للاختبار.",
      explanationAr: "شرح المؤشر.",
      howToReadAr: "طريقة القراءة.",
      sourceName: "هيئة تجريبية",
      sourceUrl: "https://example.com/stats",
      datasetUrl: "https://example.com/dataset",
      verifiedAt: "2026-10-31"
    }]),
  );
  await fs.writeFile(
    path.join(root, "data/news.json"),
    JSON.stringify([
      {
        slug: "test-region-first",
        titleAr: "خبر تجريبي أول",
        regionSlug: "test-region",
        regionNameAr: "منطقة تجريبية",
        categoryAr: "خدمات محلية",
        publishedAt: "2026-10-20",
        summaryAr: "ملخص أصلي للخبر الأول.",
        localContextAr: "سياق محلي للخبر الأول.",
        sourceName: "مصدر اختباري",
        sourceUrl: "https://example.com/news-1",
        verifiedAt: "2026-10-31",
        editorialNote: "ملخص تحريري مستقل."
      },
      {
        slug: "test-region-second",
        titleAr: "خبر تجريبي ثانٍ",
        regionSlug: "test-region",
        regionNameAr: "منطقة تجريبية",
        categoryAr: "خدمات محلية",
        publishedAt: "2026-10-19",
        summaryAr: "ملخص أصلي للخبر الثاني.",
        localContextAr: "سياق محلي للخبر الثاني.",
        sourceName: "مصدر اختباري",
        sourceUrl: "https://example.com/news-2",
        verifiedAt: "2026-10-31",
        editorialNote: "ملخص تحريري مستقل."
      }
    ]),
  );

  await fs.cp(path.join(REPO_ROOT, "public"), path.join(root, "public"), { recursive: true });
  await fs.cp(path.join(REPO_ROOT, "src/styles/site.css"), path.join(root, "src/styles/site.css"));
  await fs.cp(path.join(REPO_ROOT, "src/client/app.js"), path.join(root, "src/client/app.js"));
  await fs.cp(path.join(REPO_ROOT, "src/client/tools.js"), path.join(root, "src/client/tools.js"));
  await fs.cp(path.join(REPO_ROOT, "src/lib/tool-calculations.mjs"), path.join(root, "src/lib/tool-calculations.mjs"));

  return root;
}

test("البناء ينتج صفحات ويحترم عتبة الفهرسة وإسناد المصدر وغياب محتوى الطقس", async (t) => {
  const root = await makeFixtureRoot();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const report = await build({ root, allowEmptyData: true });
  const dist = path.join(root, "dist");

  assert.ok(report.totalPages > 0);

  // أدوات وحاسبات الموقع: فهرس وصفحات مستقلة قابلة للفهرسة.
  const toolsIndex = await fs.readFile(path.join(dist, "tools/index.html"), "utf8");
  assert.match(toolsIndex, /أدوات وحاسبات مجانية/);
  assert.match(toolsIndex, /حاسبة ضريبة القيمة المضافة/);
  const vatTool = await fs.readFile(path.join(dist, "tools/vat-calculator/index.html"), "utf8");
  assert.match(vatTool, /data-tool-calculator="vat-calculator"/);
  assert.match(vatTool, /name="mode"/);
  assert.ok(vatTool.includes("type=\"module\" src=\"/tools.js\""));
  assert.match(vatTool, /tools.js/);
  const installmentTool = await fs.readFile(path.join(dist, "tools/installment-calculator/index.html"), "utf8");
  assert.match(installmentTool, /معدل النسبة السنوي/);
  const toolsScript = await fs.readFile(path.join(dist, "tools.js"), "utf8");
  assert.match(toolsScript, /calculateTool/);
  const calculationsScript = await fs.readFile(path.join(dist, "tool-calculations.mjs"), "utf8");
  assert.match(calculationsScript, /debt-ratio-calculator/);
  const eosTool = await fs.readFile(path.join(dist, "tools/end-of-service-calculator/index.html"), "utf8");
  assert.match(eosTool, /name="reason"/);
  assert.match(eosTool, /المصادر الرسمية/);
  assert.match(eosTool, /www.hrsd.gov.sa/);
  const overtimeTool = await fs.readFile(path.join(dist, "tools/overtime-calculator/index.html"), "utf8");
  assert.match(overtimeTool, /الأجر الشهري الفعلي/);
  const sickLeaveTool = await fs.readFile(path.join(dist, "tools/sick-leave-calculator/index.html"), "utf8");
  assert.match(sickLeaveTool, /المادة 117/);
  const gosiTool = await fs.readFile(path.join(dist, "tools/gosi-deduction-calculator/index.html"), "utf8");
  assert.match(gosiTool, /name="scheme"/);
  const noticeTool = await fs.readFile(path.join(dist, "tools/notice-compensation-calculator/index.html"), "utf8");
  assert.match(noticeTool, /مهلة الإشعار/);



  const rettTool = await fs.readFile(path.join(dist, "tools/real-estate-transfer-tax-calculator/index.html"), "utf8");
  assert.match(rettTool, /5%/);
  assert.match(rettTool, /www.zatca.gov.sa/);
  const cashZakatTool = await fs.readFile(path.join(dist, "tools/cash-zakat-calculator/index.html"), "utf8");
  assert.match(cashZakatTool, /قيمة النصاب/);
  const tradeZakatTool = await fs.readFile(path.join(dist, "tools/trade-zakat-calculator/index.html"), "utf8");
  assert.match(tradeZakatTool, /القيمة السوقية الحالية للبضائع/);
  const goldZakatTool = await fs.readFile(path.join(dist, "tools/gold-zakat-calculator/index.html"), "utf8");
  assert.match(goldZakatTool, /85 جرامًا/);
  const socialSecurityTool = await fs.readFile(path.join(dist, "tools/social-security-income-calculator/index.html"), "utf8");
  assert.match(socialSecurityTool, /عدد التابعين الإضافيين/);
  assert.match(socialSecurityTool, /1320/);
  assert.match(socialSecurityTool, /www.hrsd.gov.sa/);

  const sanedTool = await fs.readFile(path.join(dist, "tools/saned-compensation-calculator/index.html"), "utf8");
  assert.match(sanedTool, /متوسط الأجر الخاضع للاشتراك/);
  assert.match(sanedTool, /9,000/);
  assert.match(sanedTool, /beta.gosi.gov.sa/);

  const jobSearchTool = await fs.readFile(path.join(dist, "tools/job-search-subsidy-planner/index.html"), "utf8");
  assert.match(jobSearchTool, /عدد الدفعات التي سبق صرفها/);
  assert.match(jobSearchTool, /2,000 ريال/);
  assert.match(jobSearchTool, /hrdf.org.sa/);

  const retirementTool = await fs.readFile(path.join(dist, "tools/new-retirement-pension-calculator/index.html"), "utf8");
  assert.match(retirementTool, /2.25%/);
  assert.match(retirementTool, /100% من متوسط الأجر/);
  assert.match(retirementTool, /beta.gosi.gov.sa/);

  const maternityTool = await fs.readFile(path.join(dist, "tools/maternity-benefit-calculator/index.html"), "utf8");
  assert.match(maternityTool, /متوسط الأجر الشهري الخاضع للاشتراك/);
  assert.match(maternityTool, /أربعة أشهر/);
  assert.match(maternityTool, /cmsgosi.gosi.gov.sa/);

  const citizenPlannerTool = await fs.readFile(path.join(dist, "tools/citizen-account-budget-calculator/index.html"), "utf8");
  assert.match(citizenPlannerTool, /مبلغ الدعم الشهري من الحاسبة الرسمية/);
  assert.match(citizenPlannerTool, /portal.ca.gov.sa/);
  const samaTool = await fs.readFile(path.join(dist, "tools/sama-affordability-calculator/index.html"), "utf8");
  assert.match(samaTool, /33.33%/);
  assert.match(samaTool, /rulebook.sama.gov.sa/);
  const financeAmountTool = await fs.readFile(path.join(dist, "tools/finance-amount-from-payment-calculator/index.html"), "utf8");
  assert.match(financeAmountTool, /القسط الشهري الذي تستطيع تحمله/);
  const propertyCostTool = await fs.readFile(path.join(dist, "tools/real-estate-purchase-cost-calculator/index.html"), "utf8");
  assert.match(propertyCostTool, /عمولة الوساطة المتفق عليها/);

  // الصفحة الرئيسية موجودة
  const home = await fs.readFile(path.join(dist, "index.html"), "utf8");
  assert.match(home, /دليل/);

  // صفحات المدن تعرض مؤشرات مشتقة من السجلات الفعلية وروابط المنطقة مع توضيح حدود البيانات.
  const cityGuide = await fs.readFile(path.join(dist, "city/city-with-data/index.html"), "utf8");
  assert.match(cityGuide, /مؤشرات تغطية الدليل/);
  assert.match(cityGuide, /أماكن مسجلة في المصدر/);
  assert.match(cityGuide, /أقسام بلغت حد إنشاء صفحة/);
  assert.match(cityGuide, /أقسام الأكثر ظهورًا في البيانات/);
  assert.match(cityGuide, /5 مكان مسجل في البيانات الحالية/);
  assert.match(cityGuide, /أماكن تتوفر لها تفاصيل إضافية/);
  assert.match(cityGuide, /مدينة بلا بيانات كافية/);
  assert.match(cityGuide, /OpenStreetMap/);
  assert.match(cityGuide, /لا تمثل حصرًا رسميًا/);
  assert.match(cityGuide, /أحياء تستوفي شروط صفحة مستقلة/);
  assert.match(cityGuide, /حي الاختبار/);
  assert.ok(cityGuide.includes("/city/city-with-data/neighbourhood/%D8%AD%D9%8A-%D8%A7%D9%84%D8%A7%D8%AE%D8%AA%D8%A8%D8%A7%D8%B1/"));
  const neighbourhoodPage = await fs.readFile(
    path.join(dist, "city/city-with-data/neighbourhood", encodeURIComponent("حي-الاختبار"), "index.html"),
    "utf8",
  );
  assert.match(neighbourhoodPage, /دليل حي الاختبار في مدينة فيها بيانات/);
  assert.match(neighbourhoodPage, /9 مكانًا/);
  assert.match(neighbourhoodPage, /مطاعم \(5\)/);
  assert.match(neighbourhoodPage, /صحة \(4\)/);
  assert.match(neighbourhoodPage, /عيادة أربعة/);

  const calendar = await fs.readFile(path.join(dist, "calendar/index.html"), "utf8");
  assert.match(calendar, /التقويم السعودي/);
  assert.match(calendar, /يوم التأسيس/);
  assert.match(calendar, /رواتب/);

  const eventPage = await fs.readFile(
    path.join(dist, "calendar/events/founding-day/index.html"),
    "utf8",
  );
  assert.match(eventPage, /data-countdown-target/);
  assert.ok(eventPage.includes("https://example.com/source"));

  const salaryPage = await fs.readFile(
    path.join(dist, "calendar/salaries/2026/index.html"),
    "utf8",
  );
  assert.match(salaryPage, /2026-11-26/);
  const prayerIndex = await fs.readFile(path.join(dist, "prayer-times/index.html"), "utf8");
  assert.match(prayerIndex, /مواقيت الصلاة في مدن المملكة/);
  assert.match(prayerIndex, /city-with-data/);
  assert.ok(report.dynamicPrayerPages >= 2);

  const benefitsIndex = await fs.readFile(path.join(dist, "benefits/index.html"), "utf8");
  assert.match(benefitsIndex, /الدعم الحكومي والمنافع في السعودية/);
  assert.match(benefitsIndex, /الضمان الاجتماعي المطور/);

  const benefitPage = await fs.readFile(
    path.join(dist, "benefits/social-security/index.html"),
    "utf8",
  );
  assert.match(benefitPage, /نقطة اختبار/);
  assert.match(benefitPage, /مصدر رسمي/);
  assert.ok(benefitPage.includes("example.com/service"));

  const benefitsHousing = await fs.readFile(path.join(dist, "benefits/housing-support/index.html"), "utf8");
  assert.match(benefitsHousing, /الدعم السكني/);
  assert.match(benefitsHousing, /ما الذي تجهزه قبل التقديم/);
  assert.match(benefitsHousing, /بيانات الأسرة والملكية/);
  assert.ok(benefitsHousing.includes("/tools/installment-calculator/"));
  assert.match(benefitsHousing, /sakani.sa/);

  const benefitsSaned = await fs.readFile(path.join(dist, "benefits/saned-unemployment/index.html"), "utf8");
  assert.match(benefitsSaned, /90 يومًا/);
  assert.match(benefitsSaned, /60% ثم 50%/);
  assert.match(benefitsSaned, /gosi.gov.sa/);

  const benefitsJobSearch = await fs.readFile(path.join(dist, "benefits/job-search-subsidy/index.html"), "utf8");
  assert.match(benefitsJobSearch, /مدة الدعم 15 شهرًا/);
  assert.match(benefitsJobSearch, /2000 ريال/);
  assert.match(benefitsJobSearch, /hrdf.org.sa/);

  const benefitsMaternity = await fs.readFile(path.join(dist, "benefits/maternity-benefit/index.html"), "utf8");
  assert.match(benefitsMaternity, /12 شهر اشتراك خلال 36 شهرًا/);
  assert.match(benefitsMaternity, /الصرف 3 أشهر/);
  assert.match(benefitsMaternity, /beta.gosi.gov.sa/);

  const benefitsRetirement = await fs.readFile(path.join(dist, "benefits/retirement-pensions/index.html"), "utf8");
  assert.match(benefitsRetirement, /3 يوليو 2024/);
  assert.match(benefitsRetirement, /65 سنة/);
  assert.ok(benefitsRetirement.includes("/tools/gosi-deduction-calculator/"));

  const statisticsIndex = await fs.readFile(path.join(dist, "statistics/index.html"), "utf8");
  assert.match(statisticsIndex, /إحصاءات ومؤشرات السعودية/);
  assert.match(statisticsIndex, /عدد السكان التجريبي/);
  const statisticPage = await fs.readFile(path.join(dist, "statistics/population-test/index.html"), "utf8");
  assert.match(statisticPage, /1000/);
  assert.match(statisticPage, /عام 2026/);
  assert.match(statisticPage, /example.com\/dataset/);

  const newsIndex = await fs.readFile(path.join(dist, "news/index.html"), "utf8");
  assert.match(newsIndex, /أخبار المناطق السعودية/);
  assert.match(newsIndex, /خبر تجريبي أول/);
  const newsPage = await fs.readFile(path.join(dist, "news/test-region-first/index.html"), "utf8");
  assert.match(newsPage, /ملخص أصلي للخبر الأول/);
  assert.match(newsPage, /سياق محلي للخبر الأول/);
  assert.match(newsPage, /example.com\/news-1/);
  const regionalNews = await fs.readFile(path.join(dist, "news/region/test-region/index.html"), "utf8");
  assert.match(regionalNews, /أخبار منطقة تجريبية/);

  // صفحة مدينة بها بيانات كافية تحتوي قسم المطاعم وإسناد المصدر
  const cityCategory = await fs.readFile(
    path.join(dist, "city/city-with-data/restaurants/index.html"),
    "utf8",
  );
  assert.match(cityCategory, /OpenStreetMap/);
  assert.match(cityCategory, /ODbL|رخصة/);
  assert.match(cityCategory, /href="\/place\/city-with-data\/node\/100\/"/);
  const copiedPlaces = await fs.readFile(path.join(dist, "data/places/city-with-data.json"), "utf8");
  assert.match(copiedPlaces, /مطعم واحد/);

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
  assert.ok(sitemap.includes("/benefits/housing-support/"));
  assert.ok(sitemap.includes("/benefits/saned-unemployment/"));
  assert.ok(sitemap.includes("/benefits/job-search-subsidy/"));
  assert.ok(sitemap.includes("/benefits/maternity-benefit/"));
  assert.ok(sitemap.includes("/benefits/retirement-pensions/"));
  assert.doesNotMatch(sitemap, /city-without-data\/restaurants/);
  assert.match(sitemap, /city-with-data\/restaurants/);
  assert.ok(sitemap.includes("/city/city-with-data/neighbourhood/%D8%AD%D9%8A-%D8%A7%D9%84%D8%A7%D8%AE%D8%AA%D8%A8%D8%A7%D8%B1/"));
  assert.match(sitemap, /place\/city-with-data\/node\/100\//);
  assert.match(sitemap, /calendar\//);
  assert.match(sitemap, /calendar\/events\/founding-day\//);
  assert.match(sitemap, /calendar\/salaries\/2026\//);
  assert.match(sitemap, /prayer-times\/city-with-data\//);
  assert.match(sitemap, /benefits\/social-security\//);
  assert.match(sitemap, /statistics\/population-test\//);
  assert.match(sitemap, /news\/test-region-first\//);
  assert.match(sitemap, /news\/region\/test-region\//);
  assert.match(sitemap, /tools\//);
  assert.match(sitemap, /tools\/vat-calculator\//);
  assert.match(sitemap, /tools\/debt-ratio-calculator\//);
  assert.match(sitemap, /tools\/date-addition\//);
  assert.match(sitemap, /tools\/tile-calculator\//);
  assert.match(sitemap, /tools\/appliance-energy-calculator\//);
  assert.match(sitemap, /tools\/end-of-service-calculator\//);
  assert.match(sitemap, /tools\/overtime-calculator\//);
  assert.match(sitemap, /tools\/annual-leave-calculator\//);
  assert.match(sitemap, /tools\/sick-leave-calculator\//);
  assert.match(sitemap, /tools\/gosi-deduction-calculator\//);
  assert.match(sitemap, /tools\/salary-increase-calculator\//);
  assert.match(sitemap, /tools\/wage-hour-converter\//);
  assert.match(sitemap, /tools\/notice-compensation-calculator\//);
  assert.match(sitemap, /tools\/real-estate-transfer-tax-calculator\//);
  assert.match(sitemap, /tools\/cash-zakat-calculator\//);
  assert.match(sitemap, /tools\/trade-zakat-calculator\//);
  assert.match(sitemap, /tools\/gold-zakat-calculator\//);
  assert.match(sitemap, /tools\/social-security-income-calculator\//);
  assert.match(sitemap, /tools\/sama-affordability-calculator\//);
  assert.match(sitemap, /tools\/finance-amount-from-payment-calculator\//);
  assert.match(sitemap, /tools\/real-estate-purchase-cost-calculator\//);
  assert.ok(sitemap.includes("/tools/saned-compensation-calculator/"));
  assert.ok(sitemap.includes("/tools/job-search-subsidy-planner/"));
  assert.ok(sitemap.includes("/tools/new-retirement-pension-calculator/"));
  assert.ok(sitemap.includes("/tools/maternity-benefit-calculator/"));
  assert.ok(sitemap.includes("/tools/citizen-account-budget-calculator/"));
  assert.ok(report.indexablePlacePages >= 1);

  // Thin city pages remain available for navigation but are explicitly noindex.
  const sparseCityPage = await fs.readFile(path.join(dist, "city/city-without-data/index.html"), "utf8");
  assert.match(sparseCityPage, /<meta name="robots" content="noindex, follow">/);

  // National category hubs must not link to city/category pages that were not generated.
  const nationalRestaurants = await fs.readFile(path.join(dist, "category/restaurants/index.html"), "utf8");
  assert.match(nationalRestaurants, /city-with-data\/restaurants/);
  assert.doesNotMatch(nationalRestaurants, /city-without-data\/restaurants/);

  // Every URL in the sitemap must point to an HTML file generated by this build.
  const sitemapLocs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.ok(sitemapLocs.length > 0);
  for (const loc of sitemapLocs) {
    const pathname = new URL(loc).pathname;
    // Place URLs are rendered by the Worker from the city's JSON asset.
    if (pathname.startsWith("/place/") || pathname.startsWith("/prayer-times/")) continue;
    const htmlPath = pathname === "/" ? path.join(dist, "index.html") : path.join(dist, pathname.replace(/^\/+|\/+$/g, ""), "index.html");
    await fs.access(htmlPath);
  }

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
