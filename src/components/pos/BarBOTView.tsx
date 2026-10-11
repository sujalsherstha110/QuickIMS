import React, { useState, useMemo } from 'react';
import { 
  Wine, Clock, CheckCircle2, AlertTriangle, 
  ArrowRight, Check, X, RefreshCw, Printer, Sparkles,
  Coffee, GlassWater, Flame
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { KitchenOrderTicket, KOTItem } from '../../types';

export const BarBOTView: React.FC = () => {
  const { kitchenTickets, updateKOTStatus, updateKOTItemStatus, products, printBOTForTicket } = useApp();
  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active');

  // Helper to determine if an item is a beverage / bar item
  const isBeverageItem = (item: KOTItem) => {
    if (item.course === 'beverage') return true;
    const prod = products.find(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
    if (!prod) {
      const lower = item.productName.toLowerCase();
      return lower.includes('beer') || lower.includes('drink') || lower.includes('cocktail') || 
             lower.includes('mocktail') || lower.includes('juice') || lower.includes('tea') || 
             lower.includes('coffee') || lower.includes('water') || lower.includes('soda') || 
             lower.includes('wine') || lower.includes('whiskey') || lower.includes('gin');
    }
    const catLower = (prod.category || '').toLowerCase();
    return prod.itemType === 'beverage' || 
           catLower.includes('beverage') || 
           catLower.includes('drink') || 
           catLower.includes('bar') || 
           catLower.includes('mocktail') || 
           catLower.includes('cocktail') || 
           catLower.includes('wine') || 
           catLower.includes('liquor');
  };

  // Filter tickets that contain Bar items (or are explicitly designated for 'bar')
  const barTickets = useMemo(() => {
    return kitchenTickets
      .filter(ticket => {
        // Check if ticket has items routed to bar
        const hasBarItems = ticket.items.some(i => i.routingStation === 'bar' || isBeverageItem(i));
        // If ticket is explicitly for kitchen with NO bar items, don't show on bar
        if (ticket.destinationStation === 'kitchen' && ticket.ticketType === 'KOT' && !hasBarItems) return false;
        return hasBarItems || ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT';
      })
      .map(ticket => {
        const bevItems = ticket.items.filter(i => i.routingStation === 'bar' || isBeverageItem(i));
        return {
          ...ticket,
          barItems: (ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT') ? ticket.items : bevItems
        };
      })
      .filter(ticket => {
        if (ticket.barItems.length === 0) return false;
        if (filterMode === 'all') return true;
        return ticket.status === 'in_kitchen' || ticket.status === 'pending' || ticket.status === 'ready' || ticket.status === 'cancelled';
      });
  }, [kitchenTickets, products, filterMode]);

  const calculateElapsedMinutes = (timestamp: number) => {
    return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60)));
  };

  const getUrgencyColor = (elapsedMinutes: number) => {
    if (elapsedMinutes >= 15) {
      return 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse';
    }
    if (elapsedMinutes >= 8) {
      return 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    }
    return 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  };

  const totalActiveDrinks = useMemo(() => {
    return barTickets
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .reduce((sum, t) => sum + t.barItems.filter(i => i.status !== 'ready' && i.status !== 'served' && i.status !== 'cancelled').reduce((s, i) => s + i.quantity, 0), 0);
  }, [barTickets]);

  return (
    <div className="space-y-4">
      {/* Top BOT Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Wine className="w-5 h-5 text-amber-500" />
              <span>Bar Order Ticket (BOT) System</span>
            </h1>
            <span className="text-3xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-semibold border border-amber-200/50 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Live Bar Station Feed
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time cocktail, mocktail, beverage, and drink dispense tickets for the bartender & barista.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <GlassWater className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500">Drinks in Queue:</span>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{totalActiveDrinks}</span>
          </div>

          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('active')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'active'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Active BOTs ({barTickets.filter(k => k.status !== 'completed').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All History ({barTickets.length})
            </button>
          </div>
        </div>
      </div>

      {/* Bar Tickets Grid */}
      {barTickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
            <Wine className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            No Bar Order Tickets (BOT) Waiting
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All drinks and beverage orders have been dispensed. New drinks ordered at table POS will appear here instantly!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {barTickets.map(ticket => {
            const elapsed = calculateElapsedMinutes(ticket.createdAt);
            const isCancelledTicket = ticket.status === 'cancelled' || (ticket.barItems.length > 0 && ticket.barItems.every(i => i.status === 'cancelled'));
            const isReady = ticket.status === 'ready' && !isCancelledTicket;
            const isCompleted = ticket.status === 'completed' && !isCancelledTicket;

            return (
              <div
                key={ticket.id}
                className={`bg-white dark:bg-slate-900 border-2 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden transition-all ${
                  isCancelledTicket
                    ? 'border-rose-500 bg-rose-50/10 dark:bg-rose-950/10'
                    : isReady 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                    : isCompleted 
                    ? 'border-slate-300 dark:border-slate-700 opacity-60' 
                    : elapsed >= 15 
                    ? 'border-rose-500' 
                    : elapsed >= 8 
                    ? 'border-amber-500' 
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* BOT Ticket Header */}
                <div className={`p-3.5 border-b flex items-center justify-between ${
                  isCancelledTicket
                    ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800'
                    : isReady 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-slate-200 dark:border-slate-800'
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                        {ticket.tableNumber}
                      </span>
                      <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        BOT-#{ticket.kotNumber.replace('KOT-', '')}
                      </span>
                      {isCancelledTicket && (
                        <span className="text-3xs font-black px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase tracking-wider flex items-center gap-1 shadow-xs">
                          <AlertTriangle className="w-3 h-3" />
                          Cancelled
                        </span>
                      )}
                    </div>
                    <p className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {ticket.zoneName} • Server: {ticket.waiterName}
                    </p>
                  </div>

                  <div className={`px-2 py-1 rounded-lg border text-2xs font-mono font-bold flex items-center gap-1 ${
                    isCancelledTicket ? 'border-rose-400 bg-rose-200/50 text-rose-800 dark:text-rose-200' : getUrgencyColor(elapsed)
                  }`}>
                    <Clock className="w-3 h-3" />
                    <span>{elapsed} min</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-3.5 space-y-2.5 flex-1 overflow-y-auto max-h-[300px]">
                  {ticket.notes && (
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 text-amber-800 dark:text-amber-300 text-2xs font-medium">
                      🍸 <strong>Bar Note:</strong> {ticket.notes}
                    </div>
                  )}

                  {ticket.barItems.map(item => {
                    const isCancelled = item.status === 'cancelled' || isCancelledTicket;
                    const itemDone = item.status === 'ready' || item.status === 'served';
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!isCancelled && !isCancelledTicket && ticket.status !== 'completed') {
                            updateKOTItemStatus(ticket.id, item.id, itemDone ? 'preparing' : 'ready');
                          }
                        }}
                        className={`p-2.5 rounded-xl border transition-all select-none flex items-start justify-between gap-2 ${
                          isCancelled
                            ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80'
                            : itemDone
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 line-through opacity-70 cursor-pointer'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center shrink-0 ${
                            isCancelled 
                              ? 'bg-rose-600 text-white' 
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          }`}>
                            {item.quantity}x
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className={`text-xs font-bold ${
                                isCancelled 
                                  ? 'line-through text-rose-700 dark:text-rose-400' 
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}>
                                {item.productName}
                              </p>
                              {isCancelled && (
                                <span className="text-3xs font-black px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase tracking-wider">
                                  Cancelled
                                </span>
                              )}
                            </div>
                            {/* Addons List display on BOT */}
                            {item.addonsList && item.addonsList.length > 0 && !isCancelled && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.addonsList.map((addon, aIdx) => (
                                  <span
                                    key={aIdx}
                                    className="text-3xs px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800"
                                  >
                                    +{addon.name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {isCancelled && item.cancelReason && (
                              <div className="mt-1 space-y-1">
                                <p className="text-3xs text-rose-600 dark:text-rose-400 italic">
                                  Reason: {item.cancelReason}
                                </p>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {item.cancelDisposition === 'return_to_stock' && (
                                    <span className="text-3xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                                      Restocked
                                    </span>
                                  )}
                                  {item.cancelDisposition === 'mark_as_waste' && (
                                    <span className="text-3xs px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                                      Marked as Waste
                                    </span>
                                  )}
                                  {item.notifiedKitchenBar && (
                                    <span className="text-3xs px-1.5 py-0.5 rounded bg-amber-500 text-white font-black animate-pulse flex items-center gap-1">
                                      🔔 Bartender Notified
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {item.specialInstructions && !isCancelled && (
                              <p className="text-3xs text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                                Spec: {item.specialInstructions}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          {isCancelled ? (
                            <span className="p-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-bold">
                              ✕
                            </span>
                          ) : itemDone ? (
                            <span className="p-1 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="text-3xs px-1.5 py-0.5 rounded font-mono font-medium bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                              Pour
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* BOT Action Buttons */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/30 flex items-center gap-2">
                  {isCancelledTicket ? (
                    <div className="flex-1 py-2 px-3 bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Order Voided by Staff • Do Not Dispense</span>
                    </div>
                  ) : ticket.status !== 'ready' && ticket.status !== 'completed' ? (
                    <button
                      type="button"
                      onClick={() => updateKOTStatus(ticket.id, 'ready')}
                      className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                    >
                      <Wine className="w-3.5 h-3.5" />
                      <span>Ready at Bar</span>
                    </button>
                  ) : ticket.status === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => updateKOTStatus(ticket.id, 'completed')}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Served to Table</span>
                    </button>
                  ) : (
                    <span className="text-2xs text-slate-400 font-medium py-1">
                      BOT completed
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      printBOTForTicket(ticket);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Print Bar Order Ticket (Thermal Slip)"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
