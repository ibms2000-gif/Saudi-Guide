import { escapeHtml } from "./util.mjs";
import { renderPage, dataAttributionNote } from "./layout.mjs";
import { SITE } from "./config.mjs";

function placeCard(p) {
  const bits = [];
  if (p.address) bits.push(escapeHtml(p.address));
  if (p.openingHours) bits.push(`ساعات العمل: ${escapeHtml(p.openingHours)}`);
  const mapHref = `https://www.openstreetmap.org/${p.osmType}/${p.osmId}`;
  return `<li class="place-card">
    <h3>${escapeHtml(p.name)}</h3>
    ${bits.length ? `<p class="meta">${bits.join(" · ")}</p>` : ""}
    <p class="place-links">
      ${p.website ? `<a href="${escapeHtml(p.website)}" rel="noopener nofollow">الموقع الإلكتروني</a>` : ""}
      ${p.phone ? `<a href="tel:${escapeHtml(p.phone)}">${escapeHtml(p.phone)}</a>` : ""}
      <a href="${mapHref}" rel="noopener nofollow">عرض على الخريطة</a>
    </p>
  </li>`;
}

export function homePage(model) {
  const regionLinks = model.regions
    .map((r) => {
      const n = (model.citiesByRegion[r.slug] || []).length;
      return `<li><a href="/region/${r.slug}/"><strong>${escapeHtml(r.nameAr)}</strong><span>${n} مدينة ومحافظة</span></a></li>`;
    })
    .join("");

  const featuredCities = model.cities
    .slice()
    .sort((a, b) => b.totalPlaces - a.totalPlaces)
    .slice(0, 12)
    .map(
      (c) =>
        `<li><a href="/city/${c.slug}/"><strong>${escapeHtml(c.nameAr)}</strong><span>${c.totalPlaces} مكان مصنّف</span></a></li>`,
    )
    .join("");

  const categoryLinks = model.categories
    .map(
      (cat) =>
        `<li><a href="/category/${cat.slug}/">${escapeHtml(cat.nameAr)}</a></li>`,
    )
    .join("");

  const body = `
  <section class="hero">
    <h1>دليل مدن ومحافظات المملكة العربية السعودية</h1>
    <p>تصفّح المناطق والمدن السعودية واعثر على المطاعم ومحلات التسوق والخدمات والمرافق الصحية والتعليمية والمعالم السياحية، اعتمادًا على بيانات خرائط مفتوحة المصدر يحدّثها مساهمو المجتمع.</p>
  </section>
  <section class="section">
    <h2>تصفّح حسب المنطقة</h2>
    <ul class="grid-list">${regionLinks}</ul>
  </section>
  <section class="section">
    <h2>مدن بها أكبر تغطية بيانات</h2>
    <ul class="grid-list">${featuredCities}</ul>
  </section>
  <section class="section">
    <h2>تصفّح حسب القسم</h2>
    <ul class="pill-list">${categoryLinks}</ul>
  </section>`;

  return renderPage({
    title: `${SITE.name} — دليل مدن ومحافظات المملكة`,
    description: SITE.description,
    canonicalPath: "/",
    body,
  });
}

export function regionsIndexPage(model) {
  const items = model.regions
    .map((r) => {
      const cities = model.citiesByRegion[r.slug] || [];
      return `<li><a href="/region/${r.slug}/"><strong>${escapeHtml(r.nameAr)}</strong><span>${cities.length} مدينة ومحافظة</span></a></li>`;
    })
    .join("");
  const body = `<h1>مناطق المملكة</h1><ul class="grid-list">${items}</ul>`;
  return renderPage({
    title: `مناطق المملكة العربية السعودية — ${SITE.name}`,
    description: "قائمة بمناطق المملكة العربية السعودية الثلاث عشرة ومدنها ومحافظاتها.",
    canonicalPath: "/regions/",
    body,
    breadcrumbs: [{ name: "الرئيسية", path: "/" }, { name: "المناطق", path: "/regions/" }],
  });
}

