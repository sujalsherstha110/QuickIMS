import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Search, Phone, Mail, MapPin, 
  CreditCard, ArrowUpRight, FileText, CheckCircle2,
  Calendar, ChevronRight, X, Clock, History, Receipt, ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, SaleInvoice } from '../../types';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';
import { InvoiceDetailModal } from '../common/InvoiceDetailModal';
import { CustomerLedgerModal } from '../common/CustomerLedgerModal';
import { Button } from '../common/Button';
import { spawnTouchRipple } from '../../utils/touchFeedback';

export const CustomersView: React.FC = () => {
  const { customers, addCustomer, updateCustomer, sales } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [ledgerTab, setLedgerTab] = useState<'pending' | 'history'>('pending');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [invoiceModalTab, setInvoiceModalTab] = useState<'view' | 'settle'>('view');
  const [showFullLedgerModal, setShowFullLedgerModal] = useState(false);

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
    street: '',
    notes: ''
  });
  const [custPanVatType, setCustPanVatType] = useState<'PAN' | 'VAT'>('PAN');

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchType = selectedType === 'ALL' || c.customerType === selectedType;
      const q = String(searchQuery || '').toLowerCase();
      const matchSearch = String(c.name || '').toLowerCase().includes(q) ||
                          (c.companyName && String(c.companyName).toLowerCase().includes(q)) ||
                          String(c.phone || '').includes(searchQuery) ||
                          (c.panVatNumber && String(c.panVatNumber).includes(searchQuery));
      return matchType && matchSearch;
    });
  }, [customers, selectedType, searchQuery]);

  const normalizeRealPhone = (phone?: string): string | null => {
    const clean = String(phone || '').trim();
    if (!clean) return null;
    const lower = clean.toLowerCase();
    if (['n/a', 'na', 'none', 'null', '-', '0', '9800000000', '0000000000', '98xxxxxxxx'].includes(lower)) return null;
    const digits = clean.replace(/\D/g, '');
    if (digits.length < 7 || /^0+$/.test(digits)) return null;
    return digits;
  };

  const customerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    const custRealPhone = normalizeRealPhone(selectedCustomer.phone);
    return sales
      .filter(s => {
        if (s.customerId === selectedCustomer.id) return true;
        if (s.customerId && s.customerId !== selectedCustomer.id) return false;
        const invRealPhone = normalizeRealPhone(s.customerPhone);
        return Boolean(custRealPhone && invRealPhone && custRealPhone === invRealPhone);
      })
      .sort((a, b) => b.date - a.date);
  }, [sales, selectedCustomer]);

  const billsToPay = useMemo(() => {
    return customerInvoices.filter(inv => {
      const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
      return due > 0 || inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial' || inv.paymentStatus === 'overdue';
    });
  }, [customerInvoices]);

  const invoicePendingDue = useMemo(() => {
    return billsToPay.reduce((sum, inv) => sum + (inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0))), 0);
  }, [billsToPay]);

  const openingLedgerDue = useMemo(() => {
    if (!selectedCustomer) return 0;
    return Math.max(0, (selectedCustomer.currentBalance || 0) - invoicePendingDue);
  }, [selectedCustomer, invoicePendingDue]);

  const pendingPayableCount = billsToPay.length + (openingLedgerDue > 0 ? 1 : 0);

  const totalOutstanding = customers.reduce((acc, c) => acc + Math.max(0, c.currentBalance || 0), 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustForm.name.trim()) return;

    await addCustomer({
      customerCode: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newCustForm.name.trim(),
      companyName: newCustForm.companyName.trim() || undefined,
      phone: newCustForm.phone.trim() || 'N/A',
      email: newCustForm.email,
      panVatNumber: newCustForm.panVatNumber,
      customerType: newCustForm.customerType,
      address: {
        province: newCustForm.province,
        district: newCustForm.district,
        municipality: newCustForm.municipality,
        street: newCustForm.street || 'Kathmandu'
      },
      creditLimit: newCustForm.creditLimit,
      currentBalance: newCustForm.openingBalance,
      openingBalance: newCustForm.openingBalance,
      paymentTermsDays: newCustForm.paymentTermsDays,
      active: true,
      notes: newCustForm.notes
    });

    setNewCustForm({
      name: '',
      companyName: '',
      phone: '',
      email: '',
      panVatNumber: '',
      customerType: 'retail',
      creditLimit: 200000,
      openingBalance: 0,
      paymentTermsDays: 30,
      province: 'Bagmati',
      district: 'Kathmandu',
      municipality: 'Kathmandu',
      street: '',
      notes: ''
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

  const handleOpenSettleInvoice = (inv: SaleInvoice) => {
    setSelectedInvoice(inv);
    setInvoiceModalTab('settle');
  };

  const handleViewInvoice = (inv: SaleInvoice) => {
    setSelectedInvoice(inv);
    setInvoiceModalTab('view');
  };

  const handleOpenSettleAccountBalance = (amount: number) => {
    setPaymentAmount(amount);
    setPaymentNotes('Settling prior / opening ledger account balance');
    setShowPaymentModal(true);
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

        <Button
          variant="primary-arrow"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          Add Customer (नयाँ ग्राहक)
        </Button>
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
                        className={`cursor-pointer transition-all duration-150 active:scale-[0.995] ${
                          isSelected 
                            ? 'bg-blue-50/90 dark:bg-blue-950/50 border-l-4 border-blue-600 shadow-2xs' 
                            : 'hover:bg-slate-50/90 active:bg-blue-50/60 dark:hover:bg-slate-800/60 dark:active:bg-blue-950/40'
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
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(c);
                                setShowFullLedgerModal(true);
                              }}
                              className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-600 active:bg-blue-700 text-blue-700 hover:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white border border-blue-200/80 hover:border-blue-600 dark:border-blue-800 text-3xs font-bold transition-all duration-150 active:scale-95 shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Open Full Customer Ledger"
                            >
                              Ledger
                            </button>
                            <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                          </div>
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
                    <p className="text-2xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                      PAN: {selectedCustomer.panVatNumber}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowFullLedgerModal(true)}
                    onPointerDown={(e) => spawnTouchRipple(e, 'bg-blue-200/50')}
                    className="relative overflow-hidden px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs hover:shadow-xs active:scale-95 transition-all duration-150 cursor-pointer select-none"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-500" /> Full Ledger
                  </button>
                  <button
                    onClick={() => {
                      setPaymentAmount(selectedCustomer.currentBalance);
                      setShowPaymentModal(true);
                    }}
                    onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                    className="relative overflow-hidden px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs hover:shadow-md active:scale-95 transition-all duration-150 cursor-pointer select-none"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Collect
                  </button>
                </div>
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

              {/* Customer Bills Ledger Tabs (Bills to be Paid & History of Bills) */}
              <div className="space-y-3">
                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 p-1 sm:p-1.5 rounded-lg gap-1.5">
                  <button
                    onClick={() => setLedgerTab('pending')}
                    onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/30')}
                    className={`relative overflow-hidden flex-1 py-1.5 px-2.5 sm:px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 select-none ${
                      ledgerTab === 'pending'
                        ? 'bg-amber-600 active:bg-amber-700 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-amber-700 hover:bg-amber-50 active:bg-amber-100/80 dark:hover:bg-amber-950/40 dark:active:bg-amber-900/40'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Bills to be Paid</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-3xs font-mono transition-colors ${
                      ledgerTab === 'pending'
                        ? 'bg-amber-700 text-amber-100 font-bold'
                        : pendingPayableCount > 0 
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {pendingPayableCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setLedgerTab('history')}
                    onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/30')}
                    className={`relative overflow-hidden flex-1 py-1.5 px-2.5 sm:px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 select-none ${
                      ledgerTab === 'history'
                        ? 'bg-blue-600 active:bg-blue-700 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-white/70 active:bg-blue-50 dark:hover:bg-slate-800/70 dark:active:bg-blue-950/50'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 shrink-0" />
                    <span>History of Bills</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-3xs font-mono transition-colors ${
                      ledgerTab === 'history'
                        ? 'bg-blue-700 text-blue-100 font-bold'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      {customerInvoices.length + ((selectedCustomer.openingBalance || 0) > 0 ? 1 : 0)}
                    </span>
                  </button>
                </div>

                {/* Tab 1: Bills to be Paid */}
                {ledgerTab === 'pending' && (
                  <div className="space-y-2.5">
                    {pendingPayableCount === 0 ? (
                      <div className="p-6 text-center text-slate-400 space-y-1 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 stroke-1 mb-1" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Bills Pending</p>
                        <p className="text-3xs text-slate-400">All customer invoices and dues have been fully settled.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {/* Opening Balance / Prior Ledger Entry */}
                        {openingLedgerDue > 0 && (
                          <div className="p-3 bg-amber-50/70 hover:bg-amber-50/90 dark:bg-amber-950/30 dark:hover:bg-amber-950/40 rounded-xl border border-amber-200/80 hover:border-amber-300 dark:border-amber-900/60 transition-all duration-150 shadow-2xs hover:shadow-xs space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-amber-900 dark:text-amber-200 font-sans text-xs flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  Opening Account Balance
                                </span>
                              </div>
                              <span className="text-3xs px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200">
                                Unsettled Balance
                              </span>
                            </div>

                            {/* 3 Clean Rows */}
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span className="text-3xs uppercase tracking-wider font-semibold">Opening Entry:</span>
                                <span className="font-mono font-medium">{formatNPR(selectedCustomer.openingBalance || openingLedgerDue)}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span className="text-3xs uppercase tracking-wider font-semibold">Credit Limit:</span>
                                <span className="font-mono font-medium">{formatNPR(selectedCustomer.creditLimit)}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-amber-200/40 dark:border-amber-900/30">
                                <span className="text-3xs uppercase tracking-wider font-bold text-rose-700 dark:text-rose-400">Due to Settle:</span>
                                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                                  {formatNPR(openingLedgerDue)}
                                </span>
                              </div>
                            </div>

                            <div className="pt-1 flex items-center justify-end">
                              <button
                                onClick={() => handleOpenSettleAccountBalance(openingLedgerDue)}
                                onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                                className="relative overflow-hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow-md active:scale-95 active:shadow-inner transition-all duration-150 ease-out cursor-pointer flex items-center justify-center ring-offset-1 hover:ring-2 hover:ring-emerald-500/30 active:ring-2 active:ring-emerald-600 select-none"
                              >
                                <span>Settle Balance</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Bills List with 3 Clean Rows and Settle Due Button */}
                        {billsToPay.map(inv => {
                          const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
                          return (
                            <div 
                              key={inv.id} 
                              className="group/card p-3 bg-white dark:bg-slate-800/90 hover:bg-amber-50/40 active:bg-amber-100/30 dark:hover:bg-slate-800 dark:active:bg-slate-800/95 rounded-xl border border-slate-200 hover:border-amber-300 active:border-amber-400 dark:border-slate-700/80 dark:hover:border-amber-700/60 transition-all duration-150 shadow-2xs hover:shadow-sm active:scale-[0.985] space-y-2.5"
                            >
                              {/* Header: Invoice Badge with Date Below + Status */}
                              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                                <div className="flex flex-col items-start gap-1">
                                  <button
                                    onClick={() => handleViewInvoice(inv)}
                                    onPointerDown={(e) => spawnTouchRipple(e, 'bg-blue-200/50')}
                                    className="relative overflow-hidden group/inv inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/90 hover:bg-blue-600 active:bg-blue-700 text-blue-700 hover:text-white active:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white border border-blue-200/80 hover:border-blue-600 active:border-blue-700 dark:border-blue-800/80 font-mono text-xs font-bold transition-all duration-150 active:scale-95 shadow-2xs hover:shadow-xs cursor-pointer select-none"
                                    title="Click to view full invoice"
                                  >
                                    <Receipt className="w-3.5 h-3.5 transition-transform group-hover/inv:scale-110 text-blue-500 group-hover/inv:text-white dark:group-hover/inv:text-white" />
                                    <span>{inv.invoiceNumber}</span>
                                  </button>
                                  <span className="text-3xs text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 pl-0.5">
                                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{formatDate(inv.date)}</span>
                                  </span>
                                </div>
                                <StatusBadge status={inv.paymentStatus} />
                              </div>

                              {/* 3 Clean Rows */}
                              <div className="space-y-1 text-xs py-1.5 px-2 rounded-lg bg-slate-50/60 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60">
                                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                  <span className="text-3xs uppercase tracking-wider font-semibold">Bill Total:</span>
                                  <span className="font-mono font-medium">{formatNPR(inv.grandTotal)}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                  <span className="text-3xs uppercase tracking-wider font-semibold">Paid:</span>
                                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                    {formatNPR(inv.paidAmount || 0)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                  <span className="text-3xs uppercase tracking-wider font-bold text-rose-700 dark:text-rose-400">Due to Pay:</span>
                                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                                    {formatNPR(due)}
                                  </span>
                                </div>
                              </div>

                              {/* Settle Due Action Button */}
                              <div className="pt-0.5 flex items-center justify-between">
                                <button
                                  onClick={() => handleViewInvoice(inv)}
                                  onPointerDown={(e) => spawnTouchRipple(e, 'bg-blue-200/50')}
                                  className="relative overflow-hidden text-3xs text-slate-500 hover:text-blue-600 active:text-blue-800 dark:hover:text-blue-400 font-semibold flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/50 active:bg-blue-100 dark:active:bg-blue-900/60 active:scale-95 cursor-pointer transition-all duration-150 select-none"
                                >
                                  <span>View Details</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleOpenSettleInvoice(inv)}
                                  onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                                  className="relative overflow-hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow-md active:scale-95 active:shadow-inner transition-all duration-150 ease-out cursor-pointer flex items-center justify-center ring-offset-1 hover:ring-2 hover:ring-emerald-500/30 active:ring-2 active:ring-emerald-600 select-none"
                                >
                                  <span>Settle Due</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: History of Bills */}
                {ledgerTab === 'history' && (
                  <div className="space-y-2.5">
                    {/* Opening Balance in History */}
                    {((selectedCustomer.openingBalance || 0) > 0 || openingLedgerDue > 0) && (
                      <div className="p-3 bg-amber-50/40 hover:bg-amber-50/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 rounded-xl border border-amber-200/50 hover:border-amber-300/80 dark:border-amber-900/30 transition-all duration-150 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/40 dark:border-amber-900/30">
                          <span className="font-bold text-amber-900 dark:text-amber-200 font-sans text-xs flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Opening Balance Entry
                          </span>
                          <span className="text-3xs text-slate-400 font-sans">
                            {formatDate(selectedCustomer.createdAt || Date.now())}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span className="text-3xs uppercase tracking-wider font-semibold">Opening Entry:</span>
                            <span className="font-mono font-medium">{formatNPR(selectedCustomer.openingBalance || openingLedgerDue)}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span className="text-3xs uppercase tracking-wider font-semibold">Paid / Settled:</span>
                            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                              {formatNPR(Math.max(0, (selectedCustomer.openingBalance || openingLedgerDue) - openingLedgerDue))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-amber-200/40 dark:border-amber-900/30">
                            <span className="text-3xs uppercase tracking-wider font-bold">Due to Settle:</span>
                            <span className={`font-mono font-bold text-xs ${openingLedgerDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {openingLedgerDue > 0 ? formatNPR(openingLedgerDue) : 'Rs 0 (Fully Cleared)'}
                            </span>
                          </div>
                        </div>
                        {openingLedgerDue > 0 && (
                          <div className="pt-1 flex items-center justify-end">
                            <button
                              onClick={() => handleOpenSettleAccountBalance(openingLedgerDue)}
                              onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                              className="relative overflow-hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow-md active:scale-95 active:shadow-inner transition-all duration-150 ease-out cursor-pointer flex items-center justify-center ring-offset-1 hover:ring-2 hover:ring-emerald-500/30 active:ring-2 active:ring-emerald-600 select-none"
                            >
                              <span>Settle Balance</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {customerInvoices.length === 0 && (selectedCustomer.openingBalance || 0) === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No sales invoices recorded for this customer yet.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {customerInvoices.map(inv => {
                          const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
                          const isFullyPaid = due <= 0;
                          return (
                            <div 
                              key={inv.id} 
                              className={`group/card p-3 rounded-xl border transition-all duration-150 shadow-2xs hover:shadow-sm active:scale-[0.985] space-y-2.5 ${
                                isFullyPaid
                                  ? 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 hover:border-slate-300 dark:border-slate-700/80 dark:hover:border-slate-600'
                                  : 'bg-white dark:bg-slate-800/90 hover:bg-amber-50/40 active:bg-amber-100/30 dark:hover:bg-slate-800 border-slate-200 hover:border-amber-300 active:border-amber-400 dark:border-slate-700/80 dark:hover:border-amber-700/60'
                              }`}
                            >
                              {/* Header: Invoice Badge with Date Below + Status */}
                              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                                <div className="flex flex-col items-start gap-1">
                                  <button
                                    onClick={() => handleViewInvoice(inv)}
                                    onPointerDown={(e) => spawnTouchRipple(e, 'bg-blue-200/50')}
                                    className="relative overflow-hidden group/inv inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/90 hover:bg-blue-600 active:bg-blue-700 text-blue-700 hover:text-white active:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white border border-blue-200/80 hover:border-blue-600 active:border-blue-700 dark:border-blue-800/80 font-mono text-xs font-bold transition-all duration-150 active:scale-95 shadow-2xs hover:shadow-xs cursor-pointer select-none"
                                    title="Click to view full invoice"
                                  >
                                    <Receipt className="w-3.5 h-3.5 transition-transform group-hover/inv:scale-110 text-blue-500 group-hover/inv:text-white dark:group-hover/inv:text-white" />
                                    <span>{inv.invoiceNumber}</span>
                                  </button>
                                  <span className="text-3xs text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 pl-0.5">
                                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{formatDate(inv.date)}</span>
                                  </span>
                                </div>
                                <StatusBadge status={inv.paymentStatus} />
                              </div>

                              {/* 3 Clean Rows */}
                              <div className="space-y-1 text-xs py-1.5 px-2 rounded-lg bg-slate-50/60 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60">
                                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                  <span className="text-3xs uppercase tracking-wider font-semibold">Bill Total:</span>
                                  <span className="font-mono font-medium">{formatNPR(inv.grandTotal)}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                  <span className="text-3xs uppercase tracking-wider font-semibold">Paid:</span>
                                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                    {formatNPR(inv.paidAmount || 0)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                  <span className="text-3xs uppercase tracking-wider font-bold">Due to Pay:</span>
                                  <span className={`font-mono font-bold text-xs ${due > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {due > 0 ? formatNPR(due) : 'Rs 0 (Fully Cleared)'}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-0.5 flex items-center justify-between text-3xs">
                                <span className="uppercase text-slate-400 font-mono">
                                  {inv.paymentMethod} • {inv.items?.length || 0} items
                                </span>
                                {due > 0 ? (
                                  <button
                                    onClick={() => handleOpenSettleInvoice(inv)}
                                    onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                                    className="relative overflow-hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow-md active:scale-95 active:shadow-inner transition-all duration-150 ease-out cursor-pointer flex items-center justify-center ring-offset-1 hover:ring-2 hover:ring-emerald-500/30 active:ring-2 active:ring-emerald-600 select-none"
                                  >
                                    <span>Settle Due</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleViewInvoice(inv)}
                                    onPointerDown={(e) => spawnTouchRipple(e, 'bg-blue-200/50')}
                                    className="relative overflow-hidden px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 active:text-blue-800 dark:hover:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/50 active:bg-blue-100 dark:active:bg-blue-900/60 active:scale-95 transition-all duration-150 select-none"
                                  >
                                    <span>View Tax Bill</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                  placeholder="e.g. Guest / Customer Full Name"
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

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Address / Location (ठेगाना)</label>
                <input
                  type="text"
                  placeholder="e.g. New Road, Kathmandu"
                  value={newCustForm.street}
                  onChange={(e) => setNewCustForm({ ...newCustForm, street: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Phone / Mobile (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="98XXXXXXXX (Optional)"
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400">
                      {custPanVatType} (Optional)
                    </label>
                    <div className="inline-flex p-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setCustPanVatType('PAN')}
                        className={`px-1.5 py-0.5 text-3xs font-black rounded-sm transition-all cursor-pointer ${
                          custPanVatType === 'PAN'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        PAN
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustPanVatType('VAT')}
                        className={`px-1.5 py-0.5 text-3xs font-black rounded-sm transition-all cursor-pointer ${
                          custPanVatType === 'VAT'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        VAT
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder={`9-digit ${custPanVatType}`}
                    value={newCustForm.panVatNumber}
                    onChange={(e) => setNewCustForm({ ...newCustForm, panVatNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
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

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                >
                  Save Customer
                </Button>
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
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                >
                  Record Payment Received
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL INVOICE DETAIL MODAL */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          initialTab={invoiceModalTab}
          onClose={() => {
            setSelectedInvoice(null);
            setInvoiceModalTab('view');
          }}
        />
      )}

      {/* FULL CUSTOMER LEDGER MODAL */}
      {showFullLedgerModal && selectedCustomer && (
        <CustomerLedgerModal
          customer={selectedCustomer}
          onClose={() => setShowFullLedgerModal(false)}
        />
      )}

    </div>
  );
};
