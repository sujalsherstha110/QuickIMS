import React, { useState, useMemo } from 'react';
import { 
  ChefHat, Boxes, Plus, Edit2, Search, ArrowRight, 
  Trash2, Scale, Percent, AlertTriangle, CheckCircle2, 
  X, Sparkles, BookOpen, Layers, Link2, Unlink, ExternalLink,
  Clock, Calendar, DollarSign, Filter, RefreshCw, Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, RecipeIngredient, KitchenMasterRecipe } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';

export const RecipesView: React.FC = () => {
  const { 
    products, updateProduct, masterRecipes, 
    addMasterRecipe, updateMasterRecipe, deleteMasterRecipe 
  } = useApp();

  // Active top tab: 'dishes' (Menu dishes & Food Costing), 'master' (Kitchen Master Recipes & Preps), 'pantry' (Raw Ingredients Directory)
  const [activeTab, setActiveTab] = useState<'dishes' | 'master' | 'pantry'>('dishes');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [foodCostFilter, setFoodCostFilter] = useState<'all' | 'optimal' | 'target' | 'warning' | 'uncosted'>('all');

  // Available raw ingredients in inventory
  const rawIngredients = useMemo(() => {
    return products.filter(p => p.itemType === 'raw_ingredient' || (!p.itemType && (p.category || '').toLowerCase().includes('raw')));
  }, [products]);

  // Menu items (dishes) that can have recipes
  const menuItems = useMemo(() => {
    return products.filter(p => p.itemType === 'menu_item' || !p.itemType || p.department === 'Food' || p.department === 'Drink' || p.department === 'Combos');
  }, [products]);

  // Distinct dish categories
  const dishCategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [menuItems]);

  // Distinct raw ingredient categories
  const rawCategories = useMemo(() => {
    const set = new Set<string>();
    rawIngredients.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [rawIngredients]);

  // Helper to dynamically calculate current portion cost of any master recipe based on live pantry prices
  const getLiveMasterRecipeCost = (recipe: KitchenMasterRecipe) => {
    let batchCost = 0;
    (recipe.ingredients || []).forEach(ing => {
      const raw = rawIngredients.find(r => r.id === ing.ingredientId || r.name.toLowerCase() === ing.ingredientName.toLowerCase());
      const livePrice = raw ? (raw.costPrice || 0) : (ing.costPerUnit || 0);
      batchCost += (ing.quantityRequired || 0) * livePrice;
    });
    const yieldQty = recipe.yieldQuantity > 0 ? recipe.yieldQuantity : 1;
    return {
      batchCost: Math.round(batchCost * 10) / 10,
      portionCost: Math.round((batchCost / yieldQty) * 10) / 10
    };
  };

  // Helper to calculate live BOM cost of a menu dish
  const getDishDynamicBOM = (dish: Product) => {
    if (dish.linkedRecipeId) {
      const master = masterRecipes.find(r => r.id === dish.linkedRecipeId);
      if (master) {
        const { portionCost } = getLiveMasterRecipeCost(master);
        const fcPct = dish.retailPrice > 0 ? Math.round((portionCost / dish.retailPrice) * 100) : 0;
        return {
          cost: portionCost,
          fcPct,
          isLinked: true,
          recipeName: master.name,
          recipeType: master.type
        };
      }
    }

    if (dish.recipeIngredients && dish.recipeIngredients.length > 0) {
      let cost = 0;
      dish.recipeIngredients.forEach(ing => {
        const raw = rawIngredients.find(r => r.id === ing.ingredientId || r.name.toLowerCase() === ing.ingredientName.toLowerCase());
        const livePrice = raw ? (raw.costPrice || 0) : (ing.costPerUnit || 0);
        cost += (ing.quantityRequired || 0) * livePrice;
      });
      cost = Math.round(cost * 10) / 10;
      const fcPct = dish.retailPrice > 0 ? Math.round((cost / dish.retailPrice) * 100) : 0;
      return {
        cost,
        fcPct,
        isLinked: false,
        recipeName: `Custom (${dish.recipeIngredients.length} ing.)`,
        recipeType: 'custom'
      };
    }

    return {
      cost: dish.costPrice || 0,
      fcPct: (dish.retailPrice > 0 && dish.costPrice) ? Math.round((dish.costPrice / dish.retailPrice) * 100) : 0,
      isLinked: false,
      recipeName: 'Uncosted',
      recipeType: 'none'
    };
  };

  // Filtered Menu Dishes
  const filteredDishes = useMemo(() => {
    return menuItems.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilter === 'all' || item.category === categoryFilter;

      if (!matchSearch || !matchCat) return false;

      const bom = getDishDynamicBOM(item);
      if (foodCostFilter === 'optimal' && (bom.cost === 0 || bom.fcPct > 30)) return false;
      if (foodCostFilter === 'target' && (bom.fcPct <= 30 || bom.fcPct > 38)) return false;
      if (foodCostFilter === 'warning' && bom.fcPct <= 38) return false;
      if (foodCostFilter === 'uncosted' && (bom.cost > 0 || item.linkedRecipeId || (item.recipeIngredients && item.recipeIngredients.length > 0))) return false;

      return true;
    });
  }, [menuItems, searchTerm, categoryFilter, foodCostFilter, masterRecipes, rawIngredients]);

  // Executive KPI stats
  const { totalDishes, costedDishesCount, avgFoodCostPercent, highRiskCount } = useMemo(() => {
    let costedCount = 0;
    let sumFcPct = 0;
    let highRisk = 0;

    menuItems.forEach(item => {
      const bom = getDishDynamicBOM(item);
      if (bom.cost > 0 || item.linkedRecipeId || (item.recipeIngredients && item.recipeIngredients.length > 0)) {
        costedCount += 1;
        sumFcPct += bom.fcPct;
        if (bom.fcPct > 35) highRisk += 1;
      }
    });

    const avgFc = costedCount > 0 ? Math.round(sumFcPct / costedCount) : 0;

    return {
      totalDishes: menuItems.length,
      costedDishesCount: costedCount,
      avgFoodCostPercent: avgFc,
      highRiskCount: highRisk
    };
  }, [menuItems, masterRecipes, rawIngredients]);

  // ==================== DISH RECIPE MAPPING MODAL ====================
  const [mappingModal, setMappingModal] = useState<{
    open: boolean;
    dish: Product | null;
    mode: 'master' | 'custom' | 'none';
    linkedRecipeId?: string;
    customIngredients: RecipeIngredient[];
  }>({
    open: false,
    dish: null,
    mode: 'master',
    customIngredients: []
  });

  const handleOpenDishMapping = (dish: Product) => {
    const isMaster = !!dish.linkedRecipeId;
    const isCustom = !isMaster && !!(dish.recipeIngredients && dish.recipeIngredients.length > 0);
    const initialMode: 'master' | 'custom' | 'none' = isMaster ? 'master' : isCustom ? 'custom' : 'master';

    setMappingModal({
      open: true,
      dish,
      mode: initialMode,
      linkedRecipeId: dish.linkedRecipeId || (masterRecipes[0]?.id),
      customIngredients: dish.recipeIngredients ? [...dish.recipeIngredients] : []
    });
  };

  const handleSaveDishMapping = async () => {
    if (!mappingModal.dish) return;
    const dish = mappingModal.dish;

    if (mappingModal.mode === 'master') {
      const master = masterRecipes.find(r => r.id === mappingModal.linkedRecipeId);
      const { portionCost } = master ? getLiveMasterRecipeCost(master) : { portionCost: 0 };
      await updateProduct(dish.id, {
        linkedRecipeId: master ? master.id : undefined,
        linkedRecipeName: master ? master.name : undefined,
        recipeIngredients: [],
        costPrice: portionCost
      });
    } else if (mappingModal.mode === 'custom') {
      let cost = 0;
      mappingModal.customIngredients.forEach(ing => {
        cost += ing.totalCost || 0;
      });
      await updateProduct(dish.id, {
        linkedRecipeId: undefined,
        linkedRecipeName: undefined,
        recipeIngredients: mappingModal.customIngredients,
        costPrice: Math.round(cost * 10) / 10
      });
    } else {
      await updateProduct(dish.id, {
        linkedRecipeId: undefined,
        linkedRecipeName: undefined,
        recipeIngredients: []
      });
    }

    setMappingModal(prev => ({ ...prev, open: false }));
  };

  // ==================== MASTER RECIPE MODAL ====================
  const [masterRecipeModal, setMasterRecipeModal] = useState<{
    open: boolean;
    editingRecipeId?: string;
    name: string;
    category: string;
    type: 'portion_prep' | 'batch_prep';
    yieldQuantity: number;
    yieldUnit: string;
    prepTimeMinutes: number;
    shelfLife: string;
    instructions: string;
    ingredients: {
      ingredientId?: string;
      ingredientName: string;
      category?: string;
      quantityRequired: number;
      unit: string;
      costPerUnit: number;
      totalCost: number;
    }[];
  }>({
    open: false,
    name: '',
    category: 'Momo',
    type: 'portion_prep',
    yieldQuantity: 1,
    yieldUnit: 'plate (10 pcs)',
    prepTimeMinutes: 15,
    shelfLife: 'Freshly prepared',
    instructions: '',
    ingredients: []
  });

  const handleOpenCreateMasterRecipe = () => {
    const defaultRaw = rawIngredients[0];
    setMasterRecipeModal({
      open: true,
      name: '',
      category: 'Momo',
      type: 'portion_prep',
      yieldQuantity: 1,
      yieldUnit: 'plate (10 pcs)',
      prepTimeMinutes: 15,
      shelfLife: 'Freshly prepared',
      instructions: '',
      ingredients: defaultRaw ? [
        {
          ingredientId: defaultRaw.id,
          ingredientName: defaultRaw.name,
          category: defaultRaw.category,
          quantityRequired: 0.15,
          unit: defaultRaw.unit || 'kg',
          costPerUnit: defaultRaw.costPrice || 0,
          totalCost: Math.round(0.15 * (defaultRaw.costPrice || 0) * 10) / 10
        }
      ] : []
    });
  };

  const handleOpenEditMasterRecipe = (recipe: KitchenMasterRecipe) => {
    setMasterRecipeModal({
      open: true,
      editingRecipeId: recipe.id,
      name: recipe.name,
      category: recipe.category,
      type: recipe.type,
      yieldQuantity: recipe.yieldQuantity,
      yieldUnit: recipe.yieldUnit,
      prepTimeMinutes: recipe.prepTimeMinutes || 15,
      shelfLife: recipe.shelfLife || 'Freshly prepared',
      instructions: recipe.instructions || '',
      ingredients: recipe.ingredients ? recipe.ingredients.map(ing => ({ ...ing })) : []
    });
  };

  const handleAddMasterRecipeRow = () => {
    const defaultRaw = rawIngredients[0];
    const newRow = {
      ingredientId: defaultRaw?.id || '',
      ingredientName: defaultRaw?.name || 'Raw Ingredient',
      category: defaultRaw?.category || 'General',
      quantityRequired: 0.1,
      unit: defaultRaw?.unit || 'kg',
      costPerUnit: defaultRaw?.costPrice || 0,
      totalCost: defaultRaw ? Math.round(0.1 * (defaultRaw.costPrice || 0) * 10) / 10 : 0
    };

    setMasterRecipeModal(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, newRow]
    }));
  };

  const handleUpdateMasterIngredientRow = (index: number, updates: any) => {
    setMasterRecipeModal(prev => {
      const copy = [...prev.ingredients];
      const cur = copy[index];
      const merged = { ...cur, ...updates };

      const qty = typeof merged.quantityRequired === 'number' ? merged.quantityRequired : 0;
      const cost = typeof merged.costPerUnit === 'number' ? merged.costPerUnit : 0;
      merged.totalCost = Math.round(qty * cost * 10) / 10;

      copy[index] = merged;
      return { ...prev, ingredients: copy };
    });
  };

  const handleRemoveMasterIngredientRow = (index: number) => {
    setMasterRecipeModal(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const masterModalBatchCost = useMemo(() => {
    return masterRecipeModal.ingredients.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  }, [masterRecipeModal.ingredients]);

  const masterModalPortionCost = useMemo(() => {
    const yieldQty = masterRecipeModal.yieldQuantity > 0 ? masterRecipeModal.yieldQuantity : 1;
    return Math.round((masterModalBatchCost / yieldQty) * 10) / 10;
  }, [masterModalBatchCost, masterRecipeModal.yieldQuantity]);

  const handleSaveMasterRecipe = async () => {
    if (!masterRecipeModal.name.trim()) {
      alert('Please enter a recipe name');
      return;
    }

    const payload = {
      name: masterRecipeModal.name.trim(),
      category: masterRecipeModal.category,
      type: masterRecipeModal.type,
      yieldQuantity: masterRecipeModal.yieldQuantity,
      yieldUnit: masterRecipeModal.yieldUnit,
      prepTimeMinutes: masterRecipeModal.prepTimeMinutes,
      shelfLife: masterRecipeModal.shelfLife,
      instructions: masterRecipeModal.instructions,
      costPerPortion: masterModalPortionCost,
      totalBatchCost: masterModalBatchCost,
      ingredients: masterRecipeModal.ingredients
    };

    if (masterRecipeModal.editingRecipeId) {
      await updateMasterRecipe(masterRecipeModal.editingRecipeId, payload);
    } else {
      await addMasterRecipe(payload);
    }

    setMasterRecipeModal(prev => ({ ...prev, open: false }));
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Executive Cost Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span>Recipes, BOMs &amp; Kitchen Food Costing</span>
            </h1>
            <span className="text-3xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/50">
              Theoretical Cost Control
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Map dish recipes dynamically to raw stock, audit portion food costs (28-32% target), and automate live stock deduction upon POS sales.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenCreateMasterRecipe}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Master Recipe</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Recipe Coverage</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100">
              {costedDishesCount} / {totalDishes}
            </span>
            <span className="text-xs font-bold text-emerald-600">
              ({totalDishes > 0 ? Math.round((costedDishesCount / totalDishes) * 100) : 0}%)
            </span>
          </div>
          <span className="text-3xs text-slate-400">Dishes with mapped recipes</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Avg. Food Cost</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-xl font-black ${
              avgFoodCostPercent > 35 ? 'text-rose-600' : avgFoodCostPercent <= 30 ? 'text-emerald-600' : 'text-indigo-600'
            }`}>
              {avgFoodCostPercent}%
            </span>
            <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Target: 28-32%
            </span>
          </div>
          <span className="text-3xs text-slate-400">Weighted menu theoretical</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Master Kitchen BOMs</span>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
            {masterRecipes.length}
          </p>
          <span className="text-3xs text-slate-400">Plates &amp; batch prep bases</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Pantry Raw Stock</span>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {rawIngredients.length} Items
          </p>
          <span className="text-3xs text-slate-400">Tracked ingredients &amp; spices</span>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold">
        {[
          { id: 'dishes', label: '1. Menu Dishes & Live Costing', icon: BookOpen, count: menuItems.length },
          { id: 'master', label: '2. Master Recipes & Batch Preps', icon: ChefHat, count: masterRecipes.length },
          { id: 'pantry', label: '3. Raw Ingredients & Pantry Directory', icon: Boxes, count: rawIngredients.length }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`text-3xs px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MENU DISHES & FOOD COSTING */}
      {/* ========================================================================= */}
      {activeTab === 'dishes' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search dish by name, category, or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium cursor-pointer"
              >
                <option value="all">All Categories</option>
                {dishCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Food Cost Health Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto text-3xs font-bold">
              {[
                { id: 'all', label: 'All Dishes' },
                { id: 'optimal', label: '✓ Optimal (<30%)' },
                { id: 'target', label: '✓ Target (30-38%)' },
                { id: 'warning', label: '⚠️ High Cost (>38%)' },
                { id: 'uncosted', label: '⚪ Uncosted' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFoodCostFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
                    foodCostFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dishes Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-3xs uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 font-bold">Menu Dish / Offering</th>
                    <th className="py-3 px-4 font-bold">Category</th>
                    <th className="py-3 px-4 font-bold text-right">Selling Price</th>
                    <th className="py-3 px-4 font-bold">Mapped Recipe / BOM</th>
                    <th className="py-3 px-4 font-bold text-right">BOM Portion Cost</th>
                    <th className="py-3 px-4 font-bold text-center">Food Cost %</th>
                    <th className="py-3 px-4 font-bold text-right">Gross Margin</th>
                    <th className="py-3 px-4 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDishes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                        No dishes match your selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredDishes.map(dish => {
                      const bom = getDishDynamicBOM(dish);
                      const margin = Math.max(0, dish.retailPrice - bom.cost);
                      const marginPct = dish.retailPrice > 0 ? Math.round((margin / dish.retailPrice) * 100) : 0;

                      return (
                        <tr key={dish.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">
                              {dish.name}
                            </span>
                            <span className="text-3xs text-slate-400 font-mono">
                              SKU: {dish.sku}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-3xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                              {dish.category || 'General'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatNPR(dish.retailPrice)}
                          </td>

                          <td className="py-3 px-4">
                            {bom.isLinked ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-3xs font-semibold border border-purple-200/50">
                                <Link2 className="w-3 h-3" />
                                <span className="truncate max-w-[160px]">{bom.recipeName}</span>
                              </span>
                            ) : dish.recipeIngredients && dish.recipeIngredients.length > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-3xs font-semibold border border-indigo-200/50">
                                <ChefHat className="w-3 h-3" />
                                <span>{dish.recipeIngredients.length} Ingredients</span>
                              </span>
                            ) : (
                              <span className="text-3xs text-slate-400 italic">
                                Uncosted / Pending
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {bom.cost > 0 ? formatNPR(bom.cost) : '—'}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {bom.cost > 0 ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-3xs font-black ${
                                bom.fcPct > 35 
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400' 
                                  : bom.fcPct <= 30
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400'
                              }`}>
                                {bom.fcPct}%
                              </span>
                            ) : (
                              <span className="text-3xs text-slate-400">0%</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                              +{formatNPR(margin)}
                            </span>
                            <span className="text-3xs text-slate-400">
                              {marginPct}% margin
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenDishMapping(dish)}
                              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-lg text-3xs font-bold cursor-pointer transition-colors border border-indigo-200/50 inline-flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>{dish.linkedRecipeId || (dish.recipeIngredients && dish.recipeIngredients.length > 0) ? 'Edit Recipe' : 'Map Recipe'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER RECIPES & BATCH PREPS */}
      {/* ========================================================================= */}
      {activeTab === 'master' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Master Kitchen Recipe Catalog &amp; Sub-Preps
              </h2>
              <p className="text-2xs text-slate-500">
                Standard plate formulas, gravies, marinades, and coffee bases. Multiple POS dishes can link to one master recipe.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateMasterRecipe}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Master Recipe</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {masterRecipes.map(recipe => {
              const { batchCost, portionCost } = getLiveMasterRecipeCost(recipe);
              const linkedDishesCount = menuItems.filter(m => m.linkedRecipeId === recipe.id).length;

              return (
                <div key={recipe.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                  {/* Top Row: Title, Category, Action buttons */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {recipe.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-3xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/50">
                          {recipe.category}
                        </span>
                        <span className="text-3xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {recipe.type === 'portion_prep' ? 'Portion Template' : 'Batch Sub-Prep'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMasterRecipe(recipe)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                        title="Edit Master Recipe"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete master recipe "${recipe.name}"?`)) {
                            deleteMasterRecipe(recipe.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                        title="Delete Master Recipe"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Yield & Cost Breakdown Card */}
                  <div className="bg-indigo-50/60 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                    <div className="flex items-center justify-between text-2xs">
                      <span className="text-slate-500 font-medium">Recipe Yield:</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-mono">
                        {recipe.yieldQuantity} {recipe.yieldUnit}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-2xs">
                      <span className="text-slate-500 font-medium">Total Batch Cost:</span>
                      <strong className="text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                        {formatNPR(batchCost)}
                      </strong>
                    </div>

                    <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-900/50 flex items-center justify-between text-xs font-bold">
                      <span className="text-indigo-900 dark:text-indigo-200">Cost Per Portion / Unit:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                        {formatNPR(portionCost)}
                      </span>
                    </div>
                  </div>

                  {/* Ingredients Preview */}
                  <div className="space-y-1.5">
                    <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                      Ingredients ({recipe.ingredients?.length || 0})
                    </span>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                      {(recipe.ingredients || []).map((ing, i) => (
                        <div key={i} className="flex items-center justify-between text-3xs text-slate-600 dark:text-slate-400">
                          <span className="truncate max-w-[150px] font-medium">{ing.ingredientName}</span>
                          <span className="font-mono text-slate-500 shrink-0">
                            {ing.quantityRequired} {ing.unit} ({formatNPR(ing.totalCost)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer tags */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-3xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{recipe.prepTimeMinutes || 15} mins</span>
                    </span>

                    <span className="flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                      <Link2 className="w-3 h-3" />
                      <span>{linkedDishesCount} dishes linked</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RAW INGREDIENTS & PANTRY DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'pantry' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search raw ingredient by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-hidden text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-3xs text-slate-400">Total Valuation:</span>
              <strong className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatNPR(rawIngredients.reduce((s, r) => s + ((r.currentStock || 0) * (r.costPrice || 0)), 0))}
              </strong>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-3xs uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 font-bold">Raw Material</th>
                    <th className="py-3 px-4 font-bold">Category</th>
                    <th className="py-3 px-4 font-bold text-right">Cost Price / Unit</th>
                    <th className="py-3 px-4 font-bold text-right">Pantry Stock</th>
                    <th className="py-3 px-4 font-bold text-right">Total Valuation</th>
                    <th className="py-3 px-4 font-bold">Reorder Alert</th>
                    <th className="py-3 px-4 font-bold">Used In Master Recipes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rawIngredients.map(raw => {
                    const isLow = (raw.currentStock || 0) <= (raw.reorderLevel || 5);
                    const val = (raw.currentStock || 0) * (raw.costPrice || 0);

                    // Find which master recipes use this raw ingredient
                    const matchingMasters = masterRecipes.filter(m => 
                      m.ingredients.some(ing => ing.ingredientId === raw.id || ing.ingredientName.toLowerCase() === raw.name.toLowerCase())
                    );

                    return (
                      <tr key={raw.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">
                            {raw.name}
                          </span>
                          <span className="text-3xs text-slate-400 font-mono">
                            SKU: {raw.sku}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-3xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            {raw.category}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatNPR(raw.costPrice)} / {raw.unit || 'kg'}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block font-mono font-bold text-xs ${
                            (raw.currentStock || 0) <= 0 
                              ? 'text-rose-600' 
                              : isLow 
                                ? 'text-amber-600' 
                                : 'text-slate-900 dark:text-slate-100'
                          }`}>
                            {raw.currentStock || 0} {raw.unit || 'kg'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatNPR(val)}
                        </td>

                        <td className="py-3 px-4">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 text-3xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Low Stock (&lt;={raw.reorderLevel})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Healthy</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {matchingMasters.length > 0 ? (
                              matchingMasters.map(m => (
                                <span key={m.id} className="text-3xs px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium">
                                  {m.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-3xs text-slate-400 italic">Not mapped yet</span>
                            )}
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
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DISH RECIPE MAPPING */}
      {/* ========================================================================= */}
      {mappingModal.open && mappingModal.dish && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-indigo-600" />
                  <span>Map Recipe to: {mappingModal.dish.name}</span>
                </h3>
                <p className="text-3xs text-slate-400">
                  Selling Price: {formatNPR(mappingModal.dish.retailPrice)} • Category: {mappingModal.dish.category}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMappingModal(prev => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode selection */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-3xs font-bold">
              <button
                type="button"
                onClick={() => setMappingModal(prev => ({ ...prev, mode: 'master' }))}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  mappingModal.mode === 'master' ? 'bg-indigo-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Link Master Recipe</span>
              </button>

              <button
                type="button"
                onClick={() => setMappingModal(prev => ({ ...prev, mode: 'custom' }))}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  mappingModal.mode === 'custom' ? 'bg-indigo-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Custom BOM</span>
              </button>

              <button
                type="button"
                onClick={() => setMappingModal(prev => ({ ...prev, mode: 'none' }))}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  mappingModal.mode === 'none' ? 'bg-indigo-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>No Recipe</span>
              </button>
            </div>

            {/* Mode details */}
            {mappingModal.mode === 'master' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Select Master Recipe:
                  </label>
                  <select
                    value={mappingModal.linkedRecipeId || ''}
                    onChange={(e) => setMappingModal(prev => ({ ...prev, linkedRecipeId: e.target.value }))}
                    className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                  >
                    <option value="">-- Choose Master Kitchen Recipe --</option>
                    {masterRecipes.map(mr => (
                      <option key={mr.id} value={mr.id}>
                        {mr.name} [{mr.category}] • Yield: {mr.yieldQuantity} {mr.yieldUnit}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const mr = masterRecipes.find(r => r.id === mappingModal.linkedRecipeId);
                  if (!mr) return null;
                  const { portionCost } = getLiveMasterRecipeCost(mr);
                  const fcPct = mappingModal.dish.retailPrice > 0 ? Math.round((portionCost / mappingModal.dish.retailPrice) * 100) : 0;

                  return (
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Portion Food Cost:</span>
                        <strong className="font-mono text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                          {formatNPR(portionCost)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Food Cost %:</span>
                        <span className={`font-mono font-bold ${fcPct > 35 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {fcPct}% {fcPct > 35 ? '(⚠️ High)' : '(✓ Healthy)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Gross Margin:</span>
                        <strong className="font-mono text-emerald-600">
                          +{formatNPR(Math.max(0, mappingModal.dish.retailPrice - portionCost))}
                        </strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {mappingModal.mode === 'none' && (
              <p className="text-2xs text-slate-500 p-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                This item will have no recipe bill of materials.
              </p>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMappingModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDishMapping}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MASTER RECIPE CREATOR / EDITOR */}
      {/* ========================================================================= */}
      {masterRecipeModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-indigo-600" />
                  <span>{masterRecipeModal.editingRecipeId ? 'Edit Master Recipe' : 'Create Master Kitchen Recipe'}</span>
                </h3>
                <p className="text-3xs text-slate-400">
                  Define production formula and batch yield for kitchen prep
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMasterRecipeModal(prev => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* General Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Recipe Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Buff Momo Standard Plate (10 pcs)"
                  value={masterRecipeModal.name}
                  onChange={(e) => setMasterRecipeModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={masterRecipeModal.category}
                  onChange={(e) => setMasterRecipeModal(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {['Momo', 'Curry & Gravy', 'Beverage Base', 'Bakery', 'General'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Recipe Type
                </label>
                <select
                  value={masterRecipeModal.type}
                  onChange={(e) => setMasterRecipeModal(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="portion_prep">Portion Template (Finished Plate)</option>
                  <option value="batch_prep">Batch Sub-Prep (Sauce / Gravy / Dough)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Yield Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={masterRecipeModal.yieldQuantity}
                    onChange={(e) => setMasterRecipeModal(prev => ({ ...prev, yieldQuantity: parseFloat(e.target.value) || 1 }))}
                    className="w-full p-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Yield Unit
                  </label>
                  <input
                    type="text"
                    placeholder="plate, portion, L, kg"
                    value={masterRecipeModal.yieldUnit}
                    onChange={(e) => setMasterRecipeModal(prev => ({ ...prev, yieldUnit: e.target.value }))}
                    className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Ingredients table builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Raw Ingredients Required (BOM):
                </span>
                <button
                  type="button"
                  onClick={handleAddMasterRecipeRow}
                  className="px-2.5 py-1 text-3xs font-bold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Add Ingredient</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {masterRecipeModal.ingredients.map((ing, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex-1 min-w-[160px]">
                      <select
                        value={ing.ingredientId || ing.ingredientName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const found = rawIngredients.find(r => r.id === val || r.name === val);
                          if (found) {
                            handleUpdateMasterIngredientRow(idx, {
                              ingredientId: found.id,
                              ingredientName: found.name,
                              category: found.category,
                              unit: found.unit || 'kg',
                              costPerUnit: found.costPrice || 0
                            });
                          } else {
                            handleUpdateMasterIngredientRow(idx, {
                              ingredientId: '',
                              ingredientName: val
                            });
                          }
                        }}
                        className="w-full p-1.5 text-2xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="">-- Select Raw Ingredient --</option>
                        {rawIngredients.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({formatNPR(r.costPrice)}/{r.unit || 'kg'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-20">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Qty"
                        value={ing.quantityRequired || ''}
                        onChange={(e) => handleUpdateMasterIngredientRow(idx, { quantityRequired: parseFloat(e.target.value) || 0 })}
                        className="w-full p-1.5 text-2xs font-mono font-bold text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div className="w-16">
                      <span className="text-3xs font-semibold text-slate-500 block text-center">
                        {ing.unit}
                      </span>
                    </div>

                    <div className="w-24 text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                      {formatNPR(ing.totalCost)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMasterIngredientRow(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-900 flex items-center justify-between text-xs font-bold">
              <div>
                <span className="text-slate-500 font-medium">Batch Total Cost: </span>
                <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold">{formatNPR(masterModalBatchCost)}</span>
              </div>

              <div>
                <span className="text-slate-500 font-medium">Cost Per Portion ({masterRecipeModal.yieldUnit}): </span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-black">{formatNPR(masterModalPortionCost)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMasterRecipeModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMasterRecipe}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
              >
                {masterRecipeModal.editingRecipeId ? 'Save Changes' : 'Create Master Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
