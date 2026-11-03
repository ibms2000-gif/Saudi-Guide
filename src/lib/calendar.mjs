import { escapeHtml, safeHttpUrl } from "./util.mjs";
import { renderPage } from "./layout.mjs";
import { SITE } from "./config.mjs";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function riyadhDateIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function nextAnnualOccurrence(event, now = new Date()) {
  if (!Number.isInteger(event?.month) || event.month < 1 || event.month > 12) {
    throw new TypeError("شهر المناسبة غير صالح.");
  }
  if (!Number.isInteger(event?.day) || event.day < 1 || event.day > 31) {
    throw new TypeError("يوم المناسبة غير صالح.");
  }

  const today = riyadhDateIso(now);
  const currentYear = Number(today.slice(0, 4));
  let year = currentYear;
  let isoDate = makeIsoDate(year, event.month, event.day);
  if (isoDate < today) {
    year += 1;
    isoDate = makeIsoDate(year, event.month, event.day);
  }
  return {
    year,
    isoDate,
    targetIso: `${isoDate}T00:00:00+03:00`,
  };
}

function makeIsoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError("تاريخ المناسبة غير موجود في التقويم الميلادي.");
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatSaudiDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function countdownMarkup(targetIso, label = "الوقت المتبقي", annualEvent = null) {
  const annualAttrs = annualEvent
    ? ` data-countdown-month="${annualEvent.month}" data-countdown-day="${annualEvent.day}"`
    : "";
  return `<div class="countdown" data-countdown-target="${escapeHtml(targetIso)}"${annualAttrs}>
    <span class="countdown-label">${escapeHtml(label)}</span>
    <strong class="countdown-value" aria-live="off">جارٍ حساب الوقت المتبقي…</strong>
  </div>`;
}

