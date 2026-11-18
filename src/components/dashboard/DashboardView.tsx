import React, { useState, useMemo } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  DollarSign, TrendingUp, ShoppingBag, Truck, 
  AlertTriangle, Users, Building2, Package, Plus, 
  Receipt, Calendar, CreditCard, ChevronRight,
  ArrowRight, Phone, Clock, ArrowUpRight,
  UtensilsCrossed, ChefHat, Flame
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SaleInvoice, Product, Customer } from '../../types';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';
import { InvoiceDetailModal } from '../common/InvoiceDetailModal';
import { ProductStockModal } from '../common/ProductStockModal';
import { CustomerLedgerModal } from '../common/CustomerLedgerModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

type TimeRange = 'today' | 'week' | 'month' | 'fy';
type MobileSection = 'invoices' | 'alerts' | 'dues' | 'top_items';

export const DashboardView: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { 
    sales, purchases, expenses, products, customers, suppliers, settings, currentWarehouseId, warehouses,
    diningTables, kitchenTickets
  } = useApp();

  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [activeSection, setActiveSection] = useState<MobileSection>('invoices');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomerForLedger, setSelectedCustomerForLedger] = useState<Customer | null>(null);

  const formatPaymentMethod = (method: string) => {
    switch (String(method || '').toLowerCase()) {
      case 'bank_transfer': return 'Bank Transfer';
      case 'esewa': return 'eSewa';
      case 'khalti': return 'Khalti';
      case 'fonepay': return 'Fonepay QR';
      case 'cash': return 'Cash';
      case 'credit': return 'Credit (खाता)';
      case 'cheque': return 'Cheque';
      default: return method?.replace('_', ' ') || 'Cash';
    }
  };

  // Time Range Filter Calculation
  const filteredData = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const filterByTime = (dateNum: number) => {
      if (timeRange === 'today') return dateNum >= startOfDay;
      if (timeRange === 'week') return dateNum >= startOfWeek;
      if (timeRange === 'month') return dateNum >= startOfMonth;
      return true; // Fiscal Year / All
    };

    const periodSales = sales.filter(s => filterByTime(s.date));
    const periodExpenses = expenses.filter(e => filterByTime(e.date));

    // Summary calculations
    const revenue = periodSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    const grossProfit = periodSales.reduce((acc, s) => acc + (s.grossProfit || 0), 0);
    const totalExp = periodExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const netProfit = grossProfit - totalExp;
    const cashCollected = periodSales.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const creditExtended = periodSales.reduce((acc, s) => acc + (s.dueAmount || 0), 0);
    const grossMarginPercent = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(0) : '0';

    // Top Selling items in range
    const itemMap = new Map<string, { name: string; sku: string; qty: number; totalRev: number; unit: string }>();
    periodSales.forEach(sale => {
      sale.items.forEach(it => {
        const existing = itemMap.get(it.productId) || { name: it.productName, sku: it.sku, qty: 0, totalRev: 0, unit: it.selectedUnit };
        existing.qty += it.quantity;
        existing.totalRev += it.lineTotal;
        itemMap.set(it.productId, existing);
      });
    });

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.totalRev - a.totalRev)
      .slice(0, 5);

    return {
      periodSales,
      revenue,
      grossProfit,
      totalExp,
      netProfit,
      cashCollected,
      creditExtended,
      grossMarginPercent,
      topItems
    };
  }, [sales, expenses, timeRange]);

  // Overall General Positions
  const totalReceivables = useMemo(() => customers.reduce((acc, c) => acc + Math.max(0, c.currentBalance || 0), 0), [customers]);
  const totalPayables = useMemo(() => suppliers.reduce((acc, s) => acc + Math.max(0, s.currentBalance || 0), 0), [suppliers]);
  const totalInventoryValue = useMemo(() => products.reduce((acc, p) => (p.itemType === 'raw_ingredient' || p.trackStock === true) ? acc + ((p.currentStock || 0) * (p.costPrice || 0)) : acc, 0), [products]);
  const lowStockItems = useMemo(() => products.filter(p => p && p.status !== 'discontinued' && (p.itemType === 'raw_ingredient' || p.trackStock === true) && (p.currentStock ?? 0) <= (p.reorderLevel ?? 0)), [products]);
  const customersWithDues = useMemo(() => customers.filter(c => c.currentBalance > 0).sort((a, b) => b.currentBalance - a.currentBalance), [customers]);

  const currentWarehouse = warehouses.find(w => w.id === currentWarehouseId)?.name || 'Main Godown';

  const timeLabel = timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : 'FY ' + settings.fiscalYear;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      
      {/* 1. TOP CONTEXT & SEGMENTED TIME FILTER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 shadow-2xs space-y-2.5">
        {/* Row 1: Date, FY & Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
            <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>{toNepaliBSDate(new Date())}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-3xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              FY {settings.fiscalYear}
            </span>
            <div className="flex items-center gap-1 text-3xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>

        {/* Row 2: Warehouse Location */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2 font-medium">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{currentWarehouse}</span>
        </div>

        {/* Row 3: Time Segmented Filter Pills */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-xs font-medium">
          {(
            [
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: 'fy', label: 'Year' }
            ] as { key: TimeRange; label: string }[]
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setTimeRange(tab.key)}
              className={cn(
                'py-1.5 text-center rounded-md font-medium transition-all text-xs cursor-pointer',
                timeRange === tab.key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. UNIFIED FINANCIAL CARDS (Full Width & Balanced Grid — No Truncation) */}
      <div className="space-y-2.5">
        
        {/* Card 1: Primary Revenue & Profit Card (Full Width) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-3xs">Sales Revenue ({timeLabel})</span>
            <span className="font-mono text-3xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {filteredData.grossMarginPercent}% Margin
            </span>
          </div>

          <div className="mt-1 font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            {formatNPR(filteredData.revenue)}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-3xs text-slate-400 block font-medium">Net Profit</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                {formatNPR(filteredData.netProfit)}
              </span>
            </div>
            <div>
              <span className="text-3xs text-slate-400 block font-medium">Cash Collected</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                {formatNPR(filteredData.cashCollected)}
              </span>
            </div>
            <div>
              <span className="text-3xs text-slate-400 block font-medium">Credit Given</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                {formatNPR(filteredData.creditExtended)}
              </span>
            </div>
          </div>
        </div>

        {/* Restaurant Floor & Kitchen Live Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Active Tables & Occupancy */}
          <div 
            onClick={() => onNavigate('tables')}
            className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-3xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Floor Occupancy & Tables</span>
              </span>
              <span className="text-3xs text-blue-600 dark:text-blue-400 font-medium">Floor Plan →</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
                {diningTables.filter(t => t.status !== 'available').length} / {diningTables.length} Active
              </span>
              <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                ({Math.round(((diningTables.filter(t => t.status !== 'available').length) / (diningTables.length || 1)) * 100)}% Full)
              </span>
            </div>
            <p className="text-3xs text-slate-500 mt-1 font-medium">
              {diningTables.filter(t => t.status === 'seated').length} Seated • {diningTables.filter(t => t.status === 'kot_fired').length} Cooking{diningTables.filter(t => t.status === 'draft').length > 0 ? ` • ${diningTables.filter(t => t.status === 'draft').length} Draft` : ''}
            </p>
          </div>

          {/* Kitchen Display Live Queue */}
          <div 
            onClick={() => onNavigate('kds')}
            className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs hover:border-amber-400 dark:hover:border-amber-600 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-3xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-amber-500" />
                <span>Kitchen KDS Queue</span>
              </span>
              <span className="text-3xs text-amber-600 dark:text-amber-400 font-medium">Live Feed →</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Flame className="w-4 h-4 animate-bounce" />
                {kitchenTickets.filter(k => k.status !== 'completed').length} Pending Tickets
              </span>
            </div>
            <p className="text-3xs text-slate-500 mt-1 font-medium">
              {kitchenTickets.filter(k => k.status === 'ready').length} Ready to Serve • {kitchenTickets.filter(k => k.status === 'in_kitchen').length} In Wok/Grill
            </p>
          </div>
        </div>

        {/* Card 2 & 3: Receivables & Stock Asset (2 Columns on All Screens) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Receivables Card */}
          <div 
            onClick={() => onNavigate('customers')}
            className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-3xs font-semibold uppercase tracking-wider">Customer Dues (बाँकी)</span>
              <span className="text-3xs text-blue-600 dark:text-blue-400 font-medium">Ledger →</span>
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-500">
              {formatNPR(totalReceivables)}
            </div>
            <p className="text-3xs text-slate-500 mt-1 font-medium">
              {customersWithDues.length} parties with pending balance
            </p>
          </div>

          {/* Inventory Valuation Card */}
          <div 
            onClick={() => onNavigate('inventory')}
            className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-3xs font-semibold uppercase tracking-wider">Stock Valuation</span>
              <span className="text-3xs text-blue-600 dark:text-blue-400 font-medium">Stock →</span>
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatNPR(totalInventoryValue)}
            </div>
            <p className="text-3xs text-slate-500 mt-1 font-medium">
              {products.length} SKU items • <span className={lowStockItems.length > 0 ? 'text-rose-600 font-semibold' : 'text-slate-500'}>{lowStockItems.length} low stock</span>
            </p>
          </div>
        </div>

      </div>

      {/* 3. HORIZONTAL SCROLLABLE SUB-TABS (No text cut-off, No '...') */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'invoices', label: 'Recent Invoices', count: filteredData.periodSales.length },
          { id: 'alerts', label: 'Low Stock Alerts', count: lowStockItems.length, alert: lowStockItems.length > 0 },
          { id: 'dues', label: 'Customer Dues', count: customersWithDues.length },
          { id: 'top_items', label: 'Top Moving Items', count: filteredData.topItems.length }
        ].map(tab => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as MobileSection)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer',
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/20 inset'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                'text-3xs px-2 py-0.5 rounded-full font-mono font-bold',
                isActive
                  ? 'bg-blue-800 text-white'
                  : tab.alert
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. ACTIVE TAB CONTENT PANEL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        
        {/* VIEW 1: Recent Invoices */}
        {activeSection === 'invoices' && (
          <div>
            <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Invoices Issued ({timeLabel})
              </span>
              <button
                onClick={() => onNavigate('invoice-reports')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {filteredData.periodSales.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">No invoices recorded for {String(timeLabel || 'this period').toLowerCase()}</p>
                <p className="text-3xs text-slate-400 mt-0.5">Click "POS" in the bottom bar to create a sale</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredData.periodSales.slice(0, 6).map(sale => (
                  <div 
                    key={sale.id} 
                    onClick={() => setSelectedInvoice(sale)}
                    className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer transition-colors space-y-1.5"
                  >
                    {/* Row 1: Invoice # on Left, Grand Total on Right */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {sale.invoiceNumber}
                      </span>
                      <span className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                        {formatNPR(sale.grandTotal)}
                      </span>
                    </div>

                    {/* Row 2: Full Customer Name (No Truncation) */}
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words">
                      {sale.customerName}
                    </div>

                    {/* Row 3: Date & Payment Method */}
                    <div className="flex items-center justify-between text-3xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>{formatDate(sale.date)}</span>
                      <span className="font-sans font-medium text-slate-600 dark:text-slate-300">
                        {formatPaymentMethod(sale.paymentMethod)}
                      </span>
                    </div>

                    {/* Row 4: Status & Balance */}
                    <div className="flex items-center justify-between text-3xs pt-0.5 border-t border-slate-100 dark:border-slate-800/60 font-medium">
                      <div className="flex items-center gap-1.5">
                        {sale.paymentStatus === 'paid' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Paid
                          </span>
                        ) : sale.paymentStatus === 'partial' ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Partial Payment
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Unpaid
                          </span>
                        )}
                      </div>

                      <div className="font-mono">
                        {sale.dueAmount > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            Due: {formatNPR(sale.dueAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">
                            Fully Settled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Low Stock Alerts */}
        {activeSection === 'alerts' && (
          <div>
            <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Items Requiring Reorder
              </span>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                Inventory <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Package className="w-8 h-8 mx-auto text-emerald-500/70 mb-2 stroke-1" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">Inventory levels are healthy</p>
                <p className="text-3xs text-slate-400 mt-0.5">All products are above their reorder thresholds</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {lowStockItems.map(item => {
                  const isOutOfStock = item.currentStock <= 0;

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedProduct(item)}
                      className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer transition-colors space-y-1.5 group"
                    >
                      {/* Row 1: SKU on Left, Remaining Stock on Right */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {item.sku}
                        </span>
                        <span className={`font-mono text-xs sm:text-sm font-black ${
                          isOutOfStock 
                            ? 'text-rose-600 dark:text-rose-400' 
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {item.currentStock} {item.baseUnitSymbol} {isOutOfStock ? '(Out of Stock)' : 'left'}
                        </span>
                      </div>

                      {/* Row 2: Full Product Name (No Truncation) */}
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words">
                        {item.name}
                      </div>

                      {/* Row 3: Category on mobile; Category, Brand, Warehouse & Min Threshold on sm+ */}
                      <div className="flex items-center justify-between text-3xs text-slate-500 dark:text-slate-400 font-medium">
                        <div className="leading-tight text-slate-500 dark:text-slate-400">
                          {/* Mobile: Category only */}
                          <span className="sm:hidden">{item.category}</span>
                          {/* Tablet/Desktop: Full details */}
                          <span className="hidden sm:inline">
                            {[item.category, item.brand, item.warehouseName].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                        {/* Min Threshold: Hidden on mobile, visible on sm+ */}
                        <div className="hidden sm:block font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                          Min Threshold: {item.reorderLevel} {item.baseUnitSymbol}
                        </div>
                      </div>

                      {/* Row 4: Status Dot & Inspect Link */}
                      <div className="flex items-center justify-between text-3xs pt-0.5 border-t border-slate-100 dark:border-slate-800/60 font-medium">
                        <div className="flex items-center gap-1.5">
                          {isOutOfStock ? (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Out of Stock
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Critical Stock
                            </span>
                          )}
                        </div>

                        <div className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                          <span>Inspect & Reorder</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: Customer Dues */}
        {activeSection === 'dues' && (
          <div>
            <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <span className="sm:hidden">Due Balances</span>
                <span className="hidden sm:inline">Outstanding Customer Balances</span>
              </span>
              <button
                onClick={() => onNavigate('customers')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                All Customers <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {customersWithDues.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Users className="w-8 h-8 mx-auto text-emerald-500/70 mb-2 stroke-1" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">Zero Outstanding Customer Debt</p>
                <p className="text-3xs text-slate-400 mt-0.5">All customer accounts are settled</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {customersWithDues.map(cust => (
                  <div 
                    key={cust.id} 
                    onClick={() => setSelectedCustomerForLedger(cust)}
                    className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer transition-colors space-y-1.5 group"
                  >
                    {/* Row 1: Customer Type on Left, Balance Due on Right */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50">
                        {cust.customerType || 'Customer'}
                      </span>
                      <span className="font-mono text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">
                        Due: {formatNPR(cust.currentBalance)}
                      </span>
                    </div>

                    {/* Row 2: Full Customer Name */}
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words">
                      {cust.name}
                    </div>

                    {/* Row 3: Phone & Location (PAN hidden on mobile only) */}
                    <div className="flex items-center justify-between text-3xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>Phone: {cust.phone || 'N/A'}</span>
                      {cust.panVatNumber && (
                        <span className="hidden sm:inline font-mono">PAN: {cust.panVatNumber}</span>
                      )}
                    </div>

                    {/* Row 4: Action Links */}
                    <div className="flex items-center justify-between text-3xs pt-0.5 border-t border-slate-100 dark:border-slate-800/60 font-medium">
                      <a
                        href={`tel:${cust.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>Call Party</span>
                      </a>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerForLedger(cust);
                        }}
                        className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform"
                      >
                        <span>Customer Ledger</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: Top Moving Items */}
        {activeSection === 'top_items' && (
          <div>
            <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Top Products by Revenue ({timeLabel})
              </span>
              <button
                onClick={() => onNavigate('products')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                All Products <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {filteredData.topItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <TrendingUp className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No product sales in this period</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredData.topItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => onNavigate('products')}
                    className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer transition-colors space-y-1.5 group"
                  >
                    {/* Row 1: Rank on Left, Revenue on Right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono text-3xs font-bold flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-3xs uppercase font-semibold text-slate-400">Top Performer</span>
                      </div>
                      <span className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                        {formatNPR(item.totalRev)}
                      </span>
                    </div>

                    {/* Row 2: Full Product Name */}
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words">
                      {item.name}
                    </div>

                    {/* Row 3: Units Sold & Gross Revenue Label */}
                    <div className="flex items-center justify-between text-3xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>Units Sold: <strong className="text-slate-700 dark:text-slate-300 font-mono">{item.qty} {item.unit}</strong></span>
                      <div className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>View in Catalog</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Invoice Detail & Tax Bill Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal 
          invoice={selectedInvoice} 
          onClose={() => setSelectedInvoice(null)} 
        />
      )}

      {/* Product Stock & Reorder Modal */}
      {selectedProduct && (
        <ProductStockModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onNavigateToPurchases={() => onNavigate('purchases')}
          onNavigateToInventory={() => onNavigate('inventory')}
        />
      )}

      {/* Customer Ledger Modal (Bills to be Paid & History of Bills) */}
      {selectedCustomerForLedger && (
        <CustomerLedgerModal
          customer={selectedCustomerForLedger}
          onClose={() => setSelectedCustomerForLedger(null)}
        />
      )}

    </div>
  );
};
