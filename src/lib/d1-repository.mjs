// Queries for the optional Cloudflare D1 place repository.
// The SQL uses the composite unique index on (city_slug, osm_type, osm_id).
export const FIND_PLACE_BY_OSM_ID_SQL = `
  SELECT
    p.place_id AS id,
    p.osm_type AS osmType,
    p.osm_id AS osmId,
    p.name AS name,
    p.category_slug AS categorySlug,
    p.subcategory_slug AS subcategorySlug,
    p.latitude AS lat,
    p.longitude AS lon,
    p.address AS address,
    p.phone AS phone,
    p.website AS website,
    p.opening_hours AS openingHours,
    c.fetched_at AS fetchedAt
  FROM places AS p
  LEFT JOIN cities AS c ON c.slug = p.city_slug
  WHERE p.city_slug = ?1 AND p.osm_type = ?2 AND p.osm_id = ?3
  LIMIT 1
`;

export async function findPlaceByOsmId(db, citySlug, osmType, osmId) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("D1 binding is missing or invalid.");
  }
  if (!/^[a-z0-9-]+$/.test(String(citySlug || ""))) {
    throw new TypeError("City slug is invalid.");
  }
  if (!["node", "way", "relation"].includes(osmType)) {
    throw new TypeError("OSM element type is invalid.");
  }
  const normalizedId = String(osmId ?? "");
  if (!/^\d+$/.test(normalizedId)) {
    throw new TypeError("OSM element ID is invalid.");
  }

  const statement = db.prepare(FIND_PLACE_BY_OSM_ID_SQL).bind(citySlug, osmType, normalizedId);
  const row = await statement.first();
  if (!row) return null;

  return {
    place: {
      id: row.id,
      osmType: row.osmType,
      osmId: String(row.osmId),
      name: row.name,
      categorySlug: row.categorySlug,
      subcategorySlug: row.subcategorySlug,
      lat: Number(row.lat),
      lon: Number(row.lon),
      address: row.address || null,
      phone: row.phone || null,
      website: row.website || null,
      openingHours: row.openingHours || null,
    },
    fetchedAt: row.fetchedAt || null,
  };
}
