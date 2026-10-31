import test from "node:test";
import assert from "node:assert/strict";
import {
  countPlaceDetails,
  isPlacePageIndexable,
  placePath,
  renderPlacePage,
} from "../src/lib/place-page.mjs";

const city = { slug: "riyadh", nameAr: "الرياض" };
const category = { slug: "restaurants", nameAr: "مطاعم ومقاهي" };
const completePlace = {
  name: "مطعم الاختبار",
  categorySlug: "restaurants",
  osmType: "node",
  osmId: 12345,
  lat: 24.7,
  lon: 46.6,
  address: "شارع الملك فهد",
  phone: "+966 50 123 4567",
  website: "https://example.com",
  openingHours: "Mo-Su 10:00-23:00",
};

test("counts optional details without treating empty strings as data", () => {
  assert.equal(countPlaceDetails(completePlace), 4);
  assert.equal(countPlaceDetails({ address: " ", phone: null, website: undefined }), 0);
});

test("requires a valid identity, coordinates and at least two supporting details for indexing", () => {
  assert.equal(isPlacePageIndexable(completePlace), true);
  assert.equal(isPlacePageIndexable({ ...completePlace, phone: null, website: null, openingHours: null }), false);
  assert.equal(isPlacePageIndexable({ ...completePlace, lat: 999 }), false);
  assert.equal(isPlacePageIndexable({ ...completePlace, osmType: "unknown" }), false);
});

test("creates stable internal place URLs from OSM identity", () => {
  assert.equal(placePath("riyadh", completePlace), "/place/riyadh/node/12345/");
  assert.equal(placePath("../riyadh", completePlace), null);
  assert.equal(placePath("riyadh", { ...completePlace, osmId: "12/34" }), null);
});

test("renders a crawlable internal detail page with map, contact details and source credit", () => {
  const html = renderPlacePage({
    place: completePlace,
    city,
    category,
    siteUrl: "https://saudi-guide.example",
    fetchedAt: "2026-10-30T12:00:00.000Z",
  });

  assert.match(html, /<meta name="robots" content="index, follow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/saudi-guide\.example\/place\/riyadh\/node\/12345\/">/);
  assert.match(html, /شارع الملك فهد/);
  assert.match(html, /tel:\+966501234567/);
  assert.match(html, /openstreetmap\.org\/export\/embed\.html/);
  assert.match(html, /OpenStreetMap/);
  assert.match(html, /application\/ld\+json/);
});

test("keeps sparse place detail pages available but noindex", () => {
  const html = renderPlacePage({
    place: { ...completePlace, address: null, phone: null, website: null, openingHours: null },
    city,
    category,
    siteUrl: "https://saudi-guide.example",
  });
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
});

test("escapes untrusted place names and ignores unsafe website schemes", () => {
  const html = renderPlacePage({
    place: {
      ...completePlace,
      name: '<img src=x onerror="alert(1)">',
      website: "javascript:alert(1)",
    },
    city,
    category,
    siteUrl: "https://saudi-guide.example",
  });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(html, /href="javascript:/);
});
