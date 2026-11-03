import { SITE } from "./config.mjs";

const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const MAX_URLS_PER_SITEMAP = 50000;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizePaths(paths) {
  const result = [];
  const seen = new Set();
  for (const path of paths || []) {
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    result.push(path);
  }
  return result;
}

function sitemapUrlset(paths, base) {
  const newline = "\n";
  const urls = paths
    .map((path) => "  <url><loc>" + escapeXml(base + path) + "</loc></url>")
    .join(newline);
  return '<?xml version="1.0" encoding="UTF-8"?>' + newline +
    '<urlset xmlns="' + SITEMAP_NS + '">' + newline +
    urls + newline + "</urlset>" + newline;
}

function sitemapIndex(files, base) {
  const newline = "\n";
  const entries = files
    .map((file) => "  <sitemap><loc>" + escapeXml(base + file.path) + "</loc></sitemap>")
    .join(newline);
  return '<?xml version="1.0" encoding="UTF-8"?>' + newline +
    '<sitemapindex xmlns="' + SITEMAP_NS + '">' + newline +
    entries + newline + "</sitemapindex>" + newline;
}

// Kept for callers and tests that need one URL-set document.
export function buildSitemap(paths) {
  const base = SITE.url.replace(/\/+$/, "");
  return sitemapUrlset(normalizePaths(paths), base);
}

/**
 * Build a Google-compatible sitemap bundle.
 * Up to 50,000 URLs remain in /sitemap.xml as a normal urlset.
 * Larger URL sets become numbered child sitemaps and /sitemap.xml becomes an index.
 */
export function buildSitemapBundle(paths, { maxUrls = MAX_URLS_PER_SITEMAP } = {}) {
  if (!Number.isInteger(maxUrls) || maxUrls < 1 || maxUrls > MAX_URLS_PER_SITEMAP) {
    throw new TypeError("حجم خريطة الموقع يجب أن يكون بين 1 و50000 رابط.");
  }

  const base = SITE.url.replace(/\/+$/, "");
  const normalized = normalizePaths(paths);
  if (normalized.length <= maxUrls) {
    return {
      index: sitemapUrlset(normalized, base),
      files: [],
      urlCount: normalized.length,
    };
  }

  const files = [];
  for (let offset = 0; offset < normalized.length; offset += maxUrls) {
    const number = String(files.length + 1).padStart(4, "0");
    const relativePath = `/sitemaps/sitemap-${number}.xml`;
    const chunk = normalized.slice(offset, offset + maxUrls);
    files.push({
      path: relativePath,
      content: sitemapUrlset(chunk, base),
      urlCount: chunk.length,
    });
  }

  return {
    index: sitemapIndex(files, base),
    files,
    urlCount: normalized.length,
  };
}
