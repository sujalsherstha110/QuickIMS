import React, { useState, useMemo } from 'react';
import { 
  X, FileText, DollarSign, CheckCircle2, Clock, 
  Receipt, History, ChevronRight, Phone, Building2,
  Calendar, Check, AlertCircle, ArrowUpRight, Wallet
} from 'lucide-react';
import { Customer, SaleInvoice } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { StatusBadge } from './StatCard';
import { InvoiceDetailModal } from './InvoiceDetailModal';

interface CustomerLedgerModalProps {
  customer: Customer | null;
  onClose: () => void;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  customer: initialCustomer,
  onClose
}) => {
  const { customers, sales, settleInvoicePayment, updateCustomer } = useApp();

  // Keep live customer reference from context
  const customer = customers.find(c => c.id === initialCustomer?.id) || initialCustomer;

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);

  // Quick Settle inline state for Invoices
  const [settlingInvoice, setSettlingInvoice] = useState<SaleInvoice | null>(null);
  // Quick Settle inline state for Opening / Account Balance
  const [settlingAccountDue, setSettlingAccountDue] = useState<number | null>(null);

  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<SaleInvoice['paymentMethod']>('cash');
  const [settleNotes, setSettleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invoices for this customer
  const customerInvoices = useMemo(() => {
    if (!customer) return [];
    return sales
      .filter(s => s.customerId === customer.id || (customer.phone && s.customerPhone === customer.phone))
      .sort((a, b) => b.date - a.date);
  }, [sales, customer]);

  // Bills that need to be paid (Unpaid / Partial / Overdue / Due Amount > 0)
  const billsToPay = useMemo(() => {
    return customerInvoices.filter(inv => {
      const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
      return due > 0 || inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial' || inv.paymentStatus === 'overdue';
    });
  }, [customerInvoices]);

  // Sum of invoice dues
  const invoicePendingDue = useMemo(() => {
    return billsToPay.reduce((sum, inv) => {
      const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
      return sum + due;
    }, 0);
  }, [billsToPay]);

  // Unbilled Opening Balance / Prior Ledger Due
  const openingLedgerDue = useMemo(() => {
    if (!customer) return 0;
    const bal = customer.currentBalance || 0;
    return Math.max(0, bal - invoicePendingDue);
  }, [customer, invoicePendingDue]);

  // Total pending dues (Invoices + Opening Balance)
  const totalPendingDue = (customer?.currentBalance || 0) > 0 
    ? customer.currentBalance 
    : (invoicePendingDue + openingLedgerDue);

  const totalPendingCount = billsToPay.length + (openingLedgerDue > 0 ? 1 : 0);

  if (!customer) return null;

  const handleOpenSettleInvoice = (inv: SaleInvoice) => {
    const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
    setSettlingInvoice(inv);
    setSettlingAccountDue(null);
    setSettleAmount(due);
    setSettleMethod('cash');
    setSettleNotes('');
  };

  const handleOpenSettleAccountBalance = (due: number) => {
    setSettlingAccountDue(due);
    setSettlingInvoice(null);
    setSettleAmount(due);
    setSettleMethod('cash');
    setSettleNotes('Opening/Account balance settlement');
  };

  const handleConfirmSettleInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingInvoice || settleAmount <= 0) return;
    setIsSubmitting(true);
    try {
      await settleInvoicePayment(settlingInvoice.id, settleAmount, settleMethod, undefined, settleNotes);
      setSettlingInvoice(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSettleAccountBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || settleAmount <= 0) return;
    setIsSubmitting(true);
    try {
      const newBalance = Math.max(0, (customer.currentBalance || 0) - settleAmount);
      await updateCustomer(customer.id, { currentBalance: newBalance });
      setSettlingAccountDue(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-800/40">
            <div className="space-y-1 flex-1 pr-3">
              <div className="flex items-center gap-2">
                <span className="text-3xs uppercase font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                  {customer.customerType || 'Customer'}
                </span>
                <span className="text-3xs font-mono text-slate-400">
                  {customer.customerCode}
                </span>
              </div>

              {/* Customer Name */}
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {customer.name}
              </h2>

              {/* Row: Company Name */}
              {customer.companyName && (
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{customer.companyName}</span>
                </p>
              )}

              {/* Row: PAN / VAT below company name */}
              <p className="text-3xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                <span>PAN / VAT: {customer.panVatNumber || 'N/A'}</span>
              </p>

              {/* Next Row: Tel */}
              <p className="text-3xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Tel: {customer.phone || 'N/A'}</span>
              </p>

              {/* Next Row: Address */}
              <p className="text-3xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                <span>
                  Address: {customer.address?.street
                    ? `${customer.address.street}${customer.address.district ? `, ${customer.address.district}` : ''}`
                    : (customer.address?.district || 'N/A')}
                </span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Outstanding Balance Banner - 4 Rows with small font */}
          <div className="px-4 py-2.5 bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 space-y-1">
            {/* Row 1: Label */}
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-3xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Total Outstanding Balance
              </span>
            </div>

            {/* Row 2: Amount */}
            <div className="text-xs sm:text-sm font-black font-mono text-amber-900 dark:text-amber-100 pl-5">
              {formatNPR(totalPendingDue)}
            </div>

            {/* Row 3: Due Bills Count */}
            <div className="text-3xs font-mono text-slate-600 dark:text-slate-400 pl-5">
              {billsToPay.length} unpaid / due bill{billsToPay.length === 1 ? '' : 's'}
            </div>

            {/* Row 4: Total Bills Count */}
            <div className="text-3xs font-mono text-slate-500 dark:text-slate-400 pl-5">
              {customerInvoices.length} total bill{customerInvoices.length === 1 ? '' : 's'} recorded {customer.openingBalance ? '(+ Opening Ledger)' : ''}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-5">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'pending'
                  ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Bills to be Paid</span>
              <span className={`px-1.5 py-0.2 rounded-full text-3xs font-mono ${
                totalPendingCount > 0 
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {totalPendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History of Bills</span>
              <span className="px-1.5 py-0.2 rounded-full text-3xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
                {customerInvoices.length + ((customer.openingBalance || 0) > 0 ? 1 : 0)}
              </span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-[220px]">
            
            {/* 1. BILLS THAT NEED TO BE PAID */}
            {activeTab === 'pending' && (
              <div className="space-y-3">
                {totalPendingCount === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/80 stroke-1" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No Bills or Dues Pending Payment
                    </p>
                    <p className="text-3xs text-slate-400">
                      All invoices and ledger balances for this customer are fully cleared and settled.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    
                    {/* A. UNBILLED OPENING BALANCE / PRIOR ACCOUNT DUES */}
                    {openingLedgerDue > 0 && (
                      <div className="p-2.5 sm:p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-2 text-3xs">
                        {/* Title & Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-3xs uppercase font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                            Opening Ledger Balance (सुरुवाती खाता बक्यौता)
                          </span>
                          <span className="text-3xs font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                            Unsettled
                          </span>
                        </div>

                        {/* Next Row: Date */}
                        <div className="text-3xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Date: {formatDate(customer.createdAt || Date.now())}</span>
                        </div>

                        {/* 3 Rows: Opening Entry, Credit Limit, Due to Settle */}
                        <div className="space-y-1 py-1.5 px-2.5 rounded bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 font-mono">
                          {/* Row 1: Opening Entry */}
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-sans">Opening Entry:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formatNPR(customer.openingBalance || 0)}
                            </span>
                          </div>

                          {/* Row 2: Credit Limit */}
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-sans">Credit Limit:</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              {formatNPR(customer.creditLimit || 0)}
                            </span>
                          </div>

                          {/* Row 3: Due to Settle */}
                          <div className="flex items-center justify-between pt-0.5 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-rose-600 dark:text-rose-400 font-sans font-bold">Due to Settle:</span>
                            <span className="font-black text-rose-600 dark:text-rose-400">
                              {formatNPR(openingLedgerDue)}
                            </span>
                          </div>
                        </div>

                        {/* Settle Action */}
                        <div className="flex justify-end pt-0.5">
                          <button
                            onClick={() => handleOpenSettleAccountBalance(openingLedgerDue)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold flex items-center gap-1 text-3xs shadow-xs"
                          >
                            <DollarSign className="w-3 h-3" />
                            <span>Settle Balance</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* B. SPECIFIC INVOICES WITH REMAINING DUES */}
                    {billsToPay.map(inv => {
                      const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
                      return (
                        <div
                          key={inv.id}
                          className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-2"
                        >
                          {/* Row 1: Invoice Number & Date */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedInvoice(inv)}
                                className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                {inv.invoiceNumber}
                              </button>
                              <span className="text-3xs text-slate-400 font-mono">
                                {formatDate(inv.date)}
                              </span>
                            </div>
                            <StatusBadge status={inv.paymentStatus || 'unpaid'} />
                          </div>

                          {/* Row 2: Financials (Total, Paid, Due) */}
                          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 text-center font-mono">
                            <div>
                              <span className="text-3xs text-slate-400 block font-sans">Bill Total</span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                {formatNPR(inv.grandTotal)}
                              </span>
                            </div>
                            <div>
                              <span className="text-3xs text-slate-400 block font-sans">Paid</span>
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                                {formatNPR(inv.paidAmount || 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-3xs text-rose-500 dark:text-rose-400 block font-sans font-bold">Due to Pay</span>
                              <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                                {formatNPR(due)}
                              </span>
                            </div>
                          </div>

                          {/* Row 3: Items summary & Action */}
                          <div className="flex items-center justify-between pt-1 text-3xs">
                            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-[300px]">
                              {inv.items?.length || 0} item{(inv.items?.length || 0) === 1 ? '' : 's'}: {inv.items?.map(i => i.productName).join(', ')}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedInvoice(inv)}
                                className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium"
                              >
                                View Bill
                              </button>
                              <button
                                onClick={() => handleOpenSettleInvoice(inv)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold flex items-center gap-1 shadow-xs"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Settle Bill</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. HISTORY OF BILLS */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                
                {/* Opening Balance Entry in History */}
                {((customer.openingBalance || 0) > 0 || openingLedgerDue > 0) && (
                  <div className="py-2.5 px-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 space-y-1 font-mono">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-amber-600" />
                        <span className="font-bold text-amber-800 dark:text-amber-300 font-sans">
                          Opening Balance & Prior Ledger
                        </span>
                        <span className="text-3xs text-slate-400 font-sans">
                          {formatDate(customer.createdAt || Date.now())}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatNPR(customer.openingBalance || openingLedgerDue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-3xs font-mono">
                      <span className="text-slate-500 font-sans">Initial account balance carried forward</span>
                      <span className={openingLedgerDue > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5"}>
                        {openingLedgerDue > 0 ? `Unsettled Due: ${formatNPR(openingLedgerDue)}` : <><Check className="w-3 h-3" /> Fully Settled</>}
                      </span>
                    </div>
                  </div>
                )}

                {customerInvoices.length === 0 && (customer.openingBalance || 0) === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 stroke-1" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No Past Invoices Found
                    </p>
                    <p className="text-3xs text-slate-400">
                      No sales or billing transactions recorded for this customer yet.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {customerInvoices.map(inv => {
                      const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
                      return (
                        <div
                          key={inv.id}
                          onClick={() => setSelectedInvoice(inv)}
                          className="py-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors space-y-1.5 group"
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                {inv.invoiceNumber}
                              </span>
                              <span className="text-3xs text-slate-400 font-sans">
                                {formatDate(inv.date)}
                              </span>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {formatNPR(inv.grandTotal)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-3xs font-mono">
                            <div className="text-slate-500 font-sans flex items-center gap-2">
                              <span className="uppercase text-3xs px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {inv.paymentMethod}
                              </span>
                              <span>{inv.items?.length || 0} item{(inv.items?.length || 0) === 1 ? '' : 's'}</span>
                            </div>

                            <div>
                              {due > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  Due: {formatNPR(due)}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Fully Paid
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs">
            <span className="text-3xs text-slate-400">
              Customer Ledger Statement
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>

        </div>
      </div>

      {/* QUICK INLINE SETTLE MODAL FOR INVOICE */}
      {settlingInvoice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Settle Bill ({settlingInvoice.invoiceNumber})
              </h3>
              <button
                onClick={() => setSettlingInvoice(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettleInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Payment Amount to Collect (NPR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={settlingInvoice.dueAmount ?? settlingInvoice.grandTotal}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Payment Method
                </label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value as SaleInvoice['paymentMethod'])}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                >
                  <option value="cash">Cash (नगद)</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="connectips">ConnectIPS / Mobile Banking</option>
                  <option value="bank_transfer">Bank Transfer / Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Notes / Voucher Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared at counter"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlingInvoice(null)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || settleAmount <= 0}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK INLINE SETTLE MODAL FOR OPENING / ACCOUNT BALANCE */}
      {settlingAccountDue !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Settle Opening / Account Due
              </h3>
              <button
                onClick={() => setSettlingAccountDue(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettleAccountBalance} className="space-y-3 text-xs">
              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Payment Amount to Collect (NPR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={customer.currentBalance || settlingAccountDue}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Payment Method
                </label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value as SaleInvoice['paymentMethod'])}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                >
                  <option value="cash">Cash (नगद)</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="connectips">ConnectIPS / Mobile Banking</option>
                  <option value="bank_transfer">Bank Transfer / Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Notes / Receipt Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared prior ledger balance"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlingAccountDue(null)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || settleAmount <= 0}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL INVOICE DETAIL / PRINT MODAL */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </>
  );
};
