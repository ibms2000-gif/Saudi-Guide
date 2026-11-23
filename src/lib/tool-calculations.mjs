const DAY_MS = 24 * 60 * 60 * 1000;

function readNumber(values, key, label) {
  const value = Number(values[key]);
  if (!Number.isFinite(value)) throw new Error("أدخل قيمة رقمية صحيحة في حقل " + label + ".");
  return value;
}

function parseDate(value, label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) throw new Error("أدخل تاريخًا صحيحًا في حقل " + label + ".");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("التاريخ المدخل في حقل " + label + " غير موجود في التقويم.");
  }
  return { date, year, month, day };
}


function addCalendarMonths(start, months) {
  const total = start.year * 12 + (start.month - 1) + months;
  const year = Math.floor(total / 12);
  const monthIndex = total % 12;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(start.day, lastDay);
  return new Date(Date.UTC(year, monthIndex, day));
}

function serviceDuration(start, end) {
  let wholeMonths = (end.year - start.year) * 12 + (end.month - start.month);
  let cursor = addCalendarMonths(start, wholeMonths);
  if (cursor > end.date) {
    wholeMonths -= 1;
    cursor = addCalendarMonths(start, wholeMonths);
  }
  const nextMonth = addCalendarMonths(start, wholeMonths + 1);
  const remainingDays = (end.date - cursor) / DAY_MS;
  const partialMonthDays = (nextMonth - cursor) / DAY_MS;
  const totalYears = (wholeMonths + remainingDays / partialMonthDays) / 12;
  return {
    years: Math.floor(wholeMonths / 12),
    months: wholeMonths % 12,
    days: remainingDays,
    totalYears,
  };
}

function serviceYearsFromDates(startValue, endValue, today, endLabel = "تاريخ النهاية") {
  const start = parseDate(startValue, "تاريخ بداية الخدمة");
  const end = parseDate(endValue || today, endLabel);
  if (end.date < start.date) throw new Error("تاريخ نهاية الخدمة لا يمكن أن يسبق تاريخ البداية.");
  return serviceDuration(start, end);
}

function row(label, value, kind = "number", suffix = "") {
  return { label, value, kind, suffix };
}

