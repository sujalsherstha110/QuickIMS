import React, { useState, useMemo } from 'react';
import { 
  X, FileText, CheckCircle2, Clock, 
  Receipt, History, ChevronRight, Phone, Building2,
  Calendar, Check, AlertCircle, ArrowUpRight, Wallet
} from 'lucide-react';
import { Customer, SaleInvoice } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { StatusBadge } from './StatCard';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { spawnTouchRipple } from '../../utils/touchFeedback';

interface CustomerLedgerModalProps {
  customer: Customer | null;
  onClose: () => void;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  customer: initialCustomer,
  onClose
}) => {
  const { customers, sales, updateCustomer } = useApp();

  // Keep live customer reference from context
  const customer = customers.find(c => c.id === initialCustomer?.id) || initialCustomer;

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [invoiceModalTab, setInvoiceModalTab] = useState<'view' | 'settle' | 'edit'>('view');

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
    setSelectedInvoice(inv);
    setInvoiceModalTab('settle');
  };

  const handleOpenSettleAccountBalance = (due: number) => {
    setSettlingAccountDue(due);
    setSettleAmount(due);
    setSettleMethod('cash');
    setSettleNotes('Opening/Account balance settlement');
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
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>PAN / VAT: {customer.panVatNumber || 'N/A'}</span>
              </p>

              {/* Next Row: Tel */}
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Tel: {customer.phone || 'N/A'}</span>
              </p>

              {/* Next Row: Address */}
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Address: {customer.address?.street
                    ? `${customer.address.street}${customer.address.district ? `, ${customer.address.district}` : ''}`
                    : (customer.address?.district || 'N/A')}
                </span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 active:bg-rose-100 dark:active:bg-rose-900 active:scale-90 transition-all duration-150 cursor-pointer"
              title="Close Ledger"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Outstanding Balance Banner */}
          <div className="px-4 py-2.5 bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 space-y-0.5">
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
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 px-4 sm:px-5 gap-2 pt-2">
            <button
              onClick={() => setActiveTab('pending')}
              onPointerDown={(e) => spawnTouchRipple(e, 'bg-amber-200/40')}
              className={`relative overflow-hidden py-2 px-3.5 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition-all duration-150 cursor-pointer active:scale-95 select-none ${
                activeTab === 'pending'
                  ? 'border-amber-600 bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-2xs'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100/60 active:bg-amber-200/80 dark:hover:bg-amber-950/40 dark:active:bg-amber-900/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Bills to be Paid</span>
              <span className={`px-1.5 py-0.2 rounded-full text-3xs font-mono transition-colors ${
                billsToPay.length > 0 
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {billsToPay.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              onPointerDown={(e) => spawnTouchRipple(e, 'bg-indigo-200/40')}
              className={`relative overflow-hidden py-2 px-3.5 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition-all duration-150 cursor-pointer active:scale-95 select-none ${
                activeTab === 'history'
                  ? 'border-indigo-600 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-100/60 active:bg-indigo-200/80 dark:hover:bg-indigo-950/40 dark:active:bg-indigo-900/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History of Bills</span>
              <span className="px-1.5 py-0.2 rounded-full text-3xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {customerInvoices.length}
              </span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-[220px]">
            
            {/* 1. BILLS THAT NEED TO BE PAID */}
            {activeTab === 'pending' && (
              <div className="space-y-3">
                {billsToPay.length === 0 && openingLedgerDue === 0 ? (
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
                      <div className="group p-2.5 sm:p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 hover:border-amber-400/80 dark:hover:border-amber-700/80 hover:shadow-sm space-y-2 text-xs transition-all duration-150">
                        {/* Header: Date & Unsettled Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Date: {formatDate(customer.createdAt || Date.now())}</span>
                          </div>
                          <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                            Unsettled
                          </span>
                        </div>

                        {/* 3 Rows: Opening Entry, Credit Limit, Due to Settle */}
                        <div className="space-y-1 py-1.5 px-2.5 rounded bg-white/80 dark:bg-slate-900/80 group-hover:bg-white dark:group-hover:bg-slate-900 border border-slate-200/60 dark:border-slate-800 group-hover:border-slate-300/80 dark:group-hover:border-slate-700/80 font-mono text-xs transition-colors duration-150">
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
                            onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                            className="relative overflow-hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow-md active:scale-95 active:shadow-inner transition-all duration-150 ease-out cursor-pointer flex items-center justify-center ring-offset-1 hover:ring-2 hover:ring-emerald-500/30 active:ring-2 active:ring-emerald-600 select-none"
                          >
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
                          className="group p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 active:bg-amber-100/70 dark:hover:bg-amber-950/40 hover:border-amber-400/80 dark:hover:border-amber-700/80 active:scale-[0.985] transition-all duration-150 shadow-2xs hover:shadow-sm space-y-2.5 text-xs"
                        >
                          {/* Row 1: Invoice Number with Date Below & Status */}
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                            <div className="flex flex-col items-start gap-1">
                              <button
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setInvoiceModalTab('view');
                                }}
                                onPointerDown={(e) => spawnTouchRipple(e, 'bg-indigo-200/50')}
                                className="relative overflow-hidden group/inv inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50/90 hover:bg-indigo-600 active:bg-indigo-700 text-indigo-700 hover:text-white active:text-white dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white border border-indigo-200/80 hover:border-indigo-600 active:border-indigo-700 dark:border-indigo-800/80 font-mono text-xs font-bold transition-all duration-150 active:scale-95 shadow-2xs hover:shadow-xs cursor-pointer select-none"
                                title="Click to view full invoice"
                              >
                                <Receipt className="w-3.5 h-3.5 transition-transform group-hover/inv:scale-110 text-indigo-500 group-hover/inv:text-white dark:group-hover/inv:text-white" />
                                <span>{inv.invoiceNumber}</span>
                              </button>
                              <span className="text-3xs text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 pl-0.5">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{formatDate(inv.date)}</span>
                              </span>
                            </div>
                            <StatusBadge status={inv.paymentStatus || 'unpaid'} />
                          </div>

                          {/* 3 Rows: Bill Total, Paid, Due to Pay */}
                          <div className="space-y-1 py-2 px-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 group-hover:bg-white dark:group-hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 group-hover:border-slate-300/80 dark:group-hover:border-slate-700/80 font-mono text-xs transition-colors duration-200">
                            {/* Row 1: Bill Total */}
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 font-sans">Bill Total:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatNPR(inv.grandTotal)}
                              </span>
                            </div>

                            {/* Row 2: Paid */}
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 font-sans">Paid:</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatNPR(inv.paidAmount || 0)}
                              </span>
                            </div>

                            {/* Row 3: Due to Pay */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-rose-600 dark:text-rose-400 font-sans font-bold">Due to Pay:</span>
                              <span className="font-black text-rose-600 dark:text-rose-400">
                                {formatNPR(due)}
                              </span>
                            </div>
                          </div>

                          {/* Action: Redirect to Settle Due of Invoice */}
                          <div className="flex justify-end pt-0.5">
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

            {/* 2. HISTORY OF BILLS */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                
                {/* Opening Balance Entry in History */}
                {((customer.openingBalance || 0) > 0 || openingLedgerDue > 0) && (
                  <div className={`group p-2.5 sm:p-3 rounded-lg border ${
                    openingLedgerDue > 0
                      ? 'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 hover:border-amber-400/80 dark:hover:border-amber-700/80'
                      : 'border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                  } hover:shadow-sm space-y-2 text-xs transition-all duration-150`}>
                    {/* Header: Date & Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Date: {formatDate(customer.createdAt || Date.now())}</span>
                      </div>
                      {openingLedgerDue > 0 ? (
                        <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                          Unsettled
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Fully Settled
                        </span>
                      )}
                    </div>

                    {/* 3 Rows: Opening Entry, Paid / Settled, Due to Settle */}
                    <div className="space-y-1 py-1.5 px-2.5 rounded bg-white/80 dark:bg-slate-900/80 group-hover:bg-white dark:group-hover:bg-slate-900 border border-slate-200/60 dark:border-slate-800 group-hover:border-slate-300/80 dark:group-hover:border-slate-700/80 font-mono text-xs transition-colors duration-150">
                      {/* Row 1: Opening Entry */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-sans">Opening Entry:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {formatNPR(customer.openingBalance || openingLedgerDue)}
                        </span>
                      </div>

                      {/* Row 2: Settled / Paid */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-sans">Paid / Settled:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatNPR(Math.max(0, (customer.openingBalance || 0) - openingLedgerDue))}
                        </span>
                      </div>

                      {/* Row 3: Due to Settle */}
                      <div className="flex items-center justify-between pt-0.5 border-t border-slate-100 dark:border-slate-800">
                        <span className={`font-sans font-bold ${openingLedgerDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          Due to Settle:
                        </span>
                        <span className={`font-black ${openingLedgerDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {formatNPR(openingLedgerDue)}
                        </span>
                      </div>
                    </div>

                    {/* Action if unsettled */}
                    {openingLedgerDue > 0 && (
                      <div className="flex justify-end pt-0.5">
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

                {customerInvoices.length === 0 && (customer.openingBalance || 0) === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 stroke-1" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No Past Invoices Found
                    </p>
                    <p className="text-xs text-slate-400">
                      No sales or billing transactions recorded for this customer yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerInvoices.map(inv => {
                      const due = inv.dueAmount ?? Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
                      const isFullyPaid = due <= 0;

                      return (
                        <div
                          key={inv.id}
                          className={`group p-3 rounded-xl border transition-all duration-150 shadow-2xs hover:shadow-sm active:scale-[0.985] space-y-2.5 text-xs ${
                            isFullyPaid
                              ? 'border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                              : 'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 active:bg-amber-100/70 dark:hover:bg-amber-950/40 hover:border-amber-400/80 dark:hover:border-amber-700/80'
                          }`}
                        >
                          {/* Row 1: Invoice Number with Date Below & Status */}
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col items-start gap-1">
                              <button
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setInvoiceModalTab('view');
                                }}
                                onPointerDown={(e) => spawnTouchRipple(e, 'bg-indigo-200/50')}
                                className="relative overflow-hidden group/inv inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50/90 hover:bg-indigo-600 active:bg-indigo-700 text-indigo-700 hover:text-white active:text-white dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white border border-indigo-200/80 hover:border-indigo-600 active:border-indigo-700 dark:border-indigo-800/80 font-mono text-xs font-bold transition-all duration-150 active:scale-95 shadow-2xs hover:shadow-xs cursor-pointer select-none"
                                title="Click to view full invoice"
                              >
                                <Receipt className="w-3.5 h-3.5 transition-transform group-hover/inv:scale-110 text-indigo-500 group-hover/inv:text-white dark:group-hover/inv:text-white" />
                                <span>{inv.invoiceNumber}</span>
                              </button>
                              <span className="text-3xs text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 pl-0.5">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{formatDate(inv.date)}</span>
                              </span>
                            </div>

                            {isFullyPaid ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Fully Paid
                              </span>
                            ) : (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                                {inv.paymentStatus || 'Due'}
                              </span>
                            )}
                          </div>

                          {/* 3 Rows: Bill Total, Paid, Due to Pay */}
                          <div className="space-y-1 py-2 px-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 group-hover:bg-white dark:group-hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 group-hover:border-slate-300/80 dark:group-hover:border-slate-700/80 font-mono text-xs transition-colors duration-200">
                            {/* Row 1: Bill Total */}
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 font-sans">Bill Total:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatNPR(inv.grandTotal)}
                              </span>
                            </div>

                            {/* Row 2: Paid */}
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 font-sans">Paid:</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatNPR(inv.paidAmount || 0)}
                              </span>
                            </div>

                            {/* Row 3: Due to Pay */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className={`font-sans font-bold ${isFullyPaid ? 'text-slate-500 dark:text-slate-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                Due to Pay:
                              </span>
                              <span className={`font-black ${isFullyPaid ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600 dark:text-rose-400'}`}>
                                {formatNPR(due)}
                              </span>
                            </div>
                          </div>

                          {/* Action if Due to Pay > 0 */}
                          {!isFullyPaid && (
                            <div className="flex justify-end pt-0.5">
                              <button
                                onClick={() => handleOpenSettleInvoice(inv)}
                                onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                                className="relative overflow-hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow-md active:scale-95 active:shadow-inner transition-all duration-150 ease-out cursor-pointer flex items-center justify-center ring-offset-1 hover:ring-2 hover:ring-emerald-500/30 active:ring-2 active:ring-emerald-600 select-none"
                              >
                                <span>Settle Due</span>
                              </button>
                            </div>
                          )}
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
              className="px-4 py-1.5 bg-slate-200/90 hover:bg-slate-800 hover:text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold active:scale-95 transition-all duration-150 shadow-xs hover:shadow-sm cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>

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
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 active:scale-90 transition-all duration-150 cursor-pointer"
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
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 outline-hidden hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Payment Method
                </label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value as SaleInvoice['paymentMethod'])}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all duration-150 cursor-pointer"
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
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all duration-150"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlingAccountDue(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || settleAmount <= 0}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg shadow-xs hover:shadow-md active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL INVOICE DETAIL / PRINT / SETTLE MODAL */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          initialTab={invoiceModalTab}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </>
  );
};
