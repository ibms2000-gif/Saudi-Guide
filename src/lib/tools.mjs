import { renderPage } from "./layout.mjs";
import { SITE } from "./config.mjs";
import { escapeHtml } from "./util.mjs";

const tools = [
  {
    slug: "vat-calculator",
    name: "حاسبة ضريبة القيمة المضافة",
    short: "احسب ضريبة القيمة المضافة أو استخرجها من مبلغ شامل.",
    description: "احسب قيمة ضريبة القيمة المضافة على مبلغ قبل الضريبة، واعرف إجمالي المبلغ بعد إضافتها. يمكنك تعديل النسبة بحسب حاجتك.",
    fields: [{ key: "amount", label: "المبلغ بالريال", type: "number", min: "0.01", step: "0.01", value: "1000" }, { key: "rate", label: "نسبة الضريبة (%)", type: "number", min: "0", max: "100", step: "0.01", value: "15" }],
    formula: "المبلغ × نسبة الضريبة ÷ 100",
    note: "هذه أداة حسابية عامة وليست إقرارًا ضريبيًا أو استشارة محاسبية. أدخل النسبة المطبقة على معاملتك وتحقق من المتطلبات لدى هيئة الزكاة والضريبة والجمارك."
  },
  {
    slug: "discount-calculator",
    name: "حاسبة الخصم",
    short: "اعرف السعر بعد الخصم ومقدار التوفير.",
    description: "أدخل السعر الأصلي ونسبة التخفيض لمعرفة قيمة الخصم والسعر النهائي الذي ستدفعه.",
    fields: [{ key: "amount", label: "السعر الأصلي (ريال)", type: "number", min: "0", step: "0.01", value: "250" }, { key: "rate", label: "نسبة الخصم (%)", type: "number", min: "0", max: "100", step: "0.01", value: "20" }],
    formula: "السعر النهائي = السعر الأصلي × (1 − نسبة الخصم ÷ 100)",
    note: "لا تشمل النتيجة رسوم التوصيل أو الضرائب أو الرسوم الإضافية التي قد يضيفها المتجر."
  },
  {
    slug: "installment-calculator",
    name: "حاسبة القسط الشهري",
    short: "قدّر القسط الشهري للتمويل وفق مبلغ ومعدل ومدة.",
    description: "احسب قسطًا تقديريًا لتمويل ذي معدل سنوي ثابت وأقساط شهرية متساوية. أدخل الدفعة المقدمة إن وجدت.",
    fields: [{ key: "amount", label: "مبلغ التمويل أو سعر الشراء (ريال)", type: "number", min: "0.01", step: "0.01", value: "100000" }, { key: "down", label: "الدفعة المقدمة (ريال)", type: "number", min: "0", step: "0.01", value: "0" }, { key: "rate", label: "معدل النسبة السنوي (%)", type: "number", min: "0", max: "100", step: "0.01", value: "5" }, { key: "months", label: "مدة السداد (شهر)", type: "number", min: "1", max: "600", step: "1", value: "60" }],
    formula: "القسط وفق معادلة الدفعات الشهرية الثابتة على رصيد متناقص.",
    note: "نتيجة تقريبية للتخطيط فقط؛ قد تختلف عن عرض الممول بسبب الرسوم والتأمين وطريقة احتساب معدل النسبة السنوي وتوقيت الدفعات وشروط العقد."
  },
  {
    slug: "fuel-cost-calculator",
    name: "حاسبة تكلفة البنزين للرحلة",
    short: "قدّر تكلفة الوقود حسب المسافة واستهلاك السيارة.",
    description: "احسب كمية الوقود والتكلفة التقديرية لرحلة بالسيارة. أدخل المسافة واستهلاك مركبتك وسعر اللتر.",
    fields: [{ key: "distance", label: "مسافة الرحلة (كم)", type: "number", min: "0.1", step: "0.1", value: "300" }, { key: "efficiency", label: "استهلاك السيارة (لتر لكل 100 كم)", type: "number", min: "0.1", step: "0.1", value: "8" }, { key: "rate", label: "سعر اللتر (ريال)", type: "number", min: "0", step: "0.001", value: "2.18" }],
    formula: "اللترات المطلوبة = المسافة × الاستهلاك ÷ 100.",
    note: "سعر الوقود قابل للتعديل؛ اختر نوع الوقود وسعره الفعلي. الاستهلاك الواقعي يتغير بحسب القيادة والحمولة والطريق."
  },
  {
    slug: "age-calculator",
    name: "حاسبة العمر",
    short: "احسب عمرك بالسنوات والأشهر والأيام.",
    description: "أدخل تاريخ الميلاد وتاريخ الحساب لمعرفة العمر التقويمي بين التاريخين.",
    fields: [{ key: "birth", label: "تاريخ الميلاد", type: "date", value: "" }, { key: "target", label: "الحساب حتى تاريخ", type: "date", value: "today" }],
    formula: "فرق تقويمي بين تاريخ الميلاد وتاريخ الحساب.",
    note: "يعرض العمر بالتقويم الميلادي، ولا يستخدم لتحديد أهلية نظامية أو طبية."
  },
  {
    slug: "date-difference",
    name: "حاسبة الفرق بين تاريخين",
    short: "احسب عدد الأيام والأسابيع بين تاريخين.",
    description: "احسب المدة الفاصلة بين تاريخ بداية وتاريخ نهاية، مع عرض الأيام والأسابيع والشهور التقريبية.",
    fields: [{ key: "start", label: "تاريخ البداية", type: "date", value: "" }, { key: "end", label: "تاريخ النهاية", type: "date", value: "today" }],
    formula: "عدد الأيام = الفرق بين التاريخين ÷ عدد المللي ثانية في اليوم.",
    note: "الحساب لا يشمل يوم البداية. إذا أردت العد الشامل أضف يومًا إلى الناتج."
  },
  {
    slug: "percentage-calculator",
    name: "حاسبة النسبة المئوية",
    short: "احسب نسبة جزء من إجمالي أو قيمة نسبة من مبلغ.",
    description: "أدخل الجزء والإجمالي لمعرفة النسبة المئوية التي يمثلها الجزء من الإجمالي.",
    fields: [{ key: "part", label: "الجزء", type: "number", step: "any", value: "25" }, { key: "total", label: "الإجمالي", type: "number", step: "any", value: "200" }],
    formula: "النسبة المئوية = الجزء ÷ الإجمالي × 100.",
    note: "إذا كان الإجمالي صفرًا فلا يمكن حساب النسبة."
  },
  {
    slug: "debt-ratio-calculator",
    name: "حاسبة نسبة الالتزامات من الراتب",
    short: "اعرف نسبة الأقساط والالتزامات إلى دخلك الشهري.",
    description: "اجمع أقساطك والتزاماتك الشهرية وقارنها بإجمالي دخلك لتكوين صورة أولية عن نسبة الالتزامات.",
    fields: [{ key: "income", label: "إجمالي الدخل الشهري (ريال)", type: "number", min: "0.01", step: "0.01", value: "10000" }, { key: "obligations", label: "إجمالي الأقساط والالتزامات الشهرية (ريال)", type: "number", min: "0", step: "0.01", value: "3000" }],
    formula: "نسبة الالتزامات = مجموع الالتزامات الشهرية ÷ الدخل الشهري × 100.",
    note: "مؤشر حسابي توضيحي فقط، وليس موافقة تمويلية أو حكمًا على القدرة الائتمانية. قد تختلف طريقة احتساب الجهات التمويلية للدخل والالتزامات."
  }
];

