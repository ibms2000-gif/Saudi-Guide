import test from "node:test";
import assert from "node:assert/strict";
import { slugify, escapeHtml, distanceMeters, safeHttpUrl, safeTelephone } from "../src/lib/util.mjs";

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


test("safeHttpUrl يقبل HTTP(S) ويرفض البروتوكولات غير الآمنة وبيانات الدخول", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,hello"), null);
  assert.equal(safeHttpUrl("https://user:pass@example.com"), null);
  assert.equal(safeHttpUrl("https://example.com/path?q=1"), "https://example.com/path?q=1");
  assert.equal(safeHttpUrl("not a URL"), null);
});

test("safeTelephone ينتج URI رقميًا فقط ويرفض النص غير الرقمي", () => {
  assert.equal(safeTelephone("+966 50 123 4567"), "+966501234567");
  assert.equal(safeTelephone("javascript:alert(1)"), null);
  assert.equal(safeTelephone("12x456"), null);
});
