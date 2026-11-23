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

test("مكافأة نهاية الخدمة تحسب نصف شهر لأول خمس سنوات وشهرًا بعدها", () => {
  const result = calculateTool("end-of-service-calculator", {
    wage: "8000", startDate: "2020-01-01", endDate: "2026-01-01", reason: "normal"
  });
  assert.equal(result[0].value, "6 سنة و0 شهر و0 يوم");
  assert.equal(result[1].value, 28000);
  assert.equal(result[3].value, 28000);
});

test("مكافأة نهاية الخدمة تطبق نسب الاستقالة النظامية", () => {
  const result = calculateTool("end-of-service-calculator", {
    wage: "6000", startDate: "2021-01-01", endDate: "2025-01-01", reason: "resignation"
  });
  assert.equal(result[1].value, 12000);
  assert.ok(Math.abs(result[2].value - 100 / 3) < 1e-10);
  assert.equal(result[3].value, 4000);
  const underTwoYears = calculateTool("end-of-service-calculator", {
    wage: "6000", startDate: "2024-01-01", endDate: "2025-12-31", reason: "resignation"
  });
  assert.equal(underTwoYears[3].value, 0);
});

test("مكافأة نهاية الخدمة تحتسب أجزاء السنة بالتناسب", () => {
  const result = calculateTool("end-of-service-calculator", {
    wage: "6000", startDate: "2024-01-01", endDate: "2025-07-01", reason: "normal"
  });
  assert.equal(result[0].value, "1 سنة و6 شهر و0 يوم");
  assert.equal(result[3].value, 4500);
});

test("العمل الإضافي يجمع أجر الساعة الفعلي مع نصف أجر الساعة الأساسي", () => {
  const result = calculateTool("overtime-calculator", {
    actualWage: "6000", basicWage: "4000", hours: "3"
  });
  assert.equal(result[0].value, 25);
  assert.ok(Math.abs(result[1].value - 16.6666666667 * 0.5) < 1e-9);
  assert.ok(Math.abs(result[3].value - 100) < 1e-9);
});

test("الإجازة السنوية تتدرج من 21 إلى 30 يومًا بعد خمس سنوات", () => {
  const result = calculateTool("annual-leave-calculator", {
    startDate: "2020-01-01", asOfDate: "2026-01-01", usedDays: "110", wage: "6000"
  });
  assert.equal(result[1].value, 135);
  assert.equal(result[2].value, 25);
  assert.equal(result[3].value, 5000);
});

test("الإجازة المرضية توزع الأجر على شرائح 30 و60 و30 يومًا", () => {
  const result = calculateTool("sick-leave-calculator", {
    wage: "6000", days: "100"
  });
  assert.equal(result[0].value, 30);
  assert.equal(result[1].value, 60);
  assert.equal(result[2].value, 10);
  assert.equal(result[3].value, 15000);
});

test("استقطاع التأمينات يميز بين النظام الجديد والسابق وغير السعودي", () => {
  const current = calculateTool("gosi-deduction-calculator", {
    insuredWage: "8000", scheme: "new"
  });
  assert.equal(current[1].value, 10.75);
  assert.equal(current[2].value, 860);
  const legacy = calculateTool("gosi-deduction-calculator", {
    insuredWage: "8000", scheme: "legacy"
  });
  assert.equal(legacy[2].value, 780);
  const nonSaudi = calculateTool("gosi-deduction-calculator", {
    insuredWage: "8000", scheme: "non-saudi"
  });
  assert.equal(nonSaudi[2].value, 0);
});

test("حاسبة زيادة الراتب تعرض الراتب الجديد والزيادة السنوية", () => {
  const result = calculateTool("salary-increase-calculator", {
    salary: "10000", rate: "5"
  });
  assert.equal(result[0].value, 500);
  assert.equal(result[1].value, 10500);
  assert.equal(result[2].value, 6000);
});

test("تحويل الراتب الشهري إلى يومي وساعي يستخدم قسمة 30 ثم 8", () => {
  const result = calculateTool("wage-hour-converter", { monthlyWage: "6000" });
  assert.equal(result[0].value, 200);
  assert.equal(result[1].value, 25);
});

test("تعويض مهلة الإشعار يحسب الأيام غير المنفذة بحسب الطرف", () => {
  const result = calculateTool("notice-compensation-calculator", {
    monthlyWage: "6000", party: "employer", servedDays: "20"
  });
  assert.equal(result[0].value, 60);
  assert.equal(result[1].value, 40);
  assert.equal(result[2].value, 8000);
});

test("ترفض حاسبات العمل والرواتب المدخلات المخالفة للحدود", () => {
  assert.throws(() => calculateTool("end-of-service-calculator", {
    wage: "5000", startDate: "2025-01-01", endDate: "2024-01-01", reason: "normal"
  }));
  assert.throws(() => calculateTool("overtime-calculator", {
    actualWage: "4000", basicWage: "5000", hours: "2"
  }));
  assert.throws(() => calculateTool("annual-leave-calculator", {
    startDate: "2020-01-01", asOfDate: "2021-01-01", usedDays: "22", wage: "5000"
  }));
  assert.throws(() => calculateTool("sick-leave-calculator", { wage: "5000", days: "121" }));
  assert.throws(() => calculateTool("gosi-deduction-calculator", { insuredWage: "50000", scheme: "new" }));
  assert.throws(() => calculateTool("salary-increase-calculator", { salary: "0", rate: "5" }));
  assert.throws(() => calculateTool("wage-hour-converter", { monthlyWage: "-1" }));
  assert.throws(() => calculateTool("notice-compensation-calculator", {
    monthlyWage: "5000", party: "other", servedDays: "0"
  }));
});
