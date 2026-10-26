import { SITE } from "./config.mjs";

export function buildSitemap(paths) {
  const urls = paths
    .map((p) => `  <url><loc>${SITE.url}${p}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
