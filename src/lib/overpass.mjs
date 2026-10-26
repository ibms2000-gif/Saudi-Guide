// غلاف لطلبات Overpass API مع إعادة محاولة ومهلة أدب بين المدن
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function buildQuery(lat, lon, radius, categories) {
  const filters = [];
  for (const cat of categories) {
    for (const q of cat.osmQueries) {
      const [key, value] = q.split("=");
      const sel = value === "*" ? `["${key}"]` : `["${key}"="${value}"]`;
      filters.push(`node(around:${radius},${lat},${lon})${sel};`);
      filters.push(`way(around:${radius},${lat},${lon})${sel};`);
    }
  }
  return `[out:json][timeout:60];(\n${filters.join("\n")}\n);out center tags;`;
}

export async function fetchOverpass(query, { retries = 3, endpointIndex = 0 } = {}) {
  const endpoint = ENDPOINTS[endpointIndex % ENDPOINTS.length];
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      signal: AbortSignal.timeout(75000),
    });
    if (!res.ok) {
      if ([429, 500, 502, 503, 504].includes(res.status)) {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 5000));
          return fetchOverpass(query, { retries: retries - 1, endpointIndex: endpointIndex + 1 });
        }
      }
      throw new Error(`Overpass HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.elements || [];
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 3000));
      return fetchOverpass(query, { retries: retries - 1, endpointIndex: endpointIndex + 1 });
    }
    throw err;
  }
}

export function elementToRecord(el) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  return {
    osmType: el.type,
    osmId: el.id,
    lat,
    lon,
    tags: el.tags || {},
  };
}
