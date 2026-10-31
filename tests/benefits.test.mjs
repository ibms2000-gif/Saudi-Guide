import test from "node:test";
import assert from "node:assert/strict";
import {
  benefitsIndexPage,
  benefitDetailPage,
} from "../src/lib/benefits.mjs";

const benefit = {
  slug: "citizen-account",
  nameAr: "حساب المواطن",
  categoryAr: "الدعم الحكومي",
  summaryAr: "شرح البرنامج وخطوات التقديم.",
  introAr: "برنامج دعم للأسر المستحقة.",
  keyPoints: ["يخضع الاستحقاق لمراجعة الجهة المختصة."],
  steps: ["الدخول إلى البوابة الرسمية."],
  timingTitleAr: "موعد الإيداع",
  timingAr: "يخضع الموعد للإعلان الرسمي للدفعة.",
  cautions: ["لا تشارك بياناتك الشخصية مع طرف غير رسمي."],
  serviceName: "بوابة حساب المواطن",
  serviceUrl: "https://portal.ca.gov.sa/",
  verifiedAt: "2026-10-31",
  sources: [{
    name: "بوابة البرنامج",
    url: "https://portal.ca.gov.sa/",
    role: "المصدر الرسمي"
  }]
};

test("benefits index links to program details internally", () => {
  const html = benefitsIndexPage([benefit]);
  assert.match(html, /الدعم الحكومي والمنافع في السعودية/);
  assert.match(html, /href="\/benefits\/citizen-account\//);
  assert.match(html, /حساب المواطن/);
});

test("benefit detail page includes steps, timing, sources and verification date", () => {
  const html = benefitDetailPage(benefit);
  assert.match(html, /الشروط وخطوات التقديم/);
  assert.match(html, /الدخول إلى البوابة الرسمية/);
  assert.match(html, /موعد الإيداع/);
  assert.match(html, /2026-10-31/);
  assert.match(html, /portal\.ca\.gov\.sa/);
});

test("benefit page escapes text and rejects unsafe service URLs", () => {
  const html = benefitDetailPage({
    ...benefit,
    nameAr: '<script>alert("x")</script>',
    serviceUrl: "javascript:alert(1)",
    sources: [{ name: "مصدر غير آمن", url: "javascript:alert(1)" }]
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test("invalid benefit slugs cannot create arbitrary paths", () => {
  assert.throws(
    () => benefitDetailPage({ ...benefit, slug: "../admin" }),
    /غير صالح/
  );
});
