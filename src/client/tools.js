import { calculateTool } from "./tool-calculations.mjs";

(function () {
  "use strict";

  var panels = document.querySelectorAll("[data-tool-calculator]");
  if (!panels.length) return;

  var number = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 });
  var money = new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2
  });

  function localToday() {
    var now = new Date();
    return now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
  }

  function displayValue(result) {
    if (result.kind === "money") return money.format(result.value);
    if (result.kind === "percent") return number.format(result.value) + "%";
    if (result.kind === "text") return result.value;
    return number.format(result.value) + (result.suffix || "");
  }

  function renderRows(container, results) {
    var rows = results.map(function (result) {
      var line = document.createElement("div");
      line.className = "tool-result-row";

      var label = document.createElement("span");
      label.textContent = result.label;

      var value = document.createElement("strong");
      value.textContent = displayValue(result);

      line.append(label, value);
      return line;
    });
    container.replaceChildren.apply(container, rows);
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
        var values = Object.fromEntries(new FormData(form).entries());
        var results = calculateTool(slug, values);
        renderRows(content, results);
        output.hidden = false;
      } catch (err) {
        output.hidden = true;
        error.textContent = err && err.message
          ? err.message
          : "تعذر إجراء الحساب. راجع القيم المدخلة.";
        error.hidden = false;
      }
    });

    form.addEventListener("reset", function () {
      output.hidden = true;
      error.hidden = true;
    });
  });
})();
