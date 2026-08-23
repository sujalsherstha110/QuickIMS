import React from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, ShoppingBag, Truck, 
  AlertTriangle, Users, Building2, Package, ArrowUpRight, 
  ArrowDownRight, Plus, Eye, Receipt, Calendar, CreditCard, ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatCard, StatusBadge } from '../common/StatCard';
import { formatNPR, formatDate, toNepaliBSDate, formatStockInUnits } from '../../utils/nepalFormatters';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { 
    sales, purchases, expenses, products, customers, suppliers, settings, currentWarehouseId 
  } = useApp();

  // Financial Metrics Calculation
  const totalSalesRevenue = sales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
  const totalCostOfGoods = sales.reduce((acc, s) => acc + (s.totalCost || 0), 0);
  const totalGrossProfit = sales.reduce((acc, s) => acc + (s.grossProfit || 0), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const netProfit = totalGrossProfit - totalExpenses;

  // Receivables (Customer debts) and Payables (Supplier debts)
  const totalReceivables = customers.reduce((acc, c) => acc + Math.max(0, c.currentBalance || 0), 0);
  const totalPayables = suppliers.reduce((acc, s) => acc + Math.max(0, s.currentBalance || 0), 0);

  // Total Inventory Valuation (Base unit * landed cost)
  const totalInventoryValue = products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);

  // Alerts
  const lowStockItems = products.filter(p => p.currentStock <= p.reorderLevel);

  // Category breakdown for charts/tables
  const categorySummary = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + (p.currentStock * p.costPrice);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Quick Actions */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-300 text-3xs font-bold uppercase tracking-wider border border-indigo-400/20 font-mono">
                {settings.fiscalYear} Fiscal Period
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {toNepaliBSDate(new Date())}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
              Business Performance & Inventory Overview
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Hardware & Sanitary live stock valuation, POS billing revenue, customer credit dues, and supplier payables.
            </p>
          </div>

          {/* Quick ERP Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('pos')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> New Sale / POS
            </button>
            <button
              onClick={() => onNavigate('purchases')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2 border border-slate-700 transition-all"
            >
              <Truck className="w-4 h-4 text-slate-400" /> Receive Purchase
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2 border border-slate-700 transition-all"
            >
              <Package className="w-4 h-4 text-slate-400" /> Add Product
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          id="stat-sales"
          title="Total Gross Sales"
          value={formatNPR(totalSalesRevenue)}
          subtitle={`${sales.length} Invoices issued`}
          icon={<DollarSign className="w-5 h-5" />}
          color="blue"
          change="+14.2% vs last week"
          isPositive={true}
        />

        <StatCard
          id="stat-profit"
          title="Net Operating Profit"
          value={formatNPR(netProfit)}
          subtitle={`Gross Profit: ${formatNPR(totalGrossProfit)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="emerald"
          change="Margin ~34%"
          isPositive={true}
        />

        <StatCard
          id="stat-inventory-val"
          title="Total Inventory Value"
          value={formatNPR(totalInventoryValue)}
          subtitle={`${products.length} catalog SKU items`}
          icon={<Package className="w-5 h-5" />}
          color="indigo"
          change="At Landed Cost"
          isPositive={true}
        />

        <StatCard
          id="stat-receivables"
          title="Customer Receivables (बाँकी)"
          value={formatNPR(totalReceivables)}
          subtitle={`${customers.filter(c => c.currentBalance > 0).length} customers with balance`}
          icon={<Users className="w-5 h-5" />}
          color={totalReceivables > 500000 ? 'amber' : 'blue'}
        />
      </div>

      {/* Secondary Financial Indicators Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Supplier Payables (साहु भुक्तानी)</p>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">{formatNPR(totalPayables)}</p>
            <p className="text-2xs text-slate-500">{suppliers.filter(s => s.currentBalance > 0).length} active supplier credits</p>
          </div>
          <Building2 className="w-8 h-8 text-rose-500/30" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Operating Expenses</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-1">{formatNPR(totalExpenses)}</p>
            <p className="text-2xs text-slate-500">Rent, electricity, staff, logistics</p>
          </div>
          <Receipt className="w-8 h-8 text-amber-500/30" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Stock Reorder Alerts</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">{lowStockItems.length} Products Low</p>
            <p className="text-2xs text-slate-500">Below minimum buffer reorder level</p>
          </div>
          <AlertTriangle className="w-8 h-8 text-amber-500/30" />
        </div>
      </div>

      {/* Main Two-Column Operational Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Recent Transactions & Category Value Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Sales Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Recent Sales Invoices
                </h2>
              </div>
              <button 
                onClick={() => onNavigate('invoice-reports')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                View All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Invoice #</th>
                    <th className="px-4 py-2.5">Customer</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-right">Grand Total</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sales.slice(0, 5).map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate max-w-[180px]">
                          {sale.customerName}
                        </span>
                        {sale.customerPhone && <span className="text-3xs text-slate-400">{sale.customerPhone}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-2xs">
                        {formatDate(sale.date)}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">
                        {sale.customerType}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatNPR(sale.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={sale.paymentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Inventory Valuation Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-4 flex items-center justify-between">
              <span>Inventory Value by Category</span>
              <span className="text-slate-400 font-normal">Base unit landed cost</span>
            </h2>

            <div className="space-y-3">
              {Object.entries(categorySummary).map(([category, val]) => {
                const numericVal = Number(val) || 0;
                const percentage = totalInventoryValue > 0 ? Math.round((numericVal / totalInventoryValue) * 100) : 0;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{category}</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatNPR(numericVal)} <span className="text-slate-400 text-3xs font-normal">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full" 
                        style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right 1 Col: Low Stock Alerts & Top Debtors */}
        <div className="space-y-6">
          
          {/* Low Stock Alerts Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Critical Low Stock
                </h2>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-3xs font-bold rounded-full">
                {lowStockItems.length} items
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">All product inventory is healthy above buffer levels.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {lowStockItems.map(item => (
                  <div key={item.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                      <p className="text-3xs text-slate-500 font-mono">
                        SKU: {item.sku} | Min: {item.reorderLevel} {item.baseUnitSymbol}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded font-mono font-bold text-xs">
                        {item.currentStock} {item.baseUnitSymbol}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => onNavigate('purchases')}
              className="w-full mt-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Purchase Order
            </button>
          </div>

          {/* Outstanding Customer Dues */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Top Customer Receivables
                </h2>
              </div>
              <button 
                onClick={() => onNavigate('customers')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                View All
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {customers
                .filter(c => c.currentBalance > 0)
                .sort((a, b) => b.currentBalance - a.currentBalance)
                .slice(0, 4)
                .map(c => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                      {c.companyName && <p className="text-3xs text-slate-500">{c.companyName}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {formatNPR(c.currentBalance)}
                      </p>
                      <p className="text-3xs text-slate-400 capitalize">{c.customerType}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
