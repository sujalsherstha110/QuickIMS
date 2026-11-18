/**
 * Format currency in Nepalese Rupees standard (e.g. Rs. 1,25,000)
 */
export function formatNPR(amount: number | string | undefined | null, includeDecimals = false): string {
  if (amount === undefined || amount === null) return 'Rs. 0';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num) || !isFinite(num)) return 'Rs. 0';
  
  const isNegative = num < 0;
  const absAmount = Math.abs(num);
  
  const parts = absAmount.toFixed(includeDecimals ? 2 : 0).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1] && includeDecimals ? `.${parts[1]}` : '';
  
  // South Asian / Nepalese numbering formatting (Lakhs and Crores: 12,34,567)
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }
  
  return `${isNegative ? '-' : ''}Rs. ${integerPart}${decimalPart}`;
}

/**
 * Convert number to words in NPR format (e.g. Rupees Twelve Thousand Five Hundred Only)
 */
export function numberToWordsNPR(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertGroup(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? convertGroup(n % 100) : '');
    return '';
  }
  
  const intVal = Math.floor(Math.abs(num));
  const paisa = Math.round((Math.abs(num) - intVal) * 100);
  
  let str = '';
  
  const crore = Math.floor(intVal / 10000000);
  const lakh = Math.floor((intVal % 10000000) / 100000);
  const thousand = Math.floor((intVal % 100000) / 1000);
  const hundred = intVal % 1000;
  
  if (crore > 0) str += convertGroup(crore) + 'Crore ';
  if (lakh > 0) str += convertGroup(lakh) + 'Lakh ';
  if (thousand > 0) str += convertGroup(thousand) + 'Thousand ';
  if (hundred > 0) str += convertGroup(hundred);
  
  str = str.trim();
  if (str) str = 'Rupees ' + str;
  if (paisa > 0) {
    str += ` and ${paisa}/100 Paisa`;
  }
  return str + ' Only';
}

/**
 * Format timestamp to readable date/time (with Nepali standard format)
 */
export function formatDate(timestamp: number | Date | string | undefined): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDateTime(timestamp: number | Date | string | undefined): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const BS_MONTH_NAMES = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
] as const;

// Exact month day-counts per Bikram Sambat year (Baisakh -> Chaitra).
// Anchor: 2078-01-01 BS === 2021-04-14 AD
const BS_CALENDAR_ANCHOR_UTC = Date.UTC(2021, 3, 14); // 2021-04-14
const BS_CALENDAR_START_YEAR = 2078;
const BS_MONTH_DAYS: Record<number, readonly number[]> = {
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2021-04-14 .. 2022-04-13
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2022-04-14 .. 2023-04-13
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2023-04-14 .. 2024-04-12
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2024-04-13 .. 2025-04-13
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2025-04-14 .. 2026-04-13
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2026-04-14 .. 2027-04-13
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 2027-04-14 .. 2028-04-12
  2085: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2028-04-13 .. 2029-04-12
};

export interface NepaliBSDateParts {
  year: number;
  monthIndex: number; // 0 = Baisakh, 11 = Chaitra
  monthName: string;
  day: number;
}

/**
 * Convert an AD Date / timestamp into exact Bikram Sambat (BS) calendar parts.
 */
export function getNepaliBSDateParts(dateInput?: Date | number | string): NepaliBSDateParts {
  const rawDate = dateInput ? new Date(dateInput) : new Date();
  const dateObj = isNaN(rawDate.getTime()) ? new Date() : rawDate;

  // Normalize to whole UTC days from local calendar date to eliminate DST / timezone drift
  const targetUtc = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  let remainingDays = Math.floor((targetUtc - BS_CALENDAR_ANCHOR_UTC) / 86400000);

  if (remainingDays >= 0) {
    let year = BS_CALENDAR_START_YEAR;
    while (BS_MONTH_DAYS[year]) {
      const monthsInYear = BS_MONTH_DAYS[year];
      const daysInYear = monthsInYear.reduce((sum, d) => sum + d, 0);
      if (remainingDays < daysInYear) {
        for (let m = 0; m < 12; m++) {
          if (remainingDays < monthsInYear[m]) {
            return {
              year,
              monthIndex: m,
              monthName: BS_MONTH_NAMES[m],
              day: remainingDays + 1
            };
          }
          remainingDays -= monthsInYear[m];
        }
      }
      remainingDays -= daysInYear;
      year++;
    }
  }

  // Fallback for historical (< 2078 BS) or far-future dates outside lookup table
  const gYear = dateObj.getFullYear();
  const gMonth = dateObj.getMonth();
  const gDay = dateObj.getDate();
  const isBeforeBaisakh = gMonth < 3 || (gMonth === 3 && gDay < 14);
  const bsYear = gYear + 56 + (isBeforeBaisakh ? 0 : 1);
  const approxStartMonthOffsets = [14, 15, 15, 17, 17, 17, 18, 17, 16, 15, 13, 15]; // Jan..Dec mid-month switches
  const isSecondHalf = gDay >= approxStartMonthOffsets[gMonth];
  const bsMonthIndex = isSecondHalf ? (gMonth + 9) % 12 : (gMonth + 8) % 12;
  const approxDay = isSecondHalf ? gDay - approxStartMonthOffsets[gMonth] + 1 : gDay + 15;
  return {
    year: bsYear,
    monthIndex: bsMonthIndex,
    monthName: BS_MONTH_NAMES[bsMonthIndex],
    day: Math.max(1, Math.min(31, approxDay))
  };
}