export function regionPage(model, region) {
  const cities = model.citiesByRegion[region.slug] || [];
  const items = cities
    .map(
      (c) =>
        `<li><a href="/city/${c.slug}/"><strong>${escapeHtml(c.nameAr)}</strong><span>${c.totalPlaces} مكان مصنّف</span></a></li>`,
    )
    .join("");
  const body = `
  <h1>${escapeHtml(region.nameAr)}</h1>
  <p>المدن والمحافظات المغطاة في ${escapeHtml(region.nameAr)}:</p>
  <ul class="grid-list">${items}</ul>`;
  return renderPage({
    title: `دليل ${region.nameAr} — مدن ومحافظات ${SITE.name}`,
    description: `دليل مدن ومحافظات ${region.nameAr} في المملكة العربية السعودية، مع أماكن المطاعم والخدمات والسياحة.`,
    canonicalPath: `/region/${region.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "المناطق", path: "/regions/" },
      { name: region.nameAr, path: `/region/${region.slug}/` },
    ],
  });
}

export function categoriesIndexPage(model) {
  const items = model.categories
    .map(
      (cat) =>
        `<li><a href="/category/${cat.slug}/"><strong>${escapeHtml(cat.nameAr)}</strong><span>${model.nationalByCategory[cat.slug].length} مدينة</span></a></li>`,
    )
    .join("");
  const body = `<h1>أقسام الدليل</h1><ul class="grid-list">${items}</ul>`;
  return renderPage({
    title: `أقسام الدليل — ${SITE.name}`,
    description: "تصفّح أقسام الدليل: مطاعم، تسوق، خدمات، صحة، تعليم، سياحة وفنادق.",
    canonicalPath: "/categories/",
    body,
    breadcrumbs: [{ name: "الرئيسية", path: "/" }, { name: "الأقسام", path: "/categories/" }],
  });
}

export function cityPage(model, city) {
  const catItems = model.categories
    .map((cat) => {
      const data = city.byCategory[cat.slug];
      if (!data.indexable) {
        return `<li class="muted"><span>${escapeHtml(cat.nameAr)}</span><span>قريبًا</span></li>`;
      }
      return `<li><a href="/city/${city.slug}/${cat.slug}/"><strong>${escapeHtml(cat.nameAr)}</strong><span>${data.all.length} مكان</span></a></li>`;
    })
    .join("");

  const body = `
  <h1>دليل ${escapeHtml(city.nameAr)}</h1>
  <p>${escapeHtml(city.overview || "")}</p>
  <p><a href="/region/${city.regionSlug}/">${escapeHtml(city.regionAr)}</a></p>
  <section class="section">
    <h2>الأقسام المتاحة في ${escapeHtml(city.nameAr)}</h2>
    <ul class="grid-list">${catItems}</ul>
  </section>
  ${dataAttributionNote({ cityNameAr: city.nameAr, fetchedAt: model.meta?.fetchedAt })}`;

  return renderPage({
    title: `دليل ${city.nameAr} — مطاعم، تسوق، خدمات وسياحة | ${SITE.name}`,
    description: `دليل ${city.nameAr} في ${city.regionAr}: مطاعم ومقاهي، محلات تسوق، خدمات عامة، صحة وتعليم ومعالم سياحية.`,
    canonicalPath: `/city/${city.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: city.regionAr, path: `/region/${city.regionSlug}/` },
      { name: city.nameAr, path: `/city/${city.slug}/` },
    ],
  });
}

export function cityCategoryPage(model, city, category) {
  const data = city.byCategory[category.slug];
  const subLinks = Object.keys(data.subcategories).length
    ? `<ul class="pill-list">${Object.entries(data.subcategories)
        .map(([slug]) => {
          const sub = category.subcategories.find((s) => s.slug === slug);
          return `<li><a href="/city/${city.slug}/${category.slug}/${slug}/">${escapeHtml(sub.nameAr)}</a></li>`;
        })
        .join("")}</ul>`
    : "";

  const list = data.all.map(placeCard).join("");

  const body = `
  <h1>${escapeHtml(category.nameAr)} في ${escapeHtml(city.nameAr)}</h1>
  <p>قائمة ${escapeHtml(category.singularAr)} في ${escapeHtml(city.nameAr)} (${data.all.length} عنصر).</p>
  ${subLinks}
  <ul class="place-list">${list}</ul>
  ${dataAttributionNote({ cityNameAr: city.nameAr, fetchedAt: model.meta?.fetchedAt })}`;

  return renderPage({
    title: `${category.nameAr} في ${city.nameAr} — ${SITE.name}`,
    description: `قائمة ${category.singularAr} في ${city.nameAr}، ${city.regionAr}، مع العناوين وطرق التواصل عند توفرها.`,
    canonicalPath: `/city/${city.slug}/${category.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: city.nameAr, path: `/city/${city.slug}/` },
      { name: category.nameAr, path: `/city/${city.slug}/${category.slug}/` },
    ],
  });
}

export function cityCategorySubPage(model, city, category, sub, places) {
  const list = places.map(placeCard).join("");
  const body = `
  <h1>${escapeHtml(sub.nameAr)} في ${escapeHtml(city.nameAr)}</h1>
  <p>قائمة ${escapeHtml(sub.nameAr)} ضمن قسم ${escapeHtml(category.nameAr)} في ${escapeHtml(city.nameAr)} (${places.length} عنصر).</p>
  <ul class="place-list">${list}</ul>
  ${dataAttributionNote({ cityNameAr: city.nameAr, fetchedAt: model.meta?.fetchedAt })}`;

  return renderPage({
    title: `${sub.nameAr} في ${city.nameAr} — ${SITE.name}`,
    description: `قائمة ${sub.nameAr} في ${city.nameAr} ضمن قسم ${category.nameAr}.`,
    canonicalPath: `/city/${city.slug}/${category.slug}/${sub.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: city.nameAr, path: `/city/${city.slug}/` },
      { name: category.nameAr, path: `/city/${city.slug}/${category.slug}/` },
      { name: sub.nameAr, path: `/city/${city.slug}/${category.slug}/${sub.slug}/` },
    ],
  });
}

