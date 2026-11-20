import React, { useState, useMemo } from 'react';
import { 
  Layers, Plus, Edit2, Trash2, Check, X, ArrowRight,
  FolderTree, AlertCircle, Eye, EyeOff, LayoutGrid,
  Users, ChevronRight, Sparkles, Building2, MapPin,
  Maximize2, ArrowUp, ArrowDown, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RestaurantFloor, RestaurantSection, DiningTable, TableShape } from '../../types';

interface FloorSectionConfigViewProps {
  onDone?: () => void;
}

export const FloorSectionConfigView: React.FC<FloorSectionConfigViewProps> = ({ onDone }) => {
  const { 
    draftFloors: floors, draftSections: sections, draftDiningTables: diningTables,
    addFloor, updateFloor, deleteFloor,
    addSection, updateSection, deleteSection,
    addDiningTable, updateDiningTable, deleteDiningTable,
    canStaffDo
  } = useApp();

  const canWriteFloor = canStaffDo('tableFloor', 'write');
  const canUpdateFloor = canStaffDo('tableFloor', 'update');
  const canDeleteFloor = canStaffDo('tableFloor', 'delete');

  // Active selections in the hierarchy
  const [selectedFloorId, setSelectedFloorId] = useState<string>(() => {
    return floors[0]?.id || '';
  });

  // Ensure selectedFloorId is valid
  React.useEffect(() => {
    if (floors.length > 0 && (!selectedFloorId || !floors.some(f => f.id === selectedFloorId))) {
      setSelectedFloorId(floors[0].id);
    } else if (floors.length === 0) {
      setSelectedFloorId('');
    }
  }, [floors, selectedFloorId]);

  const activeFloor = useMemo(() => {
    return floors.find(f => f.id === selectedFloorId) || null;
  }, [floors, selectedFloorId]);

  // Sections under active floor
  const sectionsInActiveFloor = useMemo(() => {
    if (!selectedFloorId) return [];
    return sections.filter(s => s.floorId === selectedFloorId).sort((a, b) => a.order - b.order);
  }, [sections, selectedFloorId]);

  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  React.useEffect(() => {
    if (sectionsInActiveFloor.length > 0 && (!selectedSectionId || !sectionsInActiveFloor.some(s => s.id === selectedSectionId))) {
      setSelectedSectionId(sectionsInActiveFloor[0].id);
    } else if (sectionsInActiveFloor.length === 0) {
      setSelectedSectionId('');
    }
  }, [sectionsInActiveFloor, selectedSectionId]);

  const activeSection = useMemo(() => {
    return sections.find(s => s.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  // Tables in active section
  const tablesInSection = useMemo(() => {
    if (!selectedSectionId) return [];
    return diningTables.filter(t => t.sectionId === selectedSectionId || t.zoneId === selectedSectionId);
  }, [diningTables, selectedSectionId]);

  // Modal / Form States
  const [floorModal, setFloorModal] = useState<{ open: boolean; mode: 'add' | 'edit'; floor?: RestaurantFloor }>({
    open: false,
    mode: 'add'
  });
  const [floorNameInput, setFloorNameInput] = useState('');
  const [floorCodeInput, setFloorCodeInput] = useState('');
  const [floorDescInput, setFloorDescInput] = useState('');

  const [sectionModal, setSectionModal] = useState<{ open: boolean; mode: 'add' | 'edit'; section?: RestaurantSection }>({
    open: false,
    mode: 'add'
  });
  const [sectionNameInput, setSectionNameInput] = useState('');
  const [sectionDescInput, setSectionDescInput] = useState('');

  const [tableModal, setTableModal] = useState<{ open: boolean; mode: 'add' | 'edit'; table?: DiningTable }>({
    open: false,
    mode: 'add'
  });
  const [tableNumberInput, setTableNumberInput] = useState('');
  const [tableCapacityInput, setTableCapacityInput] = useState<number>(4);
  const [tableShapeInput, setTableShapeInput] = useState<TableShape>('square');

  // Notification feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'floor' | 'section' | 'table'; id: string; name: string; message: string } | null>(null);

  const showNotice = (message: string, type: 'success' | 'info' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Floor Handlers
  const handleOpenAddFloor = () => {
    if (!canWriteFloor) return;
    setFloorNameInput('');
    setFloorCodeInput('');
    setFloorDescInput('');
    setFloorModal({ open: true, mode: 'add' });
  };

  const handleOpenEditFloor = (floor: RestaurantFloor) => {
    if (!canUpdateFloor) return;
    setFloorNameInput(floor.name);
    setFloorCodeInput(floor.code || '');
    setFloorDescInput(floor.description || '');
    setFloorModal({ open: true, mode: 'edit', floor });
  };

  const handleSaveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = floorNameInput.trim();
    if (!cleanName) return;
    if (floorModal.mode === 'add' && !canWriteFloor) return;
    if (floorModal.mode === 'edit' && !canUpdateFloor) return;

    if (floorModal.mode === 'add') {
      const created = await addFloor({
        name: cleanName,
        code: floorCodeInput.trim() || undefined,
        description: floorDescInput.trim() || undefined,
        order: floors.length + 1,
        active: true
      });
      setSelectedFloorId(created.id);
      showNotice(`Floor "${created.name}" created.`);
    } else if (floorModal.floor) {
      await updateFloor(floorModal.floor.id, {
        name: cleanName,
        code: floorCodeInput.trim() || undefined,
        description: floorDescInput.trim() || undefined
      });
      showNotice(`Floor "${cleanName}" updated.`);
    }
    setFloorModal({ open: false, mode: 'add' });
  };

  const handleDeleteFloor = async (floor: RestaurantFloor) => {
    if (!canDeleteFloor) return;
    const secCount = sections.filter(s => s.floorId === floor.id).length;
    const tblCount = diningTables.filter(t => t.floorId === floor.id).length;

    const confirmMsg = secCount > 0 || tblCount > 0
      ? `Delete floor "${floor.name}"? This will also remove ${secCount} section(s) and ${tblCount} table(s) configured under it.`
      : `Delete floor "${floor.name}"?`;

    setDeleteConfirmTarget({ type: 'floor', id: floor.id, name: floor.name, message: confirmMsg });
  };

  // Section Handlers
  const handleOpenAddSection = () => {
    if (!canWriteFloor || !activeFloor) return;
    setSectionNameInput('');
    setSectionDescInput('');
    setSectionModal({ open: true, mode: 'add' });
  };

  const handleOpenEditSection = (sec: RestaurantSection) => {
    if (!canUpdateFloor) return;
    setSectionNameInput(sec.name);
    setSectionDescInput(sec.description || '');
    setSectionModal({ open: true, mode: 'edit', section: sec });
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sectionNameInput.trim();
    if (!cleanName || !activeFloor) return;
    if (sectionModal.mode === 'add' && !canWriteFloor) return;
    if (sectionModal.mode === 'edit' && !canUpdateFloor) return;

    if (sectionModal.mode === 'add') {
      const created = await addSection({
        floorId: activeFloor.id,
        floorName: activeFloor.name,
        name: cleanName,
        description: sectionDescInput.trim() || undefined,
        order: sectionsInActiveFloor.length + 1,
        active: true
      });
      setSelectedSectionId(created.id);
      showNotice(`Section "${created.name}" created under ${activeFloor.name}.`);
    } else if (sectionModal.section) {
      await updateSection(sectionModal.section.id, {
        name: cleanName,
        description: sectionDescInput.trim() || undefined
      });
      showNotice(`Section "${cleanName}" updated.`);
    }
    setSectionModal({ open: false, mode: 'add' });
  };

  const handleDeleteSection = async (sec: RestaurantSection) => {
    if (!canDeleteFloor) return;
    const tblCount = diningTables.filter(t => t.sectionId === sec.id).length;
    const confirmMsg = tblCount > 0
      ? `Delete section "${sec.name}"? This will also remove ${tblCount} table(s) in this section.`
      : `Delete section "${sec.name}"?`;

    setDeleteConfirmTarget({ type: 'section', id: sec.id, name: sec.name, message: confirmMsg });
  };

  // Table Handlers
  const handleOpenAddTable = () => {
    if (!canWriteFloor || !activeSection || !activeFloor) return;
    // Suggest next readable table number (e.g. T-1, T-2)
    const nextNum = `T-${tablesInSection.length + 1}`;
    setTableNumberInput(nextNum);
    setTableCapacityInput(4);
    setTableShapeInput('square');
    setTableModal({ open: true, mode: 'add' });
  };

  const handleOpenEditTable = (table: DiningTable) => {
    if (!canUpdateFloor) return;
    setTableNumberInput(table.tableNumber);
    setTableCapacityInput(table.capacity);
    setTableShapeInput(table.shape);
    setTableModal({ open: true, mode: 'edit', table });
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = tableNumberInput.trim();
    if (!cleanNumber || !activeSection || !activeFloor) return;
    if (tableModal.mode === 'add' && !canWriteFloor) return;
    if (tableModal.mode === 'edit' && !canUpdateFloor) return;

    if (tableModal.mode === 'add') {
      const created = await addDiningTable({
        tableNumber: cleanNumber,
        floorId: activeFloor.id,
        floorName: activeFloor.name,
        sectionId: activeSection.id,
        sectionName: activeSection.name,
        zoneId: activeSection.id,
        zoneName: `${activeFloor.name} - ${activeSection.name}`,
        capacity: tableCapacityInput || 4,
        shape: tableShapeInput,
        status: 'available',
        posX: 60 + (tablesInSection.length % 5) * 170,
        posY: 60 + Math.floor(tablesInSection.length / 5) * 150,
        rotation: 0
      });
      showNotice(`Table ${created.tableNumber} added to ${activeSection.name}! Section is now live in navigation.`);
    } else if (tableModal.table) {
      await updateDiningTable(tableModal.table.id, {
        tableNumber: cleanNumber,
        capacity: tableCapacityInput || 4,
        shape: tableShapeInput
      });
      showNotice(`Table ${cleanNumber} updated.`);
    }
    setTableModal({ open: false, mode: 'add' });
  };

  const handleDeleteTable = async (table: DiningTable) => {
    if (!canDeleteFloor) return;
    setDeleteConfirmTarget({ type: 'table', id: table.id, name: table.tableNumber, message: `Delete Table "${table.tableNumber}"?` });
  };

  // Shape rendering helper for visual clarity
  const renderTableShapePreview = (shape: TableShape, number: string, capacity: number) => {
    switch (shape) {
      case 'round':
        return (
          <div className="relative w-20 h-20 rounded-full border-2 border-blue-400 bg-blue-50 dark:bg-blue-950/60 flex flex-col items-center justify-center text-center shadow-xs">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{number}</span>
            <span className="text-3xs text-blue-600 dark:text-blue-400 font-mono">{capacity} seats</span>
          </div>
        );
      case 'rectangular':
        return (
          <div className="relative w-28 h-18 rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-blue-950/60 flex flex-col items-center justify-center text-center shadow-xs">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{number}</span>
            <span className="text-3xs text-blue-600 dark:text-blue-400 font-mono">{capacity} seats</span>
          </div>
        );
      case 'booth':
        return (
          <div className="relative w-24 h-20 rounded-2xl border-2 border-purple-400 bg-purple-50 dark:bg-purple-950/60 flex flex-col items-center justify-center text-center shadow-xs">
            <div className="absolute top-1 left-2 right-2 h-1.5 rounded-full bg-purple-300 dark:bg-purple-700" />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{number}</span>
            <span className="text-3xs text-purple-600 dark:text-purple-400 font-mono">{capacity} seats</span>
          </div>
        );
      case 'bar_stool':
        return (
          <div className="relative w-16 h-16 rounded-full border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/60 flex flex-col items-center justify-center text-center shadow-xs">
            <span className="text-2xs font-bold text-slate-900 dark:text-slate-100">{number}</span>
            <span className="text-3xs text-amber-600 dark:text-amber-400 font-mono">1 stool</span>
          </div>
        );
      case 'square':
      default:
        return (
          <div className="relative w-20 h-20 rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-blue-950/60 flex flex-col items-center justify-center text-center shadow-xs">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{number}</span>
            <span className="text-3xs text-blue-600 dark:text-blue-400 font-mono">{capacity} seats</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Flow Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Floor & Section Architecture</span>
            </h2>
            <span className="text-3xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/50">
              User Custom Layout
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Define your restaurant hierarchy: <strong className="text-slate-700 dark:text-slate-300">Floor → Section → Layout & Tables</strong>. Empty sections are automatically kept hidden from staff POS navigation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Return to Live Service Map</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 3-TIER HIERARCHY WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* TIER 1: FLOORS (col-span-3) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Tier 1</span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Restaurant Floors ({floors.length})</span>
              </h3>
            </div>
            {canWriteFloor && (
              <button
                type="button"
                onClick={handleOpenAddFloor}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold cursor-pointer transition-all shadow-xs"
                title="Add a new custom floor"
              >
                <Plus className="w-3 h-3" />
                <span>Add Floor</span>
              </button>
            )}
          </div>

          {floors.length === 0 ? (
            <div className="py-8 px-3 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <Building2 className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Floors Created</p>
              <p className="text-3xs text-slate-500">
                Start by adding your first floor (e.g. Ground Floor, Rooftop).
              </p>
              {canWriteFloor && (
                <button
                  type="button"
                  onClick={handleOpenAddFloor}
                  className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-2xs font-bold rounded-lg cursor-pointer shadow-xs inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Add Floor</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {floors.map((floor) => {
                const isSelected = selectedFloorId === floor.id;
                const floorSections = sections.filter(s => s.floorId === floor.id);
                const floorTables = diningTables.filter(t => t.floorId === floor.id);

                return (
                  <div
                    key={floor.id}
                    onClick={() => setSelectedFloorId(floor.id)}
                    className={`group p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200 shadow-xs'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate">{floor.name}</span>
                        {floor.code && (
                          <span className="text-3xs font-mono px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            {floor.code}
                          </span>
                        )}
                      </div>
                      <p className="text-3xs text-slate-400 mt-0.5 truncate">
                        {floorSections.length} sections • {floorTables.length} tables
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canUpdateFloor && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditFloor(floor);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                          title="Rename floor"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      {canDeleteFloor && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFloor(floor);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                          title="Delete floor"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TIER 2: SECTIONS IN ACTIVE FLOOR (col-span-4) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Tier 2</span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {activeFloor ? `Sections in ${activeFloor.name}` : 'Dining Sections'}
                </span>
              </h3>
            </div>
            {activeFloor && canWriteFloor && (
              <button
                type="button"
                onClick={handleOpenAddSection}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold cursor-pointer transition-all shadow-xs"
                title="Add a new custom section"
              >
                <Plus className="w-3 h-3" />
                <span>Add Section</span>
              </button>
            )}
          </div>

          {!activeFloor ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Select or create a floor on the left first.
            </div>
          ) : sectionsInActiveFloor.length === 0 ? (
            <div className="py-8 px-3 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <Layers className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Sections in {activeFloor.name}</p>
              <p className="text-3xs text-slate-500">
                Add sections such as "AC Main Hall", "Bar Area", or "Patio Garden".
              </p>
              {canWriteFloor && (
                <button
                  type="button"
                  onClick={handleOpenAddSection}
                  className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-2xs font-bold rounded-lg cursor-pointer shadow-xs inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Add Section</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sectionsInActiveFloor.map((sec) => {
                const isSelected = selectedSectionId === sec.id;
                const secTables = diningTables.filter(t => t.sectionId === sec.id || t.zoneId === sec.id);
                const hasTables = secTables.length > 0;

                return (
                  <div
                    key={sec.id}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`group p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-600 shadow-xs'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block truncate">
                          {sec.name}
                        </span>
                        {sec.description && (
                          <p className="text-3xs text-slate-400 truncate">{sec.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canUpdateFloor && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditSection(sec);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                            title="Rename section"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {canDeleteFloor && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSection(sec);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                            title="Delete section"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`} />
                      </div>
                    </div>

                    {/* Visibility & Navigation Status Badge */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-3xs">
                      {hasTables ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                          <Eye className="w-3 h-3" />
                          <span>Visible in POS ({secTables.length} tables)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          <EyeOff className="w-3 h-3" />
                          <span>Hidden (0 tables - add tables to show)</span>
                        </span>
                      )}

                      <span className="font-mono text-slate-400">{secTables.length} table(s)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TIER 3: LAYOUT & TABLES IN ACTIVE SECTION (col-span-5) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Tier 3</span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {activeSection ? `Tables in ${activeSection.name}` : 'Section Tables'}
                </span>
              </h3>
            </div>
            {activeSection && canWriteFloor && (
              <button
                type="button"
                onClick={handleOpenAddTable}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold cursor-pointer transition-all shadow-xs"
              >
                <Plus className="w-3 h-3" />
                <span>Add Table</span>
              </button>
            )}
          </div>

          {!activeSection ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Select or create a section to configure its dining tables.
            </div>
          ) : tablesInSection.length === 0 ? (
            <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
              <LayoutGrid className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Section "{activeSection.name}" has 0 tables
              </p>
              <p className="text-3xs text-slate-500 max-w-xs mx-auto">
                Because this section is empty, it will be automatically <strong>hidden</strong> from the staff POS navigation until you add your first table.
              </p>
              {canWriteFloor && (
                <button
                  type="button"
                  onClick={handleOpenAddTable}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Table (e.g. T-1)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-3xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  <strong>Active in POS:</strong> Waiters can now select this section and seat guests at these {tablesInSection.length} tables.
                </span>
              </div>

              {/* Visual Table Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tablesInSection.map((table) => (
                  <div
                    key={table.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col items-center justify-between gap-2.5 relative group hover:shadow-sm transition-all"
                  >
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                      {canUpdateFloor && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditTable(table)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                          title="Edit table"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      {canDeleteFloor && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTable(table)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                          title="Delete table"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {renderTableShapePreview(table.shape, table.tableNumber, table.capacity)}

                    <div className="w-full text-center">
                      <span className="text-3xs uppercase tracking-wider font-semibold text-slate-400 capitalize">
                        {table.shape.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: ADD / EDIT FLOOR */}
      {floorModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>{floorModal.mode === 'add' ? 'Add Restaurant Floor' : 'Edit Floor Name'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setFloorModal({ open: false, mode: 'add' })}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFloor} className="space-y-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Floor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor, 1st Floor, Rooftop, Terrace"
                  value={floorNameInput}
                  onChange={(e) => setFloorNameInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Floor Short Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. GF, 1F, ROOF"
                  value={floorCodeInput}
                  onChange={(e) => setFloorCodeInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Main indoor dining with AC"
                  value={floorDescInput}
                  onChange={(e) => setFloorDescInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFloorModal({ open: false, mode: 'add' })}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {floorModal.mode === 'add' ? 'Create Floor' : 'Save Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SECTION */}
      {sectionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>{sectionModal.mode === 'add' ? `Add Section in ${activeFloor?.name}` : 'Edit Section'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSectionModal({ open: false, mode: 'add' })}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Section Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Hall, Bar Counter, AC Cabin, Balcony"
                  value={sectionNameInput}
                  onChange={(e) => setSectionNameInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description / Seating Type (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Non-smoking family zone"
                  value={sectionDescInput}
                  onChange={(e) => setSectionDescInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSectionModal({ open: false, mode: 'add' })}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {sectionModal.mode === 'add' ? 'Create Section' : 'Save Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT TABLE */}
      {tableModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-blue-600" />
                <span>{tableModal.mode === 'add' ? `Add Table to ${activeSection?.name}` : 'Edit Table'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setTableModal({ open: false, mode: 'add' })}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Table Number / Display Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-01, R-5, Bar-1, Cabin-A"
                  value={tableNumberInput}
                  onChange={(e) => setTableNumberInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Table Shape
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['square', 'rectangular', 'round', 'booth', 'bar_stool'] as TableShape[]).map(shape => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => setTableShapeInput(shape)}
                      className={`py-1.5 px-2 rounded-lg text-3xs font-semibold border capitalize transition-all cursor-pointer ${
                        tableShapeInput === shape
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {shape.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Seating Capacity (Guests)
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 4, 6, 8, 10].map(seats => (
                    <button
                      key={seats}
                      type="button"
                      onClick={() => setTableCapacityInput(seats)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        tableCapacityInput === seats
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {seats}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTableModal({ open: false, mode: 'add' })}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {tableModal.mode === 'add' ? 'Add Table' : 'Save Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Confirm Deletion
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {deleteConfirmTarget.message}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirmTarget;
                  setDeleteConfirmTarget(null);
                  if (target.type === 'floor') {
                    await deleteFloor(target.id);
                    showNotice(`Floor "${target.name}" removed.`);
                  } else if (target.type === 'section') {
                    await deleteSection(target.id);
                    showNotice(`Section "${target.name}" removed.`);
                  } else if (target.type === 'table') {
                    await deleteDiningTable(target.id);
                    showNotice(`Table "${target.name}" deleted.`);
                  }
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