/**
 * Exact Bikram Sambat (BS) date formatter (e.g. "3 Mangsir, 2083 B.S.")
 */
export function toNepaliBSDate(dateInput?: Date | number | string): string {
  const { day, monthName, year } = getNepaliBSDateParts(dateInput);
  return `${day} ${monthName}, ${year} B.S.`;
}

/**
 * Helper to calculate converted base quantity and human-readable string
 * e.g. 53 pieces when base is piece and 1 box = 12 -> "4 Boxes + 5 Pieces"
 */
export function formatStockInUnits(baseQuantity: number | undefined | null, baseUnit?: string, altUnits?: { unitName: string; multiplierToBase: number }[]): string {
  const qty = typeof baseQuantity === 'number' && !isNaN(baseQuantity) ? baseQuantity : 0;
  const unit = baseUnit || '';
  if (!Array.isArray(altUnits) || altUnits.length === 0) {
    return `${qty} ${unit}`.trim();
  }
  
  // Find highest multiplier
  const validAltUnits = altUnits.filter(u => u && typeof u === 'object' && typeof u.multiplierToBase === 'number' && u.multiplierToBase > 0);
  if (validAltUnits.length === 0) {
    return `${qty} ${unit}`.trim();
  }

  const sorted = [...validAltUnits].sort((a, b) => b.multiplierToBase - a.multiplierToBase);
  const primaryAlt = sorted[0];
  
  if (primaryAlt && primaryAlt.multiplierToBase > 1 && qty >= primaryAlt.multiplierToBase) {
    const boxes = Math.floor(qty / primaryAlt.multiplierToBase);
    const remainder = qty % primaryAlt.multiplierToBase;
    if (remainder === 0) {
      return `${boxes} ${primaryAlt.unitName}${boxes > 1 ? 's' : ''}`;
    }
    return `${boxes} ${primaryAlt.unitName}${boxes > 1 ? 's' : ''} + ${remainder} ${unit}`.trim();
  }
  
  return `${qty} ${unit}`.trim();
}

/**
 * Generates sequential Nepal fiscal BS invoice numbers in format: INV-YY00001
 * e.g., INV-8300001, INV-8300002
 * @param existingSales list of existing sales invoices
 * @param customPrefix optional prefix (defaults to 'INV-')
 */
export function generateNextInvoiceNumber(existingSales: { invoiceNumber?: string }[] = [], customPrefix: string = 'INV-'): string {
  const bsYear = getNepaliBSDateParts(new Date()).year;
  const yy = String(bsYear).slice(-2); // e.g. "83" for 2083 B.S.

  // Normalize prefix: if customPrefix is "FB-", replace with "INV-" or allow "INV-" standard
  let cleanPrefix = customPrefix && customPrefix !== 'FB-' ? customPrefix : 'INV-';
  if (!cleanPrefix.endsWith('-')) cleanPrefix += '-';

  const yearPrefix = `${cleanPrefix}${yy}`;

  // Find the highest sequence number for this fiscal year prefix
  let maxSeq = 0;
  if (Array.isArray(existingSales)) {
    existingSales.forEach(s => {
      const invNum = s?.invoiceNumber;
      if (invNum && typeof invNum === 'string') {
        if (invNum.startsWith(yearPrefix)) {
          const remainder = invNum.slice(yearPrefix.length).replace(/^-/, '');
          const seq = parseInt(remainder, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });
  }

  const nextSeq = maxSeq + 1;
  const paddedSeq = String(nextSeq).padStart(5, '0'); // e.g. "00001"
  return `${yearPrefix}${paddedSeq}`;
}
