import fs from "node:fs/promises";
import path from "node:path";
import { slugify } from "./util.mjs";

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

  const events = await readOptionalJSON(path.join(root, "data/events.json"), []);
  const salarySchedules = await loadSalarySchedules(path.join(root, "data/paydays"));
  const benefits = await readOptionalJSON(path.join(root, "data/benefits.json"), []);
  const statistics = await readOptionalJSON(path.join(root, "data/statistics.json"), []);
  const news = await readOptionalJSON(path.join(root, "data/news.json"), []);
  return buildModel({ regions, cities, categories, placesByCity, meta, events, salarySchedules, benefits, statistics, news });
}

async function readOptionalJSON(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function loadSalarySchedules(directory) {
  let files = [];
  try {
    files = await fs.readdir(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const schedules = [];
  for (const file of files.filter((name) => /^\d{4}\.json$/.test(name)).sort()) {
    const data = await readOptionalJSON(path.join(directory, file), null);
    if (data && Number.isInteger(data.year)) schedules.push(data);
  }
  return schedules.sort((a, b) => a.year - b.year);
}

export const MIN_NEIGHBOURHOOD_PLACES = 8;
export const MIN_NEIGHBOURHOOD_CATEGORIES = 2;

function neighbourhoodKey(value) {
  return slugify(String(value || "")
    .normalize("NFKC")
    .replace(/[\\u064B-\\u065F\\u0670\\u0640]/g, "")
    .replace(/\\s+/g, " ")
    .toLocaleLowerCase("ar"));
}

function buildNeighbourhoods(places, city) {
  const groups = new Map();
  const cityKey = neighbourhoodKey(city.nameAr);
  for (const place of places) {
    if (typeof place?.neighbourhood !== "string") continue;
    const nameAr = place.neighbourhood.replace(/\\s+/g, " ").trim();
    const key = neighbourhoodKey(nameAr);
    if (!key || key === cityKey) continue;
    if (!groups.has(key)) groups.set(key, { slug: key, nameAr, places: [], categoryCounts: {} });
    const group = groups.get(key);
    group.places.push(place);
    const category = place.categorySlug || "other";
    group.categoryCounts[category] = (group.categoryCounts[category] || 0) + 1;
  }

  return [...groups.values()]
    .map((group) => {
      const categoryCount = Object.keys(group.categoryCounts).length;
      const totalPlaces = group.places.length;
      return {
        ...group,
        totalPlaces,
        categoryCount,
        indexable: totalPlaces >= MIN_NEIGHBOURHOOD_PLACES &&
          categoryCount >= MIN_NEIGHBOURHOOD_CATEGORIES,
      };
    })
    .sort((a, b) => b.totalPlaces - a.totalPlaces || a.nameAr.localeCompare(b.nameAr, "ar"));
}

export function buildModel({ regions, cities, categories, placesByCity, meta, events = [], salarySchedules = [], benefits = [], statistics = [], news = [] }) {
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const regionBySlug = Object.fromEntries(regions.map((r) => [r.slug, r]));

  const citiesEnriched = cities.map((city) => {
    const places = placesByCity[city.slug] || [];
    const byCategory = {};
    for (const cat of categories) {
      const catPlaces = places.filter((p) => p.categorySlug === cat.slug);
      const bySub = {};
      const indexable = catPlaces.length >= (cat.minForPage || 4);
      for (const sub of cat.subcategories || []) {
        const subPlaces = catPlaces.filter((p) => p.subcategorySlug === sub.slug);
        // A subcategory page is only generated when its parent category page exists.
        if (indexable && subPlaces.length >= 3) bySub[sub.slug] = subPlaces;
      }
      byCategory[cat.slug] = {
        all: catPlaces,
        indexable,
        subcategories: bySub,
      };
    }
    const neighbourhoods = buildNeighbourhoods(places, city);
    return {
      ...city,
      places,
      byCategory,
      neighbourhoods,
      totalNeighbourhoods: neighbourhoods.filter((item) => item.indexable).length,
      totalPlaces: places.length,
    };
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
      // National hubs may only link to city/category pages that the builder creates.
      .filter((c) => c.byCategory[cat.slug].indexable)
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
    events,
    salarySchedules,
    benefits,
    statistics,
    news,
  };
}
