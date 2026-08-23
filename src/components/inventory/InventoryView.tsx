import React, { useState, useMemo } from 'react';
import { 
  Boxes, Warehouse as WarehouseIcon, ArrowLeftRight, Wrench, 
  AlertTriangle, History, Plus, Search, Filter, CheckCircle2,
  TrendingDown, TrendingUp, Layers, FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StockAdjustment, StockTransfer } from '../../types';
import { formatNPR, formatDate, formatStockInUnits } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';

export const InventoryView: React.FC = () => {
  const { 
    products, stockMovements, warehouses, stockAdjustments, 
    recordStockAdjustment, stockTransfers, recordStockTransfer,
    currentWarehouseId, currentUser
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'ledger' | 'adjustment' | 'transfer'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stock Adjustment Form
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({
    productId: products[0]?.id || '',
    warehouseId: 'wh-main',
    type: 'damage' as 'damage' | 'loss' | 'found' | 'correction' | 'internal_use',
    quantityDelta: -1,
    reason: 'Breakage during transit from godown'
  });

  // Stock Transfer Form
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: 'wh-main',
    toWarehouseId: 'wh-godown',
    productId: products[0]?.id || '',
    quantity: 10,
    notes: 'Replenishing showroom stock'
  });

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.currentStock <= p.reorderLevel);
  }, [products]);

  // Handle submit Adjustment
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === adjForm.productId);
    const wh = warehouses.find(w => w.id === adjForm.warehouseId);
    if (!prod || !wh) return;

    await recordStockAdjustment({
      date: Date.now(),
      productId: prod.id,
      productName: prod.name,
      warehouseId: wh.id,
      warehouseName: wh.name,
      type: adjForm.type,
      quantityDelta: adjForm.quantityDelta,
      unitCost: prod.costPrice,
      reason: adjForm.reason,
      performedBy: currentUser.name
    });

    setShowAdjModal(false);
  };

  // Handle submit Transfer
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === transferForm.productId);
    const fromWh = warehouses.find(w => w.id === transferForm.fromWarehouseId);
    const toWh = warehouses.find(w => w.id === transferForm.toWarehouseId);
    if (!prod || !fromWh || !toWh) return;

    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
      alert('Source and destination warehouses cannot be the same.');
      return;
    }

    if (prod.currentStock < transferForm.quantity) {
      alert(`Insufficient stock in ${fromWh.name}. Available: ${prod.currentStock}`);
      return;
    }

    await recordStockTransfer({
      transferNumber: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
      date: Date.now(),
      fromWarehouseId: fromWh.id,
      fromWarehouseName: fromWh.name,
      toWarehouseId: toWh.id,
      toWarehouseName: toWh.name,
      items: [{
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantity: transferForm.quantity,
        unitCost: prod.costPrice
      }],
      status: 'completed',
      notes: transferForm.notes,
      initiatedBy: currentUser.name
    });

    setShowTransferModal(false);
  };

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
          { id: 'adjustment', label: 'Damage & Adjustments', icon: Wrench },
          { id: 'transfer', label: 'Inter-Warehouse Transfers', icon: ArrowLeftRight },
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
          
          {/* Low Stock Banner if any */}
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Reorder Alert: {lowStockProducts.length} items below minimum safety threshold
                  </h4>
                  <p className="text-2xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Promptly generate purchase orders to prevent stockouts during peak construction & plumbing demand.
                  </p>
                </div>
              </div>
            </div>
          )}

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

      {/* TAB 3: ADJUSTMENTS & DAMAGE LOG */}
      {activeSubTab === 'adjustment' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Stock Adjustments & Damage History (टुटफुट तथा समायोजन)
            </h3>
            <button
              onClick={() => setShowAdjModal(true)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
            >
              + Record Adjustment
            </button>
          </div>

          {stockAdjustments.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No adjustment records recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {stockAdjustments.map(adj => (
                <div key={adj.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{adj.productName}</p>
                    <p className="text-2xs text-slate-500 font-mono">
                      {adj.warehouseName} | Reason: {adj.reason} | By: {adj.performedBy}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold text-xs ${adj.quantityDelta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {adj.quantityDelta > 0 ? `+${adj.quantityDelta}` : adj.quantityDelta}
                    </span>
                    <span className="block text-3xs text-slate-400">{formatDate(adj.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: INTER-WAREHOUSE TRANSFERS */}
      {activeSubTab === 'transfer' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Warehouse Transfers (गोदाम ट्रान्सफर)
            </h3>
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
            >
              + New Transfer
            </button>
          </div>

          {stockTransfers.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No inter-warehouse transfers recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {stockTransfers.map(tr => (
                <div key={tr.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 font-mono text-indigo-600">
                      {tr.transferNumber}
                    </p>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      From {tr.fromWarehouseName} ➔ To {tr.toWarehouseName}
                    </p>
                    <p className="text-3xs text-slate-400 font-mono">
                      Items: {tr.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={tr.status} />
                    <span className="block text-3xs text-slate-400 mt-1">{formatDate(tr.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {showAdjModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Record Stock Adjustment / Damage
            </h3>

            <form onSubmit={handleSubmitAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Select Product *</label>
                <select
                  value={adjForm.productId}
                  onChange={(e) => setAdjForm({ ...adjForm, productId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Cur: {p.currentStock} {p.baseUnitSymbol})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Adjustment Type</label>
                  <select
                    value={adjForm.type}
                    onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="damage">Damaged Stock (घटाउने)</option>
                    <option value="loss">Loss / Missing</option>
                    <option value="found">Physical Found (बढाउने)</option>
                    <option value="correction">Count Correction</option>
                    <option value="internal_use">Internal Workshop Use</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Quantity Delta (+/-)</label>
                  <input
                    type="number"
                    value={adjForm.quantityDelta}
                    onChange={(e) => setAdjForm({ ...adjForm, quantityDelta: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Reason / Description *</label>
                <textarea
                  rows={2}
                  required
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK TRANSFER */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Transfer Stock Between Warehouses
            </h3>

            <form onSubmit={handleSubmitTransfer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Source Store (From)</label>
                  <select
                    value={transferForm.fromWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Destination (To)</label>
                  <select
                    value={transferForm.toWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Select Item to Move *</label>
                <select
                  value={transferForm.productId}
                  onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Transfer Quantity (Base Units) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: parseFloat(e.target.value) || 1 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Haulage Notes</label>
                <input
                  type="text"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold"
                >
                  Complete Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