export function categoryNationalPage(model, category) {
  const cities = model.nationalByCategory[category.slug];
  const items = cities
    .map(
      (c) =>
        `<li><a href="/city/${c.slug}/${category.slug}/"><strong>${escapeHtml(c.nameAr)}</strong><span>${c.byCategory[category.slug].all.length} مكان</span></a></li>`,
    )
    .join("");
  const body = `
  <h1>${escapeHtml(category.nameAr)} في مدن المملكة</h1>
  <p>المدن والمحافظات التي يضمّها الدليل ضمن قسم ${escapeHtml(category.nameAr)}:</p>
  <ul class="grid-list">${items}</ul>`;
  return renderPage({
    title: `${category.nameAr} — دليل حسب المدينة | ${SITE.name}`,
    description: `استعرض ${category.singularAr} في مدن ومحافظات المملكة العربية السعودية.`,
    canonicalPath: `/category/${category.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الأقسام", path: "/categories/" },
      { name: category.nameAr, path: `/category/${category.slug}/` },
    ],
  });
}

export function categoryNationalSubPage(model, category, sub, cities) {
  const items = cities
    .map(
      (c) =>
        `<li><a href="/city/${c.slug}/${category.slug}/${sub.slug}/"><strong>${escapeHtml(c.nameAr)}</strong><span>${c.byCategory[category.slug].subcategories[sub.slug].length} مكان</span></a></li>`,
    )
    .join("");
  const body = `
  <h1>${escapeHtml(sub.nameAr)} في مدن المملكة</h1>
  <p>المدن التي يضمّها الدليل ضمن ${escapeHtml(sub.nameAr)} (${escapeHtml(category.nameAr)}):</p>
  <ul class="grid-list">${items}</ul>`;
  return renderPage({
    title: `${sub.nameAr} — دليل حسب المدينة | ${SITE.name}`,
    description: `استعرض ${sub.nameAr} في مدن ومحافظات المملكة العربية السعودية.`,
    canonicalPath: `/category/${category.slug}/${sub.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الأقسام", path: "/categories/" },
      { name: category.nameAr, path: `/category/${category.slug}/` },
      { name: sub.nameAr, path: `/category/${category.slug}/${sub.slug}/` },
    ],
  });
}