function sourceNote(sourceName, sourceUrl, note) {
  const safeUrl = safeHttpUrl(sourceUrl);
  return `<aside class="source-note">
    <p>${escapeHtml(note)}</p>
    <p>المصدر: ${safeUrl
      ? `<a href="${escapeHtml(safeUrl)}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(sourceName)}</a>`
      : escapeHtml(sourceName)}</p>
  </aside>`;
}

function eventCard(event, now) {
  const next = nextAnnualOccurrence(event, now);
  return `<li class="event-card">
    <h3><a href="/calendar/events/${escapeHtml(event.slug)}/">${escapeHtml(event.nameAr)}</a></h3>
    <p>${escapeHtml(event.descriptionAr)}</p>
    <p class="event-date">الموعد القادم: <strong data-next-annual-date>${escapeHtml(formatSaudiDate(next.isoDate))}</strong></p>
    ${countdownMarkup(next.targetIso, "الوقت المتبقي", event)}
    <p class="event-source">الحالة: موعد سنوي رسمي · ${escapeHtml(event.scopeAr || "السعودية")}</p>
  </li>`;
}

export function calendarHomePage({ events = [], schoolCalendars = [], salarySchedules = [], now = new Date() }) {
  const cards = events
    .filter((event) => event.kind === "fixed-annual" && event.status === "official")
    .map((event) => eventCard(event, now))
    .join("");

  const today = riyadhDateIso(now);
  const nextSalary = salarySchedules
    .flatMap((schedule) => (schedule.dates || []).map((item) => ({ ...item, schedule })))
    .filter((item) => item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const salarySummary = nextSalary
    ? `<article class="calendar-feature">
        <h3>موعد صرف راتب الموظفين الحكوميين القادم</h3>
        <p class="event-date"><strong>${escapeHtml(formatSaudiDate(nextSalary.date))}</strong></p>
        ${countdownMarkup(`${nextSalary.date}T00:00:00+03:00`, "العد التنازلي إلى تاريخ الصرف")}
        <p>وفق جدول وزارة المالية لعام ${nextSalary.schedule.year}، مع ملاحظة أن الوزارة توضح أن التواريخ قابلة للتغيير.</p>
        <p><a href="/calendar/salaries/${nextSalary.schedule.year}/">عرض جدول الرواتب الكامل لعام ${nextSalary.schedule.year}</a></p>
      </article>`
    : `<article class="calendar-feature"><h3>مواعيد الرواتب</h3><p>لم يُضف جدول رسمي قادم بعد. نعرض المواعيد عند توفر مصدر رسمي موثق.</p></article>`;

  const body = `
  <section class="hero">
    <h1>التقويم السعودي والمناسبات ومواعيد الصرف</h1>
    <p>مرجع منظم للمناسبات الوطنية ومواعيد الصرف المعلنة. نوضح مصدر كل تاريخ ونميز بين الموعد الرسمي والتقديري، ولا نعرض التواريخ غير المعلنة وكأنها مؤكدة.</p>
  </section>
  <section class="section">
    <h2>المناسبات الوطنية القادمة</h2>
    ${cards ? `<ul class="event-grid">${cards}</ul>` : "<p>لا توجد مناسبات منشورة حاليًا.</p>"}
  </section>
  <section class="section">
    <h2>الرواتب ومواعيد الصرف</h2>
    ${salarySummary}
  </section>
  <section class="section">
    <h2>التقويم الدراسي والإجازات</h2>
    ${schoolCalendars.filter(isSchoolCalendarValid).length
      ? `<ul class="grid-list">${schoolCalendars.filter(isSchoolCalendarValid).map((calendar) => `<li><a href="/calendar/schools/${escapeHtml(calendar.slug)}/"><strong>${escapeHtml(calendar.academicYear)}</strong><span>${escapeHtml(calendar.regionNameAr)}</span></a></li>`).join("")}</ul>`
      : "<p>ستظهر جداول الدراسة والإجازات عند توفر تواريخ موثقة من الجهة التعليمية المختصة.</p>"}
  </section>
  <section class="section">
    <h2>مناسبات نضيف مواعيدها بعد الإعلان الرسمي</h2>
    <p>رمضان، عيد الفطر، عيد الأضحى، الحج، يوم عرفة، التقويم الدراسي والإجازات. لن ننشر موعدًا نهائيًا قبل توفر إعلان أو تقويم رسمي معتمد.</p>
  </section>
  <p class="source-note">جميع الأوقات والعدادات محسوبة على توقيت المملكة العربية السعودية (UTC+03:00). راجع المصدر الرسمي قبل اتخاذ قرار يعتمد على موعد قابل للتغيير.</p>`;

  return renderPage({
    title: `التقويم السعودي والمناسبات ومواعيد الرواتب | ${SITE.name}`,
    description: "تابع المناسبات الوطنية القادمة ومواعيد الرواتب الحكومية المنشورة مع العد التنازلي والمصادر الرسمية.",
    canonicalPath: "/calendar/",
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "التقويم والمواعيد", path: "/calendar/" },
    ],
  });
}

export function annualEventPage(event, now = new Date()) {
  const next = nextAnnualOccurrence(event, now);
  const body = `
  <section class="hero">
    <p class="eyebrow">مناسبة وطنية · ${escapeHtml(event.scopeAr || "المملكة العربية السعودية")}</p>
    <h1>${escapeHtml(event.nameAr)}</h1>
    <p>${escapeHtml(event.descriptionAr)}</p>
  </section>
  <section class="section calendar-feature">
    <h2>الموعد القادم</h2>
    <p class="event-date"><strong data-next-annual-date>${escapeHtml(formatSaudiDate(next.isoDate))}</strong></p>
    ${countdownMarkup(next.targetIso, "الوقت المتبقي حتى المناسبة", event)}
    <p>تاريخ المناسبة السنوي: ${String(event.day).padStart(2, "0")}/${String(event.month).padStart(2, "0")} من كل عام ميلادي.</p>
  </section>
  <section class="section">
    <h2>معلومات عن المناسبة</h2>
    <p>${escapeHtml(event.descriptionAr)}</p>
    <p>النطاق: ${escapeHtml(event.scopeAr || "المملكة العربية السعودية")}.</p>
    <p>لا يعني تاريخ المناسبة بالضرورة أن مواعيد تعطيل جميع الجهات واحدة؛ يُرجى الرجوع إلى إعلان الجهة المعنية بالإجازة.</p>
  </section>
  ${sourceNote(event.sourceName, event.sourceUrl, "تم اعتماد الموعد السنوي بناءً على المصدر المشار إليه. تاريخ الإجازة أو ترتيبات الدوام قد تخضع لإعلانات منفصلة.")}`;

  const safeSlug = escapeHtml(event.slug);
  return renderPage({
    title: `${event.nameAr} — الموعد والعد التنازلي | ${SITE.name}`,
    description: `تعرف على موعد ${event.nameAr} السنوي، العد التنازلي والمعلومات التاريخية والمصدر الرسمي.`,
    canonicalPath: `/calendar/events/${safeSlug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "التقويم والمواعيد", path: "/calendar/" },
      { name: event.nameAr, path: `/calendar/events/${safeSlug}/` },
    ],
  });
}

