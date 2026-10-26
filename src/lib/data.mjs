import fs from "node:fs/promises";
import path from "node:path";

export async function loadModel(root) {
  const regions = JSON.parse(await fs.readFile(path.join(root, "data/regions.json"), "utf8"));
  const cities = JSON.parse(await fs.readFile(path.join(root, "data/cities.json"), "utf8"));
  const categories = JSON.parse(await fs.readFile(path.join(root, "data/categories.json"), "utf8"));

  let meta = null;
  try {
    meta = JSON.parse(await fs.readFile(path.join(root, "data/places/_meta.json"), "utf8"));
  } catch {
    meta = null;
  }

  const placesByCity = {};
  for (const city of cities) {
    try {
      placesByCity[city.slug] = JSON.parse(
        await fs.readFile(path.join(root, "data/places", `${city.slug}.json`), "utf8"),
      );
    } catch {
      placesByCity[city.slug] = [];
    }
  }

  return buildModel({ regions, cities, categories, placesByCity, meta });
}

export function buildModel({ regions, cities, categories, placesByCity, meta }) {
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const regionBySlug = Object.fromEntries(regions.map((r) => [r.slug, r]));

  const citiesEnriched = cities.map((city) => {
    const places = placesByCity[city.slug] || [];
    const byCategory = {};
    for (const cat of categories) {
      const catPlaces = places.filter((p) => p.categorySlug === cat.slug);
      const bySub = {};
      for (const sub of cat.subcategories || []) {
        const subPlaces = catPlaces.filter((p) => p.subcategorySlug === sub.slug);
        if (subPlaces.length >= 3) bySub[sub.slug] = subPlaces;
      }
      byCategory[cat.slug] = {
        all: catPlaces,
        indexable: catPlaces.length >= (cat.minForPage || 4),
        subcategories: bySub,
      };
    }
    return { ...city, places, byCategory, totalPlaces: places.length };
  });

  const citiesBySlug = Object.fromEntries(citiesEnriched.map((c) => [c.slug, c]));

  const citiesByRegion = {};
  for (const city of citiesEnriched) {
    (citiesByRegion[city.regionSlug] ||= []).push(city);
  }

  // محاور وطنية لكل فئة: المدن التي بها عناصر مصنّفة
  const nationalByCategory = {};
  for (const cat of categories) {
    const list = citiesEnriched
      .filter((c) => c.byCategory[cat.slug].all.length > 0)
      .sort((a, b) => b.byCategory[cat.slug].all.length - a.byCategory[cat.slug].all.length);
    nationalByCategory[cat.slug] = list;
  }

  return {
    regions,
    regionBySlug,
    categories,
    categoryBySlug,
    cities: citiesEnriched,
    citiesBySlug,
    citiesByRegion,
    nationalByCategory,
    meta,
  };
}
