import { renderPage } from "./layout.mjs";

const OFFICIAL_HEALTH_MAP = "https://www.moh.gov.sa/eservices/interactive-maps/pages/default.aspx";
const ON_DUTY_CENTRES = "https://www.moh.gov.sa/healthawareness/on-duty-healthcare-centers/pages/default.aspx";
const REHABILITATION_HOSPITALS = "https://www.moh.gov.sa/awarenessplateform/VariousTopics/Documents/PTHospitals.pdf";
const MENTAL_HEALTH_HOSPITALS = "https://www.moh.gov.sa/Ministry/Information-and-services/Documents/Psychological-health.pdf";
const MOH_OPEN_DATA = "https://www.moh.gov.sa/ministry/opendata/pages/open-data-library.aspx";
const MOE_SCHOOL_MAP = "https://www.moe.gov.sa/ar/education/educationinksa/gis/pages/default.aspx";
const MOE_OPEN_DATA = "https://moe.gov.sa/ar/services/data-and-statistics-center/opendata";
const MOE_LIVE_DATA = "https://www.moe.gov.sa/ar/services/data-and-statistics-center/reatltimedata";

function resourceCard({ title, summary, detail, url, kind }) {
  return `<li>
    <a href="${url}" target="_blank" rel="noopener noreferrer">
      <strong>${title}</strong>
      <span>${summary}</span>
      <small>${kind}</small>
    </a>
    <p class="resource-detail">${detail}</p>
  </li>`;
}