function fieldsHtml(fields) {
  return fields.map((field) => {
    const value = field.value === "today" ? "" : field.value;
    const attrs = ["min", "max", "step"].filter((key) => field[key] !== undefined).map((key) => `${key}="${escapeHtml(field[key])}"`).join(" ");
    const defaultToday = field.value === "today" ? ' data-today="true"' : "";
    return `<label class="tool-field"><span>${escapeHtml(field.label)}</span><input type="${field.type}" name="${field.key}" value="${escapeHtml(value)}" ${attrs} required${defaultToday}></label>`;
  }).join("");
}

function toolPage(tool) {
  const body = `
  <section class="tool-intro">
    <h1>${escapeHtml(tool.name)}</h1>
    <p>${escapeHtml(tool.description)}</p>
  </section>
  <section class="tool-panel" data-tool-calculator="${tool.slug}">
    <form class="tool-form">
      <div class="tool-fields">${fieldsHtml(tool.fields)}</div>
      <button class="tool-submit" type="submit">احسب الآن</button>
      <button class="tool-reset" type="reset">إعادة ضبط</button>
    </form>
    <div class="tool-result" aria-live="polite" hidden>
      <h2>النتيجة</h2>
      <div class="tool-result-content"></div>
    </div>
    <p class="tool-error" role="alert" hidden></p>
  </section>
  <section class="section tool-explainer">
    <h2>طريقة الحساب</h2>
    <p>${escapeHtml(tool.formula)}</p>
    <h2>ملاحظات مهمة</h2>
    <p>${escapeHtml(tool.note)}</p>
    <p><a href="/tools/">العودة إلى جميع الأدوات والحاسبات</a></p>
  </section>`;
  return renderPage({
    title: `${tool.name} — أدوات وحاسبات مجانية | ${SITE.name}`,
    description: tool.description,
    canonicalPath: `/tools/${tool.slug}/`,
    body,
    breadcrumbs: [{ name: "الرئيسية", path: "/" }, { name: "الأدوات", path: "/tools/" }, { name: tool.name, path: `/tools/${tool.slug}/` }],
  });
}

export function toolsIndexPage() {
  const cards = tools.map((tool) => `<li><a href="/tools/${tool.slug}/"><strong>${escapeHtml(tool.name)}</strong><span>${escapeHtml(tool.short)}</span></a></li>`).join("");
  const body = `
  <section class="hero">
    <h1>أدوات وحاسبات مجانية</h1>
    <p>مجموعة أدوات عملية للاستخدام اليومي في السعودية: احسب الضريبة والخصومات والأقساط وتكلفة الوقود والعمر والنسب والالتزامات الشهرية. تعمل الحسابات داخل متصفحك دون تسجيل أو إرسال بياناتك إلى خادم.</p>
  </section>
  <section class="section">
    <h2>الأدوات المتاحة</h2>
    <ul class="grid-list tools-grid">${cards}</ul>
  </section>
  <section class="section">
    <h2>عن هذه الأدوات</h2>
    <p>النتائج تقديرية وتعتمد على الأرقام التي تدخلها. اقرأ الملاحظات في كل حاسبة، ولا تعتمد على النتائج وحدها في القرارات المالية أو النظامية.</p>
  </section>`;
  return renderPage({
    title: `أدوات وحاسبات مجانية — ${SITE.name}`,
    description: "أدوات مجانية تعمل مباشرة في المتصفح: حاسبة ضريبة القيمة المضافة والخصم والأقساط والوقود والعمر والفرق بين تاريخين والنسب والالتزامات.",
    canonicalPath: "/tools/",
    body,
    breadcrumbs: [{ name: "الرئيسية", path: "/" }, { name: "الأدوات والحاسبات", path: "/tools/" }],
  });
}

export function toolPages() {
  return tools.map((tool) => ({ path: `/tools/${tool.slug}/`, html: toolPage(tool) }));
}
