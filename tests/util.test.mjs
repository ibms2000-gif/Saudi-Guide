import test from "node:test";
import assert from "node:assert/strict";
import { slugify, escapeHtml, distanceMeters } from "../src/lib/util.mjs";

test("slugify لاتيني بسيط", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});

test("slugify يحافظ على المسافات كشرطات ويزيل الرموز", () => {
  assert.equal(slugify("way/123 - My Café!"), "way-123-my-café");
});

test("escapeHtml يهرب الرموز الخطرة", () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
});

test("escapeHtml يتعامل مع null/undefined", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("distanceMeters يحسب مسافة صفر لنفس النقطة", () => {
  assert.equal(distanceMeters(24.7, 46.6, 24.7, 46.6), 0);
});

test("distanceMeters يحسب مسافة موجبة بين نقطتين مختلفتين", () => {
  const d = distanceMeters(24.7136, 46.6753, 21.4858, 39.1925);
  assert.ok(d > 700000 && d < 900000); // الرياض-جدة تقريبًا 850كم
});
