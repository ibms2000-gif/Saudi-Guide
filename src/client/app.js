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
