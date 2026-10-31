import { escapeHtml, safeHttpUrl } from "./util.mjs";
import { renderPage } from "./layout.mjs";

function formattedDate(value) {
  const date = new Date(`${value}T12:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return value || "تاريخ غير محدد";
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    timeZone: "Asia/Riyadh",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function newsCard(item) {
  return `<li class="news-card">
    <p class="news-meta">${escapeHtml(item.regionNameAr || "السعودية")} · ${escapeHtml(item.categoryAr || "أخبار محلية")} · ${escapeHtml(formattedDate(item.publishedAt))}</p>
    <h3><a href="/news/${escapeHtml(item.slug)}/">${escapeHtml(item.titleAr)}</a></h3>
    <p>${escapeHtml(item.summaryAr)}</p>
    <a class="news-read-more" href="/news/${escapeHtml(item.slug)}/">قراءة الملخص والسياق داخل دليل السعودية</a>
  </li>`;
}

export function newsIndexPage(news = []) {
  const sorted = [...news].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const items = sorted.map(newsCard).join("");
  const sources = `
    <ul class="news-sources">
      <li><a href="https://spa.gov.sa/ar/" target="_blank" rel="noopener noreferrer nofollow">وكالة الأنباء السعودية (واس)</a> — المصدر الرئيسي للأخبار الوطنية والمحلية والمناطق.</li>
      <li><a href="https://www.stats.gov.sa/ar/news" target="_blank" rel="noopener noreferrer nofollow">الأخبار والإصدارات الإحصائية للهيئة العامة للإحصاء</a> — البيانات والمؤشرات والنشرات الرسمية.</li>
    </ul>`;

  const body = `
  <section class="hero">
    <h1>أخبار المناطق السعودية</h1>
    <p>ملخصات محلية لأخبار ومبادرات المناطق والمحافظات، مع تاريخ النشر ورابط المصدر الأصلي وسياق يساعد القارئ على فهم الخبر.</p>
  </section>
  <section class="section">
    <h2>أحدث الملخصات المحلية</h2>
    ${items ? `<ul class="news-grid">${items}</ul>` : "<p>لا توجد أخبار منشورة حاليًا.</p>"}
  </section>
  <section class="section">
    <h2>مصادر الأخبار</h2>
    <p>نستخدم مصادر رسمية وموثوقة، ونكتب ملخصًا تحريريًا مستقلًا بدل نسخ النص أو الصورة. نوضح تاريخ الخبر ورابطه، ونزيل أو نحدّث المعلومات التي لم تعد صالحة.</p>
    ${sources}
  </section>`;

  return renderPage({
    title: "أخبار المناطق السعودية — أخبار محلية موثقة | دليل السعودية",
    description: "ملخصات أخبار مناطق السعودية والمحافظات مع السياق المحلي وتاريخ النشر وروابط المصادر الأصلية.",
    canonicalPath: "/news/",
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "أخبار المناطق", path: "/news/" },
    ],
  });
}

export function newsRegionPage(region, news = []) {
  const sorted = [...news].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const items = sorted.map(newsCard).join("");
  const body = `
  <section class="hero">
    <h1>أخبار ${escapeHtml(region.nameAr)}</h1>
    <p>ملخصات الأخبار والمبادرات المنشورة عن ${escapeHtml(region.nameAr)}، مع روابط المصادر الأصلية وتواريخ النشر.</p>
  </section>
  <section class="section">
    <h2>الأخبار المنشورة</h2>
    <ul class="news-grid">${items}</ul>
  </section>
  <p><a href="/news/">العودة إلى أخبار المناطق</a></p>`;

  return renderPage({
    title: `أخبار ${region.nameAr} — دليل السعودية`,
    description: `أخبار وملخصات محلية عن ${region.nameAr}، مع تواريخ النشر والمصادر الأصلية.`,
    canonicalPath: `/news/region/${region.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "أخبار المناطق", path: "/news/" },
      { name: region.nameAr, path: `/news/region/${region.slug}/` },
    ],
  });
}

export function newsDetailPage(item) {
  if (!item || !/^[a-z0-9-]+$/.test(String(item.slug || ""))) {
    throw new TypeError("سجل الخبر أو رابطه غير صالح.");
  }
  const source = safeHttpUrl(item.sourceUrl);
  const sourceLink = source
    ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(item.sourceName || "المصدر الأصلي")}</a>`
    : escapeHtml(item.sourceName || "المصدر غير متاح");

  const body = `
  <article class="news-article">
    <p class="news-meta">${escapeHtml(item.regionNameAr || "السعودية")} · ${escapeHtml(item.categoryAr || "أخبار محلية")} · ${escapeHtml(formattedDate(item.publishedAt))}</p>
    <h1>${escapeHtml(item.titleAr)}</h1>
    <section class="section">
      <h2>ملخص الخبر</h2>
      <p>${escapeHtml(item.summaryAr)}</p>
    </section>
    <section class="section">
      <h2>السياق المحلي</h2>
      <p>${escapeHtml(item.localContextAr || "")}</p>
    </section>
    <aside class="source-note">
      <p><strong>المصدر الأصلي:</strong> ${sourceLink}</p>
      <p>تاريخ نشر المصدر: ${escapeHtml(formattedDate(item.publishedAt))}. آخر تحقق من الرابط: ${escapeHtml(item.verifiedAt || "غير محدد")}.</p>
      <p>${escapeHtml(item.editorialNote || "هذا ملخص تحريري مستقل، وليس إعادة نشر للنص الأصلي.")}</p>
    </aside>
  </article>
  <p><a href="/news/">العودة إلى أخبار المناطق</a></p>`;

  return renderPage({
    title: `${item.titleAr} — ${item.regionNameAr || "أخبار المناطق"} | دليل السعودية`,
    description: item.summaryAr,
    canonicalPath: `/news/${item.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "أخبار المناطق", path: "/news/" },
      { name: item.regionNameAr || "المناطق", path: item.regionSlug ? `/news/region/${item.regionSlug}/` : "/news/" },
      { name: item.titleAr, path: `/news/${item.slug}/` },
    ],
  });
}
