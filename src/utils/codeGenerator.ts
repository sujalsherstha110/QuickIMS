import { Product } from '../types';

/**
 * Common category prefixes for readable SKUs
 */
const KNOWN_CATEGORY_CODES: Record<string, string> = {
  'pipes & fittings': 'PIP',
  'pipes': 'PIP',
  'fittings': 'FIT',
  'sanitaryware': 'SAN',
  'sanitary ware': 'SAN',
  'bathroom & kitchen': 'BTH',
  'bathroom': 'BTH',
  'kitchen': 'KIT',
  'electrical & lighting': 'ELE',
  'electrical': 'ELE',
  'lighting': 'LGT',
  'tiles & marbles': 'TIL',
  'tiles': 'TIL',
  'marbles': 'MAR',
  'paints & chemicals': 'PNT',
  'paints': 'PNT',
  'hardware & fasteners': 'HRD',
  'hardware & tools': 'HRD',
  'hardware': 'HRD',
  'tools & equipment': 'TLS',
  'tools': 'TLS',
  'water tanks & motors': 'TNK',
  'water tanks': 'TNK',
  'motors & pumps': 'PMP',
  'valves & cocks': 'VLV',
  'plumbing': 'PLM',
  'roofing & sheets': 'ROF',
  'cement & aggregates': 'CMT',
  'steel & rebars': 'STL'
};

/**
 * Common brand prefixes for readable SKUs
 */
const KNOWN_BRAND_CODES: Record<string, string> = {
  'panchakanya': 'PAN',
  'jaquar': 'JAQ',
  'astral': 'AST',
  'prince': 'PRN',
  'kajaria': 'KAJ',
  'asian paints': 'ASN',
  'berger': 'BER',
  'havells': 'HAV',
  'finolex': 'FIN',
  'supreme': 'SUP',
  'somany': 'SOM',
  'hindware': 'HND',
  'cera': 'CER',
  'kohler': 'KOH',
  'orient': 'ORI',
  'philips': 'PHL',
  'schneider': 'SCH',
  'crompton': 'CRM',
  'd-link': 'DLK',
  'bosch': 'BSH',
  'makita': 'MAK',
  'stanley': 'STN',
  'jagdamba': 'JAG',
  'shivam': 'SHV',
  'arghakhanchi': 'ARG'
};

/**
 * Derives a clean 3-4 letter uppercase code from a category name
 */
export function getCategoryCode(category: string): string {
  if (!category || !category.trim()) return 'GEN';
  const clean = category.trim().toLowerCase();
  
  // Exact match
  if (KNOWN_CATEGORY_CODES[clean]) {
    return KNOWN_CATEGORY_CODES[clean];
  }

  // Substring match
  for (const [key, code] of Object.entries(KNOWN_CATEGORY_CODES)) {
    if (clean.includes(key)) {
      return code;
    }
  }

  // Fallback: Extract uppercase alphanumeric characters
  const alphanumeric = category.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (alphanumeric.length >= 3) {
    return alphanumeric.slice(0, 3);
  }
  return (alphanumeric + 'GEN').slice(0, 3);
}

/**
 * Derives a clean 3-letter uppercase code from a brand name
 */
export function getBrandCode(brand?: any): string {
  if (!brand || typeof brand !== 'string' || !brand.trim()) return 'GEN';
  const clean = brand.trim().toLowerCase();

  // Exact match
  if (KNOWN_BRAND_CODES[clean]) {
    return KNOWN_BRAND_CODES[clean];
  }

  // Substring match
  for (const [key, code] of Object.entries(KNOWN_BRAND_CODES)) {
    if (clean.includes(key)) {
      return code;
    }
  }

  // Fallback: Clean letters
  const alphanumeric = String(brand).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (alphanumeric.length >= 3) {
    return alphanumeric.slice(0, 3);
  }
  return (alphanumeric + 'GEN').slice(0, 3);
}

/**
 * Computes the GS1 Modulo-10 checksum digit for a 12-digit string to form a standard 13-digit EAN-13 barcode.
 */
export function computeEAN13CheckDigit(twelveDigits: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(twelveDigits[i], 10);
    // Even indexed positions (0, 2, 4, 6, 8, 10) weight 1, odd weight 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? '0' : String(10 - remainder);
}

