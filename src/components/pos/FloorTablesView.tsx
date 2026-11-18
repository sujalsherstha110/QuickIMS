import React, { useState, useMemo, useEffect } from 'react';
import { 
  UtensilsCrossed, Plus, Circle, Square, RectangleHorizontal,
  Layers, Building2, Copy, Trash2, Check, X, Move, Sparkles,
  Settings, Edit2, Save, CheckCircle2, ChevronRight, AlertCircle, LayoutGrid,
  ShoppingCart
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DiningTable, TableStatus, TableShape, RestaurantFloor, RestaurantSection } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';
import { InteractiveFloorCanvas } from './InteractiveFloorCanvas';
import { FloorSectionConfigView } from './FloorSectionConfigView';

interface FloorTablesViewProps {
  onOpenTableOrder?: (tableId: string) => void;
  initialMode?: 'canvas' | 'manager';
}

export const FloorTablesView: React.FC<FloorTablesViewProps> = ({ onOpenTableOrder, initialMode = 'canvas' }) => {
  const { 
    draftFloors: floors, draftSections: sections, draftDiningTables: diningTables,
    selectedTableId, setSelectedTableId,
    addDiningTable, updateDiningTable, deleteDiningTable,
    addFloor, updateFloor, deleteFloor,
    addSection, updateSection, deleteSection,
    saveFloorPlanToCloud, discardFloorPlanDraft, hasUnsavedFloorPlan,
    activePOSStaff, activeStaffUser, currentUser,
    isSuperAdmin, isAdmin
  } = useApp();

  const currentOperator = activePOSStaff || activeStaffUser;
  // Floor layout editing permission (Owners, Admins, SuperAdmins, and Staff with canManageStaff)
  const canEditFloorLayout = isSuperAdmin || isAdmin || !currentOperator || currentUser?.role === 'owner' || !!currentOperator?.permissions?.canManageStaff;

  // View Mode: 'canvas' for 2D visual canvas or 'manager' for structured table/section/floor hierarchy manager
  const [activeViewMode, setActiveViewMode] = useState<'canvas' | 'manager'>(initialMode);

  // Status Filter: 'all', 'available', 'cooking', 'draft'
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected Floor & Section (Persisted in localStorage so switching sidebar tabs retains the exact floor)
  const [activeFloorId, setActiveFloorId] = useState<string>(() => {
    const saved = localStorage.getItem('quickims_active_floor_id');
    if (saved && floors.some(f => f.id === saved)) {
      return saved;
    }
    return floors[0]?.id || '';
  });
  const [activeSectionId, setActiveSectionId] = useState<string>('ALL');

  // Snap to Grid state
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Sync and persist activeFloorId
  useEffect(() => {
    if (activeFloorId) {
      localStorage.setItem('quickims_active_floor_id', activeFloorId);
    }
  }, [activeFloorId]);

  // Sync activeFloorId if floors change or current floor was deleted
  useEffect(() => {
    if (floors.length > 0 && (!activeFloorId || !floors.some(f => f.id === activeFloorId))) {
      const nextId = floors[0].id;
      setActiveFloorId(nextId);
      localStorage.setItem('quickims_active_floor_id', nextId);
    }
  }, [floors, activeFloorId]);

  // Current floor & sections
  const currentFloor = useMemo(() => {
    return floors.find(f => f.id === activeFloorId) || (floors.length > 0 ? floors[0] : null);
  }, [floors, activeFloorId]);

  // Dynamic sections belonging to currently selected floor
  const activeFloorSections = useMemo(() => {
    if (!currentFloor) return [];
    return sections.filter(s => s.floorId === currentFloor.id);
  }, [sections, currentFloor]);

  // Next Auto Table Number (T1, T2, T3...)
  const nextTableNumber = useMemo(() => {
    const existingTableNums = diningTables
      .filter(t => !t.isDecor && t.tableNumber?.startsWith('T'))
      .map(t => {
        const num = parseInt(t.tableNumber.replace(/[^0-9]/g, ''), 10);
        return isNaN(num) ? 0 : num;
      });
    const maxNum = existingTableNums.length > 0 ? Math.max(...existingTableNums) : 0;
    return `T${maxNum + 1}`;
  }, [diningTables]);

  // ZONE 3A: Table Creator State
  const [tableNameInput, setTableNameInput] = useState<string>('');
  const [tableShapeInput, setTableShapeInput] = useState<'round' | 'square' | 'rectangular'>('rectangular');
  const [tableSeatsInput, setTableSeatsInput] = useState<number>(4);

  // Sync tableNameInput with next auto-number if empty
  useEffect(() => {
    if (!tableNameInput) {
      setTableNameInput(nextTableNumber);
    }
  }, [nextTableNumber, tableNameInput]);

  // ZONE 3B: External Shape Creator State
  type ExternalType = 'wall' | 'window' | 'door' | 'plant' | 'counter' | 'section' | 'other';
  const [externalTypeInput, setExternalTypeInput] = useState<ExternalType>('wall');
  const [externalNameInput, setExternalNameInput] = useState<string>('Wall');

  // Modals
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [showAddFloorModal, setShowAddFloorModal] = useState<boolean>(false);
  const [newFloorName, setNewFloorName] = useState<string>('');

  const [showAddSectionModal, setShowAddSectionModal] = useState<boolean>(false);
  const [newSectionName, setNewSectionName] = useState<string>('');

  // Editing in Manage Modal
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [tempFloorName, setTempFloorName] = useState<string>('');
  const [confirmDeleteFloorId, setConfirmDeleteFloorId] = useState<string | null>(null);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [tempSectionName, setTempSectionName] = useState<string>('');
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);

  // Save Confirmation & Progress Toast State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Filtered tables for active floor & section
  const displayedTables = useMemo(() => {
    return diningTables.filter(t => {
      // Floor filter: strict floor matching to prevent cross-floor bleed
      if (currentFloor) {
        const tableFloor = t.floorId || floors[0]?.id;
        if (tableFloor !== currentFloor.id) {
          return false;
        }
      }
      // Section filter (only applied if user has selected a specific section)
      if (activeSectionId !== 'ALL' && t.sectionId && t.sectionId !== activeSectionId) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const normalizedStatus = t.status === 'seated' ? 'available' : t.status;
        if (statusFilter === 'cooking' && normalizedStatus !== 'kot_fired') return false;
        if (statusFilter !== 'cooking' && normalizedStatus !== statusFilter) return false;
      }
      return true;
    });
  }, [diningTables, currentFloor, floors, activeSectionId, statusFilter]);

  // Stats for the Status pills in Zone 1
  const stats = useMemo(() => {
    const floorTables = currentFloor 
      ? diningTables.filter(t => (t.floorId || floors[0]?.id) === currentFloor.id)
      : diningTables;
    const actual = floorTables.filter(t => !t.isDecor && ['round', 'square', 'rectangular'].includes(t.shape));
    
    return {
      all: actual.length,
      available: actual.filter(t => t.status === 'available' || t.status === 'seated').length,
      cooking: actual.filter(t => t.status === 'kot_fired').length,
      draft: actual.filter(t => t.status === 'draft').length
    };
  }, [diningTables, currentFloor, floors]);

  // Selected table object (if any)
  const selectedTable = useMemo(() => {
    return diningTables.find(t => t.id === selectedTableId) || null;
  }, [diningTables, selectedTableId]);

  // Calculate smart next open position (center or cascade)
  const getNextDropPosition = () => {
    const baseX = 450;
    const baseY = 250;
    const offsetCount = displayedTables.length % 8;
    const x = baseX + (offsetCount % 4) * 80;
    const y = baseY + Math.floor(offsetCount / 4) * 80;
    return { x, y };
  };

  // DROP TABLE ONTO CANVAS
  const handleDropTable = async () => {
    const name = tableNameInput.trim() || nextTableNumber;
    const pos = getNextDropPosition();

    let w = 100;
    let h = 85;
    if (tableShapeInput === 'round') {
      w = tableSeatsInput > 4 ? 120 : 95;
      h = w;
    } else if (tableShapeInput === 'square') {
      w = 95;
      h = 95;
    } else {
      w = tableSeatsInput > 4 ? 160 : 130;
      h = 85;
    }

    const created = await addDiningTable({
      tableNumber: name,
      floorId: currentFloor?.id,
      floorName: currentFloor?.name,
      sectionId: activeSectionId !== 'ALL' ? activeSectionId : activeFloorSections[0]?.id,
      sectionName: activeSectionId !== 'ALL' 
        ? activeFloorSections.find(s => s.id === activeSectionId)?.name 
        : activeFloorSections[0]?.name,
      capacity: tableSeatsInput || 4,
      shape: tableShapeInput,
      status: 'available',
      width: w,
      height: h,
      posX: pos.x,
      posY: pos.y,
      rotation: 0,
      isDecor: false
    });

    setSelectedTableId(created.id);
    setTableNameInput('');
  };

  // DROP EXTERNAL SHAPE ONTO CANVAS
  const handleDropExternalShape = async () => {
    const name = externalNameInput.trim() || externalTypeInput.toUpperCase();
    const pos = getNextDropPosition();

    let w = 150;
    let h = 60;
    let shape: TableShape = 'wall';

    switch (externalTypeInput) {
      case 'wall':
        shape = 'wall';
        w = 18;
        h = 180;
        break;
      case 'window':
        shape = 'window';
        w = 160;
        h = 22;
        break;
      case 'door':
        shape = 'door';
        w = 80;
        h = 80;
        break;
      case 'plant':
        shape = 'plant';
        w = 65;
        h = 65;
        break;
      case 'counter':
        shape = 'counter';
        w = 150;
        h = 65;
        break;
      case 'section':
        shape = 'section';
        w = 220;
        h = 140;
        break;
      case 'other':
      default:
        shape = 'other';
        w = 120;
        h = 60;
        break;
    }

    const created = await addDiningTable({
      tableNumber: name,
      floorId: currentFloor?.id,
      floorName: currentFloor?.name,
      capacity: 0,
      shape,
      status: 'available',
      width: w,
      height: h,
      posX: pos.x,
      posY: pos.y,
      rotation: 0,
      isDecor: true,
      decorType: externalTypeInput as any
    });

    setSelectedTableId(created.id);
  };

  // Duplicate Table/Shape (Ctrl+D)
  const handleDuplicate = async (table: DiningTable) => {
    const nextLabel = table.isDecor ? table.tableNumber : `T${diningTables.length + 1}`;
    const nextX = Math.min(1200, (table.posX || 200) + 35);
    const nextY = Math.min(650, (table.posY || 200) + 30);

    const cloned = await addDiningTable({
      tableNumber: nextLabel,
      floorId: table.floorId,
      floorName: table.floorName,
      sectionId: table.sectionId,
      sectionName: table.sectionName,
      capacity: table.capacity,
      shape: table.shape,
      status: 'available',
      width: table.width,
      height: table.height,
      rotation: table.rotation || 0,
      posX: nextX,
      posY: nextY,
      isDecor: table.isDecor,
      decorType: table.decorType
    });

    setSelectedTableId(cloned.id);
  };

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFloorName.trim()) return;
    const flr = await addFloor({
      name: newFloorName.trim(),
      code: newFloorName.trim().slice(0, 3).toUpperCase(),
      order: floors.length + 1,
      active: true
    });
    setActiveFloorId(flr.id);
    setNewFloorName('');
    setShowAddFloorModal(false);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim() || !currentFloor) return;
    const sec = await addSection({
      floorId: currentFloor.id,
      name: newSectionName.trim(),
      order: activeFloorSections.length + 1,
      active: true
    });
    setActiveSectionId(sec.id);
    setNewSectionName('');
    setShowAddSectionModal(false);
  };

  const handleDeleteFloor = async (floorId: string) => {
    await deleteFloor(floorId);
    setConfirmDeleteFloorId(null);
    const remaining = floors.filter(f => f.id !== floorId);
    if (remaining.length > 0) {
      setActiveFloorId(remaining[0].id);
    } else {
      setActiveFloorId('');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    await deleteSection(sectionId);
    setConfirmDeleteSectionId(null);
    if (activeSectionId === sectionId) {
      setActiveSectionId('ALL');
    }
  };

  // SAVE FLOOR PLAN HANDLER (Fast atomic publish to live operational POS & Cloud)
  const handleSaveFloorPlan = async () => {
    setIsSaving(true);
    try {
      const success = await saveFloorPlanToCloud();
      if (success) {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
        }, 4000);
      }
    } catch (err) {
      console.error('Error saving floor plan:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (activeViewMode === 'manager') {
    return (
      <div className="space-y-4 max-w-7xl mx-auto select-none">
        {/* TOP HEADER WITH VIEW SWITCHER */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Floor & Table Architecture Manager</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveViewMode('canvas')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>2D Floor Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('manager')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Floor & Table Manager</span>
            </button>
          </div>
        </div>

        <FloorSectionConfigView onDone={() => setActiveViewMode('canvas')} />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-7xl mx-auto select-none">
      
      {/* ========================================================================= */}
      {/* ZONE 1: TOP HEADER & STATUS FILTER (Restyled as Requested)               */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        
        {/* Row 1: Header + Manage Button + View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Tables & Floor Plan</span>
            </h1>

            {/* Live vs Draft indicator */}
            {hasUnsavedFloorPlan ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Draft (Unsaved)</span>
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Live in POS</span>
              </span>
            )}

            {/* Manage Button Right Next to Header */}
            {canEditFloorLayout && (
              <button
                type="button"
                onClick={() => setShowManageModal(true)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Settings className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Manage</span>
              </button>
            )}
          </div>

          {/* View Mode Toggle: 2D Canvas vs Architecture Manager */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveViewMode('canvas')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>2D Floor Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('manager')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Floor & Table Manager</span>
            </button>
          </div>
        </div>

        {/* Row 2: Status Filter Buttons Directly Below Header */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* All Tables */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All tables ({stats.all})
          </button>

          {/* Available */}
          <button
            type="button"
            onClick={() => setStatusFilter('available')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'available'
                ? 'bg-slate-200 text-slate-900 border-2 border-slate-400 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Available ({stats.available})</span>
          </button>

          {/* Cooking */}
          <button
            type="button"
            onClick={() => setStatusFilter('cooking')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'cooking'
                ? 'bg-amber-400 text-amber-950 font-black shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Cooking ({stats.cooking})</span>
          </button>

          {/* Drafts */}
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'draft'
                ? 'bg-rose-500 text-white font-black shadow-xs ring-2 ring-rose-400/50'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Drafts ({stats.draft})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ZONE 2: DYNAMIC FLOOR & OPTIONAL SECTION STRIP (No Hardcoded Defaults)    */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:px-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
        
        {/* Floor: [ Floor 1 ] [ Floor 2 ] [ + Add ] */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 w-16 shrink-0 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Floor:</span>
          </span>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {floors.map(flr => (
              <button
                key={flr.id}
                type="button"
                onClick={() => {
                  setActiveFloorId(flr.id);
                  setActiveSectionId('ALL');
                }}
                className={`px-4 sm:px-5 py-2 min-h-[40px] rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  currentFloor?.id === flr.id
                    ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25 ring-2 ring-amber-400/90'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {flr.name}
              </button>
            ))}

            {/* Single clean "+ Add" button */}
            {canEditFloorLayout && (
              <button
                type="button"
                onClick={() => setShowAddFloorModal(true)}
                className="px-3 py-2 min-h-[40px] bg-slate-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-600 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-bold border border-dashed border-slate-300 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>

        {/* OPTIONAL SECTION ROW: SHOWN IF SECTIONS EXIST OR IN LAYOUT EDIT MODE */}
        {(activeFloorSections.length > 0 || canEditFloorLayout) && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-16 shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Section:</span>
            </span>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveSectionId('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeSectionId === 'ALL'
                    ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold'
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
                      ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/20 inset font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {sec.name}
                </button>
              ))}

              {canEditFloorLayout && (
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(true)}
                  className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* ZONE 3: SIDE-BY-SIDE CONTROLS (Table & External Shape)                    */}
      {/* ========================================================================= */}
      {canEditFloorLayout ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        
        {/* LEFT PANEL: TABLE CREATOR */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Table
            </h3>
            <span className="text-3xs font-mono text-slate-400">Direct Drop to Canvas</span>
          </div>

          {/* Table Name */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 w-28 shrink-0">
              Table Name:
            </label>
            <input
              type="text"
              value={tableNameInput}
              onChange={(e) => setTableNameInput(e.target.value)}
              placeholder="e.g. T1, T2, VIP-1"
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Table Shape: ◯ (Circle), ▢ (Square), ▭ (Rectangle) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 w-28 shrink-0">
              Table shape:
            </label>
            <div className="flex items-center gap-1.5 flex-1">
              <button
                type="button"
                onClick={() => setTableShapeInput('round')}
                className={`flex-1 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tableShapeInput === 'round'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
                title="Circle Dining Table"
              >
                <Circle className="w-3.5 h-3.5" />
                <span>Circle</span>
              </button>

              <button
                type="button"
                onClick={() => setTableShapeInput('square')}
                className={`flex-1 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tableShapeInput === 'square'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
                title="Square Dining Table"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Square</span>
              </button>

              <button
                type="button"
                onClick={() => setTableShapeInput('rectangular')}
                className={`flex-1 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tableShapeInput === 'rectangular'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
                title="Rectangular Dining Table"
              >
                <RectangleHorizontal className="w-3.5 h-3.5" />
                <span>Rectangle</span>
              </button>
            </div>
          </div>

          {/* Seats */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 w-28 shrink-0">
              Seats:
            </label>
            <div className="flex items-center gap-1.5 flex-1">
              {[2, 4, 6, 8, 10].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTableSeatsInput(s)}
                  className={`w-8 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    tableSeatsInput === s
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {s}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={30}
                value={tableSeatsInput}
                onChange={(e) => setTableSeatsInput(parseInt(e.target.value, 10) || 4)}
                className="w-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-bold text-slate-900 dark:text-slate-100 outline-hidden"
              />
            </div>
          </div>

          {/* Drop Button */}
          <button
            type="button"
            onClick={handleDropTable}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Drop Table onto Canvas</span>
          </button>
        </div>

        {/* RIGHT PANEL: EXTERNAL SHAPE CREATOR */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              External shape
            </h3>
            <span className="text-3xs font-mono text-slate-400">Architectural Elements</span>
          </div>

          {/* Shapes Chips: Wall, Window, Door, Plant, Counter, Section, Other */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'wall', label: 'Wall' },
              { id: 'window', label: 'Window' },
              { id: 'door', label: 'Door' },
              { id: 'plant', label: 'Plant' },
              { id: 'counter', label: 'Counter' },
              { id: 'section', label: 'Section' },
              { id: 'other', label: 'Other' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setExternalTypeInput(item.id as ExternalType);
                  setExternalNameInput(item.label);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  externalTypeInput === item.id
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Name - */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 w-20 shrink-0">
              Name -
            </label>
            <input
              type="text"
              value={externalNameInput}
              onChange={(e) => setExternalNameInput(e.target.value)}
              placeholder="e.g. Wall, Door, Window, Cash Counter"
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Drop External Shape Button */}
          <button
            type="button"
            onClick={handleDropExternalShape}
            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Drop Shape onto Canvas</span>
          </button>
        </div>

      </div>
      ) : (
        <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 font-semibold shadow-2xs">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Floor Service Mode: Tap any dining table to punch orders and view running items</span>
          </div>
          <span className="text-3xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">
            Waiter Access
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZONE 4: THE 2D ARCHITECTURAL CANVAS                                      */}
      {/* ========================================================================= */}
      <InteractiveFloorCanvas
        tables={displayedTables}
        selectedTableId={selectedTableId}
        onSelectTable={setSelectedTableId}
        onUpdateTable={canEditFloorLayout ? updateDiningTable : undefined}
        onDeleteTable={canEditFloorLayout ? deleteDiningTable : undefined}
        onDuplicateTable={canEditFloorLayout ? handleDuplicate : undefined}
        snapToGrid={snapToGrid}
        setSnapToGrid={setSnapToGrid}
        mode={canEditFloorLayout ? 'edit' : 'pos'}
        onTableActionClick={!canEditFloorLayout ? ((table) => onOpenTableOrder?.(table.id)) : undefined}
      />

      {/* ========================================================================= */}
      {/* ZONE 5: BOTTOM SAVE BAR                                                  */}
      {/* ========================================================================= */}
      {canEditFloorLayout && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Table & Floor Architecture
                </span>
                {hasUnsavedFloorPlan ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Unsaved Draft</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>Published to POS</span>
                  </span>
                )}
              </div>
              <span className="text-3xs text-slate-500 font-mono">
                {displayedTables.length} objects on this floor • {hasUnsavedFloorPlan ? 'Only saved as draft until you click Save' : 'Live across entire POS app'}
              </span>
            </div>

            {selectedTable && !selectedTable.isDecor && (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Selected: <span className="text-blue-600 dark:text-blue-400 font-mono">{selectedTable.tableNumber}</span> ({selectedTable.capacity} seats)
                </span>
                {onOpenTableOrder && (
                  <button
                    type="button"
                    onClick={() => onOpenTableOrder(selectedTable.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold shadow-2xs cursor-pointer transition-all"
                    title="Take order for this table in POS"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Open in POS</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {hasUnsavedFloorPlan && (
              <button
                type="button"
                onClick={discardFloorPlanDraft}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                title="Discard unsaved changes and revert to published POS layout"
              >
                Discard Draft
              </button>
            )}

            {saveSuccess && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Table & Floor Plan saved successfully!</span>
              </div>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveFloorPlan}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer flex items-center gap-2 ${
                isSaving
                  ? 'bg-blue-400 text-white cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-blue-600/25'
              }`}
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving Floor Plan...' : 'Save Table & Floor Plan'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANAGE FLOORS & SECTIONS MODAL (Rename, Reorder, Delete)                  */}
      {/* ========================================================================= */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Manage Floors & Sections
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Switch to Full Hierarchy Manager */}
            <div className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/80 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>3-Tier Floor, Section & Table Manager</span>
                </p>
                <p className="text-3xs text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                  Structured builder for table capacities, shapes, numbering & multi-floor architecture.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManageModal(false);
                  setActiveViewMode('manager');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer shrink-0 transition-all active:scale-95"
              >
                Open Manager
              </button>
            </div>

            {/* FLOORS MANAGEMENT LIST */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Floors ({floors.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddFloorModal(true)}
                  className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-300 rounded-lg text-3xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Floor</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {floors.map((flr, idx) => (
                  <div
                    key={flr.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40"
                  >
                    {editingFloorId === flr.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={tempFloorName}
                          onChange={(e) => setTempFloorName(e.target.value)}
                          className="bg-white dark:bg-slate-800 border border-blue-500 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 font-bold outline-hidden flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (tempFloorName.trim()) {
                              await updateFloor(flr.id, { name: tempFloorName.trim() });
                            }
                            setEditingFloorId(null);
                          }}
                          className="px-2 py-1 bg-blue-600 text-white rounded-lg text-3xs font-bold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFloorId(null)}
                          className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-3xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-3xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {flr.name}
                        </span>
                        {currentFloor?.id === flr.id && (
                          <span className="text-3xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold">
                            Active
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {confirmDeleteFloorId === flr.id ? (
                        <div className="flex items-center gap-1 animate-in fade-in">
                          <button
                            type="button"
                            onClick={() => handleDeleteFloor(flr.id)}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-3xs font-bold cursor-pointer transition-colors"
                          >
                            Delete Floor?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFloorId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFloorId(flr.id);
                              setTempFloorName(flr.name);
                              setConfirmDeleteFloorId(null);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer"
                            title="Rename Floor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFloorId(flr.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                            title="Delete Floor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTIONS MANAGEMENT LIST (For Current Floor) */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Sections for {currentFloor?.name || 'Floor'}</span>
                  </span>
                  <span className="text-3xs text-slate-400">
                    Optional: leave empty if floor doesn't need separate sections.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(true)}
                  className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-300 rounded-lg text-3xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Section</span>
                </button>
              </div>

              {activeFloorSections.length === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-3xs text-slate-400 font-mono">
                  No sections on this floor. Section row is hidden automatically.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeFloorSections.map(sec => (
                    <div
                      key={sec.id}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40"
                    >
                      {editingSectionId === sec.id ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            value={tempSectionName}
                            onChange={(e) => setTempSectionName(e.target.value)}
                            className="bg-white dark:bg-slate-800 border border-blue-500 rounded-lg px-2 py-0.5 text-xs text-slate-900 dark:text-slate-100 font-bold outline-hidden flex-1"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (tempSectionName.trim()) {
                                await updateSection(sec.id, { name: tempSectionName.trim() });
                              }
                              setEditingSectionId(null);
                            }}
                            className="px-2 py-0.5 bg-blue-600 text-white rounded text-3xs font-bold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSectionId(null)}
                            className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-3xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {sec.name}
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        {confirmDeleteSectionId === sec.id ? (
                          <div className="flex items-center gap-1 animate-in fade-in">
                            <button
                              type="button"
                              onClick={() => handleDeleteSection(sec.id)}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-3xs font-bold cursor-pointer transition-colors"
                            >
                              Delete?
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSectionId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSectionId(sec.id);
                                setTempSectionName(sec.name);
                                setConfirmDeleteSectionId(null);
                              }}
                              className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                              title="Rename Section"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSectionId(sec.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                              title="Delete Section"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD FLOOR MODAL */}
      {showAddFloorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Add New Floor
              </h3>
              <button
                type="button"
                onClick={() => setShowAddFloorModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFloor} className="space-y-3">
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Floor Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor, Rooftop, Terrace, Garden"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddFloorModal(false)}
                  className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Add Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SECTION MODAL */}
      {showAddSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Add Section to {currentFloor?.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSectionModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSection} className="space-y-3">
              <div>
                <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Section Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indoor AC, Balcony, Patio, Bar Area"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
