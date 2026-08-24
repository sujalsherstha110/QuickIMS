import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, Filter, Calendar, Download, Printer, Eye, X, 
  DollarSign, CheckCircle2, Clock, AlertCircle, Users, Boxes,
  TrendingUp, CreditCard, QrCode, ArrowDownToLine, RefreshCw,
  Building, ChevronRight, RotateCcw, History, Wallet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SaleInvoice } from '../../types';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';
import { InvoiceDetailModal } from '../common/InvoiceDetailModal';

export const InvoiceReportView: React.FC = () => {
  const { sales, settings, customers, warehouses, salesReturns } = useApp();

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

  // Selected Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'view' | 'settle' | 'edit'>('view');

  // Helper for Date filtering
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const last7DaysStart = todayStart - (7 * 86400000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Filtered Sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
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
    sales, dateRange, customStartDate, customEndDate, 
    paymentStatusFilter, paymentMethodFilter, customerTypeFilter, 
    warehouseFilter, searchQuery, todayStart, yesterdayStart, last7DaysStart, thisMonthStart
  ]);

  // Aggregate Metrics
  const totalInvoicesCount = filteredSales.length;
  const totalGrossSales = filteredSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
  const totalTaxableSales = filteredSales.reduce((sum, s) => sum + (s.taxableAmount ?? s.subtotal ?? 0), 0);
  const totalVatCollected = filteredSales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
  const totalPaidAmount = filteredSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalDueAmount = filteredSales.reduce((sum, s) => sum + (s.dueAmount || 0), 0);

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

    filteredSales.forEach(sale => {
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
  }, [filteredSales]);

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

    filteredSales.forEach(s => {
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
  }, [filteredSales]);

  // Payment Method Breakdown
  const paymentMethodSummary = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredSales.forEach(s => {
      const method = s.paymentMethod || 'cash';
      if (!map[method]) {
        map[method] = { count: 0, total: 0 };
      }
      map[method].count += 1;
      map[method].total += s.grandTotal;
    });
    return map;
  }, [filteredSales]);

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
            Sales Invoices & Tax Register Report
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete audit trail of sales tax invoices, customer billing records, VAT output, and payment settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Total Invoices</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100">{totalInvoicesCount}</div>
          <div className="text-3xs text-slate-500 font-mono">Issued records</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Total Gross Sales</div>
          <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">{formatNPR(totalGrossSales)}</div>
          <div className="text-3xs text-slate-500 font-mono">Inclusive of VAT</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Taxable Sales</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">{formatNPR(totalTaxableSales)}</div>
          <div className="text-3xs text-slate-500 font-mono">Net of 13% VAT</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Output VAT 13%</div>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">{formatNPR(totalVatCollected)}</div>
          <div className="text-3xs text-slate-500 font-mono">Tax liability</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Cash / Paid</div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatNPR(totalPaidAmount)}</div>
          <div className="text-3xs text-slate-500 font-mono">Received payments</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="text-3xs font-bold uppercase tracking-wider text-slate-400">Due / Receivables</div>
          <div className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">{formatNPR(totalDueAmount)}</div>
          <div className="text-3xs text-slate-500 font-mono">Pending balance</div>
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
              <option value="contractor">Contractor / Plumber</option>
              <option value="dealer">Dealer</option>
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

      {/* Sub-view Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
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
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
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
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
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
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
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
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'payment_methods'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Breakdown</span>
        </button>
      </div>

      {/* VIEW 1: INVOICES REGISTER TABLE */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
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
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No sales invoices found</p>
                      <p className="text-2xs mt-1">Try adjusting your filters or search keywords.</p>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(sale => {
                    const taxable = sale.taxableAmount ?? sale.subtotal ?? 0;
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
              {filteredSales.length > 0 && (
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
      )}

      {/* VIEW: SALES RETURNS & CREDIT NOTES REGISTER */}
      {activeTab === 'returns' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Return Voucher #</th>
                  <th className="px-4 py-3">Date (AD / BS)</th>
                  <th className="px-4 py-3">Original Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items Returned</th>
                  <th className="px-4 py-3">Settlement</th>
                  <th className="px-4 py-3 text-center">Restocked</th>
                  <th className="px-4 py-3 text-right font-bold text-rose-600">Refund Amount</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {salesReturns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No sales returns recorded yet</p>
                      <p className="text-2xs mt-1">Open any invoice from the register and use "Edit & Return" to process customer returns.</p>
                    </td>
                  </tr>
                ) : (
                  salesReturns.map(ret => {
                    const originalSale = sales.find(s => s.id === ret.originalInvoiceId || s.invoiceNumber === ret.originalInvoiceNumber);
                    return (
                      <tr key={ret.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {ret.returnNumber}
                        </td>
                        <td className="px-4 py-3 font-mono text-2xs text-slate-600 dark:text-slate-300">
                          <div>{formatDate(ret.date)}</div>
                          <div className="text-3xs text-slate-400">{toNepaliBSDate(ret.date)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {ret.originalInvoiceNumber || ret.originalInvoiceId}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {ret.customerName || 'Walk-in Customer'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5 max-w-xs">
                            {ret.items.map((it, iIdx) => (
                              <div key={iIdx} className="text-2xs text-slate-700 dark:text-slate-300">
                                <span className="font-medium">{it.productName}</span>{' '}
                                <span className="font-mono text-rose-600 font-bold">({it.returnedQuantity} qty)</span>
                                {it.reason && <span className="text-3xs text-slate-400 capitalize"> • {it.reason.replace('_', ' ')}</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-2xs uppercase text-slate-700 dark:text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-3xs font-bold capitalize">
                            {ret.refundMethod.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ret.restockItems ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-3xs font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-3xs">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                          -{formatNPR(ret.totalRefundAmount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {originalSale ? (
                            <button
                              onClick={() => {
                                setSelectedInvoice(originalSale);
                                setModalInitialTab('view');
                              }}
                              className="px-2.5 py-1 text-2xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                              View Invoice
                            </button>
                          ) : (
                            <span className="text-3xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {salesReturns.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-800/90 font-mono font-bold text-xs border-t-2 border-slate-300 dark:border-slate-700">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-right font-sans uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Total Processed Returns ({salesReturns.length} Vouchers):
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400 text-sm font-black">
                      -{formatNPR(salesReturns.reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: ITEM-WISE SALES SUMMARY */}
      {activeTab === 'items' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right">Total Qty Sold</th>
                  <th className="px-4 py-3 text-right">Gross Revenue</th>
                  <th className="px-4 py-3 text-right">Estimated Cost</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Gross Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {itemizedSales.map(item => {
                  const margin = item.totalRevenue - item.totalCost;
                  const marginPercent = item.totalRevenue > 0 ? Math.round((margin / item.totalRevenue) * 100) : 0;
                  return (
                    <tr key={item.productId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {item.productName}
                      </td>
                      <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {item.invoiceCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {item.totalQty} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatNPR(item.totalRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {formatNPR(item.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatNPR(margin)} <span className="text-3xs text-emerald-500 font-normal">({marginPercent}%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: CUSTOMER SUMMARY */}
      {activeTab === 'customers' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">PAN/VAT</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right font-bold">Total Sales</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Total Paid</th>
                  <th className="px-4 py-3 text-right text-rose-600">Pending Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerSalesSummary.map((cust, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      <div>{cust.customerName}</div>
                      {cust.phone && <div className="text-3xs text-slate-400 font-mono">{cust.phone}</div>}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">
                      {cust.customerType}
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                      {cust.panVat || 'Counter'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {cust.invoiceCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatNPR(cust.totalSales)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {formatNPR(cust.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatNPR(cust.totalDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: PAYMENT METHOD BREAKDOWN */}
      {activeTab === 'payment_methods' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(paymentMethodSummary) as [string, { count: number; total: number }][]).map(([method, data]) => (
            <div key={method} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
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