export function salarySchedulePage(schedule) {
  const rows = (schedule.dates || [])
    .map((item) => `<tr>
      <td>${escapeHtml(MONTHS_AR[item.month - 1] || item.month)}</td>
      <td>${escapeHtml(item.weekdayAr || "")}</td>
      <td><time datetime="${escapeHtml(item.date)}">${escapeHtml(formatSaudiDate(item.date))}</time></td>
      <td>${escapeHtml(item.hijri || "—")}</td>
      <td>${escapeHtml(item.noteAr || "—")}</td>
    </tr>`)
    .join("");

  const source = sourceNote(
    schedule.sourceName,
    schedule.sourceUrl,
    "تنبيه مهم: تنص وزارة المالية على أن التواريخ الواردة في الجدول قابلة للتغيير وليست نهائية. تحقق من آخر إعلان رسمي قبل الاعتماد على الموعد.",
  );

  const body = `
  <section class="hero">
    <h1>${escapeHtml(schedule.nameAr)}</h1>
    <p>${escapeHtml(schedule.descriptionAr)}</p>
    <p class="status-note">${escapeHtml(schedule.statusAr)}</p>
  </section>
  <section class="section">
    <h2>جدول مواعيد الصرف</h2>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>الشهر</th><th>اليوم</th><th>التاريخ الميلادي</th><th>التاريخ الهجري</th><th>ملاحظة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>
  <section class="section">
    <h2>كيف تستخدم هذا الجدول؟</h2>
    <p>هذا الجدول خاص بمواعيد صرف رواتب العاملين في الجهات الحكومية الواردة في وثيقة وزارة المالية. لا يعني أنه جدول صرف معاشات التأمينات أو التقاعد أو الضمان الاجتماعي أو حساب المواطن؛ لكل برنامج مصدره وجدوله المستقل.</p>
    <p>تاريخ التحقق من بيانات هذا الجدول: ${escapeHtml(schedule.verifiedAt || "غير محدد")}.</p>
  </section>
  ${source}
  <p><a href="/calendar/">العودة إلى التقويم والمواعيد</a></p>`;

  return renderPage({
    title: `مواعيد صرف الرواتب الحكومية ${schedule.year} — ${SITE.name}`,
    description: `جدول مواعيد رواتب الموظفين الحكوميين لعام ${schedule.year} من وزارة المالية، مع التواريخ الهجرية والتنبيه إلى قابليتها للتغيير.`,
    canonicalPath: `/calendar/salaries/${schedule.year}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "التقويم والمواعيد", path: "/calendar/" },
      { name: `رواتب ${schedule.year}`, path: `/calendar/salaries/${schedule.year}/` },
    ],
  });
}


function isValidGregorianIsoDate(value) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  try {
    return makeIsoDate(year, month, day) === value;
  } catch {
    return false;
  }
}

export function isSchoolCalendarValid(calendar) {
  if (!calendar || !/^[a-z0-9-]+$/.test(String(calendar.slug || ""))) return false;
  if (!calendar.titleAr || !calendar.academicYear || !calendar.regionNameAr) return false;
  if (!calendar.sourceName || !safeHttpUrl(calendar.sourceUrl) || !calendar.verifiedAt) return false;
  if (!Array.isArray(calendar.events) || calendar.events.length < 2) return false;
  return calendar.events.every((event) =>
    event && event.titleAr &&
    isValidGregorianIsoDate(event.startDate) &&
    isValidGregorianIsoDate(event.endDate) &&
    event.startDate <= event.endDate &&
    event.status === "official"
  );
}

function schoolEventStatus(event, today) {
  if (today < event.startDate) return "قادمة";
  if (today > event.endDate) return "انتهت";
  return "جارية الآن";
}

function schoolEventRow(event, today) {
  const status = schoolEventStatus(event, today);
  const range = event.startDate === event.endDate
    ? formatSaudiDate(event.startDate)
    : `من ${formatSaudiDate(event.startDate)} إلى ${formatSaudiDate(event.endDate)}`;
  return `<tr>
    <td><strong>${escapeHtml(event.titleAr)}</strong></td>
    <td><time datetime="${escapeHtml(event.startDate)}">${escapeHtml(range)}</time></td>
    <td>${escapeHtml(status)}</td>
    <td>${escapeHtml(event.noteAr || "—")}</td>
  </tr>`;
}

export function schoolCalendarsIndexPage(calendars = []) {
  const items = calendars.filter(isSchoolCalendarValid).map((calendar) => `
    <li class="calendar-feature">
      <h2><a href="/calendar/schools/${escapeHtml(calendar.slug)}/">${escapeHtml(calendar.titleAr)}</a></h2>
      <p>النطاق: ${escapeHtml(calendar.regionNameAr)}</p>
      <p>${escapeHtml(calendar.academicYear)}</p>
      <p>${calendar.events.length} مواعيد منشورة في الجدول</p>
      <p>آخر تحقق: ${escapeHtml(calendar.verifiedAt)}</p>
    </li>`).join("");

  const body = `
  <section class="hero">
    <h1>التقويم الدراسي والإجازات</h1>
    <p>جداول دراسية منشورة من الجهات التعليمية، مع تحديد النطاق الجغرافي والجهة صاحبة الجدول. قد تختلف المواعيد بين الجهات والمناطق؛ اختر الجدول المطابق لمدرستك.</p>
  </section>
  <section class="section">
    <h2>الجداول المتاحة</h2>
    ${items ? `<ul class="event-grid">${items}</ul>` : "<p>لا توجد جداول موثقة منشورة حاليًا.</p>"}
  </section>
  <p><a href="/calendar/">العودة إلى التقويم والمواعيد</a></p>`;

  return renderPage({
    title: `التقويم الدراسي والإجازات في السعودية | ${SITE.name}`,
    description: "جداول التقويم الدراسي والإجازات المنشورة من الجهات التعليمية مع تحديد المنطقة ومصدر المعلومة.",
    canonicalPath: "/calendar/schools/",
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "التقويم والمواعيد", path: "/calendar/" },
      { name: "التقويم الدراسي", path: "/calendar/schools/" },
    ],
  });
}

export function schoolCalendarPage(calendar, now = new Date()) {
  if (!isSchoolCalendarValid(calendar)) {
    throw new TypeError("بيانات التقويم الدراسي غير مكتملة أو غير صالحة للنشر.");
  }

  const today = riyadhDateIso(now);
  const events = [...calendar.events].sort((a, b) =>
    a.startDate.localeCompare(b.startDate) || a.titleAr.localeCompare(b.titleAr, "ar"),
  );
  const rows = events.map((event) => schoolEventRow(event, today)).join("");
  const next = events.find((event) => event.endDate >= today);
  const nextBlock = next
    ? `<section class="calendar-feature">
        <h2>المناسبة الدراسية القادمة</h2>
        <p><strong>${escapeHtml(next.titleAr)}</strong></p>
        <p>${escapeHtml(next.startDate === next.endDate ? formatSaudiDate(next.startDate) : `من ${formatSaudiDate(next.startDate)} إلى ${formatSaudiDate(next.endDate)}`)}</p>
        ${countdownMarkup(`${next.startDate}T00:00:00+03:00`, "الوقت المتبقي لبداية الموعد")}
      </section>`
    : `<p class="status-note">انتهت جميع المواعيد الواردة في هذا الجدول.</p>`;

  const excluded = Array.isArray(calendar.excludedEvents) && calendar.excludedEvents.length
    ? `<section class="section">
        <h2>مواعيد لم ندرجها</h2>
        <ul>${calendar.excludedEvents.map((item) => `<li><strong>${escapeHtml(item.titleAr)}</strong>: ${escapeHtml(item.reasonAr)}</li>`).join("")}</ul>
      </section>`
    : "";

  const body = `
  <section class="hero">
    <p class="eyebrow">تقويم دراسي منشور · ${escapeHtml(calendar.academicYear)}</p>
    <h1>${escapeHtml(calendar.titleAr)}</h1>
    <p>${escapeHtml(calendar.descriptionAr)}</p>
    <p class="status-note">النطاق: ${escapeHtml(calendar.regionNameAr)}</p>
  </section>
  ${nextBlock}
  <section class="section">
    <h2>المواعيد والإجازات</h2>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>الحدث</th><th>الفترة</th><th>الحالة في توقيت السعودية</th><th>ملاحظة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>
  <section class="section">
    <h2>نطاق هذا الجدول</h2>
    <p>هذا الجدول من الجهة التعليمية المذكورة ويخص النطاق الجغرافي المعروض. لا تفترض انطباق مواعيده على كل مدارس المملكة أو على الجامعات أو التدريب التقني أو المدارس الأهلية والدولية.</p>
    <p>آخر تاريخ تحقق من المصدر: ${escapeHtml(calendar.verifiedAt)}.</p>
  </section>
  ${excluded}
  ${sourceNote(calendar.sourceName, calendar.sourceUrl, "قد تعلن الجهات التعليمية تحديثات أو استثناءات لاحقة. تحقق من المدرسة أو إدارة التعليم التابعة لها قبل ترتيب الإجازات والسفر.")}
  <p><a href="/calendar/schools/">العودة إلى جداول التقويم الدراسي</a> · <a href="/calendar/">التقويم والمواعيد</a></p>`;

  return renderPage({
    title: `${calendar.titleAr} — المواعيد والإجازات | ${SITE.name}`,
    description: `مواعيد الدراسة والإجازات للعام ${calendar.academicYear} ضمن ${calendar.regionNameAr}، مع مصدر الجدول وتاريخ التحقق.`,
    canonicalPath: `/calendar/schools/${calendar.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "التقويم والمواعيد", path: "/calendar/" },
      { name: "التقويم الدراسي", path: "/calendar/schools/" },
      { name: calendar.academicYear, path: `/calendar/schools/${calendar.slug}/` },
    ],
  });
}
