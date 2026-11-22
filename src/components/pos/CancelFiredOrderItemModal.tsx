import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, ShieldAlert, Trash2, KeyRound, Check, Minus, Plus, RotateCcw, Flame, Bell, BellRing } from 'lucide-react';
import { KitchenOrderTicket, KOTItem, StaffMember } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR } from '../../utils/nepalFormatters';
import { verifyCancelItemPin } from '../../utils/staffPermissionUtils';

interface CancelFiredOrderItemModalProps {
  isOpen: boolean;
  ticket: KitchenOrderTicket | null;
  item: KOTItem | null;
  tableNumber?: string;
  mode?: 'cancel' | 'uncancel';
  onClose: () => void;
  onConfirm: (
    quantityToCancel: number, 
    reason: string, 
    staffName: string, 
    note?: string,
    disposition?: 'return_to_stock' | 'mark_as_waste',
    notifyKitchenBar?: boolean,
    actingStaff?: StaffMember | null
  ) => Promise<void>;
}

export const CancelFiredOrderItemModal: React.FC<CancelFiredOrderItemModalProps> = ({
  isOpen,
  ticket,
  item,
  tableNumber,
  mode = 'cancel',
  onClose,
  onConfirm
}) => {
  const { staffMembers, activePOSStaff, activeStaffUser, currentUser } = useApp();
  const currentOperator = activePOSStaff || activeStaffUser;
  const isUncancelMode = mode === 'uncancel';

  const [quantityToCancel, setQuantityToCancel] = useState<number>(1);
  const [reason, setReason] = useState<string>(isUncancelMode ? 'Guest decided to keep order' : 'Guest changed mind');
  const [customReason, setCustomReason] = useState<string>('');
  const [staffNote, setStaffNote] = useState<string>('');
  const [disposition, setDisposition] = useState<'return_to_stock' | 'mark_as_waste'>('return_to_stock');
  const [notifyKitchenBar, setNotifyKitchenBar] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const handleSubmitRef = useRef<() => void>(() => {});

  // Sync state whenever modal opens with a new item
  useEffect(() => {
    if (item) {
      setQuantityToCancel(item.quantity);
      setReason(isUncancelMode ? 'Guest decided to keep order' : 'Guest changed mind');
      setCustomReason('');
      setStaffNote('');
      setDisposition('return_to_stock');
      setNotifyKitchenBar(true);
      setErrorMessage(null);
      setIsSubmitting(false);
      // Strictly require manual PIN entry - NEVER pre-fill PIN
      setPinInput('');
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [item, isOpen, isUncancelMode]);

  // Handle global keyboard typing for quick numpad interaction
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside any input (except PIN input) or textarea
      if (
        (document.activeElement?.tagName === 'INPUT' && document.activeElement !== pinInputRef.current) ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setPinInput(prev => (prev.length < 4 ? prev + e.key : prev));
        setErrorMessage(null);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPinInput(prev => prev.slice(0, -1));
        setErrorMessage(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmitRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ticket || !item) return null;

  const presetReasons = isUncancelMode ? [
    'Guest decided to keep order',
    'Accidental cancellation by staff',
    'Kitchen/Bar confirmed dish can be made',
    'Guest changed mind back',
    'Reordered after brief delay',
    'Other reason'
  ] : [
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

  const handleNumpad = (digit: string) => {
    if (pinInput.length < 4) {
      setPinInput(prev => prev + digit);
      setErrorMessage(null);
    }
  };

  const handleClearPin = () => {
    setPinInput('');
    setErrorMessage(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const pinCheck = verifyCancelItemPin(
      pinInput,
      currentOperator,
      staffMembers,
      isUncancelMode ? 'uncancel' : 'cancel'
    );

    if ('error' in pinCheck) {
      setErrorMessage(pinCheck.error);
      setPinInput('');
      setTimeout(() => pinInputRef.current?.focus(), 20);
      return;
    }

    const staffName =
      pinCheck.staff?.name ||
      pinCheck.authorizedBy ||
      currentOperator?.name ||
      currentUser.name ||
      'Staff';

    const trimmedNote = staffNote.trim();
    const baseReason = reason === 'Other reason' 
      ? (customReason.trim() || 'Other reason') 
      : reason;

    const finalReason = trimmedNote 
      ? `${baseReason} (${trimmedNote})` 
      : baseReason;

    setIsSubmitting(true);
    try {
      onClose();
      await onConfirm(quantityToCancel, finalReason, staffName, trimmedNote, disposition, notifyKitchenBar, pinCheck.staff);
    } catch (err: any) {
      setErrorMessage(err?.message || `Failed to ${isUncancelMode ? 'uncancel' : 'cancel'} order item.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  handleSubmitRef.current = () => {
    void handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
      {/* Horizontal modal container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl xl:max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
          isUncancelMode 
            ? 'border-blue-100 dark:border-blue-950/50 bg-blue-50/80 dark:bg-blue-950/30' 
            : 'border-rose-100 dark:border-rose-950/50 bg-rose-50/80 dark:bg-rose-950/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              isUncancelMode 
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400' 
                : 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400'
            }`}>
              {isUncancelMode ? <RotateCcw className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  {isUncancelMode ? 'Uncancel / Restore Fired Item' : 'Cancel Fired Order Item'}
                </h3>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-md font-bold ${
                  isUncancelMode 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
                }`}>
                  {ticket.kotNumber}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {tableNumber ? `Table ${tableNumber}` : 'Counter Order'}
                </span>
                <span className={`text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  isUncancelMode 
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200' 
                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                }`}>
                  {stationName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isUncancelMode 
                  ? 'Enter authorized staff PIN to uncancel item and restore it back to the table ticket.' 
                  : 'Requires authorized staff PIN to revoke item from live order ticket.'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form: Side-by-Side Horizontal Grid for Zero-Scroll Action */}
        <form onSubmit={handleSubmit} className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          {/* LEFT COLUMN: Item Details & Cancellation/Restore Reason */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              {/* Target Item Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`text-3xs font-bold uppercase tracking-wider ${
                      isUncancelMode ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isUncancelMode ? 'Item Targeted For Uncancel' : 'Item Targeted For Cancellation'}
                    </span>
                    <h4 className="font-black text-slate-900 dark:text-white text-base mt-0.5">
                      {item.quantity}× {item.productName}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-3xs uppercase tracking-wider text-slate-400 block font-semibold">
                      Total Value
                    </span>
                    <span className={`font-mono font-black text-base ${
                      isUncancelMode ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatNPR(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                </div>

                {/* Status & Quantity */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Rate: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatNPR(item.unitPrice)}</span></span>
                    <span>·</span>
                    <span>Status: <span className={`font-semibold capitalize ${isUncancelMode ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{item.status}</span></span>
                  </div>

                  {/* Quantity Stepper beside status right corner */}
                  {maxQty > 1 && (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-0.5">
                      <span className="text-3xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {isUncancelMode ? 'Restore Qty:' : 'Cancel Qty:'}
                      </span>
                      <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setQuantityToCancel(prev => Math.max(1, prev - 1))}
                          disabled={quantityToCancel <= 1}
                          className="p-1 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-black text-xs text-slate-900 dark:text-white">
                          {quantityToCancel}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantityToCancel(prev => Math.min(maxQty, prev + 1))}
                          disabled={quantityToCancel >= maxQty}
                          className="p-1 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                          title="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-3xs font-mono font-bold text-slate-500 dark:text-slate-400">
                        of {maxQty}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQuantityToCancel(1)}
                          className={`px-2 py-0.5 text-3xs font-bold rounded-lg border transition-all cursor-pointer ${
                            quantityToCancel === 1
                              ? (isUncancelMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-amber-600 text-white border-amber-600')
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          1 Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantityToCancel(maxQty)}
                          className={`px-2 py-0.5 text-3xs font-bold rounded-lg border transition-all cursor-pointer ${
                            quantityToCancel === maxQty
                              ? (isUncancelMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-amber-600 text-white border-amber-600')
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          All ({maxQty})
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {item.specialInstructions && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 italic mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    Note: {item.specialInstructions}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {isUncancelMode ? 'Reason For Restoring *' : 'Cancellation Reason *'}
                </label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 ${
                    isUncancelMode ? 'focus:ring-blue-500' : 'focus:ring-rose-500'
                  } cursor-pointer`}
                >
                  {presetReasons.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                {reason === 'Other reason' && (
                  <input
                    type="text"
                    required
                    placeholder={isUncancelMode ? "Provide reason for restoring to audit log..." : "Provide specific cancellation reason for audit log..."}
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                      isUncancelMode ? 'focus:ring-blue-500' : 'focus:ring-rose-500'
                    }`}
                  />
                )}
              </div>

              {/* Note (Optional) for Staff */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Note <span className="normal-case font-normal text-slate-400 dark:text-slate-500">(Optional)</span>
                  </label>
                  <span className="text-3xs text-slate-400 dark:text-slate-500">
                    Write more details if needed
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={staffNote}
                  onChange={e => setStaffNote(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                    isUncancelMode ? 'focus:ring-blue-500' : 'focus:ring-rose-500'
                  } resize-none transition-all`}
                />
              </div>

              {/* INVENTORY DISPOSITION (only in cancel mode) & KITCHEN NOTIFICATION TOGGLE */}
              <div className="space-y-2 pt-1">
                {!isUncancelMode && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Inventory & Kitchen Disposition *
                      </label>
                      <span className="text-3xs font-semibold text-slate-400">
                        {disposition === 'return_to_stock' ? 'Restores Stock' : 'Logs to Waste & Loss'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDisposition('return_to_stock')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between relative ${
                          disposition === 'return_to_stock'
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500/80 shadow-xs ring-1 ring-emerald-500/30'
                            : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 opacity-75'
                        }`}
                      >
                        <span className={`text-xs font-black flex items-center gap-1.5 ${
                          disposition === 'return_to_stock'
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Return To Stock</span>
                        </span>
                        {disposition === 'return_to_stock' ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-3xs font-black shadow-2xs">
                            ✓
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDisposition('mark_as_waste')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between relative ${
                          disposition === 'mark_as_waste'
                            ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-500 dark:border-rose-500/80 shadow-xs ring-1 ring-rose-500/30'
                            : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 opacity-75'
                        }`}
                      >
                        <span className={`text-xs font-black flex items-center gap-1.5 ${
                          disposition === 'mark_as_waste'
                            ? 'text-rose-700 dark:text-rose-300'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Mark as Waste</span>
                        </span>
                        {disposition === 'mark_as_waste' ? (
                          <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-3xs font-black shadow-2xs">
                            ✓
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600" />
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* Notify Kitchen / Bar Station Toggle Button */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setNotifyKitchenBar(prev => !prev)}
                    className={`w-full p-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      notifyKitchenBar
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-lg ${
                        notifyKitchenBar 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                        {notifyKitchenBar ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                      </div>
                      <div className="text-left">
                        <span className="text-2xs font-bold block">
                          Notify & Print to {stationName}
                        </span>
                        <span className="text-3xs font-normal text-slate-500 dark:text-slate-400 block -mt-0.5">
                          {notifyKitchenBar 
                            ? (isUncancelMode ? `Dish uncancelled alert sent to ${stationName} station` : `Prints cancelled order slip & alerts ${stationName}`)
                            : (isUncancelMode ? `Silent restore without kitchen chime` : `Silent cancellation without printing slip`)}
                        </span>
                      </div>
                    </div>

                    <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 flex items-center ${
                      notifyKitchenBar ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                    }`}>
                      <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Staff PIN Authorization & Touch Keypad & Submit */}
          <div className="md:col-span-5 flex flex-col justify-between bg-slate-50 dark:bg-slate-850 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-700/70 space-y-3.5">
            <div>
              {/* PIN Header */}
              <div className="flex items-center justify-between pb-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className={`w-3.5 h-3.5 ${isUncancelMode ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`} />
                  <span>Enter 4-Digit Staff PIN</span>
                </label>
                <span className={`text-3xs px-2 py-0.5 rounded-md font-bold ${
                  isUncancelMode 
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' 
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                }`}>
                  Any Staff PIN
                </span>
              </div>
              <p className="text-3xs text-slate-500 dark:text-slate-400">
                Signed in: <span className="font-bold text-slate-700 dark:text-slate-200">{currentOperator?.name || currentUser.name}</span> • Enter your own 4-digit PIN to record under your name.
              </p>

              {/* PIN Dots Visual Display */}
              <div className="flex items-center justify-center gap-3 py-2.5">
                {[0, 1, 2, 3].map(idx => (
                  <div
                    key={idx}
                    className={`w-11 h-12 rounded-xl flex items-center justify-center font-mono text-xl font-black border-2 transition-all ${
                      pinInput.length > idx
                        ? (isUncancelMode
                            ? 'border-blue-500 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 scale-105 shadow-sm ring-2 ring-blue-500/20'
                            : 'border-rose-500 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 scale-105 shadow-sm ring-2 ring-rose-500/20')
                        : 'border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    {pinInput.length > idx ? '●' : ''}
                  </div>
                ))}
              </div>

              {/* Hidden/Synced input for physical keyboards */}
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                placeholder="Type 4 digits or use pad"
                value={pinInput}
                onChange={e => {
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setErrorMessage(null);
                }}
                className={`w-full px-3 py-1.5 text-center font-mono text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  isUncancelMode ? 'focus:ring-blue-500' : 'focus:ring-rose-500'
                }`}
              />

              {/* Touch Numpad */}
              <div className="grid grid-cols-3 gap-1.5 pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumpad(num)}
                    className="py-2.5 text-sm font-black rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClearPin}
                  className="py-2.5 text-xs font-bold rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('0')}
                  className="py-2.5 text-sm font-black rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 active:scale-95 transition-all cursor-pointer shadow-2xs"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPinInput(prev => prev.slice(0, -1))}
                  className="py-2.5 text-xs font-bold rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="mt-2 text-2xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-900/40">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Action Buttons Right Beneath Keypad */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors text-center"
              >
                {isUncancelMode ? 'Keep Cancelled' : 'Keep Item'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || pinInput.length !== 4}
                className={`flex-[1.5] py-2.5 px-3 text-xs font-black rounded-xl active:scale-98 text-white transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isUncancelMode 
                    ? 'bg-blue-600 hover:bg-blue-700 disabled:hover:bg-blue-600' 
                    : 'bg-rose-600 hover:bg-rose-700 disabled:hover:bg-rose-600'
                }`}
              >
                {isUncancelMode ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Restoring...' : `Uncancel ${quantityToCancel}x Item`}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? (notifyKitchenBar ? 'Cancelling & Printing...' : 'Cancelling...') : `Cancel ${quantityToCancel}x Item`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