export function officialDirectoriesPage() {
  const healthResources = [
    resourceCard({
      title: "الخريطة التفاعلية للمنشآت الصحية",
      summary: "دليل وزارة الصحة للبحث عن المستشفيات ومراكز الرعاية الصحية الأولية والمنشآت المتخصصة.",
      detail: "تتيح الخدمة التصفية حسب المنطقة والمدينة ونوع المنشأة والخدمات المتاحة، وتعرض الموقع الجغرافي وساعات العمل المنشورة.",
      url: OFFICIAL_HEALTH_MAP,
      kind: "خريطة تفاعلية رسمية",
    }),
    resourceCard({
      title: "المراكز الصحية المناوبة",
      summary: "صفحة وزارة الصحة التي تعرض مراكز الرعاية المناوبة ومعلومات مواقعها وساعات عملها.",
      detail: "توضح الوزارة الفرق بين المراكز المناوبة على مدار الساعة ومراكز الدوام الممتد؛ تحقّق من التفاصيل المنشورة قبل التوجه إلى المركز.",
      url: ON_DUTY_CENTRES,
      kind: "دليل رسمي حسب المناطق",
    }),
    resourceCard({
      title: "المستشفيات التي بها أقسام تأهيل طبي",
      summary: "ملف رسمي من وزارة الصحة يسرد مستشفيات تتوفر بها خدمات وأقسام للتأهيل الطبي.",
      detail: "الملف بصيغة PDF ويعرض بيانات تعريفية ووسائل تواصل ومواقع لبعض المنشآت. راجع النسخة الأصلية لأي تحديثات.",
      url: REHABILITATION_HOSPITALS,
      kind: "قائمة PDF رسمية",
    }),
    resourceCard({
      title: "مستشفيات الصحة النفسية",
      summary: "قائمة منشآت الصحة النفسية المنشورة ضمن موارد وزارة الصحة.",
      detail: "استخدم الرابط للوصول إلى الملف الرسمي؛ لا تُعد هذه الصفحة بديلاً عن خدمات الطوارئ أو الاستشارة الطبية.",
      url: MENTAL_HEALTH_HOSPITALS,
      kind: "قائمة PDF رسمية",
    }),
    resourceCard({
      title: "مكتبة بيانات وزارة الصحة المفتوحة",
      summary: "مجموعات بيانات ومؤشرات صحية قابلة لإعادة الاستخدام وفق شروط نشرها.",
      detail: "تتضمن المكتبة بيانات ومؤشرات مجمعة بحسب المناطق الصحية، ومنها مؤشرات عن خدمات المستشفيات والأسرة والطوارئ؛ وهي مفيدة للتحليل الإحصائي وليست بالضرورة دليلاً عنوانياً لكل منشأة.",
      url: MOH_OPEN_DATA,
      kind: "مكتبة بيانات حكومية",
    }),
  ].join("");

  const educationResources = [
    resourceCard({
      title: "الخارطة التعليمية للمدارس",
      summary: "خريطة تفاعلية رسمية للبحث عن المدارس حسب المنطقة والمرحلة ونوع المدرسة ونوع التعليم والجنس أو اسم المدرسة.",
      detail: "توضح وزارة التعليم أن نظام الخرائط يهدف إلى حصر المدارس وبناء قاعدة بيانات لإحداثياتها وبياناتها الوصفية. الصفحة المتاحة للمستخدم تعرض أدوات استعلام تفاعلية؛ لم نتحقق من وجود ملف عام قابل للتنزيل يتيح إعادة نشر سجل شامل للمدارس، لذلك ندرجها كخريطة بحث رسمية لا كبيانات منسوخة.",
      url: MOE_SCHOOL_MAP,
      kind: "خريطة تعليمية تفاعلية رسمية",
    }),
    resourceCard({
      title: "البيانات المفتوحة لوزارة التعليم",
      summary: "مكتبة الوزارة للبيانات التعليمية والتقارير والإحصاءات.",
      detail: "تتضمن مجموعات مثل أعداد الطلبة ومؤشرات التعليم العام، وتُتاح بعض الملفات بصيغ CSV وJSON وExcel. افحص وصف كل مجموعة وسنة بياناتها قبل استخدامها.",
      url: MOE_OPEN_DATA,
      kind: "مكتبة بيانات حكومية",
    }),
    resourceCard({
      title: "البيانات اللحظية لوزارة التعليم",
      summary: "صفحة تتيح اختيار المرحلة التعليمية والجنس واستعراض البيانات المتاحة وتنزيلها.",
      detail: "تذكر الوزارة إتاحة التنزيل بصيغ JSON وExcel وCSV. تحقق من حقول الملف وتاريخ تحديثه؛ لا تفترض أن الإحصاءات تمثل سجلاً كاملاً لعناوين المدارس.",
      url: MOE_LIVE_DATA,
      kind: "بيانات وإحصاءات قابلة للتنزيل",
    }),
  ].join("");

  const body = `
  <section class="hero">
    <p class="eyebrow">مصادر حكومية مباشرة</p>
    <h1>الأدلة الحكومية الرسمية للمنشآت والخدمات</h1>
    <p>صفحة تجمع روابط البحث الرسمية عن المنشآت الصحية ومصادر البيانات التعليمية والصحية في المملكة. نوضح نوع كل مصدر حتى تعرف هل هو خريطة مواقع، أم قائمة منشآت، أم بيانات إحصائية.</p>
    <p><strong>آخر مراجعة للروابط:</strong> 24 نوفمبر 2026.</p>
  </section>

  <section class="section">
    <h2>أولاً: المنشآت الصحية</h2>
    <p>ابدأ بخريطة وزارة الصحة عند البحث عن منشأة صحية بعينها أو التحقق من موقعها ونوعها وساعات العمل المنشورة. أما ملفات القوائم فتفيد في أنواع محددة من المستشفيات والخدمات.</p>
    <ul class="grid-list">${healthResources}</ul>
    <p><a href="/health/mental-health-hospitals/">استعراض قائمة مستشفيات ومجمعات الصحة النفسية داخل دليل السعودية (19 منشأة)</a></p>
  </section>

  <section class="section">
    <h2>ثانياً: المدارس والتعليم</h2>
    <p>توفر وزارة التعليم خارطة تفاعلية للبحث عن المدارس وفق عدة فلاتر، إلى جانب مجموعات بيانات وتقارير تعليمية وصفحة بيانات لحظية مع خيارات تنزيل. الخريطة أداة بحث رسمية، لكننا لم نتحقق من ملف عام شامل للمدارس قابل لإعادة النشر؛ لذلك لا نحوّل سجلاتها إلى صفحات فردية قبل توفر بيانات قابلة للاستخدام والترخيص والتحقق.</p>
    <ul class="grid-list">${educationResources}</ul>
  </section>

  <section class="section">
    <h2>المراكز الصحية المناوبة</h2>
    <p>أضفنا قوائم أسماء المراكز الصحية المناوبة الواردة في صفحات وزارة الصحة الإقليمية، مع رابط مباشر إلى صفحة الوزارة التي تعرض جدول المناوبة وروابط الخرائط لكل مركز.</p>
    <p><a href="/health/on-duty/">استعراض دليل المراكز الصحية المناوبة داخل الموقع</a></p>
  </section>

  <section class="section">
    <h2>قوائم الأماكن المتاحة داخل دليل السعودية</h2>
    <p>يعرض الموقع أيضاً سجلات أماكن مجمّعة من مساهمي OpenStreetMap. هذه السجلات مستقلة عن أدلة الوزارات، وقد تكون غير مكتملة أو قديمة، ولا تمثل سجلاً حكومياً أو اعتماداً رسمياً للمنشأة.</p>
    <ul class="pill-list">
      <li><a href="/category/health/">الأماكن الصحية المسجلة في OpenStreetMap</a></li>
      <li><a href="/category/education/">الأماكن التعليمية المسجلة في OpenStreetMap</a></li>
      <li><a href="/about/data-sources/">سياسة مصادر البيانات والترخيص</a></li>
    </ul>
  </section>

  <aside class="source-note">
    <strong>ملاحظة مهمة:</strong> الروابط أعلاه تقود إلى المواقع والملفات الأصلية للجهات الحكومية. لا ينسخ دليل السعودية محتويات الخرائط الحكومية ولا يدّعي أنها متزامنة معه. عند اختلاف البيانات، اعتمد المصدر الرسمي للجهة واستخدم بيانات الدليل المحلي للاستدلال الأولي فقط.
  </aside>`;

  return renderPage({
    title: "الأدلة الحكومية الرسمية للمنشآت الصحية والتعليمية — دليل السعودية",
    description: "روابط مباشرة إلى أدلة وزارة الصحة والبيانات المفتوحة لوزارتي الصحة والتعليم، مع توضيح الفرق بين خرائط المنشآت والإحصاءات وقوائم OpenStreetMap.",
    canonicalPath: "/official-directories/",
    body,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "الأدلة الحكومية الرسمية", path: "/official-directories/" },
    ],
  });
}
