import cities from "../src/data/cities.json";

const CATEGORY_QUERIES = {
  restaurants: [
    'node(around:12000,{lat},{lon})["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream|bar)$"];',
    'way(around:12000,{lat},{lon})["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream|bar)$"];',
    'relation(around:12000,{lat},{lon})["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream|bar)$"];'
  ],
  hotels: [
    'node(around:18000,{lat},{lon})["tourism"~"^(hotel|hostel|guest_house|motel|apartment|camp_site)$"];',
    'way(around:18000,{lat},{lon})["tourism"~"^(hotel|hostel|guest_house|motel|apartment|camp_site)$"];',
    'relation(around:18000,{lat},{lon})["tourism"~"^(hotel|hostel|guest_house|motel|apartment|camp_site)$"];'
  ],
  health: [
    'node(around:12000,{lat},{lon})["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy|veterinary)$"];',
    'way(around:12000,{lat},{lon})["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy|veterinary)$"];',
    'relation(around:12000,{lat},{lon})["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy|veterinary)$"];'
  ],
  education: [
    'node(around:12000,{lat},{lon})["amenity"~"^(school|college|university|kindergarten|language_school|driving_school)$"];',
    'way(around:12000,{lat},{lon})["amenity"~"^(school|college|university|kindergarten|language_school|driving_school)$"];',
    'relation(around:12000,{lat},{lon})["amenity"~"^(school|college|university|kindergarten|language_school|driving_school)$"];'
  ],
  services: [
    'node(around:12000,{lat},{lon})["amenity"~"^(bank|post_office|library|police|fire_station|townhall|community_centre|bus_station|fuel|marketplace|courthouse|public_building)$"];',
    'way(around:12000,{lat},{lon})["amenity"~"^(bank|post_office|library|police|fire_station|townhall|community_centre|bus_station|fuel|marketplace|courthouse|public_building)$"];',
    'relation(around:12000,{lat},{lon})["amenity"~"^(bank|post_office|library|police|fire_station|townhall|community_centre|bus_station|fuel|marketplace|courthouse|public_building)$"];'
  ],
  shopping: [
    'node(around:12000,{lat},{lon})["shop"];',
    'way(around:12000,{lat},{lon})["shop"];',
    'relation(around:12000,{lat},{lon})["shop"];',
    'node(around:12000,{lat},{lon})["amenity"="marketplace"];',
    'way(around:12000,{lat},{lon})["amenity"="marketplace"];'
  ],
  tourism: [
    'node(around:18000,{lat},{lon})["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park|aquarium|artwork|information)$"];',
    'way(around:18000,{lat},{lon})["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park|aquarium|artwork|information)$"];',
    'relation(around:18000,{lat},{lon})["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park|aquarium|artwork|information)$"];',
    'node(around:18000,{lat},{lon})["leisure"~"^(park|garden|water_park|nature_reserve|sports_centre)$"];',
    'way(around:18000,{lat},{lon})["leisure"~"^(park|garden|water_park|nature_reserve|sports_centre)$"];'
  ]
};

