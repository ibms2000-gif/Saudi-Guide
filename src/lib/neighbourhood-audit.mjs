function sourceTagCounts(places = []) {
  const counts = {};
  for (const place of places) {
    const tag = typeof place?.neighbourhoodSourceTag === "string"
      ? place.neighbourhoodSourceTag.trim()
      : "";
    if (tag) counts[tag] = (counts[tag] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function summariseNeighbourhoodCoverage(
  cities,
  meta = null,
  thresholds = { minimumPlaces: 8, minimumCategories: 2 },
) {
  const cityReports = (Array.isArray(cities) ? cities : []).map((city) => {
    const places = Array.isArray(city?.places) ? city.places : [];
    const taggedPlaces = places.filter((place) =>
      typeof place?.neighbourhood === "string" && place.neighbourhood.trim(),
    );
    const groups = Array.isArray(city?.neighbourhoods) ? city.neighbourhoods : [];
    const neighbourhoods = groups.map((group) => ({
      nameAr: group.nameAr,
      totalPlaces: Number(group.totalPlaces) || 0,
      categoryCount: Number(group.categoryCount) || 0,
      indexable: group.indexable === true,
      sourceTagCounts: sourceTagCounts(group.places),
    }));
    const metadata = meta?.cities?.[city.slug] || {};

    return {
      slug: city.slug,
      nameAr: city.nameAr,
      totalPlaces: places.length,
      taggedPlaces: taggedPlaces.length,
      coveragePercent: places.length
        ? Math.round((taggedPlaces.length / places.length) * 1000) / 10
        : 0,
      distinctNeighbourhoods: neighbourhoods.length,
      indexableNeighbourhoods: neighbourhoods.filter((item) => item.indexable).length,
      sourceTagCounts: sourceTagCounts(taggedPlaces),
      fetchedAt: metadata.fetchedAt || null,
      stale: typeof metadata.stale === "boolean" ? metadata.stale : null,
      neighbourhoods,
    };
  });

  return {
    thresholds: {
      minimumPlaces: thresholds.minimumPlaces,
      minimumCategories: thresholds.minimumCategories,
    },
    summary: {
      cityCount: cityReports.length,
      citiesWithTaggedPlaces: cityReports.filter((city) => city.taggedPlaces > 0).length,
      citiesWithoutTaggedPlaces: cityReports.filter((city) => city.taggedPlaces === 0).length,
      totalPlaces: cityReports.reduce((sum, city) => sum + city.totalPlaces, 0),
      taggedPlaces: cityReports.reduce((sum, city) => sum + city.taggedPlaces, 0),
      distinctNeighbourhoods: cityReports.reduce((sum, city) => sum + city.distinctNeighbourhoods, 0),
      indexableNeighbourhoods: cityReports.reduce((sum, city) => sum + city.indexableNeighbourhoods, 0),
    },
    cities: cityReports,
  };
}
