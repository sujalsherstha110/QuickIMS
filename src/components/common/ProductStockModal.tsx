import React from 'react';
import { 
  Package, AlertTriangle, X, ShoppingCart, 
  Layers, MapPin, Building2, TrendingDown, ArrowRight, DollarSign, Tag, CheckCircle2
} from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNPR } from '../../utils/nepalFormatters';

interface ProductStockModalProps {
  product: Product | null;
  onClose: () => void;
  onNavigateToPurchases?: () => void;
  onNavigateToInventory?: () => void;
}

export const ProductStockModal: React.FC<ProductStockModalProps> = ({
  product,
  onClose,
  onNavigateToPurchases,
  onNavigateToInventory
}) => {
  const { warehouses } = useApp();

  if (!product) return null;

  const isOutOfStock = product.currentStock <= 0;
  const isCritical = product.currentStock <= product.reorderLevel / 2;
  const deficit = Math.max(0, product.reorderLevel - product.currentStock);
  const stockPercentage = product.reorderLevel > 0 
    ? Math.min(100, Math.round((product.currentStock / product.reorderLevel) * 100))
    : 0;

  const warehouseObj = warehouses.find(w => w.id === product.warehouseId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isOutOfStock 
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400' 
                : 'bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                Low Stock Alert
              </h3>
              <p className="text-3xs text-slate-500 font-mono">
                SKU: {product.sku} {product.barcode ? `• Barcode: ${product.barcode}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Product Category, Brand & Title */}
          <div className="space-y-1.5">
            <div>
              <span className="text-3xs uppercase font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 inline-block">
                {product.category}
              </span>
            </div>
            {product.brand && (
              <div className="text-3xs font-medium text-slate-500 dark:text-slate-400">
                Brand: <span className="text-slate-700 dark:text-slate-300 font-semibold">{product.brand}</span>
              </div>
            )}
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug pt-0.5">
              {product.name}
            </h2>
            {product.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {product.description}
              </p>
            )}
          </div>

          {/* Stock Meter Banner */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                Current On-Hand Stock:
              </span>
              <span className="font-mono text-sm font-black text-rose-600 dark:text-rose-400">
                {product.currentStock} {product.baseUnitSymbol}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  isOutOfStock ? 'bg-rose-500 w-1' : isCritical ? 'bg-rose-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.max(5, stockPercentage)}%` }}
              />
            </div>

            {/* Threshold and Deficit in Two Perfectly Aligned Rows */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Minimum Threshold</span>
                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 text-right">
                  {product.reorderLevel} {product.baseUnitSymbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-600 dark:text-rose-400 font-medium">Stock Deficit</span>
                <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 text-right">
                  -{deficit} {product.baseUnitSymbol}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing: Purchase Cost, Wholesale Rate, and Retail MRP in One Container and Three Rows */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-200/70 dark:divide-slate-700/60 text-xs">
            <div className="flex items-center justify-between py-2 first:pt-0">
              <span className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 font-medium">Purchase Cost</span>
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                {formatNPR(product.costPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 font-medium">Wholesale Rate</span>
              <span className="font-mono text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
                {formatNPR(product.wholesalePrice)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 last:pb-0">
              <span className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 font-medium">Retail MRP</span>
              <span className="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatNPR(product.retailPrice)}
              </span>
            </div>
          </div>

          {/* Location & Supplier Details */}
          <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/60 dark:border-slate-800/60 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-3xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Warehouse / Godown:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {product.warehouseName || warehouseObj?.name || 'Main Warehouse'}
              </span>
            </div>

            {product.locationBin && (
              <div className="flex items-center justify-between text-3xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Bin / Rack Location:
                </span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {product.locationBin}
                </span>
              </div>
            )}

            {product.supplierName && (
              <div className="flex items-center justify-between text-3xs pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Primary Supplier:</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {product.supplierName}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {onNavigateToPurchases && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToPurchases();
                }}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Create Purchase Order</span>
              </button>
            )}

            {onNavigateToInventory && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToInventory();
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Layers className="w-4 h-4 text-slate-500" />
                <span>View in Inventory</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
