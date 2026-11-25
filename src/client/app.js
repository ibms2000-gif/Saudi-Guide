// تحسين تدريجي بسيط: فلترة سريعة داخل قوائم الأماكن الطويلة دون أي طلبات شبكة.
(function () {
  var lists = document.querySelectorAll(".place-list");
  lists.forEach(function (list) {
    if (list.children.length < 8) return;
    var wrap = document.createElement("div");
    wrap.className = "place-filter";
    wrap.innerHTML =
      '<input type="search" placeholder="ابحث ضمن هذه القائمة…" aria-label="ابحث ضمن هذه القائمة" style="width:100%;max-width:24rem;padding:.5em .8em;margin-bottom:1em;border:1px solid var(--line);border-radius:2px;background:var(--paper-raised);color:inherit;font-family:inherit">';
    list.parentNode.insertBefore(wrap, list);
    var input = wrap.querySelector("input");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLocaleLowerCase("ar");
      Array.prototype.forEach.call(list.children, function (li) {
        var text = li.textContent.toLocaleLowerCase("ar");
        li.style.display = !q || text.includes(q) ? "" : "none";
      });
    });
  });
})();


// عدادات المناسبات والمواعيد — تعتمد على توقيت السعودية داخل تاريخ الهدف.
(function () {
  var formatNumber = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 });

  function getAnnualTarget(element) {
    var month = Number(element.getAttribute("data-countdown-month"));
    var day = Number(element.getAttribute("data-countdown-day"));
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
      return null;
    }

    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    var values = {};
    parts.forEach(function (part) { values[part.type] = part.value; });
    var year = Number(values.year);
    var today = values.year + "-" + values.month + "-" + values.day;
    var date = year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    var candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
    if (date < today) {
      year += 1;
      date = year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    }

    var targetText = date + "T00:00:00+03:00";
    element.setAttribute("data-countdown-target", targetText);
    var parent = element.parentElement;
    var dateLabel = parent ? parent.querySelector("[data-next-annual-date], [data-countdown-date]") : null;
    if (dateLabel) {
      dateLabel.textContent = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
        timeZone: "Asia/Riyadh",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date(date + "T12:00:00+03:00"));
    }
    return Date.parse(targetText);
  }

  function getMonthlyTarget(element) {
    var day = Number(element.getAttribute("data-countdown-recurring-day"));
    var rule = element.getAttribute("data-countdown-rule") || "none";
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;

    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    var values = {};
    parts.forEach(function (part) { values[part.type] = part.value; });
    var today = values.year + "-" + values.month + "-" + values.day;
    var currentYear = Number(values.year);
    var currentMonth = Number(values.month);

    for (var offset = 0; offset < 14; offset += 1) {
      var monthIndex = currentMonth - 1 + offset;
      var year = currentYear + Math.floor(monthIndex / 12);
      var month = monthIndex % 12 + 1;
      var lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      var date = new Date(Date.UTC(year, month - 1, Math.min(day, lastDay)));

      if (rule === "citizen-account") {
        var weekday = date.getUTCDay();
        if (weekday === 5) date.setUTCDate(date.getUTCDate() - 1);
        if (weekday === 6) date.setUTCDate(date.getUTCDate() + 1);
      }

      var isoDate = date.toISOString().slice(0, 10);
      if (isoDate < today) continue;

      var targetText = isoDate + "T00:00:00+03:00";
      element.setAttribute("data-countdown-target", targetText);
      var parent = element.parentElement;
      var dateLabel = parent ? parent.querySelector("[data-countdown-date]") : null;
      if (dateLabel) {
        dateLabel.textContent = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
          timeZone: "Asia/Riyadh",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }).format(new Date(isoDate + "T12:00:00+03:00"));
      }
      return Date.parse(targetText);
    }
    return null;
  }

  function renderCountdown(element) {
    var targetText = element.getAttribute("data-countdown-target");
    var target = element.hasAttribute("data-countdown-month")
      ? getAnnualTarget(element)
      : element.hasAttribute("data-countdown-recurring-day")
        ? getMonthlyTarget(element)
        : Date.parse(targetText || "");
    var output = element.querySelector(".countdown-value");
    if (!output || !Number.isFinite(target)) {
      if (output) output.textContent = "تعذر حساب الموعد";
      return false;
    }

    var remaining = target - Date.now();
    if (remaining <= 0) {
      output.textContent = "حان الموعد";
      return false;
    }

    var seconds = Math.floor(remaining / 1000);
    var days = Math.floor(seconds / 86400);
    seconds %= 86400;
    var hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    var minutes = Math.floor(seconds / 60);
    seconds %= 60;

    output.textContent =
      formatNumber.format(days) + " يوم · " +
      formatNumber.format(hours) + " ساعة · " +
      formatNumber.format(minutes) + " دقيقة · " +
      formatNumber.format(seconds) + " ثانية";
    return true;
  }

  var countdowns = Array.prototype.slice.call(
    document.querySelectorAll("[data-countdown-target]")
  );
  var timer = null;

  function tickCountdowns() {
    var active = false;
    countdowns.forEach(function (element) {
      if (renderCountdown(element)) active = true;
    });
    if (!active && timer) {
      window.clearInterval(timer);
      timer = null;
    }
    return active;
  }

  function startCountdownTimer() {
    if (timer) window.clearInterval(timer);
    tickCountdowns();
    timer = window.setInterval(tickCountdowns, 1000);
  }

  var privateSalaryForm = document.querySelector("[data-private-salary-form]");
  var privateSalaryCard = document.querySelector("[data-private-salary-card]");
  if (privateSalaryForm && privateSalaryCard) {
    privateSalaryForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = privateSalaryForm.querySelector('[name="day"]');
      var day = Number(input && input.value);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        if (input) input.setCustomValidity("أدخل يومًا من 1 إلى 31.");
        if (input) input.reportValidity();
        return;
      }
      if (input) input.setCustomValidity("");
      var countdown = privateSalaryCard.querySelector("[data-countdown-target]");
      if (!countdown) return;
      countdown.setAttribute("data-countdown-recurring-day", String(day));
      countdown.setAttribute("data-countdown-rule", "none");
      privateSalaryCard.hidden = false;
      if (countdowns.indexOf(countdown) === -1) countdowns.push(countdown);
      startCountdownTimer();
    });
  }

  if (countdowns.length) startCountdownTimer();
})();
