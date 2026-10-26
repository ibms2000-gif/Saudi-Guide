# ترخيص بيانات الأماكن

تُستخرج جميع البيانات الموجودة في `data/places/*.json` من
[OpenStreetMap](https://www.openstreetmap.org/copyright) عبر
[Overpass API](https://overpass-api.de/)، وهي © مساهمو OpenStreetMap.

هذه البيانات متاحة بموجب [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/).
باستخدامك أو إعادة نشرك لهذه البيانات (بما فيها هذا المستودع) فأنت ملزم بـ:

1. **نسب المصدر (Attribution):** ذكر "© مساهمو OpenStreetMap" مع رابط
   `https://www.openstreetmap.org/copyright` عند استخدام البيانات.
2. **الإبقاء على المشاركة (Share-Alike):** أي قاعدة بيانات مشتقة من هذه
   البيانات (produced work لا يشملها هذا الشرط، لكن أي إعادة توزيع للبيانات
   نفسها يشملها) يجب إتاحتها بنفس الرخصة ODbL.
3. **الإبقاء على المفتوحية (Keep Open):** عدم فرض قيود تقنية تمنع الآخرين
   من استخدام البيانات بموجب نفس الرخصة.

لا تُنشئ بيانات هذا المستودع أو تُعدّل أو تُستكمل يدويًا؛ هي نسخة مجلوبة
آليًا بتاريخ الجلب المذكور في `data/places/_meta.json`، ويُعاد جلبها
دوريًا عبر سير العمل `refresh-data.yml`.

لا علاقة لهذا الترخيص ببيانات الأرصاد الجوية؛ الموقع لا يجلب أو ينشر أي
بيانات طقس أو مناخ (راجع `/legal/weather-notice/` على الموقع المنشور).
