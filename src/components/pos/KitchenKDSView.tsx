import React, { useState, useMemo } from 'react';
import { 
  ChefHat, Clock, CheckCircle2, Flame, AlertTriangle, 
  Check, X, RefreshCw, Printer, Search, Bell, BellOff, Volume2, RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { KitchenOrderTicket, KOTItem } from '../../types';

export const KitchenKDSView: React.FC = () => {
  const { kitchenTickets, updateKOTStatus, updateKOTItemStatus, printKOTForTicket } = useApp();
  const [filterMode, setFilterMode] = useState<'active' | 'ready' | 'cancelled' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Filter tickets that belong to the Kitchen (destinationStation is 'kitchen' or not 'bar', and ticketType is not 'BOT')
  const kitchenSourceTickets = useMemo(() => {
    return kitchenTickets.filter(k => {
      // Isolate bar tickets away from kitchen KDS
      if (k.destinationStation === 'bar' || k.ticketType === 'BOT') return false;
      // Has kitchen items or explicitly kitchen destination
      const hasKitchenItems = k.items.some(i => i.routingStation !== 'bar');
      if (!hasKitchenItems && k.items.length > 0 && k.destinationStation !== 'kitchen') return false;
      return true;
    });
  }, [kitchenTickets]);

  // Compute stat counts
  const stats = useMemo(() => {
    const active = kitchenSourceTickets.filter(k => k.status !== 'completed');
    const cooking = active.filter(k => k.status === 'in_kitchen' || k.status === 'pending');
    const ready = active.filter(k => k.status === 'ready');
    const cancelled = kitchenSourceTickets.filter(k => k.status === 'cancelled' || k.items.some(i => i.status === 'cancelled'));
    return {
      activeCount: active.length,
      cookingCount: cooking.length,
      readyCount: ready.length,
      cancelledCount: cancelled.length,
      totalCount: kitchenSourceTickets.length
    };
  }, [kitchenSourceTickets]);

  // Filtered tickets based on active filterMode & search
  const filteredTickets = useMemo(() => {
    return kitchenSourceTickets.filter(k => {
      const isCancelledTicket = k.status === 'cancelled' || (k.items.length > 0 && k.items.every(i => i.status === 'cancelled'));
      const hasCancelledItem = k.items.some(i => i.status === 'cancelled');

      // Mode filter
      if (filterMode === 'active') {
        if (k.status === 'completed') return false;
      } else if (filterMode === 'ready') {
        if (k.status !== 'ready') return false;
      } else if (filterMode === 'cancelled') {
        if (!isCancelledTicket && !hasCancelledItem) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTable = (k.tableNumber || '').toLowerCase().includes(query);
        const matchesKot = (k.kotNumber || '').toLowerCase().includes(query);
        const matchesWaiter = (k.waiterName || '').toLowerCase().includes(query);
        const matchesDish = k.items.some(i => (i.productName || '').toLowerCase().includes(query));
        if (!matchesTable && !matchesKot && !matchesWaiter && !matchesDish) return false;
      }

      return true;
    });
  }, [kitchenSourceTickets, filterMode, searchQuery]);

  const calculateElapsedMinutes = (timestamp: number) => {
    return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60)));
  };

  const getUrgencyBadge = (elapsedMinutes: number) => {
    if (elapsedMinutes >= 20) {
      return {
        bg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse',
        label: `${elapsedMinutes}m (Urgent)`
      };
    }
    if (elapsedMinutes >= 10) {
      return {
        bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        label: `${elapsedMinutes}m`
      };
    }
    return {
      bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      label: `${elapsedMinutes}m`
    };
  };

  const handlePrint = (ticket: KitchenOrderTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    if (printKOTForTicket) {
      printKOTForTicket(ticket);
    }
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Sleek, Compact Top KDS Control Bar */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Title & Live indicator */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Kitchen Display System
              </h1>
              <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Feed
              </span>
            </div>
            <p className="text-3xs text-slate-500 dark:text-slate-400">
              Real-time kitchen order ticket dispatch and dish preparation status
            </p>
          </div>
        </div>

        {/* Right: Search, Filter Tabs & Sound Chime */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table or dish..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-44 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Compact Filter Tabs */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200/80 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('active')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'active'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Active</span>
              <span className={`text-3xs px-1.5 py-0.2 rounded-md font-mono ${
                filterMode === 'active' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {stats.activeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('ready')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'ready'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Ready</span>
              <span className={`text-3xs px-1.5 py-0.2 rounded-md font-mono ${
                filterMode === 'ready' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {stats.readyCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('cancelled')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'cancelled'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Voided</span>
              {stats.cancelledCount > 0 && (
                <span className="text-3xs px-1.5 py-0.2 rounded-md font-mono bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  {stats.cancelledCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>All</span>
              <span className="text-3xs px-1.5 py-0.2 rounded-md font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                {stats.totalCount}
              </span>
            </button>
          </div>

          {/* Sound alert chime toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            title={soundEnabled ? "Mute kitchen order chimes" : "Enable kitchen order chimes"}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Uniform, Compact Tickets Grid */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 border border-emerald-200/60">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {filterMode === 'cancelled' ? 'No Cancelled Orders' : filterMode === 'ready' ? 'No Ready Orders Awaiting Pickup' : 'All Kitchen Tickets Cleared'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery 
              ? `No tickets match "${searchQuery}". Clear your search query to see other orders.`
              : 'Kitchen queue is currently clear. Orders fired from tables and counter POS will show here immediately.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 items-start">
          {filteredTickets.map(ticket => {
            const elapsed = calculateElapsedMinutes(ticket.createdAt);
            const urgency = getUrgencyBadge(elapsed);
            const isCancelledTicket = ticket.status === 'cancelled' || (ticket.items.length > 0 && ticket.items.every(i => i.status === 'cancelled'));
            const isReady = ticket.status === 'ready' && !isCancelledTicket;
            const isCompleted = ticket.status === 'completed' && !isCancelledTicket;
            const kitchenItems = ticket.items.filter(i => i.routingStation !== 'bar');
            const displayItems = kitchenItems.length > 0 ? kitchenItems : ticket.items;
            const activeCookingItems = displayItems.filter(i => i.status !== 'ready' && i.status !== 'served' && i.status !== 'cancelled');
            const cancelledItems = displayItems.filter(i => i.status === 'cancelled');

            return (
              <div
                key={ticket.id}
                className={`rounded-2xl border transition-all duration-150 flex flex-col justify-between overflow-hidden shadow-xs bg-white dark:bg-slate-900 ${
                  isCancelledTicket
                    ? 'border-rose-400 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/20'
                    : isReady
                    ? 'border-emerald-500 ring-2 ring-emerald-400/20'
                    : isCompleted
                    ? 'border-slate-300 dark:border-slate-700 opacity-60'
                    : elapsed >= 20
                    ? 'border-rose-400 dark:border-rose-700 ring-1 ring-rose-400/30'
                    : elapsed >= 10
                    ? 'border-amber-400 dark:border-amber-700'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {/* 1. Sleek Card Header (Compact & Tabular) */}
                <div className={`p-2.5 border-b flex items-center justify-between gap-1.5 ${
                  isCancelledTicket
                    ? 'bg-rose-100/70 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800'
                    : isReady
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-white shrink-0">
                      {ticket.tableNumber ? (ticket.tableNumber.toLowerCase().includes('table') ? ticket.tableNumber : `T-${ticket.tableNumber}`) : 'Counter'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-3xs font-mono font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {ticket.kotNumber}
                    </span>
                    {ticket.waiterName && (
                      <span className="text-3xs text-slate-500 dark:text-slate-400 truncate max-w-[80px]" title={ticket.waiterName}>
                        {ticket.waiterName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Elapsed Time Badge */}
                    <span className={`text-3xs font-mono font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${urgency.bg}`}>
                      <Clock className="w-2.5 h-2.5" />
                      <span>{urgency.label}</span>
                    </span>

                    {/* Quick Reprint Button */}
                    <button
                      type="button"
                      onClick={(e) => handlePrint(ticket, e)}
                      title="Reprint ticket slip to kitchen printer"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      <Printer className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* 2. Prominent Item Cancellation Notification Banner (If Any Cancelled) */}
                {cancelledItems.length > 0 && !isCancelledTicket && (
                  <div className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/70 border-b border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-3xs font-bold flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="block font-black">
                        {cancelledItems.length === 1 ? '1 Dish Cancelled' : `${cancelledItems.length} Dishes Cancelled`} by Staff:
                      </span>
                      <span className="font-normal text-rose-700 dark:text-rose-300 truncate block">
                        {cancelledItems.map(c => `${c.quantity}× ${c.productName}`).join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Ticket Special Notes (if present) */}
                {ticket.notes && (
                  <div className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-3xs font-medium flex items-center gap-1">
                    <span className="font-bold">Note:</span>
                    <span className="truncate">{ticket.notes}</span>
                  </div>
                )}

                {/* 4. Ticket Items: Clean, Compact Tabular Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800 p-1 flex-1 max-h-[320px] overflow-y-auto">
                  {displayItems.map((item, itemIdx) => {
                    const isCancelled = item.status === 'cancelled' || isCancelledTicket;
                    const isDone = item.status === 'ready' || item.status === 'served';

                    return (
                      <div
                        key={item.id || itemIdx}
                        onClick={() => {
                          if (!isCancelled && !isCancelledTicket && ticket.status !== 'completed') {
                            updateKOTItemStatus(ticket.id, item.id, isDone ? 'preparing' : 'ready');
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-colors select-none flex items-start justify-between gap-1.5 text-xs ${
                          isCancelled
                            ? 'bg-rose-50/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
                            : isDone
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-500 line-through cursor-pointer'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer'
                        }`}
                      >
                        {/* Dish Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-mono font-black text-xs shrink-0 ${
                              isCancelled ? 'line-through text-slate-400' : isDone ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              {item.quantity}×
                            </span>
                            <span className={`font-semibold truncate text-xs ${
                              isCancelled 
                                ? 'line-through text-slate-400 dark:text-slate-500' 
                                : isDone 
                                ? 'text-slate-400 dark:text-slate-500' 
                                : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              {item.productName}
                            </span>

                            {/* Cancelled badge */}
                            {isCancelled && (
                              <span className="text-3xs font-black px-1.5 py-0.2 rounded bg-rose-600 text-white uppercase tracking-wider shrink-0">
                                Cancelled
                              </span>
                            )}
                          </div>

                          {/* Add-ons List */}
                          {item.addonsList && item.addonsList.length > 0 && !isCancelled && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.addonsList.map((addon, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="text-3xs px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800"
                                >
                                  +{addon.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Cooking Instructions / Dish Note */}
                          {item.specialInstructions && !isCancelled && (
                            <p className="text-3xs text-blue-700 dark:text-blue-300 font-semibold italic mt-0.5">
                              Note: {item.specialInstructions}
                            </p>
                          )}

                          {/* Cancellation Details */}
                          {isCancelled && (item.cancelReason || item.cancelDisposition || item.notifiedKitchenBar) && (
                            <div className="mt-0.5 text-3xs space-y-0.5">
                              {item.cancelReason && (
                                <span className="text-rose-600 dark:text-rose-400 italic block">
                                  Reason: {item.cancelReason}
                                </span>
                              )}
                              <div className="flex items-center gap-1.5 flex-wrap font-bold">
                                {item.cancelDisposition === 'return_to_stock' && (
                                  <span className="text-emerald-700 dark:text-emerald-300">
                                    • Restocked
                                  </span>
                                )}
                                {item.cancelDisposition === 'mark_as_waste' && (
                                  <span className="text-rose-700 dark:text-rose-300">
                                    • Kitchen Waste
                                  </span>
                                )}
                                {item.notifiedKitchenBar && (
                                  <span className="text-blue-600 dark:text-blue-400">
                                    • Alerted
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Interactive Checkbox Indicator */}
                        <div className="shrink-0 pt-0.5">
                          {isCancelled ? (
                            <div className="w-4.5 h-4.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center text-xs font-black">
                              ✕
                            </div>
                          ) : (
                            <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-colors ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                            }`}>
                              {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 5. Sleek Card Footer with One-Click Bump Action */}
                <div className="p-2 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
                  {isCancelledTicket ? (
                    <div className="py-1.5 px-2 bg-rose-100/80 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Order Voided by Staff</span>
                    </div>
                  ) : activeCookingItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => updateKOTStatus(ticket.id, 'ready')}
                      className="w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark All Ready</span>
                    </button>
                  ) : !isCompleted ? (
                    <button
                      type="button"
                      onClick={() => updateKOTStatus(ticket.id, 'completed')}
                      className="w-full py-1.5 px-2.5 bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-98 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mark Served & Dismiss</span>
                    </button>
                  ) : (
                    <div className="py-1 text-center text-3xs font-semibold text-slate-400">
                      ✓ Completed
                    </div>
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
