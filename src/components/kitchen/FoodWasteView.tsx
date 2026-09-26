import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, Trash2, Plus, Search, Calendar, 
  DollarSign, TrendingDown, Flame, Coffee, X, 
  CheckCircle2, Filter, Sparkles, ChefHat, BarChart2,
  Package, Boxes, ArrowRight, UserCheck, ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodWasteRecord, Product } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';

export const FoodWasteView: React.FC = () => {
  const { foodWasteRecords, logFoodWaste, deleteFoodWaste, products, staffMembers, masterRecipes } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'raw_ingredient' | 'finished_dish'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [wasteItemType, setWasteItemType] = useState<'finished_dish' | 'raw_ingredient'>('finished_dish');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<FoodWasteRecord['reason']>('cooking_error_burned');
  const [loggedBy, setLoggedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Finished dishes
  const finishedDishes = useMemo(() => {
    return products.filter(p => p.itemType === 'menu_item' || !p.itemType || p.department === 'Food' || p.department === 'Drink');
  }, [products]);

  // Raw pantry ingredients
  const rawIngredients = useMemo(() => {
    return products.filter(p => p.itemType === 'raw_ingredient' || (!p.itemType && (p.category || '').toLowerCase().includes('raw')));
  }, [products]);

  // Current list based on wasteItemType
  const availableItems = useMemo(() => {
    return wasteItemType === 'finished_dish' ? finishedDishes : rawIngredients;
  }, [wasteItemType, finishedDishes, rawIngredients]);

  const currentSelectedProduct = useMemo(() => {
    return availableItems.find(p => p.id === selectedProductId) || availableItems[0];
  }, [availableItems, selectedProductId]);

  const handleOpenLogModal = () => {
    if (finishedDishes.length > 0) {
      setWasteItemType('finished_dish');
      setSelectedProductId(finishedDishes[0].id);
    } else if (rawIngredients.length > 0) {
      setWasteItemType('raw_ingredient');
      setSelectedProductId(rawIngredients[0].id);
    }
    setQuantity(1);
    setReason('cooking_error_burned');
    setLoggedBy(staffMembers[0]?.name || 'Head Chef');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSelectedProduct || quantity <= 0) return;

    const costPer = currentSelectedProduct.costPrice || 0;
    const totalLoss = Math.round(costPer * quantity);

    await logFoodWaste({
      date: new Date().toISOString().split('T')[0],
      productId: currentSelectedProduct.id,
      productName: currentSelectedProduct.name,
      category: currentSelectedProduct.category || 'Kitchen Food',
      quantity,
      unit: currentSelectedProduct.unit || (wasteItemType === 'finished_dish' ? 'portion' : 'kg'),
      costPerUnit: costPer,
      totalLoss,
      reason,
      loggedBy: loggedBy || 'Kitchen Staff',
      notes,
      itemType: wasteItemType
    });

    setIsModalOpen(false);
  };

  const filteredRecords = useMemo(() => {
    return foodWasteRecords.filter(r => {
      const matchSearch = r.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.loggedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchReason = reasonFilter === 'all' || r.reason === reasonFilter;
      const matchType = typeFilter === 'all' || r.itemType === typeFilter;
      return matchSearch && matchReason && matchType;
    });
  }, [foodWasteRecords, searchTerm, reasonFilter, typeFilter]);

  // Statistics
  const totalLossAllTime = useMemo(() => {
    return foodWasteRecords.reduce((sum, r) => sum + r.totalLoss, 0);
  }, [foodWasteRecords]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLoss = useMemo(() => {
    return foodWasteRecords.filter(r => r.date === todayStr).reduce((sum, r) => sum + r.totalLoss, 0);
  }, [foodWasteRecords, todayStr]);

  // Loss breakdown by reason
  const lossByReason = useMemo(() => {
    const reasons: Record<string, number> = {
      cooking_error_burned: 0,
      spoilage_expired: 0,
      customer_return: 0,
      prep_trimming: 0,
      spilled_dropped: 0
    };

    foodWasteRecords.forEach(r => {
      if (reasons[r.reason] !== undefined) {
        reasons[r.reason] += r.totalLoss;
      }
    });

    return reasons;
  }, [foodWasteRecords]);

  const getReasonBadge = (r: FoodWasteRecord['reason']) => {
    switch (r) {
      case 'cooking_error_burned':
        return { label: 'Burned / Overcooked', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200' };
      case 'spoilage_expired':
        return { label: 'Spoiled / Expired', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200' };
      case 'customer_return':
        return { label: 'Customer Returned', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200' };
      case 'prep_trimming':
        return { label: 'Prep / Trimming Loss', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200' };
      case 'spilled_dropped':
        return { label: 'Dropped / Spilled', color: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 border-orange-200' };
      default:
        return { label: r, color: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Food Waste &amp; Kitchen Spoilage Control</span>
            </h1>
            <span className="text-3xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-semibold border border-rose-200/50">
              Variance &amp; Leakage Audit
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track spoiled pantry ingredients and burned/dropped dishes. Automatically de-stocks recipe raw materials while auditing financial loss.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenLogModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Log Food Waste</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Today's Loss</span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {formatNPR(todayLoss)}
          </p>
          <span className="text-3xs text-slate-400">Financial leakage today</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Total Financial Loss</span>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {formatNPR(totalLossAllTime)}
          </p>
          <span className="text-3xs text-slate-400">Cumulative recorded cost</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Waste Incidents</span>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {foodWasteRecords.length}
          </p>
          <span className="text-3xs text-slate-400">Burned, dropped &amp; spoiled</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Auto Stock Deduction</span>
          <div className="flex items-center gap-1.5 mt-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Active &amp; Synced</span>
          </div>
          <span className="text-3xs text-slate-400">Pantry de-stocked on log</span>
        </div>
      </div>

      {/* Variance Breakdown by Reason */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-rose-600" />
            <span>Financial Loss Distribution by Incident Type</span>
          </h2>
          <span className="text-3xs text-slate-400">Where food cost leaks happen</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { key: 'cooking_error_burned', label: 'Burned / Overcooked', amount: lossByReason.cooking_error_burned, color: 'bg-rose-500' },
            { key: 'spoilage_expired', label: 'Spoiled / Expired', amount: lossByReason.spoilage_expired, color: 'bg-amber-500' },
            { key: 'customer_return', label: 'Customer Return', amount: lossByReason.customer_return, color: 'bg-purple-500' },
            { key: 'spilled_dropped', label: 'Dropped / Spilled', amount: lossByReason.spilled_dropped, color: 'bg-orange-500' },
            { key: 'prep_trimming', label: 'Prep Trimming Loss', amount: lossByReason.prep_trimming, color: 'bg-blue-500' }
          ].map(item => {
            const pct = totalLossAllTime > 0 ? Math.round((item.amount / totalLossAllTime) * 100) : 0;
            return (
              <div key={item.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <span className="text-3xs font-semibold text-slate-500 block truncate">{item.label}</span>
                <span className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 block">
                  {formatNPR(item.amount)}
                </span>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-3xs text-slate-400">{pct}% of total</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters & Log Table */}
      <div className="space-y-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search waste logs by dish, ingredient, notes, or staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium cursor-pointer"
            >
              <option value="all">All Item Types</option>
              <option value="finished_dish">Finished Menu Dishes</option>
              <option value="raw_ingredient">Raw Pantry Ingredients</option>
            </select>

            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium cursor-pointer"
            >
              <option value="all">All Waste Reasons</option>
              <option value="cooking_error_burned">Burned / Overcooked</option>
              <option value="spoilage_expired">Spoiled / Expired</option>
              <option value="customer_return">Customer Returned</option>
              <option value="spilled_dropped">Dropped / Spilled</option>
              <option value="prep_trimming">Prep Trimming Loss</option>
            </select>
          </div>

          <div className="text-3xs text-slate-400">
            Showing {filteredRecords.length} records
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-3xs uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 font-bold">Date &amp; Time</th>
                  <th className="py-3 px-4 font-bold">Wasted Item</th>
                  <th className="py-3 px-4 font-bold">Item Type</th>
                  <th className="py-3 px-4 font-bold">Reason</th>
                  <th className="py-3 px-4 font-bold text-right">Quantity</th>
                  <th className="py-3 px-4 font-bold text-right">Unit Cost</th>
                  <th className="py-3 px-4 font-bold text-right">Total Financial Loss</th>
                  <th className="py-3 px-4 font-bold">Logged By &amp; Notes</th>
                  <th className="py-3 px-4 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                      No food waste incidents recorded. Click "+ Log Food Waste" to report spoiled or burned food.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(r => {
                    const badge = getReasonBadge(r.reason);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-3xs text-slate-500 font-mono">
                          {r.date}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">
                            {r.productName}
                          </span>
                          <span className="text-3xs text-slate-400 font-medium">
                            {r.category}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {r.itemType === 'finished_dish' ? (
                            <span className="text-3xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200/50">
                              Finished Dish
                            </span>
                          ) : (
                            <span className="text-3xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                              Raw Pantry Stock
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-block text-3xs px-2 py-0.5 rounded-full font-semibold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {r.quantity} {r.unit}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {formatNPR(r.costPerUnit)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                          -{formatNPR(r.totalLoss)}
                        </td>

                        <td className="py-3 px-4 max-w-[200px]">
                          <span className="text-3xs font-semibold text-slate-700 dark:text-slate-300 block">
                            {r.loggedBy}
                          </span>
                          {r.notes && (
                            <span className="text-3xs text-slate-400 truncate block">
                              "{r.notes}"
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete waste record for "${r.productName}"?`)) {
                                deleteFoodWaste(r.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* LOG FOOD WASTE MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Log Kitchen Food Waste &amp; Spoilage</span>
                </h3>
                <p className="text-3xs text-slate-400">
                  Deducts inventory stock and accounts for financial food cost leakage
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Item Type Switcher: Finished Dish vs Raw Ingredient */}
              <div className="space-y-1">
                <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Type of Waste Incident:
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-3xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setWasteItemType('finished_dish');
                      if (finishedDishes.length > 0) setSelectedProductId(finishedDishes[0].id);
                    }}
                    className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      wasteItemType === 'finished_dish'
                        ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>Finished Menu Dish (Plate)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWasteItemType('raw_ingredient');
                      if (rawIngredients.length > 0) setSelectedProductId(rawIngredients[0].id);
                    }}
                    className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      wasteItemType === 'raw_ingredient'
                        ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Raw Pantry Ingredient</span>
                  </button>
                </div>
              </div>

              {/* Product Selector */}
              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select {wasteItemType === 'finished_dish' ? 'Menu Dish' : 'Raw Pantry Ingredient'} *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {availableItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} • Cost: {formatNPR(item.costPrice || 0)} / {item.unit || (wasteItemType === 'finished_dish' ? 'portion' : 'kg')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notice for finished dish auto-depletion */}
              {wasteItemType === 'finished_dish' && (
                <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-900/60 text-3xs text-purple-900 dark:text-purple-300 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Automated Recipe Depletion:</strong> Logging a finished dish will automatically deduct the underlying master recipe ingredients (meat, flour, spices) from kitchen pantry stock!
                  </span>
                </div>
              )}

              {/* Quantity & Reason */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Wasted Quantity ({currentSelectedProduct?.unit || (wasteItemType === 'finished_dish' ? 'portions' : 'kg')}) *
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Incident Reason *
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="cooking_error_burned">Burned / Overcooked / Chef Error</option>
                    <option value="spoilage_expired">Spoiled / Rotten / Past Expiry</option>
                    <option value="customer_return">Customer Return / Plate Waste</option>
                    <option value="spilled_dropped">Dropped Plate / Floor Spill</option>
                    <option value="prep_trimming">Prep Trimming / Over-portioning</option>
                  </select>
                </div>
              </div>

              {/* Logged by & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Logged By *
                  </label>
                  <select
                    value={loggedBy}
                    onChange={(e) => setLoggedBy(e.target.value)}
                    className="w-full p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {staffMembers.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                    ))}
                    <option value="Head Chef">Head Chef</option>
                    <option value="Commis Kitchen">Commis Kitchen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Loss Calculation
                  </label>
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-xs font-bold font-mono text-rose-700 dark:text-rose-300 text-right">
                    -{formatNPR(Math.round((currentSelectedProduct?.costPrice || 0) * quantity))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Incident Notes / Corrective Action (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Steamer timer failed, momo skin ruptured..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Log Loss &amp; Deduct Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
