import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Edit3, ShoppingCart, Boxes, Warehouse as WarehouseIcon, 
  Tag, AlertTriangle, CheckCircle2, DollarSign, Building2, 
  MapPin, ShieldAlert, ArrowRight, Check, PackageCheck, Truck,
  FileText, Percent, Barcode, ChevronRight, Layers, ArrowUpRight, Plus, User, Phone
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, PurchaseInvoice, PurchaseItem, UnitConversion } from '../../types';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { 
  generateUniqueSKU, 
  generateUniqueBarcode, 
  checkSkuDuplicate, 
  checkBarcodeDuplicate 
} from '../../utils/codeGenerator';
import { CategoryManagerModal } from '../products/CategoryManagerModal';
import { QuickAddSupplierModal } from '../suppliers/QuickAddSupplierModal';

interface ProductStockDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPurchases?: (productId: string) => void;
}

export const ProductStockDetailModal: React.FC<ProductStockDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onNavigateToPurchases,
}) => {
  const { 
    products, updateProduct, recordPurchase, suppliers, 
    warehouses, categories, units, currentUser 
  } = useApp();

  // Mode: 'view' | 'edit' | 'purchase'
  const [activeMode, setActiveMode] = useState<'view' | 'edit' | 'purchase'>('view');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Edit form state (mirrors ProductsView)
  const [editFormData, setEditFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: '',
    subcategory: '',
    brand: '',
    hsCode: '',
    supplierId: '',
    baseUnit: 'Piece',
    baseUnitSymbol: 'pcs',
    alternativeUnits: [] as UnitConversion[],
    costPrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
    dealerPrice: 0,
    taxRatePercent: 13,
    currentStock: 0,
    reorderLevel: 5,
    warehouseId: 'wh-main',
    locationBin: '',
    hasVariants: false,
    warrantyMonths: 0,
    status: 'active' as 'active' | 'inactive' | 'discontinued'
  });

  // Real-time Duplicate Detection
  const skuDuplicate = useMemo(() => {
    return checkSkuDuplicate(editFormData.sku, products, product?.id);
  }, [editFormData.sku, products, product]);

  const barcodeDuplicate = useMemo(() => {
    return checkBarcodeDuplicate(editFormData.barcode, products, product?.id);
  }, [editFormData.barcode, products, product]);

  const [tempAltUnitName, setTempAltUnitName] = useState('Box');
  const [tempAltUnitSymbol, setTempAltUnitSymbol] = useState('box');
  const [tempAltMultiplier, setTempAltMultiplier] = useState(10);

  // Purchase state
  const [purchaseQty, setPurchaseQty] = useState(10);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState(0);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [purchaseWarehouseId, setPurchaseWarehouseId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'cheque' | 'credit'>('bank_transfer');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Sync state whenever active product changes or modal opens
  useEffect(() => {
    if (product) {
      setActiveMode('view');
      setNotification(null);

      // Populate edit fields to match full product specifications
      setEditFormData({
        sku: product.sku || '',
        barcode: product.barcode || '',
        name: product.name || '',
        category: product.category || (categories[0]?.name || 'Pipes & Fittings'),
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

      // Populate purchase fields
      setPurchaseQty(Math.max(10, product.reorderLevel * 2));
      setPurchaseUnitCost(product.costPrice);
      setPurchaseSupplierId(product.supplierId || suppliers[0]?.id || '');
      setPurchaseWarehouseId(product.warehouseId || warehouses[0]?.id || 'wh-main');
      setSupplierInvoiceNo('');
      setPurchaseNotes('');
    }
  }, [product, isOpen, suppliers, warehouses, categories]);

  if (!isOpen || !product) return null;

  const isLowStock = product.currentStock <= product.reorderLevel;
  const valuation = product.currentStock * product.costPrice;
  const marginPercent = product.costPrice > 0 
    ? (((product.retailPrice - product.costPrice) / product.costPrice) * 100).toFixed(1)
    : '0';

  const supplierObj = suppliers.find(s => s.id === product.supplierId);
  const selectedPurchaseSupplier = suppliers.find(s => s.id === purchaseSupplierId);
  const selectedPurchaseWarehouse = warehouses.find(w => w.id === purchaseWarehouseId);

  // Alternative units helper methods
  const handleAddAltUnit = () => {
    if (!tempAltUnitName.trim() || tempAltMultiplier <= 1) return;
    setEditFormData(prev => ({
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
    setEditFormData(prev => ({
      ...prev,
      alternativeUnits: prev.alternativeUnits.filter((_, i) => i !== index)
    }));
  };

  // Handle Save Product Edits (Consistent with ProductsView handleSubmit)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    if (!editFormData.name.trim() || !editFormData.sku.trim()) {
      setNotification({ message: 'Please provide Product Name and SKU Code.', type: 'error' });
      return;
    }

    if (skuDuplicate) {
      setNotification({ message: `Cannot save: SKU "${editFormData.sku}" is already assigned to "${skuDuplicate.name}".`, type: 'error' });
      return;
    }

    if (barcodeDuplicate) {
      setNotification({ message: `Cannot save: Barcode "${editFormData.barcode}" is already assigned to "${barcodeDuplicate.name}".`, type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const supplierObj = suppliers.find(s => s.id === editFormData.supplierId);
      const whObj = warehouses.find(w => w.id === editFormData.warehouseId);
      const supplierName = supplierObj ? (supplierObj.companyName || supplierObj.name) : product.supplierName;
      const warehouseName = whObj ? whObj.name : product.warehouseName;

      await updateProduct(product.id, {
        sku: editFormData.sku.trim(),
        barcode: editFormData.barcode.trim(),
        name: editFormData.name.trim(),
        category: editFormData.category,
        subcategory: editFormData.subcategory.trim() || '',
        brand: editFormData.brand.trim(),
        hsCode: editFormData.hsCode.trim(),
        supplierId: editFormData.supplierId,
        supplierName,
        baseUnit: editFormData.baseUnit,
        baseUnitSymbol: editFormData.baseUnitSymbol,
        alternativeUnits: editFormData.alternativeUnits,
        costPrice: Number(editFormData.costPrice) || 0,
        retailPrice: Number(editFormData.retailPrice) || 0,
        wholesalePrice: Number(editFormData.wholesalePrice) || 0,
        dealerPrice: Number(editFormData.dealerPrice) || 0,
        taxRatePercent: Number(editFormData.taxRatePercent) ?? 13,
        currentStock: Number(editFormData.currentStock) || 0,
        reorderLevel: Number(editFormData.reorderLevel) || 0,
        warehouseId: editFormData.warehouseId,
        warehouseName,
        locationBin: editFormData.locationBin.trim() || '',
        hasVariants: editFormData.hasVariants,
        warrantyMonths: Number(editFormData.warrantyMonths) || 0,
        status: editFormData.status,
        trackStock: true
      });

      setNotification({ message: 'Product details updated successfully.', type: 'success' });
      setTimeout(() => {
        setNotification(null);
        setActiveMode('view');
      }, 1000);
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to update product', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Quick Purchase
  const handleConfirmPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (purchaseQty <= 0) {
      setNotification({ message: 'Purchase quantity must be greater than 0', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const targetWh = warehouses.find(w => w.id === purchaseWarehouseId) || warehouses[0];
      const sup = suppliers.find(s => s.id === purchaseSupplierId) || suppliers[0];

      const lineTotal = purchaseQty * purchaseUnitCost;
      const taxRate = product.taxRatePercent !== undefined ? product.taxRatePercent : 13;
      const taxAmount = (lineTotal * taxRate) / 100;
      const grandTotal = lineTotal + taxAmount;

      const item: PurchaseItem = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        selectedUnit: product.baseUnit,
        conversionFactor: 1,
        quantity: purchaseQty,
        baseQuantity: purchaseQty,
        unitCost: purchaseUnitCost,
        discountPercent: 0,
        taxRatePercent: taxRate,
        lineTotal: lineTotal,
      };

      const newPurchase: Omit<PurchaseInvoice, 'id' | 'createdAt'> = {
        purchaseNumber: `PUR-${Date.now().toString().slice(-6)}`,
        supplierInvoiceNumber: supplierInvoiceNo.trim() || undefined,
        date: Date.now(),
        supplierId: sup ? sup.id : 'sup-general',
        supplierName: sup ? sup.companyName || sup.name : 'Direct Supplier',
        supplierPanVat: sup?.panVatNumber,
        warehouseId: targetWh.id,
        warehouseName: targetWh.name,
        items: [item],
        subtotal: lineTotal,
        discountAmount: 0,
        taxAmount: taxAmount,
        grandTotal: grandTotal,
        freightCost: 0,
        otherExpenses: 0,
        paymentMethod: paymentMethod,
        paidAmount: paymentMethod === 'credit' ? 0 : grandTotal,
        dueAmount: paymentMethod === 'credit' ? grandTotal : 0,
        paymentStatus: paymentMethod === 'credit' ? 'unpaid' : 'paid',
        status: 'received',
        notes: purchaseNotes.trim() || `Quick stock purchase of ${purchaseQty} ${product.baseUnitSymbol} via Inventory View`,
      };

      await recordPurchase(newPurchase);

      setNotification({ 
        message: `Successfully purchased ${purchaseQty} ${product.baseUnitSymbol}. Stock balance increased!`, 
        type: 'success' 
      });

      setTimeout(() => {
        setActiveMode('view');
        setNotification(null);
      }, 1500);
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to record purchase', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl transition-all my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* MODAL TOP HEADER */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center shrink-0">
              <Boxes className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {activeMode === 'edit' ? 'Edit Product Details' : activeMode === 'purchase' ? 'Quick Purchase Stock' : 'Product Stock Details'}
              </h2>
              {product.status && (
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1 text-3xs px-2 py-0.5 rounded-full font-semibold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    {product.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeMode === 'view' && (
              <button
                type="button"
                onClick={() => setActiveMode('edit')}
                title="Edit Product Details"
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-blue-500" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOAST / ALERT NOTIFICATION */}
        {notification && (
          <div className={`mx-5 mt-4 p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 1: DETAIL VIEW                                           */}
        {/* ------------------------------------------------------------- */}
        {activeMode === 'view' && (
          <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
            
            {/* Full Product Name & Available Stock Row Container */}
            <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-3xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                Product Name
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
                {product.name}
              </h1>
              <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xs font-semibold text-slate-500 uppercase">Available Stock:</span>
                  <span className={`text-sm font-mono font-bold ${isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {product.currentStock} {product.baseUnitSymbol}
                  </span>
                  {isLowStock && (
                    <span className="inline-flex items-center gap-0.5 ml-1 text-3xs font-semibold text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-3 h-3" /> (Low Stock)
                    </span>
                  )}
                </div>
                <div className="text-3xs text-slate-500">
                  <span>Safety: <strong className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{product.reorderLevel} {product.baseUnitSymbol}</strong></span>
                </div>
              </div>
            </div>
            
            {/* Dedicated Stock Valuation Container (Spacious for large numbers) */}
            <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">Total Stock Valuation</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatNPR(valuation)}
                  </span>
                </div>
              </div>
              <div className="sm:text-right text-3xs text-slate-500">
                <p className="uppercase tracking-wider">Unit Cost Price</p>
                <p className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                  {formatNPR(product.costPrice)} / {product.baseUnitSymbol}
                </p>
              </div>
            </div>

            {/* Selling Prices (Retail & Wholesale) */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <p className="text-3xs font-semibold text-slate-500 uppercase truncate">Retail Selling Price</p>
                <p className="text-sm sm:text-base font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                  {formatNPR(product.retailPrice)}
                </p>
                <p className="text-3xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium truncate">+{marginPercent}% margin</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <p className="text-3xs font-semibold text-slate-500 uppercase truncate">Wholesale Price</p>
                <p className="text-sm sm:text-base font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                  {formatNPR(product.wholesalePrice)}
                </p>
                <p className="text-3xs text-slate-400 mt-0.5 truncate">Dealer: {formatNPR(product.dealerPrice || product.wholesalePrice)}</p>
              </div>
            </div>

            {/* Specifications & Identification Grid */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 bg-white dark:bg-slate-900">
              <h3 className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-500" />
                Product Classification & Codes
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-3xs text-slate-400 block uppercase">SKU Code</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{product.sku}</span>
                </div>

                <div>
                  <span className="text-3xs text-slate-400 block uppercase">HS Code</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{product.hsCode || '—'}</span>
                </div>

                <div>
                  <span className="text-3xs text-slate-400 block uppercase">Category</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{product.category}</span>
                </div>

                <div>
                  <span className="text-3xs text-slate-400 block uppercase">Brand / Manufacturer</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{product.brand || '—'}</span>
                </div>

                <div>
                  <span className="text-3xs text-slate-400 block uppercase">Base Unit</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{product.baseUnit} ({product.baseUnitSymbol})</span>
                </div>

                <div>
                  <span className="text-3xs text-slate-400 block uppercase">Tax / VAT Rate</span>
                  <span className={`font-semibold ${product.taxRatePercent === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {product.taxRatePercent === 0 ? '0% Tax Exempt' : `${product.taxRatePercent ?? 13}% VAT`}
                  </span>
                </div>

                <div>
                  <span className="text-3xs text-slate-400 block uppercase">Barcode</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{product.barcode || '—'}</span>
                </div>
              </div>
            </div>

            {/* Godown & Supplier Location Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Godown Location */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 bg-white dark:bg-slate-900">
                <h3 className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  Storage & Location
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">Assigned Godown</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{product.warehouseName}</span>
                  </div>
                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">Specific Rack / Bin</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{product.locationBin || 'Showroom Floor'}</span>
                  </div>
                </div>
              </div>

              {/* Primary Supplier */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 bg-white dark:bg-slate-900">
                <h3 className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  Primary Supplier
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">Supplier Firm</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {supplierObj ? supplierObj.companyName || supplierObj.name : 'Direct / Local Supplier'}
                    </span>
                  </div>
                  <div>
                    <span className="text-3xs text-slate-400 block uppercase">Contact Person & Phone / PAN</span>
                    <div className="text-slate-700 dark:text-slate-300 text-2xs">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{supplierObj?.name || '—'}</span>
                      {supplierObj?.phone && (
                        <span className="font-mono ml-1 text-blue-600 dark:text-blue-400 font-semibold">
                          ({supplierObj.phone})
                        </span>
                      )}
                      {supplierObj?.panVatNumber && (
                        <span className="ml-1 text-slate-400 font-mono text-3xs">
                          [{supplierObj.panVatType || 'PAN'}: {supplierObj.panVatNumber}]
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Additional Contacts */}
                  {supplierObj?.additionalContacts && supplierObj.additionalContacts.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="text-3xs text-slate-400 block uppercase font-semibold">
                        Additional Contacts ({supplierObj.additionalContacts.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {supplierObj.additionalContacts.map((c, i) => (
                          <span 
                            key={i} 
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50/70 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/40 text-3xs text-slate-800 dark:text-slate-200"
                          >
                            <User className="w-2.5 h-2.5 text-blue-500" />
                            <span className="font-semibold">{c.name}</span>
                            {c.phone && <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">({c.phone})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS FOOTER */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('purchase')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Purchase Stock</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 2: EDIT PRODUCT DETAILS (Consistent with ProductsView)   */}
        {/* ------------------------------------------------------------- */}
        {activeMode === 'edit' && (
          <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
            
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
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
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
                      value={editFormData.sku}
                      placeholder="e.g. SAN-JAQ-00042"
                      className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-xs text-blue-950 dark:text-blue-200 cursor-default select-all outline-hidden"
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
                      value={editFormData.barcode}
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
                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="text-3xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold hover:underline transition-all cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                  <select
                    value={editFormData.category}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setEditFormData(prev => ({
                        ...prev,
                        category: newCat,
                        sku: generateUniqueSKU(newCat, prev.brand, products, product?.id)
                      }));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden font-medium"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name} {!c.isDefault ? ' ⭐ [Custom]' : ''}
                      </option>
                    ))}
                    {!categories.some(c => c.name === editFormData.category) && editFormData.category && (
                      <option value={editFormData.category}>{editFormData.category}</option>
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
                    value={editFormData.hsCode}
                    onChange={(e) => setEditFormData({ ...editFormData, hsCode: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden font-medium"
                  />
                  <p className="mt-1 text-3xs text-slate-400 dark:text-slate-500">Harmonized Tariff Code</p>
                </div>

                {/* Tax / VAT Dropdown */}
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tax / VAT Rate *
                  </label>
                  <select
                    value={editFormData.taxRatePercent}
                    onChange={(e) => setEditFormData({ ...editFormData, taxRatePercent: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden font-mono font-medium"
                  >
                    <option value={13}>13% VAT</option>
                    <option value={0}>0% Tax exempt</option>
                  </select>
                  <p className="mt-1 text-3xs text-slate-400 dark:text-slate-500">Inland Revenue Standard</p>
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
                    value={editFormData.brand}
                    onChange={(e) => {
                      const newBrand = e.target.value;
                      setEditFormData(prev => ({
                        ...prev,
                        brand: newBrand,
                        sku: generateUniqueSKU(prev.category, newBrand, products, product?.id)
                      }));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
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
                      className="text-3xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold hover:underline transition-all cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                  <select
                    value={editFormData.supplierId}
                    onChange={(e) => setEditFormData({ ...editFormData, supplierId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden font-medium"
                  >
                    <option value="">-- Direct / Local Supplier --</option>
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
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <h4 className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Units of Measurement & Conversions
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-3xs font-semibold text-slate-500 mb-1">Base Inventory Unit *</label>
                  <select
                    value={editFormData.baseUnit}
                    onChange={(e) => {
                      const selUnit = units.find(u => u.name === e.target.value);
                      setEditFormData({
                        ...editFormData,
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
                    value={editFormData.baseUnitSymbol}
                    onChange={(e) => setEditFormData({ ...editFormData, baseUnitSymbol: e.target.value })}
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
                  <span className="text-2xs font-semibold text-slate-500">{editFormData.baseUnitSymbol}</span>

                  <button
                    type="button"
                    onClick={handleAddAltUnit}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-2xs font-semibold transition-all cursor-pointer"
                  >
                    + Add Packaging Unit
                  </button>
                </div>

                {editFormData.alternativeUnits.map((alt, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-2xs mb-1 font-mono">
                    <span>1 {alt.unitName} ({alt.unitSymbol}) = <strong>{alt.multiplierToBase}</strong> {editFormData.baseUnitSymbol}</span>
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
                  value={editFormData.costPrice}
                  onChange={(e) => setEditFormData({ ...editFormData, costPrice: parseFloat(e.target.value) || 0 })}
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
                  value={editFormData.retailPrice}
                  onChange={(e) => setEditFormData({ ...editFormData, retailPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-blue-600 dark:text-blue-400"
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
                  value={editFormData.wholesalePrice}
                  onChange={(e) => setEditFormData({ ...editFormData, wholesalePrice: parseFloat(e.target.value) || 0 })}
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
                  value={editFormData.dealerPrice}
                  onChange={(e) => setEditFormData({ ...editFormData, dealerPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-amber-600 dark:text-amber-400"
                />
              </div>
            </div>

            {/* Warehouse, Initial Stock & Bin */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Current Stock ({editFormData.baseUnitSymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editFormData.currentStock}
                  onChange={(e) => setEditFormData({ ...editFormData, currentStock: parseFloat(e.target.value) || 0 })}
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
                  value={editFormData.reorderLevel}
                  onChange={(e) => setEditFormData({ ...editFormData, reorderLevel: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Warehouse / Store
                </label>
                <select
                  value={editFormData.warehouseId}
                  onChange={(e) => setEditFormData({ ...editFormData, warehouseId: e.target.value })}
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
                  value={editFormData.locationBin}
                  onChange={(e) => setEditFormData({ ...editFormData, locationBin: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <label className="text-2xs font-semibold text-slate-500">Status:</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-2xs text-slate-800 dark:text-slate-200 font-medium"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveMode('view')}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Product Changes'}
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 3: QUICK PURCHASE STOCK                                  */}
        {/* ------------------------------------------------------------- */}
        {activeMode === 'purchase' && (
          <form onSubmit={handleConfirmPurchase} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{product.name}</p>
                <p className="text-3xs text-slate-500">Current Balance: {product.currentStock} {product.baseUnitSymbol} • SKU: {product.sku}</p>
              </div>
              <div className="text-right">
                <span className="text-3xs uppercase font-semibold text-slate-500 block">Unit Cost</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatNPR(purchaseUnitCost)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity to Purchase ({product.baseUnitSymbol}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={purchaseQty}
                  onChange={(e) => setPurchaseQty(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unit Cost Price (NPR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={purchaseUnitCost}
                  onChange={(e) => setPurchaseUnitCost(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier *
                </label>
                <select
                  value={purchaseSupplierId}
                  onChange={(e) => setPurchaseSupplierId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.companyName || s.name}</option>
                  ))}
                </select>
                {(() => {
                  const selectedSup = suppliers.find(s => s.id === purchaseSupplierId);
                  if (!selectedSup) return null;
                  return (
                    <div className="mt-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-3xs space-y-1">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span>Contact: <strong className="text-slate-800 dark:text-slate-200">{selectedSup.name}</strong></span>
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{selectedSup.phone}</span>
                      </div>
                      {selectedSup.additionalContacts && selectedSup.additionalContacts.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          {selectedSup.additionalContacts.map((c, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-3xs text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                              <span className="font-semibold">{c.name}:</span>
                              <span className="font-mono text-blue-600 dark:text-blue-400">{c.phone}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Receiving Godown *
                </label>
                <select
                  value={purchaseWarehouseId}
                  onChange={(e) => setPurchaseWarehouseId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="bank_transfer">Bank Transfer (Immediate)</option>
                  <option value="cash">Cash on Delivery</option>
                  <option value="credit">Supplier Credit / Payable</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Bill / Invoice #
                </label>
                <input
                  type="text"
                  value={supplierInvoiceNo}
                  onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                  placeholder="e.g. PK-8492"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            {/* Calculated Summary Box */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-3xs">
                <span>Subtotal ({purchaseQty} {product.baseUnitSymbol} × {formatNPR(purchaseUnitCost)})</span>
                <span className="font-mono">{formatNPR(purchaseQty * purchaseUnitCost)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-3xs">
                <span>VAT ({(product.taxRatePercent ?? 13)}%)</span>
                <span className="font-mono">{formatNPR(((purchaseQty * purchaseUnitCost) * (product.taxRatePercent ?? 13)) / 100)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 font-bold text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Grand Total (Payable)</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {formatNPR((purchaseQty * purchaseUnitCost) * (1 + (product.taxRatePercent ?? 13) / 100))}
                </span>
              </div>
              <div className="text-3xs text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                New Stock Balance after purchase: {product.currentStock + purchaseQty} {product.baseUnitSymbol}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveMode('view')}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Recording Purchase...' : 'Confirm Purchase & Receive Stock'}
              </button>
            </div>
          </form>
        )}

        {/* Category Manager Modal */}
        <CategoryManagerModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onCategoryCreated={(newCat) => {
            setEditFormData(prev => ({
              ...prev,
              category: newCat.name,
              sku: generateUniqueSKU(newCat.name, prev.brand, products, product?.id)
            }));
            setNotification({ message: `Created & selected category: "${newCat.name}"`, type: 'success' });
          }}
        />

        {/* Quick Add Supplier Modal */}
        <QuickAddSupplierModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          onSupplierCreated={(newSup) => {
            setEditFormData(prev => ({ ...prev, supplierId: newSup.id }));
            setNotification({ message: `Created & selected supplier: "${newSup.companyName}"`, type: 'success' });
          }}
        />

      </div>
    </div>
  );
};
