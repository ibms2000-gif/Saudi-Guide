const DAY_MS = 24 * 60 * 60 * 1000;

function readNumber(values, key, label) {
  const value = Number(values[key]);
  if (!Number.isFinite(value)) throw new Error(\`أدخل قيمة رقمية صحيحة في حقل \${label}.\`);
  return value;
}

function parseDate(value, label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) throw new Error(\`أدخل تاريخًا صحيحًا في حقل \${label}.\`);
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(\`التاريخ المدخل في حقل \${label} غير موجود في التقويم.\`);
  }
  return { date, year, month, day };
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

/**
 * Calculate a tool result without touching the DOM.
 * values contains the named form fields as strings.
 */
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
        row("العمر", \`\${age.years} سنة و\${age.months} شهر و\${age.days} يوم\`, "text"),
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

    default:
      throw new Error("هذه الأداة غير معروفة.");
  }
}
