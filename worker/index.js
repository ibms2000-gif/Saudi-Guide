// عامل Cloudflare Workers: لا يقوم بأي جلب حيّ للبيانات (لا طقس ولا OSM).
// وظيفته فقط إعادة توجيه الروابط القديمة وتقديم الملفات الثابتة من dist/.
import citiesData from "../data/cities.json";
import categoriesData from "../data/categories.json";

const CITY_SLUGS = new Set(citiesData.map((c) => c.slug));
const CATEGORY_SLUGS = new Set(categoriesData.map((category) => category.slug));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;

    // روابط الطقس القديمة: لم يعد الموقع يعرض بيانات أرصاد جوية
    const weatherDirMatch = p.match(/^\/directory\/([^/]+)\/weather\/?$/);
    if (weatherDirMatch && CITY_SLUGS.has(weatherDirMatch[1])) {
      return redirect(url, `/city/${weatherDirMatch[1]}/`);
    }
    const weatherSlugMatch = p.match(/^\/weather\/([^/]+)\/?$/);
    if (weatherSlugMatch && CITY_SLUGS.has(weatherSlugMatch[1])) {
      return redirect(url, `/city/${weatherSlugMatch[1]}/`);
    }
    if (p === "/services/weather" || p === "/services/weather/") {
      return redirect(url, "/legal/weather-notice/");
    }

    // Legacy category/city URLs are redirected for every configured category.
    const legacyCategoryMatch = p.match(/^\/([^/]+)\/([^/]+)\/?$/);
    if (
      legacyCategoryMatch &&
      CATEGORY_SLUGS.has(legacyCategoryMatch[1]) &&
      CITY_SLUGS.has(legacyCategoryMatch[2])
    ) {
      return redirect(url, `/city/${legacyCategoryMatch[2]}/${legacyCategoryMatch[1]}/`);
    }

    // أي استدعاء API قديم (كان يجلب بيانات حيّة) لم يعد متاحًا
    if (p.startsWith("/api/")) {
      return new Response("This endpoint has been retired. Data is now served as static pages.", {
        status: 410,
      });
    }

    return env.ASSETS.fetch(request);
  },
};

function redirect(url, pathname) {
  return Response.redirect(`${url.origin}${pathname}`, 301);
}
