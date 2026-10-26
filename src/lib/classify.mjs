// تصنيف عنصر OSM إلى فئة وفئة فرعية بالاعتماد على data/categories.json

function tagMatchesQuery(tags, query) {
  const [key, value] = query.split("=");
  if (!(key in tags)) return false;
  if (value === "*") return true;
  return tags[key] === value;
}

export function classifyElement(tags, categories) {
  if (!tags) return null;

  // Match specific tags first; broad rules such as shop=* are fallback-only.
  // This prevents car repair, laundry and similar services being swallowed by shopping.
  const matched = [];
  for (const category of categories) {
    const queries = category.osmQueries || [];
    const exactHit = queries.some((q) => !q.endsWith("=*") && tagMatchesQuery(tags, q));
    const wildcardHit = queries.some((q) => q.endsWith("=*") && tagMatchesQuery(tags, q));
    if (exactHit) matched.push({ category, priority: 0 });
    else if (wildcardHit) matched.push({ category, priority: 1 });
  }
  matched.sort((a, b) => a.priority - b.priority);
  const selected = matched[0]?.category;
  if (!selected) return null;
  const sub = classifySubcategory(tags, selected);
  return { categorySlug: selected.slug, subcategorySlug: sub };
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
