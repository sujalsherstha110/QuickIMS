import React, { useState } from 'react';
import { 
  ChefHat, Clock, CheckCircle2, Flame, AlertTriangle, 
  Utensils, ArrowRight, Check, X, RefreshCw, Printer
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { KitchenOrderTicket, KOTItem } from '../../types';

export const KitchenKDSView: React.FC = () => {
  const { kitchenTickets, updateKOTStatus, updateKOTItemStatus } = useApp();
  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active');

  // Filter tickets that belong to the Kitchen (destinationStation is 'kitchen' or not 'bar', and ticketType is not 'BOT')
  const activeTickets = kitchenTickets.filter(k => {
    // Strictly isolate bar tickets away from kitchen KDS
    if (k.destinationStation === 'bar' || k.ticketType === 'BOT') return false;
    // Check if ticket contains any kitchen items
    const hasKitchenItems = k.items.some(i => i.routingStation !== 'bar');
    if (!hasKitchenItems && k.items.length > 0) return false;

    if (filterMode === 'all') return true;
    return k.status === 'in_kitchen' || k.status === 'pending' || k.status === 'ready' || k.status === 'cancelled';
  });

  const calculateElapsedMinutes = (timestamp: number) => {
    return Math.floor((Date.now() - timestamp) / (1000 * 60));
  };

  const getUrgencyColor = (elapsedMinutes: number) => {
    if (elapsedMinutes >= 20) {
      return 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse';
    }
    if (elapsedMinutes >= 10) {
      return 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    }
    return 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  };

  return (
    <div className="space-y-4">
      {/* Top KDS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Kitchen Display System (KDS)</span>
            </h1>
            <span className="text-3xs px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold border border-rose-200/50 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              Live Kitchen Feed
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time orders dispatched from floor waitstaff and table POS terminals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('active')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'active'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Active Tickets ({kitchenTickets.filter(k => k.status !== 'completed' && k.destinationStation !== 'bar' && k.ticketType !== 'BOT').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Tickets ({kitchenTickets.filter(k => k.destinationStation !== 'bar' && k.ticketType !== 'BOT').length})
            </button>
          </div>
        </div>
      </div>

      {/* Tickets Column Grid */}
      {activeTickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            All Kitchen Tickets Cleared
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No pending dishes in queue. Take new orders from the Tables & POS view to fire fresh tickets!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeTickets.map(ticket => {
            const elapsed = calculateElapsedMinutes(ticket.createdAt);
            const isCancelledTicket = ticket.status === 'cancelled' || (ticket.items.length > 0 && ticket.items.every(i => i.status === 'cancelled'));
            const isReady = ticket.status === 'ready' && !isCancelledTicket;
            const isCompleted = ticket.status === 'completed' && !isCancelledTicket;
            const kitchenItems = ticket.items.filter(i => i.routingStation !== 'bar');
            const displayItems = kitchenItems.length > 0 ? kitchenItems : ticket.items;

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
                    : elapsed >= 20 
                    ? 'border-rose-500' 
                    : elapsed >= 10 
                    ? 'border-amber-500' 
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Ticket Header */}
                <div className={`p-3.5 border-b flex items-center justify-between ${
                  isCancelledTicket
                    ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800'
                    : isReady 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                        {ticket.tableNumber}
                      </span>
                      <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {ticket.kotNumber}
                      </span>
                      {isCancelledTicket && (
                        <span className="text-3xs font-black px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase tracking-wider flex items-center gap-1 shadow-xs">
                          <AlertTriangle className="w-3 h-3" />
                          Cancelled
                        </span>
                      )}
                    </div>
                    <p className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {ticket.zoneName} • Waiter: {ticket.waiterName}
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
                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[300px]">
                  {ticket.notes && (
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 text-amber-800 dark:text-amber-300 text-2xs font-medium">
                      ⚠️ <strong>Note:</strong> {ticket.notes}
                    </div>
                  )}

                  {displayItems.map(item => {
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
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center shrink-0 ${
                              isCancelled ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
                            }`}>
                              {item.quantity}x
                            </span>
                            <span className={`text-xs font-bold ${
                              isCancelled ? 'line-through text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              {item.productName}
                            </span>
                            {isCancelled && (
                              <span className="text-3xs font-black px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase tracking-wider">
                                Cancelled
                              </span>
                            )}
                          </div>

                          {/* Addons List display on KDS */}
                          {item.addonsList && item.addonsList.length > 0 && !isCancelled && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.addonsList.map((addon, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="text-3xs px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800"
                                >
                                  +{addon.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {isCancelled && (item.cancelReason || item.cancelDisposition || item.notifiedKitchenBar) && (
                            <div className="mt-1 space-y-1">
                              {item.cancelReason && (
                                <p className="text-3xs text-rose-600 dark:text-rose-400 italic">
                                  Reason: {item.cancelReason}
                                </p>
                              )}
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
                                    🔔 Chef Notified
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {item.specialInstructions && !isCancelled && (
                            <p className="mt-1 text-2xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md inline-block">
                              ★ {item.specialInstructions}
                            </p>
                          )}
                        </div>

                        <div className="pt-0.5">
                          {isCancelled ? (
                            <div className="w-5 h-5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-black">
                              ✕
                            </div>
                          ) : (
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                              itemDone 
                                ? 'bg-emerald-600 border-emerald-600 text-white' 
                                : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {itemDone && <Check className="w-3.5 h-3.5" />}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Bump Actions */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  {isCancelledTicket ? (
                    <div className="flex-1 py-2 px-3 bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Order Voided by Staff • Do Not Cook</span>
                    </div>
                  ) : !isReady && !isCompleted ? (
                    <button
                      type="button"
                      onClick={() => updateKOTStatus(ticket.id, 'ready')}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Ready to Serve</span>
                    </button>
                  ) : isReady ? (
                    <button
                      type="button"
                      onClick={() => updateKOTStatus(ticket.id, 'completed')}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Mark Served & Dismiss</span>
                    </button>
                  ) : (
                    <span className="text-2xs text-slate-400 font-medium py-1">
                      Ticket completed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
