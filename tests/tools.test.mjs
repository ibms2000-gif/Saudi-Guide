import test from "node:test";
import assert from "node:assert/strict";
import { calculateTool } from "../src/lib/tool-calculations.mjs";

function values(result) {
  return result.map((item) => item.value);
}

test("ضريبة القيمة المضافة: إضافة الضريبة إلى مبلغ غير شامل", () => {
  const result = calculateTool("vat-calculator", {
    amount: "1000", rate: "15", mode: "exclusive"
  });
  assert.deepEqual(values(result), [1000, 150, 1150]);
});

test("ضريبة القيمة المضافة: استخراج الضريبة من مبلغ شامل", () => {
  const result = calculateTool("vat-calculator", {
    amount: "1150", rate: "15", mode: "inclusive"
  });
  assert.ok(Math.abs(result[0].value - 1000) < 1e-9);
  assert.ok(Math.abs(result[1].value - 150) < 1e-9);
  assert.equal(result[2].value, 1150);
});

test("حاسبة الخصم تحسب قيمة الخصم والسعر النهائي", () => {
  assert.deepEqual(values(calculateTool("discount-calculator", {
    amount: "250", rate: "20"
  })), [50, 200]);
});

test("حاسبة القسط تدعم التمويل دون فائدة", () => {
  assert.deepEqual(values(calculateTool("installment-calculator", {
    amount: "12000", down: "2000", rate: "0", months: "10"
  })), [1000, 10000, 0]);
});

test("حاسبة تكلفة الوقود تحسب اللترات والتكلفة", () => {
  const result = calculateTool("fuel-cost-calculator", {
    distance: "300", efficiency: "8", rate: "2.18"
  });
  assert.equal(result[0].value, 24);
  assert.ok(Math.abs(result[1].value - 52.32) < 1e-9);
});

test("حاسبة العمر تحسب السنوات والأشهر والأيام", () => {
  const result = calculateTool("age-calculator", {
    birth: "2000-01-15", target: "2026-11-24"
  });
  assert.equal(result[0].value, "26 سنة و10 شهر و9 يوم");
  const expectedDays = (Date.UTC(2026, 10, 24) - Date.UTC(2000, 0, 15)) / 86400000;
  assert.equal(result[1].value, expectedDays);
});

test("حاسبة الفرق بين تاريخين تحسب الأيام والأسابيع", () => {
  const result = calculateTool("date-difference", {
    start: "2026-01-01", end: "2026-01-08"
  });
  assert.deepEqual(values(result), [7, 1, 7 / 30.4375]);
});

test("حاسبة النسبة المئوية تحسب نسبة الجزء من الإجمالي", () => {
  assert.deepEqual(values(calculateTool("percentage-calculator", {
    part: "25", total: "200"
  })), [12.5]);
});

test("حاسبة الالتزامات تحسب النسبة والمتبقي", () => {
  const result = calculateTool("debt-ratio-calculator", {
    income: "10000", obligations: "3000"
  });
  assert.deepEqual(values(result), [30, 7000]);
});

test("تُرفض القيم غير الصحيحة والتواريخ غير الموجودة", () => {
  assert.throws(() => calculateTool("vat-calculator", {
    amount: "100", rate: "101", mode: "exclusive"
  }));
  assert.throws(() => calculateTool("percentage-calculator", {
    part: "2", total: "0"
  }));
  assert.throws(() => calculateTool("date-difference", {
    start: "2026-02-31", end: "2026-03-01"
  }));
  assert.throws(() => calculateTool("installment-calculator", {
    amount: "1000", down: "1000", rate: "5", months: "12"
  }));
  assert.throws(() => calculateTool("debt-ratio-calculator", {
    income: "0", obligations: "100"
  }));
});

test("يدعم التاريخ الافتراضي الممرر من بيئة الاختبار", () => {
  const result = calculateTool("date-difference", {
    start: "2026-11-20", end: ""
  }, { today: "2026-11-24" });
  assert.equal(result[0].value, 4);
});

