import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, AlertTriangle, CheckCircle2, ArrowRight, Filter, Search, 
  Package, Tag, Building2, Calculator, Layers, AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNPR } from '../../utils/nepalFormatters';
import { Product } from '../../types';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  initialProductId
}) => {
  const { 
    products, warehouses, categories: categoryDefinitions, 
    suppliers, recordStockAdjustment, currentUser, currentWarehouseId,
    activePOSStaff, activeStaffUser
  } = useApp();
  const currentOperator = activePOSStaff || activeStaffUser;

  // Filters for product selection
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Product & Warehouse
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || products[0]?.id || ''
  );
  const [warehouseId, setWarehouseId] = useState<string>(
    currentWarehouseId || warehouses[0]?.id || 'wh-main'
  );

  // Adjustment Type
  const [adjType, setAdjType] = useState<'damage' | 'loss' | 'found' | 'correction' | 'internal_use'>('damage');
  
  // Correction sub-mode: 'difference' or 'counted'
  const [correctionMode, setCorrectionMode] = useState<'difference' | 'counted'>('difference');

  // Input quantities
  const [unitsInput, setUnitsInput] = useState<number>(1);
  const [physicalCountInput, setPhysicalCountInput] = useState<number>(0);
  const [reason, setReason] = useState('Breakage / damage during transit from godown');

  // Unique categories list
  const categoryList = useMemo(() => {
    const cats = new Set<string>();
    categoryDefinitions?.forEach(c => cats.add(c.name));
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return ['ALL', ...Array.from(cats).sort()];
  }, [categoryDefinitions, products]);

  // Unique brands list
  const brandList = useMemo(() => {
    const brands = new Set<string>();
    products.forEach(p => { if (p.brand) brands.add(p.brand); });
    return ['ALL', ...Array.from(brands).sort()];
  }, [products]);

  // Filtered products list based on category, brand, supplier, and search
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchBrand = selectedBrand === 'ALL' || p.brand === selectedBrand;
      const matchSup = selectedSupplier === 'ALL' || 
        p.supplierId === selectedSupplier || 
        p.supplierName === selectedSupplier;
      const q = String(searchQuery || '').toLowerCase();
      const matchSearch = !searchQuery.trim() || 
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.sku || '').toLowerCase().includes(q) ||
        (p.barcode && String(p.barcode).includes(searchQuery));
      return matchCat && matchBrand && matchSup && matchSearch && p.status === 'active';
    });
  }, [products, selectedCategory, selectedBrand, selectedSupplier, searchQuery]);

  // If selectedProductId is not in filtered list, auto-select first matching product
  useEffect(() => {
    if (filteredProducts.length > 0 && !filteredProducts.some(p => p.id === selectedProductId)) {
      setSelectedProductId(filteredProducts[0].id);
    }
  }, [filteredProducts, selectedProductId]);

  // Target product
  const selectedProduct: Product | undefined = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || filteredProducts[0];
  }, [products, selectedProductId, filteredProducts]);

  const currentStock = selectedProduct ? selectedProduct.currentStock : 0;
  const baseUnit = selectedProduct?.baseUnitSymbol || 'pcs';

  // Sync physicalCountInput default when product changes
  useEffect(() => {
    if (selectedProduct) {
      setPhysicalCountInput(selectedProduct.currentStock);
    }
  }, [selectedProduct?.id, selectedProduct?.currentStock]);

  // Dynamically calculate quantityDelta based on adjType and inputs
  const quantityDelta = useMemo(() => {
    const absQty = Math.max(0, unitsInput || 0);
    switch (adjType) {
      case 'damage':
      case 'loss':
      case 'internal_use':
        return -absQty;
      case 'found':
        return absQty;
      case 'correction':
        if (correctionMode === 'counted') {
          return physicalCountInput - currentStock;
        }
        return unitsInput; // Can be positive or negative
      default:
        return -absQty;
    }
  }, [adjType, unitsInput, correctionMode, physicalCountInput, currentStock]);

  // Resulting stock after adjustment
  const projectedStock = currentStock + quantityDelta;
  const isNegativeResult = projectedStock < 0;
  const isZeroDelta = quantityDelta === 0;

  // Handle Adjustment Type Change & coordinate dynamic defaults
  const handleTypeChange = (newType: typeof adjType) => {
    setAdjType(newType);
    if (newType === 'damage') {
      setReason('Breakage / damage during transit from godown');
    } else if (newType === 'loss') {
      setReason('Physical shortage / missing item identified during audit');
    } else if (newType === 'internal_use') {
      setReason('Utilized for showroom display / internal maintenance repair');
    } else if (newType === 'found') {
      setReason('Unrecorded surplus stock found during physical count');
    } else if (newType === 'correction') {
      setReason('Physical inventory reconciliation and count adjustment');
      if (selectedProduct) {
        setPhysicalCountInput(selectedProduct.currentStock);
      }
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedBrand('ALL');
    setSelectedSupplier('ALL');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory !== 'ALL' || selectedBrand !== 'ALL' || selectedSupplier !== 'ALL' || !!searchQuery.trim();

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (isNegativeResult) return;
    if (isZeroDelta) return;

    const wh = warehouses.find(w => w.id === warehouseId) || warehouses[0];

    await recordStockAdjustment({
      date: Date.now(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      warehouseId: wh.id,
      warehouseName: wh.name,
      type: adjType,
      quantityDelta: quantityDelta,
      unitCost: selectedProduct.costPrice,
      reason: reason.trim() || `${adjType.toUpperCase()} adjustment`,
      performedBy: currentOperator?.name || currentUser.name
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-2xl w-full shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Record Stock Adjustment</span>
            </h3>
            <p className="text-2xs text-slate-500 mt-0.5">
              Filter by category, brand, and supplier to reconcile stock, write off damage, or log physical surplus.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SECTION 1: FILTER PROCESS (Category, Brand, Supplier, Search) */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3 text-blue-500" />
              <span>Filter Items</span>
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* Category Filter */}
            <div>
              <label className="block text-3xs font-medium text-slate-500 dark:text-slate-400 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Categories ({products.length})</option>
                {categoryList.filter(c => c !== 'ALL').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div>
              <label className="block text-3xs font-medium text-slate-500 dark:text-slate-400 mb-1">Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Brands</option>
                {brandList.filter(b => b !== 'ALL').map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Supplier Filter */}
            <div>
              <label className="block text-3xs font-medium text-slate-500 dark:text-slate-400 mb-1">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by product name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {/* Product Select Dropdown (Filtered) & Target Warehouse */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Product to Adjust * 
                <span className="font-normal text-slate-400 ml-1">
                  ({filteredProducts.length} items match filters)
                </span>
              </label>
              {filteredProducts.length === 0 ? (
                <div className="p-2.5 border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-amber-800 dark:text-amber-300 text-2xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No products found matching these filters. Try resetting filters above.</span>
                </div>
              ) : (
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {filteredProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — [SKU: {p.sku}] (Stock: {p.currentStock} {p.baseUnitSymbol})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Godown / Location
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Product Info Snapshot */}
          {selectedProduct && (
            <div className="bg-slate-100/80 dark:bg-slate-800/40 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-800 text-2xs space-y-1">
              {/* Row 1: Product Name */}
              <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                {selectedProduct.name}
              </div>

              {/* Row 2: SKU & Cost */}
              <div className="flex items-center justify-between">
                <div className="text-slate-600 dark:text-slate-400">
                  SKU: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedProduct.sku}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  Cost: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatNPR(selectedProduct.costPrice)}</strong>
                </div>
              </div>

              {/* Row 3: Brand & Current Stock */}
              <div className="flex items-center justify-between">
                <div className="text-slate-600 dark:text-slate-400">
                  Brand: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProduct.brand || 'N/A'}</span>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  Current Stock: <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold">{selectedProduct.currentStock} {baseUnit}</strong>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: ADJUSTMENT TYPE & DYNAMIC COORDINATION */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3 bg-white dark:bg-slate-900/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Adjustment Type Selector */}
              <div>
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={adjType}
                  onChange={(e) => handleTypeChange(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="damage">Damaged Stock (हानी / टुटफुट) ➔ Deducts (-)</option>
                  <option value="loss">Loss / Theft / Missing (हराएको / चोरी) ➔ Deducts (-)</option>
                  <option value="internal_use">Internal Workshop Use (आन्तरिक प्रयोजन) ➔ Deducts (-)</option>
                  <option value="found">Physical Surplus / Found (बढी भेटिएको) ➔ Adds (+)</option>
                  <option value="correction">Physical Count Reconciliation (गणना मिलान) ➔ Reconcile (+/-)</option>
                </select>

                <div className="mt-1.5 flex items-center gap-1.5 text-3xs">
                  {['damage', 'loss', 'internal_use'].includes(adjType) && (
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                      Auto-reduces current stock balance
                    </span>
                  )}
                  {adjType === 'found' && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Auto-increases stock with audit log
                    </span>
                  )}
                  {adjType === 'correction' && (
                    <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      Adjusts to match physical shelf count
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity Input Coordinating Dynamically */}
              <div>
                {adjType === 'correction' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300">
                        {correctionMode === 'counted' ? 'Physical Counted Stock' : 'Difference Delta (+/-)'}
                      </label>
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded text-3xs">
                        <button
                          type="button"
                          onClick={() => setCorrectionMode('counted')}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${correctionMode === 'counted' ? 'bg-white dark:bg-slate-700 font-bold shadow-2xs' : 'text-slate-500'}`}
                        >
                          Shelf Count
                        </button>
                        <button
                          type="button"
                          onClick={() => setCorrectionMode('difference')}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${correctionMode === 'difference' ? 'bg-white dark:bg-slate-700 font-bold shadow-2xs' : 'text-slate-500'}`}
                        >
                          Delta (+/-)
                        </button>
                      </div>
                    </div>

                    {correctionMode === 'counted' ? (
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={physicalCountInput}
                          onChange={(e) => setPhysicalCountInput(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                        />
                        <span className="absolute right-2.5 top-2.5 text-2xs text-slate-400 font-medium">
                          {baseUnit}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          value={unitsInput}
                          onChange={(e) => setUnitsInput(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                        />
                        <span className="absolute right-2.5 top-2.5 text-2xs text-slate-400 font-medium">
                          {baseUnit}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {['damage', 'loss', 'internal_use'].includes(adjType) ? (
                        <span>Quantity to Deduct ({baseUnit}) *</span>
                      ) : (
                        <span>Quantity to Add ({baseUnit}) *</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={unitsInput}
                        onChange={(e) => setUnitsInput(Math.abs(parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-sm text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                      />
                      <span className="absolute right-2.5 top-2.5 text-2xs font-medium text-slate-400">
                        {baseUnit}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* LIVE DYNAMIC IMPACT PREVIEW */}
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
              isNegativeResult 
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200' 
                : 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/70 dark:border-blue-800/40'
            }`}>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="text-center sm:text-left">
                  <span className="block text-3xs font-semibold text-slate-500 uppercase">Current Stock</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {currentStock} {baseUnit}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                <div className="text-center sm:text-left">
                  <span className="block text-3xs font-semibold text-slate-500 uppercase">Delta</span>
                  <span className={`font-mono font-bold text-sm px-1.5 py-0.5 rounded ${
                    quantityDelta < 0 
                      ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' 
                      : quantityDelta > 0 
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}>
                    {quantityDelta > 0 ? `+${quantityDelta}` : quantityDelta} {baseUnit}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                <div className="text-center sm:text-left">
                  <span className="block text-3xs font-semibold text-slate-500 uppercase">Resulting Stock</span>
                  <span className={`font-mono font-bold text-sm ${isNegativeResult ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>
                    {projectedStock} {baseUnit}
                  </span>
                </div>
              </div>

              <div className="text-right border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto text-2xs">
                <span className="text-slate-500 block">Valuation Impact:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {quantityDelta < 0 ? '-' : '+'}{formatNPR(Math.abs(quantityDelta) * (selectedProduct?.costPrice || 0))}
                </span>
              </div>
            </div>

            {/* Error banner if trying to reduce below 0 */}
            {isNegativeResult && (
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-2xs flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Cannot reduce stock below 0. Available quantity is only {currentStock} {baseUnit}.</span>
              </div>
            )}

            {/* Warning if delta is 0 */}
            {isZeroDelta && (
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-2xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Quantity delta is 0. Please specify a non-zero adjustment amount.</span>
              </div>
            )}
          </div>

          {/* Reason / Remarks */}
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Adjustment Reason / Remarks *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Broken during unloading, physical audit difference..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isNegativeResult || isZeroDelta || !selectedProduct}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Save Adjustment
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
