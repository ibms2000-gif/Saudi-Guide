import { escapeHtml, safeHttpUrl } from "./util.mjs";
import { renderPage } from "./layout.mjs";
import { SITE } from "./config.mjs";
import { formatSaudiDate, nextAnnualOccurrence, riyadhDateIso } from "./calendar.mjs";

const NUMBER = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 });

function isoFromUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

export function nextMonthlyOccurrence(day, now = new Date(), rule = "none") {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new TypeError("يوم الصرف يجب أن يكون بين 1 و31.");
  }
  const today = riyadhDateIso(now);
  const [currentYear, currentMonth] = today.split("-").map(Number);

  for (let offset = 0; offset < 14; offset += 1) {
    const monthIndex = currentMonth - 1 + offset;
    const year = currentYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const date = new Date(Date.UTC(year, month - 1, Math.min(day, lastDay)));

    if (rule === "citizen-account") {
      const weekday = date.getUTCDay();
      if (weekday === 5) date.setUTCDate(date.getUTCDate() - 1);
      if (weekday === 6) date.setUTCDate(date.getUTCDate() + 1);
    }

    const isoDate = isoFromUtcDate(date);
    if (isoDate >= today) {
      return {
        isoDate,
        targetIso: `${isoDate}T00:00:00+03:00`,
      };
    }
  }
  throw new Error("تعذر العثور على موعد شهري قادم.");
}

