import test from "node:test";
import assert from "node:assert/strict";
import { classifyElement, placeName } from "../src/lib/classify.mjs";

const categories = [
  {
    slug: "restaurants",
    osmQueries: ["amenity=restaurant", "amenity=cafe"],
    subcategories: [{ slug: "coffee", nameAr: "قهوة", match: { amenity: ["cafe"] } }],
  },
  {
    slug: "shopping",
    osmQueries: ["shop=*"],
    subcategories: [
      { slug: "supermarkets", nameAr: "بقالة", match: { shop: ["supermarket", "convenience"] } },
    ],
  },
];

test("يصنّف مطعمًا إلى فئة المطاعم بدون فئة فرعية", () => {
  const res = classifyElement({ amenity: "restaurant", name: "مطعم تجربة" }, categories);
  assert.deepEqual(res, { categorySlug: "restaurants", subcategorySlug: null });
});

test("يصنّف مقهى إلى فئة المطاعم والفئة الفرعية قهوة", () => {
  const res = classifyElement({ amenity: "cafe" }, categories);
  assert.deepEqual(res, { categorySlug: "restaurants", subcategorySlug: "coffee" });
});

test("shop=* يطابق أي قيمة shop ويصنّف الفئة الفرعية حسب القيمة", () => {
  const res = classifyElement({ shop: "supermarket" }, categories);
  assert.deepEqual(res, { categorySlug: "shopping", subcategorySlug: "supermarkets" });
});

test("عنصر بدون وسوم مطابقة يُرجع null", () => {
  const res = classifyElement({ highway: "residential" }, categories);
  assert.equal(res, null);
});

test("placeName يفضّل name:ar ثم name ثم القيمة الاحتياطية", () => {
  assert.equal(placeName({ "name:ar": "اسم عربي", name: "English" }, "fallback"), "اسم عربي");
  assert.equal(placeName({ name: "English" }, "fallback"), "English");
  assert.equal(placeName({}, "fallback"), "fallback");
});
