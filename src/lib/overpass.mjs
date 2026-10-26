// Overpass client with bounded retries and explicit rate-limit handling.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const RETRYABLE_SERVER_STATUSES = new Set([500, 502, 503, 504]);
const DEFAULT_RATE_LIMIT_WAIT_MS = 30_000;
const MAX_INLINE_RATE_LIMIT_WAIT_MS = 180_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryAfterMs(headers) {
  const raw = headers?.get?.("retry-after");
  if (!raw) return null;

  const seconds = Number(raw);
  if (raw.trim() !== "" && Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

export function buildQuery(lat, lon, radius, categories) {
  const filters = [];
  for (const cat of categories) {
    for (const q of cat.osmQueries) {
      const [key, value] = q.split("=");
      const sel = value === "*" ? `["${key}"]` : `["${key}"="${value}"]`;
      // nwr selects nodes, ways and relations with one clause, reducing query size.
      filters.push(`nwr(around:${radius},${lat},${lon})${sel};`);
    }
  }
  return `[out:json][timeout:60];(\n${filters.join("\n")}\n);out center tags;`;
}

/**
 * Query a public Overpass instance without recursively multiplying requests.
 *
 * A 429 is handled differently from server failures: honour Retry-After (or
 * pause at least 30 seconds), retry the same endpoint once, then stop. We do
 * not switch mirrors to work around a rate limit. Other transient server and
 * network failures may use the next configured endpoint with bounded backoff.
 */
export async function fetchOverpass(query, {
  retries = 2,
  endpointIndex = 0,
  fetchImpl = globalThis.fetch,
  sleepFn = sleep,
  rateLimitFallbackMs = DEFAULT_RATE_LIMIT_WAIT_MS,
  maxInlineRateLimitWaitMs = MAX_INLINE_RATE_LIMIT_WAIT_MS,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch API is unavailable in this Node.js runtime.");
  }

  let attempt = 0;
  let endpointCursor = endpointIndex;
  let rateLimitRetries = 0;

  while (attempt <= retries) {
    const endpoint = ENDPOINTS[((endpointCursor % ENDPOINTS.length) + ENDPOINTS.length) % ENDPOINTS.length];
    let res;

    try {
      res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "Saudi-Guide/2.0 (OpenStreetMap place-data refresh)",
        },
        body: query,
        signal: AbortSignal.timeout(75_000),
      });
    } catch (err) {
      if (attempt >= retries) throw err;
      attempt += 1;
      endpointCursor += 1;
      await sleepFn(Math.min(30_000, 5_000 * 2 ** (attempt - 1)));
      continue;
    }

    if (res.status === 429) {
      const serverWaitMs = retryAfterMs(res.headers);
      const waitMs = Math.max(serverWaitMs ?? rateLimitFallbackMs, rateLimitFallbackMs);

      if (serverWaitMs !== null && serverWaitMs > maxInlineRateLimitWaitMs) {
        throw new Error(
          `Overpass HTTP 429; server requested a ${Math.ceil(serverWaitMs / 1000)}s wait. ` +
          "Stopping this batch to avoid repeated requests; rerun after the cooldown.",
        );
      }
      if (rateLimitRetries >= 1) {
        throw new Error(
          `Overpass HTTP 429 after waiting ${Math.ceil(waitMs / 1000)}s; ` +
          "stopping instead of repeatedly querying a rate-limited service.",
        );
      }

      console.warn(`Overpass HTTP 429 from ${endpoint}; waiting ${Math.ceil(waitMs / 1000)}s before one retry.`);
      await sleepFn(waitMs);
      rateLimitRetries += 1;
      attempt += 1;
      // Keep endpointCursor unchanged: a 429 is not a reason to switch mirrors.
      continue;
    }

    if (!res.ok) {
      if (RETRYABLE_SERVER_STATUSES.has(res.status) && attempt < retries) {
        attempt += 1;
        endpointCursor += 1;
        await sleepFn(Math.min(30_000, 5_000 * attempt));
        continue;
      }
      throw new Error(`Overpass HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json.remark) {
      throw new Error(`Overpass query error: ${String(json.remark).slice(0, 300)}`);
    }
    return json.elements || [];
  }

  throw new Error("Overpass request failed after the configured retries.");
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