function calendarAge(start, end) {
  let years = end.year - start.year;
  let months = end.month - start.month;
  let days = end.day - start.day;

  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(end.year, end.month - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

/** Calculate a tool result without touching the DOM. */
export function calculateTool(slug, values, options = {}) {
  const data = values || {};
  const today = options.today || (() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  })();

  let amount, rate, part, total, principal, monthlyRate, payment, months;
  switch (slug) {
    case "vat-calculator": {
      amount = readNumber(data, "amount", "المبلغ");
      rate = readNumber(data, "rate", "نسبة الضريبة");
      if (amount < 0 || rate < 0 || rate > 100) {
        throw new Error("أدخل مبلغًا غير سالب ونسبة ضريبة بين 0 و100.");
      }
      const fraction = rate / 100;
      let beforeTax;
      let tax;
      let includingTax;
      if (data.mode === "inclusive") {
        includingTax = amount;
        beforeTax = amount / (1 + fraction);
        tax = includingTax - beforeTax;
      } else if (!data.mode || data.mode === "exclusive") {
        beforeTax = amount;
        tax = amount * fraction;
        includingTax = beforeTax + tax;
      } else {
        throw new Error("اختر طريقة صحيحة لإدخال المبلغ.");
      }
      return [
        row("المبلغ قبل الضريبة", beforeTax, "money"),
        row("قيمة الضريبة", tax, "money"),
        row("الإجمالي شامل الضريبة", includingTax, "money"),
      ];
    }

    case "discount-calculator": {
      amount = readNumber(data, "amount", "السعر الأصلي");
      rate = readNumber(data, "rate", "نسبة الخصم");
      if (amount < 0 || rate < 0 || rate > 100) {
        throw new Error("تحقق من السعر ونسبة الخصم (من 0 إلى 100).");
      }
      const discount = amount * rate / 100;
      return [
        row("قيمة الخصم", discount, "money"),
        row("السعر بعد الخصم", amount - discount, "money"),
      ];
    }

    case "installment-calculator": {
      amount = readNumber(data, "amount", "مبلغ التمويل");
      const down = readNumber(data, "down", "الدفعة المقدمة");
      rate = readNumber(data, "rate", "معدل النسبة السنوي");
      months = readNumber(data, "months", "مدة السداد");
      if (
        amount <= 0 ||
        down < 0 ||
        down >= amount ||
        rate < 0 ||
        rate > 100 ||
        months < 1 ||
        months > 600 ||
        !Number.isInteger(months)
      ) {
        throw new Error("تحقق من مبلغ التمويل والدفعة والمعدل والمدة (من شهر إلى 600 شهر).");
      }
      principal = amount - down;
      monthlyRate = rate / 1200;
      payment = monthlyRate === 0
        ? principal / months
        : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
      const totalPayments = payment * months;
      return [
        row("القسط الشهري التقديري", payment, "money"),
        row("إجمالي الأقساط", totalPayments, "money"),
        row("تكلفة التمويل التقديرية فوق أصل المبلغ", totalPayments - principal, "money"),
      ];
    }

    case "fuel-cost-calculator": {
      const distance = readNumber(data, "distance", "مسافة الرحلة");
      const efficiency = readNumber(data, "efficiency", "استهلاك السيارة");
      rate = readNumber(data, "rate", "سعر اللتر");
      if (distance <= 0 || efficiency <= 0 || rate < 0) {
        throw new Error("أدخل مسافة واستهلاكًا أكبر من صفر وسعرًا غير سالب.");
      }
      const liters = distance * efficiency / 100;
      return [
        row("الوقود المطلوب", liters, "number", " لتر"),
        row("تكلفة الرحلة التقديرية", liters * rate, "money"),
      ];
    }

    case "age-calculator": {
      const birth = parseDate(data.birth, "تاريخ الميلاد");
      const target = parseDate(data.target || today, "تاريخ الحساب");
      if (target.date < birth.date) throw new Error("تاريخ الحساب لا يمكن أن يسبق تاريخ الميلاد.");
      const age = calendarAge(birth, target);
      return [
        row("العمر", age.years + " سنة و" + age.months + " شهر و" + age.days + " يوم", "text"),
        row("إجمالي الأيام", (target.date - birth.date) / DAY_MS, "number", " يوم"),
      ];
    }

    case "date-difference": {
      const start = parseDate(data.start, "تاريخ البداية");
      const end = parseDate(data.end || today, "تاريخ النهاية");
      if (end.date < start.date) throw new Error("تاريخ النهاية لا يمكن أن يسبق تاريخ البداية.");
      const days = (end.date - start.date) / DAY_MS;
      return [
        row("الفرق بالأيام", days, "number", " يوم"),
        row("بالأسابيع", days / 7, "number", " أسبوع"),
        row("بالشهور التقريبية", days / 30.4375, "number", " شهر"),
      ];
    }

    case "percentage-calculator": {
      part = readNumber(data, "part", "الجزء");
      total = readNumber(data, "total", "الإجمالي");
      if (total === 0) throw new Error("لا يمكن حساب النسبة عندما يكون الإجمالي صفرًا.");
      return [row("النسبة المئوية", part / total * 100, "percent")];
    }

    case "debt-ratio-calculator": {
      const income = readNumber(data, "income", "الدخل الشهري");
      const obligations = readNumber(data, "obligations", "الالتزامات الشهرية");
      if (income <= 0 || obligations < 0) {
        throw new Error("أدخل دخلًا أكبر من صفر والتزامات غير سالبة.");
      }
      return [
        row("نسبة الالتزامات", obligations / income * 100, "percent"),
        row("المتبقي بعد الالتزامات", income - obligations, "money"),
      ];
    }


    case "date-addition": {
      const start = parseDate(data.date || today, "تاريخ البداية");
      const days = readNumber(data, "days", "عدد الأيام");
      const operation = data.operation || "add";
      if (!Number.isInteger(days) || days < 0 || days > 365000) throw new Error("أدخل عدد أيام صحيحًا بين صفر و365000.");
      if (operation !== "add" && operation !== "subtract") throw new Error("اختر عملية إضافة أو طرح صحيحة.");
      const resultDate = new Date(start.date.getTime());
      resultDate.setUTCDate(resultDate.getUTCDate() + (operation === "add" ? days : -days));
      if (!Number.isFinite(resultDate.getTime())) throw new Error("التاريخ الناتج خارج النطاق المدعوم.");
      const isoDate = resultDate.toISOString().slice(0, 10);
      const weekday = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { weekday: "long", timeZone: "UTC" }).format(resultDate);
      return [row("التاريخ الناتج", isoDate, "text"), row("اليوم", weekday, "text")];
    }

    case "room-area-calculator": {
      const length = readNumber(data, "length", "الطول");
      const width = readNumber(data, "width", "العرض");
      const unit = data.unit || "m";
      if (length <= 0 || width <= 0 || length > 100000 || width > 100000) throw new Error("أدخل طولًا وعرضًا أكبر من صفر وضمن نطاق معقول.");
      if (unit !== "m" && unit !== "cm") throw new Error("اختر وحدة قياس صحيحة.");
      const factor = unit === "cm" ? 0.01 : 1;
      const area = length * factor * width * factor;
      return [row("مساحة الغرفة", area, "number", " م²"), row("المساحة بالقدم المربع", area * 10.7639104167, "number", " قدم²")];
    }

    case "tile-calculator": {
      const roomLength = readNumber(data, "roomLength", "طول الأرضية");
      const roomWidth = readNumber(data, "roomWidth", "عرض الأرضية");
      const tileLength = readNumber(data, "tileLength", "طول البلاطة");
      const tileWidth = readNumber(data, "tileWidth", "عرض البلاطة");
      const tilesPerBox = readNumber(data, "tilesPerBox", "عدد البلاطات في الكرتون");
      const waste = readNumber(data, "waste", "نسبة الهدر");
      if (roomLength <= 0 || roomWidth <= 0 || tileLength <= 0 || tileWidth <= 0 || !Number.isInteger(tilesPerBox) || tilesPerBox < 1 || tilesPerBox > 1000 || waste < 0 || waste > 30) {
        throw new Error("تحقق من أبعاد الأرضية والبلاطة وعدد البلاطات في الكرتون ونسبة الهدر (0–30%).");
      }
      const floorArea = roomLength * roomWidth;
      const tileArea = tileLength * tileWidth / 10000;
      const requiredTiles = Math.ceil(floorArea * (1 + waste / 100) / tileArea);
      const boxes = Math.ceil(requiredTiles / tilesPerBox);
      return [row("مساحة الأرضية", floorArea, "number", " م²"), row("عدد البلاطات المطلوب", requiredTiles, "number", " بلاطة"), row("عدد الكراتين المطلوب", boxes, "number", " كرتون"), row("المساحة التي تغطيها الكمية", requiredTiles * tileArea, "number", " م²")];
    }

    case "paint-calculator": {
      const width = readNumber(data, "width", "عرض الجدار");
      const height = readNumber(data, "height", "ارتفاع الجدار");
      const openings = readNumber(data, "openings", "مساحة الفتحات");
      const coats = readNumber(data, "coats", "عدد أوجه الدهان");
      const coverage = readNumber(data, "coverage", "معدل التغطية");
      const grossArea = width * height;
      if (width <= 0 || height <= 0 || openings < 0 || openings >= grossArea || !Number.isInteger(coats) || coats < 1 || coats > 10 || coverage <= 0 || coverage > 100) {
        throw new Error("تحقق من أبعاد الجدار ومساحة الفتحات وعدد الأوجه ومعدل تغطية اللتر.");
      }
      const netArea = grossArea - openings;
      const liters = netArea * coats / coverage;
      return [row("مساحة الجدار الصافية", netArea, "number", " م²"), row("إجمالي مساحة الدهان لكل الأوجه", netArea * coats, "number", " م²"), row("كمية الدهان التقديرية", liters, "number", " لتر")];
    }

    case "electricity-cost-calculator": {
      const consumption = readNumber(data, "consumption", "الاستهلاك الشهري");
      const rate = readNumber(data, "rate", "سعر الكيلوواط ساعة");
      if (consumption < 0 || rate < 0) throw new Error("أدخل استهلاكًا وسعرًا غير سالبين.");
      return [row("الاستهلاك الشهري", consumption, "number", " ك.و.س"), row("تكلفة الاستهلاك التقديرية", consumption * rate, "money")];
    }

    case "appliance-energy-calculator": {
      const power = readNumber(data, "power", "قدرة الجهاز");
      const hours = readNumber(data, "hours", "ساعات التشغيل");
      const days = readNumber(data, "days", "أيام التشغيل");
      const rate = readNumber(data, "rate", "سعر الكيلوواط ساعة");
      if (power <= 0 || hours < 0 || hours > 24 || !Number.isInteger(days) || days < 0 || days > 31 || rate < 0) {
        throw new Error("تحقق من قدرة الجهاز وساعات التشغيل (0–24) وأيام الاستخدام (0–31) والسعر.");
      }
      const dailyKwh = power / 1000 * hours;
      const monthlyKwh = dailyKwh * days;
      return [row("الاستهلاك اليومي", dailyKwh, "number", " ك.و.س"), row("الاستهلاك الشهري", monthlyKwh, "number", " ك.و.س"), row("تكلفة التشغيل الشهرية", monthlyKwh * rate, "money")];
    }

    case "savings-planner": {
      const target = readNumber(data, "target", "المبلغ المستهدف");
      const saved = readNumber(data, "saved", "المدخرات الحالية");
      const months = readNumber(data, "months", "المدة");
      if (target <= 0 || saved < 0 || !Number.isInteger(months) || months < 1 || months > 1200) {
        throw new Error("أدخل هدفًا أكبر من صفر ومدخرات غير سالبة ومدة صحيحة من شهر إلى 1200 شهر.");
      }
      const remaining = Math.max(0, target - saved);
      const monthly = remaining / months;
      return [row("المبلغ المتبقي للوصول إلى الهدف", remaining, "money"), row("الادخار الشهري المطلوب", monthly, "money"), row("الادخار الأسبوعي التقريبي", remaining / (months * 52 / 12), "money"), row("حالة الهدف", remaining === 0 ? "تم بلوغ الهدف أو تجاوزه" : "لم يكتمل الهدف بعد", "text")];
    }

    case "unit-price-comparison": {
      const priceA = readNumber(data, "priceA", "سعر المنتج الأول");
      const quantityA = readNumber(data, "quantityA", "كمية المنتج الأول");
      const priceB = readNumber(data, "priceB", "سعر المنتج الثاني");
      const quantityB = readNumber(data, "quantityB", "كمية المنتج الثاني");
      if (priceA < 0 || priceB < 0 || quantityA <= 0 || quantityB <= 0) throw new Error("أدخل أسعارًا غير سالبة وكميات أكبر من صفر.");
      const unitA = priceA / quantityA;
      const unitB = priceB / quantityB;
      const cheaper = unitA < unitB ? "المنتج الأول" : unitB < unitA ? "المنتج الثاني" : "السعر متساوٍ";
      const higher = Math.max(unitA, unitB);
      const lower = Math.min(unitA, unitB);
      const savingPercent = higher === 0 ? 0 : (higher - lower) / higher * 100;
      return [row("سعر وحدة المنتج الأول", unitA, "money"), row("سعر وحدة المنتج الثاني", unitB, "money"), row("الأقل تكلفة لكل وحدة", cheaper, "text"), row("فرق التكلفة لكل وحدة", higher - lower, "money"), row("التوفير مقارنة بالأعلى سعرًا", savingPercent, "percent")];
    }


    case "end-of-service-calculator": {
      const wage = readNumber(data, "wage", "الأجر الشهري الأخير");
      if (wage <= 0) throw new Error("أدخل أجرًا شهريًا أكبر من صفر.");
      const service = serviceYearsFromDates(data.startDate, data.endDate || today, today);
      const fullAward = wage * (
        0.5 * Math.min(service.totalYears, 5) +
        Math.max(service.totalYears - 5, 0)
      );
      const reason = data.reason || "normal";
      let factor = 1;
      let reasonLabel = "مكافأة كاملة وفق الأساس العام";
      if (reason === "resignation") {
        if (service.totalYears < 2) factor = 0;
        else if (service.totalYears <= 5) factor = 1 / 3;
        else if (service.totalYears < 10) factor = 2 / 3;
        reasonLabel = factor === 0 ? "لا تستحق مكافأة الاستقالة قبل إكمال سنتين وفق المادة 85" : "تطبيق شريحة الاستقالة وفق المادة 85";
      } else if (reason === "exception") {
        reasonLabel = "كامل المكافأة في الحالة الاستثنائية المحددة بالمادة 87";
      } else if (reason !== "normal") {
        throw new Error("اختر سبب انتهاء خدمة صحيحًا.");
      }
      return [
        row("مدة الخدمة", service.years + " سنة و" + service.months + " شهر و" + service.days + " يوم", "text"),
        row("المكافأة قبل تطبيق حكم الاستقالة", fullAward, "money"),
        row("نسبة الاستحقاق المطبقة", factor * 100, "percent"),
        row("المكافأة التقديرية", fullAward * factor, "money"),
        row("بيان طريقة الاستحقاق", reasonLabel, "text"),
      ];
    }

    case "overtime-calculator": {
      const actualWage = readNumber(data, "actualWage", "الأجر الفعلي");
      const basicWage = readNumber(data, "basicWage", "الأجر الأساسي");
      const hours = readNumber(data, "hours", "ساعات العمل الإضافية");
      if (actualWage <= 0 || basicWage <= 0 || basicWage > actualWage || hours < 0 || hours > 1000) {
        throw new Error("تحقق من الأجر الفعلي والأساسي (الأساسي لا يتجاوز الفعلي) وعدد الساعات بين صفر و1000.");
      }
      const actualHourly = actualWage / 30 / 8;
      const basicHourly = basicWage / 30 / 8;
      const overtimeHourly = actualHourly + basicHourly * 0.5;
      return [
        row("أجر الساعة من الأجر الفعلي", actualHourly, "money"),
        row("50% من أجر الساعة الأساسي", basicHourly * 0.5, "money"),
        row("أجر الساعة الإضافية", overtimeHourly, "money"),
        row("إجمالي أجر الساعات الإضافية", overtimeHourly * hours, "money"),
      ];
    }

    case "annual-leave-calculator": {
      const wage = readNumber(data, "wage", "الأجر الشهري");
      const usedDays = readNumber(data, "usedDays", "أيام الإجازة المستخدمة");
      if (wage <= 0 || usedDays < 0) throw new Error("أدخل أجرًا أكبر من صفر وأيام إجازة مستخدمة غير سالبة.");
      const service = serviceYearsFromDates(data.startDate, data.asOfDate || today, today, "تاريخ الحساب");
      const firstFiveYears = Math.min(service.totalYears, 5);
      const yearsAfterFive = Math.max(service.totalYears - 5, 0);
      const accrued = firstFiveYears * 21 + yearsAfterFive * 30;
      if (usedDays > accrued + 1e-9) throw new Error("أيام الإجازة المستخدمة تتجاوز الاستحقاق التقديري المحسوب.");
      const balance = Math.max(0, accrued - usedDays);
      return [
        row("مدة الخدمة المحسوبة", service.years + " سنة و" + service.months + " شهر و" + service.days + " يوم", "text"),
        row("أيام الإجازة المستحقة تقديريًا", accrued, "number", " يوم"),
        row("رصيد الإجازة المتبقي", balance, "number", " يوم"),
        row("قيمة الرصيد التقديرية عند نهاية الخدمة", balance * wage / 30, "money"),
      ];
    }

    case "sick-leave-calculator": {
      const wage = readNumber(data, "wage", "الأجر الشهري");
      const days = readNumber(data, "days", "أيام الإجازة المرضية");
      if (wage <= 0 || !Number.isInteger(days) || days < 0 || days > 120) {
        throw new Error("أدخل أجرًا شهريًا أكبر من صفر وعدد أيام صحيحًا من صفر إلى 120.");
      }
      const dailyWage = wage / 30;
      const fullDays = Math.min(days, 30);
      const threeQuarterDays = Math.min(Math.max(days - 30, 0), 60);
      const unpaidDays = Math.min(Math.max(days - 90, 0), 30);
      const fullPay = fullDays * dailyWage;
      const partialPay = threeQuarterDays * dailyWage * 0.75;
      return [
        row("أيام بأجر كامل", fullDays, "number", " يوم"),
        row("أيام بثلاثة أرباع الأجر", threeQuarterDays, "number", " يوم"),
        row("أيام دون أجر", unpaidDays, "number", " يوم"),
        row("الأجر المستحق خلال الإجازة", fullPay + partialPay, "money"),
      ];
    }

    case "gosi-deduction-calculator": {
      const insuredWage = readNumber(data, "insuredWage", "الأجر الخاضع للاشتراك");
      const scheme = data.scheme || "new";
      if (insuredWage <= 0 || insuredWage > 45000) {
        throw new Error("أدخل أجرًا خاضعًا للاشتراك أكبر من صفر ولا يتجاوز 45,000 ريال.");
      }
      let employeeRate;
      let schemeLabel;
      if (scheme === "new") {
        employeeRate = 10.75;
        schemeLabel = "النظام الجديد: 10% معاشات + 0.75% ساند";
      } else if (scheme === "legacy") {
        employeeRate = 9.75;
        schemeLabel = "النظام السابق: 9% معاشات + 0.75% ساند";
      } else if (scheme === "non-saudi") {
        employeeRate = 0;
        schemeLabel = "لا تُخصم حصة الموظف للمعاشات وساند في الحالة القياسية لغير السعودي";
      } else {
        throw new Error("اختر فئة اشتراك صحيحة.");
      }
      const deduction = insuredWage * employeeRate / 100;
      return [
        row("النظام المختار", schemeLabel, "text"),
        row("نسبة حصة الموظف", employeeRate, "percent"),
        row("استقطاع الموظف الشهري التقديري", deduction, "money"),
        row("الأجر بعد هذا الاستقطاع", insuredWage - deduction, "money"),
      ];
    }

    case "salary-increase-calculator": {
      const salary = readNumber(data, "salary", "الراتب الحالي");
      const rate = readNumber(data, "rate", "نسبة الزيادة");
      if (salary <= 0 || rate < 0 || rate > 500) {
        throw new Error("أدخل راتبًا أكبر من صفر ونسبة زيادة بين صفر و500%.");
      }
      const increase = salary * rate / 100;
      const newSalary = salary + increase;
      return [
        row("قيمة الزيادة الشهرية", increase, "money"),
        row("الراتب الشهري الجديد", newSalary, "money"),
        row("إجمالي الزيادة السنوية", increase * 12, "money"),
        row("نسبة الزيادة", rate, "percent"),
      ];
    }

    case "wage-hour-converter": {
      const monthlyWage = readNumber(data, "monthlyWage", "الأجر الشهري");
      if (monthlyWage <= 0) throw new Error("أدخل أجرًا شهريًا أكبر من صفر.");
      const daily = monthlyWage / 30;
      return [
        row("الأجر اليومي التقديري", daily, "money"),
        row("أجر الساعة التقديري", daily / 8, "money"),
      ];
    }

    case "notice-compensation-calculator": {
      const monthlyWage = readNumber(data, "monthlyWage", "الأجر الشهري");
      const servedDays = readNumber(data, "servedDays", "أيام الإشعار المنفذة");
      const party = data.party || "employee";
      if (monthlyWage <= 0 || !Number.isInteger(servedDays) || servedDays < 0 || servedDays > 60) {
        throw new Error("أدخل أجرًا شهريًا أكبر من صفر وعدد أيام إشعار صحيحًا من صفر إلى 60.");
      }
      let requiredDays;
      if (party === "employee") requiredDays = 30;
      else if (party === "employer") requiredDays = 60;
      else throw new Error("اختر الطرف الذي أنهى العقد.");
      const remainingDays = Math.max(0, requiredDays - servedDays);
      return [
        row("مهلة الإشعار الدنيا", requiredDays, "number", " يوم"),
        row("الأيام غير المنفذة", remainingDays, "number", " يوم"),
        row("التعويض التقديري عن المهلة غير المنفذة", monthlyWage / 30 * remainingDays, "money"),
      ];
    }


    case "real-estate-transfer-tax-calculator": {
      const value = readNumber(data, "value", "قيمة التصرف العقاري");
      if (value <= 0) throw new Error("أدخل قيمة تصرف عقاري أكبر من صفر.");
      const tax = value * 0.05;
      return [
        row("قيمة التصرف العقاري", value, "money"),
        row("نسبة الضريبة العامة", 5, "percent"),
        row("ضريبة التصرفات العقارية التقديرية", tax, "money"),
        row("قيمة التصرف بعد إضافة الضريبة", value + tax, "money"),
      ];
    }

    case "cash-zakat-calculator": {
      const amount = readNumber(data, "amount", "إجمالي النقود والمدخرات");
      const nisab = readNumber(data, "nisab", "قيمة النصاب");
      const haul = data.haul || "yes";
      if (amount < 0 || nisab <= 0 || !["yes", "no"].includes(haul)) throw new Error("أدخل مبلغًا غير سالب ونصابًا أكبر من صفر واختر حالة الحول.");
      const due = haul === "yes" && amount >= nisab;
      return [
        row("إجمالي النقود المدخلة", amount, "money"),
        row("قيمة النصاب المدخلة", nisab, "money"),
        row("حالة بلوغ النصاب واكتمال الحول", due ? "تحققا وفق المدخلات" : "لم يتحققا معًا", "text"),
        row("الزكاة التقديرية", due ? amount / 40 : 0, "money"),
      ];
    }

    case "trade-zakat-calculator": {
      const inventory = readNumber(data, "inventory", "قيمة البضائع");
      const cash = readNumber(data, "cash", "النقود");
      const receivables = readNumber(data, "receivables", "الديون المرجوة");
      const nisab = readNumber(data, "nisab", "قيمة النصاب");
      const haul = data.haul || "yes";
      if ([inventory, cash, receivables].some((value) => value < 0) || nisab <= 0 || !["yes", "no"].includes(haul)) throw new Error("تحقق من أن قيم الموجودات غير سالبة وأن النصاب أكبر من صفر.");
      const base = inventory + cash + receivables;
      const due = haul === "yes" && base >= nisab;
      return [
        row("وعاء الزكاة التقديري", base, "money"),
        row("حالة بلوغ النصاب واكتمال الحول", due ? "تحققا وفق المدخلات" : "لم يتحققا معًا", "text"),
        row("الزكاة التقديرية", due ? base / 40 : 0, "money"),
      ];
    }

    case "gold-zakat-calculator": {
      const weight = readNumber(data, "weight", "وزن الذهب");
      const karat = readNumber(data, "karat", "عيار الذهب");
      const price24 = readNumber(data, "price24", "سعر جرام الذهب عيار 24");
      const haul = data.haul || "yes";
      if (weight <= 0 || ![18, 21, 22, 24].includes(karat) || price24 <= 0 || !["yes", "no"].includes(haul)) throw new Error("تحقق من وزن الذهب وعياره وسعر الجرام وحالة الحول.");
      const pureWeight = weight * karat / 24;
      const value = pureWeight * price24;
      const due = haul === "yes" && pureWeight >= 85;
      return [
        row("وزن الذهب الخالص التقريبي", pureWeight, "number", " جرام"),
        row("قيمة الذهب الخالص التقريبية", value, "money"),
        row("حالة بلوغ نصاب 85 جرامًا واكتمال الحول", due ? "تحققا وفق المدخلات" : "لم يتحققا معًا", "text"),
        row("الزكاة التقديرية", due ? value * 0.025 : 0, "money"),
      ];
    }

    case "social-security-income-calculator": {
      const earned = readNumber(data, "earned", "الدخل المكتسب");
      const unearned = readNumber(data, "unearned", "الدخل غير المكتسب");
      const threshold = readNumber(data, "threshold", "الحد الأدنى المحتسب للمعاش");
      if (earned < 0 || unearned < 0 || threshold <= 0) throw new Error("أدخل دخلًا غير سالب وحدًا أدنى محتسبًا أكبر من صفر.");
      const countedIncome = earned * 0.5 + unearned;
      const estimatedBenefit = Math.max(0, threshold - countedIncome);
      return [
        row("نصف الدخل المكتسب", earned * 0.5, "money"),
        row("الدخل المحتسب الإجمالي", countedIncome, "money"),
        row("الحد الأدنى المحتسب المدخل", threshold, "money"),
        row("فرق المعاش الحسابي التقديري", estimatedBenefit, "money"),
        row("مقارنة الدخل بالحد المدخل", countedIncome < threshold ? "الدخل المحتسب أقل من الحد المدخل" : "الدخل المحتسب يساوي الحد المدخل أو يتجاوزه", "text"),
      ];
    }

    case "sama-affordability-calculator": {
      const income = readNumber(data, "income", "الدخل الشهري المعتمد");
      const salary = readNumber(data, "salary", "الراتب الشهري");
      const payroll = readNumber(data, "payroll", "التزامات الاستقطاع من الراتب");
      const nonMortgage = readNumber(data, "nonMortgage", "الالتزامات غير العقارية");
      const total = readNumber(data, "total", "إجمالي الالتزامات");
      const retired = data.retired || "no";
      const supportedHousing = data.supportedHousing || "no";
      if (income <= 0 || salary <= 0 || [payroll, nonMortgage, total].some((value) => value < 0) || !["yes", "no"].includes(retired) || !["yes", "no"].includes(supportedHousing)) throw new Error("تحقق من الدخل والراتب والالتزامات والخيارات المحددة.");
      const payrollCap = salary * (retired === "yes" ? 0.25 : 1 / 3);
      const payrollRoom = Math.max(0, payrollCap - payroll);
      const nonMortgageCap = income < 25000 ? income * 0.45 : null;
      const nonMortgageRoom = nonMortgageCap === null ? null : Math.max(0, nonMortgageCap - nonMortgage);
      let totalCap = null;
      if (income <= 15000) totalCap = income * (supportedHousing === "yes" ? 0.65 : 0.55);
      else if (income < 25000) totalCap = income * 0.65;
      const totalRoom = totalCap === null ? null : Math.max(0, totalCap - total);
      return [
        row("الحد الأعلى المرجعي للاستقطاع من الراتب", payrollCap, "money"),
        row("المتاح حسابيًا ضمن حد الاستقطاع", payrollRoom, "money"),
        row("الحد الأعلى للالتزامات غير العقارية", nonMortgageCap === null ? "يخضع لسياسة الممول عند دخل 25,000 ريال فأكثر" : nonMortgageCap, nonMortgageCap === null ? "text" : "money"),
        row("المتاح ضمن حد الالتزامات غير العقارية", nonMortgageRoom === null ? "يخضع لسياسة الممول" : nonMortgageRoom, nonMortgageRoom === null ? "text" : "money"),
        row("الحد الإجمالي المرجعي للالتزامات", totalCap === null ? "يخضع لسياسة الممول عند دخل 25,000 ريال فأكثر" : totalCap, totalCap === null ? "text" : "money"),
        row("المتاح حسابيًا ضمن الحد الإجمالي", totalRoom === null ? "يخضع لسياسة الممول" : totalRoom, totalRoom === null ? "text" : "money"),
      ];
    }

    case "finance-amount-from-payment-calculator": {
      const payment = readNumber(data, "payment", "القسط الشهري");
      const annualRate = readNumber(data, "rate", "معدل النسبة السنوي");
      const years = readNumber(data, "years", "مدة التمويل");
      if (payment <= 0 || annualRate < 0 || annualRate > 100 || !Number.isInteger(years) || years < 1 || years > 30) throw new Error("أدخل قسطًا أكبر من صفر ومعدلًا من صفر إلى 100 ومدة صحيحة من سنة إلى 30 سنة.");
      const months = years * 12;
      const monthlyRate = annualRate / 1200;
      const principal = monthlyRate === 0 ? payment * months : payment * (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate;
      const totalPayments = payment * months;
      return [
        row("مبلغ التمويل التقديري", principal, "money"),
        row("إجمالي الأقساط طوال المدة", totalPayments, "money"),
        row("تكلفة التمويل التقديرية فوق أصل المبلغ", totalPayments - principal, "money"),
      ];
    }

    case "real-estate-purchase-cost-calculator": {
      const price = readNumber(data, "price", "سعر العقار");
      const downRate = readNumber(data, "downRate", "نسبة الدفعة المقدمة");
      const brokerRate = readNumber(data, "brokerRate", "نسبة عمولة الوساطة");
      const otherFees = readNumber(data, "otherFees", "الرسوم الأخرى");
      if (price <= 0 || downRate < 0 || downRate > 100 || brokerRate < 0 || brokerRate > 100 || otherFees < 0) throw new Error("تحقق من سعر العقار والنسب والرسوم المدخلة.");
      const downPayment = price * downRate / 100;
      const tax = price * 0.05;
      const brokerFee = price * brokerRate / 100;
      const financed = price - downPayment;
      const upfront = downPayment + tax + brokerFee + otherFees;
      return [
        row("الدفعة المقدمة", downPayment, "money"),
        row("ضريبة التصرفات العقارية التقديرية", tax, "money"),
        row("عمولة الوساطة المدخلة", brokerFee, "money"),
        row("مبلغ التمويل قبل الرسوم", financed, "money"),
        row("إجمالي النقد المطلوب مبدئيًا", upfront, "money"),
        row("إجمالي كلفة التملك مع الرسوم المدخلة", price + tax + brokerFee + otherFees, "money"),
      ];
    }

    default:
      throw new Error("هذه الأداة غير معروفة.");
  }
}
