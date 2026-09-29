import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, Filter, Calendar, Download, Printer, Eye, X, 
  DollarSign, CheckCircle2, Clock, AlertCircle, Users, Boxes,
  TrendingUp, CreditCard, QrCode, ArrowDownToLine, RefreshCw,
  Building, ChevronRight, RotateCcw, History, Wallet, Plus, Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SaleInvoice, SaleItem } from '../../types';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';
import { InvoiceDetailModal } from '../common/InvoiceDetailModal';

export const InvoiceReportView: React.FC = () => {
  const { 
    sales, settings, customers, warehouses, salesReturns, 
    products, recordSale, finalizeSaleInvoice, deleteSaleInvoice, currentUser 
  } = useApp();

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'invoices' | 'returns' | 'items' | 'customers' | 'payment_methods'>('invoices');

  // Finalized vs Draft Invoices Switcher
  const [invoiceStateFilter, setInvoiceStateFilter] = useState<'finalized' | 'draft'>('finalized');

  // Selected Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'view' | 'settle' | 'edit'>('view');

  // New Draft Invoice Modal State
  const [showNewDraftModal, setShowNewDraftModal] = useState(false);
  const [draftCustomerId, setDraftCustomerId] = useState(customers[0]?.id || 'cust-walkin');
  const [draftCustomName, setDraftCustomName] = useState('');
  const [draftCustomPhone, setDraftCustomPhone] = useState('');
  const [draftCustomPan, setDraftCustomPan] = useState('');
  const [draftWarehouseId, setDraftWarehouseId] = useState(warehouses[0]?.id || '');
  const [draftItems, setDraftItems] = useState<SaleItem[]>([]);
  const [draftPaymentMethod, setDraftPaymentMethod] = useState<SaleInvoice['paymentMethod']>('cash');
  const [draftNotes, setDraftNotes] = useState('');

  // Item selector inside New Draft Modal
  const [tempProductId, setTempProductId] = useState(products[0]?.id || '');
  const [tempQuantity, setTempQuantity] = useState(1);
  const [tempUnitPrice, setTempUnitPrice] = useState(products[0]?.retailPrice || 100);

  // Helper for Date filtering
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const last7DaysStart = todayStart - (7 * 86400000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Separate sales into Finalized and Draft
  const finalizedSales = useMemo(() => {
    return sales.filter(s => s.status !== 'draft' && !s.isDraft);
  }, [sales]);

  const draftSales = useMemo(() => {
    return sales.filter(s => s.status === 'draft' || s.isDraft === true);
  }, [sales]);

  // Base list of sales to display in current invoiceStateFilter
  const baseSalesList = invoiceStateFilter === 'finalized' ? finalizedSales : draftSales;

  // Filtered Sales
  const filteredSales = useMemo(() => {
    return baseSalesList.filter(s => {
      // Date Filter
      if (dateRange === 'today' && s.date < todayStart) return false;
      if (dateRange === 'yesterday' && (s.date < yesterdayStart || s.date >= todayStart)) return false;
      if (dateRange === 'week' && s.date < last7DaysStart) return false;
      if (dateRange === 'month' && s.date < thisMonthStart) return false;
      if (dateRange === 'custom') {
        if (customStartDate && s.date < new Date(customStartDate).getTime()) return false;
        if (customEndDate && s.date > (new Date(customEndDate).getTime() + 86400000)) return false;
      }

      // Status Filter
      if (paymentStatusFilter !== 'all' && s.paymentStatus !== paymentStatusFilter) return false;

      // Payment Method Filter
      if (paymentMethodFilter !== 'all' && s.paymentMethod !== paymentMethodFilter) return false;

      // Customer Type Filter
      if (customerTypeFilter !== 'all' && s.customerType !== customerTypeFilter) return false;

      // Warehouse Filter
      if (warehouseFilter !== 'all' && s.warehouseId !== warehouseFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesInvoice = s.invoiceNumber.toLowerCase().includes(query);
        const matchesCustomer = s.customerName.toLowerCase().includes(query);
        const matchesPhone = s.customerPhone && s.customerPhone.includes(query);
        const matchesPan = s.customerPanVat && s.customerPanVat.includes(query);
        const matchesSalesperson = s.salespersonName && s.salespersonName.toLowerCase().includes(query);
        const matchesItem = s.items.some(i => i.productName.toLowerCase().includes(query) || i.sku.toLowerCase().includes(query));

        if (!matchesInvoice && !matchesCustomer && !matchesPhone && !matchesPan && !matchesSalesperson && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [
    baseSalesList, dateRange, customStartDate, customEndDate, 
    paymentStatusFilter, paymentMethodFilter, customerTypeFilter, 
    warehouseFilter, searchQuery, todayStart, yesterdayStart, last7DaysStart, thisMonthStart
  ]);

  // Aggregate Metrics based on finalized sales for accurate financial reporting
  const totalInvoicesCount = finalizedSales.length;
  const totalGrossSales = finalizedSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
  const totalTaxableSales = finalizedSales.reduce((sum, s) => sum + (s.taxableAmount ?? s.subtotal ?? 0), 0);
  const totalVatCollected = finalizedSales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
  const totalPaidAmount = finalizedSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalDueAmount = finalizedSales.reduce((sum, s) => sum + (s.dueAmount || 0), 0);

  // Itemized Aggregate Data
  const itemizedSales = useMemo(() => {
    const map: Record<string, {
      productId: string;
      productName: string;
      sku: string;
      unit: string;
      totalQty: number;
      totalRevenue: number;
      totalCost: number;
      invoiceCount: number;
    }> = {};

    finalizedSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            unit: item.selectedUnit,
            totalQty: 0,
            totalRevenue: 0,
            totalCost: 0,
            invoiceCount: 0,
          };
        }
        map[item.productId].totalQty += item.quantity;
        map[item.productId].totalRevenue += item.lineTotal;
        map[item.productId].totalCost += (item.costPrice || 0) * item.quantity;
        map[item.productId].invoiceCount += 1;
      });
    });

    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [finalizedSales]);

  // Customer Aggregate Data
  const customerSalesSummary = useMemo(() => {
    const map: Record<string, {
      customerId: string;
      customerName: string;
      customerType: string;
      phone?: string;
      panVat?: string;
      invoiceCount: number;
      totalSales: number;
      totalPaid: number;
      totalDue: number;
    }> = {};

    finalizedSales.forEach(s => {
      const key = s.customerId || s.customerName;
      if (!map[key]) {
        map[key] = {
          customerId: s.customerId,
          customerName: s.customerName,
          customerType: s.customerType,
          phone: s.customerPhone,
          panVat: s.customerPanVat,
          invoiceCount: 0,
          totalSales: 0,
          totalPaid: 0,
          totalDue: 0,
        };
      }
      map[key].invoiceCount += 1;
      map[key].totalSales += s.grandTotal;
      map[key].totalPaid += s.paidAmount;
      map[key].totalDue += s.dueAmount;
    });

    return Object.values(map).sort((a, b) => b.totalSales - a.totalSales);
  }, [finalizedSales]);

  // Payment Method Breakdown
  const paymentMethodSummary = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    finalizedSales.forEach(s => {
      const method = s.paymentMethod || 'cash';
      if (!map[method]) {
        map[method] = { count: 0, total: 0 };
      }
      map[method].count += 1;
      map[method].total += s.grandTotal;
    });
    return map;
  }, [finalizedSales]);

  // Draft items helper
  const handleAddDraftItem = () => {
    const prod = products.find(p => p.id === tempProductId);
    if (!prod) return;

    const baseQty = tempQuantity;
    const lineSubtotal = tempQuantity * tempUnitPrice;
    const taxRate = prod.taxRatePercent || 13;
    const taxAmt = Math.round((lineSubtotal * taxRate / 100) * 100) / 100;

    const newItem: SaleItem = {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      barcode: prod.barcode,
      selectedUnit: prod.baseUnit || 'pcs',
      conversionFactor: 1,
      quantity: tempQuantity,
      baseQuantity: baseQty,
      unitPrice: tempUnitPrice,
      costPrice: prod.costPrice || 0,
      discountPercent: 0,
      discountAmount: 0,
      taxRatePercent: taxRate,
      taxAmount: taxAmt,
      lineTotal: lineSubtotal + taxAmt
    };

    setDraftItems([...draftItems, newItem]);
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems(draftItems.filter((_, i) => i !== index));
  };

  const draftSubtotal = draftItems.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
  const draftTaxAmount = draftItems.reduce((acc, i) => acc + (i.taxAmount || 0), 0);
  const draftGrandTotal = draftSubtotal + draftTaxAmount;

  const handleSaveDraftInvoice = async (isDraft = true) => {
    if (draftItems.length === 0) return;

    const targetCustomer = customers.find(c => c.id === draftCustomerId);
    const targetWh = warehouses.find(w => w.id === draftWarehouseId) || warehouses[0];
    const prefix = isDraft ? 'DRAFT-INV-' : settings.invoicePrefix;
    const invoiceNumber = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;

    const newSale: Omit<SaleInvoice, 'id' | 'createdAt'> = {
      invoiceNumber,
      date: Date.now(),
      fiscalYear: settings.fiscalYear || '2082/83',
      customerId: targetCustomer?.id || 'cust-walkin',
      customerName: draftCustomName || targetCustomer?.name || 'Walk-in Guest',
      customerPhone: draftCustomPhone || targetCustomer?.phone,
      customerPanVat: draftCustomPan || targetCustomer?.panVatNumber,
      customerType: targetCustomer?.customerType || 'retail',
      salespersonId: currentUser.id,
      salespersonName: currentUser.name,
      warehouseId: targetWh.id,
      warehouseName: targetWh.name,
      items: draftItems,
      subtotal: draftSubtotal,
      discountAmount: 0,
      taxableAmount: draftSubtotal,
      taxAmount: draftTaxAmount,
      nonTaxableAmount: 0,
      grandTotal: draftGrandTotal,
      totalCost: draftItems.reduce((acc, i) => acc + (i.costPrice * i.baseQuantity), 0),
      grossProfit: draftGrandTotal - draftItems.reduce((acc, i) => acc + (i.costPrice * i.baseQuantity), 0),
      paymentMethod: draftPaymentMethod,
      paidAmount: isDraft ? 0 : draftGrandTotal,
      dueAmount: isDraft ? draftGrandTotal : 0,
      paymentStatus: isDraft ? 'unpaid' : 'paid',
      status: isDraft ? 'draft' : 'completed',
      isDraft,
      notes: draftNotes,
      terms: settings.termsAndConditions
    };

    await recordSale(newSale);
    setShowNewDraftModal(false);
    setDraftItems([]);
    setDraftCustomName('');
    setDraftCustomPhone('');
    setDraftCustomPan('');
    setDraftNotes('');

    if (isDraft) {
      setInvoiceStateFilter('draft');
    } else {
      setInvoiceStateFilter('finalized');
    }
  };

  const handleFinalizeSaleDraft = async (id: string, invNum: string) => {
    if (!confirm(`Finalize and issue invoice ${invNum}? This will issue an official tax invoice, decrement physical inventory stock, and update customer balance.`)) {
      return;
    }
    await finalizeSaleInvoice(id);
  };

  const handleDeleteSaleDraft = async (id: string, invNum: string) => {
    if (!confirm(`Discard and delete draft invoice ${invNum}?`)) {
      return;
    }
    await deleteSaleInvoice(id);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;

    const headers = [
      'Invoice Number',
      'Date (AD)',
      'Date (BS)',
      'Customer Name',
      'Customer Type',
      'Customer PAN/VAT',
      'Payment Method',
      'Payment Status',
      'Taxable Amount (NPR)',
      'VAT 13% (NPR)',
      'Grand Total (NPR)',
      'Paid Amount (NPR)',
      'Due Amount (NPR)',
      'Warehouse'
    ];

    const rows = filteredSales.map(s => [
      `"${s.invoiceNumber}"`,
      `"${formatDate(s.date)}"`,
      `"${toNepaliBSDate(s.date)}"`,
      `"${s.customerName.replace(/"/g, '""')}"`,
      `"${s.customerType}"`,
      `"${s.customerPanVat || ''}"`,
      `"${s.paymentMethod}"`,
      `"${s.paymentStatus}"`,
      s.taxableAmount ?? s.subtotal ?? 0,
      s.taxAmount || 0,
      s.grandTotal || 0,
      s.paidAmount || 0,
      s.dueAmount || 0,
      `"${s.warehouseName || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Invoice_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 pb-10">
      
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800/50">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Sales & Invoicing Module
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Sales Invoices & Tax Register (बिक्री बिल तथा कर खाता)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Official IRD compliant sales register, finalized tax receipts, pro-forma drafts, and customer sales audit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewDraftModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Draft / Invoice</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Register</span>
          </button>
        </div>
      </div>

      {/* Aggregate Financial Metrics (Finalized Tax Figures) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Finalized Invoices</span>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {totalInvoicesCount}
          </div>
          <span className="text-3xs text-emerald-600 font-medium">Official Tax Invoices</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Gross Sales</span>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {formatNPR(totalGrossSales)}
          </div>
          <span className="text-3xs text-slate-400 font-mono">Incl. 13% VAT</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Taxable Sales</span>
          <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {formatNPR(totalTaxableSales)}
          </div>
          <span className="text-3xs text-slate-400">Net of VAT</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block mb-1">VAT Collected</span>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatNPR(totalVatCollected)}
          </div>
          <span className="text-3xs text-amber-600 font-medium">13% Nepal VAT</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Cash Inward</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatNPR(totalPaidAmount)}
          </div>
          <span className="text-3xs text-emerald-600 font-medium">Paid & Cleared</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Receivables Due</span>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {formatNPR(totalDueAmount)}
          </div>
          <span className="text-3xs text-rose-600 font-medium">Customer Udharo</span>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice number, customer, phone, PAN, or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 font-medium"
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

          {/* Quick Date Filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            {[
              { id: 'all', label: 'All Dates' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateRange(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateRange === tab.id
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Selector if 'custom' is active */}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-2xs font-semibold text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Date Range:
            </span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 font-mono"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
        )}

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Fully Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Credit / Unpaid</option>
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
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank / Fonepay QR</option>
              <option value="esewa">eSewa</option>
              <option value="khalti">Khalti</option>
              <option value="cheque">Cheque</option>
              <option value="credit">Credit (Khata)</option>
            </select>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Customer Category</label>
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden font-medium"
            >
              <option value="all">All Customer Types</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="contractor">Contractor / Event</option>
              <option value="dealer">Corporate / Dealer</option>
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
            onClick={() => setInvoiceStateFilter('finalized')}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all border ${
              invoiceStateFilter === 'finalized'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20'
                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${invoiceStateFilter === 'finalized' ? 'text-white' : 'text-emerald-500'}`} />
            <span className="text-sm">Finalized</span>
            <span className={`px-2 py-0.5 rounded-full text-2xs font-mono font-bold ${
              invoiceStateFilter === 'finalized' 
                ? 'bg-indigo-700 text-white' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {finalizedSales.length}
            </span>
          </button>

          <button
            onClick={() => setInvoiceStateFilter('draft')}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all border ${
              invoiceStateFilter === 'draft'
                ? 'bg-amber-500 border-amber-500 text-white shadow-sm ring-2 ring-amber-500/20'
                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Clock className={`w-4 h-4 ${invoiceStateFilter === 'draft' ? 'text-white' : 'text-amber-500'}`} />
            <span className="text-sm">Draft</span>
            <span className={`px-2 py-0.5 rounded-full text-2xs font-mono font-bold ${
              invoiceStateFilter === 'draft' 
                ? 'bg-amber-600 text-white' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {draftSales.length}
            </span>
          </button>
        </div>

        <button
          onClick={() => setShowNewDraftModal(true)}
          className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Create Sales Draft / Invoice</span>
        </button>
      </div>

      {/* TIER 3: COLUMNS OF OTHER / SUB-VIEW NAVIGATION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === 'invoices'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Invoices Register ({filteredSales.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('returns')}
          className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === 'returns'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Sales Returns ({salesReturns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('items')}
          className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === 'items'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Item-Wise Sales ({itemizedSales.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === 'customers'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customer Summary ({customerSalesSummary.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payment_methods')}
          className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === 'payment_methods'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Breakdown</span>
        </button>
      </div>

      {/* VIEW 1: INVOICES REGISTER */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {/* Table Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
                  {invoiceStateFilter === 'finalized' ? (
                    <tr>
                      <th className="px-4 py-3">Invoice #</th>
                      <th className="px-4 py-3">Date (AD / BS)</th>
                      <th className="px-4 py-3">Customer & Type</th>
                      <th className="px-4 py-3">PAN/VAT</th>
                      <th className="px-4 py-3">Payment Mode</th>
                      <th className="px-4 py-3 text-right">Taxable</th>
                      <th className="px-4 py-3 text-right">VAT 13%</th>
                      <th className="px-4 py-3 text-right font-black">Grand Total</th>
                      <th className="px-4 py-3 text-right text-emerald-600">Paid</th>
                      <th className="px-4 py-3 text-right text-rose-600">Due</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-4 py-3">Draft Ref #</th>
                      <th className="px-4 py-3">Date (AD / BS)</th>
                      <th className="px-4 py-3">Customer & Type</th>
                      <th className="px-4 py-3">PAN/VAT</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3 text-right">Est. VAT 13%</th>
                      <th className="px-4 py-3 text-right font-bold">Est. Total</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                        {invoiceStateFilter === 'draft' ? (
                          <div>
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-500" />
                            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">No Draft Sales Invoices Found</p>
                            <p className="text-2xs mt-1 text-slate-400">
                              Draft sales invoices allow quoting and preparing guest/customer orders without deducting inventory stock.
                            </p>
                            <button
                              onClick={() => setShowNewDraftModal(true)}
                              className="mt-3 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" /> Create Draft Invoice
                            </button>
                          </div>
                        ) : (
                          <div>
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="font-semibold text-sm">No finalized sales invoices found</p>
                            <p className="text-2xs mt-1">Try adjusting your filters or search keywords.</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(sale => {
                      const taxable = sale.taxableAmount ?? sale.subtotal ?? 0;

                      if (invoiceStateFilter === 'draft') {
                        return (
                          <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                              {sale.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 font-mono text-2xs text-slate-600 dark:text-slate-300">
                              <div>{formatDate(sale.date)}</div>
                              <div className="text-3xs text-slate-400">{toNepaliBSDate(sale.date)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {sale.customerName}
                              </div>
                              <div className="text-3xs text-slate-400 capitalize flex items-center gap-1.5">
                                <span>{sale.customerType}</span>
                                {sale.customerPhone && <span>• {sale.customerPhone}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                              {sale.customerPanVat || 'Counter'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-2xs font-semibold">
                                {sale.items?.length || 0} line items
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              {formatNPR(taxable)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">
                              {formatNPR(sale.taxAmount || 0)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              {formatNPR(sale.grandTotal)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <Clock className="w-2.5 h-2.5" /> Draft
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleFinalizeSaleDraft(sale.id, sale.invoiceNumber)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-2xs font-semibold flex items-center gap-1 shadow-xs transition-all"
                                  title="Finalize & Issue Official Invoice"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Finalize & Issue</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedInvoice(sale);
                                    setModalInitialTab('view');
                                  }}
                                  className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-md transition-all"
                                  title="View Draft Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSaleDraft(sale.id, sale.invoiceNumber)}
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-md transition-all"
                                  title="Discard Draft"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {sale.invoiceNumber}
                          </td>
                          <td className="px-4 py-3 font-mono text-2xs text-slate-600 dark:text-slate-300">
                            <div>{formatDate(sale.date)}</div>
                            <div className="text-3xs text-slate-400">{toNepaliBSDate(sale.date)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {sale.customerName}
                            </div>
                            <div className="text-3xs text-slate-400 capitalize flex items-center gap-1.5">
                              <span>{sale.customerType}</span>
                              {sale.customerPhone && <span>• {sale.customerPhone}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                            {sale.customerPanVat || 'Counter'}
                          </td>
                          <td className="px-4 py-3 font-mono text-2xs uppercase text-slate-700 dark:text-slate-300">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-3xs font-semibold">
                              {sale.paymentMethod.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatNPR(taxable)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">
                            {formatNPR(sale.taxAmount || 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatNPR(sale.grandTotal)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {formatNPR(sale.paidAmount || 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                            {formatNPR(sale.dueAmount || 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={sale.paymentStatus} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setSelectedInvoice(sale);
                                  setModalInitialTab('view');
                                }}
                                className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg transition-all"
                                title="View Tax Invoice"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedInvoice(sale);
                                  setModalInitialTab('edit');
                                }}
                                className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg transition-all"
                                title="Return Items / Edit"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              {(sale.dueAmount || 0) > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedInvoice(sale);
                                    setModalInitialTab('settle');
                                  }}
                                  className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg transition-all"
                                  title="Settle Due Payment"
                                >
                                  <Wallet className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {filteredSales.length > 0 && invoiceStateFilter === 'finalized' && (
                  <tfoot className="bg-slate-100 dark:bg-slate-800/90 font-mono font-bold text-xs border-t-2 border-slate-300 dark:border-slate-700">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right font-sans uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Summary Totals ({filteredSales.length} Invoices):
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                        {formatNPR(totalTaxableSales)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">
                        {formatNPR(totalVatCollected)}
                      </td>
                      <td className="px-4 py-3 text-right text-indigo-600 dark:text-indigo-400 text-sm">
                        {formatNPR(totalGrossSales)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                        {formatNPR(totalPaidAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">
                        {formatNPR(totalDueAmount)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SALES RETURNS TABLE */}
      {activeTab === 'returns' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Credit Notes & Sales Returns (फिर्ता बिल खाता)</h2>
              <p className="text-2xs text-slate-500">Official credit notes and inventory stock restitution.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Return #</th>
                  <th className="px-4 py-3">Original Inv #</th>
                  <th className="px-4 py-3">Date (AD / BS)</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items Returned</th>
                  <th className="px-4 py-3 text-right">Taxable Refund</th>
                  <th className="px-4 py-3 text-right">VAT Refund</th>
                  <th className="px-4 py-3 text-right font-black">Total Refund</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {salesReturns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No sales returns recorded</p>
                      <p className="text-2xs mt-1">Returns created from the invoice detail modal will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  salesReturns.map(ret => (
                    <tr key={ret.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {ret.returnNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                        {ret.originalInvoiceNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs text-slate-600 dark:text-slate-300">
                        <div>{formatDate(ret.date)}</div>
                        <div className="text-3xs text-slate-400">{toNepaliBSDate(ret.date)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{ret.customerName}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs">
                        <div className="space-y-0.5">
                          {ret.items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{it.productName}</span>
                              <span className="text-rose-600 font-bold">x{it.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatNPR(ret.taxableAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">
                        {formatNPR(ret.taxAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatNPR(ret.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                          {ret.refundStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: ITEM-WISE SALES */}
      {activeTab === 'items' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Item-Wise Sales & Margin Performance</h2>
            <p className="text-2xs text-slate-500">Ranking of menu items and products by sales turnover and gross profit.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Total Qty Sold</th>
                  <th className="px-4 py-3 text-right">Invoices Present</th>
                  <th className="px-4 py-3 text-right font-black">Total Revenue</th>
                  <th className="px-4 py-3 text-right">COGS (Cost)</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Gross Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {itemizedSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <Boxes className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No item sales recorded</p>
                    </td>
                  </tr>
                ) : (
                  itemizedSales.map(item => {
                    const grossMargin = item.totalRevenue - item.totalCost;
                    const marginPercent = item.totalRevenue > 0 ? ((grossMargin / item.totalRevenue) * 100).toFixed(1) : '0';
                    return (
                      <tr key={item.productId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          {item.productName}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-2xs">
                          {item.sku}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {item.totalQty} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {item.invoiceCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {formatNPR(item.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {formatNPR(item.totalCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatNPR(grossMargin)} ({marginPercent}%)
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

      {/* VIEW 4: CUSTOMER SUMMARY */}
      {activeTab === 'customers' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Customer Sales & Outstanding Ledger Summary</h2>
            <p className="text-2xs text-slate-500">Consolidated purchases, payment compliance, and outstanding amounts by client.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">PAN/VAT</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right font-black">Total Sales</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Total Paid</th>
                  <th className="px-4 py-3 text-right text-rose-600 font-bold">Current Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerSalesSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No customer transactions found</p>
                    </td>
                  </tr>
                ) : (
                  customerSalesSummary.map(c => (
                    <tr key={c.customerId || c.customerName} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {c.customerName}
                        {c.phone && <span className="block text-3xs text-slate-400 font-mono">{c.phone}</span>}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                        {c.customerType}
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                        {c.panVat || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {c.invoiceCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {formatNPR(c.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600">
                        {formatNPR(c.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                        {formatNPR(c.totalDue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: PAYMENT BREAKDOWN */}
      {activeTab === 'payment_methods' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(paymentMethodSummary).map(([method, data]: [string, any]) => (
            <div key={method} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 capitalize">
                  {method.replace('_', ' ')}
                </span>
                <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {formatNPR(data.total)}
              </div>
              <div className="text-2xs text-slate-500 flex justify-between">
                <span>Total Transactions:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{data.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: NEW SALES DRAFT / INVOICE */}
      {showNewDraftModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Create Sales Draft / Pro-Forma Invoice
                </h3>
              </div>
              <button onClick={() => setShowNewDraftModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs">
              {/* Customer selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer / Guest</label>
                  <select
                    value={draftCustomerId}
                    onChange={(e) => {
                      setDraftCustomerId(e.target.value);
                      const c = customers.find(cust => cust.id === e.target.value);
                      if (c) {
                        setDraftCustomName(c.name);
                        setDraftCustomPhone(c.phone || '');
                        setDraftCustomPan(c.panVatNumber || '');
                      } else {
                        setDraftCustomName('Walk-in Guest');
                        setDraftCustomPhone('');
                        setDraftCustomPan('');
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                  >
                    <option value="cust-walkin">Walk-in Table Guest</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone || c.customerCode})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Guest Name / Table Note</label>
                  <input
                    type="text"
                    placeholder="e.g. VIP Party / Walk-in"
                    value={draftCustomName}
                    onChange={(e) => setDraftCustomName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Godown / Branch</label>
                  <select
                    value={draftWarehouseId}
                    onChange={(e) => setDraftWarehouseId(e.target.value)}
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
                        if (prod) setTempUnitPrice(prod.retailPrice || 100);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({formatNPR(p.retailPrice)})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-3xs text-slate-400">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={tempQuantity}
                      onChange={(e) => setTempQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs text-slate-400">Unit Price (NPR)</label>
                    <input
                      type="number"
                      min={0}
                      value={tempUnitPrice}
                      onChange={(e) => setTempUnitPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddDraftItem}
                  className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded text-2xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Item to Draft
                </button>

                {/* Items Table */}
                {draftItems.length > 0 && (
                  <table className="w-full text-2xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                        <th className="py-1 text-left">Item</th>
                        <th className="py-1 text-right">Qty</th>
                        <th className="py-1 text-right">Price</th>
                        <th className="py-1 text-right">Tax (13%)</th>
                        <th className="py-1 text-right">Total</th>
                        <th className="py-1 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {draftItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 font-medium">{item.productName}</td>
                          <td className="py-1.5 text-right font-mono">{item.quantity} {item.selectedUnit}</td>
                          <td className="py-1.5 text-right font-mono">{formatNPR(item.unitPrice)}</td>
                          <td className="py-1.5 text-right font-mono">{formatNPR(item.taxAmount || 0)}</td>
                          <td className="py-1.5 text-right font-mono font-bold">{formatNPR(item.lineTotal)}</td>
                          <td className="py-1.5 text-center">
                            <button type="button" onClick={() => handleRemoveDraftItem(idx)} className="text-rose-500 hover:text-rose-700">
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
                    <label className="block text-2xs text-slate-500 mb-0.5">Payment Method</label>
                    <select
                      value={draftPaymentMethod}
                      onChange={(e) => setDraftPaymentMethod(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                    >
                      <option value="cash">Cash In Hand</option>
                      <option value="bank_transfer">Fonepay / Bank QR</option>
                      <option value="esewa">eSewa</option>
                      <option value="khalti">Khalti</option>
                      <option value="credit">Credit / Khata</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-2xs text-slate-500 mb-0.5">Notes / Terms</label>
                    <input
                      type="text"
                      placeholder="e.g. Quotation valid for 7 days"
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl space-y-1.5 font-mono text-2xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taxable Subtotal:</span>
                    <span>{formatNPR(draftSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">VAT (13%):</span>
                    <span>{formatNPR(draftTaxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-700 pt-1 text-slate-900 dark:text-slate-100">
                    <span>Est. Grand Total:</span>
                    <span>{formatNPR(draftGrandTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewDraftModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={draftItems.length === 0}
                  onClick={() => handleSaveDraftInvoice(true)}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 ${
                    draftItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Clock className="w-4 h-4" /> Save as Draft Invoice
                </button>

                <button
                  type="button"
                  disabled={draftItems.length === 0}
                  onClick={() => handleSaveDraftInvoice(false)}
                  className={`px-5 py-2 rounded-lg font-semibold text-white flex items-center gap-1.5 ${
                    draftItems.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Finalize & Issue Invoice
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* INVOICE DETAIL & TAX INVOICE MODAL WITH SETTLE & UPDATE */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          initialTab={modalInitialTab}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

    </div>
  );
};
