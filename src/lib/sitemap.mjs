import { SITE } from "./config.mjs";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSitemap(paths) {
  const base = SITE.url.replace(/\/+$/, "");
  const newline = String.fromCharCode(10);
  const urls = paths
    .filter((path) => typeof path === "string" && path.startsWith("/") && !path.startsWith("//"))
    .map((path) => "  <url><loc>" + escapeXml(base + path) + "</loc></url>")
    .join(newline);
  return '<?xml version="1.0" encoding="UTF-8"?>' + newline +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + newline +
    urls + newline + "</urlset>" + newline;
}
