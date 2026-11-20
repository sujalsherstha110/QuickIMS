import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Search, Filter, Calendar, Download, Printer, Eye, X, 
  DollarSign, CheckCircle2, Clock, AlertCircle, Building2, Truck,
  Boxes, TrendingUp, CreditCard, ArrowDownToLine, RefreshCw,
  Warehouse as WarehouseIcon, ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PurchaseInvoice } from '../../types';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';

export const BillReportView: React.FC = () => {
  const { purchases, settings, suppliers, warehouses, canStaffDo, activePOSStaff, activeStaffUser } = useApp();
  const currentOperator = activeStaffUser || activePOSStaff;
  const canExportReport = canStaffDo('reportsAnalytics', 'read') || canStaffDo('invoicesBilling', 'read');
  const canReprintBills = !currentOperator || currentOperator.permissions?.canReprintBills !== false;

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'bills' | 'suppliers' | 'items'>('bills');

  // Selected Bill Modal State
  const [selectedBill, setSelectedBill] = useState<PurchaseInvoice | null>(null);

  // Helper for Date filtering
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const last7DaysStart = todayStart - (7 * 86400000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // Date Filter
      if (dateRange === 'today' && p.date < todayStart) return false;
      if (dateRange === 'yesterday' && (p.date < yesterdayStart || p.date >= todayStart)) return false;
      if (dateRange === 'week' && p.date < last7DaysStart) return false;
      if (dateRange === 'month' && p.date < thisMonthStart) return false;
      if (dateRange === 'custom') {
        if (customStartDate && p.date < new Date(customStartDate).getTime()) return false;
        if (customEndDate && p.date > (new Date(customEndDate).getTime() + 86400000)) return false;
      }

      // Status Filter
      if (paymentStatusFilter !== 'all' && p.paymentStatus !== paymentStatusFilter) return false;

      // Supplier Filter
      if (supplierFilter !== 'all' && p.supplierId !== supplierFilter) return false;

      // Warehouse Filter
      if (warehouseFilter !== 'all' && p.warehouseId !== warehouseFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = String(searchQuery || '').toLowerCase();
        const matchesRef = String(p.purchaseNumber || '').toLowerCase().includes(query);
        const matchesSupInvoice = p.supplierInvoiceNumber && String(p.supplierInvoiceNumber).toLowerCase().includes(query);
        const matchesSupplier = String(p.supplierName || '').toLowerCase().includes(query);
        const matchesPan = p.supplierPanVat && String(p.supplierPanVat).includes(query);
        const matchesItem = (p.items || []).some(i => String(i.productName || '').toLowerCase().includes(query) || String(i.sku || '').toLowerCase().includes(query));

        if (!matchesRef && !matchesSupInvoice && !matchesSupplier && !matchesPan && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [
    purchases, dateRange, customStartDate, customEndDate, 
    paymentStatusFilter, supplierFilter, warehouseFilter, 
    searchQuery, todayStart, yesterdayStart, last7DaysStart, thisMonthStart
  ]);

  // Aggregate Metrics
  const totalBillsCount = filteredPurchases.length;
  const totalGrossPurchases = filteredPurchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
  const totalTaxablePurchases = filteredPurchases.reduce((sum, p) => sum + (p.subtotal || 0), 0);
  const totalInputVatCredit = filteredPurchases.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
  const totalPaidAmount = filteredPurchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const totalDueAmount = filteredPurchases.reduce((sum, p) => sum + (p.dueAmount || 0), 0);

  // Supplier Aggregate Data
  const supplierPurchasesSummary = useMemo(() => {
    const map: Record<string, {
      supplierId: string;
      supplierName: string;
      panVat?: string;
      billCount: number;
      totalPurchases: number;
      totalPaid: number;
      totalDue: number;
    }> = {};

    filteredPurchases.forEach(p => {
      const key = p.supplierId || p.supplierName;
      if (!map[key]) {
        map[key] = {
          supplierId: p.supplierId,
          supplierName: p.supplierName,
          panVat: p.supplierPanVat,
          billCount: 0,
          totalPurchases: 0,
          totalPaid: 0,
          totalDue: 0,
        };
      }
      map[key].billCount += 1;
      map[key].totalPurchases += p.grandTotal;
      map[key].totalPaid += p.paidAmount;
      map[key].totalDue += p.dueAmount;
    });

    return Object.values(map).sort((a, b) => b.totalPurchases - a.totalPurchases);
  }, [filteredPurchases]);

  // Itemized Purchase Breakdown
  const itemizedPurchases = useMemo(() => {
    const map: Record<string, {
      productId: string;
      productName: string;
      sku: string;
      unit: string;
      totalQty: number;
      totalSpend: number;
      billCount: number;
      avgUnitCost: number;
    }> = {};

    filteredPurchases.forEach(purchase => {
      purchase.items.forEach(item => {
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            unit: item.selectedUnit,
            totalQty: 0,
            totalSpend: 0,
            billCount: 0,
            avgUnitCost: 0,
          };
        }
        map[item.productId].totalQty += item.quantity;
        map[item.productId].totalSpend += item.lineTotal;
        map[item.productId].billCount += 1;
      });
    });

    return Object.values(map).map(i => ({
      ...i,
      avgUnitCost: i.totalQty > 0 ? Math.round(i.totalSpend / i.totalQty) : 0
    })).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [filteredPurchases]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!canExportReport || filteredPurchases.length === 0) return;

    const headers = [
      'Bill Reference #',
      'Supplier Invoice #',
      'Date (AD)',
      'Date (BS)',
      'Supplier Name',
      'Supplier PAN/VAT',
      'Destination Warehouse',
      'Taxable Amount (NPR)',
      'Input VAT 13% (NPR)',
      'Freight & Expenses (NPR)',
      'Grand Total (NPR)',
      'Paid Amount (NPR)',
      'Due Amount (NPR)',
      'Payment Status'
    ];

    const rows = filteredPurchases.map(p => [
      `"${p.purchaseNumber}"`,
      `"${p.supplierInvoiceNumber || ''}"`,
      `"${formatDate(p.date)}"`,
      `"${toNepaliBSDate(p.date)}"`,
      `"${p.supplierName.replace(/"/g, '""')}"`,
      `"${p.supplierPanVat || ''}"`,
      `"${p.warehouseName || ''}"`,
      p.subtotal || 0,
      p.taxAmount || 0,
      (p.freightCost || 0) + (p.otherExpenses || 0),
      p.grandTotal || 0,
      p.paidAmount || 0,
      p.dueAmount || 0,
      `"${p.paymentStatus}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchase_Bill_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!canReprintBills) return;
    window.print();
  };

  return (
    <div className="space-y-5 pb-10">
      
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Procurement & Vendor Bills Module
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Purchase Bills & Input Tax Register Report
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete record of supplier purchase bills, manufacturer invoices, input VAT tax credit, and vendor accounts payable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canExportReport && (
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all shadow-xs"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
          {canReprintBills && (
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" /> Print Report
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Total Bills</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100">{totalBillsCount}</div>
          <div className="text-3xs text-slate-500 font-mono">Purchase entries</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Total Purchases</div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatNPR(totalGrossPurchases)}</div>
          <div className="text-3xs text-slate-500 font-mono">Gross spend</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Taxable Purchases</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">{formatNPR(totalTaxablePurchases)}</div>
          <div className="text-3xs text-slate-500 font-mono">Net of VAT</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Input VAT 13% Credit</div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatNPR(totalInputVatCredit)}</div>
          <div className="text-3xs text-slate-500 font-mono">Claimable tax</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Paid to Vendors</div>
          <div className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">{formatNPR(totalPaidAmount)}</div>
          <div className="text-3xs text-slate-500 font-mono">Cleared payments</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Due / Payables</div>
          <div className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">{formatNPR(totalDueAmount)}</div>
          <div className="text-3xs text-slate-500 font-mono">Vendor balance</div>
        </div>
      </div>

      {/* Filters & Search Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 justify-between">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by bill ref #, supplier bill #, supplier name, PAN, or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-emerald-500 font-medium"
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
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden font-medium"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Fully Settled / Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Unpaid / Outstanding Due</option>
            </select>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Supplier / Vendor</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-hidden font-medium"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name || s.companyName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Destination Godown / Branch</label>
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

      {/* Sub-view Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('bills')}
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'bills'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Purchase Bills Register ({filteredPurchases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'suppliers'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Supplier Summary ({supplierPurchasesSummary.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('items')}
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'items'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Item-Wise Purchases ({itemizedPurchases.length})</span>
        </button>
      </div>

      {/* VIEW 1: PURCHASE BILLS REGISTER TABLE */}
      {activeTab === 'bills' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Bill Ref #</th>
                  <th className="px-4 py-3">Supplier Bill #</th>
                  <th className="px-4 py-3">Date (AD / BS)</th>
                  <th className="px-4 py-3">Supplier & PAN</th>
                  <th className="px-4 py-3">Destination Godown</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">Input VAT 13%</th>
                  <th className="px-4 py-3 text-right font-black">Grand Total</th>
                  <th className="px-4 py-3 text-right text-blue-600">Paid</th>
                  <th className="px-4 py-3 text-right text-rose-600">Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No purchase bills found</p>
                      <p className="text-2xs mt-1">Try adjusting your filters or search keywords.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(bill => (
                    <tr key={bill.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {bill.purchaseNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs text-slate-700 dark:text-slate-300">
                        {bill.supplierInvoiceNumber || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs text-slate-600 dark:text-slate-300">
                        <div>{formatDate(bill.date)}</div>
                        <div className="text-3xs text-slate-400">{toNepaliBSDate(bill.date)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {bill.supplierName}
                        </div>
                        <div className="text-3xs text-slate-400 font-mono">
                          PAN: {bill.supplierPanVat || 'Registered'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-2xs">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-3xs font-medium">
                          {bill.warehouseName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatNPR(bill.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {formatNPR(bill.taxAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatNPR(bill.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-blue-600 dark:text-blue-400">
                        {formatNPR(bill.paidAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                        {formatNPR(bill.dueAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={bill.paymentStatus} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedBill(bill)}
                          className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg transition-all"
                          title="View Full Purchase Bill"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredPurchases.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-800/90 font-mono font-bold text-xs border-t-2 border-slate-300 dark:border-slate-700">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-sans uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Summary Totals ({filteredPurchases.length} Bills):
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                      {formatNPR(totalTaxablePurchases)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                      {formatNPR(totalInputVatCredit)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-300 text-sm">
                      {formatNPR(totalGrossPurchases)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
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
      )}

      {/* VIEW 2: SUPPLIER SUMMARY */}
      {activeTab === 'suppliers' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">PAN/VAT</th>
                  <th className="px-4 py-3 text-right">Bills Count</th>
                  <th className="px-4 py-3 text-right font-bold">Total Invoiced Spend</th>
                  <th className="px-4 py-3 text-right text-blue-600">Total Settled</th>
                  <th className="px-4 py-3 text-right text-rose-600">Outstanding Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {supplierPurchasesSummary.map((sup, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {sup.supplierName}
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                      {sup.panVat || 'Registered'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {sup.billCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatNPR(sup.totalPurchases)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">
                      {formatNPR(sup.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatNPR(sup.totalDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: ITEM-WISE PURCHASES SUMMARY */}
      {activeTab === 'items' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Bills Count</th>
                  <th className="px-4 py-3 text-right">Total Qty Purchased</th>
                  <th className="px-4 py-3 text-right">Avg Unit Cost</th>
                  <th className="px-4 py-3 text-right font-bold">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {itemizedPurchases.map(item => (
                  <tr key={item.productId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {item.productName}
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {item.billCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {item.totalQty} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatNPR(item.avgUnitCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatNPR(item.totalSpend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BILL DETAIL & PURCHASE VOUCHER PRINT MODAL */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Actions Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Purchase Bill: {selectedBill.purchaseNumber}
                  </h3>
                  <p className="text-3xs text-slate-500 font-mono">
                    Supplier Bill Ref: {selectedBill.supplierInvoiceNumber || 'N/A'} • Date: {formatDate(selectedBill.date)} ({toNepaliBSDate(selectedBill.date)})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canReprintBills && (
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Purchase Voucher
                  </button>
                )}
                <button
                  onClick={() => setSelectedBill(null)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="space-y-4 text-xs font-sans">
              
              {/* Header Details */}
              <div className="text-center pb-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
                <h2 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight">
                  {settings.companyName}
                </h2>
                <p className="text-2xs text-slate-500">
                  {settings.address.street}, {settings.address.municipality}, {settings.address.district} | Tel: {settings.phone}, {settings.mobile}
                </p>
                <p className="text-2xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  PAN / VAT: {settings.panNumber}
                </p>
                <div className="inline-block px-3 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-3xs uppercase tracking-widest border border-slate-200 dark:border-slate-700 mt-1">
                  GOODS RECEIVED & PURCHASE BILL VOUCHER
                </div>
              </div>

              {/* Supplier & Bill Meta */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-2xs">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase">Supplier / Vendor Details</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block mt-0.5">
                    {selectedBill.supplierName}
                  </span>
                  <div className="text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                    Supplier PAN/VAT: <span className="font-bold">{selectedBill.supplierPanVat || 'Registered'}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 font-mono">
                    Received at: <span className="font-bold">{selectedBill.warehouseName}</span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-slate-400 font-sans font-semibold uppercase">Bill Reference Info</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                    System Ref: {selectedBill.purchaseNumber}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    Vendor Inv #: {selectedBill.supplierInvoiceNumber || 'N/A'}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    AD Date: {formatDate(selectedBill.date)}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    BS Date: {toNepaliBSDate(selectedBill.date)}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2 text-right">Received Qty</th>
                      <th className="px-3 py-2 text-right">Unit Rate</th>
                      <th className="px-3 py-2 text-right">Tax (13%)</th>
                      <th className="px-3 py-2 text-right font-bold">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-2xs">
                    {selectedBill.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-sans font-medium text-slate-900 dark:text-slate-100">
                          {item.productName}
                          <span className="block text-3xs text-slate-400 font-mono">SKU: {item.sku}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold">{item.quantity} {item.selectedUnit}</td>
                        <td className="px-3 py-2 text-right">{formatNPR(item.unitCost)}</td>
                        <td className="px-3 py-2 text-right text-emerald-600 font-medium">13%</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100">{formatNPR(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Breakdown */}
              <div className="flex justify-end pt-2">
                <div className="w-72 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 font-sans">Taxable Subtotal:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatNPR(selectedBill.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 font-sans">Input VAT (13%):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNPR(selectedBill.taxAmount || 0)}
                    </span>
                  </div>
                  {(selectedBill.freightCost || 0) + (selectedBill.otherExpenses || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 font-sans">Freight & Transport:</span>
                      <span>{formatNPR((selectedBill.freightCost || 0) + (selectedBill.otherExpenses || 0))}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b-2 border-slate-300 dark:border-slate-700 text-sm font-bold">
                    <span className="font-sans">Grand Total:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      {formatNPR(selectedBill.grandTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-blue-600 font-medium">
                    <span className="font-sans">Paid to Vendor:</span>
                    <span>{formatNPR(selectedBill.paidAmount || 0)}</span>
                  </div>
                  {selectedBill.dueAmount > 0 && (
                    <div className="flex justify-between py-1 text-rose-600 font-bold">
                      <span className="font-sans">Payable Due:</span>
                      <span>{formatNPR(selectedBill.dueAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
