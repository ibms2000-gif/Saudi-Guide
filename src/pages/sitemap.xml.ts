import locationsData from '../data/locations.json';

export async function GET({ site }) {
  const baseUrl = site ? site.origin : 'https://yourdomain.com';

  const urls = locationsData.map((item) => {
    return `<url>
      <loc>${baseUrl}/${item.category}/${item.slug}</loc>
      <changefreq>daily</changefreq>
      <priority>0.8</priority>
    </url>`;
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join('')}
  </urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
