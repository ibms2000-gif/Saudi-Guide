// Cloudflare Worker: يخدم الصفحات الثابتة ويولّد صفحات تفاصيل الأماكن عند الطلب.
import citiesData from "../data/cities.json";
import categoriesData from "../data/categories.json";
import { isPlacePageIndexable, renderPlacePage } from "../src/lib/place-page.mjs";

const CITIES_BY_SLUG = new Map(citiesData.map((city) => [city.slug, city]));
const CITY_SLUGS = new Set(CITIES_BY_SLUG.keys());
const CATEGORY_SLUGS = new Set(categoriesData.map((category) => category.slug));
const CATEGORIES_BY_SLUG = new Map(categoriesData.map((category) => [category.slug, category]));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;

    // صفحة المكان داخل دليل السعودية؛ لا نرسل الزائر إلى OpenStreetMap تلقائيًا.
    const placeMatch = p.match(/^\\/place\\/([a-z0-9-]+)\\/(node|way|relation)\\/(\\d+)\\/?$/);
    if (placeMatch && CITY_SLUGS.has(placeMatch[1])) {
      return servePlacePage(request, env, url, placeMatch);
    }

    // روابط الطقس القديمة: لم يعد الموقع يعرض بيانات أرصاد جوية.
    const weatherDirMatch = p.match(/^\\/directory\\/([^/]+)\\/weather\\/?$/);
    if (weatherDirMatch && CITY_SLUGS.has(weatherDirMatch[1])) {
      return redirect(url, `/city/${weatherDirMatch[1]}/`);
    }
    const weatherSlugMatch = p.match(/^\\/weather\\/([^/]+)\\/?$/);
    if (weatherSlugMatch && CITY_SLUGS.has(weatherSlugMatch[1])) {
      return redirect(url, `/city/${weatherSlugMatch[1]}/`);
    }
    if (p === "/services/weather" || p === "/services/weather/") {
      return redirect(url, "/legal/weather-notice/");
    }

    // Legacy category/city URLs are redirected for every configured category.
    const legacyCategoryMatch = p.match(/^\\/([^/]+)\\/([^/]+)\\/?$/);
    if (
      legacyCategoryMatch &&
      CATEGORY_SLUGS.has(legacyCategoryMatch[1]) &&
      CITY_SLUGS.has(legacyCategoryMatch[2])
    ) {
      return redirect(url, `/city/${legacyCategoryMatch[2]}/${legacyCategoryMatch[1]}/`);
    }

    // أي استدعاء API قديم (كان يجلب بيانات حيّة) لم يعد متاحًا.
    if (p.startsWith("/api/")) {
      return new Response("This endpoint has been retired.", {
        status: 410,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};

async function servePlacePage(request, env, url, match) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const [, citySlug, osmType, osmId] = match;
  const city = CITIES_BY_SLUG.get(citySlug);
  const assetUrl = new URL(`/data/places/${citySlug}.json`, url.origin);

  let placesResponse;
  try {
    placesResponse = await env.ASSETS.fetch(new Request(assetUrl));
  } catch {
    return placeNotFound();
  }
  if (!placesResponse.ok) return placeNotFound();

  let places;
  try {
    places = await placesResponse.json();
  } catch {
    return new Response("Place data is temporarily unavailable.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (!Array.isArray(places)) return placeNotFound();
  const place = places.find(
    (item) => item && item.osmType === osmType && String(item.osmId) === osmId,
  );
  if (!place) return placeNotFound();

  let fetchedAt = null;
  try {
    const metaUrl = new URL("/data/places/_meta.json", url.origin);
    const metaResponse = await env.ASSETS.fetch(new Request(metaUrl));
    if (metaResponse.ok) {
      const meta = await metaResponse.json();
      fetchedAt = meta?.cities?.[citySlug]?.fetchedAt || null;
    }
  } catch {
    // تفاصيل المكان تبقى متاحة حتى عند تعذّر قراءة تاريخ آخر تحديث.
  }

  const category = CATEGORIES_BY_SLUG.get(place.categorySlug) || null;
  const html = renderPlacePage({
    place,
    city,
    category,
    siteUrl: url.origin,
    fetchedAt,
  });
  const indexable = isPlacePageIndexable(place);
  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
    "x-content-type-options": "nosniff",
    "x-robots-tag": indexable ? "index, follow" : "noindex, follow",
  };

  return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
}

function placeNotFound() {
  return new Response(
    '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="robots" content="noindex"><title>المكان غير موجود</title><body><h1>المكان غير موجود</h1><p><a href="/">العودة إلى دليل السعودية</a></p></body></html>',
    {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}

function redirect(url, pathname) {
  return Response.redirect(`${url.origin}${pathname}`, 301);
}
