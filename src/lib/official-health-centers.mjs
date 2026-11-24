import fs from "node:fs/promises";
import path from "node:path";
import { renderPage } from "./layout.mjs";
import { escapeHtml } from "./util.mjs";

const INDEX_PATH = "/health/on-duty/";

export async function loadOfficialHealthCenters(dataRoot) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(path.join(dataRoot, "data/official-health-centers.json"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }

  if (!data || !Array.isArray(data.pages)) {
    throw new Error("بيانات المراكز الصحية المناوبة غير صالحة: pages must be an array.");
  }

  const slugs = new Set();
  const pages = data.pages.filter((page) => {
    if (!page || !/^[a-z0-9-]+$/.test(String(page.slug || ""))) return false;
    if (slugs.has(page.slug)) throw new Error(`تكرر مسار صفحة مراكز صحية: ${page.slug}`);
    slugs.add(page.slug);
    if (!page.titleAr || !page.sourceUrl || !Array.isArray(page.centers)) {
      throw new Error(`بيانات صفحة المراكز الصحية ناقصة: ${page.slug}`);
    }
    return true;
  }).map((page) => ({
    ...page,
    centers: page.centers.filter((center) =>
      center && /^[a-z0-9-]+$/.test(String(center.id || "")) &&
      typeof center.nameAr === "string" && center.nameAr.trim() &&
      typeof center.clusterAr === "string" && center.clusterAr.trim()
    ),
  }));

  return { ...data, pages };
}

export function officialHealthCentersIndexPage(data) {
  const items = data.pages.map((page) => `
    <li>
      <a href="${INDEX_PATH}${encodeURIComponent(page.slug)}/">
        <strong>${escapeHtml(page.titleAr)}</strong>
        <span>${page.centers.length.toLocaleString("ar-SA")} مركزًا في القائمة المنشورة</span>
      </a>
      <p>${escapeHtml(page.scopeAr || "")}</p>
      <p><a href="${escapeHtml(page.sourceUrl)}" target="_blank" rel="noopener noreferrer">فتح جدول وزارة الصحة وخريطة المواقع لكل مركز</a></p>
    </li>`).join("");

  const verifiedAtLabel = data.verifiedAt
    ? data.verifiedAt.split("-").reverse().join("/")
    : "غير محدد";
  const body = `
  <section class="hero">
    <p class="eyebrow">دليل صحي من مصدر حكومي</p>
    <h1>المراكز الصحية المناوبة</h1>
    <p>قوائم أسماء المراكز التي تنشرها وزارة الصحة ضمن صفحاتها الإقليمية، مع الاحتفاظ بالتجمعات كما وردت في المصدر الأصلي.</p>
    <p><strong>مصدر البيانات:</strong> وزارة الصحة — <strong>تاريخ مراجعة القوائم:</strong> ${escapeHtml(verifiedAtLabel)}.</p>
    <p>يظهر تاريخ آخر تعديل لدى الوزارة داخل صفحة كل منطقة؛ وقد يختلف من قائمة إلى أخرى.</p>
  </section>
  <section class="section">
    <h2>القوائم المتاحة</h2>
    <ul class="grid-list">${items}</ul>
  </section>
  <aside class="source-note">
    <strong>تنبيه قبل الزيارة:</strong> ${escapeHtml(data.disclaimerAr || "")}
  </aside>`;

  return renderPage({
    title: "المراكز الصحية المناوبة في السعودية — دليل السعودية",
    description: "قوائم إقليمية لأسماء المراكز الصحية المناوبة كما نشرتها وزارة الصحة، مع روابط الجداول الرسمية التي تعرض ساعات العمل والمواقع.",
    canonicalPath: INDEX_PATH,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "المراكز الصحية المناوبة", path: INDEX_PATH },
    ],
  });
}

export function officialHealthCentersRegionPage(data, page) {
  const groups = new Map();
  for (const center of page.centers) {
    if (!groups.has(center.clusterAr)) groups.set(center.clusterAr, []);
    groups.get(center.clusterAr).push(center);
  }

  const sections = [...groups.entries()].map(([groupName, centers]) => `
    <section class="section">
      <h2>${escapeHtml(groupName)} <span class="muted-count">(${centers.length.toLocaleString("ar-SA")})</span></h2>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>م</th><th>اسم المركز كما ورد في الوزارة</th></tr></thead>
          <tbody>${centers.map((center, i) => `
            <tr>
              <td>${(i + 1).toLocaleString("ar-SA")}</td>
              <td>${escapeHtml(center.nameAr)}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`).join("");

  const route = `${INDEX_PATH}${encodeURIComponent(page.slug)}/`;
  const body = `
  <section class="hero">
    <p class="eyebrow">قائمة من وزارة الصحة</p>
    <h1>${escapeHtml(page.titleAr)}</h1>
    <p>${escapeHtml(page.scopeAr || "")}</p>
    <p><strong>${page.centers.length.toLocaleString("ar-SA")} مركزًا</strong> مدرجًا في الصفحة الإقليمية التي تمت مراجعتها.</p>
    <p><strong>تاريخ التحديث الظاهر في صفحة الوزارة:</strong> ${escapeHtml(page.sourceLastUpdatedHijri || data.sourceLastUpdatedHijri || "غير محدد")}.</p>
    <p><a href="${escapeHtml(page.sourceUrl)}" target="_blank" rel="noopener noreferrer">فتح جدول وزارة الصحة الأصلي وساعات المناوبة وروابط مواقع المراكز</a></p>
  </section>
  ${sections}
  <aside class="source-note">
    <strong>يرجى التحقق قبل التوجه:</strong> ${escapeHtml(data.disclaimerAr || "")}
    <p>هذه الصفحة تعرض أسماء المراكز وتجميعها فقط. لم ننقل مؤشرات ساعات العمل من الجدول حتى لا نسيء تفسير علامات المناوبة، ولم نضف إحداثيات غير منشورة في بياناتنا.</p>
    <p><a href="${INDEX_PATH}">العودة إلى قوائم المراكز الصحية المناوبة</a></p>
  </aside>`;

  return renderPage({
    title: `${page.titleAr} — دليل السعودية`,
    description: `قائمة تضم ${page.centers.length} مركزًا صحيًا كما وردت في صفحة وزارة الصحة الإقليمية، مع رابط الجدول الرسمي للمناوبة ومواقع المراكز.`,
    canonicalPath: route,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "المراكز الصحية المناوبة", path: INDEX_PATH },
      { name: page.titleAr, path: route },
    ],
  });
}
