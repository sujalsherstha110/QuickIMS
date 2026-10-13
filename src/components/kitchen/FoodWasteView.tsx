import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, Trash2, Plus, Search, Calendar, 
  DollarSign, TrendingDown, Flame, Coffee, X, 
  CheckCircle2, Filter, Sparkles, ChefHat, BarChart2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodWasteRecord } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';
import { Button } from '../common/Button';

export const FoodWasteView: React.FC = () => {
  const { foodWasteRecords, logFoodWaste, deleteFoodWaste, products, staffMembers } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<FoodWasteRecord['reason']>('cooking_error_burned');
  const [loggedBy, setLoggedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Raw materials / stock items available to be logged as waste
  const stockItems = useMemo(() => {
    return products.filter(p => p.trackStock || p.itemType === 'raw_ingredient');
  }, [products]);

  const currentSelectedProduct = useMemo(() => {
    return stockItems.find(p => p.id === selectedProductId) || stockItems[0];
  }, [stockItems, selectedProductId]);

  const handleOpenLogModal = () => {
    if (stockItems.length > 0) {
      setSelectedProductId(stockItems[0].id);
    }
    setQuantity(1);
    setReason('cooking_error_burned');
    setLoggedBy(staffMembers[0]?.name || 'Kitchen Staff');
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
      category: currentSelectedProduct.category || 'General Food',
      quantity,
      unit: currentSelectedProduct.unit || 'unit',
      costPerUnit: costPer,
      totalLoss,
      reason,
      loggedBy: loggedBy || 'Kitchen Staff',
      notes
    });

    setIsModalOpen(false);
  };

  const filteredRecords = useMemo(() => {
    const q = String(searchTerm || '').toLowerCase();
    return foodWasteRecords.filter(r => {
      const matchSearch = String(r.productName || '').toLowerCase().includes(q) ||
                          String(r.loggedBy || '').toLowerCase().includes(q) ||
                          (r.notes && String(r.notes).toLowerCase().includes(q));
      const matchReason = reasonFilter === 'all' || r.reason === reasonFilter;
      return matchSearch && matchReason;
    });
  }, [foodWasteRecords, searchTerm, reasonFilter]);

  // Statistics
  const totalLossAllTime = useMemo(() => {
    return foodWasteRecords.reduce((sum, r) => sum + r.totalLoss, 0);
  }, [foodWasteRecords]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLoss = useMemo(() => {
    return foodWasteRecords.filter(r => r.date === todayStr).reduce((sum, r) => sum + r.totalLoss, 0);
  }, [foodWasteRecords, todayStr]);

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
      case 'order_cancellation_waste':
        return { label: 'Mid-Order Cancellation Waste', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200' };
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
              <span>Food Waste & Spoilage Control</span>
            </h1>
            <span className="text-3xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-semibold border border-rose-200/50">
              Kitchen Variance Tracker
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Log spoiled ingredients, dropped plates, burning errors, and automatically deduct stock while auditing cost leaks.
          </p>
        </div>

        <Button
          variant="danger"
          size="md"
          onClick={handleOpenLogModal}
          icon={<Plus className="w-4 h-4" />}
        >
          Log Food Waste
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider">Total Waste Incidents</span>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">{foodWasteRecords.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Today's Loss</span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{formatNPR(todayLoss)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Total Recorded Loss</span>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{formatNPR(totalLossAllTime)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Stock Auto-Deducted</span>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">100% Synced</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search wasted ingredient, chef, or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Waste Reasons</option>
            <option value="cooking_error_burned">Burned / Cooking Error</option>
            <option value="spoilage_expired">Spoiled / Expired</option>
            <option value="customer_return">Customer Returned</option>
            <option value="order_cancellation_waste">Mid-Order Cancellation Waste</option>
            <option value="prep_trimming">Prep Trimming</option>
            <option value="spilled_dropped">Spilled / Dropped</option>
          </select>
        </div>
      </div>

      {/* Waste Records Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase text-3xs font-bold">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Wasted Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Estimated Loss</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Reported By</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <Trash2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No food waste incidents logged. Keep up the high kitchen efficiency!
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const badge = getReasonBadge(rec.reason);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {rec.date}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {rec.productName}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {rec.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {rec.quantity} {rec.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatNPR(rec.totalLoss)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-3xs font-semibold px-2 py-0.5 rounded-md border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">
                        {rec.loggedBy}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {rec.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remove log for ${rec.productName}? Note: Stock won't automatically re-add.`)) {
                              deleteFoodWaste(rec.id);
                            }
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Delete entry"
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

      {/* Log Food Waste Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Log Food Waste & Deplete Stock</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4.5 space-y-3.5">
              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Item / Ingredient to Waste *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                >
                  {stockItems.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current Stock: {p.currentStock} {p.unit}) - Cost: {formatNPR(p.costPrice)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Wasted Quantity ({currentSelectedProduct?.unit || 'qty'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Calculated Loss
                  </label>
                  <div className="px-3 py-2 text-xs font-mono font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-200/60 dark:border-rose-900">
                    {formatNPR(Math.round((currentSelectedProduct?.costPrice || 0) * quantity))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Reason for Waste *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as FoodWasteRecord['reason'])}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="cooking_error_burned">Burned / Overcooked</option>
                  <option value="spoilage_expired">Spoiled / Expired in Storage</option>
                  <option value="customer_return">Customer Returned (Cold / Wrong Spec)</option>
                  <option value="prep_trimming">Excess Prep / Trimming Loss</option>
                  <option value="spilled_dropped">Dropped / Broken / Spilled</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Logged By (Staff Name)
                </label>
                <input
                  type="text"
                  value={loggedBy}
                  onChange={(e) => setLoggedBy(e.target.value)}
                  placeholder="e.g. Head Chef / Shift Lead"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Notes / Incident Details
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe what occurred, e.g. Tandoor temperature flare up"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  type="submit"
                >
                  Confirm & Deduct Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
