import test from "node:test";
import assert from "node:assert/strict";
import { classifyElement, placeName, extractNeighbourhood } from "../src/lib/classify.mjs";

const categories = [
  {
    slug: "restaurants",
    osmQueries: ["amenity=restaurant", "amenity=cafe"],
    subcategories: [{ slug: "coffee", nameAr: "قهوة", match: { amenity: ["cafe"] } }],
  },
  {
    slug: "services",
    osmQueries: ["shop=car_repair", "shop=laundry", "shop=hairdresser"],
    subcategories: [
      { slug: "workshops", nameAr: "ورش سيارات", match: { shop: ["car_repair"] } },
      { slug: "laundry", nameAr: "مغاسل", match: { shop: ["laundry"] } },
    ],
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


test("يقدّم نوع الخدمة المحدد على قاعدة shop=* العامة", () => {
  const repair = classifyElement({ shop: "car_repair" }, categories);
  assert.deepEqual(repair, { categorySlug: "services", subcategorySlug: "workshops" });
  const laundry = classifyElement({ shop: "laundry" }, categories);
  assert.deepEqual(laundry, { categorySlug: "services", subcategorySlug: "laundry" });
});


test("يستخرج اسم الحي من وسوم العنوان الصريحة بأولوية الحي ثم الضاحية", () => {
  assert.deepEqual(
    extractNeighbourhood({ "addr:neighbourhood": "حي النرجس", "addr:suburb": "شمال الرياض" }, "الرياض"),
    { name: "حي النرجس", sourceTag: "addr:neighbourhood" },
  );
  assert.deepEqual(
    extractNeighbourhood({ "addr:suburb": "الروضة" }, "الرياض"),
    { name: "الروضة", sourceTag: "addr:suburb" },
  );
});

test("يتجاهل اسم المدينة والقيم العامة ولا يخمّن الحي من الشارع", () => {
  assert.equal(extractNeighbourhood({ "addr:suburb": "الرياض" }, "الرياض"), null);
  assert.equal(extractNeighbourhood({ "addr:neighbourhood": "unknown" }, "الرياض"), null);
  assert.equal(extractNeighbourhood({ "addr:street": "شارع الملك فهد" }, "الرياض"), null);
});
