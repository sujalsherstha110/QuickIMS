import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Search, Phone, Mail, MapPin, 
  CreditCard, ArrowUpRight, DollarSign, FileText, CheckCircle2,
  Calendar, ChevronRight, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';

export const CustomersView: React.FC = () => {
  const { customers, addCustomer, updateCustomer, sales } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState('');

  const [newCustForm, setNewCustForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    panVatNumber: '',
    customerType: 'retail' as 'retail' | 'wholesale' | 'contractor' | 'dealer',
    creditLimit: 200000,
    openingBalance: 0,
    paymentTermsDays: 30,
    province: 'Bagmati',
    district: 'Kathmandu',
    municipality: 'Kathmandu',
    street: 'Kalanki',
    notes: ''
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchType = selectedType === 'ALL' || c.customerType === selectedType;
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.companyName && c.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          c.phone.includes(searchQuery) ||
                          (c.panVatNumber && c.panVatNumber.includes(searchQuery));
      return matchType && matchSearch;
    });
  }, [customers, selectedType, searchQuery]);

  const customerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales.filter(s => s.customerId === selectedCustomer.id);
  }, [sales, selectedCustomer]);

  const totalOutstanding = customers.reduce((acc, c) => acc + Math.max(0, c.currentBalance || 0), 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustForm.name || !newCustForm.phone) return;

    await addCustomer({
      customerCode: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newCustForm.name,
      companyName: newCustForm.companyName,
      phone: newCustForm.phone,
      email: newCustForm.email,
      panVatNumber: newCustForm.panVatNumber,
      customerType: newCustForm.customerType,
      address: {
        province: newCustForm.province,
        district: newCustForm.district,
        municipality: newCustForm.municipality,
        street: newCustForm.street
      },
      creditLimit: newCustForm.creditLimit,
      currentBalance: newCustForm.openingBalance,
      openingBalance: newCustForm.openingBalance,
      paymentTermsDays: newCustForm.paymentTermsDays,
      active: true,
      notes: newCustForm.notes
    });

    setShowAddModal(false);
  };

  const handleRecordCustomerPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentAmount <= 0) return;

    const newBalance = Math.max(0, (selectedCustomer.currentBalance || 0) - paymentAmount);
    await updateCustomer(selectedCustomer.id, {
      currentBalance: newBalance
    });

    setSelectedCustomer({
      ...selectedCustomer,
      currentBalance: newBalance
    });

    setShowPaymentModal(false);
    setPaymentAmount(0);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            Customer Directory & Credit Ledger (ग्राहक खाता)
          </h1>
          <p className="text-2xs text-slate-500">
            Total Outstanding Receivables: <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{formatNPR(totalOutstanding)}</span>
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs"
        >
          <UserPlus className="w-4 h-4" /> Add Customer (नयाँ ग्राहक)
        </button>
      </div>

      {/* Main Grid: Customer List + Detail Profile / Statement Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Customer Directory Table (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name, company, phone, or PAN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-2.5 py-1.5 font-medium outline-hidden"
            >
              <option value="ALL">All Types</option>
              <option value="retail">Retail Counter</option>
              <option value="wholesale">Wholesale</option>
              <option value="contractor">Builder / Contractor</option>
              <option value="dealer">Sub-Dealer</option>
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Customer / Firm</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Credit Limit</th>
                    <th className="px-4 py-3 text-right">Outstanding (बाँकी)</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCustomers.map(c => {
                    const isSelected = selectedCustomer?.id === c.id;
                    return (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedCustomer(c)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600' 
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{c.name}</span>
                          {c.companyName && <span className="text-3xs text-slate-500 block">{c.companyName}</span>}
                          <span className="text-3xs text-slate-400 font-mono">{c.phone}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.customerType} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {c.creditLimit > 0 ? formatNPR(c.creditLimit) : 'No Limit'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          <span className={c.currentBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}>
                            {formatNPR(c.currentBalance)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Statement & Detailed Account Ledger (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          {selectedCustomer ? (
            <div className="space-y-4">
              
              {/* Customer Profile Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.name}</h3>
                  {selectedCustomer.companyName && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">{selectedCustomer.companyName}</p>
                  )}
                  <p className="text-2xs text-slate-500 font-mono mt-1">
                    {selectedCustomer.address.street}, {selectedCustomer.address.district} | Tel: {selectedCustomer.phone}
                  </p>
                  {selectedCustomer.panVatNumber && (
                    <p className="text-2xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      PAN: {selectedCustomer.panVatNumber}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setPaymentAmount(selectedCustomer.currentBalance);
                    setShowPaymentModal(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                >
                  <DollarSign className="w-3.5 h-3.5" /> Collect Payment
                </button>
              </div>

              {/* Outstanding Balance Widget */}
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
                <div>
                  <p className="text-3xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Current Outstanding Receivable (बाँकी रकम)
                  </p>
                  <p className="text-xl font-bold font-mono text-amber-900 dark:text-amber-100 mt-0.5">
                    {formatNPR(selectedCustomer.currentBalance)}
                  </p>
                </div>
                <div className="text-right text-2xs text-amber-800 dark:text-amber-300">
                  <p>Credit Limit: {formatNPR(selectedCustomer.creditLimit)}</p>
                  <p>Terms: {selectedCustomer.paymentTermsDays} Days</p>
                </div>
              </div>

              {/* Customer Invoices Statement History */}
              <div className="space-y-2">
                <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                  Transaction & Invoicing History ({customerInvoices.length})
                </h4>

                {customerInvoices.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No sales invoices recorded for this customer yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                    {customerInvoices.map(inv => (
                      <div key={inv.id} className="py-2 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 font-sans">{inv.invoiceNumber}</span>
                          <span className="block text-3xs text-slate-400">{formatDate(inv.date)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{formatNPR(inv.grandTotal)}</span>
                          <span className="block text-3xs text-slate-400">
                            {inv.dueAmount > 0 ? `Due: ${formatNPR(inv.dueAmount)}` : 'Fully Paid'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 text-xs">
              <Users className="w-12 h-12 stroke-1 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">No Customer Selected</p>
              <p className="text-2xs text-slate-400 mt-1">Select a customer from the left list to view their ledger statement and collect dues.</p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: REGISTER CUSTOMER */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Add New Customer (नयाँ ग्राहक दर्ता)
            </h3>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Company / Firm Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Sharma Builders & Construction"
                  value={newCustForm.companyName}
                  onChange={(e) => setNewCustForm({ ...newCustForm, companyName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Phone / Mobile *</label>
                  <input
                    type="text"
                    required
                    placeholder="98XXXXXXXX"
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Buyer's PAN / VAT</label>
                  <input
                    type="text"
                    placeholder="9-digit PAN"
                    value={newCustForm.panVatNumber}
                    onChange={(e) => setNewCustForm({ ...newCustForm, panVatNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Pricing Category</label>
                  <select
                    value={newCustForm.customerType}
                    onChange={(e) => setNewCustForm({ ...newCustForm, customerType: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="retail">Retail Counter</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="contractor">Builder / Contractor</option>
                    <option value="dealer">Sub-Dealer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Opening Balance (बाँकी)</label>
                  <input
                    type="number"
                    value={newCustForm.openingBalance}
                    onChange={(e) => setNewCustForm({ ...newCustForm, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COLLECT PAYMENT RECEIPT */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Collect Due Payment (रकम असुली रसिद)
            </h3>
            
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Customer: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.name}</span>
            </p>

            <form onSubmit={handleRecordCustomerPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Payment Amount to Collect (Rs.) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedCustomer.currentBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-emerald-600 text-base"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Receipt Notes / Txn Ref</label>
                <input
                  type="text"
                  placeholder="e.g. Received by Cheque / eSewa"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold"
                >
                  Record Payment Received
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
