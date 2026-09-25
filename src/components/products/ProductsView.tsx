import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Filter, Edit, Trash2, Tag, 
  Warehouse as WarehouseIcon, Package, QrCode, AlertTriangle, 
  ChevronRight, Check, X, ShieldAlert, SlidersHorizontal,
  CheckCircle2, RefreshCw, Layers, ArrowUpRight, RotateCcw, FolderPlus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, UnitConversion, ProductCategory } from '../../types';
import { formatNPR, formatStockInUnits } from '../../utils/nepalFormatters';
import { 
  generateUniqueSKU, 
  generateUniqueBarcode, 
  checkSkuDuplicate, 
  checkBarcodeDuplicate 
} from '../../utils/codeGenerator';
import { StatusBadge } from '../common/StatCard';
import { CategoryManagerModal } from './CategoryManagerModal';
import { QuickAddSupplierModal } from '../suppliers/QuickAddSupplierModal';
import { MenuArchitectureManager } from './MenuArchitectureManager';

export const ProductsView: React.FC = () => {
  const { 
    products, addProduct, updateProduct, deleteProduct, 
    categories: categoryDefinitions, units, suppliers, warehouses, currentWarehouseId 
  } = useApp();

  const [viewMode, setViewMode] = useState<'hierarchy' | 'table'>('hierarchy');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all_active' | 'low_stock' | 'discontinued' | 'all'>('all_active');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: 'Main Courses & Grills',
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
    currentStock: 0,
    reorderLevel: 5,
    warehouseId: 'wh-kitchen',
    locationBin: '',
    hasVariants: false,
    warrantyMonths: 0,
    status: 'active' as 'active' | 'inactive' | 'discontinued'
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

  const categories = useMemo(() => {
    const list = new Set<string>();
    categoryDefinitions.forEach(c => list.add(c.name));
    products.forEach(p => { if (p.category) list.add(p.category); });
    return ['ALL', ...Array.from(list)];
  }, [categoryDefinitions, products]);

  const brands = useMemo(() => {
    return ['ALL', ...Array.from(new Set(products.map(p => p.brand).filter(Boolean)))];
  }, [products]);

  // Real-time Duplicate Detection
  const skuDuplicate = useMemo(() => {
    return checkSkuDuplicate(formData.sku, products, editingProduct?.id);
  }, [formData.sku, products, editingProduct]);

  const barcodeDuplicate = useMemo(() => {
    return checkBarcodeDuplicate(formData.barcode, products, editingProduct?.id);
  }, [formData.barcode, products, editingProduct]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchBrand = selectedBrand === 'ALL' || p.brand === selectedBrand;
      const matchSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.includes(searchQuery);

      let matchStatus = true;
      if (statusFilter === 'all_active') {
        matchStatus = p.status !== 'discontinued';
      } else if (statusFilter === 'low_stock') {
        matchStatus = p.status !== 'discontinued' && p.currentStock <= p.reorderLevel;
      } else if (statusFilter === 'discontinued') {
        matchStatus = p.status === 'discontinued';
      }

      return matchCat && matchBrand && matchSearch && matchStatus;
    });
  }, [products, selectedCategory, selectedBrand, searchQuery, statusFilter]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    const defaultSupplier = suppliers[0]?.id || '';
    const defaultWarehouse = warehouses.find(w => w.id === currentWarehouseId)?.id || warehouses[0]?.id || 'wh-kitchen';
    const defaultUnit = units.find(u => u.name === 'Portion' || u.name === 'Plate')?.name || units[0]?.name || 'Portion';
    const defaultUnitSymbol = units.find(u => u.name === 'Portion' || u.name === 'Plate')?.symbol || units[0]?.symbol || 'portion';
    const defaultCat = categoryDefinitions[0]?.name || 'Main Courses & Grills';
    const defaultBrand = 'Kitchen In-House';

    // Generate unique readable SKU (e.g., MAIN-KIT-00001) and unique internal EAN-13 barcode
    const autoSku = generateUniqueSKU(defaultCat, defaultBrand, products);
    const autoBarcode = generateUniqueBarcode(products);

    setFormData({
      sku: autoSku,
      barcode: autoBarcode,
      name: '',
      category: defaultCat,
      subcategory: '',
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
      currentStock: 0,
      reorderLevel: 5,
      warehouseId: defaultWarehouse,
      locationBin: 'Kitchen Prep',
      hasVariants: false,
      warrantyMonths: 0,
      status: 'active'
    });
    setTempAltUnitName('Plate');
    setTempAltUnitSymbol('plate');
    setTempAltMultiplier(1);
    setShowAddModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);

    setFormData({
      sku: product.sku || generateUniqueSKU(product.category || 'Pipes & Fittings', product.brand || 'GEN', products, product.id),
      barcode: product.barcode || generateUniqueBarcode(products, product.id),
      name: product.name,
      category: product.category || 'Pipes & Fittings',
      subcategory: product.subcategory || '',
      brand: product.brand || '',
      hsCode: product.hsCode || '',
      supplierId: product.supplierId || suppliers[0]?.id || '',
      baseUnit: product.baseUnit || 'Piece',
      baseUnitSymbol: product.baseUnitSymbol || 'pcs',
      alternativeUnits: product.alternativeUnits ? [...product.alternativeUnits] : [],
      costPrice: product.costPrice || 0,
      retailPrice: product.retailPrice || 0,
      wholesalePrice: product.wholesalePrice || 0,
      dealerPrice: product.dealerPrice || 0,
      taxRatePercent: product.taxRatePercent ?? 13,
      currentStock: product.currentStock || 0,
      reorderLevel: product.reorderLevel ?? 5,
      warehouseId: product.warehouseId || warehouses[0]?.id || 'wh-main',
      locationBin: product.locationBin || '',
      hasVariants: !!product.hasVariants,
      warrantyMonths: product.warrantyMonths || 0,
      status: product.status || 'active'
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
          unitSymbol: tempAltUnitSymbol.trim() || tempAltUnitName.toLowerCase().slice(0, 3), 
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
      const warehouseName = whObj ? whObj.name : 'Main Showroom';

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          sku: formData.sku.trim(),
          barcode: formData.barcode.trim(),
          name: formData.name.trim(),
          category: formData.category,
          subcategory: formData.subcategory.trim() || '',
          brand: formData.brand.trim(),
          hsCode: formData.hsCode.trim(),
          supplierId: formData.supplierId,
          supplierName,
          baseUnit: formData.baseUnit,
          baseUnitSymbol: formData.baseUnitSymbol,
          alternativeUnits: formData.alternativeUnits,
          costPrice: Number(formData.costPrice),
          retailPrice: Number(formData.retailPrice),
          wholesalePrice: Number(formData.wholesalePrice),
          dealerPrice: Number(formData.dealerPrice),
          taxRatePercent: Number(formData.taxRatePercent),
          currentStock: Number(formData.currentStock),
          reorderLevel: Number(formData.reorderLevel),
          warehouseId: formData.warehouseId,
          warehouseName,
          locationBin: formData.locationBin.trim() || '',
          hasVariants: formData.hasVariants,
          warrantyMonths: Number(formData.warrantyMonths),
          status: formData.status,
          trackStock: true
        });
        showToast(`Product "${formData.name}" updated successfully!`, 'success');
      } else {
        await addProduct({
          sku: formData.sku.trim(),
          barcode: formData.barcode.trim(),
          name: formData.name.trim(),
          category: formData.category,
          subcategory: formData.subcategory.trim() || '',
          brand: formData.brand.trim(),
          hsCode: formData.hsCode.trim(),
          supplierId: formData.supplierId,
          supplierName,
          baseUnit: formData.baseUnit,
          baseUnitSymbol: formData.baseUnitSymbol,
          alternativeUnits: formData.alternativeUnits,
          costPrice: Number(formData.costPrice),
          retailPrice: Number(formData.retailPrice),
          wholesalePrice: Number(formData.wholesalePrice),
          dealerPrice: Number(formData.dealerPrice),
          taxRatePercent: Number(formData.taxRatePercent),
          currentStock: Number(formData.currentStock),
          reorderLevel: Number(formData.reorderLevel),
          warehouseId: formData.warehouseId,
          warehouseName,
          locationBin: formData.locationBin.trim() || '',
          hasVariants: formData.hasVariants,
          warrantyMonths: Number(formData.warrantyMonths),
          status: formData.status,
          trackStock: true
        });
        showToast(`New product "${formData.name}" registered successfully!`, 'success');
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
          'bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
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
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            viewMode === 'hierarchy'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Menu Studio</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('table')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            viewMode === 'table'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Full Menu & Stock Catalog Table</span>
        </button>
      </div>

      {viewMode === 'hierarchy' ? (
        <MenuArchitectureManager />
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
              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
              >
                <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Manage Categories</span>
                <span className="px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded text-3xs font-bold font-mono">
                  {categoryDefinitions.length}
                </span>
              </button>

              <button
                onClick={handleOpenAdd}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" /> Add Product Item
              </button>
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
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Active Products ({products.filter(p => p.status !== 'discontinued').length})
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'low_stock'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Low Stock Alerts ({products.filter(p => p.status !== 'discontinued' && p.currentStock <= p.reorderLevel).length})
            </button>
            <button
              onClick={() => setStatusFilter('discontinued')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'discontinued'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Discontinued ({products.filter(p => p.status === 'discontinued').length})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Items ({products.length})
            </button>
          </div>

          <span className="text-3xs text-slate-400 font-mono">
            Showing {filteredProducts.length} results
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search by product name, SKU, or Barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 font-medium"
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
                className="px-2 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-2xs font-semibold flex items-center gap-1 transition-all"
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
          </div>
        </div>
      </div>

      {/* Main Products Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Product / SKU</th>
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
                      className="mt-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-2xs font-semibold hover:bg-indigo-100"
                    >
                      + Create First Item
                    </button>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const isLowStock = product.status !== 'discontinued' && product.currentStock <= product.reorderLevel;
                  const formattedStock = formatStockInUnits(product.currentStock, product.baseUnitSymbol, product.alternativeUnits);

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {product.name}
                          </span>
                          {product.itemType === 'menu_item' && (
                            <span className="px-1.5 py-0.2 rounded text-3xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60">
                              Menu Item
                            </span>
                          )}
                          {product.itemType === 'raw_ingredient' && (
                            <span className="px-1.5 py-0.2 rounded text-3xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60">
                              Raw Stock
                            </span>
                          )}
                          {product.dietaryType === 'veg' && (
                            <span className="text-3xs px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold" title="Vegetarian">🟢 Veg</span>
                          )}
                          {product.dietaryType === 'non_veg' && (
                            <span className="text-3xs px-1 py-0.2 rounded bg-rose-100 text-rose-800 font-bold" title="Non-Vegetarian">🔴 Non-Veg</span>
                          )}
                        </div>

                        {product.recipeIngredients && product.recipeIngredients.length > 0 && (
                          <div className="mt-1 text-3xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-600 dark:text-slate-300">Recipe: </span>
                            {product.recipeIngredients.map(i => `${i.ingredientName} (${i.quantityRequired} ${i.unit})`).join(', ')}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-0.5 text-3xs font-mono text-slate-400 flex-wrap">
                          <span>SKU: {product.sku}</span>
                          {product.hsCode && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">HS: {product.hsCode}</span>
                            </>
                          )}
                          {product.barcode && (
                            <>
                              <span>•</span>
                              <span>Bar: {product.barcode}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className={product.taxRatePercent === 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400 font-semibold"}>
                            {product.taxRatePercent === 0 ? '0% Tax Exempt' : '13% VAT'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-700 dark:text-slate-300 block">
                          {product.category}
                        </span>
                        <span className="text-3xs text-slate-400">
                          {product.brand} {product.model && `(${product.model})`}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          Base: {product.baseUnit} ({product.baseUnitSymbol})
                        </div>
                        {product.alternativeUnits && product.alternativeUnits.length > 0 && (
                          <div className="text-3xs text-indigo-600 dark:text-indigo-400 font-mono">
                            {product.alternativeUnits.map(u => `1 ${u.unitName} = ${u.multiplierToBase} ${product.baseUnitSymbol}`).join(', ')}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-600 dark:text-slate-400">
                        {formatNPR(product.costPrice)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatNPR(product.retailPrice)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatNPR(product.wholesalePrice)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className={`font-mono font-bold text-xs ${isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {product.currentStock} {product.baseUnitSymbol}
                        </div>
                        {product.alternativeUnits && product.alternativeUnits.length > 0 && (
                          <div className="text-3xs text-slate-400 font-mono">
                            {formattedStock}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={product.status === 'discontinued' ? 'discontinued' : (isLowStock ? 'low_stock' : product.status)} />
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
                                className="p-1.5 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Edit Product"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    {editingProduct ? 'EDIT PRODUCT DETAILS' : 'REGISTER NEW PRODUCT'}
                  </h3>
                  <p className="text-3xs text-slate-500">
                    {editingProduct ? `Updating SKU: ${editingProduct.sku}` : 'Fill in the specifications, category, HS code, and tax settings.'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Product Basic Info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Panchakanya 4 inch PVC Pipe Class 3"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-medium text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* SKU / Item Code */}
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      SKU / Item Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={formData.sku}
                        placeholder="e.g. SAN-JAQ-00042"
                        className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-xs text-indigo-950 dark:text-indigo-200 cursor-default select-all outline-hidden"
                      />
                    </div>
                    <p className="mt-1 text-3xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                      <span>Auto-assigned</span>
                    </p>
                  </div>

                  {/* Barcode (EAN-13) */}
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Barcode (EAN-13)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={formData.barcode}
                        placeholder="e.g. 2000000000425"
                        className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-800 dark:text-slate-200 cursor-default select-all outline-hidden"
                      />
                    </div>
                    <p className="mt-1 text-3xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                      <span>Auto-assigned</span>
                    </p>
                  </div>
                </div>

                {/* Category, HS Code & Tax Rate Section */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Category Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400">
                        Category *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCategoryModal(true)}
                        className="text-3xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold hover:underline transition-all cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          category: newCat,
                          sku: generateUniqueSKU(newCat, prev.brand, products, editingProduct?.id)
                        }));
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden font-medium"
                    >
                      {categoryDefinitions.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name} {!c.isDefault ? ' ⭐ [Custom]' : ''}
                        </option>
                      ))}
                      {/* Fallback if product has a legacy category not in definitions */}
                      {!categoryDefinitions.some(c => c.name === formData.category) && formData.category && (
                        <option value={formData.category}>{formData.category}</option>
                      )}
                    </select>
                  </div>

                  {/* HS Code Section */}
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      HS Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 3917.23.00"
                      value={formData.hsCode}
                      onChange={(e) => setFormData({ ...formData, hsCode: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden font-medium"
                    />
                    <p className="mt-1 text-3xs text-slate-400 dark:text-slate-500">Harmonized Tariff Code</p>
                  </div>

                  {/* Tax / VAT Dropdown */}
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Tax / VAT Rate *
                    </label>
                    <select
                      value={formData.taxRatePercent}
                      onChange={(e) => setFormData({ ...formData, taxRatePercent: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden font-medium"
                    >
                      <option value={13}>13% VAT</option>
                      <option value={0}>0% Tax exempt</option>
                    </select>
                    <p className="mt-1 text-3xs text-slate-400 dark:text-slate-500">
                      {formData.taxRatePercent === 13 ? 'Subject to 13% VAT' : 'Tax Exempt (0% कर छुट)'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Panchakanya, Jaquar, Astral, Kajaria"
                      value={formData.brand}
                      onChange={(e) => {
                        const newBrand = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          brand: newBrand,
                          sku: generateUniqueSKU(prev.category, newBrand, products, editingProduct?.id)
                        }));
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400">
                        Supplier
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSupplierModal(true)}
                        className="text-3xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold hover:underline transition-all cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                    <select
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-hidden font-medium"
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Units & Conversions Section */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Units of Measurement & Conversions
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs font-semibold text-slate-500 mb-1">Base Inventory Unit *</label>
                    <select
                      value={formData.baseUnit}
                      onChange={(e) => {
                        const selUnit = units.find(u => u.name === e.target.value);
                        setFormData({
                          ...formData,
                          baseUnit: e.target.value,
                          baseUnitSymbol: selUnit?.symbol || 'pcs'
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
                    Alternative Packaging Units (e.g. 1 Box = 50 Pcs, 1 Bundle = 10 Pcs)
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
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-2xs font-semibold transition-all"
                    >
                      + Add Packaging Unit
                    </button>
                  </div>

                  {formData.alternativeUnits.map((alt, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-2xs mb-1 font-mono">
                      <span>1 {alt.unitName} ({alt.unitSymbol}) = <strong>{alt.multiplierToBase}</strong> {formData.baseUnitSymbol}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAltUnit(idx)}
                        className="text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950"
                      >
                        Remove ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tiered Pricing (NPR) */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Cost Price (Landed Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Retail MRP (Counter Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formData.retailPrice}
                    onChange={(e) => setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-indigo-600 dark:text-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Wholesale Rate (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formData.wholesalePrice}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Dealer Rate (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.dealerPrice}
                    onChange={(e) => setFormData({ ...formData, dealerPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-amber-600 dark:text-amber-400"
                  />
                </div>
              </div>

              {/* Warehouse, Initial Stock & Bin */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Current Stock ({formData.baseUnitSymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Warehouse / Store
                  </label>
                  <select
                    value={formData.warehouseId}
                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Rack / Bin Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rack-A1, Bin-4"
                    value={formData.locationBin}
                    onChange={(e) => setFormData({ ...formData, locationBin: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Status and Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <label className="text-2xs font-semibold text-slate-500">Status:</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-2xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> {editingProduct ? 'Save Changes' : 'Create Product'}
                      </>
                    )}
                  </button>
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
              <button
                type="button"
                onClick={handleDeactivate}
                className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Deactivate / Discontinue (Recommended)
              </button>
              <p className="text-3xs text-slate-400 text-center px-2">
                Deactivating preserves past invoices and audit ledger history while hiding the item from POS counter.
              </p>

              <button
                type="button"
                onClick={handlePermanentDelete}
                className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all mt-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
              </button>

              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all mt-1"
              >
                Cancel
              </button>
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
