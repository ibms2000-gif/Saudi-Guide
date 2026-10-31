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

  function renderCountdown(element) {
    var targetText = element.getAttribute("data-countdown-target");
    var target = Date.parse(targetText || "");
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