test("إضافة الأيام تتعامل مع نهاية الشهر والسنة الكبيسة", () => {
  const result = calculateTool("date-addition", { date: "2024-02-28", days: "2", operation: "add" });
  assert.equal(result[0].value, "2024-03-01");
  const subtract = calculateTool("date-addition", { date: "2026-01-01", days: "1", operation: "subtract" });
  assert.equal(subtract[0].value, "2025-12-31");
});

test("حاسبة مساحة الغرفة تحول السنتيمتر إلى متر", () => {
  const result = calculateTool("room-area-calculator", { length: "500", width: "400", unit: "cm" });
  assert.equal(result[0].value, 20);
  assert.ok(Math.abs(result[1].value - 215.278208334) < 1e-8);
});

test("حاسبة البلاط تقدر البلاطات والكراتين مع التقريب للأعلى", () => {
  const result = calculateTool("tile-calculator", { roomLength: "5", roomWidth: "4", tileLength: "60", tileWidth: "60", tilesPerBox: "4", waste: "10" });
  assert.equal(result[0].value, 20);
  assert.equal(result[1].value, 62);
  assert.equal(result[2].value, 16);
});

test("حاسبة الدهان تخصم مساحة الأبواب والنوافذ", () => {
  const result = calculateTool("paint-calculator", { width: "5", height: "3", openings: "2", coats: "2", coverage: "10" });
  assert.equal(result[0].value, 13);
  assert.equal(result[2].value, 2.6);
});

test("حاسبة الكهرباء تستخدم التعرفة التي يدخلها المستخدم", () => {
  const result = calculateTool("electricity-cost-calculator", { consumption: "1000", rate: "0.18" });
  assert.equal(result[1].value, 180);
});

test("حاسبة الجهاز تحسب الاستهلاك اليومي والشهري والتكلفة", () => {
  const result = calculateTool("appliance-energy-calculator", { power: "1500", hours: "5", days: "30", rate: "0.18" });
  assert.equal(result[0].value, 7.5);
  assert.equal(result[1].value, 225);
  assert.equal(result[2].value, 40.5);
});

test("حاسبة الادخار تقسم الهدف المتبقي على الأشهر", () => {
  const result = calculateTool("savings-planner", { target: "20000", saved: "5000", months: "12" });
  assert.equal(result[0].value, 15000);
  assert.equal(result[1].value, 1250);
  const reached = calculateTool("savings-planner", { target: "1000", saved: "1200", months: "6" });
  assert.equal(reached[1].value, 0);
});

test("مقارنة سعر الوحدة تحدد المنتج الأقل تكلفة", () => {
  const result = calculateTool("unit-price-comparison", { priceA: "12", quantityA: "750", priceB: "15", quantityB: "1000" });
  assert.equal(result[0].value, 0.016);
  assert.equal(result[1].value, 0.015);
  assert.equal(result[2].value, "المنتج الثاني");
  assert.ok(Math.abs(result[4].value - 6.25) < 1e-9);
});

test("تُرفض مدخلات الأدوات الجديدة غير المنطقية", () => {
  assert.throws(() => calculateTool("date-addition", { date: "2026-01-01", days: "1.5", operation: "add" }));
  assert.throws(() => calculateTool("room-area-calculator", { length: "5", width: "4", unit: "inch" }));
  assert.throws(() => calculateTool("tile-calculator", { roomLength: "5", roomWidth: "4", tileLength: "0", tileWidth: "60", tilesPerBox: "4", waste: "10" }));
  assert.throws(() => calculateTool("paint-calculator", { width: "5", height: "3", openings: "15", coats: "2", coverage: "10" }));
  assert.throws(() => calculateTool("appliance-energy-calculator", { power: "1000", hours: "25", days: "30", rate: "0.18" }));
  assert.throws(() => calculateTool("savings-planner", { target: "1000", saved: "-1", months: "12" }));
  assert.throws(() => calculateTool("unit-price-comparison", { priceA: "10", quantityA: "0", priceB: "12", quantityB: "2" }));
});
