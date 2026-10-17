import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  RotateCw, Trash2, Edit2, Copy, Grid, ZoomIn, ZoomOut,
  Maximize2, Palmtree, DoorOpen, LayoutGrid, Check
} from 'lucide-react';
import { DiningTable, TableStatus, TableShape } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';

interface InteractiveFloorCanvasProps {
  tables: DiningTable[];
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
  onUpdateTable?: (tableId: string, updates: Partial<DiningTable>) => Promise<void>;
  onDeleteTable?: (tableId: string) => Promise<void>;
  onDuplicateTable?: (table: DiningTable) => Promise<void>;
  snapToGrid?: boolean;
  setSnapToGrid?: (snap: boolean) => void;
  mode?: 'edit' | 'pos';
  onTableActionClick?: (table: DiningTable) => void;
}

type DragHandleType = 
  | 'move' 
  | 'rotate' 
  | 'resize-e' 
  | 'resize-w' 
  | 'resize-s' 
  | 'resize-n' 
  | 'resize-se' 
  | 'resize-sw' 
  | 'resize-ne' 
  | 'resize-nw';

export const InteractiveFloorCanvas: React.FC<InteractiveFloorCanvasProps> = ({
  tables,
  selectedTableId,
  onSelectTable,
  onUpdateTable,
  onDeleteTable,
  onDuplicateTable,
  snapToGrid = true,
  setSnapToGrid,
  mode = 'edit',
  onTableActionClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Zoom State
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Active Interactive Manipulation State
  const [activeHandle, setActiveHandle] = useState<DragHandleType | null>(null);
  const [dragStart, setDragStart] = useState<{
    pointerX: number;
    pointerY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    initialRot: number;
  } | null>(null);

  // Live transient updates during drag
  const [liveTransform, setLiveTransform] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    rot: number;
  } | null>(null);

  // Canvas bounds
  const CANVAS_WIDTH = 1350;
  const CANVAS_HEIGHT = 760;
  const GRID_SIZE = 15;

  const selectedTable = useMemo(() => {
    return tables.find(t => t.id === selectedTableId) || null;
  }, [tables, selectedTableId]);

  // Compute geometry & fallback bounds
  const getTableBounds = (table: DiningTable, index: number) => {
    if (liveTransform && selectedTableId === table.id) {
      return liveTransform;
    }

    let defaultW = 100;
    let defaultH = 85;

    if (table.shape === 'round') {
      defaultW = 95;
      defaultH = 95;
    } else if (table.shape === 'rectangular') {
      defaultW = 140;
      defaultH = 85;
    } else if (table.shape === 'square') {
      defaultW = 95;
      defaultH = 95;
    } else if (table.shape === 'wall') {
      defaultW = table.width || 18;
      defaultH = table.height || 180;
    } else if (table.shape === 'window') {
      defaultW = table.width || 160;
      defaultH = table.height || 22;
    } else if (table.shape === 'door') {
      defaultW = table.width || 80;
      defaultH = table.height || 80;
    } else if (table.shape === 'counter') {
      defaultW = table.width || 150;
      defaultH = table.height || 65;
    } else if (table.shape === 'plant') {
      defaultW = 65;
      defaultH = 65;
    } else if (table.shape === 'section') {
      defaultW = table.width || 220;
      defaultH = table.height || 140;
    } else if (table.shape === 'other') {
      defaultW = table.width || 120;
      defaultH = table.height || 60;
    }

    const x = table.posX !== undefined ? table.posX : 80 + (index % 5) * 190;
    const y = table.posY !== undefined ? table.posY : 90 + Math.floor(index / 5) * 160;
    const w = table.width || defaultW;
    const h = table.height || defaultH;
    const rot = table.rotation || 0;

    return { x, y, w, h, rot };
  };

  // FULL TABLE STATUS FILL COLORS
  const getTableStatusFill = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return {
          bg: 'bg-slate-100 dark:bg-slate-100 text-slate-900 border-2 border-slate-300 dark:border-slate-300 shadow-sm',
          chair: 'bg-slate-400 dark:bg-slate-500',
          text: 'text-slate-900 font-black'
        };
      case 'draft':
        return {
          bg: 'bg-rose-500 text-white border-2 border-rose-600 shadow-lg ring-2 ring-rose-400/50',
          chair: 'bg-rose-600',
          text: 'text-white font-black'
        };
      case 'seated':
        return {
          bg: 'bg-sky-300 text-sky-950 border-2 border-sky-500 shadow-md',
          chair: 'bg-sky-500',
          text: 'text-sky-950 font-black'
        };
      case 'kot_fired':
        return {
          bg: 'bg-amber-300 text-amber-950 border-2 border-amber-500 shadow-md',
          chair: 'bg-amber-500',
          text: 'text-amber-950 font-black'
        };
    }
  };

  // Compute exact chair positions around a table (Matching exact assigned capacity)
  const renderExactChairs = (shape: TableShape, capacity: number, chairClass: string) => {
    const seats = Math.max(1, capacity || 4);

    if (shape === 'round') {
      // Position exactly `seats` chairs radially around the circle
      const chairs = [];
      const radiusPercent = 46; // Distance from center
      for (let i = 0; i < seats; i++) {
        // Angle in radians around circle, starting from top (-PI/2)
        const angle = (2 * Math.PI * i) / seats - Math.PI / 2;
        const leftPercent = 50 + radiusPercent * Math.cos(angle);
        const topPercent = 50 + radiusPercent * Math.sin(angle);
        const rotationDeg = (angle * 180) / Math.PI + 90;

        chairs.push(
          <div
            key={i}
            className={`absolute w-5 h-2.5 rounded-full ${chairClass} shadow-xs border border-slate-700/50 pointer-events-none`}
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`
            }}
          />
        );
      }
      return chairs;
    }

    // Square / Rectangle Tables: distribute exactly `seats` around top, bottom, and ends
    const chairs = [];
    if (seats <= 2) {
      // 2 seats: 1 top, 1 bottom
      chairs.push(
        <div key="t0" className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2 rounded-t-sm ${chairClass}`} />,
        <div key="b0" className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2 rounded-b-sm ${chairClass}`} />
      );
    } else if (seats === 3) {
      chairs.push(
        <div key="t0" className={`absolute -top-1.5 left-1/3 -translate-x-1/2 w-5 h-2 rounded-t-sm ${chairClass}`} />,
        <div key="t1" className={`absolute -top-1.5 left-2/3 -translate-x-1/2 w-5 h-2 rounded-t-sm ${chairClass}`} />,
        <div key="b0" className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-2 rounded-b-sm ${chairClass}`} />
      );
    } else if (seats === 4) {
      // 2 on top, 2 on bottom (or 1 on each of 4 sides if square)
      chairs.push(
        <div key="t0" className={`absolute -top-1.5 left-1/3 -translate-x-1/2 w-5 h-2 rounded-t-sm ${chairClass}`} />,
        <div key="t1" className={`absolute -top-1.5 left-2/3 -translate-x-1/2 w-5 h-2 rounded-t-sm ${chairClass}`} />,
        <div key="b0" className={`absolute -bottom-1.5 left-1/3 -translate-x-1/2 w-5 h-2 rounded-b-sm ${chairClass}`} />,
        <div key="b1" className={`absolute -bottom-1.5 left-2/3 -translate-x-1/2 w-5 h-2 rounded-b-sm ${chairClass}`} />
      );
    } else {
      // 5+ seats: allocate side chairs and end chairs
      // Put 1 chair on left end and 1 chair on right end if seats >= 6
      const hasEndChairs = seats >= 6;
      const remainingForLongSides = hasEndChairs ? seats - 2 : seats;
      const topCount = Math.ceil(remainingForLongSides / 2);
      const bottomCount = Math.floor(remainingForLongSides / 2);

      // Top chairs
      for (let i = 0; i < topCount; i++) {
        const leftPercent = ((i + 1) / (topCount + 1)) * 100;
        chairs.push(
          <div 
            key={`top-${i}`} 
            className={`absolute -top-1.5 w-5 h-2 rounded-t-sm ${chairClass}`} 
            style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
          />
        );
      }
      // Bottom chairs
      for (let i = 0; i < bottomCount; i++) {
        const leftPercent = ((i + 1) / (bottomCount + 1)) * 100;
        chairs.push(
          <div 
            key={`bot-${i}`} 
            className={`absolute -bottom-1.5 w-5 h-2 rounded-b-sm ${chairClass}`} 
            style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
          />
        );
      }
      // End chairs
      if (hasEndChairs) {
        chairs.push(
          <div key="left-end" className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-5 rounded-l-sm ${chairClass}`} />,
          <div key="right-end" className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-5 rounded-r-sm ${chairClass}`} />
        );
      }
    }

    return chairs;
  };

  // Handle pointer down on handles or shape body
  const handlePointerDown = (
    e: React.PointerEvent,
    table: DiningTable,
    index: number,
    handleType: DragHandleType
  ) => {
    e.stopPropagation();

    onSelectTable(table.id);
    setActiveHandle(handleType);

    const bounds = getTableBounds(table, index);
    setDragStart({
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialX: bounds.x,
      initialY: bounds.y,
      initialW: bounds.w,
      initialH: bounds.h,
      initialRot: bounds.rot
    });
    setLiveTransform(bounds);

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Universal pointer move: processes Move, Scale, and Rotate directly
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !dragStart || !canvasRef.current || !selectedTable) return;

    const deltaX = (e.clientX - dragStart.pointerX) / zoomLevel;
    const deltaY = (e.clientY - dragStart.pointerY) / zoomLevel;

    if (activeHandle === 'move') {
      let nextX = dragStart.initialX + deltaX;
      let nextY = dragStart.initialY + deltaY;

      if (snapToGrid) {
        nextX = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
        nextY = Math.round(nextY / GRID_SIZE) * GRID_SIZE;
      }

      nextX = Math.max(10, Math.min(CANVAS_WIDTH - dragStart.initialW - 10, nextX));
      nextY = Math.max(10, Math.min(CANVAS_HEIGHT - dragStart.initialH - 10, nextY));

      setLiveTransform({
        x: nextX,
        y: nextY,
        w: dragStart.initialW,
        h: dragStart.initialH,
        rot: dragStart.initialRot
      });
      return;
    }

    if (activeHandle === 'rotate') {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const centerX = canvasRect.left + (dragStart.initialX + dragStart.initialW / 2) * zoomLevel;
      const centerY = canvasRect.top + (dragStart.initialY + dragStart.initialH / 2) * zoomLevel;

      const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      let deg = Math.round(rad * (180 / Math.PI) + 90);
      deg = (deg + 360) % 360;

      if (snapToGrid) {
        deg = Math.round(deg / 15) * 15;
      }

      setLiveTransform({
        x: dragStart.initialX,
        y: dragStart.initialY,
        w: dragStart.initialW,
        h: dragStart.initialH,
        rot: deg
      });
      return;
    }

    // DIRECT INTERACTIVE RESIZE (Scaling on X and Y)
    let nextW = dragStart.initialW;
    let nextH = dragStart.initialH;
    let nextX = dragStart.initialX;
    let nextY = dragStart.initialY;

    // East (Width X)
    if (activeHandle === 'resize-e' || activeHandle === 'resize-se' || activeHandle === 'resize-ne') {
      nextW = Math.max(25, dragStart.initialW + deltaX);
      if (snapToGrid) nextW = Math.round(nextW / GRID_SIZE) * GRID_SIZE;
    }
    // West (Width X & offset X)
    if (activeHandle === 'resize-w' || activeHandle === 'resize-sw' || activeHandle === 'resize-nw') {
      const allowedDelta = Math.min(dragStart.initialW - 25, deltaX);
      nextW = Math.max(25, dragStart.initialW - deltaX);
      nextX = dragStart.initialX + allowedDelta;
      if (snapToGrid) {
        nextW = Math.round(nextW / GRID_SIZE) * GRID_SIZE;
        nextX = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
      }
    }
    // South (Height Y)
    if (activeHandle === 'resize-s' || activeHandle === 'resize-se' || activeHandle === 'resize-sw') {
      nextH = Math.max(16, dragStart.initialH + deltaY);
      if (snapToGrid) nextH = Math.round(nextH / GRID_SIZE) * GRID_SIZE;
    }
    // North (Height Y & offset Y)
    if (activeHandle === 'resize-n' || activeHandle === 'resize-ne' || activeHandle === 'resize-nw') {
      const allowedDelta = Math.min(dragStart.initialH - 16, deltaY);
      nextH = Math.max(16, dragStart.initialH - deltaY);
      nextY = dragStart.initialY + allowedDelta;
      if (snapToGrid) {
        nextH = Math.round(nextH / GRID_SIZE) * GRID_SIZE;
        nextY = Math.round(nextY / GRID_SIZE) * GRID_SIZE;
      }
    }

    // Keep round shape aspect ratio square
    if (selectedTable.shape === 'round') {
      const maxDim = Math.max(nextW, nextH);
      nextW = maxDim;
      nextH = maxDim;
    }

    setLiveTransform({
      x: nextX,
      y: nextY,
      w: nextW,
      h: nextH,
      rot: dragStart.initialRot
    });
  };

  // Pointer Up: Persist final coordinates, size & rotation
  const handlePointerUp = async () => {
    if (!activeHandle || !selectedTable || !liveTransform) {
      setActiveHandle(null);
      setDragStart(null);
      return;
    }

    await onUpdateTable(selectedTable.id, {
      posX: liveTransform.x,
      posY: liveTransform.y,
      width: liveTransform.w,
      height: liveTransform.h,
      rotation: liveTransform.rot
    });

    setActiveHandle(null);
    setDragStart(null);
    setLiveTransform(null);
  };

  // Keyboard Shortcuts (Delete, Nudge, Duplicate, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (!selectedTable) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (onDeleteTable) {
          onDeleteTable(selectedTable.id);
          onSelectTable(null);
        }
      } else if (e.key === 'Escape') {
        onSelectTable(null);
      } else if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'd') {
        e.preventDefault();
        if (onDuplicateTable) {
          onDuplicateTable(selectedTable);
        }
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : (snapToGrid ? GRID_SIZE : 2);
        const currentX = selectedTable.posX || 100;
        const currentY = selectedTable.posY || 100;
        let newX = currentX;
        let newY = currentY;

        if (e.key === 'ArrowUp') newY = Math.max(10, currentY - step);
        if (e.key === 'ArrowDown') newY = Math.min(CANVAS_HEIGHT - 60, currentY + step);
        if (e.key === 'ArrowLeft') newX = Math.max(10, currentX - step);
        if (e.key === 'ArrowRight') newX = Math.min(CANVAS_WIDTH - 60, currentX + step);

        onUpdateTable(selectedTable.id, { posX: newX, posY: newY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTable, onDeleteTable, onDuplicateTable, onSelectTable, onUpdateTable, snapToGrid]);

  return (
    <div className="space-y-2 select-none">
      
      {/* CANVAS SUB-HEADER: QUICK ACTIONS & CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          {selectedTable ? (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-xl border border-blue-200 dark:border-blue-800">
              <span className="font-black text-blue-700 dark:text-blue-300 font-mono text-sm">
                Selected: {selectedTable.tableNumber}
              </span>
              <span className="text-3xs text-slate-500 font-mono">
                {Math.round(selectedTable.width || 100)} × {Math.round(selectedTable.height || 85)} px • {selectedTable.rotation || 0}°
              </span>
              {selectedTable.capacity > 0 && !selectedTable.isDecor && (
                <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                  {selectedTable.capacity} seats
                </span>
              )}
              {onDuplicateTable && (
                <button
                  type="button"
                  onClick={() => onDuplicateTable(selectedTable)}
                  className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-blue-600 hover:text-white rounded-lg text-3xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Duplicate Shape (Ctrl+D)"
                >
                  <Copy className="w-3 h-3" />
                  <span>Duplicate</span>
                </button>
              )}
              {onDeleteTable && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTable(selectedTable.id);
                    onSelectTable(null);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title="Delete Shape (Delete Key)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <span className="text-3xs text-slate-400 font-mono">
              Click any object on canvas to move, stretch with corner handles, or rotate with top knob.
            </span>
          )}
        </div>

        {/* Snap & Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-2.5 py-1 rounded-lg text-3xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
              snapToGrid
                ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-300 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
            title="Snap to 15px Grid"
          >
            <Grid className="w-3 h-3" />
            <span>Snap (15px)</span>
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(0.65, prev - 0.1))}
              className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-3xs font-bold text-slate-600 dark:text-slate-400 px-1.5">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.1))}
              className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* THE ARCHITECTURAL CANVAS CONTAINER */}
      <div 
        ref={containerRef}
        className="w-full overflow-auto rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-5 shadow-2xl relative select-none"
        style={{ minHeight: '620px' }}
      >
        <div
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => onSelectTable(null)}
          className="relative rounded-2xl overflow-hidden shadow-inner origin-top-left"
          style={{
            width: `${CANVAS_WIDTH}px`,
            height: `${CANVAS_HEIGHT}px`,
            transform: `scale(${zoomLevel})`,
            backgroundColor: '#0d1117',
            backgroundImage: snapToGrid 
              ? 'radial-gradient(circle, #212638 1.5px, transparent 1.5px)' 
              : 'none',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            border: '2px solid #212638'
          }}
        >
          {/* Floor Blueprint Watermark */}
          <div className="absolute top-4 left-6 flex items-center gap-2 text-slate-400 font-mono text-3xs uppercase tracking-widest pointer-events-none opacity-70">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span>ARCHITECTURAL FLOOR CANVAS</span>
          </div>

          {/* RENDER ALL OBJECTS (TABLES, WALLS, WINDOWS, DOORS, COUNTERS, PLANTS, SECTIONS, OTHER) */}
          {tables.map((table, index) => {
            const bounds = getTableBounds(table, index);
            const isSelected = selectedTableId === table.id;
            const statusFill = getTableStatusFill(table.status);
            const isTable = !table.isDecor && ['round', 'square', 'rectangular'].includes(table.shape);

            return (
              <div
                key={table.id}
                onPointerDown={(e) => {
                  if (mode !== 'pos') {
                    handlePointerDown(e, table, index, 'move');
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTable(table.id);
                  // ONLY trigger order action redirection when explicitly in POS ordering mode
                  if (mode === 'pos' && isTable && onTableActionClick) {
                    onTableActionClick(table);
                  }
                }}
                className={`absolute select-none ${
                  mode === 'pos'
                    ? isTable
                      ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform drop-shadow-md'
                      : 'pointer-events-none opacity-85'
                    : 'cursor-grab active:cursor-grabbing'
                } ${
                  isSelected ? 'z-40' : 'z-20'
                }`}
                style={{
                  left: `${bounds.x}px`,
                  top: `${bounds.y}px`,
                  width: `${bounds.w}px`,
                  height: `${bounds.h}px`,
                  transform: `rotate(${bounds.rot}deg)`,
                  transformOrigin: 'center center',
                  touchAction: mode === 'pos' ? 'auto' : 'none'
                }}
              >
                {/* INNER RENDERING PER SHAPE (Exact Match to User Sketch & Request) */}
                <div className="w-full h-full relative flex items-center justify-center">

                  {/* 1. ARCHITECTURAL DOOR (Door wedge with swing arc) */}
                  {table.shape === 'door' ? (
                    <div className="w-full h-full relative border border-slate-600 bg-amber-950/20 rounded-xs flex items-center justify-center overflow-hidden">
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M 0 100 A 100 100 0 0 1 100 0 L 0 0 Z" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" />
                        <line x1="0" y1="100" x2="0" y2="0" stroke="#f59e0b" strokeWidth="4" />
                      </svg>
                      <span className="font-bold text-amber-300 font-mono text-2xs z-10 px-1 bg-slate-900/80 rounded">
                        {table.tableNumber}
                      </span>
                    </div>
                  ) : 

                  /* 2. ARCHITECTURAL WINDOW (Double glass panes) */
                  table.shape === 'window' ? (
                    <div className="w-full h-full bg-sky-950/60 border-2 border-sky-400 flex items-center justify-center shadow-md relative">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-sky-300" />
                      <span className="font-bold text-sky-200 font-mono text-3xs uppercase tracking-wider bg-slate-950 px-1 z-10 rounded">
                        {table.tableNumber}
                      </span>
                    </div>
                  ) :

                  /* 3. ARCHITECTURAL WALL (Solid partition beam) */
                  table.shape === 'wall' ? (
                    <div className="w-full h-full bg-slate-700 border-2 border-slate-500 shadow-md flex items-center justify-center relative overflow-hidden">
                      <div 
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 3px, transparent 3px, transparent 6px)'
                        }}
                      />
                      <span className="font-bold text-slate-200 font-mono text-3xs uppercase tracking-widest z-10 rotate-90 sm:rotate-0 px-1 truncate">
                        {table.tableNumber}
                      </span>
                    </div>
                  ) :

                  /* 4. SERVICE / RECEPTION / BAR COUNTER */
                  table.shape === 'counter' ? (
                    <div className="w-full h-full bg-amber-900/40 border-2 border-amber-600 rounded-md flex items-center justify-center shadow-lg relative">
                      <div className="absolute inset-1 border border-dashed border-amber-500/40 rounded-xs pointer-events-none" />
                      <span className="font-black text-amber-200 font-mono text-xs z-10 uppercase tracking-wide">
                        {table.tableNumber}
                      </span>
                    </div>
                  ) :

                  /* 5. PLANT / GREENERY */
                  table.shape === 'plant' ? (
                    <div className="w-full h-full rounded-full bg-emerald-950/90 border-2 border-emerald-500 flex items-center justify-center shadow-lg relative">
                      <Palmtree className="w-7 h-7 text-emerald-300" />
                      <div className="absolute inset-0 rounded-full border border-emerald-400/40 pointer-events-none" />
                    </div>
                  ) :

                  /* 6. SECTION BOUNDARY / ZONE ZONE DIVIDER */
                  table.shape === 'section' ? (
                    <div className="w-full h-full border-2 border-dashed border-blue-400/80 bg-blue-950/20 rounded-xl flex items-center justify-center shadow-sm relative">
                      <span className="font-black text-blue-300 font-mono text-xs tracking-wider uppercase bg-slate-950/80 px-2 py-0.5 rounded border border-blue-500/40">
                        {table.tableNumber}
                      </span>
                    </div>
                  ) :

                  /* 7. OTHER ARCHITECTURAL ELEMENT */
                  table.shape === 'other' ? (
                    <div className="w-full h-full border-2 border-slate-500 bg-slate-800/80 rounded-lg flex items-center justify-center shadow-md relative">
                      <span className="font-bold text-slate-200 font-mono text-xs uppercase tracking-wider px-2 truncate">
                        {table.tableNumber}
                      </span>
                    </div>
                  ) :

                  /* 8. ROUND DINING TABLE (Full status color fill + Exact radial chairs) */
                  table.shape === 'round' ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {/* Exact Radial Chairs matching assigned capacity */}
                      {renderExactChairs('round', table.capacity || 4, statusFill.chair)}

                      {/* Fully Filled Round Table Body with Status Color */}
                      <div className={`w-[78%] h-[78%] rounded-full ${statusFill.bg} flex flex-col items-center justify-center text-center shadow-md p-1 z-10`}>
                        <span className={`text-sm font-black tracking-tight ${statusFill.text}`}>
                          {table.tableNumber}
                        </span>
                        <span className="text-3xs font-mono font-bold opacity-80">
                          {table.status === 'kot_fired'
                            ? `Cooking (${formatNPR(table.subtotal || 0)})`
                            : table.status === 'draft'
                            ? `Draft (${formatNPR(table.subtotal || 0)})`
                            : table.status === 'seated'
                            ? `Seated (${table.currentGuests || 2}p)`
                            : `${table.capacity || 4} seats`}
                        </span>
                      </div>
                    </div>
                  ) :

                  /* 9. RECTANGULAR & SQUARE DINING TABLE (Full status color fill + Exact chairs) */
                  (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {/* Exact Chairs matching assigned capacity */}
                      {renderExactChairs(table.shape, table.capacity || 4, statusFill.chair)}

                      {/* Table Body completely filled with status color */}
                      <div className={`w-[84%] h-[78%] rounded-xl ${statusFill.bg} flex flex-col items-center justify-center text-center shadow-md p-1 z-10`}>
                        <span className={`text-sm font-black tracking-tight leading-none ${statusFill.text}`}>
                          {table.tableNumber}
                        </span>
                        <span className="text-3xs font-mono font-bold opacity-90 mt-0.5">
                          {table.status === 'kot_fired'
                            ? `Cooking (${formatNPR(table.subtotal || 0)})`
                            : table.status === 'draft'
                            ? `Draft (${formatNPR(table.subtotal || 0)})`
                            : table.status === 'seated'
                            ? `Seated (${table.currentGuests || 2}p)`
                            : `${table.capacity || 4} seats`}
                        </span>
                      </div>
                    </div>
                  )}

                </div>

                {/* DIRECT BOUNDING BOX INTERACTIVE HANDLES (SCALE X, Y AND ROTATE) */}
                {isSelected && mode !== 'pos' && (
                  <div className="absolute inset-0 pointer-events-auto">
                    {/* Bounding Box Border */}
                    <div className="absolute inset-0 border-2 border-blue-400 rounded-sm pointer-events-none" />

                    {/* TOP ROTATION STALK & HANDLE KNOB (Rotate 360°) */}
                    <div 
                      className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-50"
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'rotate')}
                    >
                      <div className="w-4 h-4 rounded-full bg-blue-500 hover:bg-blue-400 border-2 border-white shadow-md flex items-center justify-center">
                        <RotateCw className="w-2.5 h-2.5 text-white" />
                      </div>
                      <div className="w-0.5 h-3 bg-blue-400" />
                    </div>

                    {/* CORNER RESIZE HANDLES (Scale X and Y) */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'resize-nw')}
                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs cursor-nwse-resize shadow-md z-50"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'resize-ne')}
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs cursor-nesw-resize shadow-md z-50"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'resize-se')}
                      className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-xs cursor-nwse-resize shadow-md z-50 ring-2 ring-blue-400"
                      title="Drag corner to scale Width & Height"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'resize-sw')}
                      className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs cursor-nesw-resize shadow-md z-50"
                    />

                    {/* EDGE RESIZE HANDLES (Scale Width or Height Individually) */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'resize-e')}
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-4 bg-white border border-blue-600 rounded-xs cursor-ew-resize shadow-xs z-50"
                      title="Drag to adjust Width"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'resize-s')}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-3 bg-white border border-blue-600 rounded-xs cursor-ns-resize shadow-xs z-50"
                      title="Drag to adjust Height"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'resize-w')}
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-4 bg-white border border-blue-600 rounded-xs cursor-ew-resize shadow-xs z-50"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, table, index, 'resize-n')}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-3 bg-white border border-blue-600 rounded-xs cursor-ns-resize shadow-xs z-50"
                    />

                    {/* Live Dimensions Tooltip badge during interaction */}
                    {activeHandle && (
                      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-3xs font-bold whitespace-nowrap shadow-md pointer-events-none z-50">
                        {Math.round(bounds.w)} × {Math.round(bounds.h)} px • {bounds.rot}°
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
