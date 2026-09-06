import React, { useState, useMemo } from 'react';
import { 
  Building2, Plus, Search, Phone, Mail, MapPin, 
  CreditCard, DollarSign, FileText, ChevronRight, X, User
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Supplier } from '../../types';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';
import { QuickAddSupplierModal } from './QuickAddSupplierModal';
import { SupplierLedgerModal } from '../common/SupplierLedgerModal';

export const SuppliersView: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, purchases } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNotes, setPayNotes] = useState('');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.panVatNumber.includes(searchQuery) ||
      s.phone.includes(searchQuery)
    );
  }, [suppliers, searchQuery]);

  const supplierPurchases = useMemo(() => {
    if (!selectedSupplier) return [];
    return purchases.filter(p => p.supplierId === selectedSupplier.id);
  }, [purchases, selectedSupplier]);

  const totalPayables = suppliers.reduce((acc, s) => acc + Math.max(0, s.currentBalance || 0), 0);

  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || payAmount <= 0) return;

    const newBalance = Math.max(0, (selectedSupplier.currentBalance || 0) - payAmount);
    await updateSupplier(selectedSupplier.id, {
      currentBalance: newBalance
    });

    setSelectedSupplier({
      ...selectedSupplier,
      currentBalance: newBalance
    });

    setShowPayModal(false);
    setPayAmount(0);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            Suppliers & Vendor Payables (सप्लायर्स तथा साहु हिसाब)
          </h1>
          <p className="text-2xs text-slate-500">
            Total Outstanding Payables: <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">{formatNPR(totalPayables)}</span>
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs"
        >
          <Plus className="w-4 h-4" /> Add Supplier (नयाँ सप्लायर)
        </button>
      </div>

      {/* Grid: Supplier Table + Details Ledger Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Supplier List (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by company name, contact, PAN, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Supplier Firm</th>
                    <th className="px-4 py-3">Contact & PAN</th>
                    <th className="px-4 py-3 text-right">Payable Balance (साहु बाँकी)</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSuppliers.map(s => {
                    const isSelected = selectedSupplier?.id === s.id;
                    return (
                      <tr 
                        key={s.id} 
                        onClick={() => {
                          setSelectedSupplier(s);
                          setShowLedgerModal(true);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600' 
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{s.companyName}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-3xs text-slate-500">{s.name}</span>
                            {s.additionalContacts && s.additionalContacts.length > 0 && (
                              <span className="text-4xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold px-1.5 py-0.2 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                                +{s.additionalContacts.length} contact{s.additionalContacts.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-2xs">
                          <span className="block text-slate-700 dark:text-slate-300">{s.phone}</span>
                          <span className="text-3xs text-slate-400">{s.panVatType || 'PAN'}: {s.panVatNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatNPR(s.currentBalance)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSupplier(s);
                                setShowLedgerModal(true);
                              }}
                              className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-600 active:bg-indigo-700 text-indigo-700 hover:text-white dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white border border-indigo-200/80 hover:border-indigo-600 dark:border-indigo-800 text-3xs font-bold transition-all duration-150 active:scale-95 shadow-2xs hover:shadow-xs cursor-pointer"
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

        {/* Right Column: Supplier Detail Profile & Statement (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          {selectedSupplier ? (
            <div className="space-y-4">
              
              {/* Supplier Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedSupplier.companyName}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{selectedSupplier.name}</p>
                  <p className="text-2xs text-slate-500 font-mono mt-1">
                    {typeof selectedSupplier.address === 'string'
                      ? selectedSupplier.address
                      : [selectedSupplier.address?.street, selectedSupplier.address?.district].filter(Boolean).join(', ')} | Tel: {selectedSupplier.phone}
                  </p>
                  {selectedSupplier.additionalContacts && selectedSupplier.additionalContacts.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selectedSupplier.additionalContacts.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-3xs text-slate-700 dark:text-slate-300">
                          <User className="w-2.5 h-2.5 text-slate-400" />
                          <span className="font-semibold">{c.name}</span>
                          {c.phone && <span className="font-mono text-indigo-600 dark:text-indigo-400">({c.phone})</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-2xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {selectedSupplier.panVatType || 'PAN'}: {selectedSupplier.panVatNumber}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLedgerModal(true)}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 active:bg-indigo-700 text-indigo-700 hover:text-white dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white border border-indigo-200/80 hover:border-indigo-600 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> Full Ledger
                  </button>

                  <button
                    onClick={() => {
                      setPayAmount(selectedSupplier.currentBalance);
                      setShowPayModal(true);
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Pay Supplier
                  </button>
                </div>
              </div>

              {/* Outstanding Payable Widget */}
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
                <div>
                  <p className="text-3xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                    Outstanding Payable (हामीले तिर्नुपर्ने रकम)
                  </p>
                  <p className="text-xl font-bold font-mono text-rose-900 dark:text-rose-100 mt-0.5">
                    {formatNPR(selectedSupplier.currentBalance)}
                  </p>
                </div>
                {selectedSupplier.bankDetails && (
                  <div className="text-right text-3xs text-rose-800 dark:text-rose-300 font-mono">
                    <p className="font-bold">{selectedSupplier.bankDetails.bankName}</p>
                    <p>A/C: {selectedSupplier.bankDetails.accountNumber}</p>
                  </div>
                )}
              </div>

              {/* Purchase Bills Statement History */}
              <div className="space-y-2">
                <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                  Purchase Bills Statement ({supplierPurchases.length})
                </h4>

                {supplierPurchases.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No purchase bills recorded for this supplier yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                    {supplierPurchases.map(pur => (
                      <div key={pur.id} className="py-2 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 font-sans">{pur.purchaseNumber}</span>
                          <span className="block text-3xs text-slate-400">{formatDate(pur.date)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{formatNPR(pur.grandTotal)}</span>
                          <span className="block text-3xs text-slate-400">
                            {pur.dueAmount > 0 ? `Payable: ${formatNPR(pur.dueAmount)}` : 'Cleared'}
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
              <Building2 className="w-12 h-12 stroke-1 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">No Supplier Selected</p>
              <p className="text-2xs text-slate-400 mt-1">Select a manufacturer or distributor from the list to view bank details and billings.</p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: ADD SUPPLIER */}
      <QuickAddSupplierModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSupplierCreated={(newSup) => {
          setSelectedSupplier(newSup);
        }}
      />

      {/* MODAL: PAY SUPPLIER */}
      {showPayModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Pay Supplier (साहु भुक्तानी)
            </h3>
            
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Supplier: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedSupplier.companyName}</span>
            </p>

            <form onSubmit={handleRecordSupplierPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Payment Amount to Settle (Rs.) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedSupplier.currentBalance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-rose-600 text-base"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cheque / Bank Transfer Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Nabil Cheque # 001928"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg font-semibold"
                >
                  Confirm Supplier Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUPPLIER LEDGER STATEMENT (साहु खाता विवरण) */}
      {showLedgerModal && selectedSupplier && (
        <SupplierLedgerModal
          supplier={selectedSupplier}
          onClose={() => setShowLedgerModal(false)}
        />
      )}

    </div>
  );
};
