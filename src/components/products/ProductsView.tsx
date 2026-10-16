import React, { useState, useMemo } from 'react';
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
import { QuickAddSupplierModal } from '../suppliers/QuickAddSupplierModal';
import { 
  MenuArchitectureManager, 
  HierarchyConfig, 
  DEFAULT_HIERARCHY, 
  HIERARCHY_STORAGE_KEY 
} from './MenuArchitectureManager';

export const ProductsView: React.FC = () => {
  const { 
    products, addProduct, updateProduct, deleteProduct, 
    categories: categoryDefinitions, units, suppliers, warehouses, currentWarehouseId,
    menuHierarchy 
  } = useApp();

  const [viewMode, setViewMode] = useState<'hierarchy' | 'table'>('hierarchy');
  const [menuStudioTab, setMenuStudioTab] = useState<'browse' | 'master' | 'bulk'>('browse');
  const [selectedMenuStudioItemId, setSelectedMenuStudioItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all_active' | 'low_stock' | 'discontinued' | 'all'>('all_active');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<'menu' | 'recipe' | 'inventory' | 'sku_addons'>('menu');
  const [allowEditSkuBarcode, setAllowEditSkuBarcode] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Custom Addons builder state
  const [tempAddonName, setTempAddonName] = useState('');
  const [tempAddonPrice, setTempAddonPrice] = useState<number>(30);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    department: 'Food',
    orderRoutingStation: 'kitchen' as 'kitchen' | 'bar',
    category: 'Mo:Mo',
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
    reorderLevel: 5,
    warehouseId: 'wh-kitchen',
    locationBin: '',
    hasVariants: false,
    warrantyMonths: 0,
    status: 'active' as 'active' | 'inactive' | 'discontinued',
    customAddons: [] as { name: string; price: number }[],
    recipeIngredients: [] as RecipeIngredient[],
    trackStock: true
  });

  // Alternative unit builder in form
  const [tempAltUnitName, setTempAltUnitName] = useState('Box');
  const [tempAltUnitSymbol, setTempAltUnitSymbol] = useState('box');
  const [tempAltMultiplier, setTempAltMultiplier] = useState<number>(10);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const hierarchy = useMemo<HierarchyConfig>(() => {
    try {
      const cached = localStorage.getItem(HIERARCHY_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.departments && parsed.categories) {
          return {
            departments: Array.isArray(parsed.departments) && parsed.departments.length > 0 ? parsed.departments : DEFAULT_HIERARCHY.departments,
            categories: parsed.categories || DEFAULT_HIERARCHY.categories,
            subCategories: parsed.subCategories || {},
            prepStyles: parsed.prepStyles || {},
            categoryColors: parsed.categoryColors || {}
          };
        }
      }
    } catch (e) {}
    if (menuHierarchy && menuHierarchy.departments) {
      return {
        departments: menuHierarchy.departments || DEFAULT_HIERARCHY.departments,
        categories: menuHierarchy.categories || DEFAULT_HIERARCHY.categories,
        subCategories: menuHierarchy.subCategories || {},
        prepStyles: menuHierarchy.prepStyles || {},
        categoryColors: menuHierarchy.categoryColors || {}
      };
    }
    return DEFAULT_HIERARCHY;
  }, [menuHierarchy]);

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
      if (statusFilter === 'all_active') {
        matchStatus = p.status !== 'discontinued';
      } else if (statusFilter === 'low_stock') {
        matchStatus = p.status !== 'discontinued' && currentStock <= reorderLevel;
      } else if (statusFilter === 'discontinued') {
        matchStatus = p.status === 'discontinued';
      }

      return matchCat && matchBrand && matchSearch && matchStatus;
    });
  }, [products, selectedCategory, selectedBrand, searchQuery, statusFilter]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setModalActiveTab('menu');
    setAllowEditSkuBarcode(false);
    const defaultDept = 'Food';
    const defaultCat = hierarchy.categories[defaultDept]?.[0] || 'Mo:Mo';
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
      reorderLevel: 5,
      warehouseId: defaultWarehouse,
      locationBin: 'Kitchen Prep',
      hasVariants: false,
      warrantyMonths: 0,
      status: 'active',
      customAddons: [],
      recipeIngredients: [],
      trackStock: true
    });
    setTempAltUnitName('Plate');
    setTempAltUnitSymbol('plate');
    setTempAltMultiplier(1);
    setShowAddModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setModalActiveTab('menu');
    setAllowEditSkuBarcode(false);

    const isBar = product.orderRoutingStation === 'bar' || (!product.orderRoutingStation && (product.department === 'Drink' || product.itemType === 'beverage' || (product.category && /bar|drink|beverage|wine|cocktail|beer|liquor|coffee/i.test(product.category))));
    const resolvedDept = product.department || (isBar ? 'Drink' : 'Food');
    const resolvedStation = product.orderRoutingStation || (isBar ? 'bar' : 'kitchen');
    const resolvedCat = product.category || (hierarchy.categories[resolvedDept]?.[0] || 'Mo:Mo');
    const resolvedSub = product.subCategory || product.subcategory || (hierarchy.subCategories[resolvedCat]?.[0] || 'General');
    const resolvedPrep = product.prepStyle || (hierarchy.prepStyles[resolvedCat]?.[0] || 'Standard');

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
      reorderLevel: product.reorderLevel ?? 5,
      warehouseId: product.warehouseId || warehouses[0]?.id || 'wh-kitchen',
      locationBin: product.locationBin || '',
      hasVariants: !!product.hasVariants,
      warrantyMonths: product.warrantyMonths || 0,
      status: product.status || 'active',
      customAddons: Array.isArray(product.customAddons) ? [...product.customAddons] : [],
      recipeIngredients: Array.isArray(product.recipeIngredients) ? [...product.recipeIngredients] : [],
      trackStock: product.trackStock !== false
    });
    setTempAltUnitName('Box');
    setTempAltUnitSymbol('box');
    setTempAltMultiplier(10);
    setShowAddModal(true);
  };

  const handleAddAltUnit = () => {
    if (!tempAltUnitName.trim() || tempAltMultiplier <= 1) return;
    setFormData(prev => ({
      ...prev,
      alternativeUnits: [
        ...prev.alternativeUnits,
        { 
          unitName: tempAltUnitName.trim(), 
          unitSymbol: tempAltUnitSymbol.trim() || String(tempAltUnitName || '').toLowerCase().slice(0, 3), 
          multiplierToBase: Number(tempAltMultiplier) 
        }
      ]
    }));
    setTempAltUnitName('');
    setTempAltUnitSymbol('');
    setTempAltMultiplier(10);
  };

  const handleRemoveAltUnit = (index: number) => {
    setFormData(prev => ({
      ...prev,
      alternativeUnits: prev.alternativeUnits.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const calculatedCost = totalBOMCost > 0 ? totalBOMCost : Number(formData.costPrice);

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
        retailPrice: Number(formData.retailPrice),
        wholesalePrice: Number(formData.wholesalePrice) || Number(formData.retailPrice),
        dealerPrice: Number(formData.dealerPrice),
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
    if (!productToDelete) return;
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
    if (!productToDelete) return;
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

              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAdd}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                + Create Item
              </Button>
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
              Low Stock Alerts ({(products || []).filter(p => p && p.status !== 'discontinued' && (p.currentStock ?? 0) <= (p.reorderLevel ?? 0)).length})
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
            <div className="flex items-center gap-1">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium outline-hidden"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                title="Create / Manage Custom Categories"
                className="px-2 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-2xs font-semibold flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Category</span>
              </button>
            </div>

            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium outline-hidden"
            >
              {brands.map(b => (
                <option key={b} value={b}>{b === 'ALL' ? 'All Brands' : b}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Item</span>
            </button>
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
                <th className="px-4 py-3 text-right">Cost (Landed)</th>
                <th className="px-4 py-3 text-right">Retail (MRP)</th>
                <th className="px-4 py-3 text-right">Wholesale</th>
                <th className="px-4 py-3 text-center">Current Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="font-semibold text-xs text-slate-600 dark:text-slate-400">No products found matching criteria</p>
                    <button
                      onClick={handleOpenAdd}
                      className="mt-2 px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-2xs font-semibold hover:bg-blue-100"
                    >
                      + Create First Item
                    </button>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  if (!product) return null;
                  const currentStock = product.currentStock ?? 0;
                  const reorderLevel = product.reorderLevel ?? 0;
                  const isLowStock = product.status !== 'discontinued' && currentStock <= reorderLevel;
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
                          {product.dietaryType === 'veg' && (
                            <span className="text-3xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold shrink-0" title="Vegetarian">🟢 Veg</span>
                          )}
                          {product.dietaryType === 'non_veg' && (
                            <span className="text-3xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold shrink-0" title="Non-Vegetarian">🔴 Non-Veg</span>
                          )}
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
                              🍸 Bar
                            </span>
                          ) : (
                            <span className="text-3xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1" title="Routed to Kitchen (KDS)">
                              🍳 Kitchen
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

                      <td className="px-4 py-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {formatNPR(product.wholesalePrice ?? product.retailPrice ?? 0)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className={`font-mono font-bold text-xs ${isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {currentStock} {product.baseUnitSymbol || 'portion'}
                        </div>
                        {Array.isArray(product.alternativeUnits) && product.alternativeUnits.length > 0 && (
                          <div className="text-3xs text-slate-400 font-mono">
                            {formattedStock}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={product.status === 'discontinued' ? 'discontinued' : (isLowStock ? 'low_stock' : (product.status || 'active'))} />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {product.status === 'discontinued' ? (
                            <button
                              onClick={() => handleReactivate(product)}
                              className="px-2 py-1 text-2xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                              title="Reactivate Product"
                            >
                              <RotateCcw className="w-3 h-3" /> Reactivate
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenEdit(product)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Edit Menu & Stock Details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setProductToDelete(product)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Delete or Deactivate Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
                      {formData.orderRoutingStation === 'bar' ? '🍸 Bar / BOT' : '🍳 Kitchen / KOT'}
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
                <span>1. Menu & Hierarchy</span>
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
                <span>2. Recipe BOM & Costing</span>
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
                <span>3. Pricing, VAT & Stock</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('sku_addons')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  modalActiveTab === 'sku_addons'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>4. SKU, Units & Add-ons</span>
                {formData.customAddons.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-3xs font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    +{formData.customAddons.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              
              {/* TAB 1: MENU & HIERARCHY */}
              {modalActiveTab === 'menu' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  
                  {/* Order Routing Station & Dietary Type Banners */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Station Toggle */}
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

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ 
                              ...prev, 
                              orderRoutingStation: 'kitchen',
                              department: prev.department === 'Drink' ? 'Food' : prev.department
                            }));
                          }}
                          className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                            formData.orderRoutingStation === 'kitchen'
                              ? 'bg-white dark:bg-slate-900 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/20'
                              : 'bg-slate-100/70 dark:bg-slate-800/60 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          <ChefHat className="w-4 h-4 text-orange-500" />
                          <span>🍳 Kitchen (KDS)</span>
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
                          className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                            formData.orderRoutingStation === 'bar'
                              ? 'bg-white dark:bg-slate-900 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/20'
                              : 'bg-slate-100/70 dark:bg-slate-800/60 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          <Wine className="w-4 h-4 text-amber-500" />
                          <span>🍸 Bar / Beverage (BOT)</span>
                        </button>
                      </div>
                    </div>

                    {/* Dietary Classification */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="mb-2">
                        <span className="text-2xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block">
                          Dietary Classification
                        </span>
                        <p className="text-3xs text-slate-500 dark:text-slate-400">
                          Displays Nepal standard food symbols on POS tiles and bill printouts
                        </p>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, dietaryType: 'veg' }))}
                          className={`py-1.5 px-2 rounded-lg text-2xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                            formData.dietaryType === 'veg'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="text-xs">🟢</span>
                          <span>Pure Veg</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, dietaryType: 'non_veg' }))}
                          className={`py-1.5 px-2 rounded-lg text-2xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                            formData.dietaryType === 'non_veg'
                              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="text-xs">🔴</span>
                          <span>Non-Veg</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, dietaryType: 'vegan' }))}
                          className={`py-1.5 px-2 rounded-lg text-2xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                            formData.dietaryType === 'vegan'
                              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-700 dark:text-teal-300 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="text-xs">🌱</span>
                          <span>Vegan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, dietaryType: 'none' }))}
                          className={`py-1.5 px-2 rounded-lg text-2xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                            formData.dietaryType === 'none'
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="text-xs">⚪</span>
                          <span>Standard</span>
                        </button>
                      </div>
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
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          1. Department *
                        </label>
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
                            className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
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
                              sku: generateUniqueSKU(newCat, prev.brand, products, editingProduct?.id)
                            }));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
                        >
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
                          {!((hierarchy.categories[formData.department] || []).includes(formData.category)) && formData.category && (
                            <option value={formData.category}>{formData.category}</option>
                          )}
                        </select>
                      </div>

                      {/* Level 3: Sub-Category */}
                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          3. Sub-Category
                        </label>
                        {Array.isArray(hierarchy.subCategories[formData.category]) && hierarchy.subCategories[formData.category].length > 0 ? (
                          <select
                            value={formData.subCategory}
                            onChange={(e) => setFormData(prev => ({ ...prev, subCategory: e.target.value, subcategory: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
                          >
                            {hierarchy.subCategories[formData.category].map(sub => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="e.g. Steamed, Gravy, Fried"
                            value={formData.subCategory}
                            onChange={(e) => setFormData(prev => ({ ...prev, subCategory: e.target.value, subcategory: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
                          />
                        )}
                      </div>

                      {/* Level 4: Prep Style */}
                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          4. Prep Style / Variant
                        </label>
                        {Array.isArray(hierarchy.prepStyles[formData.category]) && hierarchy.prepStyles[formData.category].length > 0 ? (
                          <select
                            value={formData.prepStyle}
                            onChange={(e) => setFormData(prev => ({ ...prev, prepStyle: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
                          >
                            {hierarchy.prepStyles[formData.category].map(prep => (
                              <option key={prep} value={prep}>{prep}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="e.g. Regular, Spicy, Chilly"
                            value={formData.prepStyle}
                            onChange={(e) => setFormData(prev => ({ ...prev, prepStyle: e.target.value }))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
                          />
                        )}
                      </div>
                    </div>
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
                  
                  {/* Tiered Rates (NPR) */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Tiered Selling Rates (NPR)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Cost Price (Landed Rs.) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={formData.costPrice}
                          onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Retail MRP (Counter Rs.) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={formData.retailPrice}
                          onChange={(e) => setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-blue-600 dark:text-blue-400"
                        />
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Wholesale Rate (Rs.)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={formData.wholesalePrice}
                          onChange={(e) => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-emerald-600 dark:text-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Dealer / Catering Rate (Rs.)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={formData.dealerPrice}
                          onChange={(e) => setFormData({ ...formData, dealerPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-amber-600 dark:text-amber-400"
                        />
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
                        <span className="text-2xs font-semibold text-slate-700 dark:text-slate-300">Track Stock</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Current Stock ({formData.baseUnitSymbol || 'unit'})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={formData.currentStock}
                          onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">
                          Reorder Alert Level
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.reorderLevel}
                          onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100"
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

              {/* TAB 4: SKU, UNITS & CUSTOM ADDONS */}
              {modalActiveTab === 'sku_addons' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  
                  {/* SKU & Barcode Generator with Override Lock */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Item Identification & Barcode
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

                  {/* Brand & Supplier */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Brand / Kitchen Production Tag
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. In-House Kitchen, Bakery Section, Tuborg"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400">
                          Supplier / Vendor
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowSupplierModal(true)}
                          className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
                        >
                          + Quick Add
                        </button>
                      </div>
                      <select
                        value={formData.supplierId}
                        onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 font-medium"
                      >
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Units & Conversions */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Units of Measurement & Packaging Conversions
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">Base Serving Unit *</label>
                        <select
                          value={formData.baseUnit}
                          onChange={(e) => {
                            const selUnit = units.find(u => u.name === e.target.value);
                            setFormData({
                              ...formData,
                              baseUnit: e.target.value,
                              baseUnitSymbol: selUnit?.symbol || 'portion'
                            });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                        >
                          {units.map(u => (
                            <option key={u.id} value={u.name}>{u.name} ({u.symbol})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-500 mb-1">Base Unit Symbol</label>
                        <input
                          type="text"
                          value={formData.baseUnitSymbol}
                          onChange={(e) => setFormData({ ...formData, baseUnitSymbol: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Alternative Units Builder */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
                      <label className="block text-3xs font-semibold text-slate-500 mb-1">
                        Alternative Packaging Units (e.g. 1 Box = 10 Portions, 1 Crate = 24 Bottles)
                      </label>
                      
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Unit (e.g. Box)"
                          value={tempAltUnitName}
                          onChange={(e) => setTempAltUnitName(e.target.value)}
                          className="w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Symbol"
                          value={tempAltUnitSymbol}
                          onChange={(e) => setTempAltUnitSymbol(e.target.value)}
                          className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                        <span className="text-2xs text-slate-400 font-bold">=</span>
                        <input
                          type="number"
                          min="2"
                          placeholder="Multiplier"
                          value={tempAltMultiplier}
                          onChange={(e) => setTempAltMultiplier(parseFloat(e.target.value) || 1)}
                          className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                        <span className="text-2xs font-semibold text-slate-500">{formData.baseUnitSymbol}</span>

                        <button
                          type="button"
                          onClick={handleAddAltUnit}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-2xs font-semibold transition-all cursor-pointer"
                        >
                          + Add Unit
                        </button>
                      </div>

                      {formData.alternativeUnits.map((alt, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-2xs mb-1 font-mono">
                          <span>1 {alt.unitName} ({alt.unitSymbol}) = <strong>{alt.multiplierToBase}</strong> {formData.baseUnitSymbol}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAltUnit(idx)}
                            className="text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                          >
                            Remove ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Addons & Modifiers Manager */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Custom Addons & Modifiers (POS Order Modifiers)
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

      {/* QUICK ADD SUPPLIER MODAL */}
      <QuickAddSupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSupplierCreated={(newSup) => {
          setFormData(prev => ({ ...prev, supplierId: newSup.id }));
          showToast(`Created & selected supplier: "${newSup.companyName}"`, 'success');
        }}
      />

    </div>
  );
};
