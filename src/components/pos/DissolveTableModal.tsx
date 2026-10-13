import React, { useState, useEffect } from 'react';
import { X, LogOut, AlertTriangle, CheckCircle2, RotateCcw, User, ShieldCheck } from 'lucide-react';
import { DiningTable, KitchenOrderTicket } from '../../types';

interface DissolveTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: DiningTable;
  tickets: KitchenOrderTicket[];
  onConfirmDissolve: (reason: string, staffName?: string) => Promise<void>;
  activeStaffName?: string;
}

const COMMON_REASONS = [
  'All orders cancelled by customer',
  'Customer departed before serving',
  'Order punched in error / wrong table',
  'Kitchen / bar out of ingredients',
  'Party left due to emergency',
  'Guest requested order cancellation'
];

export const DissolveTableModal: React.FC<DissolveTableModalProps> = ({
  isOpen,
  onClose,
  table,
  tickets,
  onConfirmDissolve,
  activeStaffName
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(COMMON_REASONS[0]);
      setCustomReason('');
      setIsSubmitting(false);
      setErrorMsg('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  if (!isOpen) return null;

  // Compute ticket summary for this table
  const allItems = tickets.flatMap(t => t.items || []);
  const cancelledItemsCount = allItems.filter(i => i.status === 'cancelled').reduce((sum, i) => sum + i.quantity, 0);
  const activeItemsCount = allItems.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + i.quantity, 0);
  const totalItemsCount = allItems.reduce((sum, i) => sum + i.quantity, 0);
  const areAllCancelled = activeItemsCount === 0 && tickets.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const finalReason = customReason.trim() || selectedReason;
    if (!finalReason) {
      setErrorMsg('Please select or specify a reason for dissolving the table.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onConfirmDissolve(finalReason, activeStaffName);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dissolve table. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dissolve-table-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 id="dissolve-table-title" className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Dissolve Table {table.tableNumber}</span>
                <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  Release Table
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {table.floorName || 'Floor'} • Capacity: {table.capacity || 4} guests
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Situation Notice */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Current Table Order Status</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-3xs text-slate-400 block font-semibold">Total Orders Fired</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} ({totalItemsCount} items)
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-3xs text-slate-400 block font-semibold">Cancelled Orders</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                  {cancelledItemsCount} {cancelledItemsCount === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            {areAllCancelled ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>All fired orders are already cancelled. Dissolving will clear the table and make it immediately available for new customers.</span>
              </div>
            ) : activeItemsCount > 0 ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Notice: {activeItemsCount} active item(s) remain. Dissolving will cancel all remaining items and release the table.</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                This table has no active running balance. Releasing it will make it ready for new customers.
              </div>
            )}
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Reason for Dissolving Table <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((reason) => {
                const isSelected = selectedReason === reason && !customReason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setSelectedReason(reason);
                      setCustomReason('');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>

            {/* Custom Reason Input */}
            <div className="pt-1">
              <input
                type="text"
                placeholder="Or specify custom reason / note..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Staff Info Note */}
          <div className="flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Operator: <strong className="text-slate-800 dark:text-slate-200">{activeStaffName || 'Staff Member'}</strong></span>
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audit Logged</span>
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                isSubmitting
                  ? 'bg-amber-400 cursor-wait'
                  : 'bg-amber-600 hover:bg-amber-700 active:scale-98 shadow-amber-600/25'
              }`}
            >
              <LogOut className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>{isSubmitting ? 'Dissolving Table...' : `Dissolve & Release Table ${table.tableNumber}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
