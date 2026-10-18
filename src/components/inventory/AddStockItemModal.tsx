import React, { useState } from 'react';
import { X, Plus, Boxes, Building2, Tag, MapPin, Scale, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StockItem, StockUnit } from '../../types';

interface AddStockItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_UNITS: StockUnit[] = ['kg', 'g', 'L', 'ml', 'pcs', 'pack', 'box', 'bottle', 'can'];

export const AddStockItemModal: React.FC<AddStockItemModalProps> = ({ isOpen, onClose }) => {
  const { rawStockCategories, addRawStockCategory, addStockItem, suppliers } = useApp();

  // Form Fields
  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unit, setUnit] = useState<StockUnit>('kg');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minReorderLevel, setMinReorderLevel] = useState<number>(5);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [supplierId, setSupplierId] = useState('');
  const [storageLocation, setStorageLocation] = useState('Main Kitchen Store');
  const [storageRack, setStorageRack] = useState('');
  const [trackStock, setTrackStock] = useState(true);
  const [notes, setNotes] = useState('');

  // Category Quick-Add state
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryError('Please enter a category name.');
      return;
    }
    setCategoryError(null);
    const added = await addRawStockCategory(trimmed);
    setSelectedCategory(added);
    setNewCategoryName('');
    setIsAddingNewCategory(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Raw Item / Ingredient Name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const finalCategory = selectedCategory.trim() || 'General Ingredients';
      const selectedSup = suppliers.find(s => s.id === supplierId);
      const supplierName = selectedSup ? (selectedSup.companyName || selectedSup.name) : undefined;
      const supplierContact = selectedSup ? (selectedSup.phone || selectedSup.name) : undefined;
      const supplierPan = selectedSup ? selectedSup.panVatNumber : undefined;

      const generatedSku = sku.trim() || `RAW-${name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`;

      await addStockItem({
        name: name.trim(),
        category: finalCategory,
        brand: brand.trim() || undefined,
        sku: generatedSku,
        barcode: barcode.trim() || undefined,
        unit,
        currentStock: Math.max(0, Number(currentStock) || 0),
        minReorderLevel: Math.max(0, Number(minReorderLevel) || 0),
        costPrice: Math.max(0, Number(costPrice) || 0),
        supplierId: supplierId || undefined,
        supplierName,
        supplierContact,
        supplierPan,
        storageLocation: storageLocation.trim() || 'Main Kitchen Store',
        storageRack: storageRack.trim() || undefined,
        trackStock,
        status: 'active',
        notes: notes.trim() || undefined
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add stock item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Horizontally Big Modal (max-w-4xl / max-w-5xl) */}
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Add Raw Material / Stock Item
              </h2>
              <p className="text-3xs text-slate-500">
                Track ingredients by unit, custom categories, supplier mapping, and minimum reorder safety levels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="px-6 py-2.5 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 text-xs font-semibold border-b border-rose-200 dark:border-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Spacious Horizontally-Spread Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Section 1: Item Identification & Category */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-2xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5 text-blue-500" />
              <span>Basic Identification & Classification</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Item Name */}
              <div className="md:col-span-2">
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Raw Item / Ingredient Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chicken Meat, Burger Buns, Cooking Oil, Tomato Ketchup, Salt"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Base Unit */}
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Base Measurement Unit *
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as StockUnit)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  {COMMON_UNITS.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Category Dropdown with "+ Add" Category Creator */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Category (Choose from Dropdown)
                  </label>
                  {!isAddingNewCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewCategory(true);
                        setCategoryError(null);
                      }}
                      className="text-3xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Add New Category</span>
                    </button>
                  )}
                </div>

                {/* Inline Category Creator when "+ Add" is clicked */}
                {isAddingNewCategory ? (
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Enter category name (e.g. Meat & Poultry, Dairy, Bakery)..."
                        className="flex-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateCategory();
                          }
                          if (e.key === 'Escape') {
                            setIsAddingNewCategory(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateCategory()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewCategory(false);
                          setNewCategoryName('');
                          setCategoryError(null);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    {categoryError && (
                      <p className="text-3xs text-rose-600 dark:text-rose-400 font-semibold">{categoryError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer shadow-xs"
                    >
                      <option value="">
                        {rawStockCategories.length === 0 ? 'No categories yet — click "+ Add" on the right' : 'Select a Category...'}
                      </option>
                      {rawStockCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsAddingNewCategory(true)}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-500" />
                      <span>Add</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SKU / Code */}
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  SKU Code / Barcode (Optional)
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Quantities, Reorder Thresholds & Cost Price */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-2xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5 text-emerald-500" />
              <span>Stock Quantities, Valuation & Safety Levels</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Initial Stock */}
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Initial / Opening Quantity ({unit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Min Reorder Threshold */}
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Min Reorder Safety Level ({unit}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={minReorderLevel}
                  onChange={(e) => setMinReorderLevel(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-600 dark:text-amber-400 outline-hidden focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Cost Price */}
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Cost Price (NPR per {unit}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={costPrice}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Primary Supplier, Storage Location & Recipe Tracking */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-2xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Supplier & Storage Location</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Supplier */}
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Primary Supplier
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value="">Select Existing Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.companyName || s.name}</option>
                  ))}
                </select>
              </div>

              {/* Storage Location */}
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Storage Area / Godown
                </label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="e.g. Main Kitchen Cold Room"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Rack / Bin */}
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Specific Rack / Shelf / Bin
                </label>
                <input
                  type="text"
                  value={storageRack}
                  onChange={(e) => setStorageRack(e.target.value)}
                  placeholder="e.g. Freezer Shelf 2, Dry Shelf B"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Auto Recipe Deduction Switch */}
              <div className="sm:col-span-3 flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs">
                <div>
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
                    Auto-Deduct in Dish Recipes (KOT)
                  </span>
                  <span className="text-3xs text-slate-500">
                    Automatically reduces this raw ingredient balance whenever an ordered dish with its recipe is sent to kitchen.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={trackStock}
                  onChange={(e) => setTrackStock(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Stock Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
