import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Edit3, ShoppingCart, Boxes, Warehouse as WarehouseIcon, 
  Tag, AlertTriangle, CheckCircle2, DollarSign, Building2, 
  MapPin, ShieldAlert, ArrowRight, Check, PackageCheck, Truck,
  FileText, Percent, Barcode, ChevronRight, Layers, ArrowUpRight, Plus, User, Phone,
  Trash2, Scale, RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StockItem, StockUnit } from '../../types';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';

interface StockItemDetailModalProps {
  stockItem: StockItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_UNITS: StockUnit[] = ['kg', 'g', 'L', 'ml', 'pcs', 'pack', 'box', 'bottle', 'can'];

export const StockItemDetailModal: React.FC<StockItemDetailModalProps> = ({
  stockItem,
  isOpen,
  onClose,
}) => {
  const { 
    stockItems, updateStockItem, deleteStockItem, 
    quickPurchaseStock, adjustStockItem, logStockWaste,
    suppliers, warehouses, stockMovements,
    rawStockCategories, addRawStockCategory
  } = useApp();

  // Mode: 'view' | 'edit' | 'purchase' | 'adjust' | 'waste'
  const [activeMode, setActiveMode] = useState<'view' | 'edit' | 'purchase' | 'adjust' | 'waste'>('view');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: '',
    brand: '',
    sku: '',
    barcode: '',
    hsCode: '',
    unit: 'kg',
    currentStock: 0,
    minReorderLevel: 5,
    costPrice: 0,
    supplierId: '',
    supplierName: '',
    supplierContact: '',
    supplierPan: '',
    storageLocation: '',
    storageRack: '',
    trackStock: true,
    status: 'active' as 'active' | 'inactive',
    notes: ''
  });

  // Action states
  const [purchaseQty, setPurchaseQty] = useState<number>(10);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState<number>(0);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState<string>('');
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');

  const [adjustTargetQty, setAdjustTargetQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Physical count reconciliation');

  const [wasteQty, setWasteQty] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState<string>('Expired / Spoilage');
  const [wasteNotes, setWasteNotes] = useState<string>('');

  // Keep stock item in sync with fresh context data
  const currentItem = useMemo(() => {
    if (!stockItem) return null;
    return stockItems.find(s => s.id === stockItem.id) || stockItem;
  }, [stockItems, stockItem]);

  // Sync state whenever active stock item changes
  useEffect(() => {
    if (currentItem) {
      setActiveMode('view');
      setNotification(null);
      setEditFormData({
        name: currentItem.name || '',
        category: currentItem.category || '',
        brand: currentItem.brand || '',
        sku: currentItem.sku || '',
        barcode: currentItem.barcode || '',
        hsCode: currentItem.hsCode || '',
        unit: currentItem.unit || 'kg',
        currentStock: Number(currentItem.currentStock || 0),
        minReorderLevel: Number(currentItem.minReorderLevel || 0),
        costPrice: Number(currentItem.costPrice || 0),
        supplierId: currentItem.supplierId || '',
        supplierName: currentItem.supplierName || '',
        supplierContact: currentItem.supplierContact || '',
        supplierPan: currentItem.supplierPan || '',
        storageLocation: currentItem.storageLocation || 'Main Kitchen Store',
        storageRack: currentItem.storageRack || '',
        trackStock: currentItem.trackStock !== false,
        status: currentItem.status || 'active',
        notes: currentItem.notes || ''
      });

      setPurchaseQty(10);
      setPurchaseUnitCost(currentItem.costPrice || 0);
      setPurchaseSupplierId(currentItem.supplierId || '');
      setPurchaseNotes('');

      setAdjustTargetQty(currentItem.currentStock || 0);
      setAdjustReason('Physical count reconciliation');

      setWasteQty(1);
      setWasteReason('Expired / Spoilage');
      setWasteNotes('');
    }
  }, [currentItem]);

  // Recent ledger activity for this item
  const itemLedger = useMemo(() => {
    if (!currentItem) return [];
    return stockMovements
      .filter(m => m.productId === currentItem.id || m.sku === currentItem.sku)
      .slice(0, 10);
  }, [stockMovements, currentItem]);

  if (!isOpen || !currentItem) return null;

  const isLowStock = currentItem.currentStock <= currentItem.minReorderLevel;
  const valuation = currentItem.currentStock * currentItem.costPrice;
  const supplierObj = suppliers.find(s => s.id === currentItem.supplierId);

  // Handle Save Edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;

    if (!editFormData.name.trim()) {
      setNotification({ message: 'Item name is required.', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const matchedSup = suppliers.find(s => s.id === editFormData.supplierId);
      const supplierName = matchedSup ? (matchedSup.companyName || matchedSup.name) : editFormData.supplierName;
      const supplierContact = matchedSup ? (matchedSup.phone || matchedSup.name || '') : editFormData.supplierContact;
      const supplierPan = matchedSup ? (matchedSup.panVatNumber || '') : editFormData.supplierPan;

      await updateStockItem(currentItem.id, {
        name: editFormData.name.trim(),
        category: editFormData.category.trim(),
        brand: editFormData.brand.trim(),
        sku: editFormData.sku.trim(),
        barcode: editFormData.barcode.trim(),
        hsCode: editFormData.hsCode.trim(),
        unit: editFormData.unit,
        minReorderLevel: Number(editFormData.minReorderLevel) || 0,
        costPrice: Number(editFormData.costPrice) || 0,
        supplierId: editFormData.supplierId,
        supplierName,
        supplierContact,
        supplierPan,
        storageLocation: editFormData.storageLocation.trim() || 'Main Kitchen Store',
        storageRack: editFormData.storageRack.trim(),
        trackStock: editFormData.trackStock,
        status: editFormData.status,
        notes: editFormData.notes.trim()
      });

      setNotification({ message: 'Stock item updated successfully.', type: 'success' });
      setTimeout(() => {
        setNotification(null);
        setActiveMode('view');
      }, 700);
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to update item', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Quick Purchase (Inward Stock)
  const handleConfirmPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;
    if (purchaseQty <= 0) {
      setNotification({ message: 'Please enter a valid purchase quantity greater than 0.', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      await quickPurchaseStock(
        currentItem.id,
        purchaseQty,
        purchaseUnitCost > 0 ? purchaseUnitCost : currentItem.costPrice,
        purchaseSupplierId || currentItem.supplierId,
        purchaseNotes
      );
      setNotification({ message: `Successfully added ${purchaseQty} ${currentItem.unit} to stock.`, type: 'success' });
      setTimeout(() => {
        setNotification(null);
        setActiveMode('view');
      }, 700);
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to record purchase', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Stock Audit Adjustment
  const handleConfirmAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;
    try {
      setIsSubmitting(true);
      await adjustStockItem(currentItem.id, adjustTargetQty, adjustReason);
      setNotification({ message: `Physical stock reconciled to ${adjustTargetQty} ${currentItem.unit}.`, type: 'success' });
      setTimeout(() => {
        setNotification(null);
        setActiveMode('view');
      }, 700);
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to adjust stock', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Log Spoilage / Waste
  const handleConfirmWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;
    if (wasteQty <= 0) {
      setNotification({ message: 'Please enter a valid waste quantity.', type: 'error' });
      return;
    }
    try {
      setIsSubmitting(true);
      await logStockWaste(currentItem.id, wasteQty, wasteReason, wasteNotes);
      setNotification({ message: `Deducted ${wasteQty} ${currentItem.unit} due to ${wasteReason}.`, type: 'success' });
      setTimeout(() => {
        setNotification(null);
        setActiveMode('view');
      }, 700);
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to record waste', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteItem = async () => {
    if (!currentItem) return;
    if (window.confirm(`Are you sure you want to remove "${currentItem.name}" from raw stock inventory?`)) {
      await deleteStockItem(currentItem.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER (Matching screenshot layout) */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Product Stock Details
                </h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider ${
                  isLowStock 
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800' 
                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                }`}>
                  {isLowStock ? 'LOW STOCK' : 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeMode === 'view' ? (
              <button
                type="button"
                onClick={() => setActiveMode('edit')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveMode('view')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Cancel</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION BANNER */}
        {notification && (
          <div className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0 ${
            notification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-b border-rose-200 dark:border-rose-800'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          
          {/* VIEW MODE */}
          {activeMode === 'view' && (
            <>
              {/* CARD 1: PRODUCT NAME & AVAILABLE STOCK (Exact screenshot layout) */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800">
                <span className="text-3xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
                  PRODUCT NAME
                </span>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {currentItem.name}
                </h1>
                
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                      AVAILABLE STOCK:
                    </span>
                    <span className={`text-base font-mono font-bold ${
                      isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                    }`}>
                      {currentItem.currentStock} {currentItem.unit}
                    </span>
                    {isLowStock && (
                      <span className="inline-flex items-center gap-1 text-3xs font-bold text-rose-600 dark:text-rose-400 ml-1">
                        <AlertTriangle className="w-3 h-3" /> (Low Stock)
                      </span>
                    )}
                  </div>
                  
                  <div className="text-3xs text-slate-500">
                    <span>Safety: <strong className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{currentItem.minReorderLevel} {currentItem.unit}</strong></span>
                  </div>
                </div>
              </div>

              {/* CARD 2: TOTAL STOCK VALUATION & UNIT COST PRICE (Exact screenshot layout) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                    TOTAL STOCK VALUATION
                  </p>
                  <div className="mt-1">
                    <span className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatNPR(valuation)}
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                    UNIT COST PRICE
                  </p>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base mt-1">
                    {formatNPR(currentItem.costPrice)} / {currentItem.unit}
                  </p>
                </div>
              </div>

              {/* CARD 3: PRODUCT CLASSIFICATION & CODES */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 bg-white dark:bg-slate-900">
                <h3 className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  Product Classification & Codes
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">SKU Code</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {currentItem.sku || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">HS Code</span>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {currentItem.hsCode || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">Category</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentItem.category || 'General Ingredients'}
                    </span>
                  </div>

                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">Brand / Manufacturer</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentItem.brand || 'In-House Kitchen'}
                    </span>
                  </div>

                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">Base Unit</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentItem.unit}
                    </span>
                  </div>

                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">Barcode</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {currentItem.barcode || '—'}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-3xs text-slate-400 block uppercase">Recipe Auto-Tracking</span>
                    <span className={`inline-flex items-center gap-1 font-semibold text-2xs px-2 py-0.5 rounded-full mt-0.5 ${
                      currentItem.trackStock !== false 
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {currentItem.trackStock !== false ? '● Auto-deduct on KOT' : '○ Manual tracking only'}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 4: STORAGE & PRIMARY SUPPLIER (Side by side cards matching screenshot) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Storage & Location */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
                  <h3 className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    Storage & Location
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-3xs text-slate-400 block uppercase">Assigned Godown</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {currentItem.storageLocation || 'Main Kitchen Store'}
                      </span>
                    </div>
                    <div>
                      <span className="text-3xs text-slate-400 block uppercase">Specific Rack / Bin</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {currentItem.storageRack || 'Showroom Floor / Kitchen Shelf'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Supplier */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
                  <h3 className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                    Primary Supplier
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-3xs text-slate-400 block uppercase">Supplier Firm</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {supplierObj ? (supplierObj.companyName || supplierObj.name) : (currentItem.supplierName || 'Direct / Local Supplier')}
                      </span>
                    </div>
                    <div>
                      <span className="text-3xs text-slate-400 block uppercase">Contact Person & Phone / PAN</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {supplierObj?.phone || currentItem.supplierContact || supplierObj?.panVatNumber || currentItem.supplierPan || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RECENT ITEM MOVEMENTS (Mini Activity) */}
              {itemLedger.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-800/30">
                  <h4 className="text-3xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Recent Activity for this item</span>
                    <span className="font-normal">{itemLedger.length} events</span>
                  </h4>
                  <div className="space-y-1.5">
                    {itemLedger.map(m => (
                      <div key={m.id} className="text-2xs flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/40 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            m.quantityIn > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {m.notes || m.movementType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className={m.quantityIn > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                            {m.quantityIn > 0 ? `+${m.quantityIn}` : `-${m.quantityOut}`} {currentItem.unit}
                          </span>
                          <span className="text-3xs text-slate-400">{formatDate(m.date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* EDIT FORM */}
          {activeMode === 'edit' && (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Raw Material / Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-3xs font-bold text-slate-500 uppercase">
                      Category
                    </label>
                    {!isAddingNewCategory && (
                      <button
                        type="button"
                        onClick={() => setIsAddingNewCategory(true)}
                        className="text-3xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Category</span>
                      </button>
                    )}
                  </div>

                  {isAddingNewCategory ? (
                    <div className="flex items-center gap-1.5 p-1.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg">
                      <input
                        type="text"
                        autoFocus
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="New category name..."
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 outline-hidden"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newCategoryName.trim()) {
                              const added = await addRawStockCategory(newCategoryName.trim());
                              setEditFormData({ ...editFormData, category: added });
                              setNewCategoryName('');
                              setIsAddingNewCategory(false);
                            }
                          }
                          if (e.key === 'Escape') setIsAddingNewCategory(false);
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (newCategoryName.trim()) {
                            const added = await addRawStockCategory(newCategoryName.trim());
                            setEditFormData({ ...editFormData, category: added });
                            setNewCategoryName('');
                            setIsAddingNewCategory(false);
                          }
                        }}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewCategory(false);
                          setNewCategoryName('');
                        }}
                        className="px-1.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">{rawStockCategories.length === 0 ? 'No categories yet' : 'Select a Category...'}</option>
                        {rawStockCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewCategory(true)}
                        className="px-2.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Base Measurement Unit *
                  </label>
                  <select
                    value={editFormData.unit}
                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    {COMMON_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Cost Price (NPR per unit) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editFormData.costPrice}
                    onChange={(e) => setEditFormData({ ...editFormData, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Min Reorder Safety Level ({editFormData.unit}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editFormData.minReorderLevel}
                    onChange={(e) => setEditFormData({ ...editFormData, minReorderLevel: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Primary Supplier
                  </label>
                  <select
                    value={editFormData.supplierId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const sup = suppliers.find(s => s.id === id);
                      setEditFormData({
                        ...editFormData,
                        supplierId: id,
                        supplierName: sup ? (sup.companyName || sup.name) : editFormData.supplierName
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Select Existing Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.companyName || s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Storage Location / Godown
                  </label>
                  <input
                    type="text"
                    value={editFormData.storageLocation}
                    onChange={(e) => setEditFormData({ ...editFormData, storageLocation: e.target.value })}
                    placeholder="e.g. Main Kitchen Cold Room"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Specific Rack / Shelf / Bin
                  </label>
                  <input
                    type="text"
                    value={editFormData.storageRack}
                    onChange={(e) => setEditFormData({ ...editFormData, storageRack: e.target.value })}
                    placeholder="e.g. Freezer Shelf 2"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    SKU Code / Barcode
                  </label>
                  <input
                    type="text"
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    placeholder="e.g. RAW-CHK-01"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <div>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                      Auto-Deduct in Dish Recipes (KOT)
                    </span>
                    <span className="text-3xs text-slate-500">
                      When active, orders sent to kitchen deduct portion quantities automatically from this stock.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editFormData.trackStock}
                    onChange={(e) => setEditFormData({ ...editFormData, trackStock: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Item</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMode('view')}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* QUICK PURCHASE STOCK INWARD FORM */}
          {activeMode === 'purchase' && (
            <form onSubmit={handleConfirmPurchase} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/40 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center gap-3">
                <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-100">
                    Receive Raw Stock Inward: {currentItem.name}
                  </h4>
                  <p className="text-3xs text-blue-700 dark:text-blue-300">
                    Current Balance: {currentItem.currentStock} {currentItem.unit}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Quantity Received ({currentItem.unit}) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Purchase Rate / Cost (NPR per {currentItem.unit}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={purchaseUnitCost}
                    onChange={(e) => setPurchaseUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Supplier / Vendor
                  </label>
                  <select
                    value={purchaseSupplierId}
                    onChange={(e) => setPurchaseSupplierId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">{currentItem.supplierName || 'Select Vendor'}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.companyName || s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Notes / Bill / Batch Ref
                  </label>
                  <input
                    type="text"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    placeholder="e.g. Bill #PO-409, Fresh Morning Batch"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs flex items-center justify-between font-mono">
                <span className="text-slate-600 dark:text-slate-400">Total Purchase Value:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {formatNPR(purchaseQty * purchaseUnitCost)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('view')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || purchaseQty <= 0}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Inward'}
                </button>
              </div>
            </form>
          )}

          {/* STOCK AUDIT / ADJUSTMENT FORM */}
          {activeMode === 'adjust' && (
            <form onSubmit={handleConfirmAdjustment} className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900 flex items-center gap-3">
                <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-100">
                    Physical Inventory Reconciliation: {currentItem.name}
                  </h4>
                  <p className="text-3xs text-amber-700 dark:text-amber-300">
                    System balance: {currentItem.currentStock} {currentItem.unit}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Actual Physical Count ({currentItem.unit}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={adjustTargetQty}
                    onChange={(e) => setAdjustTargetQty(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                  <p className="text-3xs text-slate-500 mt-1">
                    Variance: <strong className={adjustTargetQty >= currentItem.currentStock ? 'text-emerald-600' : 'text-rose-600'}>
                      {adjustTargetQty - currentItem.currentStock > 0 ? `+${adjustTargetQty - currentItem.currentStock}` : adjustTargetQty - currentItem.currentStock} {currentItem.unit}
                    </strong>
                  </p>
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Audit Reason
                  </label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Physical count reconciliation">Physical count reconciliation</option>
                    <option value="Kitchen opening audit">Kitchen opening audit</option>
                    <option value="End-of-day closing count">End-of-day closing count</option>
                    <option value="Scale calibration adjustment">Scale calibration adjustment</option>
                    <option value="Other count variance">Other count variance</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('view')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Adjusting...' : 'Confirm Audit Balance'}
                </button>
              </div>
            </form>
          )}

          {/* SPOILAGE / WASTE FORM */}
          {activeMode === 'waste' && (
            <form onSubmit={handleConfirmWaste} className="space-y-4">
              <div className="bg-rose-50 dark:bg-rose-950/40 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-rose-900 dark:text-rose-100">
                    Log Spoilage / Food Waste: {currentItem.name}
                  </h4>
                  <p className="text-3xs text-rose-700 dark:text-rose-300">
                    Available: {currentItem.currentStock} {currentItem.unit}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Waste Quantity ({currentItem.unit}) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max={currentItem.currentStock}
                    step="any"
                    required
                    value={wasteQty}
                    onChange={(e) => setWasteQty(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Waste Reason *
                  </label>
                  <select
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Expired / Spoilage">Expired / Spoilage</option>
                    <option value="Trimming & Prep Loss">Trimming & Prep Loss</option>
                    <option value="Burnt / Overcooked">Burnt / Overcooked</option>
                    <option value="Freezer Burn / Temperature Fault">Freezer Burn / Temperature Fault</option>
                    <option value="Dropped / Contaminated">Dropped / Contaminated</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-3xs font-bold text-slate-500 uppercase mb-1">
                    Kitchen Notes
                  </label>
                  <input
                    type="text"
                    value={wasteNotes}
                    onChange={(e) => setWasteNotes(e.target.value)}
                    placeholder="Details about waste cause..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('view')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || wasteQty <= 0}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Logging...' : 'Record Spoilage'}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* MODAL FOOTER (Matching screenshot layout with Close & Purchase Stock) */}
        {activeMode === 'view' && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
            {/* Quick action buttons on left */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveMode('adjust')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Adjust Count</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('waste')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Log Waste</span>
              </button>
            </div>

            {/* Close & Primary Purchase Button (Matching screenshot layout) */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('purchase')}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Purchase Stock</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
