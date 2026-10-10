import React, { useEffect } from 'react';
import { X, Trash2, ChefHat, Wine } from 'lucide-react';

interface ClearOrderRoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  targetLabel: string;
  roundNumber: number;
  totalQuantity: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    orderRoutingStation?: 'kitchen' | 'bar';
  }>;
}

export const ClearOrderRoundModal: React.FC<ClearOrderRoundModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  targetLabel,
  roundNumber,
  totalQuantity,
  items
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-round-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="clear-round-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Clear Order Round #{roundNumber}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {targetLabel} · {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Items Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 p-3 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item, idx) => (
              <div key={`${item.productId}-${idx}`} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-blue-900 dark:text-blue-300 shrink-0">
                    #{idx + 1}.
                  </span>
                  {item.orderRoutingStation === 'bar' ? (
                    <span className="inline-flex items-center gap-1 text-3xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
                      <Wine className="w-3.5 h-3.5" />
                      Bar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-3xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                      <ChefHat className="w-3.5 h-3.5" />
                      Kitchen
                    </span>
                  )}
                  <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
                    {item.productName}
                  </span>
                </div>
                <span className="text-slate-600 dark:text-slate-400 font-bold shrink-0 ml-2">
                  ×{item.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Yes, Clear Round
          </button>
        </div>
      </div>
    </div>
  );
};