const CATEGORY_NAMES = {
  restaurants: "المطاعم والمقاهي",
  hotels: "الفنادق وأماكن الإقامة",
  health: "الصحة والطب",
  education: "التعليم",
  services: "الخدمات والمرافق",
  shopping: "التسوق والمتاجر",
  tourism: "السياحة والترفيه"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function cleanText(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function cachedJson(request, ctx, ttlSeconds, fetcher) {
  const cache = caches.default;
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.sort();
  const cacheKey = new Request(keyUrl.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Data-Cache", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  const data = await fetcher();
  const response = json(data.body, data.status ?? 200, {
    "Cache-Control": "public, max-age=60",
    "Access-Control-Allow-Origin": "*",
    "X-Data-Cache": "MISS",
    "X-Data-Source": data.source ?? "Saudi Guide"
  });
  if ((data.status ?? 200) === 200 && !data.body?.error) {
    const toCache = new Response(response.clone().body, { status: response.status, headers: response.headers });
    toCache.headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
    ctx.waitUntil(cache.put(cacheKey, toCache));
  }
  return response;
}

function formatPlace(element, city) {
  const tags = element.tags ?? {};
  const center = element.center ?? {};
  const lat = Number(element.lat ?? center.lat);
  const lon = Number(element.lon ?? center.lon);
  const name = tags["name:ar"] || tags.name || tags["name:en"] || "";
  const addressParts = [
    tags["addr:street"] || tags["addr:place"],
    tags["addr:housenumber"],
    tags["addr:suburb"] || tags["addr:district"],
    tags["addr:city"] || city.nameAr
  ].filter(Boolean);
  const kind = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.office || "مكان";
  const phone = tags["contact:phone"] || tags.phone || tags["contact:mobile"] || "";
  const website = tags["contact:website"] || tags.website || tags["contact:url"] || "";
  const openingHours = tags.opening_hours || "";
  return {
    id: String(element.type) + "/" + String(element.id),
    name,
    kind,
    kindLabel: kind.replaceAll("_", " "),
    address: addressParts.join("، "),
    phone: cleanText(phone, 80),
    website: /^https?:\/\//i.test(website) ? website : "",
    openingHours: cleanText(openingHours, 140),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    mapUrl: Number.isFinite(lat) && Number.isFinite(lon)
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`
      : `https://www.openstreetmap.org/search?query=${encodeURIComponent(name + " " + city.nameAr)}`
  };
}

async function getPlaces(request, ctx) {
  const url = new URL(request.url);
  const citySlug = cleanText(url.searchParams.get("city"), 60);
  const category = cleanText(url.searchParams.get("service"), 40);
  const city = cities.find((entry) => entry.slug === citySlug);
  if (!city || !Object.hasOwn(CATEGORY_QUERIES, category)) {
    return json({ error: "invalid_request", message: "اختر مدينة وقسمًا متاحين من الدليل." }, 400);
  }

  return cachedJson(request, ctx, 21600, async () => {
    const lat = Number(city.latitude).toFixed(4);
    const lon = Number(city.longitude).toFixed(4);
    const statement = CATEGORY_QUERIES[category].map((line) => line.replaceAll("{lat}", lat).replaceAll("{lon}", lon)).join("\n");
    const query = `[out:json][timeout:20];(\n${statement}\n);out center tags 100;`;
    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ];
    let upstream;
    for (const endpoint of endpoints) {
      try {
        const apiUrl = new URL(endpoint);
        apiUrl.searchParams.set("data", query);
        upstream = await fetch(apiUrl.toString(), {
          headers: {
            "Accept": "application/json",
            "User-Agent": "SaudiGuide/1.0 (https://github.com/ibms2000-gif/Saudi-Guide)"
          },
          signal: AbortSignal.timeout(22000)
        });
        if (upstream.ok) break;
      } catch {
        upstream = null;
      }
    }
    if (!upstream || !upstream.ok) {
      return {
        status: 502,
        source: "OpenStreetMap Overpass",
        body: {
          error: "places_unavailable",
          message: "تعذر جلب بيانات الأماكن الآن. حاول بعد قليل؛ لم نعرض بيانات تجريبية بدل النتائج الحقيقية.",
          city: city.nameAr,
          category: CATEGORY_NAMES[category]
        }
      };
    }

    let payload;
    try {
      payload = await upstream.json();
    } catch {
      return { status: 502, source: "OpenStreetMap Overpass", body: { error: "invalid_upstream", message: "وصل رد غير مفهوم من مصدر البيانات." } };
    }
    const seen = new Set();
    const places = (payload.elements ?? [])
      .map((element) => formatPlace(element, city))
      .filter((place) => {
        if (!place.name || seen.has(place.id)) return false;
        seen.add(place.id);
        return true;
      })
      .sort((a, b) => Number(Boolean(b.lat && b.lon)) - Number(Boolean(a.lat && a.lon)) || a.name.localeCompare(b.name, "ar"))
      .slice(0, 100);

    return {
      source: "OpenStreetMap",
      body: {
        city: city.nameAr,
        category: CATEGORY_NAMES[category],
        count: places.length,
        fetchedAt: new Date().toISOString(),
        attribution: "بيانات الأماكن © مساهمو OpenStreetMap، مرخصة بموجب ODbL.",
        attributionUrl: "https://www.openstreetmap.org/copyright",
        places
      }
    };
  });
}

async function getWeather(request, ctx) {
  const url = new URL(request.url);
  const citySlug = cleanText(url.searchParams.get("city"), 60);
  const city = cities.find((entry) => entry.slug === citySlug);
  if (!city) return json({ error: "invalid_city", message: "المدينة غير موجودة في الدليل." }, 400);

  return cachedJson(request, ctx, 1800, async () => {
    const apiUrl = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
    apiUrl.searchParams.set("lat", Number(city.latitude).toFixed(4));
    apiUrl.searchParams.set("lon", Number(city.longitude).toFixed(4));
    let upstream;
    try {
      upstream = await fetch(apiUrl.toString(), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "SaudiGuide/1.0 (https://github.com/ibms2000-gif/Saudi-Guide)"
        },
        signal: AbortSignal.timeout(10000)
      });
    } catch {
      return { status: 502, source: "MET Norway", body: { error: "weather_unavailable", message: "تعذر الاتصال بمصدر الطقس مؤقتًا." } };
    }

    if (!upstream.ok) {
      return {
        status: 502, source: "MET Norway",
        body: { error: "weather_unavailable", message: "مصدر الطقس لم يُرجع بيانات صالحة الآن.", upstreamStatus: upstream.status }
      };
    }

    const payload = await upstream.json();
    const series = payload.properties?.timeseries ?? [];
    if (!series.length) return { status: 502, source: "MET Norway", body: { error: "no_forecast", message: "لا توجد توقعات متاحة لهذه المدينة حاليًا." } };
    const units = payload.properties?.meta?.units ?? {};
    const hourly = series.slice(0, 24).map((entry) => {
      const instant = entry.data?.instant?.details ?? {};
      const nextHour = entry.data?.next_1_hours ?? entry.data?.next_6_hours ?? entry.data?.next_12_hours ?? {};
      return {
        time: entry.time,
        temperature: instant.air_temperature ?? null,
        humidity: instant.relative_humidity ?? null,
        windSpeed: instant.wind_speed ?? null,
        windDirection: instant.wind_from_direction ?? null,
        cloudCover: instant.cloud_area_fraction ?? null,
        symbol: nextHour.summary?.symbol_code ?? "",
        precipitation: nextHour.details?.precipitation_amount ?? null
      };
    });
    const current = hourly[0];
    return {
      source: "MET Norway Locationforecast",
      body: {
        city: city.nameAr,
        updatedAt: payload.properties?.meta?.updated_at ?? new Date().toISOString(),
        units: {
          temperature: units.air_temperature ?? "°C",
          windSpeed: units.wind_speed ?? "m/s",
          humidity: units.relative_humidity ?? "%"
        },
        current,
        hourly,
        attribution: "Weather data © Norwegian Meteorological Institute, licensed under CC BY 4.0.",
        attributionUrl: "https://api.met.no/doc/TermsOfService"
      }
    };
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/places") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET" });
      return getPlaces(request, ctx);
    }
    if (url.pathname === "/api/weather") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET" });
      return getWeather(request, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};
