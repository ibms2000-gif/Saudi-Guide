import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
} from "adhan";
import { renderPage } from "./layout.mjs";
import { formatSaudiDate } from "./calendar.mjs";
import { escapeHtml } from "./util.mjs";
import { SITE } from "./config.mjs";

const TIME_ZONE = "Asia/Riyadh";
const PRAYER_NAMES = [
  ["fajr", "الفجر"],
  ["sunrise", "الشروق"],
  ["dhuhr", "الظهر"],
  ["asr", "العصر"],
  ["maghrib", "المغرب"],
  ["sunset", "الغروب"],
  ["isha", "العشاء"],
];

function riyadhDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function isUmmAlQuraRamadan(date) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      timeZone: TIME_ZONE,
      month: "numeric",
    }).formatToParts(date);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    return month === 9;
  } catch {
    return false;
  }
}

export function calculateCityPrayerTimes(city, now = new Date()) {
  const latitude = Number(city?.latitude);
  const longitude = Number(city?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new TypeError("إحداثيات خط العرض للمدينة غير صالحة.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new TypeError("إحداثيات خط الطول للمدينة غير صالحة.");
  }

  const dateParts = riyadhDateParts(now);
  const calculationDate = new Date(Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
  ));
  const parameters = CalculationMethod.UmmAlQura();
  const ramadan = isUmmAlQuraRamadan(new Date(Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    12,
  )));
  // Adhan's Umm al-Qura profile uses 90 minutes for Isha;
  // its method guide specifies +30 minutes during Ramadan.
  if (ramadan) parameters.adjustments.isha += 30;

  const coordinates = new Coordinates(latitude, longitude);
  const prayerTimes = new PrayerTimes(coordinates, calculationDate, parameters);

  return {
    dateIso: `${dateParts.year}-${String(dateParts.month).padStart(2, "0")}-${String(dateParts.day).padStart(2, "0")}`,
    date: calculationDate,
    ramadan,
    method: "UmmAlQura",
    prayers: {
      fajr: prayerTimes.fajr,
      sunrise: prayerTimes.sunrise,
      dhuhr: prayerTimes.dhuhr,
      asr: prayerTimes.asr,
      maghrib: prayerTimes.maghrib,
      sunset: prayerTimes.sunset,
      isha: prayerTimes.isha,
    },
  };
}

export function nextPrayerForCity(city, now = new Date()) {
  const today = calculateCityPrayerTimes(city, now);
  const prayerOrder = [
    ["fajr", "الفجر"],
    ["dhuhr", "الظهر"],
    ["asr", "العصر"],
    ["maghrib", "المغرب"],
    ["isha", "العشاء"],
  ];
  for (const [key, nameAr] of prayerOrder) {
    const time = today.prayers[key];
    if (time.getTime() >= now.getTime()) {
      return { key, nameAr, time, dateIso: today.dateIso };
    }
  }

  const tomorrowDate = new Date(today.date.getTime() + 86400000);
  const tomorrowParts = riyadhDateParts(tomorrowDate);
  const tomorrowInstant = new Date(Date.UTC(
    tomorrowParts.year,
    tomorrowParts.month - 1,
    tomorrowParts.day,
    12,
  ));
  const tomorrow = calculateCityPrayerTimes(city, tomorrowInstant);
  return {
    key: "fajr",
    nameAr: "الفجر",
    time: tomorrow.prayers.fajr,
    dateIso: tomorrow.dateIso,
  };
}

