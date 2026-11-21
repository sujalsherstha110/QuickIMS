import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, AlertTriangle, ArrowRight, Filter, Search, 
  ArrowLeftRight, AlertCircle, Building2, Truck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNPR } from '../../utils/nepalFormatters';
import { Product } from '../../types';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  initialProductId
}) => {
  const { 
    products, warehouses, categories: categoryDefinitions, 
    suppliers, recordStockTransfer, currentUser, currentWarehouseId,
    activePOSStaff, activeStaffUser
  } = useApp();
  const currentOperator = activePOSStaff || activeStaffUser;

  // Filters for product selection
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Product
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || products[0]?.id || ''
  );

  // Warehouses
  const [fromWarehouseId, setFromWarehouseId] = useState<string>(
    currentWarehouseId || warehouses[0]?.id || 'wh-main'
  );
  const [toWarehouseId, setToWarehouseId] = useState<string>(
    warehouses.find(w => w.id !== (currentWarehouseId || warehouses[0]?.id))?.id || warehouses[1]?.id || 'wh-godown'
  );

  // Transfer Quantity & Notes
  const [transferQuantity, setTransferQuantity] = useState<number>(5);
  const [notes, setNotes] = useState('Inter-godown stock replenishment');

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

  // Filtered products list
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

  // Auto-sync selected product when filters change
  useEffect(() => {
    if (filteredProducts.length > 0 && !filteredProducts.some(p => p.id === selectedProductId)) {
      setSelectedProductId(filteredProducts[0].id);
    }
  }, [filteredProducts, selectedProductId]);

  const selectedProduct: Product | undefined = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || filteredProducts[0];
  }, [products, selectedProductId, filteredProducts]);

  const availableStock = selectedProduct ? selectedProduct.currentStock : 0;
  const baseUnit = selectedProduct?.baseUnitSymbol || 'pcs';

  // Dynamic Validation checks
  const isSameWarehouse = fromWarehouseId === toWarehouseId;
  const isExceedingStock = transferQuantity > availableStock;
  const isInvalidQuantity = transferQuantity <= 0 || isNaN(transferQuantity);

  const fromWarehouseObj = warehouses.find(w => w.id === fromWarehouseId);
  const toWarehouseObj = warehouses.find(w => w.id === toWarehouseId);

  // Reset filters
  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedBrand('ALL');
    setSelectedSupplier('ALL');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory !== 'ALL' || selectedBrand !== 'ALL' || selectedSupplier !== 'ALL' || !!searchQuery.trim();

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !fromWarehouseObj || !toWarehouseObj) return;
    if (isSameWarehouse || isExceedingStock || isInvalidQuantity) return;

    await recordStockTransfer({
      transferNumber: `TRF-${Date.now().toString().slice(-6)}`,
      date: Date.now(),
      fromWarehouseId: fromWarehouseObj.id,
      fromWarehouseName: fromWarehouseObj.name,
      toWarehouseId: toWarehouseObj.id,
      toWarehouseName: toWarehouseObj.name,
      items: [{
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        quantity: transferQuantity,
        unitCost: selectedProduct.costPrice
      }],
      status: 'completed',
      notes: notes.trim() || `Transferred from ${fromWarehouseObj.name} to ${toWarehouseObj.name}`,
      initiatedBy: currentOperator?.name || currentUser.name
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
              <ArrowLeftRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Transfer Stock Between Godowns</span>
            </h3>
            <p className="text-2xs text-slate-500 mt-0.5">
              Filter products by category, brand, and supplier, and dynamically allocate quantities between locations.
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

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by item name, SKU code, or barcode..."
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

        {/* TRANSFER FORM */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {/* Source & Destination Warehouse Routing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Source Godown (From) *
              </label>
              <select
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Destination Godown (To) *
              </label>
              <select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {isSameWarehouse && (
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-2xs flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Source and destination godowns cannot be identical. Please select different locations.</span>
            </div>
          )}

          {/* Product Selection */}
          <div>
            <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Item to Transfer *
              <span className="font-normal text-slate-400 ml-1">
                ({filteredProducts.length} items match filters)
              </span>
            </label>
            {filteredProducts.length === 0 ? (
              <div className="p-2.5 border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-amber-800 dark:text-amber-300 text-2xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>No products found matching these filters. Try adjusting or clearing filters above.</span>
              </div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — [SKU: {p.sku}] (Available: {p.currentStock} {p.baseUnitSymbol})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Product Snapshot */}
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

              {/* Row 3: Brand & Stock in Source */}
              <div className="flex items-center justify-between">
                <div className="text-slate-600 dark:text-slate-400">
                  Brand: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProduct.brand || 'N/A'}</span>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  Stock in Source: <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold">{availableStock} {baseUnit}</strong>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: DYNAMIC TRANSFER QUANTITY COORDINATION */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3 bg-white dark:bg-slate-900/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300">
                  Transfer Quantity ({baseUnit}) *
                </label>
                <span className="text-3xs text-slate-500">
                  Max available in source: <strong className="font-mono">{availableStock} {baseUnit}</strong>
                </span>
              </div>

              {/* Quick Fill Chips */}
              <div className="flex items-center gap-1.5">
                {[5, 10, 25].map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setTransferQuantity(q)}
                    disabled={availableStock < q}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-3xs font-mono font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    +{q}
                  </button>
                ))}
                {availableStock > 0 && (
                  <button
                    type="button"
                    onClick={() => setTransferQuantity(availableStock)}
                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-3xs font-mono font-bold text-blue-600 dark:text-blue-400 cursor-pointer"
                  >
                    All ({availableStock})
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="any"
                max={availableStock}
                required
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(parseFloat(e.target.value) || 0)}
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-lg p-2 font-mono font-bold text-sm outline-hidden ${
                  isExceedingStock 
                    ? 'border-rose-500 text-rose-600 focus:border-rose-600' 
                    : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500'
                }`}
              />
              <span className="absolute right-2.5 top-2.5 text-2xs font-medium text-slate-400">
                {baseUnit}
              </span>
            </div>

            {/* Warning if exceeding */}
            {isExceedingStock && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-2xs flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Cannot transfer {transferQuantity} {baseUnit}. Only {availableStock} {baseUnit} available in {fromWarehouseObj?.name || 'source'}.</span>
              </div>
            )}

            {/* LIVE DYNAMIC TRANSFER IMPACT PREVIEW */}
            <div className="p-3 rounded-xl border border-blue-200/70 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div>
                  <span className="block text-3xs font-semibold text-slate-500 uppercase">
                    From: {fromWarehouseObj?.name || 'Source'}
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {availableStock} ➔ <span className="text-rose-600 font-bold">{Math.max(0, availableStock - transferQuantity)}</span> {baseUnit}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-blue-500 shrink-0" />

                <div>
                  <span className="block text-3xs font-semibold text-slate-500 uppercase">
                    To: {toWarehouseObj?.name || 'Destination'}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    +{transferQuantity} {baseUnit}
                  </span>
                </div>
              </div>

              <div className="text-right border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto text-2xs">
                <span className="text-slate-500 block">Transfer Value:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatNPR(transferQuantity * (selectedProduct?.costPrice || 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Haulage / Transport Notes */}
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <span>Haulage / Vehicle & Transit Notes</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Sent via Tata Ace Ba 2 Ja 4521, Driver: Ram Bahadur..."
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
              disabled={isSameWarehouse || isExceedingStock || isInvalidQuantity || !selectedProduct}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Complete Transfer
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
