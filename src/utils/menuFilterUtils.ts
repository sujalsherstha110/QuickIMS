import { CompanySettings, Product } from '../types';
import { searchFoodProducts } from './fuzzySearch';
import { resolveItemRoutingStation } from './ticketOrderUtils';

/**
 * Determines whether a catalog product should be visible & selectable in the POS Menu grid
 * and its category filter pills (excludes discontinued, inactive, and raw kitchen ingredients).
 */
export const isMenuVisibleProduct = (product?: Product | null): product is Product => {
  if (!product || !product.name) return false;
  if (product.status === 'discontinued' || product.status === 'inactive') return false;
  if (product.itemType === 'raw_ingredient') return false;
  return true;
};

/**
 * Resolves the canonical POS Root Department ("Food" | "Drink" | custom department)
 * consistently across filter pills and product filtering.
 */
export const getProductDepartmentLabel = (product: Product): string => {
  const explicitDept = product.department?.trim();
  if (explicitDept) return explicitDept;

  const station = resolveItemRoutingStation({
    explicitStation: product.orderRoutingStation,
    product,
    productName: product.name
  });
  return station === 'bar' ? 'Drink' : 'Food';
};

export interface MenuFilterOptions {
  departments: string[];
  categories: string[];
  subCategories: string[];
  prepStyles: string[];
}

export const deriveMenuFilterOptions = (
  products: Product[],
  selectedDepartment: string,
  selectedCategory: string,
  selectedSubCategory: string
): MenuFilterOptions => {
  const visible = (products || []).filter(isMenuVisibleProduct);
  const sDept = String(selectedDepartment || 'ALL').trim().toLowerCase();
  const sCat = String(selectedCategory || 'ALL').trim().toLowerCase();
  const sSub = String(selectedSubCategory || 'ALL').trim().toLowerCase();

  const deptSet = new Set<string>();
  const catSet = new Set<string>();
  const subSet = new Set<string>();
  const prepSet = new Set<string>();

  visible.forEach(p => {
    const pDept = getProductDepartmentLabel(p);
    const pDeptLower = pDept.toLowerCase();
    const pCat = String(p.category || '').trim();
    const pCatLower = pCat.toLowerCase();
    const pSub = String(p.subCategory || p.subcategory || '').trim();
    const pSubLower = pSub.toLowerCase();
    const pPrep = String(p.prepStyle || '').trim();

    if (pDept) deptSet.add(pDept);

    const matchDept = sDept === 'all' || pDeptLower === sDept;
    if (matchDept && pCat) {
      catSet.add(pCat);
    }

    const matchCat = sCat === 'all' || pCatLower === sCat;
    if (matchDept && matchCat && pSub) {
      subSet.add(pSub);
    }

    const matchSub = sSub === 'all' || pSubLower === sSub;
    if (matchDept && matchCat && matchSub && pPrep) {
      prepSet.add(pPrep);
    }
  });

  const toFilterArray = (set: Set<string>) => {
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return list.length > 0 ? ['ALL', ...list] : ['ALL'];
  };

  return {
    departments: toFilterArray(deptSet),
    categories: toFilterArray(catSet),
    subCategories: toFilterArray(subSet),
    prepStyles: toFilterArray(prepSet)
  };
};

export interface MenuSearchFilterResult {
  filteredProducts: Product[];
  searchCorrectedTerms: string[];
  isGlobalSearch: boolean;
}

export const filterMenuProducts = (params: {
  products: Product[];
  searchQuery: string;
  selectedDepartment: string;
  selectedCategory: string;
  selectedSubCategory: string;
  selectedPrepStyle: string;
}): MenuSearchFilterResult => {
  const {
    products,
    searchQuery,
    selectedDepartment,
    selectedCategory,
    selectedSubCategory,
    selectedPrepStyle
  } = params;

  const validProducts = (products || []).filter(isMenuVisibleProduct);
  const trimmed = String(searchQuery || '').trim();

  const sDept = String(selectedDepartment || 'ALL').trim().toLowerCase();
  const sCat = String(selectedCategory || 'ALL').trim().toLowerCase();
  const sSub = String(selectedSubCategory || 'ALL').trim().toLowerCase();
  const sPrep = String(selectedPrepStyle || 'ALL').trim().toLowerCase();

  const matchesActiveHierarchy = (p: Product) => {
    const pDept = getProductDepartmentLabel(p).toLowerCase();
    const pCat = String(p.category || '').trim().toLowerCase();
    const pSub = String(p.subCategory || p.subcategory || '').trim().toLowerCase();
    const pPrep = String(p.prepStyle || '').trim().toLowerCase();

    if (sDept !== 'all' && pDept !== sDept) return false;
    if (sCat !== 'all' && pCat !== sCat) return false;
    if (sSub !== 'all' && pSub !== sSub) return false;
    if (sPrep !== 'all' && pPrep !== sPrep) return false;
    return true;
  };

  if (!trimmed) {
    return {
      filteredProducts: validProducts.filter(matchesActiveHierarchy),
      searchCorrectedTerms: [],
      isGlobalSearch: false
    };
  }

  const { results: globalResults, correctedTerms } = searchFoodProducts(
    validProducts,
    trimmed,
    selectedCategory
  );

  const hasHierarchyFilter =
    sDept !== 'all' || sCat !== 'all' || sSub !== 'all' || sPrep !== 'all';

  if (hasHierarchyFilter) {
    const hierarchyMatches = globalResults.filter(matchesActiveHierarchy);
    if (hierarchyMatches.length > 0) {
      const otherMatches = globalResults.filter(
        p => !hierarchyMatches.some(hm => hm.id === p.id)
      );
      return {
        filteredProducts: [...hierarchyMatches, ...otherMatches],
        searchCorrectedTerms: correctedTerms,
        isGlobalSearch: otherMatches.length > 0
      };
    }

    return {
      filteredProducts: globalResults,
      searchCorrectedTerms: correctedTerms,
      isGlobalSearch: globalResults.length > 0
    };
  }

  return {
    filteredProducts: globalResults,
    searchCorrectedTerms: correctedTerms,
    isGlobalSearch: false
  };
};

export const isProductOutOfStock = (product?: Product | null): boolean => {
  if (!product) return true;
  const isTracked = product.itemType === 'raw_ingredient' || product.trackStock === true;
  return isTracked && (product.currentStock ?? 0) <= 0;
};

export const getProductVatBadgeLabel = (
  product: Pick<Product, 'taxRatePercent' | 'isTaxInclusive'>,
  settings?: Pick<CompanySettings, 'defaultVatRate' | 'taxInclusivePricing'> | null
): string => {
  const vatRate =
    product.taxRatePercent !== undefined
      ? product.taxRatePercent
      : settings?.defaultVatRate ?? 13;

  if (vatRate === 0) return 'Tax Exempt';
  const isInclusive =
    product.isTaxInclusive !== undefined
      ? product.isTaxInclusive
      : settings?.taxInclusivePricing !== false;

  return `${vatRate}% VAT ${isInclusive ? 'Inc.' : 'Exc.'}`;
};
