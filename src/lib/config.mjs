// إعدادات عامة للموقع
const DEFAULT_SITE_URL = "https://saudi-guide.ibms2000.workers.dev";

function normalizeSiteUrl(value) {
  try {
    const parsed = new URL(String(value || DEFAULT_SITE_URL).trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return DEFAULT_SITE_URL;
    // The site is deployed at the host root; dropping paths and trailing slashes
    // prevents malformed canonical URLs such as https://example.com//city/.
    return parsed.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE = {
  name: "دليل السعودية",
  shortName: "دليل السعودية",
  url: normalizeSiteUrl(process.env.SITE_URL),
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
