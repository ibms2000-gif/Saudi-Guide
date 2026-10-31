import test from "node:test";
import assert from "node:assert/strict";
import {
  statisticsIndexPage,
  statisticDetailPage,
} from "../src/lib/statistics.mjs";
import {
  newsIndexPage,
  newsRegionPage,
  newsDetailPage,
} from "../src/lib/news.mjs";

const statistic = {
  slug: "unemployment-test",
  titleAr: "معدل البطالة التجريبي",
  categoryAr: "سوق العمل",
  value: "6.4%",
  unitAr: "من القوى العاملة",
  periodAr: "الربع الأول 2026",
  scopeAr: "السعوديون",
  summaryAr: "ملخص إحصائي.",
  explanationAr: "شرح المؤشر.",
  howToReadAr: "طريقة قراءة المؤشر.",
  sourceName: "الهيئة العامة للإحصاء",
  sourceUrl: "https://example.com/stats",
  datasetUrl: "https://example.com/dataset",
  verifiedAt: "2026-10-31",
};

const news = {
  slug: "riyadh-local-test",
  titleAr: "خبر محلي تجريبي",
  regionSlug: "riyadh",
  regionNameAr: "منطقة الرياض",
  categoryAr: "خدمات محلية",
  publishedAt: "2026-10-20",
  summaryAr: "ملخص تحريري أصلي للخبر.",
  localContextAr: "سياق محلي يشرح أثر الخبر.",
  sourceName: "وكالة الأنباء السعودية",
  sourceUrl: "https://example.com/article",
  verifiedAt: "2026-10-31",
  editorialNote: "هذا ملخص مستقل وليس إعادة نشر.",
};

test("statistics index links only to internal indicator pages", () => {
  const html = statisticsIndexPage([statistic]);
  assert.match(html, /إحصاءات ومؤشرات السعودية/);
  assert.match(html, /href="\/statistics\/unemployment-test\//);
  assert.match(html, /6\.4%/);
});

test("statistics detail page includes scope, period, method and source", () => {
  const html = statisticDetailPage(statistic);
  assert.match(html, /6\.4%/);
  assert.match(html, /الربع الأول 2026/);
  assert.match(html, /السعوديون/);
  assert.match(html, /طريقة قراءة المؤشر/);
  assert.match(html, /example\.com\/dataset/);
});

test("statistics page escapes unsafe titles and rejects unsafe source links", () => {
  const html = statisticDetailPage({
    ...statistic,
    titleAr: '<script>alert("x")</script>',
    sourceUrl: "javascript:alert(1)",
    datasetUrl: "javascript:alert(2)",
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test("regional news list and detail pages retain internal paths and original context", () => {
  const index = newsIndexPage([news]);
  assert.match(index, /أخبار المناطق السعودية/);
  assert.match(index, /href="\/news\/riyadh-local-test\//);

  const region = newsRegionPage(
    { slug: "riyadh", nameAr: "منطقة الرياض" },
    [news],
  );
  assert.match(region, /أخبار منطقة الرياض/);

  const detail = newsDetailPage(news);
  assert.match(detail, /ملخص تحريري أصلي للخبر/);
  assert.match(detail, /سياق محلي يشرح أثر الخبر/);
  assert.match(detail, /example\.com\/article/);
  assert.match(detail, /هذا ملخص مستقل وليس إعادة نشر/);
});

test("news pages escape untrusted titles and reject unsafe external sources", () => {
  const html = newsDetailPage({
    ...news,
    titleAr: '<img src=x onerror="alert(1)">',
    sourceUrl: "javascript:alert(1)",
  });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test("invalid news and statistic slugs cannot create arbitrary routes", () => {
  assert.throws(() => statisticDetailPage({ ...statistic, slug: "../admin" }), /غير صالح/);
  assert.throws(() => newsDetailPage({ ...news, slug: "../admin" }), /غير صالح/);
});
