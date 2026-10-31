import { escapeHtml, safeHttpUrl } from "./util.mjs";
import { renderPage } from "./layout.mjs";

function sourceLink(name, url, label) {
  const safe = safeHttpUrl(url);
  if (!safe) return escapeHtml(name || label || "المصدر الرسمي");
  return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(name || label || "المصدر الرسمي")}</a>`;
}

export function statisticsIndexPage(statistics = []) {
  const cards = statistics.map((item) => `<li class="stat-card">
    <a href="/statistics/${escapeHtml(item.slug)}/">
      <span class="stat-category">${escapeHtml(item.categoryAr || "إحصاءات")}</span>
      <strong class="stat-value">${escapeHtml(item.value)} <small>${escapeHtml(item.unitAr || "")}</small></strong>
      <span class="stat-title">${escapeHtml(item.titleAr)}</span>
      <span class="stat-period">${escapeHtml(item.periodAr)}</span>
    </a>
  </li>`).join("");

  const body = `
  <section class="hero">
    <h1>إحصاءات ومؤشرات السعودية</h1>
    <p>لوحة مبسطة لمؤشرات مختارة من الهيئة العامة للإحصاء. نعرض قيمة المؤشر وفترته ونطاقه ومصدره، ونوضح ما تقيسه الأرقام وما لا تعنيه.</p>
  </section>
  <section class="section">
    <h2>المؤشرات المتاحة</h2>
    <ul class="stat-grid">${cards}</ul>
  </section>
  <section class="section">
    <h2>مصادر البيانات ومنهجيتها</h2>
    <p>المصدر الأساسي لهذه المؤشرات هو الهيئة العامة للإحصاء. للاطلاع على الجداول التفصيلية والمنهجية والبيانات القابلة لإعادة الاستخدام، انتقل إلى <a href="https://www.stats.gov.sa/ar/data-table" target="_blank" rel="noopener noreferrer nofollow">جداول البيانات الإحصائية</a> أو <a href="https://dp.stats.gov.sa/?locale=ar" target="_blank" rel="noopener noreferrer nofollow">بوابة مطوري واجهات API</a>.</p>
    <p>تختلف الفترات الإحصائية بين سنوي وربع سنوي وشهري. لا تقارن قيمتين قبل التأكد من وحدة القياس والنطاق السكاني والمنهجية والفترة المرجعية.</p>
  </section>
  <aside class="source-note">
    <strong>ملاحظة:</strong> تُعرض الأرقام كما وردت في المصدر للفترة المحددة، ولا تعني بالضرورة أنها أحدث قيمة متاحة وقت قراءة الصفحة. يوضح كل سجل تاريخ التحقق ورابط المصدر.
  </aside>`;

  return renderPage({
    title: "إحصاءات السعودية ومؤشرات السكان وسوق العمل | دليل السعودية",
    description: "مؤشرات مختارة عن سكان السعودية والبطالة وسوق العمل، مع الفترة المرجعية والمصدر الرسمي وطريقة قراءة الأرقام.",
    canonicalPath: "/statistics/",
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الإحصاءات", path: "/statistics/" },
    ],
  });
}

export function statisticDetailPage(item) {
  if (!item || !/^[a-z0-9-]+$/.test(String(item.slug || ""))) {
    throw new TypeError("سجل المؤشر أو رابطه غير صالح.");
  }
  const mainSource = sourceLink(item.sourceName, item.sourceUrl, "الهيئة العامة للإحصاء");
  const datasetSource = item.datasetUrl
    ? `<p>التصنيف أو مجموعة البيانات المرتبطة: ${sourceLink("صفحة بيانات المؤشر", item.datasetUrl)}</p>`
    : "";

  const body = `
  <section class="hero">
    <p class="eyebrow">${escapeHtml(item.categoryAr || "إحصاءات السعودية")}</p>
    <h1>${escapeHtml(item.titleAr)}</h1>
    <div class="stat-highlight">
      <strong>${escapeHtml(item.value)}</strong>
      <span>${escapeHtml(item.unitAr || "")}</span>
    </div>
    <p class="stat-period">الفترة المرجعية: ${escapeHtml(item.periodAr || "غير محددة")}</p>
    <p class="stat-scope">النطاق: ${escapeHtml(item.scopeAr || "المملكة العربية السعودية")}</p>
  </section>
  <section class="section">
    <h2>ماذا يقيس المؤشر؟</h2>
    <p>${escapeHtml(item.explanationAr || item.summaryAr || "")}</p>
  </section>
  <section class="section">
    <h2>كيف تقرأ الرقم؟</h2>
    <p>${escapeHtml(item.howToReadAr || "")}</p>
    ${item.valueNotes ? `<p>${escapeHtml(item.valueNotes)}</p>` : ""}
  </section>
  <section class="section">
    <h2>المصدر وفترة التحقق</h2>
    <p>المصدر: ${mainSource}</p>
    ${datasetSource}
    <p>آخر تحقق من المؤشر: <time datetime="${escapeHtml(item.verifiedAt || "")}">${escapeHtml(item.verifiedAt || "غير محدد")}</time>.</p>
    <p>عند الحاجة إلى استخدام الرقم في بحث أو قرار رسمي، راجع النشرة أو ملف البيانات والمنهجية المنشورة لدى الهيئة.</p>
  </section>
  <p><a href="/statistics/">العودة إلى جميع المؤشرات</a></p>`;

  return renderPage({
    title: `${item.titleAr} — ${item.value} ${item.unitAr || ""} | دليل السعودية`,
    description: item.summaryAr,
    canonicalPath: `/statistics/${item.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الإحصاءات", path: "/statistics/" },
      { name: item.titleAr, path: `/statistics/${item.slug}/` },
    ],
  });
}
