import fs from "node:fs/promises";
import path from "node:path";
import { renderPage } from "./layout.mjs";
import { escapeHtml } from "./util.mjs";

const ROUTE = "/education/";
const MOE_SCHOOL_MAP = "https://moe.gov.sa/ar/education/education-in-ksa/gis";
const MOE_OPEN_DATA = "https://moe.gov.sa/ar/services/data-and-statistics-center/opendata";
const MOE_REALTIME_DATA = "https://www.moe.gov.sa/ar/services/data-and-statistics-center/reatltimedata";

function requiredInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error("قيمة إحصائية تعليمية غير صالحة: " + label);
  }
  return number;
}

export async function loadOfficialEducationStatistics(dataRoot) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(
      path.join(dataRoot, "data/official-education-statistics.json"),
      "utf8",
    ));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }

  if (!data || !Array.isArray(data.cityStatistics) ||
      !data.sourceUrl || !data.citySourceUrl ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(data.verifiedAt || ""))) {
    throw new Error("بيانات إحصاءات التعليم الرسمية غير مكتملة.");
  }

  for (const key of [
    "referenceYear", "previousYear", "totalSchools", "previousTotalSchools",
    "publicSchools", "privateSchools", "publicSchoolsBoys", "publicSchoolsGirls",
    "privateSchoolsBoys", "privateSchoolsGirls",
  ]) requiredInteger(data[key], key);

  if (data.publicSchools + data.privateSchools !== data.totalSchools ||
      data.publicSchoolsBoys + data.publicSchoolsGirls !== data.publicSchools ||
      data.privateSchoolsBoys + data.privateSchoolsGirls !== data.privateSchools) {
    throw new Error("مجاميع المدارس أو توزيعها حسب الجنس لا تتطابق مع الإجماليات.");
  }

  const cityIds = new Set();
  for (const item of data.cityStatistics) {
    if (!item || typeof item.areaAr !== "string" || !item.areaAr.trim()) {
      throw new Error("اسم نطاق إحصاء المدينة مفقود.");
    }
    if (cityIds.has(item.areaAr)) throw new Error("تكرر نطاق تعليمي: " + item.areaAr);
    cityIds.add(item.areaAr);
    for (const key of ["publicSchools", "privateNonInternationalSchools", "internationalSchools"]) {
      requiredInteger(item[key], item.areaAr + "." + key);
    }
  }

  return data;
}

