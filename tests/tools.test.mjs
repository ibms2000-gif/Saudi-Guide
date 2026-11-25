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


test("ضريبة التصرفات العقارية تحسب النسبة العامة 5%", () => {
  const result = calculateTool("real-estate-transfer-tax-calculator", { value: "1000000" });
  assert.equal(result[2].value, 50000);
  assert.equal(result[3].value, 1050000);
});

test("زكاة النقود تشترط بلوغ النصاب واكتمال الحول", () => {
  const due = calculateTool("cash-zakat-calculator", { amount: "25000", nisab: "20000", haul: "yes" });
  assert.equal(due[3].value, 625);
  const noHaul = calculateTool("cash-zakat-calculator", { amount: "25000", nisab: "20000", haul: "no" });
  assert.equal(noHaul[3].value, 0);
  const belowNisab = calculateTool("cash-zakat-calculator", { amount: "15000", nisab: "20000", haul: "yes" });
  assert.equal(belowNisab[3].value, 0);
});

test("زكاة عروض التجارة تضم البضاعة بسعرها الحالي والنقد والديون المرجوة", () => {
  const result = calculateTool("trade-zakat-calculator", {
    inventory: "100000", cash: "20000", receivables: "30000", nisab: "20000", haul: "yes"
  });
  assert.equal(result[0].value, 150000);
  assert.equal(result[2].value, 3750);
});

test("زكاة الذهب تحول العيار إلى وزن خالص وتتحقق من النصاب", () => {
  const result = calculateTool("gold-zakat-calculator", {
    weight: "100", karat: "21", price24: "300", haul: "yes"
  });
  assert.equal(result[0].value, 87.5);
  assert.equal(result[1].value, 26250);
  assert.equal(result[3].value, 656.25);
});

test("حاسبة الضمان تحتسب زيادة التابعين وتطبق سقف الحد الأساسي", () => {
  const result = calculateTool("social-security-income-calculator", {
    earned: "3000", unearned: "200", basicThreshold: "1320",
    dependents: "2", dependentIncrease: "660"
  });
  assert.equal(result[2].value, 1700);
  assert.equal(result[4].value, 1320);
  assert.equal(result[5].value, 2640);
  assert.equal(result[6].value, 940);

  const capped = calculateTool("social-security-income-calculator", {
    earned: "0", unearned: "0", basicThreshold: "1320",
    dependents: "10", dependentIncrease: "660"
  });
  assert.equal(capped[5].value, 2640);
});

test("حاسبة ساما تطبق شرائح الدخل وحد الاستقطاع من الراتب", () => {
  const result = calculateTool("sama-affordability-calculator", {
    income: "18000", salary: "15000", payroll: "4000", nonMortgage: "8000",
    total: "10000", retired: "no", supportedHousing: "no"
  });
  assert.ok(Math.abs(result[0].value - 5000) < 1e-8);
  assert.equal(result[1].value, 1000);
  assert.equal(result[2].value, 8100);
  assert.equal(result[4].value, 11700);
  assert.equal(result[5].value, 1700);
  const highIncome = calculateTool("sama-affordability-calculator", {
    income: "25000", salary: "20000", payroll: "0", nonMortgage: "0",
    total: "0", retired: "yes", supportedHousing: "no"
  });
  assert.equal(highIncome[2].kind, "text");
  assert.equal(highIncome[4].kind, "text");
  assert.equal(highIncome[0].value, 5000);
});

test("مبلغ التمويل من القسط يدعم المعدل الصفري والمعدل السنوي", () => {
  const zeroRate = calculateTool("finance-amount-from-payment-calculator", {
    payment: "1000", rate: "0", years: "2"
  });
  assert.equal(zeroRate[0].value, 24000);
  assert.equal(zeroRate[1].value, 24000);
  const interest = calculateTool("finance-amount-from-payment-calculator", {
    payment: "1000", rate: "12", years: "1"
  });
  assert.ok(interest[0].value < 12000);
  assert.ok(interest[2].value > 0);
});

test("تكاليف شراء العقار تجمع الدفعة والضريبة والعمولة والرسوم", () => {
  const result = calculateTool("real-estate-purchase-cost-calculator", {
    price: "1000000", downRate: "20", brokerRate: "2.5", otherFees: "5000"
  });
  assert.equal(result[0].value, 200000);
  assert.equal(result[1].value, 50000);
  assert.equal(result[2].value, 25000);
  assert.equal(result[3].value, 800000);
  assert.equal(result[4].value, 280000);
});

