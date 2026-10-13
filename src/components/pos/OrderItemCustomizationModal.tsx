import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, FileText, AlertCircle, Trash2, Tag, UtensilsCrossed } from 'lucide-react';
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

export interface NewItemCustomizationTarget {
  type: 'new';
  product: Product;
  unitPrice?: number;
  quantity?: number;
}

export type CustomizationTarget = CartCustomizationTarget | FiredCustomizationTarget | NewItemCustomizationTarget;

interface OrderItemCustomizationModalProps {
  isOpen: boolean;
  target: CustomizationTarget | null;
  tableNumber?: string;
  onClose: () => void;
  onSaveCartItem: (index: number, addons: { name: string; price: number }[], notes: string) => void;
  onSaveFiredItem: (kotId: string, itemId: string, addons: { name: string; price: number }[], notes: string) => Promise<void>;
  onAddNewItem?: (product: Product, addons: { name: string; price: number }[], notes: string, quantity: number) => void;
}

export const OrderItemCustomizationModal: React.FC<OrderItemCustomizationModalProps> = ({
  isOpen,
  target,
  tableNumber,
  onClose,
  onSaveCartItem,
  onSaveFiredItem,
  onAddNewItem
}) => {
  const { products } = useApp();

  const [selectedAddons, setSelectedAddons] = useState<{ name: string; price: number }[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isNew = target?.type === 'new';
  const isFired = target?.type === 'fired';

  const product = isNew
    ? target.product
    : products.find(p => 
        p.id === target?.item?.productId || 
        (Boolean(p.name && target?.item?.productName) && String(p.name).toLowerCase() === String(target?.item?.productName).toLowerCase())
      );

  const targetItem = isNew
    ? {
        productId: target.product.id,
        productName: target.product.name,
        quantity: quantity,
        unitPrice: target.unitPrice ?? target.product.retailPrice ?? 0,
        addonsList: [],
        itemNotes: ''
      }
    : target?.item;

  // Initialize modal state whenever opened
  useEffect(() => {
    if (target) {
      if (target.type === 'new') {
        setSelectedAddons([]);
        setNotes('');
        setQuantity(target.quantity || 1);
      } else if (target.type === 'fired') {
        const initialAddons = target.item.addonsList ? [...target.item.addonsList] : [];
        setSelectedAddons(initialAddons);
        setNotes(target.item.specialInstructions || '');
        setQuantity(target.item.quantity || 1);
      } else {
        const initialAddons = target.item.addonsList ? [...target.item.addonsList] : [];
        setSelectedAddons(initialAddons);
        setNotes(target.item.itemNotes || '');
        setQuantity(target.item.quantity || 1);
      }

      setIsSaving(false);
    }
  }, [target]);

  if (!isOpen || !target || !targetItem) return null;

  // Calculate base price and addon adjustments
  const baseUnitPrice = isNew
    ? (target.unitPrice ?? target.product.retailPrice ?? 0)
    : (product 
        ? (product.retailPrice || targetItem.unitPrice)
        : targetItem.unitPrice);

  const addonsTotal = selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
  const finalUnitPrice = baseUnitPrice + addonsTotal;
  const currentQuantity = isNew ? quantity : (targetItem.quantity || 1);
  const lineTotal = currentQuantity * finalUnitPrice;

  const handleToggleAddon = (addon: { name: string; price: number }) => {
    const cleanAddonName = String(addon.name || '').toLowerCase();
    setSelectedAddons(prev => {
      const exists = prev.some(a => String(a.name || '').toLowerCase() === cleanAddonName);
      if (exists) {
        return prev.filter(a => String(a.name || '').toLowerCase() !== cleanAddonName);
      }
      return [...prev, addon];
    });
  };

  const handleRemoveAddon = (addonName: string) => {
    setSelectedAddons(prev => prev.filter(a => a.name !== addonName));
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (target.type === 'new') {
        if (onAddNewItem) {
          onAddNewItem(target.product, selectedAddons, notes, quantity);
        }
      } else if (target.type === 'fired') {
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

  const availableProductAddons = (isNew ? target.product.customAddons : product?.customAddons) || [];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl text-white flex items-center justify-center shrink-0 shadow-2xs bg-blue-600">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 dark:text-white text-sm truncate flex items-center gap-2">
                <span>Add-ons &amp; Notes</span>
              </h3>
              <p className="text-3xs text-slate-500 dark:text-slate-400 font-mono">
                {tableNumber ? `Table ${tableNumber}` : 'Counter'} · {
                  isFired 
                    ? `Fired ${target.ticket.ticketType || 'KOT'} #${target.ticket.kotNumber}` 
                    : isNew
                    ? 'New Item'
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
            <div className="min-w-0">
              <span className="font-bold text-slate-900 dark:text-white text-xs block truncate">
                {targetItem.productName}
              </span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-3xs text-slate-500 font-mono">
                  Base: {formatNPR(baseUnitPrice)}
                </span>
                {isNew && (
                  <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-2xs">
                    <button
                      type="button"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="p-0.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 cursor-pointer transition-colors"
                      title="Decrease quantity"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="font-mono text-3xs font-black px-1 min-w-[14px] text-center text-slate-800 dark:text-slate-200">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(q => q + 1)}
                      className="p-0.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer transition-colors"
                      title="Increase quantity"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
                {!isNew && (
                  <span className="text-3xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                    Qty: {currentQuantity}
                  </span>
                )}
                {addonsTotal > 0 && (
                  <span className="text-3xs text-blue-600 dark:text-blue-400 font-mono">
                    + Addons: {formatNPR(addonsTotal)}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0 pl-3">
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
            </div>

            {/* Catalog Addons List */}
            {availableProductAddons.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                {availableProductAddons.map(addon => {
                  const isChecked = selectedAddons.some(a => String(a.name || '').toLowerCase() === String(addon.name || '').toLowerCase());
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
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 text-3xs text-slate-400 italic">
                No add-ons available for this item.
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

          {/* SECTION 2: ADDITIONAL INSTRUCTIONS */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              <span>Additional Instructions</span>
            </label>

            <textarea
              rows={2}
              placeholder="Type additional instructions here..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
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
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 bg-blue-600 hover:bg-blue-700 active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>
              {isSaving 
                ? 'Saving...' 
                : isFired 
                ? 'Update Fired Dish & Notify' 
                : isNew
                ? 'Add to Ticket'
                : 'Save Add-on / Note'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

