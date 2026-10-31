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
    var dateLabel = parent ? parent.querySelector("[data-next-annual-date]") : null;
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

  function renderCountdown(element) {
    var targetText = element.getAttribute("data-countdown-target");
    var target = element.hasAttribute("data-countdown-month")
      ? getAnnualTarget(element)
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
  if (!countdowns.length) return;

  countdowns.forEach(renderCountdown);
  var timer = window.setInterval(function () {
    var active = false;
    countdowns.forEach(function (element) {
      if (renderCountdown(element)) active = true;
    });
    if (!active) window.clearInterval(timer);
  }, 1000);
})();