export function dataSourcesPage(model) {
  const rows = model.cities
    .map((c) => {
      const status = c.totalPlaces > 0 ? `${c.totalPlaces} عنصر` : "لم يتم الجلب بعد";
      return `<tr><td>${escapeHtml(c.nameAr)}</td><td>${status}</td></tr>`;
    })
    .join("");
  const fetchedAt = model.meta?.fetchedAt
    ? new Date(model.meta.fetchedAt).toLocaleString("ar-SA")
    : "غير متوفر";

  const body = `
  <h1>مصدر البيانات</h1>
  <p>
    جميع بيانات الأماكن المعروضة في ${escapeHtml(SITE.name)} (المطاعم، المحلات، الخدمات، المرافق الصحية
    والتعليمية، والمعالم السياحية) مجمّعة آليًا من
    <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a>
    عبر <strong>Overpass API</strong>، وهي بيانات يساهم بها متطوعون حول العالم.
  </p>
  <p>
    تخضع هذه البيانات لرخصة
    <a href="https://opendatacommons.org/licenses/odbl/" rel="noopener">Open Database License (ODbL)</a>،
    والتي تتطلّب نسب المصدر عند إعادة استخدام البيانات أو مشاركتها. راجع ملف
    <a href="https://github.com/ibms2000-gif/Saudi-Guide/blob/main/data/DATA_LICENSE.md" rel="noopener">DATA_LICENSE.md</a>
    في مستودع المشروع لتفاصيل الترخيص الكاملة.
  </p>
  <p>آخر عملية تحديث للبيانات: ${escapeHtml(fetchedAt)} (بتوقيت السيرفر).</p>
  <p>
    لا تضمن ${escapeHtml(SITE.name)} اكتمال أو دقة هذه البيانات في كل وقت؛ الأسماء وساعات العمل والعناوين
    قد تتغيّر دون أن تنعكس فورًا هنا. لتصحيح معلومة أو إضافة مكان مفقود، يمكن المساهمة مباشرة عبر
    <a href="https://www.openstreetmap.org/" rel="noopener">OpenStreetMap</a> وستظهر التحديثات في الجلب التالي.
  </p>
  <h2>تغطية البيانات حسب المدينة</h2>
  <table class="data-table"><thead><tr><th>المدينة</th><th>عدد العناصر المصنّفة</th></tr></thead><tbody>${rows}</tbody></table>`;

  return renderPage({
    title: `مصدر البيانات — ${SITE.name}`,
    description: "توضيح مصدر بيانات الأماكن في دليل السعودية وترخيصها وآلية تحديثها.",
    canonicalPath: "/about/data-sources/",
    body,
    breadcrumbs: [{ name: "الرئيسية", path: "/" }, { name: "مصدر البيانات", path: "/about/data-sources/" }],
  });
}

export function weatherNoticePage() {
  const body = `
  <h1>لماذا لا يعرض الموقع حالة الطقس أو درجات الحرارة؟</h1>
  <p>
    يُلزم نظام الأرصاد الجوية في المملكة العربية السعودية كل من يرغب بتقديم خدمات أرصاد جوية أو نشر
    معلومات أو بيانات أرصاد جوية (بما في ذلك توقعات الطقس أو درجات الحرارة) عبر موقع إلكتروني أو أي
    وسيلة أخرى، بالحصول على ترخيص أو تصريح من الجهة المختصة (المركز الوطني للأرصاد) بحسب طبيعة النشاط.
  </p>
  <p>
    تجنّبًا لأي مخالفة، لا يعرض ${escapeHtml(SITE.name)} حاليًا أي توقعات جوية أو درجات حرارة أو حالة طقس
    حيّة لأي مدينة أو محافظة، ولا ينشئ أو ينقل بيانات أرصاد من أي مصدر. هذه الصفحة إعلام عام وليست
    استشارة قانونية.
  </p>
  <p>
    للاطلاع على حالة الطقس والتوقعات الرسمية في المملكة، يُرجى زيارة الموقع الرسمي للمركز الوطني للأرصاد:
    <a href="https://ncm.gov.sa" rel="noopener">ncm.gov.sa</a>.
  </p>
  <p>
    إن كانت لديكم ملاحظة أو ترخيصًا ساري المفعول يسمح بنشر هذا النوع من المحتوى، يمكن التواصل معنا
    لإعادة النظر في هذه السياسة.
  </p>`;
  return renderPage({
    title: `سياسة عرض بيانات الطقس — ${SITE.name}`,
    description: "توضيح سبب عدم عرض توقعات الطقس أو درجات الحرارة في دليل السعودية التزامًا باللوائح السعودية.",
    canonicalPath: "/legal/weather-notice/",
    body,
    breadcrumbs: [{ name: "الرئيسية", path: "/" }, { name: "سياسة بيانات الطقس", path: "/legal/weather-notice/" }],
  });
}

export function notFoundPage() {
  const body = `
  <h1>الصفحة غير موجودة</h1>
  <p>عذرًا، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.</p>
  <p><a href="/">العودة إلى الصفحة الرئيسية</a></p>`;
  return renderPage({
    title: `الصفحة غير موجودة — ${SITE.name}`,
    description: "الصفحة المطلوبة غير متوفرة.",
    canonicalPath: "/404/",
    body,
    noindex: true,
  });
}
