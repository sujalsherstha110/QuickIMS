import React, { useState, useMemo } from 'react';
import { 
  Truck, Plus, Search, CheckCircle2, FileText, 
  DollarSign, PackageCheck, AlertCircle, X, ChevronRight,
  Clock, Trash2, ArrowRight, Building, Calendar, Users, Boxes, Wallet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PurchaseInvoice, PurchaseItem } from '../../types';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';
import { Button } from '../common/Button';

export const PurchasesView: React.FC = () => {
  const { 
    purchases, recordPurchase, finalizePurchaseInvoice, deletePurchase,
    suppliers, products, warehouses, currentWarehouseId, settings,
    canStaffDo
  } = useApp();

  const canCreatePurchase = canStaffDo('purchasesSuppliers', 'write');
  const canUpdatePurchase = canStaffDo('purchasesSuppliers', 'update');
  const canDeletePurchase = canStaffDo('purchasesSuppliers', 'delete');

  // Filter States (Tier 1)
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');

  // Finalized vs Draft Switcher (Tier 2)
  const [purchaseStateFilter, setPurchaseStateFilter] = useState<'finalized' | 'draft'>('finalized');

  // Sub-view Navigation (Tier 3: Columns of other)
  const [activePurchaseTab, setActivePurchaseTab] = useState<'register' | 'inwards' | 'suppliers' | 'payables'>('register');

  // Modal State
  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);

  // New Purchase Form
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState(currentWarehouseId);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [freightCost, setFreightCost] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'credit' | 'partial'>('bank_transfer');
  const [purchasePaidAmount, setPurchasePaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Item selector helpers inside purchase modal
  const [tempProductId, setTempProductId] = useState(products[0]?.id || '');
  const [tempQuantity, setTempQuantity] = useState(10);
  const [tempUnitCost, setTempUnitCost] = useState(500);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];

  // Helper for Date filtering
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const last7DaysStart = todayStart - (7 * 86400000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const finalizedPurchases = useMemo(() => {
    return purchases.filter(p => p.status !== 'draft' && !p.isDraft);
  }, [purchases]);

  const draftPurchases = useMemo(() => {
    return purchases.filter(p => p.status === 'draft' || p.isDraft === true);
  }, [purchases]);

  const displayedPurchases = purchaseStateFilter === 'finalized' ? finalizedPurchases : draftPurchases;

  const filteredPurchases = useMemo(() => {
    return displayedPurchases.filter(p => {
      // Date filter
      if (dateRange === 'today' && p.date < todayStart) return false;
      if (dateRange === 'week' && p.date < last7DaysStart) return false;
      if (dateRange === 'month' && p.date < thisMonthStart) return false;

      // Dropdown filters
      if (supplierFilter !== 'all' && p.supplierId !== supplierFilter) return false;
      if (warehouseFilter !== 'all' && p.warehouseId !== warehouseFilter) return false;
      if (paymentStatusFilter !== 'all' && p.paymentStatus !== paymentStatusFilter) return false;
      if (paymentMethodFilter !== 'all' && p.paymentMethod !== paymentMethodFilter) return false;

      // Search query
      const q = String(searchQuery || '').toLowerCase().trim();
      if (q) {
        const matchesPurchaseNum = String(p.purchaseNumber || '').toLowerCase().includes(q);
        const matchesSupplier = String(p.supplierName || '').toLowerCase().includes(q);
        const matchesBill = p.supplierInvoiceNumber && String(p.supplierInvoiceNumber).toLowerCase().includes(q);
        const matchesItem = p.items?.some(i => String(i.productName || '').toLowerCase().includes(q) || String(i.sku || '').toLowerCase().includes(q));

        if (!matchesPurchaseNum && !matchesSupplier && !matchesBill && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [
    displayedPurchases, dateRange, supplierFilter, warehouseFilter, 
    paymentStatusFilter, paymentMethodFilter, searchQuery, todayStart, last7DaysStart, thisMonthStart
  ]);

  const handleAddItemToPurchase = () => {
    const prod = products.find(p => p.id === tempProductId);
    if (!prod) return;

    const lineTotal = tempQuantity * tempUnitCost;

    const newItem: PurchaseItem = {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      selectedUnit: prod.baseUnit,
      conversionFactor: 1,
      quantity: tempQuantity,
      baseQuantity: tempQuantity,
      unitCost: tempUnitCost,
      discountPercent: 0,
      taxRatePercent: 13,
      lineTotal
    };

    setPurchaseItems([...purchaseItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const subtotal = purchaseItems.reduce((acc, i) => acc + i.lineTotal, 0);
  const taxAmount = Math.round(subtotal * 0.13 * 100) / 100;
  const grandTotal = subtotal + taxAmount + freightCost + otherExpenses;
  const dueAmount = Math.max(0, grandTotal - purchasePaidAmount);

  const handleCreatePurchase = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!canCreatePurchase) return;
    if (purchaseItems.length === 0 || !selectedSupplier) return;

    const targetWh = warehouses.find(w => w.id === targetWarehouseId) || warehouses[0];
    const prefix = isDraft ? 'DRAFT-PO-' : settings.purchasePrefix;
    const purchaseNumber = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;

    const newPur: Omit<PurchaseInvoice, 'id' | 'createdAt'> = {
      purchaseNumber,
      supplierInvoiceNumber: supplierInvoiceNo,
      date: Date.now(),
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.companyName || selectedSupplier.name,
      supplierPanVat: selectedSupplier.panVatNumber,
      warehouseId: targetWh.id,
      warehouseName: targetWh.name,
      items: purchaseItems,
      subtotal,
      discountAmount: 0,
      taxAmount,
      freightCost,
      otherExpenses,
      grandTotal,
      paymentMethod: purchasePaymentMethod,
      paidAmount: Math.min(purchasePaidAmount, grandTotal),
      dueAmount,
      paymentStatus: dueAmount === 0 ? 'paid' : (purchasePaidAmount > 0 ? 'partial' : 'unpaid'),
      status: isDraft ? 'draft' : 'received',
      isDraft,
      notes
    };

    await recordPurchase(newPur);
    setShowNewPurchaseModal(false);
    setPurchaseItems([]);
    setSupplierInvoiceNo('');
    setNotes('');

    if (isDraft) {
      setPurchaseStateFilter('draft');
    } else {
      setPurchaseStateFilter('finalized');
    }
  };

  const handleFinalizeDraft = async (id: string, purchaseNumber: string) => {
    if (!canUpdatePurchase) return;
    if (!confirm(`Confirm and inward goods for draft purchase order ${purchaseNumber}? This will increment physical inventory stock and update vendor ledgers.`)) {
      return;
    }
    await finalizePurchaseInvoice(id);
  };

  const handleDeleteDraft = async (id: string, purchaseNumber: string) => {
    if (!canDeletePurchase) return;
    if (!confirm(`Discard and delete draft purchase order ${purchaseNumber}?`)) {
      return;
    }
    await deletePurchase(id);
  };

  // Supplier Summary Aggregates
  const supplierPurchasesSummary = useMemo(() => {
    const map: Record<string, {
      supplierId: string;
      supplierName: string;
      panVat?: string;
      orderCount: number;
      totalPurchases: number;
      totalPaid: number;
      totalDue: number;
    }> = {};

    finalizedPurchases.forEach(p => {
      if (!map[p.supplierId]) {
        map[p.supplierId] = {
          supplierId: p.supplierId,
          supplierName: p.supplierName,
          panVat: p.supplierPanVat,
          orderCount: 0,
          totalPurchases: 0,
          totalPaid: 0,
          totalDue: 0
        };
      }
      map[p.supplierId].orderCount += 1;
      map[p.supplierId].totalPurchases += p.grandTotal;
      map[p.supplierId].totalPaid += p.paidAmount;
      map[p.supplierId].totalDue += p.dueAmount;
    });

    return Object.values(map);
  }, [finalizedPurchases]);

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800/50">
              <Truck className="w-4 h-4" />
            </span>
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Procurement & Vendor Inwards
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Purchase Orders & Goods Inward (खरिद बिल तथा मौज्दात दाखिला)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supplier purchase invoices, landed cost allocation (freight & loading), and stock increment.
          </p>
        </div>

        {canCreatePurchase && (
          <Button
            variant="primary-arrow"
            size="md"
            onClick={() => {
              setPurchasePaidAmount(0);
              setShowNewPurchaseModal(true);
            }}
          >
            Receive Goods / New Purchase Bill
          </Button>
        )}
      </div>

      {/* TIER 1: SEARCH & FILTER BOX (Matches User's Sketch) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Row 1: Search on Left + Date Pills on Right */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by purchase #, supplier name, invoice #, or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            {[
              { id: 'all', label: 'All Dates' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateRange(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateRange === tab.id
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Dropdown Filters in Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Fully Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Due / Credit</option>
            </select>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Payment Method</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden font-medium"
            >
              <option value="all">All Methods</option>
              <option value="bank_transfer">Bank Transfer / QR</option>
              <option value="cash">Cash In Hand</option>
              <option value="cheque">Cheque</option>
              <option value="credit">Credit / Payable (उधारो)</option>
            </select>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Supplier (साहु)</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden font-medium"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Godown / Branch</label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden font-medium"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TIER 2: FINALIZED VS DRAFT INVOICE SWITCHER (Directly between Filter Section and Columns of Other) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPurchaseStateFilter('finalized')}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all border cursor-pointer ${
              purchaseStateFilter === 'finalized'
                ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 border-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/20 inset'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${purchaseStateFilter === 'finalized' ? 'text-white' : 'text-emerald-500'}`} />
            <span className="text-sm">Finalized</span>
            <span className={`px-2 py-0.5 rounded-full text-2xs font-mono font-bold ${
              purchaseStateFilter === 'finalized' 
                ? 'bg-blue-800 text-white' 
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {finalizedPurchases.length}
            </span>
          </button>

          <button
            onClick={() => setPurchaseStateFilter('draft')}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all border cursor-pointer ${
              purchaseStateFilter === 'draft'
                ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 border-amber-600 text-white shadow-md shadow-amber-500/25 ring-1 ring-white/20 inset'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Clock className={`w-4 h-4 ${purchaseStateFilter === 'draft' ? 'text-white' : 'text-amber-500'}`} />
            <span className="text-sm">Draft</span>
            <span className={`px-2 py-0.5 rounded-full text-2xs font-mono font-bold ${
              purchaseStateFilter === 'draft' 
                ? 'bg-amber-800 text-white' 
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {draftPurchases.length}
            </span>
          </button>
        </div>

        {canCreatePurchase && (
          <Button
            variant="primary-arrow"
            size="md"
            onClick={() => {
              setPurchasePaidAmount(0);
              setShowNewPurchaseModal(true);
            }}
          >
            New Purchase Order
          </Button>
        )}
      </div>

      {/* TIER 3: COLUMNS OF OTHER / SUB-VIEW NAVIGATION (Matches User's Sketch) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'register', label: `Purchase Register (${filteredPurchases.length})`, icon: FileText },
          { id: 'inwards', label: 'Material Inward Items', icon: Boxes },
          { id: 'suppliers', label: `Supplier Summary (${supplierPurchasesSummary.length})`, icon: Users },
          { id: 'payables', label: 'Due Payables', icon: Wallet },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activePurchaseTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePurchaseTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20 inset'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TIER 4: PURCHASES TABLE & SUB-VIEWS */}
      {activePurchaseTab === 'register' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                {purchaseStateFilter === 'finalized' ? (
                  <tr>
                    <th className="px-4 py-3">Purchase #</th>
                    <th className="px-4 py-3">Supplier Name</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Inward Store</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                    <th className="px-4 py-3 text-right">Grand Total (Inc VAT)</th>
                    <th className="px-4 py-3 text-right">Due Payable</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-3">Draft PO #</th>
                    <th className="px-4 py-3">Supplier Name</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Target Godown</th>
                    <th className="px-4 py-3 text-center">Items</th>
                    <th className="px-4 py-3 text-right">Est. Grand Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      {purchaseStateFilter === 'draft' ? (
                        <div>
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-500" />
                          <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">No Draft Purchase Orders Found</p>
                          <p className="text-2xs mt-1 text-slate-400">
                            Draft purchase orders let you prepare vendor orders without altering inventory stock or payables.
                          </p>
                          {canCreatePurchase && (
                            <button
                              onClick={() => {
                                setPurchasePaidAmount(0);
                                setShowNewPurchaseModal(true);
                              }}
                              className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" /> Create Draft Purchase
                            </button>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="font-semibold text-sm">No finalized purchase invoices found</p>
                          <p className="text-2xs mt-1">Try adjusting your search keywords or filters.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(p => {
                    if (purchaseStateFilter === 'draft') {
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                            {p.purchaseNumber}
                            {p.supplierInvoiceNumber && (
                              <span className="block text-3xs text-slate-400 font-normal">Ref: {p.supplierInvoiceNumber}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">{p.supplierName}</span>
                            {p.supplierPanVat && <span className="text-3xs text-slate-400 font-mono">PAN: {p.supplierPanVat}</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500 text-2xs">{formatDate(p.date)}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.warehouseName}</td>
                          <td className="px-4 py-3 text-center font-mono">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-2xs font-semibold">
                              {p.items?.length || 0} line items
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatNPR(p.grandTotal)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <Clock className="w-2.5 h-2.5" /> Draft PO
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {canUpdatePurchase && (
                                <button
                                  onClick={() => handleFinalizeDraft(p.id, p.purchaseNumber)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-2xs font-semibold flex items-center gap-1 shadow-xs transition-all"
                                  title="Finalize & Inward Stock"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Finalize & Inward</span>
                                </button>
                              )}
                              {canDeletePurchase && (
                                <button
                                  onClick={() => handleDeleteDraft(p.id, p.purchaseNumber)}
                                  className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-md transition-all"
                                  title="Discard Draft"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!canUpdatePurchase && !canDeletePurchase && (
                                <span className="text-3xs text-slate-400 font-medium">View Only</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {p.purchaseNumber}
                          {p.supplierInvoiceNumber && (
                            <span className="block text-3xs text-slate-400">Bill: {p.supplierInvoiceNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">{p.supplierName}</span>
                          {p.supplierPanVat && <span className="text-3xs text-slate-400 font-mono">PAN: {p.supplierPanVat}</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-2xs">{formatDate(p.date)}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.warehouseName}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatNPR(p.subtotal)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{formatNPR(p.grandTotal)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {p.dueAmount > 0 ? formatNPR(p.dueAmount) : 'Paid'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={p.paymentStatus} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TIER 4: SUB-VIEW: MATERIAL INWARD ITEMS */}
      {activePurchaseTab === 'inwards' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Received Goods & Material Inward Items</h2>
            <p className="text-2xs text-slate-500">Item-wise breakdown of purchased raw materials and pantry ingredients.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Inward Qty</th>
                  <th className="px-4 py-3 text-right">Unit Rate</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {finalizedPurchases.flatMap(p => p.items.map((it, idx) => (
                  <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{it.productName}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-2xs">{it.sku}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.supplierName}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{it.quantity} {it.selectedUnit}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatNPR(it.unitCost)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatNPR(it.lineTotal)}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TIER 4: SUB-VIEW: SUPPLIER SUMMARY */}
      {activePurchaseTab === 'suppliers' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Supplier Sourcing & Procurement Balances</h2>
            <p className="text-2xs text-slate-500">Summary of vendor transaction volumes and pending balance payables.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">PAN/VAT</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Total Purchases</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Total Paid</th>
                  <th className="px-4 py-3 text-right text-rose-600 font-bold">Outstanding Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {supplierPurchasesSummary.map(s => (
                  <tr key={s.supplierId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{s.supplierName}</td>
                    <td className="px-4 py-3 font-mono text-2xs text-slate-500">{s.panVat || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.orderCount}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatNPR(s.totalPurchases)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatNPR(s.totalPaid)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">{formatNPR(s.totalDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TIER 4: SUB-VIEW: DUE PAYABLES */}
      {activePurchaseTab === 'payables' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 text-rose-600">Supplier Credit Bills & Due Payables (साहु उधारो)</h2>
            <p className="text-2xs text-slate-500">All purchase invoices with outstanding due payable balances.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Purchase #</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Bill Date</th>
                  <th className="px-4 py-3 text-right">Total Bill</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right font-bold text-rose-600">Due Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {finalizedPurchases.filter(p => p.dueAmount > 0).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{p.purchaseNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{p.supplierName}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-2xs">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNPR(p.grandTotal)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatNPR(p.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">{formatNPR(p.dueAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NEW PURCHASE BILL */}
      {showNewPurchaseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Receive Supplier Goods & Record Purchase Bill
              </h3>
              <button onClick={() => setShowNewPurchaseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs">
              
              {/* Supplier & Warehouse select */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Supplier (साहु) *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Supplier Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. PK-INV-8891"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Receiving Warehouse</label>
                  <select
                    value={targetWarehouseId}
                    onChange={(e) => setTargetWarehouseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add Items Sub-section */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3 border border-slate-200 dark:border-slate-800">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">Add Line Items</span>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <label className="block text-3xs text-slate-400">Select Item</label>
                    <select
                      value={tempProductId}
                      onChange={(e) => {
                        setTempProductId(e.target.value);
                        const prod = products.find(p => p.id === e.target.value);
                        if (prod) setTempUnitCost(prod.costPrice || 0);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-3xs text-slate-400">Quantity (Base)</label>
                    <input
                      type="number"
                      min={1}
                      value={tempQuantity}
                      onChange={(e) => setTempQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs text-slate-400">Unit Cost (NPR)</label>
                    <input
                      type="number"
                      min={0}
                      value={tempUnitCost}
                      onChange={(e) => setTempUnitCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemToPurchase}
                  className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded text-2xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Item Row
                </button>

                {/* Items Table */}
                {purchaseItems.length > 0 && (
                  <table className="w-full text-2xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                        <th className="py-1 text-left">Item</th>
                        <th className="py-1 text-right">Qty</th>
                        <th className="py-1 text-right">Rate</th>
                        <th className="py-1 text-right">Line Total</th>
                        <th className="py-1 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {purchaseItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 font-medium">{item.productName}</td>
                          <td className="py-1.5 text-right font-mono">{item.quantity}</td>
                          <td className="py-1.5 text-right font-mono">{formatNPR(item.unitCost)}</td>
                          <td className="py-1.5 text-right font-mono font-bold">{formatNPR(item.lineTotal)}</td>
                          <td className="py-1.5 text-center">
                            <button onClick={() => handleRemoveItem(idx)} className="text-rose-500 hover:text-rose-700">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Financial Calculation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <div>
                    <label className="block text-2xs text-slate-500 mb-0.5">Freight / Transportation Cost (NPR)</label>
                    <input
                      type="number"
                      value={freightCost}
                      onChange={(e) => setFreightCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-2xs text-slate-500 mb-0.5">Loading / Unloading / Other Expenses (NPR)</label>
                    <input
                      type="number"
                      value={otherExpenses}
                      onChange={(e) => setOtherExpenses(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-2xs text-slate-500 mb-0.5">Payment Method</label>
                    <select
                      value={purchasePaymentMethod}
                      onChange={(e) => setPurchasePaymentMethod(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                    >
                      <option value="bank_transfer">Bank Transfer / QR</option>
                      <option value="cash">Cash In Hand</option>
                      <option value="cheque">Bank Cheque</option>
                      <option value="credit">Credit / Payable (उधारो)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl space-y-1.5 font-mono text-2xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal:</span>
                    <span>{formatNPR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">VAT (13%):</span>
                    <span>{formatNPR(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-700 pt-1 text-slate-900 dark:text-slate-100">
                    <span>Grand Total:</span>
                    <span>{formatNPR(grandTotal)}</span>
                  </div>

                  <div className="pt-2">
                    <label className="block text-3xs text-slate-500 font-sans mb-1">Paid Amount Now (NPR)</label>
                    <input
                      type="number"
                      value={purchasePaidAmount}
                      onChange={(e) => setPurchasePaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setShowNewPurchaseModal(false)}
                >
                  Cancel
                </Button>

                <Button
                  variant="amber"
                  size="md"
                  disabled={purchaseItems.length === 0}
                  onClick={(e) => handleCreatePurchase(e, true)}
                  icon={<Clock className="w-4 h-4" />}
                >
                  Save as Draft
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  disabled={purchaseItems.length === 0}
                  onClick={(e) => handleCreatePurchase(e, false)}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Confirm & Receive Goods
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
