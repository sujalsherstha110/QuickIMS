import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle, KeyRound, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNPR } from '../../utils/nepalFormatters';

interface ItemVoidConfirmModalProps {
  isOpen: boolean;
  item: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  } | null;
  tableNumber?: string;
  onClose: () => void;
  onConfirm: (staffName: string, reason: string) => void;
}

export const ItemVoidConfirmModal: React.FC<ItemVoidConfirmModalProps> = ({
  isOpen,
  item,
  tableNumber,
  onClose,
  onConfirm
}) => {
  const { staffMembers, activePOSStaff, logStaffAction, verifyStaffPin } = useApp();
  
  const [pinInput, setPinInput] = useState<string>('');
  const [reason, setReason] = useState<string>('Guest changed mind before cooking');
  const [customReason, setCustomReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const presetReasons = [
    'Guest changed mind before cooking',
    'Wrong dish punched accidentally',
    'Customer returned dish / taste issue',
    'Out of stock in kitchen',
    'Order cancelled by table'
  ];

  const handleExecuteVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPin = pinInput.trim();
    if (trimmedPin.length !== 4) {
      setErrorMessage('Please enter your 4-digit PIN.');
      return;
    }

    // Identify staff member by entered PIN
    const matchedStaff = staffMembers.find(s => s.pin === trimmedPin);

    if (!matchedStaff) {
      setErrorMessage('Invalid PIN. Please enter your valid 4-digit staff PIN.');
      return;
    }

    if (!matchedStaff.permissions?.canVoidItems) {
      setErrorMessage(`Staff member ${matchedStaff.name} does not have Void Items permission granted.`);
      return;
    }

    const finalReason = reason === 'Other' ? customReason : reason;

    // Log the sensitive void action to the Staff Audit Trail
    await logStaffAction({
      staffId: matchedStaff.id,
      staffName: matchedStaff.name,
      staffRole: matchedStaff.role,
      actionType: 'item_void',
      targetEntityId: item.productId,
      targetEntityName: item.productName,
      details: `Voided ${item.quantity}x ${item.productName} (Total Rs. ${item.quantity * item.unitPrice}) from ${tableNumber ? `Table ${tableNumber}` : 'Current POS Order'}.`,
      reason: finalReason
    });

    onConfirm(matchedStaff.name, finalReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Confirm Item Void</h3>
              <p className="text-[11px] text-slate-500">Action will be recorded in staff audit log</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Item Summary */}
        <form onSubmit={handleExecuteVoid} className="p-6 space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-xs block">
                  {item.quantity}x {item.productName}
                </span>
                <span className="text-[11px] text-slate-500">
                  {tableNumber ? `Table: ${tableNumber}` : 'Counter Order'}
                </span>
              </div>
              <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                -{formatNPR(item.quantity * item.unitPrice)}
              </span>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Reason for Void *
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {presetReasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="Other">Other Reason (Type below)</option>
            </select>

            {reason === 'Other' && (
              <input
                type="text"
                required
                placeholder="Specify reason for audit..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="mt-2 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
              />
            )}
          </div>

          {/* PIN Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Your Staff PIN (4-Digits) *</span>
              {activePOSStaff && (
                <span className="text-[10px] text-indigo-500 font-normal lowercase">
                  default: {activePOSStaff.pin}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={4}
                required
                placeholder="••••"
                value={pinInput}
                onChange={e => {
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setErrorMessage(null);
                }}
                className="w-full px-3.5 py-2.5 font-mono text-center text-lg font-black tracking-widest rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            {errorMessage && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
            Audit Trail Notice: You do not need a manager override, but this void event will be permanently linked to your staff profile with timestamp and reason.
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
            >
              Confirm Void
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
