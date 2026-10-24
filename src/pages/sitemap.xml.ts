import cities from '../data/cities.json';
import services from '../data/service-types.json';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export async function GET({ site }) {
  const baseUrl = (site?.origin ?? 'https://saudi-guide.ibms2000.workers.dev').replace(/\/$/, '');
  const paths = [
    '/',
    ...cities.map((city) => `/city/${city.slug}/`),
    ...services.map((service) => `/services/${service.slug}/`),
    ...cities.flatMap((city) => services.map((service) => `/directory/${city.slug}/${service.slug}/`))
  ];
  const uniquePaths = [...new Set(paths)];
  const urls = uniquePaths.map((path) => {
    const priority = path === '/' ? '1.0' : path.split('/').filter(Boolean).length === 2 ? '0.8' : '0.7';
    return `  <url><loc>${escapeXml(new URL(path, baseUrl).toString())}</loc><changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
