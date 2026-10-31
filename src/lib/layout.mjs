import { SITE, DATA_SOURCE } from "./config.mjs";
import { escapeHtml } from "./util.mjs";

export function renderPage({ title, description, canonicalPath, body, noindex = false, breadcrumbs = [], accentColor }) {
  const canonical = `${SITE.url}${canonicalPath}`;
  const robots = noindex ? "noindex, follow" : "index, follow";
  const ldBreadcrumb = breadcrumbs.length
    ? `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: b.name,
          item: `${SITE.url}${b.path}`,
        })),
      }).replaceAll("<", "\\u003c")}</script>`
    : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="${robots}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles/site.css">
${ldBreadcrumb}
${accentColor ? `<style>:root{--accent:${accentColor};}</style>` : ""}
</head>
<body>
<a class="skip-link" href="#main">تخطَّ إلى المحتوى</a>
${renderHeader()}
<main id="main">
${breadcrumbs.length ? renderBreadcrumbs(breadcrumbs) : ""}
${body}
</main>
${renderFooter()}
<script src="/app.js" defer></script>
</body>
</html>`;
}

function renderHeader() {
  return `<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">✦</span>
      <span>${escapeHtml(SITE.name)}</span>
    </a>
    <nav class="main-nav" aria-label="الأقسام الرئيسية">
      <a href="/regions/">المناطق</a>
      <a href="/categories/">الأقسام</a>
      <a href="/calendar/">التقويم والمواعيد</a>
      <a href="/prayer-times/">مواقيت الصلاة</a>
      <a href="/benefits/">الدعم والمنافع</a>
      <a href="/statistics/">الإحصاءات</a>
      <a href="/news/">أخبار المناطق</a>
      <a href="/about/data-sources/">مصدر البيانات</a>
    </nav>
  </div>
</header>`;
}

function renderFooter() {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="wrap">
    <p class="data-credit">
      بيانات الأماكن في هذا الموقع مأخوذة من مساهمي
      <a href="${DATA_SOURCE.url}" rel="noopener">${escapeHtml(DATA_SOURCE.nameAr)}</a>
      عبر ${escapeHtml(DATA_SOURCE.viaAr)}، ومتاحة بموجب
      <a href="${DATA_SOURCE.licenseUrl}" rel="noopener">${escapeHtml(DATA_SOURCE.licenseAr)}</a>.
      قد تكون بعض البيانات غير مكتملة أو قديمة. راجع
      <a href="/about/data-sources/">صفحة مصدر البيانات</a> للتفاصيل.
    </p>
    <p class="legal-note">
      لا يعرض هذا الموقع توقعات جوية أو بيانات أرصاد جوية.
      <a href="/legal/weather-notice/">اطّلع على السبب</a>.
    </p>
    <p class="copyright">© ${year} ${escapeHtml(SITE.name)}</p>
  </div>
</footer>`;
}

function renderBreadcrumbs(crumbs) {
  const items = crumbs
    .map((c, i) =>
      i === crumbs.length - 1
        ? `<span aria-current="page">${escapeHtml(c.name)}</span>`
        : `<a href="${c.path}">${escapeHtml(c.name)}</a>`,
    )
    .join('<span class="sep" aria-hidden="true">/</span>');
  return `<nav class="breadcrumbs" aria-label="مسار التصفح"><div class="wrap">${items}</div></nav>`;
}

export function dataAttributionNote({ cityNameAr, fetchedAt }) {
  const date = fetchedAt ? new Date(fetchedAt).toLocaleDateString("ar-SA") : null;
  return `<p class="source-note">
    البيانات المعروضة لـ${escapeHtml(cityNameAr)} مجمّعة من مساهمي
    <a href="${DATA_SOURCE.url}" rel="noopener">OpenStreetMap</a>
    ${date ? `وآخر تحديث لها بتاريخ ${date} ميلادي` : ""}.
    قد تختلف الأسماء أو ساعات العمل عن الواقع؛ يُرجى التحقق قبل الزيارة.
  </p>`;
}
