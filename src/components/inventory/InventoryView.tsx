import React, { useState, useMemo } from 'react';
import { 
  Boxes, Warehouse as WarehouseIcon, ArrowLeftRight, Wrench, 
  History, Search, Filter, AlertTriangle, CheckCircle2,
  TrendingDown, TrendingUp, Layers, FileText, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { StockTransferModal } from './StockTransferModal';
import { ProductStockDetailModal } from './ProductStockDetailModal';
import { Product } from '../../types';
import { Button } from '../common/Button';

interface InventoryViewProps {
  onNavigate?: (tab: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onNavigate }) => {
  const { 
    products, stockMovements, warehouses, suppliers
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'ledger'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState<boolean>(false);
  
  // Modal states
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  // Keep selected product in sync with fresh data in context
  const activeDetailProduct = useMemo(() => {
    if (!selectedProductForDetail) return null;
    return products.find(p => p.id === selectedProductForDetail.id) || selectedProductForDetail;
  }, [products, selectedProductForDetail]);

  // Executive Metric Calculations
  const { totalValuation, totalUnits, lowStockCount } = useMemo(() => {
    let val = 0;
    let units = 0;
    let lowCount = 0;

    products.forEach(p => {
      val += p.currentStock * p.costPrice;
      units += p.currentStock;
      if (p.currentStock <= p.reorderLevel) {
        lowCount += 1;
      }
    });

    return {
      totalValuation: val,
      totalUnits: units,
      lowStockCount: lowCount,
    };
  }, [products]);

  // Filtered Products for Valuation & Levels Table
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedWarehouse !== 'all' && p.warehouseId !== selectedWarehouse) {
        return false;
      }
      if (showLowStockOnly && p.currentStock > p.reorderLevel) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        const matchesBrand = (p.brand || '').toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesCategory && !matchesBrand) {
          return false;
        }
      }
      return true;
    });
  }, [products, selectedWarehouse, showLowStockOnly, searchQuery]);

  return (
    <div className="space-y-4">
      
      {/* Top Header & Quick Action Buttons */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            Inventory & Multi-Warehouse Stock Management
          </h1>
          <p className="text-2xs text-slate-500">
            Real-time stock ledger movements, physical count adjustments, and inter-godown transfers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAdjModal(true)}
            icon={<Wrench className="w-3.5 h-3.5 text-amber-500" />}
          >
            Stock Adjustment
          </Button>
          <Button
            variant="primary-arrow"
            size="sm"
            onClick={() => setShowTransferModal(true)}
          >
            Transfer Stock
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
                <p className="text-3xs text-slate-400">Total capital invested across godowns</p>
              </div>
            </div>

            {/* Metric 2: Total Units & SKUs */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                <WarehouseIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-semibold text-slate-500 uppercase tracking-wider">
                  Inventory Holdings
                </p>
                <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 truncate">
                  {totalUnits.toLocaleString()} units
                </h3>
                <p className="text-3xs text-slate-400">Active across {products.length} catalog SKUs</p>
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
                    {showLowStockOnly ? 'Filtered: Showing low stock' : 'Click to filter low stock items'}
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
                placeholder="Search by product name, SKU, category, or brand..."
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

            {/* Warehouse Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All Godowns & Showrooms</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              {/* Reset Filters button if any active */}
              {(searchQuery || selectedWarehouse !== 'all' || showLowStockOnly) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedWarehouse('all');
                    setShowLowStockOnly(false);
                  }}
                  className="px-2.5 py-2 text-3xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Streamlined Responsive Stock & Valuation Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 min-w-[180px] sm:min-w-0">Item & Classification</th>
                    <th className="hidden sm:table-cell px-3 sm:px-4 py-2.5 sm:py-3">Godown Location</th>
                    <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-right whitespace-nowrap">Available Stock</th>
                    <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-right whitespace-nowrap">Valuation & Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        <Boxes className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">No items match your filter criteria</p>
                        <p className="text-2xs text-slate-400 mt-0.5">Try clearing your search query or warehouse selection.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => {
                      const isLow = p.currentStock <= p.reorderLevel;
                      const valuation = p.currentStock * p.costPrice;
                      const sup = suppliers.find(s => s.id === p.supplierId);

                      return (
                        <tr 
                          key={p.id} 
                          onClick={() => setSelectedProductForDetail(p)}
                          className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer group"
                          title="Click to view product details, edit, or purchase stock"
                        >
                          {/* Column 1: Item & Classification (expanded room on mobile) */}
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs sm:text-sm leading-snug break-words">
                              {p.name}
                            </span>
                            <div className="text-3xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                SKU: {p.sku}
                              </span>
                              <span>{p.category}</span>
                              {p.brand && (
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                  Brand: {p.brand}
                                </span>
                              )}
                              {sup && (
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                  Supplier: {sup.companyName || sup.name}
                                  {sup.additionalContacts && sup.additionalContacts.length > 0 && (
                                    <span className="ml-1 text-4xs bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold px-1 py-0.2 rounded border border-blue-200/50 dark:border-blue-800/50">
                                      +{sup.additionalContacts.length} contacts
                                    </span>
                                  )}
                                </span>
                              )}
                              {/* On mobile screens, show location cleanly inline since separate column is hidden */}
                              <span className="sm:hidden font-medium text-blue-600 dark:text-blue-400">
                                • {p.warehouseName}
                              </span>
                            </div>
                          </td>

                          {/* Column 2: Godown Location (clean without house icon, hidden on small mobile) */}
                          <td className="hidden sm:table-cell px-3 sm:px-4 py-2.5 sm:py-3">
                            <span className="font-medium text-slate-800 dark:text-slate-200 block text-xs">
                              {p.warehouseName}
                            </span>
                            <span className="text-3xs text-slate-400 block mt-0.5">
                              Rack / Bin: {p.locationBin || 'Showroom Floor'}
                            </span>
                          </td>

                          {/* Column 3: Stock Level & Status */}
                          <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`font-mono font-bold text-xs sm:text-sm ${
                                isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                              }`}>
                                {p.currentStock} {p.baseUnitSymbol}
                              </span>
                              
                              {isLow ? (
                                <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-3xs whitespace-nowrap">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>&lt; {p.reorderLevel} {p.baseUnitSymbol}</span>
                                </span>
                              ) : (
                                <span className="text-3xs text-slate-400 mt-0.5 whitespace-nowrap">
                                  Reorder: {p.reorderLevel}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Column 4: Valuation */}
                          <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-right">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block text-xs sm:text-sm whitespace-nowrap">
                              {formatNPR(valuation)}
                            </span>
                            <span className="text-3xs font-mono text-slate-500 block mt-0.5 whitespace-nowrap">
                              @ {formatNPR(p.costPrice)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer with Summary Count */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500">
              <span>Showing {filteredProducts.length} of {products.length} items</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                Filtered Valuation: {formatNPR(filteredProducts.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0))}
              </span>
            </div>
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
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Ref Doc #</th>
                  <th className="px-4 py-3 text-center text-emerald-600">Qty IN</th>
                  <th className="px-4 py-3 text-center text-rose-600">Qty OUT</th>
                  <th className="px-4 py-3 text-center font-bold">New Bal</th>
                  <th className="px-4 py-3">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-2xs">
                {stockMovements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-500">{formatDate(m.date)}</td>
                    <td className="px-4 py-3 font-sans font-semibold text-slate-900 dark:text-slate-100">{m.productName}</td>
                    <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-400">{m.warehouseName}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      <StockAdjustmentModal
        isOpen={showAdjModal}
        onClose={() => setShowAdjModal(false)}
      />

      {/* MODAL: STOCK TRANSFER */}
      <StockTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
      />

      {/* MODAL: PRODUCT STOCK DETAILS, EDIT & PURCHASE */}
      <ProductStockDetailModal
        isOpen={!!activeDetailProduct}
        product={activeDetailProduct}
        onClose={() => setSelectedProductForDetail(null)}
        onNavigateToPurchases={() => onNavigate?.('purchases')}
      />

    </div>
  );
};
