import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemap, buildSitemapBundle } from "../src/lib/sitemap.mjs";

function countUrls(xml) {
  return (xml.match(/<url>/g) || []).length;
}

test("keeps ordinary sitemap output as one urlset under the 50,000 URL threshold", () => {
  const bundle = buildSitemapBundle(["/", "/city/riyadh/", "/city/riyadh/"]);
  assert.equal(bundle.urlCount, 2);
  assert.equal(bundle.files.length, 0);
  assert.match(bundle.index, /<urlset /);
  assert.equal(countUrls(bundle.index), 2);
  assert.doesNotMatch(bundle.index, /sitemapindex/);
});

test("splits more than 50,000 URLs into child sitemaps and a sitemap index", () => {
  const paths = Array.from({ length: 50001 }, (_, index) => `/place/riyadh/node/${index + 1}/`);
  const bundle = buildSitemapBundle(paths);

  assert.equal(bundle.urlCount, 50001);
  assert.equal(bundle.files.length, 2);
  assert.match(bundle.index, /<sitemapindex /);
  assert.match(bundle.index, /\/sitemaps\/sitemap-0001\.xml/);
  assert.match(bundle.index, /\/sitemaps\/sitemap-0002\.xml/);
  assert.equal(countUrls(bundle.files[0].content), 50000);
  assert.equal(countUrls(bundle.files[1].content), 1);
  assert.deepEqual(bundle.files.map((file) => file.urlCount), [50000, 1]);
});

test("filters invalid paths and deduplicates canonical paths", () => {
  const bundle = buildSitemapBundle([
    "/",
    "/",
    "https://example.com/",
    "//example.com/path",
    "",
    null,
    "/city/jeddah/",
  ]);
  assert.equal(bundle.urlCount, 2);
  assert.equal(countUrls(bundle.index), 2);
});

test("rejects a child sitemap chunk size above the protocol limit", () => {
  assert.throws(() => buildSitemapBundle(["/"], { maxUrls: 50001 }), /50000/);
  assert.throws(() => buildSitemapBundle(["/"], { maxUrls: 0 }), /50000/);
});

test("buildSitemap remains backward compatible", () => {
  const xml = buildSitemap(["/"]);
  assert.match(xml, /<urlset /);
  assert.equal(countUrls(xml), 1);
});
