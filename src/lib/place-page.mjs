import { escapeHtml, safeHttpUrl, safeTelephone } from "./util.mjs";

const OSM_TYPES = new Set(["node", "way", "relation"]);
const DETAIL_FIELDS = ["address", "phone", "website", "openingHours", "neighbourhood", "email", "brand", "operator", "cuisine", "description"];

export function countPlaceDetails(place) {
  return DETAIL_FIELDS.filter((field) => {
    const value = place?.[field];
    return value !== null && value !== undefined && String(value).trim() !== "";
  }).length;
}

export function isPlacePageIndexable(place) {
  if (!place || typeof place.name !== "string" || !place.name.trim()) return false;
  if (!OSM_TYPES.has(place.osmType) || !/^\d+$/.test(String(place.osmId ?? ""))) return false;

  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return false;
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return false;

  return countPlaceDetails(place) >= 2;
}

export function placePath(citySlug, place) {
  if (!/^[a-z0-9-]+$/.test(String(citySlug || ""))) return null;
  if (!place || !OSM_TYPES.has(place.osmType) || !/^\d+$/.test(String(place.osmId ?? ""))) return null;
  return `/place/${citySlug}/${place.osmType}/${place.osmId}/`;
}

export function renderPlacePage({ place, city, category, siteUrl, fetchedAt }) {
  const canonicalPath = placePath(city.slug, place);
  const canonical = new URL(canonicalPath, siteUrl).href;
  const indexable = isPlacePageIndexable(place);
  const name = escapeHtml(place.name);
  const cityName = escapeHtml(city.nameAr);
  const categoryName = escapeHtml(category?.nameAr || "مكان");
  const title = `${place.name} في ${city.nameAr} | ${categoryName} - دليل السعودية`;
  const descriptionParts = [
    `تعرف على ${place.name} في ${city.nameAr}`,
    categoryName ? `ضمن قسم ${categoryName}` : "",
    place.neighbourhood ? `في حي ${place.neighbourhood}` : "",
    place.cuisine ? `نوع النشاط: ${String(place.cuisine).replaceAll("_", " ")}` : "",
    place.address ? `العنوان: ${place.address}` : "",
  ].filter(Boolean);
  const description = [...descriptionParts.join("، ")].slice(0, 155).join("").trim();
  const website = safeHttpUrl(place.website);
  const phone = safeTelephone(place.phone);
  const email = typeof place.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(place.email.trim())
    ? place.email.trim()
    : null;
  const readable = (value) => String(value || "").split(";").map((part) => part.trim().replaceAll("_", " ").replaceAll("-", " ")).filter(Boolean).join("، ");
  const yesNo = (value) => ({
    yes: "نعم",
    no: "لا",
    limited: "متاح بشكل محدود",
    designated: "متاح في أماكن مخصصة",
    only: "متاح لهذا النوع فقط",
  })[String(value || "").toLowerCase()] || readable(value);
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  const mapUrl = new URL("https://www.openstreetmap.org/");
  mapUrl.pathname = `/${place.osmType}/${place.osmId}`;
  const embedUrl = new URL("https://www.openstreetmap.org/export/embed.html");
  const delta = 0.003;
  const west = Math.max(-180, lon - delta);
  const east = Math.min(180, lon + delta);
  const south = Math.max(-90, lat - delta);
  const north = Math.min(90, lat + delta);
  embedUrl.searchParams.set("bbox", `${west},${south},${east},${north}`);
  embedUrl.searchParams.set("layer", "mapnik");
  embedUrl.searchParams.set("marker", `${lat},${lon}`);

  const detailRows = [
    place.address ? `<div class="place-fact"><dt>العنوان</dt><dd>${escapeHtml(place.address)}</dd></div>` : "",
    place.neighbourhood ? `<div class="place-fact"><dt>الحي المسجل</dt><dd>${escapeHtml(place.neighbourhood)}</dd></div>` : "",
    place.phone ? `<div class="place-fact"><dt>الهاتف</dt><dd>${phone ? `<a href="tel:${escapeHtml(phone)}">${escapeHtml(place.phone)}</a>` : escapeHtml(place.phone)}</dd></div>` : "",
    place.openingHours ? `<div class="place-fact"><dt>ساعات العمل المسجلة</dt><dd>${escapeHtml(place.openingHours)}</dd></div>` : "",
    place.cuisine ? `<div class="place-fact"><dt>نوع الطعام أو النشاط</dt><dd>${escapeHtml(readable(place.cuisine))}</dd></div>` : "",
    place.brand ? `<div class="place-fact"><dt>العلامة التجارية</dt><dd>${escapeHtml(place.brand)}</dd></div>` : "",
    place.operator ? `<div class="place-fact"><dt>المشغّل</dt><dd>${escapeHtml(place.operator)}</dd></div>` : "",
    email ? `<div class="place-fact"><dt>البريد الإلكتروني</dt><dd><a href="mailto:${escapeHtml(email)}" rel="nofollow">${escapeHtml(email)}</a></dd></div>` : "",
    place.wheelchair ? `<div class="place-fact"><dt>إمكانية الوصول بالكراسي المتحركة</dt><dd>${escapeHtml(yesNo(place.wheelchair))}</dd></div>` : "",
    place.delivery ? `<div class="place-fact"><dt>خدمة التوصيل المسجلة</dt><dd>${escapeHtml(yesNo(place.delivery))}</dd></div>` : "",
    place.takeaway ? `<div class="place-fact"><dt>خدمة الطلبات الخارجية</dt><dd>${escapeHtml(yesNo(place.takeaway))}</dd></div>` : "",
    place.capacity ? `<div class="place-fact"><dt>السعة المسجلة</dt><dd>${escapeHtml(place.capacity)}</dd></div>` : "",
    place.postcode ? `<div class="place-fact"><dt>الرمز البريدي</dt><dd>${escapeHtml(place.postcode)}</dd></div>` : "",
    place.description ? `<div class="place-fact"><dt>الوصف المسجل في المصدر</dt><dd>${escapeHtml(place.description)}</dd></div>` : "",
    website ? `<div class="place-fact"><dt>الموقع الإلكتروني</dt><dd><a href="${escapeHtml(website)}" rel="noopener noreferrer nofollow" target="_blank">زيارة الموقع المدرج في المصدر</a></dd></div>` : "",
  ].filter(Boolean).join("");

  const fetched = fetchedAt && Number.isFinite(Date.parse(fetchedAt))
    ? new Date(fetchedAt).toLocaleDateString("ar-SA")
    : null;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: place.name,
    url: canonical,
    geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lon },
    ...(place.address ? { address: place.address } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(email ? { email } : {}),
    ...(place.description ? { description: place.description } : {}),
    ...(website ? { sameAs: website } : {}),
    additionalProperty: [
      ["نوع النشاط", place.cuisine],
      ["العلامة التجارية", place.brand],
      ["المشغّل", place.operator],
      ["الحي المسجل", place.neighbourhood],
      ["ساعات العمل المسجلة", place.openingHours],
      ["إمكانية الوصول", place.wheelchair],
    ].filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      .map(([propertyName, value]) => ({
        "@type": "PropertyValue",
        name: propertyName,
        value: String(value),
      })),
  };
  const schemaJson = JSON.stringify(schema).replaceAll("<", "\\u003c");
  const robots = indexable ? "index, follow" : "noindex, follow";
  const sourceText = `بيانات هذا المكان مستمدة من مساهمي OpenStreetMap بموجب رخصة ODbL. قد تكون بعض التفاصيل ناقصة أو قديمة؛ يرجى التحقق قبل الزيارة.`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta name="robots" content="${robots}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles/site.css">
