import React, { useState, useMemo } from 'react';
import { 
  BarChart3, FileSpreadsheet, Download, Printer, 
  Calendar, ArrowDownToLine, Filter, Search, TrendingUp, CheckSquare
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';
import { StatCard } from '../common/StatCard';

export const ReportsView: React.FC = () => {
  const { sales, purchases, products, customers, suppliers, settings } = useApp();

  const [activeReport, setActiveReport] = useState<'sales_book' | 'purchase_book' | 'vat_return' | 'fast_moving'>('sales_book');
  const [searchTerm, setSearchTerm] = useState('');

  // Total Sales & Tax metrics
  const totalSalesGross = sales.reduce((a, s) => a + s.grandTotal, 0);
  const totalSalesTaxable = sales.reduce((a, s) => a + s.subtotal, 0);
  const totalSalesVat = sales.reduce((a, s) => a + s.taxAmount, 0);

  // Total Purchases & Input Tax metrics
  const totalPurchasesGross = purchases.reduce((a, p) => a + p.grandTotal, 0);
  const totalPurchasesTaxable = purchases.reduce((a, p) => a + p.subtotal, 0);
  const totalPurchasesVat = purchases.reduce((a, p) => a + p.taxAmount, 0);

  // Net VAT Payable to IRD (Output VAT - Input VAT)
  const netVatPayable = totalSalesVat - totalPurchasesVat;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            Tax, VAT Returns & Financial Compliance Reports
          </h1>
          <p className="text-2xs text-slate-500">
            Format compliant with Inland Revenue Department (IRD) Annexure schedules, VAT returns, and stock movement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Report Selection Sub-navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-medium">
        {[
          { id: 'sales_book', label: 'Sales Book (Annexure 5)', icon: FileSpreadsheet },
          { id: 'purchase_book', label: 'Purchase Book (Annexure 4)', icon: FileSpreadsheet },
          { id: 'vat_return', label: 'Monthly VAT Return Statement', icon: CheckSquare },
          { id: 'fast_moving', label: 'Fast & Slow Moving Items', icon: BarChart3 },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                activeReport === tab.id
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* REPORT 1: SALES BOOK (ANNEXURE 5) */}
      {activeReport === 'sales_book' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 text-center sm:text-left">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {settings.companyName || settings.businessName} — Sales Register (Annexure 5)
              </h3>
              <p className="text-3xs text-slate-500 font-mono">
                TPIN / PAN: {settings.panNumber} | As per VAT Rules 2052
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-2 sm:mt-0">
              Total VAT Output: <span className="text-indigo-600">{formatNPR(totalSalesVat)}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Date (AD / BS)</th>
                  <th className="px-3 py-2.5">Invoice #</th>
                  <th className="px-3 py-2.5">Buyer Name</th>
                  <th className="px-3 py-2.5">Buyer PAN</th>
                  <th className="px-3 py-2.5 text-right">Gross Sales</th>
                  <th className="px-3 py-2.5 text-right">Taxable Amount</th>
                  <th className="px-3 py-2.5 text-right">VAT 13%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-2xs">
                {sales.map(s => {
                  const nepDate = toNepaliBSDate(s.date);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{nepDate}</td>
                      <td className="px-3 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">{s.invoiceNumber}</td>
                      <td className="px-3 py-2.5 font-sans font-medium text-slate-900 dark:text-slate-100">{s.customerName}</td>
                      <td className="px-3 py-2.5 text-slate-500">{s.customerPanVat || 'Counter'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">{formatNPR(s.grandTotal)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-400">{formatNPR(s.subtotal)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatNPR(s.taxAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={4} className="px-3 py-2.5 text-right font-sans">TOTALS:</td>
                  <td className="px-3 py-2.5 text-right text-slate-900 dark:text-slate-100">{formatNPR(totalSalesGross)}</td>
                  <td className="px-3 py-2.5 text-right">{formatNPR(totalSalesTaxable)}</td>
                  <td className="px-3 py-2.5 text-right text-indigo-600 dark:text-indigo-400">{formatNPR(totalSalesVat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 2: PURCHASE BOOK (ANNEXURE 4) */}
      {activeReport === 'purchase_book' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 text-center sm:text-left">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {settings.companyName || settings.businessName} — Purchase Register (Annexure 4)
              </h3>
              <p className="text-3xs text-slate-500 font-mono">
                TPIN / PAN: {settings.panNumber} | As per VAT Rules 2052
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-2 sm:mt-0">
              Total Input VAT Credit: <span className="text-emerald-600">{formatNPR(totalPurchasesVat)}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Date (AD / BS)</th>
                  <th className="px-3 py-2.5">Supplier Bill #</th>
                  <th className="px-3 py-2.5">Supplier Name</th>
                  <th className="px-3 py-2.5">Supplier PAN</th>
                  <th className="px-3 py-2.5 text-right">Purchase Amount</th>
                  <th className="px-3 py-2.5 text-right">Taxable</th>
                  <th className="px-3 py-2.5 text-right">Input VAT 13%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-2xs">
                {purchases.map(p => {
                  const nepDate = toNepaliBSDate(p.date);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{nepDate}</td>
                      <td className="px-3 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">{p.supplierInvoiceNumber || p.purchaseNumber}</td>
                      <td className="px-3 py-2.5 font-sans font-medium text-slate-900 dark:text-slate-100">{p.supplierName}</td>
                      <td className="px-3 py-2.5 text-slate-500">{p.supplierPanVat || 'Registered'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">{formatNPR(p.grandTotal)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-400">{formatNPR(p.subtotal)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatNPR(p.taxAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={4} className="px-3 py-2.5 text-right font-sans">TOTALS:</td>
                  <td className="px-3 py-2.5 text-right text-slate-900 dark:text-slate-100">{formatNPR(totalPurchasesGross)}</td>
                  <td className="px-3 py-2.5 text-right">{formatNPR(totalPurchasesTaxable)}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{formatNPR(totalPurchasesVat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: VAT RETURN STATEMENT */}
      {activeReport === 'vat_return' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-6 max-w-2xl mx-auto">
          <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800 space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              Inland Revenue Department (IRD)
            </h2>
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Value Added Tax (VAT) Return Statement
            </h3>
            <p className="text-2xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
              Tax Summary Period: {settings.fiscalYear}
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-sans text-slate-700 dark:text-slate-300">1. Total Output Tax on Sales (13% VAT)</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{formatNPR(totalSalesVat)}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-sans text-slate-700 dark:text-slate-300">2. Total Input Tax Credit on Purchases</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">-{formatNPR(totalPurchasesVat)}</span>
            </div>

            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-900 flex justify-between items-center text-sm font-black font-sans text-indigo-950 dark:text-indigo-100">
              <span>Net Tax Payable / (Refundable):</span>
              <span className="font-mono text-base">{formatNPR(Math.max(0, netVatPayable))}</span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 4: FAST / SLOW MOVING INVENTORY */}
      {activeReport === 'fast_moving' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            Fast-Moving Hardware Products & Stock Velocity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {products.map(p => (
              <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{p.name}</span>
                  <span className="text-3xs font-mono bg-indigo-50 dark:bg-indigo-950 text-indigo-600 px-1.5 py-0.5 rounded font-bold">
                    {p.category}
                  </span>
                </div>
                <div className="text-2xs font-mono text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Retail Price:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{formatNPR(p.retailPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current In-Stock:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{p.currentStock} {p.baseUnitSymbol}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
