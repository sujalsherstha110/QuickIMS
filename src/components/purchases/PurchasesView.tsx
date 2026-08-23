import React, { useState, useMemo } from 'react';
import { 
  Truck, Plus, Search, CheckCircle2, FileText, 
  DollarSign, PackageCheck, AlertCircle, X, ChevronRight 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PurchaseInvoice, PurchaseItem } from '../../types';
import { formatNPR, formatDate, toNepaliBSDate } from '../../utils/nepalFormatters';
import { StatusBadge } from '../common/StatCard';

export const PurchasesView: React.FC = () => {
  const { 
    purchases, recordPurchase, suppliers, products, 
    warehouses, currentWarehouseId, settings 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);

  // New Purchase Form
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState(currentWarehouseId);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [freightCost, setFreightCost] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'credit' | 'partial'>('bank_transfer');
  const [purchasePaidAmount, setPurchasePaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Item selector helpers inside purchase modal
  const [tempProductId, setTempProductId] = useState(products[0]?.id || '');
  const [tempQuantity, setTempQuantity] = useState(10);
  const [tempUnitCost, setTempUnitCost] = useState(500);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => 
      p.purchaseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.supplierInvoiceNumber && p.supplierInvoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [purchases, searchQuery]);

  const handleAddItemToPurchase = () => {
    const prod = products.find(p => p.id === tempProductId);
    if (!prod) return;

    const lineTotal = tempQuantity * tempUnitCost;

    const newItem: PurchaseItem = {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      selectedUnit: prod.baseUnit,
      conversionFactor: 1,
      quantity: tempQuantity,
      baseQuantity: tempQuantity,
      unitCost: tempUnitCost,
      discountPercent: 0,
      taxRatePercent: 13,
      lineTotal
    };

    setPurchaseItems([...purchaseItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const subtotal = purchaseItems.reduce((acc, i) => acc + i.lineTotal, 0);
  const taxAmount = Math.round(subtotal * 0.13 * 100) / 100;
  const grandTotal = subtotal + taxAmount + freightCost + otherExpenses;
  const dueAmount = Math.max(0, grandTotal - purchasePaidAmount);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0 || !selectedSupplier) return;

    const targetWh = warehouses.find(w => w.id === targetWarehouseId) || warehouses[0];
    const purchaseNumber = `${settings.purchasePrefix}${Math.floor(10000 + Math.random() * 90000)}`;

    const newPur: Omit<PurchaseInvoice, 'id' | 'createdAt'> = {
      purchaseNumber,
      supplierInvoiceNumber: supplierInvoiceNo,
      date: Date.now(),
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.companyName || selectedSupplier.name,
      supplierPanVat: selectedSupplier.panVatNumber,
      warehouseId: targetWh.id,
      warehouseName: targetWh.name,
      items: purchaseItems,
      subtotal,
      discountAmount: 0,
      taxAmount,
      freightCost,
      otherExpenses,
      grandTotal,
      paymentMethod: purchasePaymentMethod,
      paidAmount: Math.min(purchasePaidAmount, grandTotal),
      dueAmount,
      paymentStatus: dueAmount === 0 ? 'paid' : (purchasePaidAmount > 0 ? 'partial' : 'unpaid'),
      status: 'received',
      notes
    };

    await recordPurchase(newPur);
    setShowNewPurchaseModal(false);
    setPurchaseItems([]);
    setSupplierInvoiceNo('');
    setNotes('');
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
            Purchase Orders & Goods Inward (खरिद बिल तथा मौज्दात दाखिला)
          </h1>
          <p className="text-2xs text-slate-500">
            Supplier purchase invoices, landed cost allocation (freight & loading), and stock increment.
          </p>
        </div>

        <button
          onClick={() => {
            setPurchasePaidAmount(0);
            setShowNewPurchaseModal(true);
          }}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs"
        >
          <Plus className="w-4 h-4" /> Receive Goods / New Purchase Bill
        </button>
      </div>

      {/* Search Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by Purchase #, Supplier Name or Supplier Invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-3xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Purchase #</th>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Inward Store</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Grand Total (Inc VAT)</th>
                <th className="px-4 py-3 text-right">Due Payable</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPurchases.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {p.purchaseNumber}
                    {p.supplierInvoiceNumber && (
                      <span className="block text-3xs text-slate-400">Bill: {p.supplierInvoiceNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">{p.supplierName}</span>
                    {p.supplierPanVat && <span className="text-3xs text-slate-400 font-mono">PAN: {p.supplierPanVat}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-2xs">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.warehouseName}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatNPR(p.subtotal)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{formatNPR(p.grandTotal)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                    {p.dueAmount > 0 ? formatNPR(p.dueAmount) : 'Paid'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={p.paymentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NEW PURCHASE BILL */}
      {showNewPurchaseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Receive Supplier Goods & Record Purchase Bill
              </h3>
              <button onClick={() => setShowNewPurchaseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
              
              {/* Supplier & Warehouse select */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Supplier (साहु) *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Supplier Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. PK-INV-8891"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Receiving Warehouse</label>
                  <select
                    value={targetWarehouseId}
                    onChange={(e) => setTargetWarehouseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add Purchase Line Item Builder */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="font-bold text-2xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Add Line Items to Purchase Bill
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={tempProductId}
                      onChange={(e) => {
                        const p = products.find(prod => prod.id === e.target.value);
                        setTempProductId(e.target.value);
                        if (p) setTempUnitCost(p.costPrice);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs font-medium"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={tempQuantity}
                      onChange={(e) => setTempQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      placeholder="Unit Cost (Rs.)"
                      value={tempUnitCost}
                      onChange={(e) => setTempUnitCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs font-mono font-bold"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemToPurchase}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded font-semibold text-xs"
                  >
                    + Add Item
                  </button>
                </div>

                {/* Items in purchase list */}
                {purchaseItems.length > 0 && (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 pt-2">
                    {purchaseItems.map((item, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between font-mono text-2xs">
                        <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">{item.productName}</span>
                        <div className="flex items-center gap-4">
                          <span>{item.quantity} {item.selectedUnit} × {formatNPR(item.unitCost)}</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{formatNPR(item.lineTotal)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-700 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Landed Cost Allocations (Freight & Logistics) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Freight / Haulage Cost (Rs.)</label>
                  <input
                    type="number"
                    value={freightCost}
                    onChange={(e) => setFreightCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Loading / Other Expenses (Rs.)</label>
                  <input
                    type="number"
                    value={otherExpenses}
                    onChange={(e) => setOtherExpenses(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              {/* Payment Summary */}
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                <div className="flex justify-between font-medium text-xs">
                  <span>Grand Total (With VAT 13% + Freight):</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{formatNPR(grandTotal)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                  <div>
                    <label className="block text-3xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">Payment Method</label>
                    <select
                      value={purchasePaymentMethod}
                      onChange={(e) => setPurchasePaymentMethod(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                    >
                      <option value="bank_transfer">Bank Transfer (Nabil/Global)</option>
                      <option value="cheque">Cheque</option>
                      <option value="cash">Cash in Hand</option>
                      <option value="credit">Credit / Payable (साहु बाँकी)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-3xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">Amount Paid Now (Rs.)</label>
                    <input
                      type="number"
                      value={purchasePaidAmount}
                      onChange={(e) => setPurchasePaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewPurchaseModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purchaseItems.length === 0}
                  className={`px-5 py-2 rounded-lg font-semibold text-white ${
                    purchaseItems.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  Confirm & Receive Goods
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
