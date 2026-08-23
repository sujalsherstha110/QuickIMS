import React, { useState, useMemo } from 'react';
import { 
  Receipt, Plus, DollarSign, ArrowUpRight, ArrowDownRight, 
  Wallet, Building2, TrendingUp, TrendingDown, FileText, Calendar,
  PieChart as PieIcon, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ExpenseRecord } from '../../types';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';
import { StatCard, StatusBadge } from '../common/StatCard';

export const AccountingView: React.FC = () => {
  const { expenses, recordExpense, sales, purchases, customers, suppliers } = useApp();

  const [activeTab, setActiveTab] = useState<'pnl' | 'expenses' | 'accounts'>('pnl');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  const [expForm, setExpForm] = useState({
    category: 'Rent' as ExpenseRecord['category'],
    amount: 5000,
    paymentMethod: 'bank_transfer' as ExpenseRecord['paymentMethod'],
    paidTo: '',
    accountName: 'Nabil Bank Current Account',
    notes: ''
  });

  // Calculate High-Precision Small Business P&L
  const grossSales = sales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
  const salesDiscounts = sales.reduce((acc, s) => acc + (s.discountAmount || 0), 0);
  const vatCollected = sales.reduce((acc, s) => acc + (s.taxAmount || 0), 0);
  const netRevenue = grossSales - vatCollected;

  const costOfGoodsSold = sales.reduce((acc, s) => acc + (s.totalCost || 0), 0);
  const grossProfit = netRevenue - costOfGoodsSold;
  const grossMarginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  const totalOperatingExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netOperatingProfit = grossProfit - totalOperatingExpenses;
  const netMarginPercent = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

  // Total Receivables & Payables
  const totalReceivables = customers.reduce((acc, c) => acc + Math.max(0, c.currentBalance || 0), 0);
  const totalPayables = suppliers.reduce((acc, s) => acc + Math.max(0, s.currentBalance || 0), 0);

  // Group Expenses by Category
  const expenseByCategory = useMemo(() => {
    return expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [expenses]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expForm.amount <= 0 || !expForm.paidTo) return;

    await recordExpense({
      expenseNumber: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      date: Date.now(),
      category: expForm.category,
      amount: expForm.amount,
      paymentMethod: expForm.paymentMethod,
      paidTo: expForm.paidTo,
      accountName: expForm.accountName,
      notes: expForm.notes,
      recordedBy: 'Accountant (Binod)'
    });

    setShowAddExpenseModal(false);
    setExpForm({
      category: 'Rent',
      amount: 5000,
      paymentMethod: 'bank_transfer',
      paidTo: '',
      accountName: 'Nabil Bank Current Account',
      notes: ''
    });
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            Financial Records, Cash & P&L Statement (लेखा तथा नाफा-नोक्सान)
          </h1>
          <p className="text-2xs text-slate-500">
            Automated double-entry trail, operating expenses, and net profit ledger.
          </p>
        </div>

        <button
          onClick={() => setShowAddExpenseModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs"
        >
          <Plus className="w-4 h-4" /> Record Expense (खर्च दाखिला)
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-medium">
        {[
          { id: 'pnl', label: 'Profit & Loss Statement (P&L)', icon: TrendingUp },
          { id: 'expenses', label: 'Operating Expenses Ledger', icon: Receipt },
          { id: 'accounts', label: 'Chart of Accounts & Balances', icon: Wallet },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                activeTab === tab.id
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

      {/* TAB 1: PROFIT & LOSS STATEMENT */}
      {activeTab === 'pnl' && (
        <div className="space-y-4">
          
          {/* Executive P&L Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Net Sales Revenue"
              value={formatNPR(netRevenue)}
              subtitle={`Gross: ${formatNPR(grossSales)}`}
              icon={<DollarSign className="w-5 h-5" />}
              color="blue"
            />

            <StatCard
              title="Gross Profit"
              value={formatNPR(grossProfit)}
              subtitle={`Margin: ${grossMarginPercent.toFixed(1)}%`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="emerald"
            />

            <StatCard
              title="Net Operating Profit"
              value={formatNPR(netOperatingProfit)}
              subtitle={`After ${formatNPR(totalOperatingExpenses)} expenses`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="indigo"
            />
          </div>

          {/* Detailed Statement Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Trading and Profit & Loss Account (नाफा नोक्सान हिसाब किताब)
              </h3>
              <span className="text-3xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded">
                Fiscal Period 2082/83
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs max-w-2xl mx-auto">
              
              {/* Revenue Section */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-sans font-bold text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span>Operating Revenue (बिक्री आम्दानी)</span>
                  <span>Amount (Rs.)</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 pl-4">
                  <span>Gross Sales Counter & Contractor Invoicing</span>
                  <span>{formatNPR(grossSales)}</span>
                </div>
                <div className="flex justify-between text-slate-500 pl-4 text-2xs">
                  <span>Less: Customer Discounts Allowed</span>
                  <span>-{formatNPR(salesDiscounts)}</span>
                </div>
                <div className="flex justify-between text-slate-500 pl-4 text-2xs">
                  <span>Less: 13% Output VAT Collected</span>
                  <span>-{formatNPR(vatCollected)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-sans">Net Sales Revenue</span>
                  <span>{formatNPR(netRevenue)}</span>
                </div>
              </div>

              {/* COGS Section */}
              <div className="space-y-1.5 pt-3">
                <div className="flex justify-between font-sans font-bold text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span>Cost of Goods Sold (बिक्री भएको सामानको लागत)</span>
                  <span></span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 pl-4">
                  <span>Direct Purchase & Inventory Landed Cost</span>
                  <span>{formatNPR(costOfGoodsSold)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-sans">Gross Profit (कुल नाफा)</span>
                  <span>{formatNPR(grossProfit)}</span>
                </div>
              </div>

              {/* Operating Expenses Section */}
              <div className="space-y-1.5 pt-3">
                <div className="flex justify-between font-sans font-bold text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span>Operating & Administrative Expenses (सञ्चालन खर्च)</span>
                  <span></span>
                </div>
                {Object.entries(expenseByCategory).map(([cat, amount]) => (
                  <div key={cat} className="flex justify-between text-slate-600 dark:text-slate-400 pl-4 text-2xs">
                    <span>{cat}</span>
                    <span>{formatNPR(amount as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-sans">Total Operating Expenses</span>
                  <span>-{formatNPR(totalOperatingExpenses)}</span>
                </div>
              </div>

              {/* Final Net Profit */}
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-900 flex justify-between font-sans font-black text-sm text-indigo-900 dark:text-indigo-100 mt-4">
                <span>Net Operating Profit (खुद नाफा)</span>
                <span className="font-mono">{formatNPR(netOperatingProfit)}</span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPERATING EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Expenses Journal (खर्च विवरण)
            </h3>
            <span className="text-2xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Total: {formatNPR(totalOperatingExpenses)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Expense #</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Paid To</th>
                  <th className="px-4 py-3">Paid Via / Account</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {exp.expenseNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {exp.category}
                      {exp.notes && <span className="block text-3xs text-slate-400 font-normal">{exp.notes}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{exp.paidTo}</td>
                    <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                      {exp.paymentMethod.toUpperCase()} ({exp.accountName})
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-2xs">{formatDate(exp.date)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatNPR(exp.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CHART OF ACCOUNTS & BALANCES */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Current Assets */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" /> Current Assets (सम्पत्ति)
              </h3>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-sans text-slate-700 dark:text-slate-300">Cash in Hand (काउन्टर नगद)</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">Rs. 85,420.00</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-sans text-slate-700 dark:text-slate-300">Nabil Bank Current Account</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">Rs. 4,20,000.00</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-sans text-slate-700 dark:text-slate-300">eSewa & Khalti Merchant Wallets</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">Rs. 62,500.00</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-sans text-slate-700 dark:text-slate-300">Accounts Receivable (ग्राहक बाँकी)</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{formatNPR(totalReceivables)}</span>
              </div>
            </div>
          </div>

          {/* Current Liabilities */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-rose-600" /> Current Liabilities (दायित्व)
              </h3>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-sans text-slate-700 dark:text-slate-300">Accounts Payable (सप्लायर्स साहु बाँकी)</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{formatNPR(totalPayables)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-sans text-slate-700 dark:text-slate-300">VAT & Tax Payable (IRD Nepal)</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatNPR(vatCollected)}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: RECORD EXPENSE */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Record Operating Expense (खर्च प्रविष्टि)
            </h3>

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Expense Category *</label>
                <select
                  value={expForm.category}
                  onChange={(e) => setExpForm({ ...expForm, category: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                >
                  <option value="Rent">Rent (घरभाडा)</option>
                  <option value="Electricity & Water">Electricity & Water (विद्युत तथा खानेपानी)</option>
                  <option value="Salary & Wages">Salary & Wages (कर्मचारी तलब)</option>
                  <option value="Transportation & Fuel">Transportation & Fuel (ढुवानी तथा इन्धन)</option>
                  <option value="Internet & Phone">Internet & Phone</option>
                  <option value="Maintenance & Repair">Maintenance & Repair</option>
                  <option value="Marketing">Marketing & Promotion</option>
                  <option value="Packaging">Packaging Supplies</option>
                  <option value="Miscellaneous">Miscellaneous (विविध)</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Expense Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-rose-600 text-base"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Paid To (व्यक्ति वा संस्था) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NEA Kuleshwor or Landlord"
                  value={expForm.paidTo}
                  onChange={(e) => setExpForm({ ...expForm, paidTo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={expForm.paymentMethod}
                    onChange={(e) => setExpForm({ ...expForm, paymentMethod: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="esewa">eSewa</option>
                    <option value="khalti">Khalti</option>
                    <option value="connectips">ConnectIPS</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Source Account</label>
                  <input
                    type="text"
                    value={expForm.accountName}
                    onChange={(e) => setExpForm({ ...expForm, accountName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Description / Bill Memo</label>
                <input
                  type="text"
                  placeholder="Monthly bill memo"
                  value={expForm.notes}
                  onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
