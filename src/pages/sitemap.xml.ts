import locationsData from '../data/locations.json';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export async function GET({ site }) {
  const baseUrl = (site?.origin ?? 'https://saudi-guide.ibms2000.workers.dev').replace(/\/$/, '');
  const paths = ['/', ...locationsData.map((item) => `/${item.category}/${item.slug}`)];
  const uniquePaths = [...new Set(paths)];
  const urls = uniquePaths.map((path) => `  <url><loc>${escapeXml(new URL(path, baseUrl).toString())}</loc><changefreq>weekly</changefreq><priority>${path === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
