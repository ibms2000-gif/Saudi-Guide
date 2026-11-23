(function () {
  "use strict";
  var panels = document.querySelectorAll("[data-tool-calculator]");
  if (!panels.length) return;

  var number = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 });
  var money = new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 });
  function val(form, key) {
    var field = form.elements.namedItem(key);
    if (!field) return NaN;
    if (field.type === "date") return field.value;
    return Number(field.value);
  }
  function row(label, value) {
    return '<div class="tool-result-row"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }
  function localToday() {
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  }
  function dateValue(value) {
    if (!value) return null;
    var parts = value.split("-").map(Number);
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return Number.isFinite(date.getTime()) ? date : null;
  }
  function calculate(slug, form) {
    var a, b, c, monthly, rate, months, total, down, interest, principal;
    switch (slug) {
      case "vat-calculator":
        a = val(form, "amount"); rate = val(form, "rate");
        if (a < 0 || rate < 0 || rate > 100) throw new Error("أدخل مبلغًا ونسبة ضريبة صحيحة بين 0 و100.");
        b = a * rate / 100;
        return row("قيمة الضريبة", money.format(b)) + row("الإجمالي شامل الضريبة", money.format(a + b));
      case "discount-calculator":
        a = val(form, "amount"); rate = val(form, "rate");
        if (a < 0 || rate < 0 || rate > 100) throw new Error("تحقق من السعر ونسبة الخصم (من 0 إلى 100).");
        b = a * rate / 100;
        return row("قيمة الخصم", money.format(b)) + row("السعر بعد الخصم", money.format(a - b));
      case "installment-calculator":
        a = val(form, "amount"); down = val(form, "down"); rate = val(form, "rate"); months = val(form, "months");
        if (a <= 0 || down < 0 || down >= a || rate < 0 || months < 1 || months > 600 || !Number.isInteger(months)) throw new Error("تحقق من مبلغ التمويل والدفعة والمعدل والمدة.");
        principal = a - down; monthly = rate / 1200;
        b = monthly === 0 ? principal / months : principal * monthly / (1 - Math.pow(1 + monthly, -months));
        total = b * months;
        return row("القسط الشهري التقديري", money.format(b)) + row("إجمالي الأقساط", money.format(total)) + row("إجمالي تكلفة التمويل فوق أصل المبلغ", money.format(total - principal));
      case "fuel-cost-calculator":
        a = val(form, "distance"); b = val(form, "efficiency"); rate = val(form, "rate");
        if (a <= 0 || b <= 0 || rate < 0) throw new Error("أدخل مسافة واستهلاكًا أكبر من صفر وسعرًا غير سالب.");
        c = a * b / 100;
        return row("الوقود المطلوب", number.format(c) + " لتر") + row("تكلفة الرحلة التقديرية", money.format(c * rate));
      case "age-calculator":
        a = dateValue(val(form, "birth")); b = dateValue(val(form, "target") || localToday());
        if (!a || !b || b < a) throw new Error("تحقق من تاريخ الميلاد وتاريخ الحساب.");
        var years = b.getUTCFullYear() - a.getUTCFullYear();
        var monthsAge = b.getUTCMonth() - a.getUTCMonth();
        var daysAge = b.getUTCDate() - a.getUTCDate();
        if (daysAge < 0) { monthsAge--; daysAge += new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate(); }
        if (monthsAge < 0) { years--; monthsAge += 12; }
        return row("العمر", number.format(years) + " سنة و" + number.format(monthsAge) + " شهر و" + number.format(daysAge) + " يوم") + row("إجمالي الأيام", number.format((b - a) / 86400000) + " يوم");
      case "date-difference":
        a = dateValue(val(form, "start")); b = dateValue(val(form, "end") || localToday());
        if (!a || !b || b < a) throw new Error("تأكد من إدخال تاريخين صحيحين وأن النهاية ليست قبل البداية.");
        c = (b - a) / 86400000;
        return row("الفرق بالأيام", number.format(c) + " يوم") + row("بالأسابيع", number.format(c / 7) + " أسبوع") + row("بالشهور التقريبية", number.format(c / 30.4375) + " شهر");
      case "percentage-calculator":
        a = val(form, "part"); b = val(form, "total");
        if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) throw new Error("أدخل أرقامًا صحيحة، ويجب ألا يكون الإجمالي صفرًا.");
        return row("النسبة المئوية", number.format(a / b * 100) + "%");
      case "debt-ratio-calculator":
        a = val(form, "income"); b = val(form, "obligations");
        if (a <= 0 || b < 0) throw new Error("أدخل دخلًا أكبر من صفر والتزامات غير سالبة.");
        c = b / a * 100;
        return row("نسبة الالتزامات", number.format(c) + "%") + row("المتبقي بعد الالتزامات", money.format(a - b));
      default: throw new Error("هذه الأداة غير معروفة.");
    }
  }

  panels.forEach(function (panel) {
    var slug = panel.getAttribute("data-tool-calculator");
    var form = panel.querySelector("form");
    var output = panel.querySelector(".tool-result");
    var content = panel.querySelector(".tool-result-content");
    var error = panel.querySelector(".tool-error");
    form.querySelectorAll('[data-today="true"]').forEach(function (field) {
      field.value = localToday();
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      error.hidden = true;
      try {
        content.innerHTML = calculate(slug, form);
        output.hidden = false;
      } catch (err) {
        output.hidden = true;
        error.textContent = err && err.message ? err.message : "تعذر إجراء الحساب. راجع القيم المدخلة.";
        error.hidden = false;
      }
    });
    form.addEventListener("reset", function () {
      window.setTimeout(function () { output.hidden = true; error.hidden = true; }, 0);
    });
  });
})();