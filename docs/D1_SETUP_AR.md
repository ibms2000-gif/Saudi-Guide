# إعداد قاعدة البيانات D1 لدليل السعودية

> **الحالة:** البنية البرمجية جاهزة، لكن لا توجد قاعدة D1 مربوطة بالإنتاج حتى الآن. لم ننشئ موردًا بعيدًا أو نرسل بيانات إلى Cloudflare من هذا المستودع.
>
> **الربط المطلوب داخل Worker:** `DB`
>
> **ملفات المشروع:** `migrations/0001_initial.sql` و`scripts/export-d1-snapshot.mjs`.

## لماذا نضيف D1؟

الملفات JSON الثابتة الحالية مناسبة لمرحلة البيانات الأولى، لكنها تجعل Worker يقرأ ملف مدينة كاملًا ثم يبحث عن المكان داخل المصفوفة. عند نمو البيانات، نحتاج استعلامًا مباشرًا مفهرسًا عن المكان أو الفئة.

المخطط الجديد يخزن:

- المناطق والمدن والتصنيفات.
- الأماكن ومعرف OpenStreetMap والإحداثيات والعنوان والهاتف والموقع وساعات العمل.
- البرامج الحكومية والأحداث ومواعيد الرواتب والأخبار والإحصاءات كسجلات مرجعية.
- المصادر والرخص وتواريخ التحقق.
- سجل الصفحات وحالة أهلية الفهرسة وسبب الاستبعاد.
- سجل عمليات الاستيراد وبصمة اللقطة.

يظل مصدر بيانات الأماكن OpenStreetMap ومساهميه، مع الالتزام بترخيص ODbL ونسب المصدر كما يوضح `data/DATA_LICENSE.md`.

## ما الذي نُفّذ برمجيًا؟

- [x] Migration أولية في `migrations/0001_initial.sql`.
- [x] مستودع قراءة مفهرس في `src/lib/d1-repository.mjs` للبحث بمفتاح المدينة ونوع عنصر OSM ورقمه.
- [x] Worker اختياري: إذا وجد binding باسم `DB` يقرأ صفحة المكان من D1؛ إذا لم يوجد، يستخدم ملفات JSON الحالية.
- [x] مولّد SQL تصديري في `scripts/export-d1-snapshot.mjs`.
- [x] أمر `npm run d1:export` لإنشاء ملف محلي في `.tmp/d1-snapshot.sql`.
- [x] اختبارات للمستودع ومولّد التصدير.
- [x] تحديث سير عمل جلب المدن لتثبيت الاعتماديات قبل الاختبارات؛ كان هذا سبب فشل التشغيل 41701980092 عند غياب حزمة `adhan`.
- [ ] إنشاء قاعدة D1 من حساب Cloudflare.
- [ ] إضافة معرّف القاعدة وربطها باسم `DB`.
- [ ] تطبيق Migration على القاعدة البعيدة.
- [ ] استيراد اللقطة الأولية والتحقق من أعداد السجلات.
- [ ] تفعيل القراءة من D1 في Worker بعد نجاح الاستيراد.
- [ ] مراقبة الأداء والاستهلاك قبل تحويل بقية الصفحات من JSON إلى D1.

## خطوات إنشاء قاعدة D1 وربطها

تحتاج هذه الخطوة إلى حساب Cloudflare الخاص بمالك المشروع. لا نضع رقمًا تخمينيًا في `wrangler.jsonc`.

1. من مجلد المشروع شغّل:

```bash
npx wrangler d1 create saudi-guide-db
```

سيعيد Wrangler اسم القاعدة ومعرّفًا فريدًا. انسخ المعرّف فقط إلى إعداد Worker.

2. أضف هذا القسم إلى المستوى الأعلى من `wrangler.jsonc`، داخل الكائن الرئيسي، مع استبدال القيمة بالمعرّف الذي أعاده Cloudflare:

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

لا تضع النص `PUT_REAL_DATABASE_ID_HERE` كما هو؛ يجب وضع المعرّف الحقيقي. اترك `database_id` غير موجود في Git حتى يتم الحصول عليه من حساب المالك.

3. طبّق المخطط على القاعدة البعيدة:

```bash
npx wrangler d1 migrations apply saudi-guide-db --remote
```

4. أنشئ ملف الاستيراد المحلي:

```bash
npm install
npm run d1:export
```

ينتج الملف `.tmp/d1-snapshot.sql`. المصدّر **لا يتصل بقاعدة D1 ولا ينفذ أي كتابة عن بُعد**.

5. بعد التأكد من إنشاء القاعدة وتطبيق Migration، استورد الملف:

```bash
npx wrangler d1 execute saudi-guide-db --remote --file=./.tmp/d1-snapshot.sql
```

6. افحص أعداد السجلات:

```bash
npx wrangler d1 execute saudi-guide-db --remote --command "SELECT COUNT(*) AS places FROM places;"
npx wrangler d1 execute saudi-guide-db --remote --command "SELECT COUNT(*) AS cities FROM cities;"
npx wrangler d1 execute saudi-guide-db --remote --command "SELECT COUNT(*) AS indexable_place_pages FROM page_registry WHERE page_type='place' AND is_indexable=1;"
```

**مهم:** ملف التصدير يعيد بناء اللقطة كاملة ويبدأ بمسح جداول اللقطة ثم إدخال البيانات. استخدمه للتهيئة الأولية على قاعدة جديدة بعد النسخ الاحتياطي، ولا تشغله عشوائيًا على قاعدة إنتاج نشطة. التحديثات الدورية بعد التهيئة يجب أن تصبح عمليات استيراد تفاضلية للمدن أو السجلات المتغيرة.

7. بعد اكتمال الاستيراد والتحقق، تأكد أن Worker لديه binding باسم `DB` في Production. عندها ستستخدم صفحات الأماكن البحث المباشر المفهرس. إذا تعذر استعلام D1 أثناء تفعيل الربط، ترجع صفحة المكان 503 بدل عرض بيانات قديمة بصمت.

## حدود الخطة المجانية والتكلفة

وفق جدول Cloudflare المنشور بتاريخ 30 أكتوبر 2026، حدود D1 المجانية تشمل:

- حتى 500MB للقاعدة الواحدة.
- حتى 5GB إجمالي مساحة D1 المجانية على الحساب.
- 5 ملايين صف مقروء يوميًا و100 ألف صف مكتوب يوميًا.
- حتى 50 استعلام قراءة فرعيًا لكل استدعاء Worker.

تؤكد Cloudflare أن D1 يتضمن خطة مجانية للتجربة، لكن بعد 1 سبتمبر 2026 أصبحت الاستعلامات تفشل حتى منتصف الليل UTC عند تجاوز حد القراءة أو الكتابة اليومي في خطة Workers Free. لذلك نستخدم فهارس واستعلامًا محددًا واحدًا بدل قراءة ملف مدينة كامل في كل طلب، ونراقب لوحة Metrics.

المليون هدف URLs وليس بالضرورة مليون سجل مكان. إذا نمت قاعدة البيانات إلى ما يتجاوز حدود التخزين المجاني، نعيد تقييم التقسيم أو استخدام R2 للأرشيف الخام أو الترقية فقط بعد قياس الاستخدام والتكلفة. لا نفعل ترقية مدفوعة تلقائيًا.

## مراجع Cloudflare الرسمية

- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 Import and Export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [D1 Getting Started and Binding](https://developers.cloudflare.com/d1/get-started/)
