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