export function officialEducationPage(data) {
  const nationalRows = [
    ["إجمالي المدارس", data.totalSchools, "مدرسة"],
    ["المدارس الحكومية", data.publicSchools, "مدرسة"],
    ["المدارس الأهلية", data.privateSchools, "مدرسة"],
  ];
  const nationalTable = nationalRows.map(([label, value, unit]) =>
    "<tr><th>" + escapeHtml(label) + "</th><td>" +
    Number(value).toLocaleString("ar-SA") + "</td><td>" + escapeHtml(unit) + "</td></tr>"
  ).join("");

  const genderRows = [
    ["الحكومية", "بنين", data.publicSchoolsBoys],
    ["الحكومية", "بنات", data.publicSchoolsGirls],
    ["الأهلية", "بنين", data.privateSchoolsBoys],
    ["الأهلية", "بنات", data.privateSchoolsGirls],
  ];
  const genderTable = genderRows.map(([sector, gender, count]) =>
    "<tr><td>" + escapeHtml(sector) + "</td><td>" + escapeHtml(gender) +
    "</td><td>" + Number(count).toLocaleString("ar-SA") + "</td></tr>"
  ).join("");

  const cityRows = data.cityStatistics.map((item) =>
    "<tr><th>" + escapeHtml(item.areaAr) + "</th><td>" +
    Number(item.publicSchools).toLocaleString("ar-SA") + "</td><td>" +
    Number(item.privateNonInternationalSchools).toLocaleString("ar-SA") + "</td><td>" +
    Number(item.internationalSchools).toLocaleString("ar-SA") + "</td></tr>"
  ).join("");
  const cityNotes = data.cityStatistics.filter((item) => item.scopeNoteAr).map((item) =>
    "<p class=\"source-note\">" + escapeHtml(item.scopeNoteAr) + "</p>"
  ).join("");

  const schoolGrowth = data.totalSchools - data.previousTotalSchools;
  const growthRate = data.previousTotalSchools > 0
    ? (schoolGrowth / data.previousTotalSchools * 100).toFixed(2)
    : "0.00";

  const body = [
    '<section class="hero">',
    '<p class="eyebrow">بيانات تعليمية رسمية</p>',
    '<h1>المدارس والتعليم في السعودية</h1>',
    '<p>إحصاءات وطنية ومقارنة للمدارس في الرياض وجدة وحاضرة الدمام، مع روابط مباشرة إلى خريطة وزارة التعليم ومكتبات البيانات القابلة للتنزيل.</p>',
    '<p><strong>السنة المرجعية للأرقام:</strong> ' + data.referenceYear + 'م. <strong>تاريخ مراجعة المصادر:</strong> ' + escapeHtml(data.verifiedAt) + '.</p>',
    '</section>',
    '<section class="section">',
    '<h2>عدد المدارس في المملكة</h2>',
    '<div class="stat-grid">',
    '<div class="stat-card"><strong class="stat-value">' + data.totalSchools.toLocaleString("ar-SA") + '</strong><span>إجمالي المدارس</span></div>',
    '<div class="stat-card"><strong class="stat-value">' + data.publicSchools.toLocaleString("ar-SA") + '</strong><span>المدارس الحكومية · ' + data.publicSharePercent + '%</span></div>',
    '<div class="stat-card"><strong class="stat-value">' + data.privateSchools.toLocaleString("ar-SA") + '</strong><span>المدارس الأهلية · ' + data.privateSharePercent + '%</span></div>',
    '</div>',
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>القطاع</th><th>العدد</th><th>الوحدة</th></tr></thead><tbody>' + nationalTable + '</tbody></table></div>',
    '<p>ارتفع إجمالي المدارس من ' + data.previousTotalSchools.toLocaleString("ar-SA") + ' في ' + data.previousYear + ' إلى ' + data.totalSchools.toLocaleString("ar-SA") + ' في ' + data.referenceYear + '، بزيادة ' + schoolGrowth.toLocaleString("ar-SA") + ' مدرسة (نحو ' + growthRate + '%).</p>',
    '</section>',
    '<section class="section">',
    '<h2>توزيع المدارس حسب البنين والبنات</h2>',
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>القطاع</th><th>الفئة</th><th>عدد المدارس</th></tr></thead><tbody>' + genderTable + '</tbody></table></div>',
    '<p>تُعرض الأعداد حسب تقسيم البنين والبنات الوارد في الرسم الإحصائي للنشرة. مجموع الفئتين يطابق إجمالي كل قطاع.</p>',
    '</section>',
    '<section class="section">',
    '<h2>مقارنة المدارس في المدن الرئيسية</h2>',
    '<p>تعرض نشرة جودة الحياة في المدن السعودية بيانات مرجعية لعام ' + data.referenceYear + '، وتفصل المدارس الأهلية غير الدولية عن المدارس الدولية.</p>',
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>المدينة / النطاق</th><th>حكومية</th><th>أهلية غير دولية</th><th>دولية</th></tr></thead><tbody>' + cityRows + '</tbody></table></div>',
    cityNotes,
    '<p>هذه المقارنة متاحة للمدن والنطاقات المذكورة في تقرير الهيئة فقط، وليست حصرًا لجميع مدن المملكة.</p>',
    '</section>',
    '<section class="section">',
    '<h2>ابحث عن مدرسة بعينها</h2>',
    '<p>للبحث عن المدرسة وموقعها، استخدم الخارطة التعليمية الرسمية لوزارة التعليم. تتيح الوزارة البحث وفق بيانات المدرسة والفلاتر المتاحة في النظام.</p>',
    '<p><a href="' + MOE_SCHOOL_MAP + '" target="_blank" rel="noopener noreferrer">فتح الخارطة التعليمية للمدارس</a></p>',
    '<p>لم نُنشئ صفحات منفردة للمدارس؛ إذ لم نتحقق حتى تاريخ مراجعة هذا الدليل من ملف عام شامل يحتوي سجلات المدارس وإحداثياتها، ومصرح بإعادة نشره آليًا.</p>',
    '</section>',
    '<section class="section">',
    '<h2>تحميل البيانات التعليمية الرسمية</h2>',
    '<ul>',
    '<li><a href="' + MOE_OPEN_DATA + '" target="_blank" rel="noopener noreferrer">البيانات المفتوحة لوزارة التعليم</a> — مجموعات بيانات للتعليم العام والطلاب والمؤشرات، وبعضها متاح بصيغ CSV وJSON وExcel.</li>',
    '<li><a href="' + MOE_REALTIME_DATA + '" target="_blank" rel="noopener noreferrer">البيانات اللحظية لوزارة التعليم</a> — اختر المرحلة التعليمية والجنس، ثم حمّل البيانات بصيغ JSON أو CSV أو Excel. آخر تحديث ظاهر في الصفحة التي تمت مراجعتها: 14 سبتمبر 2026.</li>',
    '</ul>',
    '<p>هذه الملفات إحصائية ومجمعة بحسب خيارات المصدر، ولا ينبغي تفسيرها على أنها قائمة إحداثيات أو دليل عناوين لكل مدرسة.</p>',
    '</section>',
    '<aside class="source-note">',
    '<strong>المصادر والمنهجية:</strong>',
    '<p>' + escapeHtml(data.sourceNameAr) + '، ' + escapeHtml(data.sourceTitleAr) + ' — <a href="' + escapeHtml(data.sourceUrl) + '" target="_blank" rel="noopener noreferrer">فتح النشرة العربية لعام 2024</a>.</p>',
    '<p>' + escapeHtml(data.sourceNameAr) + '، ' + escapeHtml(data.citySourceTitleAr) + ' — <a href="' + escapeHtml(data.citySourceUrl) + '" target="_blank" rel="noopener noreferrer">فتح تقرير جودة الحياة في المدن (PDF)</a>.</p>',
    '<p>تختلف حدود النطاقات الإحصائية عن حدود بعض المدن البلدية؛ لذلك أُبقيت تسمية «حاضرة الدمام» كما وردت في تقرير الهيئة.</p>',
    '<p>' + escapeHtml(data.caveatAr || "") + '</p>',
    '<p><a href="/official-directories/">العودة إلى الأدلة الحكومية الرسمية</a> · <a href="/category/education/">الأماكن التعليمية في OpenStreetMap</a></p>',
    '</aside>',
  ].join("\n");

  return renderPage({
    title: "إحصاءات المدارس في السعودية والرياض وجدة وحاضرة الدمام | دليل السعودية",
    description: "عدد المدارس الحكومية والأهلية وتوزيعها حسب البنين والبنات، ومقارنة المدارس الحكومية والأهلية والدولية في الرياض وجدة وحاضرة الدمام وفق إحصاءات 2024.",
    canonicalPath: ROUTE,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الأدلة الحكومية الرسمية", path: "/official-directories/" },
      { name: "المدارس والتعليم", path: ROUTE },
    ],
  });
}
