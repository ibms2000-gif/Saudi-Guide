# إعداد قاعدة البيانات D1 لدليل السعودية

> **الحالة:** البنية البرمجية جاهزة، لكن لم ننشئ قاعدة D1 بعيدة ولم نربطها بالإنتاج. لم تُرسل أي بيانات إلى حساب Cloudflare من هذا التغيير.
>
> **Binding الذي يتوقعه Worker:** `DB`
>
> **الملفات:** `migrations/0001_initial.sql`، `src/lib/d1-repository.mjs`، `scripts/export-d1-snapshot.mjs`.

## لماذا D1؟

الملفات JSON الثابتة مناسبة للانطلاق، لكنها تجعل Worker يقرأ ملف مدينة كاملًا ثم يبحث عن المكان داخل المصفوفة. مع توسع عدد المدن والسجلات، نريد استعلامًا مباشرًا ومفهرسًا للمكان والفئة والمدينة.

يحتوي المخطط على:

- المناطق والمدن والتصنيفات.
- الأماكن ومعرف OpenStreetMap ونوع العنصر والإحداثيات والعنوان والهاتف والموقع وساعات العمل.
- برامج المنافع الحكومية والأحداث ومواعيد الرواتب والأخبار والإحصاءات كسجلات مرجعية.
- المصادر والرخص وتواريخ التحقق.
- سجل الصفحات وحالة أهلية الفهرسة وسبب الاستبعاد.
- سجل عمليات استيراد البيانات وبصمة اللقطة.

لا تتغير ملكية بيانات الأماكن أو شروطها: مصدرها مساهمو OpenStreetMap وتبقى خاضعة لـ ODbL، مع نسب المصدر كما في `data/DATA_LICENSE.md`.

## ما الذي نُفّذ؟

- [x] مخطط الجداول والفهارس في `migrations/0001_initial.sql`.
- [x] استعلام بحث مباشر عن المكان عبر `city_slug + osm_type + osm_id` في `src/lib/d1-repository.mjs`.
- [x] Worker يستخدم D1 اختياريًا عندما يتوفر binding باسم `DB`، ويحافظ على ملفات JSON الحالية إذا لم يكن الربط موجودًا.
- [x] مولّد SQL في `scripts/export-d1-snapshot.mjs`.
- [x] أمر `npm run d1:export` ينشئ ملفًا محليًا في `.tmp/d1-snapshot.sql`.
- [x] اختبارات للمستودع ومولّد SQL وهروب النصوص والروابط وحالة noindex.
- [x] تحديث سير عمل جلب المدن لتثبيت الاعتماديات قبل الاختبارات؛ هذا يعالج فشل تشغيل 41701980092 الذي كان بسبب غياب حزمة `adhan`.
- [ ] اجتياز CI على الفرع ودمج الأساس البرمجي.
- [ ] إنشاء قاعدة D1 من حساب Cloudflare.
- [ ] إضافة معرّف القاعدة وربطها باسم `DB`.
- [ ] تطبيق Migration واستيراد اللقطة الأولى.
- [ ] التحقق من أعداد السجلات قبل تشغيل Worker مع binding.
- [ ] تفعيل D1 للإنتاج بعد نجاح اختبار قراءة صفحة مكان فعلية.

## طريقة إنشاء قاعدة وربطها

هذه الخطوة تحتاج حساب Cloudflare الخاص بمالك المشروع. لا نضع معرّفًا تخمينيًا في `wrangler.jsonc`.

### 1. إنشاء القاعدة

من مجلد المشروع شغّل:

```bash
npx wrangler d1 create saudi-guide-db
```

سيعيد Wrangler اسم قاعدة البيانات ومعرّفًا فريدًا. احتفظ بالمعرّف.

### 2. ربطها بالـ Worker

