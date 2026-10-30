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