test("ترفض حاسبات الخدمات الحكومية والتمويلية المدخلات غير المنطقية", () => {
  assert.throws(() => calculateTool("real-estate-transfer-tax-calculator", { value: "0" }));
  assert.throws(() => calculateTool("cash-zakat-calculator", { amount: "1000", nisab: "0", haul: "yes" }));
  assert.throws(() => calculateTool("trade-zakat-calculator", { inventory: "-1", cash: "0", receivables: "0", nisab: "100", haul: "yes" }));
  assert.throws(() => calculateTool("gold-zakat-calculator", { weight: "10", karat: "20", price24: "300", haul: "yes" }));
  assert.throws(() => calculateTool("social-security-income-calculator", { earned: "1000", unearned: "0", threshold: "0" }));
  assert.throws(() => calculateTool("sama-affordability-calculator", {
    income: "0", salary: "10000", payroll: "0", nonMortgage: "0", total: "0"
  }));
  assert.throws(() => calculateTool("finance-amount-from-payment-calculator", { payment: "0", rate: "5", years: "20" }));
  assert.throws(() => calculateTool("real-estate-purchase-cost-calculator", { price: "100000", downRate: "101", brokerRate: "2.5", otherFees: "0" }));
});


test("حاسبة ساند تطبق 60% لأول ثلاثة أشهر و50% بعدها مع الحدود العليا", () => {
  const first = calculateTool("saned-compensation-calculator", {
    averageWage: "8000", month: "1", minimumFloor: "0"
  });
  assert.equal(first[2].value, 4800);
  assert.equal(first[3].value, 9000);
  assert.equal(first[5].value, 4800);

  const later = calculateTool("saned-compensation-calculator", {
    averageWage: "8000", month: "5", minimumFloor: "0"
  });
  assert.equal(later[1].value, 50);
  assert.equal(later[2].value, 4000);
  assert.equal(later[3].value, 7500);

  const floor = calculateTool("saned-compensation-calculator", {
    averageWage: "5000", month: "7", minimumFloor: "6000"
  });
  assert.equal(floor[5].value, 5000);
});

test("حاسبة إعانة البحث عن عمل تحسب الدفعة التالية والمتبقي", () => {
  const result = calculateTool("job-search-subsidy-planner", { paidMonths: "5" });
  assert.equal(result[1].value, 9500);
  assert.equal(result[2].value, 1500);
  assert.equal(result[3].value, 10);
  assert.equal(result[4].value, 10750);

  const completed = calculateTool("job-search-subsidy-planner", { paidMonths: "15" });
  assert.equal(completed[2].value, 0);
  assert.equal(completed[3].value, 0);
  assert.equal(completed[4].value, 0);
});

test("حاسبة معاش النظام الجديد تطبق معادلة 2.25% وسقف 100%", () => {
  const result = calculateTool("new-retirement-pension-calculator", {
    averageWage: "10000", months: "360"
  });
  assert.equal(result[2].value, 67.5);
  assert.equal(result[3].value, 6750);

  const capped = calculateTool("new-retirement-pension-calculator", {
    averageWage: "10000", months: "600"
  });
  assert.equal(capped[3].value, 10000);
  assert.equal(capped[2].value, 100);
});

test("حاسبة منفعة الأمومة تضرب متوسط الأجر في ثلاثة أو أربعة أشهر", () => {
  const normal = calculateTool("maternity-benefit-calculator", {
    averageWage: "8500", extraMonth: "no"
  });
  assert.equal(normal[1].value, 3);
  assert.equal(normal[2].value, 25500);

  const extended = calculateTool("maternity-benefit-calculator", {
    averageWage: "8500", extraMonth: "yes"
  });
  assert.equal(extended[1].value, 4);
  assert.equal(extended[2].value, 34000);
});

test("حاسبة تخطيط حساب المواطن لا تستنتج الدعم وتستخدم مبلغ الحاسبة الرسمية", () => {
  const result = calculateTool("citizen-account-budget-calculator", {
    monthlySupport: "1000", monthlyExpenses: "5000"
  });
  assert.equal(result[1].value, 12000);
  assert.equal(result[2].value, 20);
  assert.equal(result[3].value, 4000);
});

test("ترفض حاسبات الدعم والتقاعد والأمومة المدخلات خارج النطاق", () => {
  assert.throws(() => calculateTool("social-security-income-calculator", {
    earned: "1000", unearned: "0", basicThreshold: "1320",
    dependents: "1.5", dependentIncrease: "660"
  }));
  assert.throws(() => calculateTool("saned-compensation-calculator", {
    averageWage: "50000", month: "1", minimumFloor: "0"
  }));
  assert.throws(() => calculateTool("job-search-subsidy-planner", { paidMonths: "16" }));
  assert.throws(() => calculateTool("new-retirement-pension-calculator", {
    averageWage: "10000", months: "0"
  }));
  assert.throws(() => calculateTool("maternity-benefit-calculator", {
    averageWage: "0", extraMonth: "no"
  }));
  assert.throws(() => calculateTool("citizen-account-budget-calculator", {
    monthlySupport: "-1", monthlyExpenses: "5000"
  }));
});


