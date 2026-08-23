import React from 'react';
import { 
  FileText, Printer, X, CheckCircle2, Clock, 
  AlertCircle, Building2, Phone, MapPin, Calendar, CreditCard
} from 'lucide-react';
import { SaleInvoice } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';

interface InvoiceDetailModalProps {
  invoice: SaleInvoice | null;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, onClose }) => {
  const { settings } = useApp();

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
      case 'cash': return 'Cash';
      case 'credit': return 'Credit (खाता)';
      case 'cheque': return 'Cheque';
      default: return method?.replace('_', ' ') || 'Cash';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                Tax Invoice {invoice.invoiceNumber}
              </h3>
              <p className="text-3xs text-slate-500 font-mono">
                {toNepaliBSDate(invoice.date)} ({formatDate(invoice.date)})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Tax Invoice</span>
              <span className="sm:hidden">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Invoice Sheet */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Company Banner (Bill Head) */}
          <div className="text-center pb-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
            <h2 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight">
              {settings.companyName}
            </h2>
            <p className="text-2xs text-slate-500 max-w-md mx-auto">
              {settings.address.street}, {settings.address.municipality}, {settings.address.district} | Tel: {settings.phone || settings.mobile}
            </p>
            <p className="text-2xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
              PAN / VAT: {settings.panNumber}
            </p>
            <div className="inline-block px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-3xs uppercase tracking-widest text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mt-1">
              TAX INVOICE
            </div>
          </div>

          {/* Customer & Meta Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <div>
              <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider block">Buyer Details</span>
              <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {invoice.customerName}
              </p>
              {invoice.customerPhone && (
                <p className="text-3xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                  Phone: {invoice.customerPhone}
                </p>
              )}
              <p className="text-3xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                Buyer PAN: <span className="font-semibold text-slate-800 dark:text-slate-200">{invoice.customerPanVat || 'Counter / Unregistered'}</span>
              </p>
            </div>

            <div className="sm:text-right font-mono text-3xs space-y-0.5">
              <span className="font-sans font-semibold text-slate-400 uppercase tracking-wider block">Invoice Meta</span>
              <p className="text-slate-800 dark:text-slate-200">
                Invoice No: <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">{invoice.invoiceNumber}</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Date: {toNepaliBSDate(invoice.date)} ({formatDate(invoice.date)})
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Payment: <span className="font-semibold text-slate-800 dark:text-slate-200">{getPaymentMethodLabel(invoice.paymentMethod)}</span>
              </p>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded text-3xs font-bold uppercase ${
                  invoice.paymentStatus === 'paid' 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : invoice.paymentStatus === 'partial'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  Status: {invoice.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Item Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Disc</th>
                    <th className="px-3 py-2 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-2xs">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-sans font-medium text-slate-900 dark:text-slate-100">
                        {item.productName}
                        <span className="block text-3xs text-slate-400 font-mono">SKU: {item.sku}</span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {item.quantity} {item.selectedUnit}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatNPR(item.unitPrice)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                        {item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatNPR(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Calculation Summary */}
          <div className="flex justify-end pt-1">
            <div className="w-full sm:w-72 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-sans">Subtotal (Taxable):</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatNPR(invoice.taxableAmount ?? invoice.subtotal ?? 0)}
                </span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-400">
                  <span className="font-sans">Discount:</span>
                  <span>-{formatNPR(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-sans">VAT (13%):</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {formatNPR(invoice.taxAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b-2 border-slate-300 dark:border-slate-700 text-sm font-bold">
                <span className="font-sans">Grand Total:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">
                  {formatNPR(invoice.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="font-sans">Paid Amount ({getPaymentMethodLabel(invoice.paymentMethod)}):</span>
                <span>{formatNPR(invoice.paidAmount || 0)}</span>
              </div>
              {invoice.dueAmount > 0 && (
                <div className="flex justify-between py-1 text-amber-600 dark:text-amber-400 font-bold">
                  <span className="font-sans">Balance Due (बाँकी):</span>
                  <span>{formatNPR(invoice.dueAmount)}</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
