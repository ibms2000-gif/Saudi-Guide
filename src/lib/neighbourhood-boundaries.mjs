const PLACE_TYPES = new Set(["neighbourhood", "quarter", "suburb"]);
const TYPE_PRIORITY = { neighbourhood: 0, quarter: 1, suburb: 2 };
const COORDINATE_EPSILON = 1e-7;

function validPoint(point) {
  return Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 &&
    Math.abs(point[1]) <= 90;
}

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) <= COORDINATE_EPSILON &&
    Math.abs(a[1] - b[1]) <= COORDINATE_EPSILON;
}

function isClosedRing(ring) {
  return Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(validPoint) &&
    samePoint(ring[0], ring[ring.length - 1]);
}

function cleanGeometry(geometry) {
  if (!Array.isArray(geometry)) return [];
  return geometry
    .map((point) => [Number(point.lon), Number(point.lat)])
    .filter(validPoint);
}

function closeRing(ring) {
  if (ring.length < 3) return null;
  const closed = ring.map((point) => [...point]);
  if (samePoint(closed[0], closed[closed.length - 1])) {
    closed[closed.length - 1] = [...closed[0]];
  } else {
    closed.push([...closed[0]]);
  }
  return isClosedRing(closed) ? closed : null;
}

function stitchSegments(segments) {
  const pending = segments
    .map((segment) => segment.map((point) => [...point]))
    .filter((segment) => segment.length >= 2);
  const rings = [];

  while (pending.length) {
    let current = pending.shift();
    let guard = pending.length + 2;

    while (!isClosedRing(current) && guard-- > 0) {
      const first = current[0];
      const last = current[current.length - 1];
      let joined = false;

      for (let index = 0; index < pending.length; index += 1) {
        const candidate = pending[index];
        const candidateFirst = candidate[0];
        const candidateLast = candidate[candidate.length - 1];

        if (samePoint(last, candidateFirst)) {
          current = current.concat(candidate.slice(1));
        } else if (samePoint(last, candidateLast)) {
          current = current.concat(candidate.slice(0, -1).reverse());
        } else if (samePoint(first, candidateLast)) {
          current = candidate.slice(0, -1).concat(current);
        } else if (samePoint(first, candidateFirst)) {
          current = candidate.slice(1).reverse().concat(current);
        } else {
          continue;
        }

        pending.splice(index, 1);
        joined = true;
        break;
      }

      if (!joined) break;
    }

    const ring = closeRing(current);
    if (ring) rings.push(ring);
  }

  return rings;
}

function polygonArea(ring) {
  let twiceArea = 0;
  let meanLatitude = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    twiceArea += x1 * y2 - x2 * y1;
    meanLatitude += y1;
  }
  const latitudeFactor = Math.cos((meanLatitude / Math.max(1, ring.length - 1)) * Math.PI / 180);
  return Math.abs(twiceArea * latitudeFactor);
}

function pointOnSegment(point, start, end) {
  const cross = (point[1] - start[1]) * (end[0] - start[0]) -
    (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > COORDINATE_EPSILON) return false;
  return point[0] >= Math.min(start[0], end[0]) - COORDINATE_EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + COORDINATE_EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - COORDINATE_EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + COORDINATE_EPSILON;
}

function pointInRing(point, ring) {
  if (!validPoint(point) || !isClosedRing(ring)) return false;
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const start = ring[previous];
    const end = ring[index];
    if (pointOnSegment(point, start, end)) return true;

    const intersects = ((end[1] > point[1]) !== (start[1] > point[1])) &&
      (point[0] < ((start[0] - end[0]) * (point[1] - end[1])) /
        (start[1] - end[1]) + end[0]);
    if (intersects) inside = !inside;
  }

  return inside;
}

export function boundaryContainsPoint(boundary, lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const point = [lon, lat];
  const polygons = Array.isArray(boundary?.polygons) ? boundary.polygons : [];

  return polygons.some((polygon) => {
    if (!pointInRing(point, polygon.outer)) return false;
    const holes = Array.isArray(polygon.inners) ? polygon.inners : [];
    return !holes.some((hole) => pointInRing(point, hole));
  });
}

export function elementToNeighbourhoodBoundary(element) {
  if (!element || !["way", "relation"].includes(element.type) || !Number.isSafeInteger(element.id)) {
    return null;
  }

  const tags = element.tags || {};
  const placeType = tags.place;
  if (!PLACE_TYPES.has(placeType)) return null;
  if (element.type === "relation" && tags.boundary !== "place") return null;

  const nameAr = String(tags["name:ar"] || tags.name || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!nameAr || nameAr.length > 120) return null;

  let polygons = [];
  if (element.type === "way") {
    const ring = closeRing(cleanGeometry(element.geometry));
    if (!ring) return null;
    polygons = [{ outer: ring, inners: [] }];
  } else {
    const outerSegments = [];
    const innerSegments = [];
    for (const member of element.members || []) {
      if (member?.type !== "way" || !Array.isArray(member.geometry)) continue;
      const segment = cleanGeometry(member.geometry);
      if (segment.length < 2) continue;
      if (member.role === "inner") innerSegments.push(segment);
      else if (member.role === "outer" || member.role === "") outerSegments.push(segment);
    }

    const outers = stitchSegments(outerSegments);
    const inners = stitchSegments(innerSegments);
    if (!outers.length) return null;
    polygons = outers.map((outer) => ({
      outer,
      inners: inners.filter((inner) => pointInRing(inner[0], outer)),
    }));
  }

  if (!polygons.length) return null;
  const area = polygons.reduce((sum, polygon) => sum + polygonArea(polygon.outer), 0);
  if (!Number.isFinite(area) || area <= 0) return null;

  return {
    id: element.type + "/" + element.id,
    osmType: element.type,
    osmId: element.id,
    nameAr,
    placeType,
    sourceTag: tags.boundary === "place" ? "boundary=place" : "place=" + placeType + " (area)",
    polygons,
    area,
  };
}

export function assignNeighbourhoodsToPlaces(places = [], boundaries = []) {
  const validBoundaries = (Array.isArray(boundaries) ? boundaries : [])
    .filter((boundary) =>
      boundary &&
      typeof boundary.nameAr === "string" &&
      PLACE_TYPES.has(boundary.placeType) &&
      Array.isArray(boundary.polygons) &&
      boundary.polygons.length > 0,
    )
    .sort((a, b) =>
      (TYPE_PRIORITY[a.placeType] - TYPE_PRIORITY[b.placeType]) ||
      ((Number(a.area) || Number.POSITIVE_INFINITY) - (Number(b.area) || Number.POSITIVE_INFINITY)) ||
      String(a.id).localeCompare(String(b.id)),
    );

  return (Array.isArray(places) ? places : []).map((place) => {
    if (
      typeof place?.neighbourhood === "string" &&
      place.neighbourhood.trim()
    ) {
      return place;
    }

    const match = validBoundaries.find((boundary) =>
      boundaryContainsPoint(boundary, place?.lat, place?.lon),
    );
    if (!match) return place;

    return {
      ...place,
      neighbourhood: match.nameAr,
      neighbourhoodSourceTag: match.sourceTag,
      neighbourhoodBoundaryId: match.id,
      neighbourhoodType: match.placeType,
    };
  });
}
