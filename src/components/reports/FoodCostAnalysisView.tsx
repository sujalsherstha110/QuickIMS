import React, { useMemo } from 'react';
import { 
  BarChart3, TrendingDown, TrendingUp, AlertTriangle, 
  DollarSign, ChefHat, Percent, PieChart, ShieldCheck, Printer
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNPR } from '../../utils/nepalFormatters';

export const FoodCostAnalysisView: React.FC = () => {
  const { sales, products, foodWasteRecords } = useApp();

  // Total sales revenue
  const totalRevenue = useMemo(() => {
    return sales.reduce((sum, s) => sum + s.grandTotal, 0);
  }, [sales]);

  // Total theoretical food cost based on dishes sold
  const totalIngredientCost = useMemo(() => {
    let cost = 0;
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          const itemCost = prod.recipeIngredients && prod.recipeIngredients.length > 0
            ? prod.recipeIngredients.reduce((c, r) => c + r.totalCost, 0)
            : 0;
          cost += itemCost * item.quantity;
        }
      });
    });
    return cost;
  }, [sales, products]);

  const totalMappedRecipes = useMemo(() => {
    return products.filter(p => p.recipeIngredients && p.recipeIngredients.length > 0).length;
  }, [products]);

  // Wastage Loss
  const totalWastageLoss = useMemo(() => {
    return foodWasteRecords.reduce((sum, w) => sum + w.totalLoss, 0);
  }, [foodWasteRecords]);

  // Key ratios
  const grossProfit = totalRevenue - totalIngredientCost;
  const foodCostPercent = totalRevenue > 0 ? Math.round((totalIngredientCost / totalRevenue) * 100) : 0;
  const grossMarginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
  const wastePercentOfSales = totalRevenue > 0 ? ((totalWastageLoss / totalRevenue) * 100).toFixed(1) : '0';

  // Dish margin ranking
  const rankedDishes = useMemo(() => {
    return products
      .filter(p => p.itemType === 'menu_item' || !p.itemType)
      .map(p => {
        const hasRecipe = Boolean(p.recipeIngredients && p.recipeIngredients.length > 0);
        const cost = hasRecipe
          ? p.recipeIngredients!.reduce((s, r) => s + r.totalCost, 0)
          : 0;
        const margin = p.retailPrice - cost;
        const marginPct = p.retailPrice > 0 ? Math.round((margin / p.retailPrice) * 100) : 0;
        return {
          ...p,
          hasRecipe,
          calculatedCost: cost,
          margin,
          marginPct
        };
      })
      .sort((a, b) => b.marginPct - a.marginPct);
  }, [products]);

  // Waste reasons breakdown
  const wasteByReason = useMemo(() => {
    const map: Record<string, number> = {};
    foodWasteRecords.forEach(w => {
      const reasonLabel = w.reason.replace(/_/g, ' ');
      map[reasonLabel] = (map[reasonLabel] || 0) + w.totalLoss;
    });
    return Object.entries(map).map(([reason, amount]) => ({
      reason,
      amount,
      pct: totalWastageLoss > 0 ? Math.round((amount / totalWastageLoss) * 100) : 0
    }));
  }, [foodWasteRecords, totalWastageLoss]);

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <PieChart className="w-5 h-5 text-indigo-600" />
              <span>Food Cost & Wastage Intelligence</span>
            </h1>
            <span className="text-3xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/50">
              COGS & Loss Audit
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track Cost of Goods Sold (COGS), actual kitchen food cost %, gross profits, and recorded wastage leaks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Audit</span>
        </button>
      </div>

      {/* Banner if no recipes configured yet */}
      {totalMappedRecipes === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>No Recipe BOMs mapped yet:</strong> Dummy data has been cleared. Food Cost (COGS) will calculate automatically once raw ingredients are linked to menu items under <strong>Kitchen &gt; Recipes & BOM</strong>.
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider">Gross Sales</span>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">{formatNPR(totalRevenue)}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Food Cost (COGS)</span>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
            {formatNPR(totalIngredientCost)} ({foodCostPercent}%)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Gross Margin</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatNPR(grossProfit)} ({grossMarginPercent}%)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-3xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Wastage Loss</span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {formatNPR(totalWastageLoss)} ({wastePercentOfSales}%)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Dish Profit Margins Ranking */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-indigo-600" />
                <span>Dish Profit Margin & Food Cost Benchmark</span>
              </h3>
              <p className="text-3xs text-slate-500 mt-0.5">
                Target industry benchmark: Food cost under 32%, Gross profit above 68%
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-3xs uppercase font-bold">
                <tr>
                  <th className="py-2.5 px-3">Menu Dish</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3 text-right">Ingredient Cost</th>
                  <th className="py-2.5 px-3 text-right">Contribution</th>
                  <th className="py-2.5 px-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rankedDishes.slice(0, 8).map(dish => (
                  <tr key={dish.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {dish.name}
                      <span className="block text-3xs font-normal text-slate-400">{dish.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatNPR(dish.retailPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {dish.hasRecipe ? formatNPR(dish.calculatedCost) : (
                        <span className="text-3xs text-slate-400 italic">No Recipe</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {dish.hasRecipe ? (
                        <span className="text-emerald-600 dark:text-emerald-400">+{formatNPR(dish.margin)}</span>
                      ) : (
                        <span className="text-slate-500">{formatNPR(dish.retailPrice)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      {dish.hasRecipe ? (
                        <span className={`px-2 py-0.5 rounded text-3xs ${
                          dish.marginPct >= 70 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          dish.marginPct >= 60 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {dish.marginPct}%
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-3xs bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium">
                          Pending BOM
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Wastage Loss Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Waste Loss by Root Cause</span>
            </h3>
            <p className="text-3xs text-slate-500 mt-0.5">
              Identify where kitchen dollars are leaking
            </p>
          </div>

          <div className="space-y-3">
            {wasteByReason.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No waste records logged yet</p>
            ) : (
              wasteByReason.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="capitalize text-slate-700 dark:text-slate-300">{item.reason}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatNPR(item.amount)} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${Math.min(100, item.pct)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 text-2xs space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Cost Reduction Tip:
            </span>
            <p className="text-slate-500">
              Tighten portion weighing on boneless meats & monitor fryer oil temperatures to prevent overcooking and reduce scrap loss by up to 15%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
