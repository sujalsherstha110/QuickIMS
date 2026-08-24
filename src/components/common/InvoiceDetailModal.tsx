import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Printer, X, CheckCircle2,
  DollarSign, Check, Edit3, ArrowRight, QrCode, RefreshCw,
  Wallet, Building2, CreditCard, User, Calendar, MapPin, Warehouse as WarehouseIcon,
  RotateCcw, AlertCircle, Package, History, ShieldCheck, Plus, Minus, AlertTriangle,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { SaleInvoice, SaleItem, SalesReturn } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate, formatDateTime, toNepaliBSDate, numberToWordsNPR } from '../../utils/nepalFormatters';

interface InvoiceDetailModalProps {
  invoice: SaleInvoice | null;
  onClose: () => void;
  initialTab?: 'view' | 'settle' | 'edit';
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ 
  invoice: initialInvoice, 
  onClose,
  initialTab = 'view'
}) => {
  const { settings, sales, products, customers, updateSale, settleInvoicePayment, recordSalesReturn, salesReturns, currentUser } = useApp();

  // Keep live reference of the invoice from context in case it updates
  const invoice = sales.find(s => 
    (initialInvoice?.id && s.id === initialInvoice.id) || 
    (initialInvoice?.invoiceNumber && s.invoiceNumber === initialInvoice.invoiceNumber)
  ) || initialInvoice;

  const [activeTab, setActiveTab] = useState<'view' | 'settle' | 'edit'>(initialTab);
  const [isCustomerDetailsOpen, setIsCustomerDetailsOpen] = useState<boolean>(false);
  
  // Find customer details from registry if available
  const customerObj = customers.find(c => c.id === invoice?.customerId || c.name === invoice?.customerName);
  const resolvedAddress = invoice?.customerAddress || (customerObj?.address ? `${customerObj.address.street}, ${customerObj.address.municipality}, ${customerObj.address.district}` : 'Counter Sale / Not Specified');

  // Past returns for this invoice
  const pastReturns = useMemo(() => {
    if (!invoice) return [];
    return salesReturns.filter(r => r.originalInvoiceId === invoice.id || r.originalInvoiceNumber === invoice.invoiceNumber);
  }, [salesReturns, invoice]);

  // Settle Payment State
  const remainingDue = invoice ? (invoice.dueAmount ?? Math.max(0, invoice.grandTotal - (invoice.paidAmount || 0))) : 0;
  const [settleAmount, setSettleAmount] = useState<number>(remainingDue);
  const [settleMethod, setSettleMethod] = useState<SaleInvoice['paymentMethod']>('cash');
  const [settleRef, setSettleRef] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [isSettling, setIsSettling] = useState(false);
  const [settleSuccessMsg, setSettleSuccessMsg] = useState('');

  // Edit Invoice State
  const [editCustomerName, setEditCustomerName] = useState(invoice?.customerName || '');
  const [editCustomerPhone, setEditCustomerPhone] = useState(invoice?.customerPhone || '');
  const [editCustomerPan, setEditCustomerPan] = useState(invoice?.customerPanVat || '');
  const [editCustomerAddress, setEditCustomerAddress] = useState(invoice?.customerAddress || '');
  const [editSalesperson, setEditSalesperson] = useState(invoice?.salespersonName || '');
  const [editPaymentMethod, setEditPaymentMethod] = useState<SaleInvoice['paymentMethod']>(invoice?.paymentMethod || 'cash');
  const [editPaymentStatus, setEditPaymentStatus] = useState<SaleInvoice['paymentStatus']>(invoice?.paymentStatus || 'paid');
  const [editNotes, setEditNotes] = useState(invoice?.notes || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  // Product Return State inside Edit Tab
  const [returnItemTarget, setReturnItemTarget] = useState<SaleItem | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnReason, setReturnReason] = useState<SalesReturn['items'][0]['reason']>('customer_choice');
  const [returnRefundMethod, setReturnRefundMethod] = useState<SalesReturn['refundMethod']>('cash');
  const [returnRestock, setReturnRestock] = useState<boolean>(true);
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [isProcessingReturn, setIsProcessingReturn] = useState<boolean>(false);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState<string>('');
  const [returnErrorMsg, setReturnErrorMsg] = useState<string>('');

  // Sync state if invoice changes
  useEffect(() => {
    if (invoice) {
      const due = invoice.dueAmount ?? Math.max(0, invoice.grandTotal - (invoice.paidAmount || 0));
      setSettleAmount(due);
      setEditCustomerName(invoice.customerName || '');
      setEditCustomerPhone(invoice.customerPhone || '');
      setEditCustomerPan(invoice.customerPanVat || '');
      setEditCustomerAddress(invoice.customerAddress || '');
      setEditSalesperson(invoice.salespersonName || '');
      setEditPaymentMethod(invoice.paymentMethod || 'cash');
      setEditPaymentStatus(invoice.paymentStatus || 'paid');
      setEditNotes(invoice.notes || '');
    }
  }, [invoice]);

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'bank_transfer': return 'Bank Transfer';
      case 'esewa': return 'eSewa';
      case 'khalti': return 'Khalti';
      case 'fonepay': return 'Fonepay QR';
      case 'connectips': return 'ConnectIPS';
      case 'cash': return 'Cash';
      case 'credit': return 'Credit Account';
      case 'cheque': return 'Cheque';
      case 'partial': return 'Split / Partial';
      default: return method?.replace('_', ' ') || 'Cash';
    }
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settleAmount <= 0) return;

    setIsSettling(true);
    try {
      await settleInvoicePayment(
        invoice.id,
        Number(settleAmount),
        settleMethod,
        settleRef.trim(),
        settleNotes.trim()
      );
      setSettleSuccessMsg(`Recorded payment of ${formatNPR(Number(settleAmount))}`);
      setTimeout(() => {
        setSettleSuccessMsg('');
        setActiveTab('view');
      }, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSettling(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEdit(true);
    try {
      await updateSale(invoice.id, {
        customerName: editCustomerName.trim(),
        customerPhone: editCustomerPhone.trim(),
        customerPanVat: editCustomerPan.trim(),
        customerAddress: editCustomerAddress.trim(),
        salespersonName: editSalesperson.trim(),
        paymentMethod: editPaymentMethod,
        paymentStatus: editPaymentStatus,
        notes: editNotes.trim()
      });
      setEditSuccessMsg('Invoice details updated successfully');
      setTimeout(() => {
        setEditSuccessMsg('');
      }, 1800);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Return Form for a specific Item
  const handleOpenReturnForm = (item: SaleItem) => {
    const alreadyReturned = item.returnedQuantity || 0;
    const available = Math.max(0, item.quantity - alreadyReturned);
    if (available <= 0) return;

    setReturnItemTarget(item);
    setReturnQty(1);
    setReturnReason('customer_choice');
    setReturnRefundMethod(remainingDue > 0 ? 'deduct_due' : 'cash');
    setReturnRestock(true);
    setReturnNotes('');
    setReturnErrorMsg('');
  };

  // Process Sales Return
  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnItemTarget || !invoice) return;

    const alreadyReturned = returnItemTarget.returnedQuantity || 0;
    const available = Math.max(0, returnItemTarget.quantity - alreadyReturned);
    
    if (returnQty <= 0 || returnQty > available) {
      setReturnErrorMsg(`Please enter a valid return quantity (1 to ${available})`);
      return;
    }

    setIsProcessingReturn(true);
    setReturnErrorMsg('');
    try {
      // Calculate unit rate and refund amount proportionally
      const effectiveRate = returnItemTarget.lineTotal / returnItemTarget.quantity;
      const totalRefund = Math.round(effectiveRate * returnQty);
      const baseQty = returnQty * (returnItemTarget.conversionFactor || 1);
      const returnVoucherNumber = `RET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await recordSalesReturn({
        returnNumber: returnVoucherNumber,
        date: Date.now(),
        originalInvoiceId: invoice.id,
        originalInvoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        items: [{
          productId: returnItemTarget.productId,
          productName: returnItemTarget.productName,
          sku: returnItemTarget.sku,
          returnedQuantity: returnQty,
          baseQuantity: baseQty,
          unitPrice: returnItemTarget.unitPrice,
          refundAmount: totalRefund,
          reason: returnReason
        }],
        totalRefundAmount: totalRefund,
        restockItems: returnRestock,
        refundMethod: returnRefundMethod,
        status: 'completed',
        notes: returnNotes.trim() ? returnNotes.trim() : `Item return from invoice #${invoice.invoiceNumber}`,
        processedBy: currentUser?.name || 'Store Manager'
      });

      setReturnSuccessMsg(`Successfully processed return of ${returnQty} ${returnItemTarget.selectedUnit} (${formatNPR(totalRefund)}). Voucher #${returnVoucherNumber}`);
      setReturnItemTarget(null);
      setTimeout(() => {
        setReturnSuccessMsg('');
      }, 4000);
    } catch (err) {
      console.error('Error recording sales return:', err);
      setReturnErrorMsg('Failed to process return. Please try again.');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[94vh]">
        
        {/* Modal Top Action Bar */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                  {invoice.invoiceNumber}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  invoice.paymentStatus === 'paid' 
                    ? 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : invoice.paymentStatus === 'partial'
                    ? 'bg-amber-100/90 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-rose-100/90 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  {invoice.paymentStatus}
                </span>
                {invoice.status === 'returned' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                    <RotateCcw className="w-2.5 h-2.5" /> Returned
                  </span>
                )}
                {invoice.status === 'partially_returned' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                    <RotateCcw className="w-2.5 h-2.5" /> Partial Return
                  </span>
                )}
                {invoice.fiscalYear && (
                  <span className="hidden sm:inline-block text-[10px] font-mono font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    FY {invoice.fiscalYear}
                  </span>
                )}
              </div>
              <p className="text-3xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {toNepaliBSDate(invoice.date)}
                <span className="hidden sm:inline"> • {formatDate(invoice.date)}</span>
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              title="Print Tax Invoice"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors ml-0.5"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher - Simple Single-Line Controls */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 p-1 sm:p-1.5 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'view'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Tax Invoice</span>
          </button>

          <button
            onClick={() => setActiveTab('settle')}
            className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'settle'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>Settle Due</span>
          </button>

          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Edit & Return</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* ========================================================================= */}
          {/* TAB 1: TAX INVOICE PREVIEW (CLEAN COMPACT FORMAT) */}
          {/* ========================================================================= */}
          {activeTab === 'view' && (
            <div className="space-y-4">
              
              {/* Official Tax Invoice Document Container */}
              <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xs">
                
                {/* Company Header */}
                <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800 space-y-1">
                  <h1 className="text-lg sm:text-xl font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight">
                    {settings.companyName}
                  </h1>
                  <p className="text-xs text-slate-500">
                    {settings.address.street}, {settings.address.municipality}, {settings.address.district}
                  </p>
                  <p className="text-2xs text-slate-500 font-mono">
                    Tel: {settings.phone || settings.mobile} {settings.email ? `| Email: ${settings.email}` : ''}
                  </p>
                  <div className="pt-1 flex items-center justify-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      PAN / VAT No: {settings.panNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded font-bold text-2xs uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      TAX INVOICE
                    </span>
                  </div>
                </div>

                {/* Complete Buyer & Invoice Meta Matrix (Two Columns) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                  
                  {/* Left Column: Buyer / Customer Details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-3xs tracking-wider border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Buyer / Customer Details</span>
                    </div>
                    
                    <div>
                      <span className="text-3xs text-slate-400 block font-medium">Name:</span>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {invoice.customerName}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-2xs">
                      <div>
                        <span className="text-3xs text-slate-400 block font-medium">Buyer PAN / VAT:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {invoice.customerPanVat || 'Counter Sale (Personal)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-3xs text-slate-400 block font-medium">Phone / Mobile:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {invoice.customerPhone || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-3xs text-slate-400 block font-medium">Address:</span>
                      <p className="text-2xs text-slate-700 dark:text-slate-300 flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span>{resolvedAddress}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Invoice & Billing Meta */}
                  <div className="space-y-1.5 md:border-l md:border-slate-200/60 md:dark:border-slate-700/60 md:pl-4">
                    <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-3xs tracking-wider border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Invoice Details</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-2xs">
                      <div>
                        <span className="text-3xs text-slate-400 block font-medium">Invoice No:</span>
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                          {invoice.invoiceNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-3xs text-slate-400 block font-medium">Fiscal Year:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                          {invoice.fiscalYear || '2082/83'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-2xs font-mono">
                      <div>
                        <span className="text-3xs text-slate-400 block font-medium font-sans">BS Date:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          {toNepaliBSDate(invoice.date)}
                        </span>
                      </div>
                      <div>
                        <span className="text-3xs text-slate-400 block font-medium font-sans">AD Date:</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {formatDateTime(invoice.date)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-2xs pt-0.5">
                      <div>
                        <span className="text-3xs text-slate-400 block font-medium">Dispatch Branch:</span>
                        <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <WarehouseIcon className="w-3 h-3 text-slate-400" />
                          <span>{invoice.warehouseName || 'Main Store'}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-3xs text-slate-400 block font-medium">Payment Mode:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {getPaymentMethodLabel(invoice.paymentMethod)}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Items Section: Clean Table Format */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[540px] sm:min-w-[600px]">
                      <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-3xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Qty</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Rate (Rs.)</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Disc</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap font-bold">Total (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {invoice.items.map((item, idx) => {
                          const isReturned = (item.returnedQuantity || 0) > 0;
                          const isFullyReturned = (item.returnedQuantity || 0) >= item.quantity;
                          return (
                            <tr key={idx} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${isFullyReturned ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''}`}>
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-2xs align-middle">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 align-middle">
                                <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs leading-snug flex items-center gap-1.5 flex-wrap">
                                  <span>{item.productName}</span>
                                  {isReturned && (
                                    <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-sans">
                                      Returned: {item.returnedQuantity} {item.selectedUnit}
                                    </span>
                                  )}
                                </div>
                                {item.sku && (
                                  <div className="text-3xs text-slate-400 font-mono mt-0.5">
                                    SKU: {item.sku}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs text-slate-800 dark:text-slate-200 align-middle">
                                <span className="font-bold">{item.quantity}</span>{' '}
                                <span className="text-3xs text-slate-500 font-sans">{item.selectedUnit}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs text-slate-800 dark:text-slate-200 align-middle">
                                {formatNPR(item.unitPrice)}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs text-slate-500 dark:text-slate-400 align-middle">
                                {item.discountPercent > 0 ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                    {item.discountPercent}%
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-900 dark:text-slate-100 align-middle">
                                {formatNPR(item.lineTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Amount In Words & Financial Calculation Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  
                  {/* Left Side: In Words & Notes */}
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                      <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                        Amount in Words
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs mt-1 italic">
                        {numberToWordsNPR(invoice.grandTotal)}
                      </p>
                    </div>

                    {invoice.notes && (
                      <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-2xs text-slate-600 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Remarks:</span>
                        {invoice.notes}
                      </div>
                    )}
                  </div>

                  {/* Right Side: Tax & Grand Total Breakdown */}
                  <div className="space-y-1.5 text-xs font-mono bg-slate-50/50 dark:bg-slate-800/30 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 font-sans">Subtotal (Taxable Amount):</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {formatNPR(invoice.taxableAmount ?? invoice.subtotal ?? 0)}
                      </span>
                    </div>

                    {invoice.discountAmount > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60 text-rose-600 dark:text-rose-400">
                        <span className="font-sans">Total Discount:</span>
                        <span>-{formatNPR(invoice.discountAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 font-sans">VAT (13%):</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {formatNPR(invoice.taxAmount || 0)}
                      </span>
                    </div>

                    <div className="flex justify-between py-2 border-b-2 border-slate-300 dark:border-slate-600 text-sm font-bold">
                      <span className="font-sans">Grand Total:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-black text-base">
                        {formatNPR(invoice.grandTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="font-sans">Paid Amount ({getPaymentMethodLabel(invoice.paymentMethod)}):</span>
                      <span>{formatNPR(invoice.paidAmount || 0)}</span>
                    </div>

                    {remainingDue > 0 ? (
                      <div className="flex justify-between py-1 text-amber-600 dark:text-amber-400 font-bold text-xs">
                        <span className="font-sans">Balance Due:</span>
                        <span>{formatNPR(remainingDue)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400 font-medium text-3xs font-sans">
                        <span>Payment Status:</span>
                        <span>Fully Settled ✓</span>
                      </div>
                    )}
                  </div>

                </div>

                {/* Clean Minimalist Footer */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5 text-3xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Prepared by:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {invoice.salespersonName || 'Admin'}
                    </span>
                  </div>
                  <span className="text-3xs text-slate-400 truncate whitespace-nowrap">
                    {settings.companyName}
                  </span>
                </div>

              </div>

              {/* Single Clean Footer Action Button */}
              {remainingDue > 0 && (
                <div className="pt-1">
                  <button
                    onClick={() => setActiveTab('settle')}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Settle Remaining Balance</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SETTLE DUE PAYMENT (CLEAN FOCUSED FORM) */}
          {/* ========================================================================= */}
          {activeTab === 'settle' && (
            <form onSubmit={handleSettleSubmit} className="space-y-3.5 max-w-xl mx-auto">
              
              {settleSuccessMsg && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{settleSuccessMsg}</span>
                </div>
              )}

              {/* 3-Row Financial Summary Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-200/60 dark:divide-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Total Bill</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatNPR(invoice.grandTotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Paid So Far</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNPR(invoice.paidAmount || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400">Balance Due</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {formatNPR(remainingDue)}
                  </span>
                </div>
              </div>

              {remainingDue <= 0 ? (
                <div className="p-5 text-center text-slate-500 space-y-1.5 bg-slate-50/60 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Invoice is fully settled
                  </p>
                  <p className="text-3xs text-slate-400">
                    No outstanding balance is pending on {invoice.invoiceNumber}.
                  </p>
                </div>
              ) : (
                <>
                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <label className="text-2xs font-bold text-slate-700 dark:text-slate-300 block">
                      Payment Amount (Rs.) *
                    </label>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                        Rs.
                      </span>
                      <input
                        type="number"
                        min="1"
                        max={remainingDue}
                        value={settleAmount || ''}
                        onChange={e => setSettleAmount(Math.min(remainingDue, Math.max(0, Number(e.target.value))))}
                        placeholder="Enter amount"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Payment Channel Chips (2-col on mobile, 4-col on desktop) */}
                  <div className="space-y-1.5">
                    <label className="text-2xs font-bold text-slate-700 dark:text-slate-300 block">
                      Payment Channel
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { id: 'cash', label: 'Cash', icon: DollarSign },
                        { id: 'fonepay', label: 'Fonepay QR', icon: QrCode },
                        { id: 'esewa', label: 'eSewa', icon: Wallet },
                        { id: 'khalti', label: 'Khalti', icon: Wallet },
                        { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
                        { id: 'connectips', label: 'ConnectIPS', icon: CreditCard },
                        { id: 'cheque', label: 'Cheque', icon: FileText },
                      ].map(method => {
                        const Icon = method.icon;
                        const isSelected = settleMethod === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setSettleMethod(method.id as SaleInvoice['paymentMethod'])}
                            className={`px-2.5 py-2 rounded-lg text-left border flex items-center gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold shadow-2xs'
                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                            <span className="text-xs font-medium whitespace-nowrap">{method.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reference & Remarks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <div className="space-y-1">
                      <label className="text-3xs font-medium text-slate-500 dark:text-slate-400">
                        Transaction Ref / ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={settleRef}
                        onChange={e => setSettleRef(e.target.value)}
                        placeholder="e.g. Fonepay ID / Cheque No"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-3xs font-medium text-slate-500 dark:text-slate-400">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={settleNotes}
                        onChange={e => setSettleNotes(e.target.value)}
                        placeholder="e.g. Received at counter"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSettling || settleAmount <= 0}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
                    >
                      {isSettling ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Record Payment of {formatNPR(settleAmount || 0)}</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: EDIT INVOICE & PROCESS PRODUCT RETURNS */}
          {/* ========================================================================= */}
          {activeTab === 'edit' && (
            <div className="space-y-5">
              
              {/* Notifications */}
              {returnSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2 font-medium animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{returnSuccessMsg}</span>
                </div>
              )}

              {returnErrorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs flex items-center gap-2 font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{returnErrorMsg}</span>
                </div>
              )}

              {editSuccessMsg && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 rounded-xl text-xs flex items-center gap-2 font-medium animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              {/* ========================================================= */}
              {/* SECTION A: PRODUCT RETURNS (सामान फिर्ता) */}
              {/* ========================================================= */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                
                {/* Section Header */}
                <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/70 border border-rose-200/60 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Billed Items & Product Returns (सामान फिर्ता)
                      </h4>
                      <p className="text-3xs text-slate-500 dark:text-slate-400">
                        Select an item below to process customer return, restock into warehouse, and issue refund
                      </p>
                    </div>
                  </div>
                  {invoice.status === 'returned' && (
                    <span className="text-3xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800 shrink-0">
                      All Items Returned
                    </span>
                  )}
                </div>

                {/* Items List & Form */}
                <div className="p-3 sm:p-4 space-y-3.5">
                  
                  {/* Clean Tax-Invoice Style Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[580px] sm:min-w-[640px]">
                        <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-3xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-3">Item Description</th>
                            <th className="py-2.5 px-3 text-right whitespace-nowrap">Billed Qty</th>
                            <th className="py-2.5 px-3 text-right whitespace-nowrap">Rate (Rs.)</th>
                            <th className="py-2.5 px-3 text-right whitespace-nowrap font-bold">Total (Rs.)</th>
                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Return Status</th>
                            <th className="py-2.5 px-3 text-right whitespace-nowrap">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {invoice.items.map((item, idx) => {
                            const alreadyReturned = Number(item.returnedQuantity || 0);
                            const available = Math.max(0, item.quantity - alreadyReturned);
                            const isFullyReturned = available <= 0;
                            const isCurrentlySelected = returnItemTarget?.productId === item.productId || (returnItemTarget?.productName === item.productName && !returnItemTarget?.productId);

                            return (
                              <tr 
                                key={idx} 
                                className={`transition-colors ${
                                  isCurrentlySelected 
                                    ? 'bg-rose-50/80 dark:bg-rose-950/40' 
                                    : isFullyReturned 
                                    ? 'bg-rose-50/20 dark:bg-rose-950/10' 
                                    : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-2xs align-middle">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 align-middle">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs leading-snug flex items-center gap-1.5 flex-wrap">
                                    <span>{item.productName}</span>
                                    {alreadyReturned > 0 && (
                                      <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-sans">
                                        Returned: {alreadyReturned} {item.selectedUnit}
                                      </span>
                                    )}
                                  </div>
                                  {item.sku && (
                                    <div className="text-3xs text-slate-400 font-mono mt-0.5">
                                      SKU: {item.sku}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs text-slate-800 dark:text-slate-200 align-middle">
                                  <span className="font-bold">{item.quantity}</span>{' '}
                                  <span className="text-3xs text-slate-500 font-sans">{item.selectedUnit}</span>
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs text-slate-800 dark:text-slate-200 align-middle">
                                  {formatNPR(item.unitPrice)}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-900 dark:text-slate-100 align-middle">
                                  {formatNPR(item.lineTotal)}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                                  {alreadyReturned > 0 ? (
                                    <span className={`px-2 py-0.5 rounded text-3xs font-semibold inline-block ${
                                      isFullyReturned
                                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                    }`}>
                                      {isFullyReturned ? 'Fully Returned' : `${alreadyReturned}/${item.quantity} Returned`}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-3xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40">
                                      {item.quantity} Available
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap align-middle">
                                  {isFullyReturned ? (
                                    <span className="inline-flex items-center gap-1 text-3xs font-medium text-slate-400 px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                                      <CheckCircle2 className="w-3 h-3 text-rose-500" /> Done
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReturnForm(item)}
                                      className={`px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                                        isCurrentlySelected
                                          ? 'bg-rose-600 text-white ring-2 ring-rose-500/40'
                                          : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80'
                                      }`}
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>{isCurrentlySelected ? 'Selected' : 'Return'}</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ACTIVE RETURN FORM CARD */}
                  {returnItemTarget && (() => {
                    const alreadyReturned = Number(returnItemTarget.returnedQuantity || 0);
                    const maxAvailable = Math.max(1, returnItemTarget.quantity - alreadyReturned);
                    const effectiveRate = Math.round(returnItemTarget.lineTotal / returnItemTarget.quantity);
                    const totalRefund = Math.round(effectiveRate * returnQty);
                    const targetProduct = products.find(p => p.id === returnItemTarget.productId || (p.name && p.name.toLowerCase() === returnItemTarget.productName.toLowerCase()));
                    const addedBaseQty = returnQty * (returnItemTarget.conversionFactor || 1);

                    return (
                      <form 
                        onSubmit={handleProcessReturn}
                        className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 shadow-xs"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                Return Item: {returnItemTarget.productName}
                              </span>
                              <span className="text-3xs font-mono text-slate-600 dark:text-slate-400">
                                (Billed: {returnItemTarget.quantity} • Available: <strong className="text-rose-600 dark:text-rose-400">{maxAvailable} {returnItemTarget.selectedUnit}</strong>)
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReturnItemTarget(null)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Compact 4-Column Controls Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          
                          {/* 1. Return Qty Stepper */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-3xs font-semibold text-slate-700 dark:text-slate-300">
                              <span>Return Qty ({returnItemTarget.selectedUnit})</span>
                              {maxAvailable > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setReturnQty(maxAvailable)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono"
                                >
                                  Max ({maxAvailable})
                                </button>
                              )}
                            </div>
                            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-900 h-8">
                              <button
                                type="button"
                                onClick={() => setReturnQty(prev => Math.max(1, prev - 1))}
                                disabled={returnQty <= 1}
                                className="w-8 h-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={maxAvailable}
                                value={returnQty}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  if (val > maxAvailable) setReturnQty(maxAvailable);
                                  else if (val < 1) setReturnQty(1);
                                  else setReturnQty(val);
                                }}
                                className="w-full text-center text-xs font-mono font-bold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setReturnQty(prev => Math.min(maxAvailable, prev + 1))}
                                disabled={returnQty >= maxAvailable}
                                className="w-8 h-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* 2. Refund Amount Display */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-3xs font-semibold text-slate-700 dark:text-slate-300">
                              <span>Refund Amount</span>
                              <span className="text-slate-500 dark:text-slate-400 font-mono">@{formatNPR(effectiveRate)}</span>
                            </div>
                            <div className="h-8 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 flex items-center justify-between font-mono">
                              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                {formatNPR(totalRefund)}
                              </span>
                              <span className="text-3xs text-rose-600 dark:text-rose-400 font-sans">NPR</span>
                            </div>
                          </div>

                          {/* 3. Reason */}
                          <div className="space-y-1">
                            <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                              Return Reason
                            </label>
                            <select
                              value={returnReason}
                              onChange={e => setReturnReason(e.target.value as SalesReturn['items'][0]['reason'])}
                              className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                            >
                              <option value="customer_choice">Customer Choice (रोजाइ)</option>
                              <option value="damaged">Damaged in Transit (ढुवानीमा क्षति)</option>
                              <option value="defective">Defective / Faulty (खराबी)</option>
                              <option value="wrong_item">Wrong Item Delivered (गलत सामान)</option>
                              <option value="exchange">Exchange (साटासाट)</option>
                              <option value="other">Other (अन्य)</option>
                            </select>
                          </div>

                          {/* 4. Refund Method */}
                          <div className="space-y-1">
                            <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                              Settlement Method
                            </label>
                            <select
                              value={returnRefundMethod}
                              onChange={e => setReturnRefundMethod(e.target.value as SalesReturn['refundMethod'])}
                              className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                            >
                              {remainingDue > 0 && (
                                <option value="deduct_due">Deduct Due ({formatNPR(remainingDue)})</option>
                              )}
                              <option value="cash">Instant Cash (नगद फिर्ता)</option>
                              <option value="credit_note">Credit Note / Khata (खातामा जम्मा)</option>
                              <option value="bank_transfer">Bank / Digital Transfer</option>
                            </select>
                          </div>

                        </div>

                        {/* Restock & Remarks Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={returnRestock}
                              onChange={e => setReturnRestock(e.target.checked)}
                              className="w-3.5 h-3.5 text-rose-600 rounded border-slate-300 dark:border-slate-600 focus:ring-rose-500"
                            />
                            <span className="text-2xs font-medium text-slate-800 dark:text-slate-200">
                              Restock to warehouse
                            </span>
                            {returnRestock && targetProduct && (
                              <span className="text-3xs font-mono text-emerald-600 dark:text-emerald-400">
                                ({targetProduct.currentStock} → {targetProduct.currentStock + addedBaseQty} {targetProduct.baseUnitSymbol})
                              </span>
                            )}
                          </label>

                          <div className="flex-1 max-w-xs">
                            <input
                              type="text"
                              value={returnNotes}
                              onChange={e => setReturnNotes(e.target.value)}
                              placeholder="Notes (optional)..."
                              className="w-full h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-2xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                          <button
                            type="submit"
                            disabled={isProcessingReturn}
                            className="flex-1 h-9 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isProcessingReturn ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Processing...</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Confirm Return</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setReturnItemTarget(null)}
                            className="h-9 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                        </div>

                      </form>
                    );
                  })()}

                  {/* Past Return Vouchers History for this invoice */}
                  {pastReturns.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <History className="w-3.5 h-3.5 text-slate-500" />
                        <span>Previous Return Vouchers ({pastReturns.length})</span>
                      </div>

                      <div className="space-y-2">
                        {pastReturns.map((ret, rIdx) => (
                          <div 
                            key={rIdx}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between gap-2 flex-wrap"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                                  {ret.returnNumber}
                                </span>
                                <span className="text-3xs font-mono text-slate-500">
                                  {toNepaliBSDate(ret.date)} • {formatDate(ret.date)}
                                </span>
                                <span className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-3xs font-semibold rounded capitalize">
                                  {ret.refundMethod.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-3xs text-slate-600 dark:text-slate-400">
                                Returned:{' '}
                                {ret.items.map(it => `${it.productName} (${it.returnedQuantity})`).join(', ')}
                                {ret.notes ? ` • Note: ${ret.notes}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                                -{formatNPR(ret.totalRefundAmount)}
                              </span>
                              <span className="block text-3xs text-slate-400">
                                By {ret.processedBy}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </div>

              {/* ========================================================= */}
              {/* SECTION B: EDIT INVOICE & CUSTOMER METADATA (COLLAPSIBLE) */}
              {/* ========================================================= */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs transition-all">
                
                {/* Collapsible Accordion Header */}
                <button
                  type="button"
                  onClick={() => setIsCustomerDetailsOpen(prev => !prev)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100/90 dark:hover:bg-slate-800/90 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Edit3 className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 shrink-0">
                        Invoice & Customer Details
                      </span>
                      <span className="text-3xs font-medium px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate max-w-[180px] sm:max-w-xs">
                        {invoice.customerName || 'Walk-in Customer'} {invoice.customerPanVat ? `• PAN: ${invoice.customerPanVat}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-3xs font-medium text-slate-400 dark:text-slate-500 hidden sm:inline">
                      {isCustomerDetailsOpen ? 'Click to collapse' : 'Click to edit'}
                    </span>
                    <div className="w-5 h-5 rounded flex items-center justify-center text-slate-400">
                      {isCustomerDetailsOpen ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Collapsible Form Body */}
                {isCustomerDetailsOpen && (
                  <form onSubmit={handleEditSubmit} className="p-3.5 sm:p-4 space-y-3 animate-in fade-in duration-150">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    
                    {/* Customer Name / Selection */}
                    <div className="space-y-1">
                      <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                        Customer Name *
                      </label>
                      <input
                        type="text"
                        list="customer-list-edit"
                        value={editCustomerName}
                        onChange={e => {
                          const val = e.target.value;
                          setEditCustomerName(val);
                          const matched = customers.find(c => c.name.toLowerCase() === val.toLowerCase());
                          if (matched) {
                            if (matched.phone) setEditCustomerPhone(matched.phone);
                            if (matched.panVatNumber) setEditCustomerPan(matched.panVatNumber);
                            if (matched.address) {
                              setEditCustomerAddress(`${matched.address.street || ''}, ${matched.address.municipality || ''}`);
                            }
                          }
                        }}
                        required
                        placeholder="Walk-in Customer / Name"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      <datalist id="customer-list-edit">
                        <option value="Walk-in Customer" />
                        <option value="Retail Customer" />
                        {customers.map(c => (
                          <option key={c.id} value={c.name}>
                            {c.phone ? `Phone: ${c.phone}` : ''} {c.panVatNumber ? `PAN: ${c.panVatNumber}` : ''}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    {/* Customer Phone */}
                    <div className="space-y-1">
                      <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                        Phone / Mobile
                      </label>
                      <input
                        type="tel"
                        value={editCustomerPhone}
                        onChange={e => setEditCustomerPhone(e.target.value)}
                        placeholder="98XXXXXXXX"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Buyer PAN / VAT */}
                    <div className="space-y-1">
                      <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                        Buyer PAN / VAT (9 Digits)
                      </label>
                      <input
                        type="text"
                        value={editCustomerPan}
                        onChange={e => setEditCustomerPan(e.target.value)}
                        placeholder="e.g. 601234567"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Customer Address */}
                    <div className="space-y-1">
                      <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                        Buyer Address
                      </label>
                      <input
                        type="text"
                        value={editCustomerAddress}
                        onChange={e => setEditCustomerAddress(e.target.value)}
                        placeholder="e.g. Biratnagar-4, Morang"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Salesperson */}
                    <div className="space-y-1">
                      <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                        Billed By
                      </label>
                      <input
                        type="text"
                        value={editSalesperson}
                        onChange={e => setEditSalesperson(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1">
                      <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                        Payment Method
                      </label>
                      <select
                        value={editPaymentMethod}
                        onChange={e => setEditPaymentMethod(e.target.value as SaleInvoice['paymentMethod'])}
                        className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="cash">Cash (नगद)</option>
                        <option value="fonepay">Fonepay QR</option>
                        <option value="esewa">eSewa</option>
                        <option value="khalti">Khalti</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="connectips">ConnectIPS</option>
                        <option value="cheque">Cheque</option>
                        <option value="credit">Credit Account</option>
                        <option value="partial">Partial / Split</option>
                      </select>
                    </div>

                    {/* Payment Status */}
                    <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                      <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                        Payment Status
                      </label>
                      <select
                        value={editPaymentStatus}
                        onChange={e => setEditPaymentStatus(e.target.value as SaleInvoice['paymentStatus'])}
                        className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="paid">Paid (पूर्ण भुक्तानी)</option>
                        <option value="partial">Partial (आंशिक भुक्तानी)</option>
                        <option value="unpaid">Unpaid / Due (बाँकी)</option>
                        <option value="overdue">Overdue (म्याद नाघेको)</option>
                      </select>
                    </div>

                  </div>

                  {/* Notes / Remarks */}
                  <div className="space-y-1">
                    <label className="block text-3xs font-semibold text-slate-700 dark:text-slate-300">
                      Bill Remarks / Terms
                    </label>
                    <input
                      type="text"
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder="Terms, delivery instructions, notes..."
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={isSavingEdit}
                      className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                    >
                      {isSavingEdit ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Invoice Details</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('view')}
                      className="h-9 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    >
                      Close
                    </button>
                  </div>

                </form>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
