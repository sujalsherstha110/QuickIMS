import { Product } from '../types';

/**
 * Common culinary synonyms, transliterations, and frequent typo variations
 * particularly tailored for food & beverage and restaurant menus (including Nepali / South Asian dishes)
 */
const FOOD_SYNONYMS_AND_TYPOS: Record<string, string[]> = {
  chicken: ['chiken', 'chikn', 'chikken', 'chkn', 'ciken', 'chick', 'kukkad', 'murga', 'chickn'],
  momo: ['momos', 'mmo', 'm:m', 'mo-mo', 'dumpling', 'dumplings', 'mamu', 'momoes'],
  buff: ['buf', 'buffalo', 'bufff', 'bhainsi', 'ranga', 'buffo'],
  mutton: ['muton', 'khasi', 'goat', 'lamb', 'khasiko'],
  pork: ['sungur', 'pig', 'porko'],
  paneer: ['panir', 'paner', 'cottage', 'paneer-chilli'],
  biryani: ['biryami', 'bryani', 'briyani', 'biryany', 'biriani', 'biryaani'],
  chowmein: ['chawmin', 'chaumin', 'chowmin', 'chawmein', 'noodle', 'noodles', 'chaowmin', 'chaumein'],
  thukpa: ['thukba', 'tukpa', 'thukppa', 'thugpa'],
  sekuwa: ['sekuva', 'shekuwa', 'sukuti', 'sukute', 'barbeque', 'bbq', 'sekuwaa', 'poleko'],
  chilli: ['chili', 'chilly', 'chillly', 'chile', 'chilli-gravy'],
  fried: ['fry', 'frai', 'deepfry', 'taas', 'tareko'],
  steamed: ['steam', 'stim', 'steem', 'usene'],
  kothey: ['kothe', 'kothei', 'panfry', 'pan-fried'],
  jhol: ['jhol momo', 'soup', 'gravy', 'rasa'],
  sadheko: ['sandeko', 'sadeko', 'salad', 'kachumber'],
  choila: ['chwela', 'choyla', 'choilaa', 'chhoila'],
  pizza: ['piza', 'pizaa', 'pizzas'],
  burger: ['burgar', 'burgr', 'burgers'],
  sandwich: ['sandwhich', 'sandwitch', 'toast'],
  coke: ['coca', 'cocacola', 'coca-cola', 'cola'],
  sprite: ['sprit', 'spright'],
  fanta: ['fantaa'],
  beer: ['bir', 'ber', 'alcohol', 'can', 'bottle'],
  tuborg: ['tubrg', 'tuborge', 'tuborg-beer'],
  everest: ['evrest', 'everest-beer'],
  gorkha: ['gorkhaa', 'gorkha-beer'],
  carlsberg: ['carlsbrg', 'calsberg'],
  khukri: ['khukuri', 'kukri', 'rum'],
  whisky: ['whiskey', 'scotch', 'blended'],
  vodka: ['wodka', 'vodca'],
  coffee: ['cofee', 'kafi', 'cappuccino', 'latte', 'espresso', 'americano'],
  tea: ['chiya', 'chai', 'black tea', 'milk tea'],
  water: ['pani', 'kinley', 'aquafina', 'mineral water'],
  rice: ['bhat', 'chawal', 'fried rice', 'pulao', 'plain rice'],
  curry: ['tarkari', 'gravy', 'jhol'],
  soup: ['sup', 'hot soup', 'clear soup', 'manchow', 'hot and sour'],
  naan: ['nan', 'roti', 'paratha', 'kulcha', 'chapati'],
  veg: ['vegetable', 'vegetarian', 'sabji', 'tarkari'],
  nonveg: ['non-veg', 'non_veg', 'meat', 'masu']
};

/**
 * Standard Levenshtein distance calculation
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}

/**
 * Clean and normalize a string into lowercased search tokens
 */
