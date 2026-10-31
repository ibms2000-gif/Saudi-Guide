import { escapeHtml, safeHttpUrl } from "./util.mjs";
import { renderPage } from "./layout.mjs";
import { SITE } from "./config.mjs";

function safeSlug(value) {
  return /^[a-z0-9-]+$/.test(String(value || ""));
}

function sourceLinks(sources = []) {
  return sources.map((source) => {
    const url = safeHttpUrl(source.url);
    return `<li>
      ${url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(source.name)}</a>`
        : escapeHtml(source.name)}
      ${source.role ? `<span> — ${escapeHtml(source.role)}</span>` : ""}
    </li>`;
  }).join("");
}

function bulletList(items = []) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

export function benefitsIndexPage(benefits = []) {
  const groups = new Map();
  for (const benefit of benefits) {
    const group = benefit.categoryAr || "برامج ومنافع";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(benefit);
  }

  const sections = [...groups.entries()].map(([category, items]) => `
    <section class="section">
      <h2>${escapeHtml(category)}</h2>
      <ul class="grid-list benefit-grid">
        ${items.map((benefit) => `<li>
          <a href="/benefits/${escapeHtml(benefit.slug)}/">
            <strong>${escapeHtml(benefit.nameAr)}</strong>
            <span>${escapeHtml(benefit.summaryAr)}</span>
            <span class="benefit-more">عرض الدليل والشروط والمصدر ←</span>
          </a>
        </li>`).join("")}
      </ul>
    </section>`).join("");

  const body = `
  <section class="hero">
    <h1>الدعم الحكومي والمنافع في السعودية</h1>
    <p>أدلة منظمة للبرامج الحكومية: ما الخدمة؟ من الجهة المسؤولة؟ ما الشروط المنشورة؟ كيف تقدم الطلب؟ وأين تتابع الأهلية والصرف؟ نربط كل معلومة بمصدرها الرسمي ونوضح تاريخ التحقق.</p>
  </section>
  <aside class="source-note">
    <strong>تنبيه مهم:</strong>
    هذه الأدلة للتوعية وتبسيط المعلومات العامة، وليست قرار أهلية أو استشارة نظامية أو ضمانًا باستحقاق مبلغ. المرجع النهائي هو الجهة الحكومية وحساب المستفيد.
  </aside>
  ${sections || "<p>سيتم إضافة البرامج بعد التحقق من مصادرها الرسمية.</p>"}
  <section class="section">
    <h2>كيف نحدّث المعلومات؟</h2>
    <p>نراجع صفحات الجهات الرسمية ونوثق مصدر كل معلومة وتاريخ آخر تحقق. قد تتغير الأنظمة والمواعيد؛ لهذا نوضح ما يحتاج إلى تأكيد من المستفيد أو الجهة.</p>
  </section>`;

  return renderPage({
    title: `الدعم الحكومي والمنافع في السعودية — ${SITE.name}`,
    description: "دليل الضمان الاجتماعي وحساب المواطن والتقاعد والتأمينات وإعانة ذوي الإعاقة، مع الشروط العامة وخطوات التقديم والمصادر الرسمية.",
    canonicalPath: "/benefits/",
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الدعم والمنافع", path: "/benefits/" },
    ],
  });
}

export function benefitDetailPage(benefit) {
  if (!benefit || !safeSlug(benefit.slug)) {
    throw new TypeError("سجل البرنامج أو رابط البرنامج غير صالح.");
  }

  const sourceRows = sourceLinks(benefit.sources);
  const points = bulletList(benefit.keyPoints);
  const steps = bulletList(benefit.steps);
  const cautions = bulletList(benefit.cautions);
  const serviceUrl = safeHttpUrl(benefit.serviceUrl);

  const body = `
  <section class="hero">
    <p class="eyebrow">${escapeHtml(benefit.categoryAr || "الدعم الحكومي")}</p>
    <h1>${escapeHtml(benefit.nameAr)}</h1>
    <p>${escapeHtml(benefit.introAr)}</p>
    <p class="verified-date">آخر تحقق من المصادر: <time datetime="${escapeHtml(benefit.verifiedAt || "")}">${escapeHtml(benefit.verifiedAt || "غير محدد")}</time></p>
  </section>
  <section class="section">
    <h2>أهم المعلومات</h2>
    <ul class="benefit-facts">${points}</ul>
  </section>
  <section class="section">
    <h2>خطوات التقديم والمتابعة</h2>
    <ol class="benefit-steps">${steps}</ol>
  </section>
  <section class="section benefit-timing">
    <h2>${escapeHtml(benefit.timingTitleAr || "المواعيد")}</h2>
    <p>${escapeHtml(benefit.timingAr || "راجع الجهة الحكومية لمعرفة أحدث المواعيد المعلنة.")}</p>
  </section>
  <section class="section">
    <h2>تنبيهات قبل التقديم</h2>
    <ul class="benefit-cautions">${cautions}</ul>
  </section>
  <section class="section official-action">
    <h2>الخدمة الحكومية الرسمية</h2>
    <p>لإتمام الطلب أو معرفة نتيجة أهليتك، استخدم الخدمة الرسمية التابعة للجهة الحكومية.</p>
    ${serviceUrl ? `<p><a class="action-link" href="${escapeHtml(serviceUrl)}" target="_blank" rel="noopener noreferrer">الانتقال إلى ${escapeHtml(benefit.serviceName || "الخدمة الرسمية")}</a></p>` : ""}
  </section>
  <section class="section">
    <h2>المصادر والمراجع</h2>
    <ul class="benefit-sources">${sourceRows}</ul>
    <p class="source-note">راجعنا المصادر المدرجة بتاريخ ${escapeHtml(benefit.verifiedAt || "غير محدد")}. قد تتغير الشروط والأنظمة بعد هذا التاريخ؛ نحدّث الصفحة عند التحقق من تعديل رسمي.</p>
  </section>
  <p><a href="/benefits/">العودة إلى دليل الدعم والمنافع</a></p>`;

  return renderPage({
    title: `${benefit.nameAr} — الشروط وخطوات التقديم والمصدر الرسمي | ${SITE.name}`,
    description: benefit.summaryAr,
    canonicalPath: `/benefits/${benefit.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الدعم والمنافع", path: "/benefits/" },
      { name: benefit.nameAr, path: `/benefits/${benefit.slug}/` },
    ],
  });
}
