import React, { useState } from 'react';
import { 
  Boxes, Warehouse as WarehouseIcon, ArrowLeftRight, Wrench, 
  History, Search, Filter, CheckCircle2,
  TrendingDown, TrendingUp, Layers, FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNPR, formatDate, formatStockInUnits } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { StockTransferModal } from './StockTransferModal';

export const InventoryView: React.FC = () => {
  const { 
    products, stockMovements, warehouses, 
    currentWarehouseId, currentUser
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'ledger'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  return (
    <div className="space-y-4">
      
      {/* Top Header & Sub-navigation */}
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
          <button
            onClick={() => setShowAdjModal(true)}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-500" /> Stock Adjustment
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer Stock
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-medium">
        {[
          { id: 'overview', label: 'Stock Valuation & Levels', icon: Boxes },
          { id: 'ledger', label: 'Detailed Stock Ledger (खाता)', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                activeSubTab === tab.id
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STOCK OVERVIEW & VALUATION */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          {/* Current Stock Levels Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product Name & SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Primary Warehouse</th>
                    <th className="px-4 py-3 text-right">Avg Landed Cost</th>
                    <th className="px-4 py-3 text-center">Current Balance</th>
                    <th className="px-4 py-3 text-center">Safety Reorder</th>
                    <th className="px-4 py-3 text-right">Total Inventory Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {products.map(p => {
                    const isLow = p.currentStock <= p.reorderLevel;
                    const valuation = p.currentStock * p.costPrice;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{p.name}</span>
                          <span className="text-3xs text-slate-400 font-mono">SKU: {p.sku} | Location: {p.locationBin || 'Showroom'}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.category}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{p.warehouseName}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatNPR(p.costPrice)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono font-bold text-xs ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            {p.currentStock} {p.baseUnitSymbol}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-500">
                          {p.reorderLevel} {p.baseUnitSymbol}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatNPR(valuation)}
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

      {/* TAB 2: AUDITABLE STOCK LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Perpetual Stock Movement Ledger (प्रत्येक मौज्दात परिवर्तन)
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
                    <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400">{m.referenceId}</td>
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

    </div>
  );
};
