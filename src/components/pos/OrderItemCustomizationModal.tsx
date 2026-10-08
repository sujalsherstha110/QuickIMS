import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Sparkles, AlertCircle, Trash2, Tag, UtensilsCrossed } from 'lucide-react';
import { Product, KitchenOrderTicket, KOTItem, SaleItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR } from '../../utils/nepalFormatters';

export interface CartCustomizationTarget {
  type: 'cart';
  index: number;
  item: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    addonsList?: { name: string; price: number }[];
    itemNotes?: string;
  };
}

export interface FiredCustomizationTarget {
  type: 'fired';
  ticket: KitchenOrderTicket;
  item: KOTItem;
}

export type CustomizationTarget = CartCustomizationTarget | FiredCustomizationTarget;

interface OrderItemCustomizationModalProps {
  isOpen: boolean;
  target: CustomizationTarget | null;
  tableNumber?: string;
  onClose: () => void;
  onSaveCartItem: (index: number, addons: { name: string; price: number }[], notes: string) => void;
  onSaveFiredItem: (kotId: string, itemId: string, addons: { name: string; price: number }[], notes: string) => Promise<void>;
}

export const OrderItemCustomizationModal: React.FC<OrderItemCustomizationModalProps> = ({
  isOpen,
  target,
  tableNumber,
  onClose,
  onSaveCartItem,
  onSaveFiredItem
}) => {
  const { products } = useApp();

  const [selectedAddons, setSelectedAddons] = useState<{ name: string; price: number }[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [customAddonName, setCustomAddonName] = useState<string>('');
  const [customAddonPrice, setCustomAddonPrice] = useState<string>('');
  const [showCustomAddonInput, setShowCustomAddonInput] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Quick note preset tags for busy restaurant floors
  const quickNoteTags = [
    '🌶️ Extra Spicy',
    '🍃 Mild / Less Spicy',
    '🌱 No Onion / Garlic',
    '🥡 Pack for Takeaway',
    '⚡ Rush / Urgent',
    '🥣 Sauce on Side',
    '🧀 Extra Crispy',
    '🧊 Less Ice'
  ];

  const targetItem = target?.item;
  const product = products.find(p => 
    p.id === targetItem?.productId || 
    p.name.toLowerCase() === targetItem?.productName.toLowerCase()
  );

  // Initialize modal state whenever opened
  useEffect(() => {
    if (target && target.item) {
      const initialAddons = target.item.addonsList ? [...target.item.addonsList] : [];
      setSelectedAddons(initialAddons);

      if (target.type === 'fired') {
        setNotes(target.item.specialInstructions || '');
      } else {
        setNotes(target.item.itemNotes || '');
      }

      setCustomAddonName('');
      setCustomAddonPrice('');
      setShowCustomAddonInput(false);
      setIsSaving(false);
    }
  }, [target]);

  if (!isOpen || !target || !targetItem) return null;

  // Calculate base price and addon adjustments
  const baseUnitPrice = product 
    ? (product.retailPrice || targetItem.unitPrice)
    : targetItem.unitPrice;

  const addonsTotal = selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
  const finalUnitPrice = baseUnitPrice + addonsTotal;
  const quantity = targetItem.quantity || 1;
  const lineTotal = quantity * finalUnitPrice;

  const handleToggleAddon = (addon: { name: string; price: number }) => {
    setSelectedAddons(prev => {
      const exists = prev.some(a => a.name.toLowerCase() === addon.name.toLowerCase());
      if (exists) {
        return prev.filter(a => a.name.toLowerCase() !== addon.name.toLowerCase());
      }
      return [...prev, addon];
    });
  };

  const handleAddCustomAddon = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customAddonName.trim();
    const price = Math.max(0, parseFloat(customAddonPrice) || 0);
    if (!name) return;

    setSelectedAddons(prev => {
      if (prev.some(a => a.name.toLowerCase() === name.toLowerCase())) {
        return prev;
      }
      return [...prev, { name, price }];
    });

    setCustomAddonName('');
    setCustomAddonPrice('');
    setShowCustomAddonInput(false);
  };

  const handleRemoveAddon = (addonName: string) => {
    setSelectedAddons(prev => prev.filter(a => a.name !== addonName));
  };

  const handleAppendQuickTag = (tag: string) => {
    setNotes(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return trimmed;
      return `${trimmed}, ${tag}`;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (target.type === 'fired') {
        await onSaveFiredItem(target.ticket.id, target.item.id, selectedAddons, notes);
      } else {
        onSaveCartItem(target.index, selectedAddons, notes);
      }
      onClose();
    } catch (err) {
      console.error('Error saving customization:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isFired = target.type === 'fired';
  const availableProductAddons = product?.customAddons || [];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl text-white flex items-center justify-center shrink-0 ${
              isFired ? 'bg-amber-600' : 'bg-blue-600'
            }`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 dark:text-white text-sm truncate flex items-center gap-2">
                <span>Add-ons &amp; Notes: {targetItem.productName}</span>
              </h3>
              <p className="text-3xs text-slate-500 dark:text-slate-400 font-mono">
                {tableNumber ? `Table ${tableNumber}` : 'Counter'} · {
                  isFired 
                    ? `Fired ${target.ticket.ticketType || 'KOT'} #${target.ticket.kotNumber}` 
                    : 'Draft Ticket Round'
                }
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

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Item Price Summary Card */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-xs block">
                {quantity}× {targetItem.productName}
              </span>
              <span className="text-3xs text-slate-500 font-mono">
                Base: {formatNPR(baseUnitPrice)} {addonsTotal > 0 && `+ Addons: ${formatNPR(addonsTotal)}`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-3xs text-slate-400 uppercase font-bold block">Running Total</span>
              <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                {formatNPR(lineTotal)}
              </span>
            </div>
          </div>

          {/* SECTION 1: ADD-ONS SELECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Dish Add-ons &amp; Modifiers</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCustomAddonInput(prev => !prev)}
                className="text-3xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
              >
                {showCustomAddonInput ? 'Cancel Custom' : '+ Custom Add-on'}
              </button>
            </div>

            {/* Custom Addon On-The-Fly Input */}
            {showCustomAddonInput && (
              <form onSubmit={handleAddCustomAddon} className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
                <p className="text-3xs font-bold text-blue-700 dark:text-blue-300">
                  Add Special / Custom Add-on (Optional Price)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Add-on name (e.g. Extra Cheese, Mayo dip)"
                    value={customAddonName}
                    onChange={e => setCustomAddonName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none"
                  />
                  <div className="w-24 relative">
                    <span className="absolute left-2 top-1.5 text-3xs font-mono text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      placeholder="0"
                      value={customAddonPrice}
                      onChange={e => setCustomAddonPrice(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}

            {/* Catalog Addons List */}
            {availableProductAddons.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                {availableProductAddons.map(addon => {
                  const isChecked = selectedAddons.some(a => a.name.toLowerCase() === addon.name.toLowerCase());
                  return (
                    <div
                      key={addon.name}
                      onClick={() => handleToggleAddon(addon)}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-blue-600 accent-blue-600 cursor-pointer"
                        />
                        <span>{addon.name}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-300 font-semibold">
                        +{formatNPR(addon.price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 text-3xs text-slate-500">
                No default catalog add-ons configured for this dish. Use <span className="font-bold text-blue-600 dark:text-blue-400 cursor-pointer" onClick={() => setShowCustomAddonInput(true)}>+ Custom Add-on</span> above to add any extra request.
              </div>
            )}

            {/* Currently Active Selected Addons Pills */}
            {selectedAddons.length > 0 && (
              <div className="pt-1">
                <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Selected Add-ons ({selectedAddons.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAddons.map((addon, aIdx) => (
                    <span
                      key={aIdx}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 text-3xs font-bold border border-blue-200 dark:border-blue-800"
                    >
                      <span>+{addon.name} ({formatNPR(addon.price)})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAddon(addon.name)}
                        className="text-blue-500 hover:text-rose-600 cursor-pointer font-black"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: SPECIAL KITCHEN / BAR NOTES */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>Kitchen &amp; Bar Special Instructions</span>
              <span className="text-3xs text-slate-400 lowercase font-normal">reflected on KDS / BOT</span>
            </label>

            {/* Quick Tap Presets */}
            <div className="flex flex-wrap gap-1 py-1">
              {quickNoteTags.map((tag, tIdx) => (
                <button
                  key={tIdx}
                  type="button"
                  onClick={() => handleAppendQuickTag(tag)}
                  className="px-2 py-0.5 rounded-md text-3xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              placeholder="e.g. Extra spicy, serve gravy in separate bowl, no onion, urgent..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {isFired && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-3xs text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
              <span className="shrink-0 font-bold">ℹ️</span>
              <span>
                This order is already fired to the {target.ticket.destinationStation === 'bar' ? 'Bar' : 'Kitchen'}. Saving updates will immediately notify kitchen screens and update the table's running total.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
              isFired
                ? 'bg-amber-600 hover:bg-amber-700 active:scale-98'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {isSaving 
                ? 'Updating...' 
                : isFired 
                ? 'Update Fired Dish & Notify Kitchen' 
                : 'Save Add-on / Note'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
