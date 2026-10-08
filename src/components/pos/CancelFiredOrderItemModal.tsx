import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert, Trash2, CheckCircle2 } from 'lucide-react';
import { KitchenOrderTicket, KOTItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR } from '../../utils/nepalFormatters';

interface CancelFiredOrderItemModalProps {
  isOpen: boolean;
  ticket: KitchenOrderTicket | null;
  item: KOTItem | null;
  tableNumber?: string;
  onClose: () => void;
  onConfirm: (quantityToCancel: number, reason: string, staffName: string) => Promise<void>;
}

export const CancelFiredOrderItemModal: React.FC<CancelFiredOrderItemModalProps> = ({
  isOpen,
  ticket,
  item,
  tableNumber,
  onClose,
  onConfirm
}) => {
  const { staffMembers, activePOSStaff, currentUser } = useApp();

  const [quantityToCancel, setQuantityToCancel] = useState<number>(1);
  const [reason, setReason] = useState<string>('Guest changed mind');
  const [customReason, setCustomReason] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state whenever modal opens with a new item
  React.useEffect(() => {
    if (item) {
      setQuantityToCancel(item.quantity);
      setReason('Guest changed mind');
      setCustomReason('');
      setErrorMessage(null);
      setIsSubmitting(false);
      // Pre-fill PIN if active POS staff has one
      if (activePOSStaff?.pin) {
        setPinInput(activePOSStaff.pin);
      } else {
        setPinInput('');
      }
    }
  }, [item, activePOSStaff]);

  if (!isOpen || !ticket || !item) return null;

  const presetReasons = [
    'Guest changed mind',
    'Kitchen delay / long wait time',
    'Wrong dish punched accidentally',
    'Out of stock in kitchen / bar',
    'Customer returned / dish issue',
    'Guest left table / cancelled bill',
    'Other reason'
  ];

  const maxQty = item.quantity;
  const stationName = ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT' ? 'Bar' : 'Kitchen';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedPin = pinInput.trim();
    let staffName = activePOSStaff?.name || currentUser.name || 'Staff';

    // If PIN is entered, verify staff member
    if (trimmedPin.length > 0) {
      const matched = staffMembers.find(s => s.pin === trimmedPin);
      if (!matched && trimmedPin !== (activePOSStaff?.pin || '')) {
        setErrorMessage('Invalid 4-digit PIN. Please re-enter.');
        return;
      }
      if (matched) {
        staffName = matched.name;
      }
    }

    const finalReason = reason === 'Other reason' 
      ? (customReason.trim() || 'Other reason') 
      : reason;

    setIsSubmitting(true);
    try {
      await onConfirm(quantityToCancel, finalReason, staffName);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cancel order item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-rose-100 dark:border-rose-950/50 bg-rose-50/80 dark:bg-rose-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span>Cancel Fired Order Item</span>
                <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 font-bold">
                  {ticket.kotNumber}
                </span>
              </h3>
              <p className="text-3xs text-slate-500 dark:text-slate-400">
                {tableNumber ? `Table ${tableNumber}` : 'Counter Order'} · Sent to {stationName}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Target Item Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {item.quantity}× {item.productName}
              </span>
              <span className="font-mono font-black text-xs text-rose-600 dark:text-rose-400">
                {formatNPR(item.quantity * item.unitPrice)}
              </span>
            </div>
            <p className="text-3xs text-slate-500">
              Unit Price: {formatNPR(item.unitPrice)} · Status: <span className="font-semibold capitalize text-amber-600 dark:text-amber-400">{item.status}</span>
            </p>
          </div>

          {/* Quantity To Cancel (if item quantity > 1) */}
          {maxQty > 1 && (
            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span>Quantity to Cancel:</span>
                <span className="font-mono text-amber-700 dark:text-amber-400">
                  {quantityToCancel} of {maxQty}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={maxQty}
                  value={quantityToCancel}
                  onChange={e => setQuantityToCancel(Number(e.target.value))}
                  className="flex-1 accent-rose-600 cursor-pointer"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setQuantityToCancel(1)}
                    className="px-2 py-1 text-3xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantityToCancel(maxQty)}
                    className="px-2 py-1 text-3xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    All ({maxQty})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reason for Cancellation */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Cancellation Reason *
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {presetReasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {reason === 'Other reason' && (
              <input
                type="text"
                required
                placeholder="Specify cancellation reason for audit trail..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="mt-2 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            )}
          </div>

          {/* Staff Identification / PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Staff PIN (4 Digits)
              </label>
              <span className="text-3xs text-slate-400">
                Staff: <span className="font-semibold text-slate-700 dark:text-slate-200">{activePOSStaff?.name || currentUser.name}</span>
              </span>
            </div>
            <input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={pinInput}
              onChange={e => {
                setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                setErrorMessage(null);
              }}
              className="w-full px-3 py-2 text-center font-mono text-base font-black tracking-widest rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {errorMessage && (
            <p className="text-2xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}

          {/* Operational Impact Notice */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50 text-3xs text-slate-500 space-y-1">
            <p className="font-bold text-slate-700 dark:text-slate-300">
              ⚡ What happens when cancelled:
            </p>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>Item is removed from table bill &amp; running subtotal instantly</li>
              <li>{stationName} KDS/BOT is notified immediately to stop preparation</li>
              <li>Cancellation event is recorded in the Staff Audit Trail</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Keep Item
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Cancelling...' : `Cancel ${quantityToCancel}x Item`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
