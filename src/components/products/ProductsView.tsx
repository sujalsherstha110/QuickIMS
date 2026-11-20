import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Filter, Edit, Trash2, Tag, 
  Warehouse as WarehouseIcon, Package, QrCode, AlertTriangle, 
  ChevronRight, Check, X, ShieldAlert, SlidersHorizontal,
  CheckCircle2, RefreshCw, Layers, ArrowUpRight, RotateCcw, FolderPlus, Upload,
  ChefHat, Wine, Sparkles, Boxes, FileText, Lock, Unlock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, UnitConversion, ProductCategory, RecipeIngredient } from '../../types';
import { formatNPR, formatStockInUnits } from '../../utils/nepalFormatters';
import { 
  generateUniqueSKU, 
  generateUniqueBarcode, 
  checkSkuDuplicate, 
  checkBarcodeDuplicate 
} from '../../utils/codeGenerator';
import { StatusBadge } from '../common/StatCard';
import { Button } from '../common/Button';
import { CategoryManagerModal } from './CategoryManagerModal';
import { MenuArchitectureManager } from './MenuArchitectureManager';
import { 
  HierarchyConfig, 
  DEFAULT_HIERARCHY, 
  getInitialHierarchyForTenant,
  sanitizeMenuHierarchyForTenant,
  HIERARCHY_STORAGE_KEY 
} from '../../utils/menuHierarchyUtils';