test("محول الميلادي إلى الهجري يستخدم تقويم أم القرى", () => {
  const result = calculateTool("gregorian-to-hijri", { date: "2026-11-25" });
  assert.equal(result[1].value, 1448);
  assert.equal(result[2].value, 6);
  assert.equal(result[3].value, 15);
});

test("محول الهجري إلى الميلادي يعيد التاريخ المطابق في أم القرى", () => {
  const result = calculateTool("hijri-to-gregorian", {
    hijriDay: "15", hijriMonth: "6", hijriYear: "1448"
  });
  assert.equal(result[0].value, "2026-11-25");
});

test("محول الطول يحول الكيلومتر إلى متر", () => {
  const result = calculateTool("length-converter", { value: "2", from: "km", to: "m" });
  assert.equal(result[0].value, 2000);
});

test("محول الوزن يحول الكيلوجرام إلى جرام", () => {
  const result = calculateTool("weight-converter", { value: "1.5", from: "kg", to: "g" });
  assert.equal(result[0].value, 1500);
});

test("المعدل التراكمي يجمع نقاط الساعات السابقة والفصل الجديد", () => {
  const result = calculateTool("cumulative-gpa-calculator", {
    currentGpa: "3.2", completedHours: "60", semesterGpa: "3.8",
    semesterHours: "15", scale: "4"
  });
  assert.equal(result[0].value, 3.32);
  assert.equal(result[1].value, 75);
});

test("النسبة الموزونة تستخدم الأوزان التي أدخلها المستخدم", () => {
  const result = calculateTool("weighted-admission-calculator", {
    secondary: "90", secondaryWeight: "30",
    aptitude: "85", aptitudeWeight: "40",
    achievement: "80", achievementWeight: "30"
  });
  assert.equal(result[0].value, 85);
});

test("عداد الكلمات يحسب الكلمات والأسطر والحروف", () => {
  const result = calculateTool("word-counter", { text: "مرحبا بالعالم\nهذا اختبار!" });
  assert.equal(result[0].value, 4);
  assert.equal(result[3].value, 1);
  assert.equal(result[4].value, 2);
});

test("مدة الوقت تخصم الاستراحة وتدعم نهاية الدوام بعد منتصف الليل", () => {
  const day = calculateTool("time-duration-calculator", {
    startTime: "08:00", endTime: "16:30", breakMinutes: "30"
  });
  assert.equal(day[1].value, "8 ساعة و0 دقيقة");
  assert.equal(day[2].value, 8);

  const overnight = calculateTool("time-duration-calculator", {
    startTime: "22:00", endTime: "06:00", breakMinutes: "0"
  });
  assert.equal(overnight[2].value, 8);
});

test("حاسبة البناء تجمع المسطحات والتكلفة والاحتياطي", () => {
  const result = calculateTool("construction-cost-estimator", {
    floorArea: "200", floors: "2", costPerMeter: "1500", contingency: "10"
  });
  assert.deepEqual(values(result), [400, 600000, 60000, 660000]);
});

test("حاسبة مؤشر كتلة الجسم تصنف البالغين", () => {
  const result = calculateTool("adult-bmi-calculator", { weight: "70", height: "175" });
  assert.ok(Math.abs(result[0].value - 22.8571428571) < 1e-8);
  assert.equal(result[1].value, "ضمن النطاق المرجعي للبالغين");
});

test("حاسبة السعرات تستخدم معادلة ميفلين ومعامل النشاط", () => {
  const result = calculateTool("daily-calorie-estimator", {
    sex: "male", age: "30", weight: "70", height: "170", activity: "1.2"
  });
  assert.equal(result[0].value, 1617.5);
  assert.equal(result[1].value, 1941);
});

test("ترفض الأدوات الجديدة مدخلات غير منطقية أو أوزانًا لا تساوي 100%", () => {
  assert.throws(() => calculateTool("hijri-to-gregorian", {
    hijriDay: "31", hijriMonth: "6", hijriYear: "1448"
  }));
  assert.throws(() => calculateTool("length-converter", { value: "-2", from: "km", to: "m" }));
  assert.throws(() => calculateTool("cumulative-gpa-calculator", {
    currentGpa: "5.5", completedHours: "60", semesterGpa: "4", semesterHours: "15", scale: "5"
  }));
  assert.throws(() => calculateTool("weighted-admission-calculator", {
    secondary: "90", secondaryWeight: "30",
    aptitude: "85", aptitudeWeight: "30",
    achievement: "80", achievementWeight: "30"
  }));
  assert.throws(() => calculateTool("time-duration-calculator", {
    startTime: "08:00", endTime: "16:00", breakMinutes: "600"
  }));
  assert.throws(() => calculateTool("construction-cost-estimator", {
    floorArea: "200", floors: "0", costPerMeter: "1500", contingency: "10"
  }));
  assert.throws(() => calculateTool("daily-calorie-estimator", {
    sex: "male", age: "10", weight: "70", height: "170", activity: "1.2"
  }));
});
