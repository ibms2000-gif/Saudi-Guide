// Update a pre-rendered prayer timetable using a small, local schedule snapshot.
(function () {
  "use strict";

  var scheduleElement = document.getElementById("prayer-times-schedule");
  if (!scheduleElement) return;

  var prayerNames = {
    fajr: "الفجر",
    dhuhr: "الظهر",
    asr: "العصر",
    maghrib: "المغرب",
    isha: "العشاء"
  };
  var prayerOrder = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  function riyadhDateKey(date) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    var values = {};
    parts.forEach(function (part) { values[part.type] = part.value; });
    return values.year + "-" + values.month + "-" + values.day;
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(new Date(value));
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
      timeZone: "Asia/Riyadh",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(value + "T12:00:00+03:00"));
  }

  try {
    var schedule = JSON.parse(scheduleElement.textContent || "[]");
    if (!Array.isArray(schedule) || !schedule.length) throw new Error("empty schedule");

    var todayKey = riyadhDateKey(new Date());
    var todayIndex = schedule.findIndex(function (item) { return item.dateIso === todayKey; });
    if (todayIndex < 0) throw new Error("date not in pre-rendered schedule");

    var today = schedule[todayIndex];
    var now = Date.now();
    var next = null;

    prayerOrder.some(function (key) {
      var value = today.prayers && today.prayers[key];
      if (value && Date.parse(value) >= now) {
        next = { key: key, value: value };
        return true;
      }
      return false;
    });

    if (!next) {
      var tomorrow = schedule[todayIndex + 1];
      if (!tomorrow || !tomorrow.prayers || !tomorrow.prayers.fajr) {
        throw new Error("tomorrow is not in pre-rendered schedule");
      }
      next = { key: "fajr", value: tomorrow.prayers.fajr };
    }

    document.querySelectorAll("time[data-prayer-key]").forEach(function (element) {
      var key = element.getAttribute("data-prayer-key");
      var value = today.prayers && today.prayers[key];
      if (!value) return;
      element.setAttribute("datetime", value);
      element.textContent = formatTime(value);
    });

    var dateLabel = document.querySelector("[data-prayer-date]");
    if (dateLabel) dateLabel.textContent = formatDate(today.dateIso);

    var nextName = document.querySelector("[data-next-prayer-name]");
    if (nextName) nextName.textContent = "الصلاة القادمة: " + prayerNames[next.key];

    var nextTime = document.querySelector("[data-next-prayer-time]");
    if (nextTime) nextTime.textContent = formatTime(next.value);

    var countdown = document.querySelector("[data-countdown-target]");
    if (countdown) {
      countdown.setAttribute("data-countdown-target", next.value);
      var label = countdown.querySelector(".countdown-label");
      if (label) label.textContent = "الوقت المتبقي حتى أذان " + prayerNames[next.key];
    }
  } catch (error) {
    var output = document.querySelector(".countdown-value");
    if (output) output.textContent = "تعذر تحديث المواقيت لهذا اليوم؛ يرجى إعادة تحميل الصفحة.";
  }
})();
