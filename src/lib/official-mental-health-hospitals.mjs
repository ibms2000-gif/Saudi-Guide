import fs from "node:fs/promises";
import path from "node:path";
import { renderPage } from "./layout.mjs";
import { escapeHtml } from "./util.mjs";

const ROUTE = "/health/mental-health-hospitals/";

export async function loadOfficialMentalHealthHospitals(dataRoot) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(path.join(dataRoot, "data/official-mental-health-hospitals.json"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }

  if (!data || !Array.isArray(data.facilities) || !data.sourceUrl) {
    throw new Error("بيانات مستشفيات الصحة النفسية غير صالحة.");
  }

  const ids = new Set();
  const facilities = data.facilities.filter((item) => {
    if (!item || !/^[a-z0-9-]+$/.test(String(item.id || "")) ||
      typeof item.nameAr !== "string" || !item.nameAr.trim() ||
      typeof item.areaAr !== "string" || !item.areaAr.trim()) return false;
    if (ids.has(item.id)) throw new Error("تكرر معرّف منشأة الصحة النفسية: " + item.id);
    ids.add(item.id);
    return true;
  });

  return { ...data, facilities };
}

export function officialMentalHealthHospitalsPage(data) {
  const rows = data.facilities.map((item, index) =>
    "<tr><td>" + (index + 1).toLocaleString("ar-SA") + "</td><td>" +
    escapeHtml(item.areaAr) + "</td><td>" + escapeHtml(item.nameAr) + "</td></tr>"
  ).join("");

  const body = [
    '<section class="hero">',
    '<p class="eyebrow">قائمة من مصدر حكومي</p>',
    '<h1>مواقع مجمعات ومستشفيات الصحة النفسية في السعودية</h1>',
    '<p>قائمة بأسماء ' + data.facilities.length.toLocaleString("ar-SA") + ' منشأة كما وردت في ملف وزارة الصحة، مع المنطقة أو المحافظة المذكورة بجوار كل منشأة.</p>',
    '<p><strong>المصدر:</strong> وزارة الصحة — ملف مواقع مجمعات ومستشفيات الصحة النفسية.</p>',
    '<p><strong>تاريخ مراجعة الملف:</strong> ' + escapeHtml(data.verifiedAt || "غير محدد") + '.</p>',
    '<p><a href="' + escapeHtml(data.sourceUrl) + '" target="_blank" rel="noopener noreferrer">فتح ملف وزارة الصحة الأصلي وروابط المواقع الجغرافية</a></p>',
    '</section>',
    '<section class="section"><h2>المنشآت الواردة في الملف</h2>',
    '<div class="table-scroll"><table class="data-table">',
    '<thead><tr><th>م</th><th>المنطقة / المحافظة</th><th>اسم المنشأة كما ورد في الملف</th></tr></thead>',
    '<tbody>' + rows + '</tbody></table></div></section>',
    '<aside class="source-note"><strong>تنبيه:</strong> ' + escapeHtml(data.disclaimerAr || ""),
    '<p>لم ننسخ روابط الخرائط الفردية من الملف أو نضف أرقام اتصال أو ساعات عمل غير مثبتة في البيانات المنظمة؛ استخدم الملف الرسمي للوصول إلى رابط الموقع الجغرافي لكل منشأة.</p>',
    '<p><a href="/official-directories/">العودة إلى الأدلة الحكومية الرسمية</a></p></aside>',
  ].join("");

  return renderPage({
    title: "مواقع مستشفيات ومجمعات الصحة النفسية في السعودية — دليل السعودية",
    description: "قائمة رسمية تضم " + data.facilities.length + " مستشفى ومجمعًا للصحة النفسية كما وردت في ملف وزارة الصحة، حسب المنطقة والمحافظة.",
    canonicalPath: ROUTE,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الأدلة الحكومية الرسمية", path: "/official-directories/" },
      { name: "مستشفيات الصحة النفسية", path: ROUTE },
    ],
  });
}
