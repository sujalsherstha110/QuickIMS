import React, { useState, useMemo } from 'react';
import { 
  ChefHat, Boxes, Plus, Edit2, Search, ArrowRight, 
  Trash2, Scale, Percent, AlertTriangle, CheckCircle2, 
  X, Sparkles, BookOpen, Layers
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, RecipeIngredient } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';

export const RecipesView: React.FC = () => {
  const { products, updateProduct } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Available raw ingredients in inventory
  const rawIngredients = useMemo(() => {
    return products.filter(p => p.itemType === 'raw_ingredient' || (!p.itemType && String(p.category || '').toLowerCase().includes('raw')));
  }, [products]);

  // Menu items (dishes) that can have recipes
  const menuItems = useMemo(() => {
    return products.filter(p => p.itemType === 'menu_item' || !p.itemType);
  }, [products]);

  const filteredMenuItems = useMemo(() => {
    const q = String(searchTerm || '').toLowerCase();
    return menuItems.filter(item => {
      const matchSearch = String(item.name || '').toLowerCase().includes(q) || 
                          String(item.category || '').toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || item.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [menuItems, searchTerm, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [menuItems]);

  // Edit Recipe Form state
  const [activeRecipe, setActiveRecipe] = useState<RecipeIngredient[]>([]);

  const handleOpenEditRecipe = (product: Product) => {
    setSelectedProduct(product);
    setActiveRecipe(product.recipeIngredients ? [...product.recipeIngredients] : []);
    setIsEditModalOpen(true);
  };

  const handleAddIngredientRow = () => {
    if (rawIngredients.length === 0) return;
    const defaultRaw = rawIngredients[0];
    const newRow: RecipeIngredient = {
      ingredientId: defaultRaw.id,
      ingredientName: defaultRaw.name,
      quantityRequired: 0,
      unit: defaultRaw.unit || 'unit',
      costPerUnit: defaultRaw.costPrice || 0,
      totalCost: 0
    };
    setActiveRecipe([...activeRecipe, newRow]);
  };

  const handleIngredientChange = (index: number, rawId: string) => {
    const raw = rawIngredients.find(r => r.id === rawId);
    if (!raw) return;
    const updated = [...activeRecipe];
    const qty = updated[index].quantityRequired;
    updated[index] = {
      ...updated[index],
      ingredientId: raw.id,
      ingredientName: raw.name,
      unit: raw.unit || 'unit',
      costPerUnit: raw.costPrice || 0,
      totalCost: (raw.costPrice || 0) * qty
    };
    setActiveRecipe(updated);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...activeRecipe];
    const costPer = updated[index].costPerUnit;
    updated[index] = {
      ...updated[index],
      quantityRequired: qty,
      totalCost: costPer * qty
    };
    setActiveRecipe(updated);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setActiveRecipe(activeRecipe.filter((_, i) => i !== index));
  };

  const totalRecipeCost = useMemo(() => {
    return activeRecipe.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  }, [activeRecipe]);

  const handleSaveRecipe = async () => {
    if (!selectedProduct) return;
    await updateProduct(selectedProduct.id, {
      recipeIngredients: activeRecipe,
      costPrice: totalRecipeCost > 0 ? totalRecipeCost : 0
    });
    setIsEditModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span>Recipes & Ingredient Mapping</span>
            </h1>
            <span className="text-3xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/50">
              Kitchen Cost Control
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Map bill of materials (BOM), calculate dish food cost %, and automate pantry inventory deduction when orders are fired.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-500">Pantry Ingredients:</span>{' '}
            <strong className="text-slate-900 dark:text-slate-100">{rawIngredients.length} items</strong>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dish or recipe by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMenuItems.map(dish => {
          const ingredients = dish.recipeIngredients || [];
          const foodCostNpr = ingredients.reduce((sum, i) => sum + i.totalCost, 0);
          const foodCostPercent = dish.retailPrice > 0 ? Math.round((foodCostNpr / dish.retailPrice) * 100) : 0;
          const isHighCost = foodCostPercent > 35;

          return (
            <div
              key={dish.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {dish.name}
                    </h3>
                    <p className="text-3xs text-slate-500 mt-0.5">
                      {dish.category} • Selling: <span className="font-bold text-slate-800 dark:text-slate-200">{formatNPR(dish.retailPrice)}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEditRecipe(dish)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                    title="Edit Recipe BOM"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Food Cost Margin Pill */}
                <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-3xs text-slate-400 uppercase font-semibold">Ingredient Cost</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{formatNPR(foodCostNpr)}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-3xs text-slate-400 uppercase font-semibold">Food Cost %</span>
                    <p className={`font-black flex items-center justify-end gap-1 ${
                      isHighCost ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {foodCostPercent}%
                      {isHighCost && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                    </p>
                  </div>
                </div>

                {/* Ingredients List */}
                <div className="mt-3 space-y-1.5">
                  <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                    Mapped Ingredients ({ingredients.length})
                  </span>

                  {ingredients.length === 0 ? (
                    <p className="text-3xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/60">
                      ⚠️ No recipe mapped yet. Click Edit to link raw pantry items.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {ingredients.map((ing, idx) => (
                        <div key={idx} className="flex items-center justify-between text-2xs p-1.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {ing.ingredientName}
                          </span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-slate-500">{ing.quantityRequired} {ing.unit}</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{formatNPR(ing.totalCost)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Quick Button */}
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-3xs text-slate-400">
                  Auto-depletes on KOT
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenEditRecipe(dish)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Configure Recipe</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Recipe BOM Modal */}
      {isEditModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-blue-600" />
                  <span>Recipe BOM: {selectedProduct.name}</span>
                </h3>
                <p className="text-3xs text-slate-500 mt-0.5">
                  Retail Price: {formatNPR(selectedProduct.retailPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Required Ingredients
                </span>
                <button
                  type="button"
                  onClick={handleAddIngredientRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 rounded-lg text-xs font-semibold cursor-pointer hover:bg-blue-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Ingredient</span>
                </button>
              </div>

              {activeRecipe.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <Scale className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">No ingredients added to this dish yet.</p>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    + Click here to add the first ingredient
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeRecipe.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                      {/* Ingredient selector */}
                      <div className="flex-1">
                        <select
                          value={row.ingredientId}
                          onChange={(e) => handleIngredientChange(idx, e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                        >
                          {rawIngredients.map(raw => (
                            <option key={raw.id} value={raw.id}>
                              {raw.name} ({raw.unit}) - Cost: {formatNPR(raw.costPrice)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity input */}
                      <div className="w-24">
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={row.quantityRequired}
                            onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-full text-xs p-1.5 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right font-mono"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-3xs text-slate-400 font-bold">
                            {row.unit}
                          </span>
                        </div>
                      </div>

                      {/* Total Cost calculation */}
                      <div className="w-24 text-right">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatNPR(row.totalCost)}
                        </span>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Recipe Cost Summary */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800 flex items-center justify-between">
                <div>
                  <span className="text-3xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                    Total Recipe Food Cost
                  </span>
                  <p className="text-lg font-black text-blue-700 dark:text-blue-300">
                    {formatNPR(totalRecipeCost)}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-3xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                    Calculated Food Cost %
                  </span>
                  <p className="text-lg font-black text-blue-700 dark:text-blue-300">
                    {selectedProduct.retailPrice > 0 ? Math.round((totalRecipeCost / selectedProduct.retailPrice) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRecipe}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
              >
                Save Recipe BOM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
