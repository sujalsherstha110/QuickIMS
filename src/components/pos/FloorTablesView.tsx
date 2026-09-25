import React, { useState, useMemo } from 'react';
import { 
  UtensilsCrossed, Users, Clock, Flame, CheckCircle2, 
  Receipt, ArrowRight, Plus, RefreshCw, ChefHat, Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DiningTable, TableStatus } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';

interface FloorTablesViewProps {
  onOpenTableOrder: (tableId: string) => void;
}

export const FloorTablesView: React.FC<FloorTablesViewProps> = ({ onOpenTableOrder }) => {
  const { 
    diningZones, diningTables, selectedTableId, setSelectedTableId,
    assignTableGuests, updateTableStatus, kitchenTickets
  } = useApp();

  const [activeZoneId, setActiveZoneId] = useState<string>('ALL');
  const [seatingModalTable, setSeatingModalTable] = useState<DiningTable | null>(null);
  const [guestsCountInput, setGuestsCountInput] = useState<number>(2);
  const [waiterNameInput, setWaiterNameInput] = useState<string>('Alex (Floor Staff)');

  // Filtered tables based on selected zone
  const filteredTables = useMemo(() => {
    if (activeZoneId === 'ALL') return diningTables;
    return diningTables.filter(t => t.zoneId === activeZoneId);
  }, [diningTables, activeZoneId]);

  // Statistics
  const stats = useMemo(() => {
    const total = diningTables.length;
    const available = diningTables.filter(t => t.status === 'available').length;
    const seated = diningTables.filter(t => t.status === 'seated').length;
    const kotFired = diningTables.filter(t => t.status === 'kot_fired').length;
    const billed = diningTables.filter(t => t.status === 'billed').length;
    const occupancyRate = total > 0 ? Math.round(((total - available) / total) * 100) : 0;

    return { total, available, seated, kotFired, billed, occupancyRate };
  }, [diningTables]);

  const handleTableClick = (table: DiningTable) => {
    setSelectedTableId(table.id);
    if (table.status === 'available') {
      setGuestsCountInput(table.capacity);
      setSeatingModalTable(table);
    } else {
      // Direct jump to POS order view for this table
      onOpenTableOrder(table.id);
    }
  };

  const handleConfirmSeating = async () => {
    if (!seatingModalTable) return;
    await assignTableGuests(seatingModalTable.id, guestsCountInput, waiterNameInput);
    const tableId = seatingModalTable.id;
    setSeatingModalTable(null);
    onOpenTableOrder(tableId);
  };

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case 'seated':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
            <Users className="w-2.5 h-2.5" />
            Ordering
          </span>
        );
      case 'kot_fired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
            <Flame className="w-2.5 h-2.5 text-amber-500 animate-bounce" />
            Cooking KOT
          </span>
        );
      case 'billed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
            <Receipt className="w-2.5 h-2.5 text-purple-500" />
            Check Printed
          </span>
        );
    }
  };

  const getCardBorder = (table: DiningTable) => {
    const isSelected = selectedTableId === table.id;
    if (isSelected) {
      return 'ring-2 ring-indigo-500 border-indigo-500 shadow-md';
    }
    switch (table.status) {
      case 'available':
        return 'border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600';
      case 'seated':
        return 'border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/20 dark:bg-indigo-950/20';
      case 'kot_fired':
        return 'border-amber-300 dark:border-amber-700/80 bg-amber-50/20 dark:bg-amber-950/20';
      case 'billed':
        return 'border-purple-300 dark:border-purple-800/80 bg-purple-50/20 dark:bg-purple-950/20';
    }
  };

  const calculateMinutesSeated = (openedAt?: number) => {
    if (!openedAt) return 0;
    return Math.floor((Date.now() - openedAt) / (1000 * 60));
  };

  return (
    <div className="space-y-5">
      
      {/* Top Floor Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Dining Floors & Live Tables</span>
            </h1>
            <span className="text-3xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-200/50">
              Live Restro Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tap any table to seat guests, fire KOT tickets, or print split guest checks.
          </p>
        </div>

        {/* Status Indicators Pill Bar */}
        <div className="flex flex-wrap items-center gap-2 text-2xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Available: <strong>{stats.available}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-indigo-700 dark:text-indigo-300 font-medium">Seated: <strong>{stats.seated}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-700 dark:text-amber-300 font-medium">Cooking: <strong>{stats.kotFired}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-purple-700 dark:text-purple-300 font-medium">Billed: <strong>{stats.billed}</strong></span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-2xs">
            Occupancy {stats.occupancyRate}%
          </div>
        </div>
      </div>

      {/* Zone Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveZoneId('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeZoneId === 'ALL'
              ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          All Dining Zones ({diningTables.length})
        </button>

        {diningZones.map(zone => {
          const zoneTableCount = diningTables.filter(t => t.zoneId === zone.id).length;
          const isActive = activeZoneId === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => setActiveZoneId(zone.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>{zone.name}</span>
              <span className={`text-3xs px-1.5 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-indigo-700/60 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {zoneTableCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live Floor Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
        {filteredTables.map(table => {
          const isAvailable = table.status === 'available';
          const isKotFired = table.status === 'kot_fired';
          const isBilled = table.status === 'billed';
          const minutesSeated = calculateMinutesSeated(table.openedAt);

          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`relative bg-white dark:bg-slate-900 border rounded-2xl p-3.5 sm:p-4 transition-all duration-150 cursor-pointer flex flex-col justify-between select-none hover:shadow-md hover:-translate-y-0.5 ${getCardBorder(table)}`}
            >
              {/* Header: Table Code & Status */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                      {table.tableNumber}
                    </span>
                    <span className="text-3xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5" />
                      {table.capacity}
                    </span>
                  </div>
                  {getStatusBadge(table.status)}
                </div>

                <p className="text-3xs text-slate-400 dark:text-slate-500 truncate mb-3">
                  {table.zoneName}
                </p>
              </div>

              {/* Body: Seated Waiter & Timer */}
              {!isAvailable ? (
                <div className="space-y-2 py-1.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                      <ChefHat className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{table.assignedWaiter || 'Server'}</span>
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-mono font-medium flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      {minutesSeated}m
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider">
                      Running Tab
                    </span>
                    <span className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {formatNPR(table.totalWithTax || table.subtotal || 0)}
                    </span>
                  </div>

                  {table.activeKOTCount && table.activeKOTCount > 0 ? (
                    <div className="w-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-3xs font-semibold px-2 py-0.5 rounded-md flex items-center justify-center gap-1">
                      <Flame className="w-2.5 h-2.5" />
                      <span>{table.activeKOTCount} KOT Cooking</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-4 text-center border-t border-dashed border-slate-100 dark:border-slate-800/80">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-1">
                    <Plus className="w-4 h-4" />
                  </div>
                  <p className="text-3xs font-medium text-slate-400">Tap to Seat Guests</p>
                </div>
              )}

              {/* Action Footer Button */}
              <div className="pt-2 mt-auto">
                <button
                  type="button"
                  className={`w-full py-1.5 px-2 rounded-xl text-3xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isAvailable
                      ? 'bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : isBilled
                      ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                      : isKotFired
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                  }`}
                >
                  <span>
                    {isAvailable ? 'Seat Table' : isBilled ? 'Collect Bill' : 'Open Ticket (POS)'}
                  </span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Guest Seating Modal */}
      {seatingModalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Seat Table {seatingModalTable.tableNumber}
                </h3>
                <p className="text-2xs text-slate-500">
                  {seatingModalTable.zoneName} • Max Capacity: {seatingModalTable.capacity} guests
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSeatingModalTable(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Number of Guests
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 4, 6, 8].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuestsCountInput(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        guestsCountInput === num
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Assigned Waiter / Server
                </label>
                <select
                  value={waiterNameInput}
                  onChange={(e) => setWaiterNameInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:border-indigo-500"
                >
                  <option value="Alex (Floor Staff)">Alex (Floor Staff)</option>
                  <option value="Pooja (Waitstaff)">Pooja (Waitstaff)</option>
                  <option value="Rohan (Waiter)">Rohan (Waiter)</option>
                  <option value="Bikash (Server)">Bikash (Server)</option>
                  <option value="Bar Station (Mixologist)">Bar Station (Mixologist)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSeatingModalTable(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSeating}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-colors cursor-pointer"
              >
                Open Table & Order
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
