// إعدادات عامة للموقع
export const SITE = {
  name: "دليل السعودية",
  shortName: "دليل السعودية",
  url: process.env.SITE_URL || "https://saudi-guide.ibms2000.workers.dev",
  description:
    "دليل تصفح لمدن ومحافظات المملكة العربية السعودية: مطاعم، محلات تسوق، خدمات، صحة، تعليم، سياحة وفنادق، مبني على بيانات خرائط مفتوحة المصدر.",
  locale: "ar",
  dir: "rtl",
};

// مصدر البيانات: يجب ذكره في كل صفحة تعرض بيانات أماكن
export const DATA_SOURCE = {
  nameAr: "OpenStreetMap",
  url: "https://www.openstreetmap.org/copyright",
  licenseAr: "رخصة قاعدة بيانات المحتوى المفتوح (ODbL)",
  licenseUrl: "https://opendatacommons.org/licenses/odbl/",
  viaAr: "واجهة Overpass API",
};
