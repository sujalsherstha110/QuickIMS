import React, { useState, useMemo } from 'react';
import { 
  X, FileText, CheckCircle2, Clock, 
  Receipt, History, ChevronRight, Phone, Building2,
  Calendar, Check, AlertCircle, Wallet, ArrowUpRight, DollarSign
} from 'lucide-react';
import { Supplier, PurchaseInvoice } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { StatusBadge } from './StatCard';
import { spawnTouchRipple } from '../../utils/touchFeedback';

interface SupplierLedgerModalProps {
  supplier: Supplier | null;
  onClose: () => void;
}

export const SupplierLedgerModal: React.FC<SupplierLedgerModalProps> = ({
  supplier: initialSupplier,
  onClose
}) => {
  const { suppliers, purchases, updateSupplier, settlePurchasePayment, canStaffDo } = useApp();
  const canUpdateSupplier = canStaffDo('purchasesSuppliers', 'update');

  // Keep live supplier reference from context
  const supplier = suppliers.find(s => s.id === initialSupplier?.id) || initialSupplier;

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Settle state for Opening / Account Balance
  const [settlingAccountDue, setSettlingAccountDue] = useState<number | null>(null);

  // Settle state for a specific Purchase Bill
  const [settlingPurchase, setSettlingPurchase] = useState<PurchaseInvoice | null>(null);

  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<PurchaseInvoice['paymentMethod']>('bank_transfer');
  const [settleNotes, setSettleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Purchases for this supplier
  const supplierPurchases = useMemo(() => {
    if (!supplier) return [];
    return purchases
      .filter(p => p.supplierId === supplier.id || (supplier.companyName && String(p.supplierName || '').toLowerCase() === String(supplier.companyName).toLowerCase()))
      .sort((a, b) => b.date - a.date);
  }, [purchases, supplier]);

  // Bills that need to be paid (Unpaid / Partial / Overdue / Due Amount > 0)
  const billsToPay = useMemo(() => {
    return supplierPurchases.filter(pur => {
      const due = pur.dueAmount ?? Math.max(0, pur.grandTotal - (pur.paidAmount || 0));
      return due > 0 || pur.paymentStatus === 'unpaid' || pur.paymentStatus === 'partial' || pur.paymentStatus === 'overdue';
    });
  }, [supplierPurchases]);

  // Sum of purchase dues
  const purchasePendingDue = useMemo(() => {
    return billsToPay.reduce((sum, pur) => {
      const due = pur.dueAmount ?? Math.max(0, pur.grandTotal - (pur.paidAmount || 0));
      return sum + due;
    }, 0);
  }, [billsToPay]);

  // Unbilled Opening Balance / Prior Ledger Due
  const openingLedgerDue = useMemo(() => {
    if (!supplier) return 0;
    const bal = supplier.currentBalance || 0;
    return Math.max(0, bal - purchasePendingDue);
  }, [supplier, purchasePendingDue]);

  // Total pending dues (Purchases + Opening Balance)
  const totalPendingDue = (supplier?.currentBalance || 0) > 0 
    ? supplier.currentBalance 
    : (purchasePendingDue + openingLedgerDue);

  const totalPendingCount = billsToPay.length + (openingLedgerDue > 0 ? 1 : 0);

  if (!supplier) return null;

  const handleOpenSettleAccountBalance = (due: number) => {
    if (!canUpdateSupplier) return;
    setSettlingPurchase(null);
    setSettlingAccountDue(due);
    setSettleAmount(due);
    setSettleMethod(supplier.bankDetails?.bankName ? 'bank_transfer' : 'cash');
    setSettleNotes('Supplier opening/account payable settlement');
  };

  const handleOpenSettlePurchaseBill = (pur: PurchaseInvoice) => {
    if (!canUpdateSupplier) return;
    const due = pur.dueAmount ?? Math.max(0, pur.grandTotal - (pur.paidAmount || 0));
    setSettlingAccountDue(null);
    setSettlingPurchase(pur);
    setSettleAmount(due);
    setSettleMethod(pur.paymentMethod || (supplier.bankDetails?.bankName ? 'bank_transfer' : 'cash'));
    setSettleNotes(`Payment for purchase bill ${pur.purchaseNumber}`);
  };

  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdateSupplier) return;
    if (!supplier || settleAmount <= 0) return;
    setIsSubmitting(true);
    try {
      if (settlingPurchase) {
        await settlePurchasePayment(settlingPurchase.id, settleAmount, settleMethod, settleNotes);
        setSettlingPurchase(null);
      } else if (settlingAccountDue !== null) {
        const newBalance = Math.max(0, (supplier.currentBalance || 0) - settleAmount);
        await updateSupplier(supplier.id, { currentBalance: newBalance });
        setSettlingAccountDue(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format supplier address
  const formattedAddress = useMemo(() => {
    if (!supplier.address) return 'N/A';
    if (typeof supplier.address === 'string') return supplier.address;
    const parts = [
      supplier.address.street,
      supplier.address.municipality,
      supplier.address.district,
      supplier.address.province
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }, [supplier.address]);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-800/40">
            <div className="space-y-1 flex-1 pr-3">
              <div className="flex items-center gap-2">
                <span className="text-3xs uppercase font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                  SUPPLIER
                </span>
                <span className="text-3xs font-mono text-slate-400">
                  {supplier.supplierCode || 'SUP-0001'}
                </span>
              </div>

              {/* Title / Name */}
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {supplier.name || supplier.companyName}
              </h2>

              {/* Company Name */}
              {supplier.companyName && (
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{supplier.companyName}</span>
                </p>
              )}

              {/* PAN / VAT */}
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{supplier.panVatType ? `${supplier.panVatType}` : 'PAN / VAT'}: {supplier.panVatNumber || 'N/A'}</span>
              </p>

              {/* Tel */}
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Tel: {supplier.phone || 'N/A'}</span>
              </p>

              {/* Address */}
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Address: {formattedAddress}</span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 active:bg-rose-100 dark:active:bg-rose-900 active:scale-90 transition-all duration-150 cursor-pointer"
              title="Close Supplier Ledger"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Outstanding Balance Banner - Matching Screenshot Cream/Amber Style */}
          <div className="px-4 py-2.5 bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-3xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                TOTAL OUTSTANDING BALANCE
              </span>
            </div>

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
                totalPendingCount > 0 
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {totalPendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              onPointerDown={(e) => spawnTouchRipple(e, 'bg-blue-200/40')}
              className={`relative overflow-hidden py-2 px-3.5 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition-all duration-150 cursor-pointer active:scale-95 select-none ${
                activeTab === 'history'
                  ? 'border-blue-600 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/60 active:bg-blue-200/80 dark:hover:bg-blue-950/40 dark:active:bg-blue-900/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History of Bills</span>
              <span className="px-1.5 py-0.2 rounded-full text-3xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {supplierPurchases.length + ((supplier.openingBalance || 0) > 0 ? 1 : 0)}
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
                      All purchase invoices and ledger balances for this supplier are fully cleared and settled.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    
                    {/* A. UNBILLED OPENING BALANCE / PRIOR ACCOUNT DUES (Exact match with screenshot) */}
                    {openingLedgerDue > 0 && (
                      <div className="group p-2.5 sm:p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 hover:border-amber-400/80 dark:hover:border-amber-700/80 hover:shadow-sm space-y-2 text-xs transition-all duration-150">
                        {/* Header: Date & Unsettled Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Date: {formatDate(supplier.createdAt || Date.now())}</span>
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
                              {formatNPR(supplier.openingBalance || 0)}
                            </span>
                          </div>

                          {/* Row 2: Credit Limit */}
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-sans">Credit Limit:</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              {formatNPR(supplier.creditLimit || 0)}
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
                        {canUpdateSupplier && (
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

                    {/* B. SPECIFIC PURCHASE BILLS WITH REMAINING DUES */}
                    {billsToPay.map(pur => {
                      const due = pur.dueAmount ?? Math.max(0, pur.grandTotal - (pur.paidAmount || 0));
                      return (
                        <div
                          key={pur.id}
                          className="group p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 active:bg-amber-100/70 dark:hover:bg-amber-950/40 hover:border-amber-400/80 dark:hover:border-amber-700/80 active:scale-[0.985] transition-all duration-150 shadow-2xs hover:shadow-sm space-y-2.5 text-xs"
                        >
                          {/* Row 1: Bill Number with Date & Status */}
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/90 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-mono text-xs font-bold">
                                <Receipt className="w-3.5 h-3.5 text-blue-500" />
                                <span>{pur.purchaseNumber}</span>
                                {pur.supplierInvoiceNumber && (
                                  <span className="text-3xs text-slate-500">({pur.supplierInvoiceNumber})</span>
                                )}
                              </span>
                              <span className="text-3xs text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 pl-0.5">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{formatDate(pur.date)}</span>
                              </span>
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                              {pur.paymentStatus === 'partial' ? 'Partially Paid' : 'Unsettled'}
                            </span>
                          </div>

                          {/* 3 Rows: Bill Total, Paid, Due to Settle */}
                          <div className="space-y-1 py-2 px-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 group-hover:bg-white dark:group-hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 group-hover:border-slate-300/80 dark:group-hover:border-slate-700/80 font-mono text-xs transition-colors duration-200">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 font-sans">Bill Total:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatNPR(pur.grandTotal)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 font-sans">Paid:</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatNPR(pur.paidAmount || 0)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-rose-600 dark:text-rose-400 font-sans font-bold">Due to Settle:</span>
                              <span className="font-black text-rose-600 dark:text-rose-400">
                                {formatNPR(due)}
                              </span>
                            </div>
                          </div>

                          {/* Action */}
                          {canUpdateSupplier && (
                            <div className="flex justify-end pt-0.5">
                              <button
                                onClick={() => handleOpenSettlePurchaseBill(pur)}
                                onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                                className="relative overflow-hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow-md active:scale-95 active:shadow-inner transition-all duration-150 ease-out cursor-pointer flex items-center justify-center ring-offset-1 hover:ring-2 hover:ring-emerald-500/30 active:ring-2 active:ring-emerald-600 select-none"
                              >
                                <span>Settle Balance</span>
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

            {/* 2. HISTORY OF BILLS */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                
                {/* Opening Balance Entry in History */}
                {((supplier.openingBalance || 0) > 0 || openingLedgerDue > 0) && (
                  <div className={`group p-2.5 sm:p-3 rounded-lg border ${
                    openingLedgerDue > 0
                      ? 'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 hover:border-amber-400/80 dark:hover:border-amber-700/80'
                      : 'border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                  } hover:shadow-sm space-y-2 text-xs transition-all duration-150`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Date: {formatDate(supplier.createdAt || Date.now())}</span>
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

                    <div className="space-y-1 py-1.5 px-2.5 rounded bg-white/80 dark:bg-slate-900/80 group-hover:bg-white dark:group-hover:bg-slate-900 border border-slate-200/60 dark:border-slate-800 group-hover:border-slate-300/80 dark:group-hover:border-slate-700/80 font-mono text-xs transition-colors duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-sans">Opening Entry:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {formatNPR(supplier.openingBalance || openingLedgerDue)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-sans">Paid / Settled:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatNPR(Math.max(0, (supplier.openingBalance || 0) - openingLedgerDue))}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-0.5 border-t border-slate-100 dark:border-slate-800">
                        <span className={`font-sans font-bold ${openingLedgerDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          Due to Settle:
                        </span>
                        <span className={`font-black ${openingLedgerDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {formatNPR(openingLedgerDue)}
                        </span>
                      </div>
                    </div>

                    {openingLedgerDue > 0 && canUpdateSupplier && (
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

                {supplierPurchases.length === 0 && (supplier.openingBalance || 0) === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 stroke-1" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No Past Purchase Bills Found
                    </p>
                    <p className="text-xs text-slate-400">
                      No purchase bills recorded for this supplier yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {supplierPurchases.map(pur => {
                      const due = pur.dueAmount ?? Math.max(0, pur.grandTotal - (pur.paidAmount || 0));
                      const isFullyPaid = due <= 0;

                      return (
                        <div
                          key={pur.id}
                          className={`group p-3 rounded-xl border transition-all duration-150 shadow-2xs hover:shadow-sm active:scale-[0.985] space-y-2.5 text-xs ${
                            isFullyPaid
                              ? 'border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                              : 'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 active:bg-amber-100/70 dark:hover:bg-amber-950/40 hover:border-amber-400/80 dark:hover:border-amber-700/80'
                          }`}
                        >
                          {/* Row 1: Bill Number with Date & Status */}
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/90 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-mono text-xs font-bold">
                                <Receipt className="w-3.5 h-3.5 text-blue-500" />
                                <span>{pur.purchaseNumber}</span>
                                {pur.supplierInvoiceNumber && (
                                  <span className="text-3xs text-slate-500">({pur.supplierInvoiceNumber})</span>
                                )}
                              </span>
                              <span className="text-3xs text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 pl-0.5">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{formatDate(pur.date)}</span>
                              </span>
                            </div>

                            {isFullyPaid ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Fully Settled
                              </span>
                            ) : (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                                {pur.paymentStatus === 'partial' ? 'Partially Paid' : 'Unsettled'}
                              </span>
                            )}
                          </div>

                          {/* 3 Rows: Bill Total, Paid, Due to Settle */}
                          <div className="space-y-1 py-2 px-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 group-hover:bg-white dark:group-hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 group-hover:border-slate-300/80 dark:group-hover:border-slate-700/80 font-mono text-xs transition-colors duration-200">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 font-sans">Bill Total:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatNPR(pur.grandTotal)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400 font-sans">Paid:</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatNPR(pur.paidAmount || 0)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className={`font-sans font-bold ${isFullyPaid ? 'text-slate-500 dark:text-slate-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                Due to Settle:
                              </span>
                              <span className={`font-black ${isFullyPaid ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600 dark:text-rose-400'}`}>
                                {formatNPR(due)}
                              </span>
                            </div>
                          </div>

                          {/* Action if Due > 0 */}
                          {!isFullyPaid && canUpdateSupplier && (
                            <div className="flex justify-end pt-0.5">
                              <button
                                onClick={() => handleOpenSettlePurchaseBill(pur)}
                                onPointerDown={(e) => spawnTouchRipple(e, 'bg-white/40')}
                                className="relative overflow-hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs hover:shadow-md active:scale-95 active:shadow-inner transition-all duration-150 ease-out cursor-pointer flex items-center justify-center ring-offset-1 hover:ring-2 hover:ring-emerald-500/30 active:ring-2 active:ring-emerald-600 select-none"
                              >
                                <span>Settle Balance</span>
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
              Supplier Ledger Statement (साहु हिसाब किताब)
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

      {/* QUICK INLINE SETTLE MODAL FOR OPENING / PURCHASE BILL */}
      {(settlingAccountDue !== null || settlingPurchase !== null) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                {settlingPurchase ? `Settle Bill: ${settlingPurchase.purchaseNumber}` : 'Settle Opening / Account Due'}
              </h3>
              <button
                onClick={() => {
                  setSettlingAccountDue(null);
                  setSettlingPurchase(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 active:scale-90 transition-all duration-150 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Supplier Bank Info if available */}
            {supplier.bankDetails?.accountNumber && (
              <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50 text-2xs space-y-0.5">
                <div className="font-bold text-blue-900 dark:text-blue-200">
                  {supplier.bankDetails.bankName}
                </div>
                <div className="font-mono text-slate-600 dark:text-slate-400">
                  A/C: {supplier.bankDetails.accountNumber} ({supplier.bankDetails.accountName || supplier.companyName})
                </div>
                {supplier.bankDetails.branch && (
                  <div className="text-3xs text-slate-500">
                    Branch: {supplier.bankDetails.branch}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleConfirmSettle} className="space-y-3 text-xs">
              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Payment Amount to Pay (NPR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={settlingPurchase ? (settlingPurchase.dueAmount ?? settlingPurchase.grandTotal) : (supplier.currentBalance || settlingAccountDue || undefined)}
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
                  onChange={(e) => setSettleMethod(e.target.value as PurchaseInvoice['paymentMethod'])}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all duration-150 cursor-pointer"
                >
                  <option value="bank_transfer">Bank Transfer / Cheque (बैंक / चेक)</option>
                  <option value="connectips">ConnectIPS / Corporate Pay</option>
                  <option value="cash">Cash (नगद)</option>
                  <option value="cheque">Cheque Deposit</option>
                </select>
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Notes / Cheque / Voucher Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cheque #49284 / Bank Ref #8921"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all duration-150"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettlingAccountDue(null);
                    setSettlingPurchase(null);
                  }}
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
    </>
  );
};
