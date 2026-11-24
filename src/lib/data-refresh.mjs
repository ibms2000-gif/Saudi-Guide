// Select a bounded set of cities that still need their first usable place snapshot.
export function selectBootstrapBatch(cities, completedSlugs, batchSize = 5) {
  const limit = Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 10
    ? batchSize
    : 5;
  const pending = cities.filter((city) => !completedSlugs.has(city.slug));
  const selected = pending.slice(0, limit);

  return {
    cities: selected,
    skipped: cities.length - pending.length,
    remaining: pending.length - selected.length,
  };
}

// Select a bounded refresh batch, prioritising failed, missing, then oldest snapshots.
export function selectRefreshBatch(cities, cityMeta = {}, batchSize = 5) {
  const limit = Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 10
    ? batchSize
    : 5;

  const ordered = cities
    .map((city, index) => {
      const snapshot = cityMeta?.[city.slug] || {};
      const fetchedAt = Date.parse(snapshot.fetchedAt || "");
      return {
        city,
        index,
        stale: snapshot.stale === true,
        fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : Number.NEGATIVE_INFINITY,
      };
    })
    .sort((a, b) => {
      if (a.stale !== b.stale) return a.stale ? -1 : 1;
      if (a.fetchedAt !== b.fetchedAt) return a.fetchedAt - b.fetchedAt;
      return a.index - b.index;
    });

  const selected = ordered.slice(0, limit).map((item) => item.city);
  return {
    cities: selected,
    remaining: Math.max(0, cities.length - selected.length),
  };
}
