import React, { useState, useMemo } from 'react';
import { 
  Building2, Layers, UtensilsCrossed, Users, Plus, Check, 
  Circle, Square, RectangleHorizontal, Clock, ShoppingBag, X, Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DiningTable, TableStatus } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTable: (tableId: string) => void;
  onSelectTakeaway?: () => void;
}

export const TableSelectionModal: React.FC<TableSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectTable,
  onSelectTakeaway
}) => {
  const { floors, sections, diningTables, selectedTableId, currentUser, assignTableGuests } = useApp();

  // Floor selection
  const [activeFloorId, setActiveFloorId] = useState<string>(() => {
    return floors[0]?.id || '';
  });
  const [activeSectionId, setActiveSectionId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Quick guest count selection modal before opening menu (optional quick prompt)
  const [pendingTable, setPendingTable] = useState<DiningTable | null>(null);
  const [guestCount, setGuestCount] = useState<number>(2);

  // Sync floor if changed
  React.useEffect(() => {
    if (floors.length > 0 && (!activeFloorId || !floors.some(f => f.id === activeFloorId))) {
      setActiveFloorId(floors[0].id);
    }
  }, [floors, activeFloorId]);

  const currentFloor = useMemo(() => {
    return floors.find(f => f.id === activeFloorId) || (floors.length > 0 ? floors[0] : null);
  }, [floors, activeFloorId]);

  const activeFloorSections = useMemo(() => {
    if (!currentFloor) return [];
    return sections.filter(s => s.floorId === currentFloor.id);
  }, [sections, currentFloor]);

  // Actual dining tables for active floor (ignoring purely architectural decor items like walls/windows)
  const actualTables = useMemo(() => {
    return diningTables.filter(t => {
      if (t.isDecor) return false;
      if (!['round', 'square', 'rectangular'].includes(t.shape)) return false;
      
      if (currentFloor) {
        const tableFloor = t.floorId || floors[0]?.id;
        if (tableFloor !== currentFloor.id) return false;
      }

      if (activeSectionId !== 'ALL' && t.sectionId && t.sectionId !== activeSectionId) {
        return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'cooking' && t.status !== 'kot_fired') return false;
        if (statusFilter !== 'cooking' && t.status !== statusFilter) return false;
      }

      return true;
    });
  }, [diningTables, currentFloor, floors, activeSectionId, statusFilter]);

  // Stats for active floor
  const stats = useMemo(() => {
    const floorTables = currentFloor 
      ? diningTables.filter(t => !t.isDecor && (t.floorId || floors[0]?.id) === currentFloor.id)
      : diningTables.filter(t => !t.isDecor);

    return {
      all: floorTables.length,
      available: floorTables.filter(t => t.status === 'available').length,
      seated: floorTables.filter(t => t.status === 'seated').length,
      cooking: floorTables.filter(t => t.status === 'kot_fired').length,
      billed: floorTables.filter(t => t.status === 'billed').length
    };
  }, [diningTables, currentFloor, floors]);

  if (!isOpen) return null;

  const handleTableClick = (table: DiningTable) => {
    if (table.status === 'available') {
      // If table is empty, prompt quick guest count
      setPendingTable(table);
      setGuestCount(table.capacity || 2);
    } else {
      // Table already occupied/active: directly enter
      onSelectTable(table.id);
      onClose();
    }
  };

  const handleConfirmGuests = async () => {
    if (!pendingTable) return;
    await assignTableGuests(pendingTable.id, guestCount, currentUser.name);
    onSelectTable(pendingTable.id);
    setPendingTable(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Select Dining Table</span>
                <span className="text-3xs font-mono font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  Step 1 of 2
                </span>
              </h2>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Choose a table from the floor layout to begin taking the order
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSelectTakeaway && (
              <button
                type="button"
                onClick={() => {
                  onSelectTakeaway();
                  onClose();
                }}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                <span>Quick Takeaway / Counter</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FLOOR & SECTION STRIP */}
        <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
          
          {/* Floor tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-14 shrink-0 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Floor:</span>
            </span>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {floors.map(flr => (
                <button
                  key={flr.id}
                  type="button"
                  onClick={() => {
                    setActiveFloorId(flr.id);
                    setActiveSectionId('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    currentFloor?.id === flr.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {flr.name}
                </button>
              ))}
            </div>
          </div>

          {/* Section row (if defined) */}
          {activeFloorSections.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-14 shrink-0 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Section:</span>
              </span>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveSectionId('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeSectionId === 'ALL'
                      ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All Sections
                </button>

                {activeFloorSections.map(sec => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      activeSectionId === sec.id
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STATUS FILTER PILLS */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            All ({stats.all})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('available')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'available'
                ? 'bg-slate-200 text-slate-900 border-2 border-slate-400'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Available ({stats.available})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('seated')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'seated'
                ? 'bg-sky-400 text-sky-950 font-black'
                : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Seated ({stats.seated})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('cooking')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'cooking'
                ? 'bg-amber-400 text-amber-950 font-black'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Cooking ({stats.cooking})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('billed')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'billed'
                ? 'bg-purple-400 text-purple-950 font-black'
                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Billed ({stats.billed})</span>
          </button>
        </div>

        {/* TABLES GRID */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-[300px]">
          {actualTables.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <UtensilsCrossed className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No tables found</p>
              <p className="text-xs text-slate-400 mt-1">
                Configure your tables in "Tables & Floor Plan" to place tables on this floor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {actualTables.map(tbl => {
                const isSelected = selectedTableId === tbl.id;
                const isOccupied = tbl.status !== 'available';

                return (
                  <div
                    key={tbl.id}
                    onClick={() => handleTableClick(tbl)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-98 flex flex-col justify-between h-36 ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-md'
                        : tbl.status === 'seated'
                        ? 'border-sky-300 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30 hover:border-sky-500'
                        : tbl.status === 'kot_fired'
                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 hover:border-amber-500'
                        : tbl.status === 'billed'
                        ? 'border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 hover:border-purple-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 hover:shadow-xs'
                    }`}
                  >
                    {/* Top Row: Table Name + Shape Icon */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-base font-black text-slate-900 dark:text-slate-100 block">
                          {tbl.tableNumber}
                        </span>
                        <span className="text-3xs text-slate-400 font-medium">
                          {tbl.sectionName || currentFloor?.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400">
                        {tbl.shape === 'round' ? (
                          <Circle className="w-4 h-4" />
                        ) : tbl.shape === 'square' ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <RectangleHorizontal className="w-4 h-4" />
                        )}
                        <span className="text-3xs font-bold font-mono">
                          {tbl.capacity || 4}s
                        </span>
                      </div>
                    </div>

                    {/* Middle Info / Order details if occupied */}
                    <div className="text-2xs space-y-0.5">
                      {tbl.status === 'available' ? (
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Ready for guests</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200">
                            <span>{tbl.currentGuests || 2} Guests</span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-400">
                              {tbl.totalWithTax ? formatNPR(tbl.totalWithTax) : ''}
                            </span>
                          </div>
                          <div className="text-3xs text-slate-500 dark:text-slate-400 truncate">
                            Waiter: {tbl.assignedWaiter || 'Staff'}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bottom Status Badge */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className={`text-3xs font-extrabold uppercase px-2 py-0.5 rounded-md ${
                        tbl.status === 'seated'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          : tbl.status === 'kot_fired'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : tbl.status === 'billed'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {tbl.status === 'kot_fired' ? 'Cooking' : tbl.status}
                      </span>

                      <span className="text-3xs font-bold text-indigo-600 dark:text-indigo-400">
                        {isOccupied ? 'View Order →' : 'Take Order →'}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* QUICK GUEST PROMPT MODAL (If Available table was tapped) */}
        {pendingTable && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Open Table {pendingTable.tableNumber}
                  </h3>
                  <p className="text-3xs text-slate-500">
                    {currentFloor?.name} • Capacity: {pendingTable.capacity} seats
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingTable(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Guest Count Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Number of Guests
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 4, 6, 8, 10].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setGuestCount(cnt)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        guestCount === cnt
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cnt} {cnt === 1 ? 'Guest' : 'Guests'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPendingTable(null)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmGuests}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Proceed to Menu</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