أضف هذا القسم إلى المستوى الأعلى من `wrangler.jsonc` داخل الكائن الرئيسي، واستبدل النص المؤقت بالمعرّف الفعلي:

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "saudi-guide-db",
    "database_id": "PUT_REAL_DATABASE_ID_HERE",
    "migrations_dir": "migrations"
  }
]
```

لا تضع `PUT_REAL_DATABASE_ID_HERE` كما هو. أضف المعرّف الصحيح الذي أعاده Cloudflare. سيصبح الاتصال متاحًا للـ Worker عبر `env.DB`.

### 3. تطبيق المخطط

```bash
npx wrangler d1 migrations apply saudi-guide-db --remote
```

### 4. تجهيز اللقطة الأولية محليًا

```bash
npm install
npm run d1:export
```

ينشئ الأمر `.tmp/d1-snapshot.sql` ويطبع عدد المناطق والمدن والأماكن والصفحات ومصادر البيانات وبصمة SHA-256.

**المصدّر محلي فقط:** لا يتصل بقاعدة البيانات ولا ينفذ أي كتابة عن بُعد.

### 5. استيراد اللقطة إلى قاعدة جديدة

بعد التأكد من تطبيق Migration على قاعدة جديدة:

```bash
npx wrangler d1 execute saudi-guide-db --remote --file=./.tmp/d1-snapshot.sql
```

ثم تحقق من أعداد السجلات:

```bash
npx wrangler d1 execute saudi-guide-db --remote --command "SELECT COUNT(*) AS places FROM places;"
npx wrangler d1 execute saudi-guide-db --remote --command "SELECT COUNT(*) AS cities FROM cities;"
npx wrangler d1 execute saudi-guide-db --remote --command "SELECT COUNT(*) AS indexable_place_pages FROM page_registry WHERE page_type='place' AND is_indexable=1;"
```

### 6. تفعيل D1

لا تضف binding إلى Worker قبل إكمال الاستيراد والتحقق. إذا وجد Worker binding باسم `DB` فسيستخدم D1 كمصدر أساسي لصفحات الأماكن. إذا لم يوجد binding، يستمر استخدام ملفات JSON الحالية.

**تحذير:** ملف اللقطة يعيد بناء جداول البيانات؛ إذ يحذف سجلات اللقطة الحالية ثم يدرجها مجددًا. استخدمه للتهيئة الأولى على قاعدة جديدة أو بعد نسخة احتياطية وخطة صيانة، ولا تشغّله عشوائيًا على قاعدة إنتاج نشطة. التحديث الدوري بعد التهيئة يجب أن يتحول إلى استيراد تفاضلي حسب المدينة أو السجل المتغير.

## حدود الخطة المجانية

وفق جدول Cloudflare المنشور بتاريخ 30 أكتوبر 2026، حدود D1 المجانية تشمل:

- 500MB للقاعدة الواحدة.
- 5GB إجمالي مساحة D1 المجانية على الحساب.
- 5 ملايين صف مقروء يوميًا و100 ألف صف مكتوب يوميًا.
- 50 استعلام قراءة فرعيًا لكل استدعاء Worker.

منذ 1 سبتمبر 2026، تتوقف استعلامات D1 في خطة Workers Free عند تجاوز حد القراءة أو الكتابة اليومي حتى منتصف الليل UTC، مع بقاء البيانات محفوظة. لذلك يختار التصميم استعلامًا مفهرسًا واحدًا لصفحة المكان بدل قراءة ملف مدينة كامل عند كل طلب.

حجم بياناتنا الحالية مناسب لتجربة أولية على المجاني، لكن لا نفترض أن الخطة المجانية ستكفي لمليون سجل أو ملايين الزيارات. إذا اقتربنا من 500MB أو حصص الاستخدام، نعيد تقييم تخزين الأرشيف الخام في R2، أو تقسيم المخزون، أو الترقية بعد قياس التكلفة. **لا يوجد أي ترقية مدفوعة أو إنشاء قاعدة بعيد تلقائي ضمن هذه المرحلة.**

## مراجع Cloudflare الرسمية

- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 Import and Export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [D1 Getting Started and Binding](https://developers.cloudflare.com/d1/get-started/)
- [Enforcement of Free-tier daily limits](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