function sourceLink(name, url) {
  const safe = safeHttpUrl(url);
  return safe
    ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(name)}</a>`
    : escapeHtml(name || "غير محدد");
}

function countdownCard(item, now, recurring = false) {
  const next = recurring
    ? nextMonthlyOccurrence(item.day, now, item.rule)
    : { isoDate: item.date, targetIso: `${item.date}T00:00:00+03:00` };
  const status = item.statusAr
    ? `<span class="countdown-status">${escapeHtml(item.statusAr)}</span>`
    : "";
  const recurringAttrs = recurring
    ? ` data-countdown-recurring-day="${item.day}" data-countdown-rule="${escapeHtml(item.rule || "none")}"`
    : "";
  return `<li class="event-card countdown-card" data-countdown-group="${escapeHtml(item.group || "")}">
    <h3>${escapeHtml(item.nameAr)}</h3>
    <p>${escapeHtml(item.descriptionAr)}</p>
    <p class="event-date">الموعد القادم: <strong data-countdown-date>${escapeHtml(formatSaudiDate(next.isoDate))}</strong></p>
    <div class="countdown" data-countdown-target="${escapeHtml(next.targetIso)}"${recurringAttrs}>
      <span class="countdown-label">الوقت المتبقي</span>
      <strong class="countdown-value" aria-live="off">جارٍ حساب الوقت المتبقي…</strong>
    </div>
    ${status}
    <p class="event-source">المصدر: ${sourceLink(item.sourceName, item.sourceUrl)}</p>
    <p class="countdown-note">${escapeHtml(item.noteAr || "")}</p>
  </li>`;
}

function privateSalaryCard() {
  return `<section class="section calendar-feature private-salary-panel">
    <h2>موعد راتبك في القطاع الخاص</h2>
    <p>تختلف مواعيد الرواتب بين المنشآت بحسب العقد أو لائحة تنظيم العمل. أدخل يوم الراتب الذي حددته جهة عملك لعرض عدّاد شخصي داخل متصفحك.</p>
    <form data-private-salary-form class="private-salary-form">
      <label for="private-salary-day">يوم نزول الراتب كل شهر (1–31)</label>
      <input id="private-salary-day" name="day" type="number" min="1" max="31" value="27" required>
      <button type="submit">اعرض العد التنازلي</button>
    </form>
    <div class="private-salary-result" data-private-salary-card hidden>
      <h3>موعد راتبك حسب اليوم الذي أدخلته</h3>
      <div class="countdown" data-countdown-target="">
        <span class="countdown-label">موعدك الشهري المحسوب</span>
        <strong class="countdown-value" aria-live="off">أدخل اليوم أعلاه لبدء العدّ</strong>
      </div>
      <p class="countdown-note">هذا حساب شخصي بحسب اليوم الذي أدخلته، ولا يرسل بياناتك إلى الموقع ولا يعني أن هذا الموعد مفروض على جميع منشآت القطاع الخاص.</p>
    </div>
  </section>`;
}

function groupSection(title, cards) {
  if (!cards) return "";
  return `<section class="section countdown-section">
    <h2>${escapeHtml(title)}</h2>
    <ul class="event-grid">${cards}</ul>
  </section>`;
}

export function countdownsToolPage({ countdowns = { fixedEvents: [], monthlyEvents: [] }, events = [], salarySchedules = [], now = new Date() } = {}) {
  const today = riyadhDateIso(now);
  const nextSalary = salarySchedules
    .flatMap((schedule) => (schedule.dates || []).map((item) => ({ ...item, schedule })))
    .filter((item) => item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const salaryCard = nextSalary
    ? countdownCard({
        nameAr: "راتب الموظفين الحكوميين",
        descriptionAr: `موعد الصرف الوارد في جدول وزارة المالية لعام ${nextSalary.schedule.year}.`,
        date: nextSalary.date,
        statusAr: "جدول رسمي قابل للتغيير",
        sourceName: nextSalary.schedule.sourceName,
        sourceUrl: nextSalary.schedule.sourceUrl,
        noteAr: "تنص وزارة المالية على أن مواعيد الجدول قابلة للتغيير؛ تحقق من آخر إعلان قبل الاعتماد على الموعد.",
      }, now)
    : `<li class="event-card"><h3>راتب الموظفين الحكوميين</h3><p>لم يُنشر في بيانات الدليل جدول رسمي قادم. نضيف الموعد عند توفر جدول وزارة المالية.</p></li>`;

  const monthlyCards = countdowns.monthlyEvents
    .map((item) => countdownCard(item, now, true))
    .join("");

  const fixedCards = countdowns.fixedEvents
    .filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || "")) && item.date >= today)
    .map((item) => countdownCard(item, now))
    .join("");

  const annualCards = events
    .filter((event) => event.kind === "fixed-annual" && event.status === "official")
    .map((event) => {
      const next = nextAnnualOccurrence(event, now);
      return `<li class="event-card countdown-card">
        <h3>${escapeHtml(event.nameAr)}</h3>
        <p>${escapeHtml(event.descriptionAr)}</p>
        <p class="event-date">الموعد القادم: <strong data-countdown-date>${escapeHtml(formatSaudiDate(next.isoDate))}</strong></p>
        <div class="countdown" data-countdown-target="${escapeHtml(next.targetIso)}" data-countdown-month="${event.month}" data-countdown-day="${event.day}">
          <span class="countdown-label">الوقت المتبقي</span>
          <strong class="countdown-value" aria-live="off">جارٍ حساب الوقت المتبقي…</strong>
        </div>
        <span class="countdown-status">موعد سنوي ثابت</span>
        <p class="event-source">المصدر: ${sourceLink(event.sourceName, event.sourceUrl)}</p>
        <p class="countdown-note">قد تختلف أيام تعطيل الجهات عن تاريخ المناسبة نفسها؛ راجع إعلان الجهة المختصة بالإجازة.</p>
      </li>`;
    })
    .join("");

  const body = `
  <section class="hero">
    <p class="eyebrow">أداة مواعيد مجانية</p>
    <h1>كم باقي؟ — العد التنازلي للمواعيد في السعودية</h1>
    <p>تابع مواعيد الرواتب والدعم الحكومي ورمضان والعيد والحج والفصول الدراسية والإجازات. العدادات تعمل وفق توقيت المملكة العربية السعودية، ونوضح بجانب كل موعد ما إذا كان رسميًا أو تقديريًا.</p>
  </section>
  ${privateSalaryCard()}
  ${groupSection("الرواتب والدعم الحكومي", salaryCard + monthlyCards)}
  ${groupSection("المناسبات الإسلامية والحج", fixedCards.split("</li>").filter((card) => card.includes("المناسبات الإسلامية")).map((card) => card + "</li>").join(""))}
  ${groupSection("الدراسة والإجازات", fixedCards.split("</li>").filter((card) => card.includes("الدراسة والإجازات")).map((card) => card + "</li>").join(""))}
  ${groupSection("الفصول والمواسم", fixedCards.split("</li>").filter((card) => card.includes("الفصول")).map((card) => card + "</li>").join(""))}
  ${groupSection("المناسبات الوطنية", annualCards)}
  <section class="section source-note">
    <p>نحدّث المواعيد عند نشر الجهات المختصة جداول جديدة. تواريخ تقويم أم القرى للمناسبات الإسلامية تقديرية إلى أن يثبت دخول الشهر بالإعلان الشرعي. لا تُعد هذه الصفحة إشعارًا رسميًا باستحقاق دعم أو صرف مبلغ.</p>
    <p><a href="/calendar/">الاطلاع على التقويم السعودي وجداول الرواتب</a> · <a href="/tools/">العودة إلى الأدوات والحاسبات</a></p>
  </section>`;

  return renderPage({
    title: `كم باقي؟ — عداد الرواتب ورمضان والعيد والدراسة | ${SITE.name}`,
    description: "عداد تنازلي لمواعيد صرف الرواتب الحكومية والضمان والتأهيل وحساب المواطن والتقاعد، ورمضان والعيد والحج وإجازات المدارس والشتاء في السعودية.",
    canonicalPath: "/tools/countdowns/",
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الأدوات والحاسبات", path: "/tools/" },
      { name: "كم باقي؟", path: "/tools/countdowns/" },
    ],
  });
}
