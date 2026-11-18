import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wine, Clock, CheckCircle2, AlertTriangle, 
  Check, X, RefreshCw, Printer, Search, Volume2, BellOff, GlassWater
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { KitchenOrderTicket, KOTItem } from '../../types';

const KOT_RETENTION_MS = 24 * 60 * 60 * 1000;

const formatElapsedDuration = (elapsedMinutes: number): string => {
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;
  return mins === 0 ? `${hours}hr` : `${hours}:${String(mins).padStart(2, '0')}m`;
};

export const BarBOTView: React.FC = () => {
  const { kitchenTickets, updateKOTStatus, updateKOTItemStatus, products, printBOTForTicket } = useApp();
  const [filterMode, setFilterMode] = useState<'active' | 'ready' | 'completed' | 'cancelled' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Helper to determine if an item is a beverage / bar item
  const isBeverageItem = (item: KOTItem) => {
    if (!item) return false;
    if (item.routingStation === 'bar' || (item as any).orderRoutingStation === 'bar') return true;
    if (item.routingStation === 'kitchen' || (item as any).orderRoutingStation === 'kitchen') return false;
    if (item.course === 'beverage') return true;

    const prod = products.find(p => p.id === item.productId || (Boolean(p.name && item.productName) && String(p.name || '').toLowerCase() === String(item.productName || '').toLowerCase()));
    if (prod?.orderRoutingStation === 'bar') return true;
    if (prod?.orderRoutingStation === 'kitchen') return false;
    if (prod?.department === 'Drink' || prod?.itemType === 'beverage') return true;
    const catLower = String(prod?.category || '').toLowerCase();
    if (catLower.includes('drink') || catLower.includes('alcohol') || catLower.includes('bar') || catLower.includes('beverage') || catLower.includes('cocktail') || catLower.includes('liquor') || catLower.includes('wine') || catLower.includes('beer')) {
      return true;
    }
    const lower = String(item.productName || '').toLowerCase();
    return lower.includes('beer') || lower.includes('drink') || lower.includes('cocktail') || 
           lower.includes('mocktail') || lower.includes('juice') || lower.includes('tea') || 
           lower.includes('coffee') || lower.includes('water') || lower.includes('soda') || 
           lower.includes('wine') || lower.includes('whiskey') || lower.includes('gin');
  };

  // Filter tickets that contain Bar items and are within the 24-hour retention window
  const barSourceTickets = useMemo(() => {
    return kitchenTickets
      .filter(ticket => {
        const refTime = Number(ticket.createdAt || ticket.updatedAt || ticket.settledAt || nowMs);
        if (nowMs - refTime >= KOT_RETENTION_MS) return false;
        // Exclude pure kitchen tickets with no bar items
        const hasBarItems = (ticket.items || []).some(i => i && (i.routingStation === 'bar' || isBeverageItem(i)));
        if (ticket.destinationStation === 'kitchen' && ticket.ticketType === 'KOT' && !hasBarItems) return false;
        return hasBarItems || ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT';
      })
      .map(ticket => {
        const bevItems = ticket.items.filter(i => i.routingStation === 'bar' || isBeverageItem(i));
        return {
          ...ticket,
          barItems: (ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT') ? ticket.items : (bevItems.length > 0 ? bevItems : ticket.items)
        };
      })
      .filter(ticket => ticket.barItems.length > 0);
  }, [kitchenTickets, products, nowMs]);

  // Compute stat counts
  const stats = useMemo(() => {
    const isTicketVoided = (k: (typeof barSourceTickets)[number]) =>
      k.status === 'cancelled' || (k.barItems.length > 0 && k.barItems.every(i => i.status === 'cancelled'));
    const isTicketCompleted = (k: (typeof barSourceTickets)[number]) =>
      (k.status === 'completed' || Boolean(k.isSettled)) && !isTicketVoided(k);

    const active = barSourceTickets.filter(k => !isTicketCompleted(k) && !isTicketVoided(k));
    const preparing = active.filter(k => k.status === 'in_kitchen' || k.status === 'pending');
    const ready = active.filter(k => k.status === 'ready');
    const completed = barSourceTickets.filter(isTicketCompleted);
    const cancelled = barSourceTickets.filter(k => isTicketVoided(k) || k.barItems.some(i => i.status === 'cancelled'));
    const totalDrinks = active.reduce((sum, t) => sum + t.barItems.filter(i => i.status !== 'ready' && i.status !== 'served' && i.status !== 'cancelled').reduce((s, i) => s + i.quantity, 0), 0);

    return {
      activeCount: active.length,
      preparingCount: preparing.length,
      readyCount: ready.length,
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      totalCount: barSourceTickets.length,
      totalDrinks
    };
  }, [barSourceTickets]);

  // Filtered tickets based on active filterMode & search
  const filteredTickets = useMemo(() => {
    return barSourceTickets.filter(ticket => {
      const isCancelledTicket = ticket.status === 'cancelled' || (ticket.barItems.length > 0 && ticket.barItems.every(i => i.status === 'cancelled'));
      const hasCancelledItem = ticket.barItems.some(i => i.status === 'cancelled');
      const isCompletedTicket = (ticket.status === 'completed' || Boolean(ticket.isSettled)) && !isCancelledTicket;

      // Mode filter
      if (filterMode === 'active') {
        if (isCompletedTicket || isCancelledTicket) return false;
      } else if (filterMode === 'ready') {
        if (ticket.status !== 'ready' || isCompletedTicket || isCancelledTicket) return false;
      } else if (filterMode === 'completed') {
        if (!isCompletedTicket) return false;
      } else if (filterMode === 'cancelled') {
        if (!isCancelledTicket && !hasCancelledItem) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = String(searchQuery || '').toLowerCase().trim();
        const matchesTable = String(ticket.tableNumber || '').toLowerCase().includes(query);
        const matchesKot = String(ticket.kotNumber || '').toLowerCase().includes(query);
        const matchesWaiter = String(ticket.waiterName || '').toLowerCase().includes(query);
        const matchesDish = (ticket.barItems || []).some(i => i && String(i.productName || '').toLowerCase().includes(query));
        if (!matchesTable && !matchesKot && !matchesWaiter && !matchesDish) return false;
      }

      return true;
    });
  }, [barSourceTickets, filterMode, searchQuery]);

  const calculateElapsedMinutes = (timestamp: number) => {
    return Math.max(0, Math.floor((nowMs - timestamp) / (1000 * 60)));
  };

  const getUrgencyBadge = (elapsedMinutes: number, isInactive?: boolean) => {
    const formatted = formatElapsedDuration(elapsedMinutes);
    if (isInactive) {
      return {
        bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        label: formatted
      };
    }
    if (elapsedMinutes >= 15) {
      return {
        bg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse',
        label: `${formatted} (Urgent)`
      };
    }
    if (elapsedMinutes >= 8) {
      return {
        bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        label: formatted
      };
    }
    return {
      bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      label: formatted
    };
  };

  const handlePrint = (ticket: KitchenOrderTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    if (printBOTForTicket) {
      printBOTForTicket(ticket);
    }
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Sleek, Compact Top BOT Control Bar */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Title & Live indicator */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Wine className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Bar Display System (BOT)
              </h1>
              <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Live Bar Feed
              </span>
            </div>
            <p className="text-3xs text-slate-500 dark:text-slate-400">
              Real-time bar dispense orders • Settled bills auto-complete & cards clear every 24h
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
              placeholder="Search table or drink..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 w-36 sm:w-44 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
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
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Active</span>
              <span className={`text-3xs px-1.5 py-0.2 rounded-md font-mono ${
                filterMode === 'active' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
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
              onClick={() => setFilterMode('completed')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'completed'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Completed</span>
              <span className={`text-3xs px-1.5 py-0.2 rounded-md font-mono ${
                filterMode === 'completed' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {stats.completedCount}
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
            title={soundEnabled ? "Mute bar order chimes" : "Enable bar order chimes"}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
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
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 border border-amber-200/60">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {filterMode === 'cancelled'
              ? 'No Cancelled Bar Orders'
              : filterMode === 'ready'
              ? 'No Drinks Waiting at Bar'
              : filterMode === 'completed'
              ? 'No Completed Bar Orders in Last 24 Hours'
              : 'All Bar Tickets Dispensed'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery 
              ? `No bar tickets match "${searchQuery}". Clear your search to view all tickets.`
              : 'Bar queue is currently clear. Drink orders fired from tables and counter POS appear here immediately and auto-clear after 24 hours.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 items-start">
          {filteredTickets.map(ticket => {
            const elapsed = calculateElapsedMinutes(ticket.createdAt);
            const isCancelledTicket = ticket.status === 'cancelled' || (ticket.barItems.length > 0 && ticket.barItems.every(i => i.status === 'cancelled'));
            const isCompleted = (ticket.status === 'completed' || Boolean(ticket.isSettled)) && !isCancelledTicket;
            const isReady = ticket.status === 'ready' && !isCancelledTicket && !isCompleted;
            const urgency = getUrgencyBadge(elapsed, isCompleted || isCancelledTicket);
            const activeDrinks = ticket.barItems.filter(i => i.status !== 'ready' && i.status !== 'served' && i.status !== 'cancelled');
            const cancelledItems = ticket.barItems.filter(i => i.status === 'cancelled');

            return (
              <div
                key={ticket.id}
                className={`rounded-2xl border transition-all duration-150 flex flex-col justify-between overflow-hidden shadow-xs bg-white dark:bg-slate-900 ${
                  isCancelledTicket
                    ? 'border-rose-400 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/20'
                    : isReady
                    ? 'border-emerald-500 ring-2 ring-emerald-400/20'
                    : isCompleted
                    ? `border-slate-300 dark:border-slate-700 ${filterMode === 'completed' ? '' : 'opacity-75'}`
                    : elapsed >= 15
                    ? 'border-rose-400 dark:border-rose-700 ring-1 ring-rose-400/30'
                    : elapsed >= 8
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
                      {ticket.tableNumber ? (String(ticket.tableNumber).toLowerCase().includes('table') ? ticket.tableNumber : `T-${ticket.tableNumber}`) : 'Counter'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-3xs font-mono font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
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
                      title="Reprint BOT slip to bar printer"
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
                        {cancelledItems.length === 1 ? '1 Drink Cancelled' : `${cancelledItems.length} Drinks Cancelled`} by Staff:
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
                    <span className="font-bold">Bar Note:</span>
                    <span className="truncate">{ticket.notes}</span>
                  </div>
                )}

                {/* 4. Ticket Items: Clean, Compact Tabular Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800 p-1 flex-1 max-h-[320px] overflow-y-auto">
                  {ticket.barItems.map((item, itemIdx) => {
                    const isCancelled = item.status === 'cancelled' || isCancelledTicket;
                    const isDone = item.status === 'ready' || item.status === 'served' || isCompleted;

                    return (
                      <div
                        key={item.id || itemIdx}
                        onClick={() => {
                          if (!isCancelled && !isCancelledTicket && !isCompleted) {
                            updateKOTItemStatus(ticket.id, item.id, isDone ? 'preparing' : 'ready');
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-colors select-none flex items-start justify-between gap-1.5 text-xs ${
                          isCancelled
                            ? 'bg-rose-50/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
                            : isDone
                            ? `bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-500 line-through ${isCompleted ? '' : 'cursor-pointer'}`
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
                                  className="text-3xs px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800"
                                >
                                  +{addon.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Dispense Instructions / Bar Note */}
                          {item.specialInstructions && !isCancelled && (
                            <p className="text-3xs text-amber-700 dark:text-amber-300 font-semibold italic mt-0.5">
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
                                    • Bar Waste
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
                                : 'border-slate-300 dark:border-slate-600 hover:border-amber-500'
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
                  ) : isCompleted ? (
                    <div className="py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{ticket.isSettled ? 'Completed • Bill Settled' : 'Completed'}</span>
                    </div>
                  ) : activeDrinks.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => updateKOTStatus(ticket.id, 'ready')}
                      className="w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark All Ready</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateKOTStatus(ticket.id, 'completed')}
                      className="w-full py-1.5 px-2.5 bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-98 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mark Served & Dismiss</span>
                    </button>
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