<script type="application/ld+json">${schemaJson}</script>
</head>
<body>
<a class="skip-link" href="#main">تخطَّ إلى المحتوى</a>
<header class="site-header"><div class="wrap">
  <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">✦</span><span>دليل السعودية</span></a>
  <nav class="main-nav" aria-label="الأقسام الرئيسية"><a href="/regions/">المناطق</a><a href="/categories/">الأقسام</a><a href="/about/data-sources/">مصدر البيانات</a></nav>
</div></header>
<nav class="breadcrumbs" aria-label="مسار التصفح"><div class="wrap">
  <a href="/">الرئيسية</a><span class="sep" aria-hidden="true">/</span>
  <a href="/city/${escapeHtml(city.slug)}/">${cityName}</a><span class="sep" aria-hidden="true">/</span>
  <span aria-current="page">${name}</span>
</div></nav>
<main id="main">
  <section class="place-detail">
    <p class="eyebrow">${categoryName} · ${cityName}</p>
    <h1>${name}</h1>
    <p>${escapeHtml(categoryName)} في ${cityName}${place.neighbourhood ? `، ضمن حي ${escapeHtml(place.neighbourhood)}` : ""}. تعرض الصفحة البيانات المسجلة للموقع والنشاط ووسائل التواصل عند توفرها.</p>
    <dl class="place-facts">
      ${detailRows || '<div class="place-fact"><dt>التفاصيل</dt><dd>لم ترد معلومات اتصال أو عنوان إضافية في مصدر البيانات الحالي.</dd></div>'}
      <div class="place-fact"><dt>الإحداثيات</dt><dd dir="ltr">${lat.toFixed(6)}, ${lon.toFixed(6)}</dd></div>
    </dl>
    <div class="place-actions">
      <a class="action-link" href="${escapeHtml(mapUrl.href)}" rel="noopener nofollow" target="_blank">فتح الموقع في OpenStreetMap</a>
      <a class="action-link secondary" href="/city/${escapeHtml(city.slug)}/">العودة إلى دليل ${cityName}</a>
    </div>
  </section>
  <section class="section place-map">
    <h2>موقع المكان على الخريطة</h2>
    <iframe src="${escapeHtml(embedUrl.href)}" title="خريطة موقع ${name}" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>
    <p class="map-credit">الخريطة © <a href="https://www.openstreetmap.org/copyright" rel="noopener">مساهمو OpenStreetMap</a>.</p>
  </section>
  <aside class="source-note">
    <p>${sourceText}</p>
    <p>المصدر: <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> · <a href="https://opendatacommons.org/licenses/odbl/" rel="noopener">ODbL</a>
    ${fetched ? ` · آخر جلب للبيانات: ${escapeHtml(fetched)}` : ""}</p>
  </aside>
</main>
<footer class="site-footer"><div class="wrap">
  <p>دليل السعودية — دليل المدن والخدمات والأماكن.</p>
  <p><a href="/about/data-sources/">مصادر البيانات</a> · <a href="/legal/weather-notice/">سياسة بيانات الطقس</a></p>
</div></footer>
</body>
</html>`;
}