/**
 * Generates an internal retail EAN-13 standard 13-digit barcode guaranteed to be unique.
 * GS1 standard reserves 20-29 for in-store/internal POS usage.
 */
export function generateUniqueBarcode(
  existingProducts: Product[] = [],
  excludeProductId?: string
): string {
  const existingBarcodes = new Set(
    existingProducts
      .filter(p => !excludeProductId || p.id !== excludeProductId)
      .map(p => (p.barcode || '').trim())
      .filter(Boolean)
  );

  // Starting sequence based on count or high number
  let counter = existingProducts.length + 1;
  let candidate = '';

  for (let attempts = 0; attempts < 10000; attempts++) {
    // 2-digit prefix "20" + 10-digit counter padded + 1 check digit
    const body = `20${String(counter).padStart(10, '0')}`;
    const checkDigit = computeEAN13CheckDigit(body);
    candidate = `${body}${checkDigit}`;

    if (!existingBarcodes.has(candidate)) {
      return candidate;
    }
    counter++;
  }

  // Fallback if loop finishes: use timestamp slice
  const tsBody = `20${String(Date.now()).slice(-10)}`;
  return `${tsBody}${computeEAN13CheckDigit(tsBody)}`;
}

/**
 * Generates a human-readable, structured SKU guaranteed to be unique.
 * Format: [CAT]-[BRAND]-[SEQUENCE] (e.g., SAN-JAQ-00042)
 */
export function generateUniqueSKU(
  category: string,
  brandOrProducts?: string | Product[],
  existingProducts: Product[] = [],
  excludeProductId?: string
): string {
  let brand = 'GEN';
  let productsList: Product[] = existingProducts || [];
  let excludeId: string | undefined = excludeProductId;

  if (Array.isArray(brandOrProducts)) {
    // Call signature: generateUniqueSKU(category, existingProducts, excludeProductId)
    productsList = brandOrProducts;
    brand = 'GEN';
  } else if (typeof brandOrProducts === 'string' && brandOrProducts.trim()) {
    brand = brandOrProducts.trim();
  }

  const catCode = getCategoryCode(category);
  const brandCode = getBrandCode(brand);
  const prefix = `${catCode}-${brandCode}`;

  const existingSkus = new Set(
    productsList
      .filter(p => !excludeId || p.id !== excludeId)
      .map(p => (p.sku || '').trim().toUpperCase())
      .filter(Boolean)
  );

  // Scan for the highest numeric sequence under this prefix or globally
  let maxSeq = 0;
  for (const sku of existingSkus) {
    if (sku.startsWith(prefix)) {
      const parts = sku.split('-');
      const lastPart = parts[parts.length - 1];
      const parsed = parseInt(lastPart, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  if (nextSeq === 1) {
    // If no existing with this prefix, base on total products count to avoid starting all from 00001 if desired,
    // or start nicely at 00001 for each brand/category pair
    nextSeq = 1;
  }

  for (let attempts = 0; attempts < 10000; attempts++) {
    const padded = String(nextSeq).padStart(5, '0');
    const candidate = `${prefix}-${padded}`;

    if (!existingSkus.has(candidate)) {
      return candidate;
    }
    nextSeq++;
  }

  // Extreme fallback
  return `${prefix}-${Date.now().toString().slice(-5)}`;
}

/**
 * Checks in real-time if a given SKU is already used by another product.
 * Returns the conflicting Product if duplicate, otherwise null.
 */
export function checkSkuDuplicate(
  sku: string,
  existingProducts: Product[] = [],
  excludeProductId?: string
): Product | null {
  const normalized = (sku || '').trim().toUpperCase();
  if (!normalized) return null;

  const found = existingProducts.find(
    p => p && (!excludeProductId || p.id !== excludeProductId) && (p.sku || '').trim().toUpperCase() === normalized
  );

  return found || null;
}

/**
 * Checks in real-time if a given barcode is already used by another product.
 * Returns the conflicting Product if duplicate, otherwise null.
 */
export function checkBarcodeDuplicate(
  barcode: string,
  existingProducts: Product[] = [],
  excludeProductId?: string
): Product | null {
  const normalized = (barcode || '').trim();
  if (!normalized) return null;

  const found = existingProducts.find(
    p => p && (!excludeProductId || p.id !== excludeProductId) && (p.barcode || '').trim() === normalized
  );

  return found || null;
}
