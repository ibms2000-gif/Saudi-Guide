export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export async function readJSON(fs, path) {
  const text = await fs.readFile(path, "utf8");
  return JSON.parse(text);
}

export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Allow only ordinary HTTP(S) links from community-maintained place data.
export function safeHttpUrl(input) {
  if (input === null || input === undefined) return null;
  try {
    const url = new URL(String(input).trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

// Return a normalized telephone URI only when the entire value looks like a phone number.
export function safeTelephone(input) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!/^\+?[\d\s().-]{3,29}$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 20) return null;
  const normalized = raw.replace(/[^\d+]/g, "");
  if ((normalized.match(/\+/g) || []).length > 1 || (normalized.includes("+") && !normalized.startsWith("+"))) return null;
  return normalized;
}
