/**
 * Format currency in Nepalese Rupees standard (e.g. Rs. 1,25,000.00)
 */
export function formatNPR(amount: number | undefined | null, includeDecimals = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0.00';
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const parts = absAmount.toFixed(includeDecimals ? 2 : 0).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1] ? `.${parts[1]}` : '';
  
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

/**
 * Approximate Bikram Sambat (BS) date converter for display
 * Offset standard is ~56.7 years + month offset
 */
export function toNepaliBSDate(dateInput?: Date | number | string): string {
  const dateObj = dateInput ? new Date(dateInput) : new Date();
  const gregorianYear = dateObj.getFullYear();
  const bsYear = gregorianYear + 56 + (dateObj.getMonth() >= 3 ? 1 : 0);
  const months = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
  const monthIdx = (dateObj.getMonth() + 8) % 12;
  const day = dateObj.getDate();
  return `${day} ${months[monthIdx]}, ${bsYear} B.S.`;
}

/**
 * Helper to calculate converted base quantity and human-readable string
 * e.g. 53 pieces when base is piece and 1 box = 12 -> "4 Boxes + 5 Pieces"
 */
export function formatStockInUnits(baseQuantity: number, baseUnit: string, altUnits?: { unitName: string; multiplierToBase: number }[]): string {
  if (!altUnits || altUnits.length === 0) {
    return `${baseQuantity} ${baseUnit}`;
  }
  
  // Find highest multiplier
  const sorted = [...altUnits].sort((a, b) => b.multiplierToBase - a.multiplierToBase);
  const primaryAlt = sorted[0];
  
  if (primaryAlt && primaryAlt.multiplierToBase > 1 && baseQuantity >= primaryAlt.multiplierToBase) {
    const boxes = Math.floor(baseQuantity / primaryAlt.multiplierToBase);
    const remainder = baseQuantity % primaryAlt.multiplierToBase;
    if (remainder === 0) {
      return `${boxes} ${primaryAlt.unitName}${boxes > 1 ? 's' : ''}`;
    }
    return `${boxes} ${primaryAlt.unitName}${boxes > 1 ? 's' : ''} + ${remainder} ${baseUnit}`;
  }
  
  return `${baseQuantity} ${baseUnit}`;
}