export const ProductsView: React.FC = () => {
  const { 
    products, addProduct, updateProduct, deleteProduct, 
    categories: categoryDefinitions, units, suppliers, warehouses, currentWarehouseId,
    menuHierarchy, restaurantId, canStaffDo
  } = useApp();

  const canCreateMenu = canStaffDo('menuCatalog', 'write');
  const canUpdateMenu = canStaffDo('menuCatalog', 'update');
  const canDeleteMenu = canStaffDo('menuCatalog', 'delete');

  const [viewMode, setViewMode] = useState<'hierarchy' | 'table'>('hierarchy');
  const [menuStudioTab, setMenuStudioTab] = useState<'browse' | 'master' | 'bulk'>('browse');
  const [selectedMenuStudioItemId, setSelectedMenuStudioItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all_active' | 'low_stock' | 'discontinued' | 'all'>('all_active');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<'menu' | 'recipe' | 'inventory'>('menu');
  const [allowEditSkuBarcode, setAllowEditSkuBarcode] = useState(false);
  const [costBasis, setCostBasis] = useState<'bom' | 'manual'>('manual');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Custom Addons builder state
  const [tempAddonName, setTempAddonName] = useState('');
  const [tempAddonPrice, setTempAddonPrice] = useState<number>(30);

  // Quick Add Modal for Hierarchy (Department, Sub-Category, Prep Style)
  const [quickAddHierarchyModal, setQuickAddHierarchyModal] = useState<{
    open: boolean;
    level: 'dept' | 'subCat' | 'prepStyle';
    title: string;
    description: string;
  }>({
    open: false,
    level: 'dept',
    title: '',
    description: ''
  });
  const [quickHierarchyInput, setQuickHierarchyInput] = useState('');

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    department: 'Food',
    orderRoutingStation: 'kitchen' as 'kitchen' | 'bar',
    category: '',
    subCategory: 'General',
    prepStyle: 'Standard',
    dietaryType: 'none' as 'veg' | 'non_veg' | 'vegan' | 'none',
    tileColor: '#2563eb',
    subcategory: '',
    brand: 'In-House Kitchen',
    hsCode: '',
    supplierId: '',
    baseUnit: 'Portion',
    baseUnitSymbol: 'portion',
    alternativeUnits: [] as UnitConversion[],
    costPrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
    dealerPrice: 0,
    taxRatePercent: 13,
    isTaxInclusive: true,
    currentStock: 0,
    reorderLevel: 0,
    warehouseId: 'wh-kitchen',
    locationBin: '',
    hasVariants: false,
    warrantyMonths: 0,
    status: 'active' as 'active' | 'inactive' | 'discontinued',
    customAddons: [] as { name: string; price: number }[],
    recipeIngredients: [] as RecipeIngredient[],
    trackStock: false
  });



  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const [hierarchy, setHierarchy] = useState<HierarchyConfig>(() => {
    try {
      const cached = localStorage.getItem(HIERARCHY_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.departments && parsed.categories) {
          const base = {
            departments: Array.isArray(parsed.departments) && parsed.departments.length > 0 ? parsed.departments : DEFAULT_HIERARCHY.departments,
            categories: parsed.categories || DEFAULT_HIERARCHY.categories,
            subCategories: parsed.subCategories || {},
            prepStyles: parsed.prepStyles || {},
            categoryColors: parsed.categoryColors || {}
          };
          const { cleaned } = sanitizeMenuHierarchyForTenant(base, products || [], restaurantId);
          return cleaned || base;
        }
      }
    } catch (e) {}
    if (menuHierarchy && menuHierarchy.departments) {
      const base = {
        departments: menuHierarchy.departments || DEFAULT_HIERARCHY.departments,
        categories: menuHierarchy.categories || DEFAULT_HIERARCHY.categories,
        subCategories: menuHierarchy.subCategories || {},
        prepStyles: menuHierarchy.prepStyles || {},
        categoryColors: menuHierarchy.categoryColors || {}
      };
      const { cleaned } = sanitizeMenuHierarchyForTenant(base, products || [], restaurantId);
      return cleaned || base;
    }
    return getInitialHierarchyForTenant(restaurantId);
  });

  const persistHierarchy = (updater: (prev: HierarchyConfig) => HierarchyConfig) => {
    setHierarchy(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem(HIERARCHY_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to cache hierarchy:', e);
      }
      return next;
    });
  };

  useEffect(() => {
    if (menuHierarchy && Array.isArray(menuHierarchy.departments) && menuHierarchy.departments.length > 0) {
      const { cleaned } = sanitizeMenuHierarchyForTenant(menuHierarchy, products || [], restaurantId);
      const effective = cleaned || menuHierarchy;
      setHierarchy({
        departments: effective.departments,
        categories: effective.categories || DEFAULT_HIERARCHY.categories,
        subCategories: effective.subCategories || {},
        prepStyles: effective.prepStyles || {},
        categoryColors: effective.categoryColors || {}
      });
    } else {
      setHierarchy(getInitialHierarchyForTenant(restaurantId));
    }
  }, [restaurantId, menuHierarchy, products]);

  // Actual raw ingredients from inventory for Recipe BOM mapping
  const rawIngredients = useMemo(() => {
    return (products || []).filter(p => p && (p.itemType === 'raw_ingredient' || (!p.itemType && String(p.category || '').toLowerCase().includes('raw'))));
  }, [products]);

  const rawIngredientCategories = useMemo(() => {
    const set = new Set<string>();
    rawIngredients.forEach(r => { if (r.category) set.add(r.category); });
    return Array.from(set);
  }, [rawIngredients]);

  // Total Recipe BOM Cost & Food Cost % calculation
  const totalBOMCost = useMemo(() => {
    return (formData.recipeIngredients || []).reduce((sum, ing) => sum + (ing.totalCost || 0), 0);
  }, [formData.recipeIngredients]);

  const foodCostPercent = useMemo(() => {
    return (Number(formData.retailPrice) > 0 && totalBOMCost > 0) ? Math.round((totalBOMCost / Number(formData.retailPrice)) * 100) : 0;
  }, [totalBOMCost, formData.retailPrice]);

  // Keep cost price synced with Recipe BOM if costBasis is 'bom'
  useEffect(() => {
    if (costBasis === 'bom' && totalBOMCost > 0) {
      setFormData(prev => ({ ...prev, costPrice: totalBOMCost }));
    }
  }, [costBasis, totalBOMCost]);

  // Recipe Ingredient Handlers
  const handleAddRecipeIngredient = () => {
    const newIng: RecipeIngredient = {
      ingredientId: '',
      ingredientName: '',
      quantityRequired: 0,
      unit: 'kg',
      costPerUnit: 0,
      totalCost: 0
    };
    setFormData(prev => ({
      ...prev,
      recipeIngredients: [...prev.recipeIngredients, newIng]
    }));
  };

  const handleUpdateRecipeIngredient = (index: number, updates: Partial<RecipeIngredient>) => {
    setFormData(prev => {
      const updated = [...prev.recipeIngredients];
      const current = updated[index];
      const merged = { ...current, ...updates };
      const qty = typeof merged.quantityRequired === 'number' ? merged.quantityRequired : 0;
      const unitCost = typeof merged.costPerUnit === 'number' ? merged.costPerUnit : 0;
      merged.totalCost = Math.round(qty * unitCost * 10) / 10;
      updated[index] = merged;
      return { ...prev, recipeIngredients: updated };
    });
  };

  const handleRemoveRecipeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipeIngredients: prev.recipeIngredients.filter((_, i) => i !== index)
    }));
  };

  // Custom Addons Handlers
  const handleAddAddon = () => {
    if (!tempAddonName.trim()) return;
    setFormData(prev => ({
      ...prev,
      customAddons: [...prev.customAddons, { name: tempAddonName.trim(), price: tempAddonPrice }]
    }));
    setTempAddonName('');
    setTempAddonPrice(30);
  };

  const handleRemoveAddon = (index: number) => {
    setFormData(prev => ({
      ...prev,
      customAddons: prev.customAddons.filter((_, i) => i !== index)
    }));
  };

  // Quick Add for Department, Sub-Category, Prep Style
  const handleQuickAddHierarchy = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickHierarchyInput.trim();
    if (!clean) return;

    if (quickAddHierarchyModal.level === 'dept') {
      persistHierarchy(prev => {
        const depts = prev.departments || [];
        if (depts.includes(clean)) return prev;
        return {
          ...prev,
          departments: [...depts, clean],
          categories: { ...prev.categories, [clean]: prev.categories[clean] || [] }
        };
      });
      setFormData(prev => ({
        ...prev,
        department: clean,
        orderRoutingStation: clean.toLowerCase().includes('drink') || clean.toLowerCase().includes('bar') || clean.toLowerCase().includes('beverage') ? 'bar' : prev.orderRoutingStation
      }));
      showToast(`Added new department "${clean}"`, 'success');
    } else if (quickAddHierarchyModal.level === 'subCat') {
      const parentCat = formData.category || 'General';
      persistHierarchy(prev => {
        const existing = prev.subCategories[parentCat] || [];
        if (existing.includes(clean)) return prev;
        return {
          ...prev,
          subCategories: {
            ...prev.subCategories,
            [parentCat]: [...existing, clean]
          }
        };
      });
      setFormData(prev => ({ ...prev, subCategory: clean, subcategory: clean }));
      showToast(`Added sub-category "${clean}" to ${parentCat}`, 'success');
    } else if (quickAddHierarchyModal.level === 'prepStyle') {
      const parentCat = formData.category || 'General';
      persistHierarchy(prev => {
        const existing = prev.prepStyles[parentCat] || [];
        if (existing.includes(clean)) return prev;
        return {
          ...prev,
          prepStyles: {
            ...prev.prepStyles,
            [parentCat]: [...existing, clean]
          }
        };
      });
      setFormData(prev => ({ ...prev, prepStyle: clean }));
      showToast(`Added prep style "${clean}" to ${parentCat}`, 'success');
    }

    setQuickAddHierarchyModal({ open: false, level: 'dept', title: '', description: '' });
    setQuickHierarchyInput('');
  };



  const categories = useMemo(() => {
    const list = new Set<string>();
    (categoryDefinitions || []).forEach(c => { if (c?.name) list.add(c.name); });
    (products || []).forEach(p => { if (p?.category) list.add(p.category); });
    return ['ALL', ...Array.from(list)];
  }, [categoryDefinitions, products]);

  const brands = useMemo(() => {
    return ['ALL', ...Array.from(new Set((products || []).map(p => p?.brand).filter(Boolean)))];
  }, [products]);

  // Real-time Duplicate Detection
  const skuDuplicate = useMemo(() => {
    return checkSkuDuplicate(formData.sku, products || [], editingProduct?.id);
  }, [formData.sku, products, editingProduct]);

  const barcodeDuplicate = useMemo(() => {
    return checkBarcodeDuplicate(formData.barcode, products || [], editingProduct?.id);
  }, [formData.barcode, products, editingProduct]);

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => {
      if (!p) return false;
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchBrand = selectedBrand === 'ALL' || p.brand === selectedBrand;
      const q = String(searchQuery || '').toLowerCase();
      const matchSearch = 
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.sku || '').toLowerCase().includes(q) ||
        String(p.barcode || '').includes(searchQuery);

      let matchStatus = true;
      const currentStock = p.currentStock ?? 0;
      const reorderLevel = p.reorderLevel ?? 0;
      const isTracked = p.itemType === 'raw_ingredient' || p.trackStock === true;
      if (statusFilter === 'all_active') {
        matchStatus = p.status !== 'discontinued';
      } else if (statusFilter === 'low_stock') {
        matchStatus = isTracked && p.status !== 'discontinued' && currentStock <= reorderLevel;
      } else if (statusFilter === 'discontinued') {
        matchStatus = p.status === 'discontinued';
      }

      return matchCat && matchBrand && matchSearch && matchStatus;
    });
  }, [products, selectedCategory, selectedBrand, searchQuery, statusFilter]);

  const lowStockAlertsCount = useMemo(() => {
    return (products || []).filter(p => p && p.status !== 'discontinued' && (p.itemType === 'raw_ingredient' || p.trackStock === true) && (p.currentStock ?? 0) <= (p.reorderLevel ?? 0)).length;
  }, [products]);

  const legacyTrackedLowStockMenuItems = useMemo(() => {
    return (products || []).filter(p => p && p.status !== 'discontinued' && p.itemType !== 'raw_ingredient' && p.trackStock === true && (p.currentStock ?? 0) <= (p.reorderLevel ?? 0));
  }, [products]);

  const [isConvertingUnlimited, setIsConvertingUnlimited] = useState(false);
  const handleConvertLegacyMenuUnlimited = async () => {
    if (!canUpdateMenu || legacyTrackedLowStockMenuItems.length === 0 || isConvertingUnlimited) return;
    setIsConvertingUnlimited(true);
    try {
      await Promise.all(
        legacyTrackedLowStockMenuItems.map(item =>
          updateProduct(item.id, { trackStock: false, currentStock: 0, reorderLevel: 0 })
        )
      );
      showToast(`Converted ${legacyTrackedLowStockMenuItems.length} menu item(s) to ∞ Unlimited mode!`, 'success');
    } catch (err: any) {
      showToast(`Could not convert items: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsConvertingUnlimited(false);
    }
  };

  const handleOpenAdd = () => {
    if (!canCreateMenu) return;
    setEditingProduct(null);
    setModalActiveTab('menu');
    setAllowEditSkuBarcode(false);
    const defaultDept = hierarchy.departments[0] || 'Food';
    const defaultCat = hierarchy.categories[defaultDept]?.[0] || categoryDefinitions[0]?.name || '';
    const defaultSub = hierarchy.subCategories[defaultCat]?.[0] || 'General';
    const defaultPrep = hierarchy.prepStyles[defaultCat]?.[0] || 'Standard';
    const defaultSupplier = suppliers[0]?.id || '';
    const defaultWarehouse = warehouses.find(w => w.id === currentWarehouseId)?.id || warehouses[0]?.id || 'wh-kitchen';
    const defaultUnit = units.find(u => u.name === 'Portion' || u.name === 'Plate')?.name || units[0]?.name || 'Portion';
    const defaultUnitSymbol = units.find(u => u.name === 'Portion' || u.name === 'Plate')?.symbol || units[0]?.symbol || 'portion';
    const defaultBrand = 'In-House Kitchen';

    const autoSku = generateUniqueSKU(defaultCat, defaultBrand, products);
    const autoBarcode = generateUniqueBarcode(products);

    setFormData({
      sku: autoSku,
      barcode: autoBarcode,
      name: '',
      department: defaultDept,
      orderRoutingStation: 'kitchen',
      category: defaultCat,
      subCategory: defaultSub,
      prepStyle: defaultPrep,
      dietaryType: 'none',
      tileColor: hierarchy.categoryColors[defaultCat] || '#2563eb',
      subcategory: defaultSub,
      brand: defaultBrand,
      hsCode: '',
      supplierId: defaultSupplier,
      baseUnit: defaultUnit,
      baseUnitSymbol: defaultUnitSymbol,
      alternativeUnits: [],
      costPrice: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      dealerPrice: 0,
      taxRatePercent: 13,
      isTaxInclusive: true,
      currentStock: 0,
      reorderLevel: 0,
      warehouseId: defaultWarehouse,
      locationBin: 'Kitchen Prep',
      hasVariants: false,
      warrantyMonths: 0,
      status: 'active',
      customAddons: [],
      recipeIngredients: [],
      trackStock: false
    });
    setCostBasis('manual');
    setShowAddModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    if (!canUpdateMenu) return;
    setEditingProduct(product);
    setModalActiveTab('menu');
    setAllowEditSkuBarcode(false);

    const isBar = product.orderRoutingStation === 'bar' || (!product.orderRoutingStation && (product.department === 'Drink' || product.itemType === 'beverage' || (product.category && /bar|drink|beverage|wine|cocktail|beer|liquor|coffee/i.test(product.category))));
    const resolvedDept = product.department || (isBar ? 'Drink' : 'Food');
    const resolvedStation = product.orderRoutingStation || (isBar ? 'bar' : 'kitchen');
    const resolvedCat = product.category || (hierarchy.categories[resolvedDept]?.[0] || '');
    const resolvedSub = product.subCategory || product.subcategory || (hierarchy.subCategories[resolvedCat]?.[0] || 'General');
    const resolvedPrep = product.prepStyle || (hierarchy.prepStyles[resolvedCat]?.[0] || 'Standard');

    const hasBOM = Array.isArray(product.recipeIngredients) && product.recipeIngredients.length > 0;
    const bomSum = hasBOM ? (product.recipeIngredients || []).reduce((s, i) => s + (i.totalCost || 0), 0) : 0;
    const isBOMCost = hasBOM && bomSum > 0 && Math.abs(bomSum - (product.costPrice || 0)) < 0.1;
    setCostBasis(isBOMCost ? 'bom' : 'manual');

    setFormData({
      sku: product.sku || generateUniqueSKU(resolvedCat, product.brand || 'In-House Kitchen', products, product.id),
      barcode: product.barcode || generateUniqueBarcode(products, product.id),
      name: product.name || '',
      department: resolvedDept,
      orderRoutingStation: resolvedStation,
      category: resolvedCat,
      subCategory: resolvedSub,
      prepStyle: resolvedPrep,
      dietaryType: (product.dietaryType as any) || 'none',
      tileColor: product.tileColor || hierarchy.categoryColors[resolvedCat] || '#2563eb',
      subcategory: resolvedSub,
      brand: product.brand || 'In-House Kitchen',
      hsCode: product.hsCode || '',
      supplierId: product.supplierId || suppliers[0]?.id || '',
      baseUnit: product.baseUnit || (resolvedStation === 'bar' ? 'Bottle/Glass' : 'Portion'),
      baseUnitSymbol: product.baseUnitSymbol || (resolvedStation === 'bar' ? 'btl' : 'portion'),
      alternativeUnits: Array.isArray(product.alternativeUnits) ? [...product.alternativeUnits] : [],
      costPrice: product.costPrice || 0,
      retailPrice: product.retailPrice || 0,
      wholesalePrice: product.wholesalePrice || product.retailPrice || 0,
      dealerPrice: product.dealerPrice || 0,
      taxRatePercent: product.taxRatePercent !== undefined ? product.taxRatePercent : 13,
      isTaxInclusive: product.isTaxInclusive !== false,
      currentStock: product.currentStock || 0,
      reorderLevel: product.reorderLevel ?? 0,
      warehouseId: product.warehouseId || warehouses[0]?.id || 'wh-kitchen',
      locationBin: product.locationBin || '',
      hasVariants: !!product.hasVariants,
      warrantyMonths: product.warrantyMonths || 0,
      status: product.status || 'active',
      customAddons: Array.isArray(product.customAddons) ? [...product.customAddons] : [],
      recipeIngredients: Array.isArray(product.recipeIngredients) ? [...product.recipeIngredients] : [],
      trackStock: product.itemType === 'raw_ingredient' ? product.trackStock !== false : product.trackStock === true
    });
    setShowAddModal(true);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct ? !canUpdateMenu : !canCreateMenu) return;
    if (!formData.name.trim() || !formData.sku.trim()) {
      showToast('Please provide Product Name and SKU Code.', 'error');
      return;
    }

    if (skuDuplicate) {
      showToast(`Cannot save: SKU "${formData.sku}" is already assigned to "${skuDuplicate.name}".`, 'error');
      return;
    }

    if (barcodeDuplicate) {
      showToast(`Cannot save: Barcode "${formData.barcode}" is already assigned to "${barcodeDuplicate.name}".`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const supplierObj = suppliers.find(s => s.id === formData.supplierId);
      const whObj = warehouses.find(w => w.id === formData.warehouseId);

      const supplierName = supplierObj ? (supplierObj.companyName || supplierObj.name) : 'Authorized Distributor';
      const warehouseName = whObj ? whObj.name : 'Main Kitchen';
      const calculatedCost = costBasis === 'bom' && totalBOMCost > 0 ? totalBOMCost : Number(formData.costPrice || 0);

      const payload = {
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim(),
        name: formData.name.trim(),
        department: formData.department,
        orderRoutingStation: formData.orderRoutingStation,
        category: formData.category,
        subCategory: formData.subCategory,
        subcategory: formData.subCategory || formData.subcategory,
        prepStyle: formData.prepStyle,
        dietaryType: formData.dietaryType === 'none' ? undefined : (formData.dietaryType as any),
        tileColor: formData.tileColor || '#2563eb',
        brand: formData.brand.trim() || 'In-House Kitchen',
        hsCode: formData.hsCode.trim(),
        supplierId: formData.supplierId,
        supplierName,
        baseUnit: formData.baseUnit,
        baseUnitSymbol: formData.baseUnitSymbol,
        alternativeUnits: formData.alternativeUnits,
        costPrice: calculatedCost,
        retailPrice: Number(formData.retailPrice) || 0,
        wholesalePrice: Number(formData.retailPrice) || 0,
        dealerPrice: Number(formData.retailPrice) || 0,
        taxRatePercent: Number(formData.taxRatePercent),
        isTaxInclusive: formData.isTaxInclusive !== false,
        currentStock: Number(formData.currentStock),
        reorderLevel: Number(formData.reorderLevel),
        warehouseId: formData.warehouseId,
        warehouseName,
        locationBin: formData.locationBin.trim() || '',
        hasVariants: formData.hasVariants,
        warrantyMonths: Number(formData.warrantyMonths),
        status: formData.status,
        customAddons: formData.customAddons,
        recipeIngredients: formData.recipeIngredients,
        trackStock: formData.trackStock
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        showToast(`Menu item "${formData.name}" updated successfully!`, 'success');
      } else {
        await addProduct(payload);
        showToast(`New menu item "${formData.name}" registered successfully!`, 'success');
      }

      setShowAddModal(false);
      setEditingProduct(null);
    } catch (err) {
      console.error('Failed to save product:', err);
      showToast('Error saving product item. Please check the inputs.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!canDeleteMenu || !productToDelete) return;
    try {
      await deleteProduct(productToDelete.id, false);
      showToast(`Product "${productToDelete.name}" was deactivated (discontinued).`, 'info');
      setProductToDelete(null);
    } catch (err) {
      console.error('Deactivation error:', err);
      showToast('Failed to deactivate product.', 'error');
    }
  };

  const handlePermanentDelete = async () => {
    if (!canDeleteMenu || !productToDelete) return;
    try {
      await deleteProduct(productToDelete.id, true);
      showToast(`Product "${productToDelete.name}" permanently deleted.`, 'success');
      setProductToDelete(null);
    } catch (err) {
      console.error('Permanent delete error:', err);
      showToast('Failed to delete product.', 'error');
    }
  };

  const handleReactivate = async (product: Product) => {
    if (!canUpdateMenu) return;
    try {
      await updateProduct(product.id, { status: 'active' });
      showToast(`Product "${product.name}" reactivated!`, 'success');
    } catch (err) {
      console.error('Reactivation error:', err);
      showToast('Failed to reactivate product.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`p-3 rounded-xl flex items-center justify-between text-xs font-semibold shadow-md transition-all ${
          notification.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' :
          notification.type === 'error' ? 'bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300' :
          'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Switcher: Hierarchy Architecture (4-Level Division) vs Inventory Catalog */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setViewMode('hierarchy')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            viewMode === 'hierarchy'
              ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/20 inset'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Menu Studio</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('table')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            viewMode === 'table'
              ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/20 inset'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Full Menu & Stock Catalog Table</span>
        </button>
      </div>

      {viewMode === 'hierarchy' ? (
        <MenuArchitectureManager 
          initialTab={menuStudioTab} 
          initialItemId={selectedMenuStudioItemId || undefined} 
        />
      ) : (
        <>
          {/* Top Header & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                Menu Items & Inventory Catalog
              </h1>
              <p className="text-2xs text-slate-500">
                Kitchen recipes, beverage bar inventory, portion pricing, and ingredient stock.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canCreateMenu && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setMenuStudioTab('bulk');
                    setViewMode('hierarchy');
                  }}
                  icon={<Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                >
                  Bulk Upload Menu
                </Button>
              )}

              {canUpdateMenu && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCategoryModal(true)}
                  icon={<Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                >
                  <span>Manage Categories</span>
                  <span className="ml-1.5 px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded text-3xs font-bold font-mono">
                    {(categoryDefinitions || []).length}
                  </span>
                </Button>
              )}

              {canCreateMenu && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenAdd}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create Item
                </Button>
              )}
            </div>
          </div>

      {/* Filter, Search & Status Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all_active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all_active'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Active Products ({(products || []).filter(p => p && p.status !== 'discontinued').length})
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'low_stock'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Low Stock Alerts ({lowStockAlertsCount})
            </button>
            <button
              onClick={() => setStatusFilter('discontinued')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'discontinued'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Discontinued ({(products || []).filter(p => p && p.status === 'discontinued').length})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Items ({(products || []).length})
            </button>
          </div>

          <span className="text-3xs text-slate-400 font-mono">
            Showing {(filteredProducts || []).length} results
          </span>
        </div>

        {legacyTrackedLowStockMenuItems.length > 0 && canUpdateMenu && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 text-xs">
            <span className="text-teal-900 dark:text-teal-200 font-medium">
              <strong>{legacyTrackedLowStockMenuItems.length}</strong> menu dish(es) currently have stock tracking ON at Low/Zero stock.
            </span>
            <button
              type="button"
              onClick={handleConvertLegacyMenuUnlimited}
              disabled={isConvertingUnlimited}
              className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isConvertingUnlimited ? 'Switching...' : 'Switch All to ∞ Unlimited Mode'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search by product name, SKU, or Barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium outline-hidden"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
              ))}
            </select>

            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium outline-hidden"
            >
              {brands.map(b => (
                <option key={b} value={b}>{b === 'ALL' ? 'All Brands' : b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Products Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 min-w-[240px]">Product / SKU</th>
                <th className="px-4 py-3">Category & Brand</th>
                <th className="px-4 py-3">Unit System</th>
                <th className="px-4 py-3 text-right">Cost Price</th>
                <th className="px-4 py-3 text-right">Retail Rate</th>
                <th className="px-4 py-3 text-center">Current Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="font-semibold text-xs text-slate-600 dark:text-slate-400">No products found matching criteria</p>
                    {canCreateMenu && (
                      <button
                        onClick={handleOpenAdd}
                        className="mt-2 px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-2xs font-semibold hover:bg-blue-100"
                      >
                        + Create First Item
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  if (!product) return null;
                  const currentStock = product.currentStock ?? 0;
                  const reorderLevel = product.reorderLevel ?? 0;
                  const isTracked = product.itemType === 'raw_ingredient' || product.trackStock === true;
                  const isLowStock = isTracked && product.status !== 'discontinued' && currentStock <= reorderLevel;
                  const formattedStock = formatStockInUnits(
                    currentStock, 
                    product.baseUnitSymbol || 'portion', 
                    Array.isArray(product.alternativeUnits) ? product.alternativeUnits : []
                  );

                  const isBar = product.orderRoutingStation === 'bar' || (!product.orderRoutingStation && (product.department === 'Drink' || product.itemType === 'beverage' || (product.category && /bar|drink|beverage|wine|cocktail|beer|liquor/i.test(product.category))));

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 min-w-[240px]">
                        {/* 1. Item name taking horizontal space */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                            {product.name || 'Unnamed Dish'}
                          </span>
                          {product.itemType === 'raw_ingredient' && (
                            <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 shrink-0">
                              Raw Stock
                            </span>
                          )}
                        </div>

                        {/* 2. Below that, put the label whether it is kitchen/Bar depending on the menu item */}
                        <div className="mt-1 flex items-center gap-1.5">
                          {isBar ? (
                            <span className="text-3xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1" title="Routed to Bar (BOT)">
                              Bar
                            </span>
                          ) : (
                            <span className="text-3xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1" title="Routed to Kitchen (KDS)">
                              Kitchen
                            </span>
                          )}
                        </div>

                        {/* 3. Below that, SKU number with indication of 13% vat (Inc. or not) — no barcode number */}
                        <div className="flex items-center gap-2 mt-1 text-3xs font-mono text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            SKU: {product.sku || 'N/A'}
                          </span>
                          {product.hsCode && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 dark:text-blue-400 font-medium">HS: {product.hsCode}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className={product.taxRatePercent === 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400 font-semibold"}>
                            {product.taxRatePercent === 0 ? '0% Tax Exempt' : (product.isTaxInclusive !== false ? '13% VAT (Inc.)' : '13% VAT (Excl.)')}
                          </span>
                        </div>

                        {Array.isArray(product.recipeIngredients) && product.recipeIngredients.length > 0 && (
                          <div className="mt-1 text-3xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            <span className="font-medium text-slate-600 dark:text-slate-300">Recipe: </span>
                            {product.recipeIngredients
                              .filter(Boolean)
                              .map(i => `${i.ingredientName || 'Ingredient'} (${i.quantityRequired ?? 0} ${i.unit || ''})`)
                              .join(', ')}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-700 dark:text-slate-300 block">
                          {product.category || 'General'}
                        </span>
                        <span className="text-3xs text-slate-400">
                          {product.brand || 'In-House'} {product.model && `(${product.model})`}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          Base: {product.baseUnit || 'Portion'} ({product.baseUnitSymbol || 'portion'})
                        </div>
                        {Array.isArray(product.alternativeUnits) && product.alternativeUnits.length > 0 && (
                          <div className="text-3xs text-blue-600 dark:text-blue-400 font-mono">
                            {product.alternativeUnits
                              .filter(Boolean)
                              .map(u => `1 ${u.unitName || 'Unit'} = ${u.multiplierToBase ?? 1} ${product.baseUnitSymbol || 'portion'}`)
                              .join(', ')}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-600 dark:text-slate-400">
                        {formatNPR(product.costPrice ?? 0)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatNPR(product.retailPrice ?? 0)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {!isTracked ? (
                          <div>
                            <div className="font-mono font-bold text-xs text-teal-600 dark:text-teal-400">
                              ∞ Unlimited
                            </div>
                            <div className="text-3xs text-slate-500 dark:text-slate-400 font-mono">
                              Served: {product.soldCount || 0} {product.baseUnitSymbol || 'portion'}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={`font-mono font-bold text-xs ${isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                              {currentStock} {product.baseUnitSymbol || 'portion'}
                            </div>
                            {Array.isArray(product.alternativeUnits) && product.alternativeUnits.length > 0 && (
                              <div className="text-3xs text-slate-400 font-mono">
                                {formattedStock}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={product.status === 'discontinued' ? 'discontinued' : (isLowStock ? 'low_stock' : (product.status || 'active'))} />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {product.status === 'discontinued' ? (
                            canUpdateMenu ? (
                              <button
                                onClick={() => handleReactivate(product)}
                                className="px-2 py-1 text-2xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                                title="Reactivate Product"
                              >
                                <RotateCcw className="w-3 h-3" /> Reactivate
                              </button>
                            ) : null
                          ) : (
                            <>
                              {canUpdateMenu && (
                                <button
                                  onClick={() => handleOpenEdit(product)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Edit Menu & Stock Details"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteMenu && (
                                <button
                                  onClick={() => setProductToDelete(product)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Delete or Deactivate Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* MODAL: ADD / EDIT PRODUCT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-6 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div 
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md font-bold text-sm shrink-0 ${formData.orderRoutingStation === 'bar' ? 'bg-amber-600' : 'bg-blue-600'}`}
                >
                  {formData.orderRoutingStation === 'bar' ? <Wine className="w-5 h-5" /> : <ChefHat className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                      {editingProduct ? 'Edit Menu Item & Specifications' : 'Register New Menu Item'}
                    </h3>
                    <span className="text-3xs px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase">
                      {formData.orderRoutingStation === 'bar' ? 'Bar / BOT' : 'Kitchen / KOT'}
                    </span>
                  </div>
                  <p className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {editingProduct 
                      ? `SKU: ${formData.sku} • Dept: ${formData.department} / ${formData.category} • Station: ${formData.orderRoutingStation.toUpperCase()}`
                      : 'Configure menu hierarchy, recipe ingredients, 13% VAT, tiered pricing & inventory.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">

                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl shrink-0 border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalActiveTab('menu')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  modalActiveTab === 'menu'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>1. Menu, Hierarchy &amp; SKU</span>
                {formData.customAddons.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-3xs font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    +{formData.customAddons.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('recipe')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  modalActiveTab === 'recipe'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>2. Recipe BOM &amp; Costing</span>
                {formData.recipeIngredients.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-3xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {formData.recipeIngredients.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('inventory')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  modalActiveTab === 'inventory'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <WarehouseIcon className="w-3.5 h-3.5" />
                <span>3. Pricing, VAT &amp; Stock</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              
              {/* TAB 1: MENU & HIERARCHY */}
              {modalActiveTab === 'menu' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  
                  {/* Order Routing Station */}
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-2xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block">
                          Order Routing Station *
                        </span>
                        <p className="text-3xs text-slate-500 dark:text-slate-400">
                          Routes order tickets when &quot;KOT / BOT&quot; is fired in POS
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-w-md">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ 
                            ...prev, 
                            orderRoutingStation: 'kitchen',
                            department: prev.department === 'Drink' ? 'Food' : prev.department
                          }));
                        }}
                        className={`p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                          formData.orderRoutingStation === 'kitchen'
                            ? 'bg-white dark:bg-slate-900 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/20'
                            : 'bg-slate-100/70 dark:bg-slate-800/60 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <ChefHat className="w-4 h-4 text-orange-500" />
                        <span>Kitchen (KDS)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ 
                            ...prev, 
                            orderRoutingStation: 'bar',
                            department: prev.department === 'Food' ? 'Drink' : prev.department
                          }));
                        }}
                        className={`p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                          formData.orderRoutingStation === 'bar'
                            ? 'bg-white dark:bg-slate-900 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/20'
                            : 'bg-slate-100/70 dark:bg-slate-800/60 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <Wine className="w-4 h-4 text-amber-500" />
                        <span>Bar / Beverage (BOT)</span>
                      </button>
                    </div>
                  </div>

                  {/* Product Name */}
                  <div>
                    <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Menu Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Buff Steamed Mo:Mo (10 pcs), Virgin Mojito, Chicken Choila"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-bold text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                    />
                  </div>

                  {/* 4-Level Menu Studio Hierarchy: Department, Category, Sub-Category, Prep Style */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-500" />
                        <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          4-Level Menu Studio Hierarchy
                        </h4>
                      </div>
                      <span className="text-3xs text-slate-400">
                        {formData.department} &gt; {formData.category} &gt; {formData.subCategory} &gt; {formData.prepStyle}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Level 1: Department */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-3xs font-semibold text-slate-500">
                            1. Department *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAddHierarchyModal({
                                open: true,
                                level: 'dept',
                                title: 'Add New Department',
                                description: 'Create a top-level department (e.g. Bakery, Combos, Beverages)'
                              });
                              setQuickHierarchyInput('');
                            }}
                            className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                        <select
                          value={formData.department}
                          onChange={(e) => {
                            const newDept = e.target.value;
                            const availCats = hierarchy.categories[newDept] || [];
                            const newCat = availCats[0] || 'General';
                            const newSub = hierarchy.subCategories[newCat]?.[0] || 'General';
                            const newPrep = hierarchy.prepStyles[newCat]?.[0] || 'Standard';
                            setFormData(prev => ({
                              ...prev,
                              department: newDept,
                              category: newCat,
                              subCategory: newSub,
                              prepStyle: newPrep,
                              tileColor: hierarchy.categoryColors[newCat] || prev.tileColor,
                              orderRoutingStation: newDept === 'Drink' ? 'bar' : prev.orderRoutingStation
                            }));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
                        >
                          {(hierarchy.departments || ['Food', 'Drink', 'Dessert']).map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      {/* Level 2: Category */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-3xs font-semibold text-slate-500">
                            2. Category *
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowCategoryModal(true)}
                            className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                        <select
                          value={formData.category}
                          onChange={(e) => {
                            const newCat = e.target.value;
                            const newSub = hierarchy.subCategories[newCat]?.[0] || 'General';
                            const newPrep = hierarchy.prepStyles[newCat]?.[0] || 'Standard';
                            setFormData(prev => ({
                              ...prev,
                              category: newCat,
                              subCategory: newSub,
                              prepStyle: newPrep,
                              tileColor: hierarchy.categoryColors[newCat] || prev.tileColor,
                              sku: generateUniqueSKU(newCat || 'MENU', prev.brand, products, editingProduct?.id)
                            }));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
                        >
                          <option value="">-- Select Category (or click + Add) --</option>
                          {/* Categories from department */}
                          {(hierarchy.categories[formData.department] || []).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          {/* Custom Categories from store definitions if not present */}
                          {categoryDefinitions
                            .filter(cd => !((hierarchy.categories[formData.department] || []).includes(cd.name)))
                            .map(c => (
                              <option key={c.id} value={c.name}>{c.name} [Custom]</option>
                            ))
                          }
                          {/* Fallback */}
                          {formData.category && !((hierarchy.categories[formData.department] || []).includes(formData.category)) && !categoryDefinitions.some(cd => cd.name === formData.category) && (
                            <option value={formData.category}>{formData.category}</option>
                          )}
                        </select>
                      </div>

                      {/* Level 3: Sub-Category */}
                      <div className="col-span-1 sm:col-span-2 md:col-span-2 space-y-1">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-3xs font-semibold text-slate-500">
                            3. Sub-Category
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAddHierarchyModal({
                                open: true,
                                level: 'subCat',
                                title: `Add Sub-Category to "${formData.category || 'General'}"`,
                                description: `Create a sub-category under ${formData.category} (e.g. Steamed, Fried, Sizzler, Gravy)`
                              });
                              setQuickHierarchyInput('');
                            }}
                            className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[42px] items-center">
                          {((hierarchy.subCategories[formData.category] && hierarchy.subCategories[formData.category].length > 0)
                            ? hierarchy.subCategories[formData.category]
                            : ['General']
                          ).map(sub => {
                            const isSelected = (formData.subCategory || 'General') === sub;
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, subCategory: sub, subcategory: sub }))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                }`}
                              >
                                {sub}
                              </button>
                            );
                          })}
                          {formData.subCategory && !(hierarchy.subCategories[formData.category] || ['General']).includes(formData.subCategory) && (
                            <button
                              type="button"
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white border border-blue-600 shadow-2xs"
                            >
                              {formData.subCategory}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAddHierarchyModal({
                                open: true,
                                level: 'subCat',
                                title: `Add Sub-Category to "${formData.category || 'General'}"`,
                                description: `Create a sub-category under ${formData.category}`
                              });
                              setQuickHierarchyInput('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>

                      {/* Level 4: Prep Style */}
                      <div className="col-span-1 sm:col-span-2 md:col-span-2 space-y-1">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-3xs font-semibold text-slate-500">
                            4. Prep Style / Variant
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAddHierarchyModal({
                                open: true,
                                level: 'prepStyle',
                                title: `Add Prep Style to "${formData.category || 'General'}"`,
                                description: `Create a preparation style under ${formData.category} (e.g. Extra Spicy, Medium, Regular)`
                              });
                              setQuickHierarchyInput('');
                            }}
                            className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[42px] items-center">
                          {((hierarchy.prepStyles[formData.category] && hierarchy.prepStyles[formData.category].length > 0)
                            ? hierarchy.prepStyles[formData.category]
                            : ['Standard']
                          ).map(prep => {
                            const isSelected = (formData.prepStyle || 'Standard') === prep;
                            return (
                              <button
                                key={prep}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, prepStyle: prep }))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                }`}
                              >
                                {prep}
                              </button>
                            );
                          })}
                          {formData.prepStyle && !(hierarchy.prepStyles[formData.category] || ['Standard']).includes(formData.prepStyle) && (
                            <button
                              type="button"
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-600 text-white border border-amber-600 shadow-2xs"
                            >
                              {formData.prepStyle}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAddHierarchyModal({
                                open: true,
                                level: 'prepStyle',
                                title: `Add Prep Style to "${formData.category || 'General'}"`,
                                description: `Create a preparation style under ${formData.category}`
                              });
                              setQuickHierarchyInput('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SKU & Barcode Generator with Override Lock */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Item Identification &amp; Barcode
                      </h4>
                      <button
                        type="button"
                        onClick={() => setAllowEditSkuBarcode(prev => !prev)}
                        className="text-3xs flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {allowEditSkuBarcode ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>{allowEditSkuBarcode ? 'Lock Codes' : 'Unlock Custom Edit'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* SKU */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-3xs font-semibold text-slate-500">
                            SKU Code *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const autoSku = generateUniqueSKU(formData.category, formData.brand, products, editingProduct?.id);
                              setFormData(prev => ({ ...prev, sku: autoSku }));
                            }}
                            className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          >
                            Regenerate
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          readOnly={!allowEditSkuBarcode}
                          value={formData.sku}
                          onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                          className={`w-full border rounded-lg p-2 font-mono font-bold text-xs outline-hidden ${
                            allowEditSkuBarcode
                              ? 'bg-white dark:bg-slate-900 border-blue-500 text-blue-700 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        />
                        {skuDuplicate && (
                          <p className="mt-1 text-3xs text-rose-500 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>SKU already exists on &quot;{skuDuplicate.name}&quot;</span>
                          </p>
                        )}
                      </div>

                      {/* Barcode */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-3xs font-semibold text-slate-500">
                            Barcode (EAN-13)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const autoBarcode = generateUniqueBarcode(products, editingProduct?.id);
                              setFormData(prev => ({ ...prev, barcode: autoBarcode }));
                            }}
                            className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          >
                            Regenerate
                          </button>
                        </div>
                        <input
                          type="text"
                          readOnly={!allowEditSkuBarcode}
                          value={formData.barcode}
                          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                          className={`w-full border rounded-lg p-2 font-mono text-xs outline-hidden ${
                            allowEditSkuBarcode
                              ? 'bg-white dark:bg-slate-900 border-blue-500 text-slate-900 dark:text-slate-100'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        />
                        {barcodeDuplicate && (
                          <p className="mt-1 text-3xs text-rose-500 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Barcode duplicate on &quot;{barcodeDuplicate.name}&quot;</span>
                          </p>
                        )}
                      </div>

                      {/* HS Code */}
                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Harmonized System (HS) Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2106.90.99"
                          value={formData.hsCode}
                          onChange={(e) => setFormData({ ...formData, hsCode: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Addons & Modifiers Manager */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Custom Addons &amp; Modifiers (POS Order Modifiers)
                      </h4>
                      <span className="text-3xs text-slate-400">Available during POS order entry</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Addon name (e.g. Extra Cheese, Spicy Mayo, Double Shot)"
                        value={tempAddonName}
                        onChange={(e) => setTempAddonName(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-2xs text-slate-500 font-bold">Rs.</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Price"
                          value={tempAddonPrice}
                          onChange={(e) => setTempAddonPrice(parseFloat(e.target.value) || 0)}
                          className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddAddon}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-2xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        + Add Modifier
                      </button>
                    </div>

                    {formData.customAddons.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {formData.customAddons.map((addon, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{addon.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">+{formatNPR(addon.price)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAddon(idx)}
                                className="text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-3xs text-slate-400 italic">No modifiers added yet.</p>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 2: RECIPE BOM & FOOD COSTING */}
              {modalActiveTab === 'recipe' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs text-amber-950 dark:text-amber-200">
                        Kitchen Recipe BOM (Bill of Materials) & Food Costing
                      </h4>
                      <p className="text-3xs text-amber-800 dark:text-amber-300 mt-0.5">
                        Link pantry ingredients to this dish. When an order is completed at POS, raw inventory will be auto-deducted from pantry stock, and real-time food cost is calculated automatically.
                      </p>
                    </div>
                  </div>

                  {/* Real-time Food Cost & Margin Dashboard */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-3xs text-slate-500 uppercase tracking-wider block font-semibold">Total BOM Cost</span>
                      <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                        {formatNPR(totalBOMCost)}
                      </span>
                      <p className="text-3xs text-slate-400 mt-0.5">Sum of linked pantry ingredients</p>
                    </div>

                    <div>
                      <span className="text-3xs text-slate-500 uppercase tracking-wider block font-semibold">Selling Price (MRP)</span>
                      <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                        {formatNPR(formData.retailPrice || 0)}
                      </span>
                      <p className="text-3xs text-slate-400 mt-0.5">Customer counter rate</p>
                    </div>

                    <div>
                      <span className="text-3xs text-slate-500 uppercase tracking-wider block font-semibold">Live Food Cost %</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-base font-bold font-mono ${
                          foodCostPercent > 45 ? 'text-rose-600' : foodCostPercent > 32 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {foodCostPercent}%
                        </span>
                        <span className={`text-3xs px-2 py-0.5 rounded-full font-bold uppercase ${
                          foodCostPercent > 45
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : foodCostPercent > 32
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {foodCostPercent > 45 ? 'High Cost' : foodCostPercent > 32 ? 'Acceptable' : 'Prime Profit'}
                        </span>
                      </div>
                      <p className="text-3xs text-slate-400 mt-0.5">Industry standard: 28% – 35%</p>
                    </div>
                  </div>

                  {/* Recipe Ingredients Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-2xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Raw Pantry Ingredients ({formData.recipeIngredients.length})
                      </label>
                      <button
                        type="button"
                        onClick={handleAddRecipeIngredient}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-2xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Raw Ingredient</span>
                      </button>
                    </div>

                    {formData.recipeIngredients.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                        <ChefHat className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No ingredients linked yet</p>
                        <p className="text-3xs text-slate-400 mt-0.5">
                          Click &quot;Add Raw Ingredient&quot; above to link meat, dairy, flour, sauces, or spices from your inventory.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-3xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                              <th className="p-2.5">Pantry Ingredient</th>
                              <th className="p-2.5 w-24">Portion Qty</th>
                              <th className="p-2.5 w-20">Unit</th>
                              <th className="p-2.5 w-24 text-right">Cost/Unit</th>
                              <th className="p-2.5 w-24 text-right">Line Cost</th>
                              <th className="p-2.5 w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                            {formData.recipeIngredients.map((ing, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="p-2">
                                  {rawIngredients.length > 0 ? (
                                    <select
                                      value={ing.ingredientId || ''}
                                      onChange={(e) => {
                                        const found = rawIngredients.find(r => r.id === e.target.value);
                                        if (found) {
                                          handleUpdateRecipeIngredient(idx, {
                                            ingredientId: found.id,
                                            ingredientName: found.name,
                                            costPerUnit: found.costPrice || 0,
                                            unit: found.baseUnitSymbol || found.baseUnit || 'kg'
                                          });
                                        } else {
                                          handleUpdateRecipeIngredient(idx, {
                                            ingredientId: '',
                                            ingredientName: e.target.value
                                          });
                                        }
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs text-slate-900 dark:text-slate-100"
                                    >
                                      <option value="">-- Choose pantry stock item --</option>
                                      {rawIngredients.map(r => (
                                        <option key={r.id} value={r.id}>
                                          {r.name} ({formatNPR(r.costPrice || 0)}/{r.baseUnitSymbol || 'unit'})
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      placeholder="Ingredient name (e.g. Minced Buff)"
                                      value={ing.ingredientName}
                                      onChange={(e) => handleUpdateRecipeIngredient(idx, { ingredientName: e.target.value })}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs text-slate-900 dark:text-slate-100"
                                    />
                                  )}
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    placeholder="0.15"
                                    value={ing.quantityRequired ?? ''}
                                    onChange={(e) => handleUpdateRecipeIngredient(idx, { quantityRequired: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 text-right"
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={ing.unit}
                                    onChange={(e) => handleUpdateRecipeIngredient(idx, { unit: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                                  >
                                    <option value="kg">kg</option>
                                    <option value="gm">gm</option>
                                    <option value="ltr">ltr</option>
                                    <option value="ml">ml</option>
                                    <option value="pcs">pcs</option>
                                    <option value="portion">portion</option>
                                  </select>
                                </td>
                                <td className="p-2 text-right">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={ing.costPerUnit ?? ''}
                                    onChange={(e) => handleUpdateRecipeIngredient(idx, { costPerUnit: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 text-right"
                                  />
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {formatNPR(ing.totalCost ?? 0)}
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRecipeIngredient(idx)}
                                    className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {totalBOMCost > 0 && (
                      <div className="flex items-center justify-between p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/80">
                        <span className="text-2xs text-blue-900 dark:text-blue-200 font-medium">
                          Auto-apply calculated Recipe BOM cost ({formatNPR(totalBOMCost)}) to Item Cost Price?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, costPrice: totalBOMCost }));
                            showToast(`Updated cost price to ${formatNPR(totalBOMCost)} based on recipe BOM.`, 'info');
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-2xs font-bold transition-all"
                        >
                          Sync to Cost Price
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: PRICING, VAT & INVENTORY STOCK */}
              {modalActiveTab === 'inventory' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  
                  {/* Selling Price & Cost Rates (NPR) */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Selling Price &amp; Cost Rates (NPR)
                      </h4>
                      {Number(formData.retailPrice) > 0 && Number(formData.costPrice) > 0 && (
                        <div className="flex items-center gap-2 text-3xs font-mono font-bold">
                          <span className="text-slate-500">Gross Margin:</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {formatNPR(Math.max(0, Number(formData.retailPrice) - Number(formData.costPrice)))} 
                            ({Math.round(((Number(formData.retailPrice) - Number(formData.costPrice)) / Number(formData.retailPrice)) * 100)}%)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 1. Cost Price with Factor of Two Reasons: (Recipe BOM & Costing) OR (User Set Themselves) */}
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300">
                            Cost Price (Rs.) *
                          </label>
                          <span className="text-3xs text-slate-400 uppercase font-semibold">Cost Factor</span>
                        </div>

                        {/* Cost Factor Selector: Recipe BOM vs User Set Themselves */}
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setCostBasis('bom');
                              if (totalBOMCost > 0) {
                                setFormData(prev => ({ ...prev, costPrice: totalBOMCost }));
                              }
                            }}
                            className={`px-2 py-1.5 rounded-md text-2xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              costBasis === 'bom'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                            title="Auto-calculate cost from Tab 2 Recipe BOM ingredients"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Recipe BOM</span>
                            {totalBOMCost > 0 && (
                              <span className="ml-0.5 opacity-90 font-mono">({formatNPR(totalBOMCost)})</span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setCostBasis('manual')}
                            className={`px-2 py-1.5 rounded-md text-2xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              costBasis === 'manual'
                                ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                            title="Set custom cost price directly"
                          >
                            <span>✍️ User Set</span>
                          </button>
                        </div>

                        {/* Cost Price Input */}
                        <div>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-2xs font-mono font-bold text-slate-400">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={formData.costPrice}
                              onChange={(e) => {
                                setCostBasis('manual');
                                setFormData(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }));
                              }}
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 text-sm focus:bg-white dark:focus:bg-slate-900 transition-all"
                              placeholder="0.00"
                            />
                          </div>

                          <div className="mt-1.5 flex items-center justify-between text-3xs">
                            {costBasis === 'bom' ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Factored from Recipe BOM ({formData.recipeIngredients.length} ingredients)</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">
                                Factored by User Set (Manual Entry)
                              </span>
                            )}
                            {costBasis === 'manual' && totalBOMCost > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCostBasis('bom');
                                  setFormData(prev => ({ ...prev, costPrice: totalBOMCost }));
                                }}
                                className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                              >
                                Use Recipe: {formatNPR(totalBOMCost)}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 2. Retail Rate */}
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300">
                            Retail Rate (Counter MRP Rs.) *
                          </label>
                          <span className="text-3xs text-blue-600 dark:text-blue-400 uppercase font-semibold">Selling Price</span>
                        </div>

                        <div className="pt-1.5">
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-2xs font-mono font-bold text-slate-400">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={formData.retailPrice}
                              onChange={(e) => setFormData(prev => ({ 
                                ...prev, 
                                retailPrice: parseFloat(e.target.value) || 0,
                                wholesalePrice: parseFloat(e.target.value) || 0 
                              }))}
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-blue-600 dark:text-blue-400 text-sm focus:bg-white dark:focus:bg-slate-900 transition-all"
                              placeholder="0.00"
                            />
                          </div>

                          <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-3xs font-mono">
                            <span className="text-slate-500">Food Cost %:</span>
                            <span className={`font-bold ${foodCostPercent > 40 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {Number(formData.retailPrice) > 0 ? `${Math.round((Number(formData.costPrice) / Number(formData.retailPrice)) * 100)}%` : '0%'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nepal Tax / VAT Rate Settings */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Nepal Inland Revenue (IRD) VAT Specification
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          VAT Assessment Rate *
                        </label>
                        <select
                          value={formData.taxRatePercent}
                          onChange={(e) => setFormData({ ...formData, taxRatePercent: Number(e.target.value) })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 font-medium"
                        >
                          <option value={13}>13% VAT Standard Rate</option>
                          <option value={0}>0% Tax Exempt (कर छुट)</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-center">
                        <label className="flex items-center gap-2 cursor-pointer mt-1">
                          <input
                            type="checkbox"
                            checked={formData.isTaxInclusive !== false}
                            onChange={(e) => setFormData({ ...formData, isTaxInclusive: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-2xs font-semibold text-slate-800 dark:text-slate-200">
                            Retail price includes 13% VAT (Nepal Restaurant Standard)
                          </span>
                        </label>

                        <p className="text-3xs text-slate-400 mt-1">
                          {formData.taxRatePercent === 0 
                            ? 'Tax exempt item (0% VAT applies)'
                            : (formData.isTaxInclusive !== false 
                                ? 'Customer pays exact listed price; 13% VAT is extracted inside POS invoice.' 
                                : '13% VAT is added on top of bill subtotal at POS checkout.')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Inventory Stock & Warehouse Tracking */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Kitchen & Warehouse Stock Control
                      </h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.trackStock}
                          onChange={(e) => setFormData({ ...formData, trackStock: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                        />
                        <span className="text-2xs font-semibold text-slate-700 dark:text-slate-300">Track Stock Limit (Optional)</span>
                      </label>
                    </div>

                    {!formData.trackStock && (
                      <div className="px-3 py-2 rounded-lg bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 text-3xs text-teal-800 dark:text-teal-200 font-medium">
                        <strong>∞ Unlimited Mode (Default):</strong> Always available in POS with no stock limit, and auto-increments the Served counter on every sale. Enable the checkbox above only if you want a finite stock limit.
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Current Stock ({formData.baseUnitSymbol || 'unit'})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={!formData.trackStock}
                          value={formData.currentStock}
                          onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                          className={`w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100 ${!formData.trackStock ? 'bg-slate-100 dark:bg-slate-800/50 opacity-50 cursor-not-allowed' : 'bg-white dark:bg-slate-900'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Reorder Alert Level
                        </label>
                        <input
                          type="number"
                          min="0"
                          disabled={!formData.trackStock}
                          value={formData.reorderLevel}
                          onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
                          className={`w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100 ${!formData.trackStock ? 'bg-slate-100 dark:bg-slate-800/50 opacity-50 cursor-not-allowed' : 'bg-white dark:bg-slate-900'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Kitchen / Store Location
                        </label>
                        <select
                          value={formData.warehouseId}
                          onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                        >
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Rack / Cold Storage Bin
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Chiller-1, Pantry Rack A"
                          value={formData.locationBin}
                          onChange={(e) => setFormData({ ...formData, locationBin: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}



              {/* Modal Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <label className="text-2xs font-semibold text-slate-500">Status:</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-2xs font-semibold text-slate-800 dark:text-slate-200 outline-hidden"
                  >
                    <option value="active">Active (Counter Available)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    type="button"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    loading={isSubmitting}
                    icon={!isSubmitting ? <Check className="w-4 h-4" /> : undefined}
                  >
                    {editingProduct ? 'Save Menu Changes' : 'Create Menu Item'}
                  </Button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL FOR DELETE / DEACTIVATE */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Delete / Deactivate Product
                </h3>
                <p className="text-2xs text-slate-500">
                  Choose how you want to handle this catalog item.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p className="font-bold text-slate-900 dark:text-slate-100">{productToDelete.name}</p>
              <div className="flex items-center gap-2 text-3xs font-mono text-slate-500">
                <span>SKU: {productToDelete.sku}</span>
                <span>•</span>
                <span>Stock: {productToDelete.currentStock} {productToDelete.baseUnitSymbol}</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                variant="amber"
                size="md"
                fullWidth
                onClick={handleDeactivate}
                icon={<AlertTriangle className="w-4 h-4" />}
              >
                Deactivate / Discontinue (Recommended)
              </Button>
              <p className="text-3xs text-slate-400 text-center px-2">
                Deactivating preserves past invoices and audit ledger history while hiding the item from POS counter.
              </p>

              <Button
                variant="danger"
                size="md"
                fullWidth
                onClick={handlePermanentDelete}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Delete Permanently
              </Button>

              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setProductToDelete(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENTS OWN CATEGORY MANAGER MODAL */}
      <CategoryManagerModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={(newCat) => {
          setFormData(prev => ({ ...prev, category: newCat.name }));
          showToast(`Created & selected custom category: "${newCat.name}"`, 'success');
        }}
      />

      {/* QUICK ADD HIERARCHY MODAL (Dept, Sub-Category, Prep Style) */}
      {quickAddHierarchyModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {quickAddHierarchyModal.title}
                  </h3>
                  <p className="text-3xs text-slate-500 dark:text-slate-400">
                    {quickAddHierarchyModal.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddHierarchyModal(prev => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddHierarchy} className="space-y-4">
              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={
                    quickAddHierarchyModal.level === 'dept'
                      ? 'e.g. Bakery, Combos, Beverages'
                      : quickAddHierarchyModal.level === 'subCat'
                      ? 'e.g. Steamed, Fried, Sizzler, Gravy'
                      : 'e.g. Extra Spicy, Medium, Regular'
                  }
                  value={quickHierarchyInput}
                  onChange={(e) => setQuickHierarchyInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickAddHierarchyModal(prev => ({ ...prev, open: false }))}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create &amp; Select</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



    </div>
  );
};