export function formatSaudiPrayerTime(date) {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function prayerTimesPage(city, now = new Date()) {
  const result = calculateCityPrayerTimes(city, now);
  const next = nextPrayerForCity(city, now);
  const rows = PRAYER_NAMES.map(([key, label]) => `<tr>
    <th scope="row">${label}</th>
    <td><time datetime="${result.prayers[key].toISOString()}">${escapeHtml(formatSaudiPrayerTime(result.prayers[key]))}</time></td>
  </tr>`).join("");
  const target = next.time.toISOString();

  const body = `
  <section class="hero">
    <p class="eyebrow">مواقيت اليوم · ${escapeHtml(city.regionAr || "المملكة العربية السعودية")}</p>
    <h1>مواقيت الصلاة في ${escapeHtml(city.nameAr)}</h1>
    <p>مواقيت الفجر والشروق والظهر والعصر والمغرب والغروب والعشاء لهذا اليوم، محسوبة لإحداثيات ${escapeHtml(city.nameAr)} على توقيت المملكة العربية السعودية.</p>
    <p class="event-date">تاريخ اليوم: <strong>${escapeHtml(formatSaudiDate(result.dateIso))}</strong></p>
  </section>
  <section class="section calendar-feature">
    <h2>الصلاة القادمة: ${escapeHtml(next.nameAr)}</h2>
    <p class="event-date"><strong>${escapeHtml(formatSaudiPrayerTime(next.time))}</strong></p>
    <div class="countdown" data-countdown-target="${escapeHtml(target)}">
      <span class="countdown-label">الوقت المتبقي حتى أذان ${escapeHtml(next.nameAr)}</span>
      <strong class="countdown-value" aria-live="off">جارٍ حساب الوقت المتبقي…</strong>
    </div>
  </section>
  <section class="section">
    <h2>جدول مواقيت اليوم</h2>
    <table class="data-table">
      <thead><tr><th>الموعد</th><th>التوقيت المحلي</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  <section class="section">
    <h2>طريقة الحساب ومصدر المعلومات</h2>
    <p>تستخدم هذه الصفحة مكتبة Adhan مفتوحة المصدر مع طريقة Umm al-Qura: زاوية فجر 18.5 درجة وفاصل 90 دقيقة للعشاء، مع إضافة 30 دقيقة للعشاء خلال رمضان حسب دليل طريقة الحساب في المكتبة. الحساب فلكي ويُعرض بتوقيت Asia/Riyadh.</p>
    <p>هذه نتيجة حسابية وليست جدولًا صادرًا من جهة حكومية أو مسجد محلي. قد تختلف الدقائق بسبب إعدادات الجهة المحلية أو التقويم المعتمد؛ يُرجى التحقق من المسجد القريب عند الحاجة.</p>
    <p>المرجع التعريفي: <a href="https://www.ummulqura.org.sa/prayer-times" rel="noopener noreferrer nofollow" target="_blank">تقويم أم القرى — مواقيت الصلاة حسب المدينة</a>. ومنهج الحساب البرمجي: <a href="https://github.com/batoulapps/adhan-js" rel="noopener noreferrer nofollow" target="_blank">Adhan JS (MIT)</a>.</p>
  </section>
  <p class="source-note">الإحداثيات المستخدمة: <span dir="ltr">${Number(city.latitude).toFixed(4)}, ${Number(city.longitude).toFixed(4)}</span>. إذا وجدت اختلافًا يرجى مقارنة الموعد مع المسجد المحلي.</p>`;

  return renderPage({
    title: `مواقيت الصلاة اليوم في ${city.nameAr} — الفجر والشروق والمغرب | ${SITE.name}`,
    description: `مواقيت الصلاة والشروق والغروب اليوم في ${city.nameAr}: جدول الفجر والظهر والعصر والمغرب والعشاء مع عد تنازلي للصلاة القادمة.`,
    canonicalPath: `/prayer-times/${city.slug}/`,
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "مواقيت الصلاة", path: "/prayer-times/" },
      { name: city.nameAr, path: `/prayer-times/${city.slug}/` },
    ],
  });
}

export function prayerTimesIndexPage(cities) {
  const available = cities.filter((city) =>
    Number.isFinite(Number(city.latitude)) &&
    Number.isFinite(Number(city.longitude)),
  );
  const items = available.map((city) => `<li>
    <a href="/prayer-times/${escapeHtml(city.slug)}/">
      <strong>${escapeHtml(city.nameAr)}</strong>
      <span>${escapeHtml(city.regionAr || "")}</span>
    </a>
  </li>`).join("");

  const body = `
  <section class="hero">
    <h1>مواقيت الصلاة في مدن المملكة</h1>
    <p>اختر المدينة لعرض مواقيت الصلاة والشروق والغروب اليوم، مع العد التنازلي للصلاة القادمة. التوقيت المعروض هو توقيت المملكة العربية السعودية.</p>
  </section>
  <section class="section">
    <h2>اختر المدينة</h2>
    <ul class="grid-list">${items}</ul>
  </section>
  <p class="source-note">تُحسب المواقيت فلكيًا بطريقة Umm al-Qura باستخدام مكتبة Adhan JS، وهي خدمة معلوماتية مساعدة وليست بديلًا عن إعلان المسجد المحلي.</p>`;

  return renderPage({
    title: `مواقيت الصلاة في مدن السعودية — ${SITE.name}`,
    description: "اختر مدينة سعودية لمعرفة مواقيت الصلاة والشروق والغروب والوقت المتبقي للصلاة القادمة.",
    canonicalPath: "/prayer-times/",
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "مواقيت الصلاة", path: "/prayer-times/" },
    ],
  });
}