export function tokenize(str: string): string[] {
  if (!str) return [];
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Find root synonym for a word if known
 */
export function resolveSynonym(word: string): string {
  const clean = String(word || '').toLowerCase().trim();
  for (const [canonical, variants] of Object.entries(FOOD_SYNONYMS_AND_TYPOS)) {
    if (canonical === clean || variants.includes(clean)) {
      return canonical;
    }
  }
  return clean;
}

/**
 * Check if a query token matches a target word, allowing for:
 * 1. Exact match (Score: 100)
 * 2. Prefix match (Score: 90)
 * 3. Substring match (Score: 80)
 * 4. Synonym / Dictionary Typo match (Score: 85)
 * 5. Levenshtein edit distance <= 1 or 2 (Score: 70-75)
 */
function tokenMatchesWord(qToken: string, targetWord: string): { matches: boolean; score: number; typoCorrected?: string } {
  if (!qToken || !targetWord) return { matches: false, score: 0 };
  
  // Exact match
  if (qToken === targetWord) {
    return { matches: true, score: 100 };
  }

  // Prefix match (e.g. "chi" -> "chicken", "mo" -> "momo")
  if (targetWord.startsWith(qToken)) {
    return { matches: true, score: 90 };
  }

  // Substring match
  if (targetWord.includes(qToken)) {
    return { matches: true, score: 80 };
  }

  // Synonym / Dictionary Typo match
  const qCanon = resolveSynonym(qToken);
  const tCanon = resolveSynonym(targetWord);
  if (qCanon === tCanon || qCanon === targetWord || qToken === tCanon) {
    return { matches: true, score: 85, typoCorrected: tCanon };
  }

  // Levenshtein fuzzy distance tolerance
  const qLen = qToken.length;
  const tLen = targetWord.length;

  if (qLen >= 3 && tLen >= 3) {
    const dist = levenshteinDistance(qToken, targetWord);
    // Allow 1 typo for length >= 3
    if (dist <= 1) {
      return { matches: true, score: 75, typoCorrected: targetWord };
    }
    // Allow 2 typos for length >= 6 (e.g. "chowmin" -> "chowmein", "biryami" -> "biryani")
    if (qLen >= 5 && tLen >= 5 && dist <= 2) {
      return { matches: true, score: 65, typoCorrected: targetWord };
    }
  }

  return { matches: false, score: 0 };
}

/**
 * Check acronym match (e.g., "csm" for "Chicken Steam Momo", "eb" for "Everest Beer")
 */
function checkAcronym(query: string, name: string): boolean {
  const qClean = String(query || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (qClean.length < 2 || qClean.length > 5) return false;

  const words = String(name || '').toLowerCase().split(/[\s\-_]+/).filter(Boolean);
  const acronym = words.map(w => w[0]).join('');
  return acronym === qClean || acronym.startsWith(qClean);
}

export interface SearchMatchResult {
  product: Product;
  score: number;
  matchedTokensCount: number;
  isExactNameMatch: boolean;
  correctedTerms: string[];
}

/**
 * Score a product against a search query
 */
export function scoreProductSearch(product: Product, rawQuery: string): SearchMatchResult | null {
  const query = String(rawQuery || '').trim().toLowerCase();
  if (!query) return null;

  const qTokens = tokenize(query);
  if (qTokens.length === 0) return null;

  const pName = (product.name || '').toLowerCase();
  const pSku = (product.sku || '').toLowerCase();
  const pBarcode = (product.barcode || '').toLowerCase();
  const pCategory = (product.category || '').toLowerCase();
  const pSubCategory = (product.subCategory || product.subcategory || '').toLowerCase();
  const pPrepStyle = (product.prepStyle || '').toLowerCase();
  const pDepartment = (product.department || '').toLowerCase();
  const pDescription = (product.description || '').toLowerCase();
  const pDietary = (product.dietaryType || '').toLowerCase();

  // Combine target tokens
  const nameTokens = tokenize(pName);
  const otherTokens = [
    ...tokenize(pCategory),
    ...tokenize(pSubCategory),
    ...tokenize(pPrepStyle),
    ...tokenize(pDepartment),
    ...tokenize(pDietary),
    ...tokenize(pSku),
    ...tokenize(pDescription)
  ];
  const allTargetTokens = [...nameTokens, ...otherTokens];

  // 1. Check for complete raw string matches
  if (pName === query) {
    return {
      product,
      score: 1000,
      matchedTokensCount: qTokens.length,
      isExactNameMatch: true,
      correctedTerms: []
    };
  }

  if (pName.startsWith(query)) {
    return {
      product,
      score: 800,
      matchedTokensCount: qTokens.length,
      isExactNameMatch: false,
      correctedTerms: []
    };
  }

  if (pName.includes(query)) {
    return {
      product,
      score: 600,
      matchedTokensCount: qTokens.length,
      isExactNameMatch: false,
      correctedTerms: []
    };
  }

  // Check SKU / Barcode exact or normalized alphanumeric substring (e.g. "bre100" matches "BRE-100")
  const queryAlpha = query.replace(/[^a-z0-9]/g, '');
  const skuAlpha = pSku.replace(/[^a-z0-9]/g, '');
  if (
    pSku.includes(query) ||
    (queryAlpha.length >= 2 && skuAlpha.includes(queryAlpha)) ||
    (pBarcode && pBarcode.includes(query))
  ) {
    return {
      product,
      score: 500,
      matchedTokensCount: qTokens.length,
      isExactNameMatch: false,
      correctedTerms: []
    };
  }

  // Check acronym (e.g. "csm" -> "Chicken Steam Momo")
  if (checkAcronym(query, product.name)) {
    return {
      product,
      score: 450,
      matchedTokensCount: qTokens.length,
      isExactNameMatch: false,
      correctedTerms: []
    };
  }

  // 2. Multi-token out-of-order matching
  let totalScore = 0;
  let matchedTokensCount = 0;
  const correctedTerms: string[] = [];

  for (const qToken of qTokens) {
    let bestTokenScore = 0;
    let tokenCorrectedTerm: string | undefined = undefined;

    // Check name tokens first (weighted higher)
    for (const nToken of nameTokens) {
      const res = tokenMatchesWord(qToken, nToken);
      if (res.matches && res.score > bestTokenScore) {
        bestTokenScore = res.score * 1.5; // 1.5x weight for product name matches
        tokenCorrectedTerm = res.typoCorrected;
      }
    }

    // Check other tokens if needed
    for (const oToken of otherTokens) {
      const res = tokenMatchesWord(qToken, oToken);
      if (res.matches && res.score > bestTokenScore) {
        bestTokenScore = res.score;
        tokenCorrectedTerm = res.typoCorrected;
      }
    }

    if (bestTokenScore > 0) {
      matchedTokensCount++;
      totalScore += bestTokenScore;
      if (tokenCorrectedTerm && !correctedTerms.includes(tokenCorrectedTerm)) {
        correctedTerms.push(tokenCorrectedTerm);
      }
    }
  }

  // For multi-word query: MUST match all query tokens (or at least all but one for queries >= 3 words)
  const minRequiredMatches = qTokens.length >= 3 ? qTokens.length - 1 : qTokens.length;
  if (matchedTokensCount < minRequiredMatches) {
    return null;
  }

  // Bonus if all tokens were matched
  if (matchedTokensCount === qTokens.length) {
    totalScore += 100;
  }

  return {
    product,
    score: totalScore,
    matchedTokensCount,
    isExactNameMatch: false,
    correctedTerms
  };
}

/**
 * Filter and rank products using smart typo-tolerant search
 */
export function searchFoodProducts(
  products: Product[],
  rawQuery: string,
  preferredCategory?: string
): { results: Product[]; correctedTerms: string[] } {
  const query = rawQuery.trim();
  if (!query) {
    return { results: products, correctedTerms: [] };
  }

  const scoredList: SearchMatchResult[] = [];
  const allCorrected = new Set<string>();

  const normalizedPreferredCategory =
    preferredCategory && preferredCategory !== 'ALL'
      ? String(preferredCategory).trim().toLowerCase()
      : '';

  for (const p of products) {
    if (!p || !p.name) continue;
    if (p.status === 'discontinued' || p.status === 'inactive') continue;
    if (p.itemType === 'raw_ingredient') continue;

    const res = scoreProductSearch(p, query);
    if (res) {
      // Add slight boost if item belongs to user's currently selected category
      let finalScore = res.score;
      if (
        normalizedPreferredCategory &&
        String(p.category || '').trim().toLowerCase() === normalizedPreferredCategory
      ) {
        finalScore += 50;
      }
      scoredList.push({
        ...res,
        score: finalScore
      });

      res.correctedTerms.forEach(t => allCorrected.add(t));
    }
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  return {
    results: scoredList.map(s => s.product),
    correctedTerms: Array.from(allCorrected)
  };
}
