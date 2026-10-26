// تصنيف عنصر OSM إلى فئة وفئة فرعية بالاعتماد على data/categories.json

function tagMatchesQuery(tags, query) {
  const [key, value] = query.split("=");
  if (!(key in tags)) return false;
  if (value === "*") return true;
  return tags[key] === value;
}

export function classifyElement(tags, categories) {
  if (!tags) return null;
  for (const category of categories) {
    const hit = category.osmQueries.some((q) => tagMatchesQuery(tags, q));
    if (!hit) continue;
    const sub = classifySubcategory(tags, category);
    return { categorySlug: category.slug, subcategorySlug: sub };
  }
  return null;
}

function classifySubcategory(tags, category) {
  for (const sub of category.subcategories || []) {
    for (const [tagKey, values] of Object.entries(sub.match)) {
      const tagVal = tags[tagKey];
      if (!tagVal) continue;
      const parts = String(tagVal).split(";").map((s) => s.trim());
      if (parts.some((p) => values.includes(p))) return sub.slug;
    }
  }
  return null;
}

export function placeName(tags, fallbackAr) {
  return tags["name:ar"] || tags.name || fallbackAr;
}
