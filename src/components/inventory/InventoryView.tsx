import React, { useState, useMemo } from 'react';
import { 
  Boxes, Warehouse as WarehouseIcon, Wrench, 
  History, Search, Filter, AlertTriangle, CheckCircle2,
  Layers, Plus, X, ArrowLeftRight, ShoppingCart, Scale, Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';
import { StockItemDetailModal } from './StockItemDetailModal';
import { AddStockItemModal } from './AddStockItemModal';
import { StockItem } from '../../types';
import { Button } from '../common/Button';

interface InventoryViewProps {
  onNavigate?: (tab: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onNavigate }) => {
  const { 
    stockItems, stockMovements, suppliers, rawStockCategories
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'ledger'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState<boolean>(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStockItemForDetail, setSelectedStockItemForDetail] = useState<StockItem | null>(null);

  // Keep selected stock item in sync with fresh data in context
  const activeDetailStockItem = useMemo(() => {
    if (!selectedStockItemForDetail) return null;
    return stockItems.find(s => s.id === selectedStockItemForDetail.id) || selectedStockItemForDetail;
  }, [stockItems, selectedStockItemForDetail]);

  const categoriesList = rawStockCategories;

  // Executive Metric Calculations based on raw stock items
  const { totalValuation, totalUnitsCount, lowStockCount } = useMemo(() => {
    let val = 0;
    let units = 0;
    let lowCount = 0;

    stockItems.forEach(s => {
      const qty = Number(s.currentStock || 0);
      const cost = Number(s.costPrice || 0);
      val += qty * cost;
      units += qty;
      if (qty <= Number(s.minReorderLevel || 0)) {
        lowCount += 1;
      }
    });

    return {
      totalValuation: val,
      totalUnitsCount: units,
      lowStockCount: lowCount,
    };
  }, [stockItems]);

  // Filtered Stock Items for Table
  const filteredStockItems = useMemo(() => {
    return stockItems.filter(s => {
      if (selectedCategory !== 'all' && s.category !== selectedCategory) {
        return false;
      }
      if (showLowStockOnly && s.currentStock > s.minReorderLevel) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = String(searchQuery || '').toLowerCase();
        const matchesName = String(s.name || '').toLowerCase().includes(q);
        const matchesSku = String(s.sku || '').toLowerCase().includes(q);
        const matchesCategory = String(s.category || '').toLowerCase().includes(q);
        const matchesBrand = String(s.brand || '').toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesCategory && !matchesBrand) {
          return false;
        }
      }
      return true;
    });
  }, [stockItems, selectedCategory, showLowStockOnly, searchQuery]);

  return (
    <div className="space-y-4">
      
      {/* Top Header & Quick Action Buttons */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            Kitchen & Raw Material Stock
          </h1>
          <p className="text-2xs text-slate-500">
            Track ingredients by base units (kg, g, L, pcs), minimum safety thresholds, and direct supplier mapping.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary-arrow"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Stock Item
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'overview', label: 'Stock Valuation & Levels', icon: Boxes },
          { id: 'ledger', label: 'Detailed Stock Ledger', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20 inset'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STREAMLINED STOCK OVERVIEW & VALUATION */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          
          {/* 3 Executive Summary Snapshot Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Metric 1: Total Valuation */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Stock Valuation
                </p>
                <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 truncate">
                  {formatNPR(totalValuation)}
                </h3>
                <p className="text-3xs text-slate-400">Total capital invested in raw ingredients</p>
              </div>
            </div>

            {/* Metric 2: Total Items */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                <WarehouseIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                  Pantry Holdings
                </p>
                <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 truncate">
                  {stockItems.length} {stockItems.length === 1 ? 'item' : 'items'}
                </h3>
                <p className="text-3xs text-slate-400">Active tracked raw kitchen items</p>
              </div>
            </div>

            {/* Metric 3: Low Stock Alerts */}
            <div 
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`border rounded-xl p-3.5 shadow-xs flex items-center justify-between gap-3.5 cursor-pointer transition-all ${
                showLowStockOnly 
                  ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  lowStockCount > 0 
                    ? 'bg-rose-100 dark:bg-rose-950/70 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400' 
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                    Low Stock Alerts
                  </p>
                  <h3 className={`text-base font-bold font-mono truncate ${
                    lowStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
                  </h3>
                  <p className="text-3xs text-slate-400">
                    {showLowStockOnly ? 'Filtered: Showing low stock' : 'Click to filter items below safety level'}
                  </p>
                </div>
              </div>
              <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                showLowStockOnly 
                  ? 'bg-rose-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {showLowStockOnly ? 'Active' : 'Filter'}
              </span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search raw items, category, brand, SKU..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            {categoriesList.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {(searchQuery || selectedCategory !== 'all' || showLowStockOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setShowLowStockOnly(false);
                    }}
                    className="px-2.5 py-2 text-3xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer whitespace-nowrap"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* STOCK TABLE WITH USER'S SPECIFIED COLUMNS */}
          {/* Columns: Item Name | Category | Current Stock | Unit | Min Reorder Level | Cost / Unit | Total Cost | Status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 min-w-[200px]">Item Name</th>
                    <th className="px-4 py-3 min-w-[120px]">Category</th>
                    <th className="px-3 py-3 text-right">Current Stock</th>
                    <th className="px-3 py-3 text-center">Unit</th>
                    <th className="px-3 py-3 text-right">Min Reorder Level</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Cost / Unit</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">Total Cost</th>
                    <th className="px-4 py-3 text-center min-w-[100px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        <Boxes className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
                        {stockItems.length === 0 ? (
                          <>
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                              No raw stock items in kitchen inventory yet
                            </p>
                            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                              Click "+ Add Stock Item" to create your raw ingredients (e.g. Chicken Meat, Burger Buns, Cooking Oil) and set their units and reorder thresholds.
                            </p>
                            <div className="mt-3.5">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowAddModal(true)}
                                icon={<Plus className="w-3.5 h-3.5" />}
                              >
                                Add First Stock Item
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                              No items match your filter criteria
                            </p>
                            <p className="text-2xs text-slate-400 mt-0.5">
                              Try clearing your search query or category filter.
                            </p>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map(item => {
                      const isLow = Number(item.currentStock || 0) <= Number(item.minReorderLevel || 0);
                      const isOutOfStock = Number(item.currentStock || 0) <= 0;
                      const totalCost = Number(item.currentStock || 0) * Number(item.costPrice || 0);

                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => setSelectedStockItemForDetail(item)}
                          className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer group"
                          title="Click to view details, edit, or purchase stock"
                        >
                          {/* Column 1: Item Name */}
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs sm:text-sm group-hover:text-blue-600 transition-colors">
                              {item.name}
                            </span>
                            <div className="text-3xs text-slate-500 mt-0.5 flex items-center gap-2">
                              {item.sku && (
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-semibold text-slate-600 dark:text-slate-300">
                                  {item.sku}
                                </span>
                              )}
                              {item.storageLocation && (
                                <span className="text-slate-400">
                                  {item.storageLocation}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Column 2: Category */}
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded-md text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.category || 'General'}
                            </span>
                          </td>

                          {/* Column 3: Current Stock */}
                          <td className="px-3 py-3 text-right">
                            <span className={`font-mono font-bold text-sm ${
                              isOutOfStock 
                                ? 'text-rose-600 dark:text-rose-400' 
                                : isLow 
                                ? 'text-amber-600 dark:text-amber-400' 
                                : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              {item.currentStock}
                            </span>
                          </td>

                          {/* Column 4: Unit */}
                          <td className="px-3 py-3 text-center">
                            <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
                              {item.unit}
                            </span>
                          </td>

                          {/* Column 5: Min Reorder Level */}
                          <td className="px-3 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                            {item.minReorderLevel}
                          </td>

                          {/* Column 6: Cost / Unit */}
                          <td className="px-3 py-3 text-right font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatNPR(item.costPrice)}
                          </td>

                          {/* Column 7: Total Cost (right beside Cost / Unit, bold) */}
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm whitespace-nowrap">
                            {formatNPR(totalCost)}
                          </td>

                          {/* Column 8: Status */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                In Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer with Summary Count */}
            {filteredStockItems.length > 0 && (
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500">
                <span>Showing {filteredStockItems.length} of {stockItems.length} raw stock items</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  Total Valuation: {formatNPR(filteredStockItems.reduce((sum, s) => sum + (s.currentStock * s.costPrice), 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AUDITABLE STOCK LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Perpetual Stock Movement Ledger
            </h3>
            <span className="text-2xs text-slate-500">{stockMovements.length} logged ledger entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Ref Doc #</th>
                  <th className="px-4 py-3 text-center text-emerald-600">Qty IN</th>
                  <th className="px-4 py-3 text-center text-rose-600">Qty OUT</th>
                  <th className="px-4 py-3 text-center font-bold">New Bal</th>
                  <th className="px-4 py-3">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-2xs">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-sans">
                      No stock ledger movements logged yet.
                    </td>
                  </tr>
                ) : (
                  stockMovements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-500">{formatDate(m.date)}</td>
                      <td className="px-4 py-3 font-sans font-semibold text-slate-900 dark:text-slate-100">{m.productName}</td>
                      <td className="px-4 py-3 capitalize">
                        <StatusBadge status={m.movementType} />
                      </td>
                      <td className="px-4 py-3 text-blue-600 dark:text-blue-400">{m.referenceId}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-bold">
                        {m.quantityIn > 0 ? `+${m.quantityIn}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-rose-600 font-bold">
                        {m.quantityOut > 0 ? `-${m.quantityOut}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                        {m.newBalance}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-500">{m.performedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD RAW STOCK ITEM */}
      <AddStockItemModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {/* MODAL: STOCK ITEM DETAILS, EDIT & ACTIONS (Matching user's screenshots) */}
      <StockItemDetailModal
        isOpen={!!activeDetailStockItem}
        stockItem={activeDetailStockItem}
        onClose={() => setSelectedStockItemForDetail(null)}
      />

    </div>
  );
};
