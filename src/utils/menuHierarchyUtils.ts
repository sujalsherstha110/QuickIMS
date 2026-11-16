import { Product } from '../types';

export interface HierarchyConfig {
  departments: string[];
  categories: Record<string, string[]>;
  subCategories: Record<string, string[]>;
  prepStyles: Record<string, string[]>;
  categoryColors: Record<string, string>;
  _sanitizedOnce?: boolean;
}

export const HIERARCHY_STORAGE_KEY = 'quickims_menu_hierarchy_v5';

export const DEFAULT_HIERARCHY: HierarchyConfig = {
  departments: ['Food', 'Drink'],
  categories: {
    Food: [],
    Drink: []
  },
  subCategories: {},
  prepStyles: {},
  categoryColors: {},
  _sanitizedOnce: true
};

export const FRESH_BEANS_DEFAULT_HIERARCHY: HierarchyConfig = {
  departments: ['Food', 'Drink', 'Others'],
  categories: {
    Food: [
      'All Time Favourites',
      'Desserts & Ice Cream',
      'Tacos',
      'Mo:Mo',
      'Non Veg Snacks',
      'Veg Snacks',
      'Pizza',
      'Burger & Sandwiches',
      'Salad',
      'Soup',
      'Pasta',
      'Breakfast'
    ],
    Drink: [
      'Brewed Coffee',
      'Hot Tea',
      'Fruits Tea',
      'Herbal Tea',
      'Matcha',
      'Blended',
      'Milk Shakes',
      'Lassi',
      'Smoothies',
      'Alternatives',
      'Mocktails',
      'Cocktails',
      'Beers',
      'Hot Coffee',
      'Cold Coffee',
      'Cold Beverage'
    ],
    Others: ['Cigarettes', 'Hookah']
  },
  subCategories: {},
  prepStyles: {},
  categoryColors: {}
};

export const FRESH_BEANS_PRESET_CATEGORIES = new Set<string>([
  'All Time Favourites',
  'Desserts & Ice Cream',
  'Tacos',
  'Mo:Mo',
  'Non Veg Snacks',
  'Veg Snacks',
  'Pizza',
  'Burger & Sandwiches',
  'Salad',
  'Soup',
  'Pasta',
  'Breakfast',
  'Brewed Coffee',
  'Hot Tea',
  'Fruits Tea',
  'Herbal Tea',
  'Matcha',
  'Blended',
  'Milk Shakes',
  'Lassi',
  'Smoothies',
  'Alternatives',
  'Mocktails',
  'Cocktails',
  'Beers',
  'Hot Coffee',
  'Cold Coffee',
  'Cold Beverage',
  'Cigarettes',
  'Hookah'
]);

export function getInitialHierarchyForTenant(restaurantId?: string): HierarchyConfig {
  if (restaurantId === 'restro_freshbeans110_gmail_com' || restaurantId === 'restro_demo_preview') {
    return FRESH_BEANS_DEFAULT_HIERARCHY;
  }
  return DEFAULT_HIERARCHY;
}

export function sanitizeMenuHierarchyForTenant(
  rawHierarchy: any,
  currentProducts: Product[],
  tenantId?: string
): { cleaned: HierarchyConfig | null; wasPolluted: boolean } {
  if (!rawHierarchy || !Array.isArray(rawHierarchy.departments)) {
    return { cleaned: rawHierarchy, wasPolluted: false };
  }
  if (tenantId === 'restro_freshbeans110_gmail_com' || tenantId === 'restro_demo_preview') {
    return { cleaned: rawHierarchy, wasPolluted: false };
  }

  const usedCategories = new Set<string>();
  const usedDepartments = new Set<string>();
  (currentProducts || []).forEach(p => {
    if (p && p.status !== 'discontinued' && p.name) {
      if (p.category) usedCategories.add(String(p.category).trim());
      if (p.department) usedDepartments.add(String(p.department).trim());
    }
  });

  const rawCategories = rawHierarchy.categories || {};
  let unusedPresetCount = 0;
  Object.values(rawCategories).forEach((catList: any) => {
    if (Array.isArray(catList)) {
      catList.forEach((cat: string) => {
        const cleanCat = String(cat || '').trim();
        if (FRESH_BEANS_PRESET_CATEGORIES.has(cleanCat) && !usedCategories.has(cleanCat)) {
          unusedPresetCount++;
        }
      });
    }
  });

  const isAlreadySanitized = rawHierarchy._sanitizedOnce === true;
  const hasUnusedOthersDept = rawHierarchy.departments.includes('Others') && !usedDepartments.has('Others') && (!Array.isArray(rawCategories['Others']) || rawCategories['Others'].every((c: string) => FRESH_BEANS_PRESET_CATEGORIES.has(String(c || '').trim()) && !usedCategories.has(String(c || '').trim())));

  // If never sanitized before, strip any unused Fresh Beans presets (>= 1) or unused 'Others' dept;
  // even if sanitized before, still catch bulk preset leaks (>= 3 unused presets).
  if ((isAlreadySanitized && unusedPresetCount < 3 && !hasUnusedOthersDept) || (!isAlreadySanitized && unusedPresetCount === 0 && !hasUnusedOthersDept)) {
    return { cleaned: rawHierarchy, wasPolluted: false };
  }

  const removedCategories = new Set<string>();
  const nextCategories: Record<string, string[]> = {};
  Object.keys(rawCategories).forEach(dept => {
    const list = Array.isArray(rawCategories[dept]) ? rawCategories[dept] : [];
    nextCategories[dept] = list.filter((cat: string) => {
      const cleanCat = String(cat || '').trim();
      if (FRESH_BEANS_PRESET_CATEGORIES.has(cleanCat) && !usedCategories.has(cleanCat)) {
        removedCategories.add(cleanCat);
        return false;
      }
      return true;
    });
  });

  let nextDepartments: string[] = [...rawHierarchy.departments];
  if (nextDepartments.includes('Others') && (!nextCategories['Others'] || nextCategories['Others'].length === 0) && !usedDepartments.has('Others')) {
    nextDepartments = nextDepartments.filter(d => d !== 'Others');
    delete nextCategories['Others'];
  }
  if (nextDepartments.length === 0) {
    nextDepartments = ['Food', 'Drink'];
  }
  nextDepartments.forEach(d => {
    if (!nextCategories[d]) nextCategories[d] = [];
  });

  const nextSubCategories = { ...(rawHierarchy.subCategories || {}) };
  const nextPrepStyles = { ...(rawHierarchy.prepStyles || {}) };
  const nextCategoryColors = { ...(rawHierarchy.categoryColors || {}) };
  removedCategories.forEach(c => {
    delete nextSubCategories[c];
    delete nextPrepStyles[c];
    delete nextCategoryColors[c];
  });

  return {
    cleaned: {
      departments: nextDepartments,
      categories: nextCategories,
      subCategories: nextSubCategories,
      prepStyles: nextPrepStyles,
      categoryColors: nextCategoryColors,
      _sanitizedOnce: true
    },
    wasPolluted: true
  };
}
