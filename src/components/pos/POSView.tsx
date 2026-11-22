import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, Check, 
  Printer, ArrowRight, UserPlus, CreditCard, DollarSign,
  QrCode, User, FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CheckCircle2, RotateCcw,
  X, Tag, ArrowLeft, Receipt, Flame, UtensilsCrossed, ChefHat, 
  Wine, Cake, Sparkles, Settings, Layers, Building2, ShoppingBag,
  Circle, Square, RectangleHorizontal, LayoutGrid, Clock,
  ArrowLeftRight, GitMerge, RefreshCw, Users, AlertCircle, LogOut, AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  Product, Customer, SaleItem, SaleInvoice, DiningTable, StaffMember, TableStatus,
  KitchenOrderTicket, KOTItem, RestaurantFloor, RestaurantSection 
} from '../../types';
import { formatNPR, numberToWordsNPR, formatDate, generateNextInvoiceNumber } from '../../utils/nepalFormatters';
import { InteractiveFloorCanvas } from './InteractiveFloorCanvas';
import { CancelFiredOrderItemModal } from './CancelFiredOrderItemModal';
import { OrderItemCustomizationModal, CustomizationTarget } from './OrderItemCustomizationModal';
import { ClearOrderRoundModal } from './ClearOrderRoundModal';
import { PosActionPinModal, PosActionPinAccent } from './PosActionPinModal';
import { ThermalSlipModal } from './ThermalSlipModal';
import { generateKOTSlipHtml, generateBOTSlipHtml, generateBillReceiptSlipHtml, generateCombinedOrderTicketsHtml, generateCancelledItemSlipHtml, safeThermalWindowPrint, executeThermalPrint, isElectronDesktop } from '../../utils/printerService';
import { searchFoodProducts } from '../../utils/fuzzySearch';
import { INITIAL_PRINTERS } from '../../data/restaurantInitialData';
import {
  assignRoundsToTickets,
  calculateBillTotals,
  computeItemBaseUnitPrice,
  extractKOTItemAddons,
  getActiveTicketsForSession,
  getTicketStationCounts,
  resolveItemRoutingStation
} from '../../utils/ticketOrderUtils';
import {
  deriveMenuFilterOptions,
  filterMenuProducts,
  getProductVatBadgeLabel,
  isProductOutOfStock
} from '../../utils/menuFilterUtils';
import {
  resolveActiveOperator,
  resolveEffectiveTableWaiter,
  resolveOperatorIdentity
} from '../../utils/operatorUtils';
import { doesStaffRequirePinPerAction } from '../../utils/staffPermissionUtils';

// Helper to identify real dining tables (strictly excludes architectural floor elements like doors, walls, plants, windows)
export const isRealDiningTable = (t: DiningTable): boolean => {
  if (!t) return false;
  // If explicitly flagged as decor or has architectural decorType, it's decor
  if (t.isDecor || t.decorType) return false;

  // Real dining tables have capacity >= 1 (e.g. 1 seat for stool, 2, 4, 6, etc.)
  // Pure architectural decor elements (doors, walls, plants, windows) have capacity === 0
  const isZeroCapacity = !t.capacity || t.capacity === 0;

  // Pure architectural element shapes with 0 capacity
  const architecturalShapes = ['wall', 'window', 'door', 'plant'];
  if (isZeroCapacity && t.shape && architecturalShapes.includes(t.shape)) {
    return false;
  }

  // Pure architectural element names with 0 capacity (e.g. dropped "WALL", "DOOR", "PLANT", "WINDOW")
  const lowerName = String(t.tableNumber || '').toLowerCase().trim();
  if (isZeroCapacity && ['door', 'wall', 'plant', 'window', 'decor'].includes(lowerName)) {
    return false;
  }

  return true;
};

// Natural alphanumeric comparator for tables (e.g. G1, G2 ... G8, G9, G10 or T-1, T-2 ...)
const naturalTableSort = (a: DiningTable, b: DiningTable, floorsList: RestaurantFloor[], sectionsList: RestaurantSection[]) => {
  const floorA = floorsList.find(f => f.id === a.floorId || f.name === a.floorName);
  const floorB = floorsList.find(f => f.id === b.floorId || f.name === b.floorName);
  const floorOrderA = floorA ? floorA.order : 999;
  const floorOrderB = floorB ? floorB.order : 999;
  if (floorOrderA !== floorOrderB) {
    return floorOrderA - floorOrderB;
  }

  const secA = sectionsList.find(s => s.id === a.sectionId || s.name === a.sectionName);
  const secB = sectionsList.find(s => s.id === b.sectionId || s.name === b.sectionName);
  const secOrderA = secA ? secA.order : 999;
  const secOrderB = secB ? secB.order : 999;
  if (secOrderA !== secOrderB) {
    return secOrderA - secOrderB;
  }

  return (a.tableNumber || '').localeCompare(b.tableNumber || '', undefined, {
    numeric: true,
    sensitivity: 'base'
  });
};

interface CartItem extends SaleItem {
  availableStock: number;
  addonsList?: { name: string; price: number }[];
  itemNotes?: string;
  orderRoutingStation?: 'kitchen' | 'bar';
}

export const POSView: React.FC = () => {
  const { 
    products, customers, addCustomer, recordSale, sales,
    currentUser, settings, currentWarehouseId, warehouses,
    floors, sections, diningTables, selectedTableId, setSelectedTableId, 
    fireKitchenOrderTicket, splitAndFireTickets, settleTableBill, reopenTableBill, dissolveTable, deleteSaleInvoice, kitchenTickets,
    updateKOTItemStatus, updateKOTItemCustomization, cancelKOTOrderItem, uncancelKOTOrderItem,
    tableDrafts, saveTableDraft, getTableDraft, clearTableDraft,
    staffMembers, assignTableGuests, transferTable, mergeTables, swapTables, activePOSStaff, activeStaffUser, canStaffDo,
    printers, printKOTForTicket, printBOTForTicket, printCombinedOrderTickets, printBillForInvoice, printCancelledItemSlip
  } = useApp();

  const currentOperator = resolveActiveOperator(activePOSStaff, activeStaffUser);
  const { operatorId, operatorName } = resolveOperatorIdentity(activePOSStaff, activeStaffUser, currentUser);
  const resolveTableWaiter = (tableWaiter?: string) =>
    resolveEffectiveTableWaiter(tableWaiter, activePOSStaff, activeStaffUser, currentUser.name);
  const canCreateOrder = canStaffDo('posOrders', 'write');
  const canUpdateOrder = canStaffDo('posOrders', 'update');
  const canVoidOrderItem = canStaffDo('posOrders', 'delete') && (!currentOperator || currentOperator.permissions?.canVoidItems !== false);
  const canSettleBill = canStaffDo('invoicesBilling', 'write');
  const canReprintBills = !currentOperator || (currentOperator.permissions?.canReprintBills ?? true);
  const maxDiscountPercent = currentOperator?.permissions?.maxDiscountPercent ?? 100;
  const canApplyDiscounts = !currentOperator || (currentOperator.permissions?.canApplyDiscounts !== false && maxDiscountPercent > 0);
  const canCreateCustomer = canStaffDo('customers', 'write');
  const requiresPinPerAction = doesStaffRequirePinPerAction(currentOperator);
  const [pendingPinAction, setPendingPinAction] = useState<{
    title: string;
    detail?: string;
    accent?: PosActionPinAccent;
    onVerified: (authorizedBy?: string) => void | Promise<void>;
  } | null>(null);

  const executeWithPinIfRequired = (
    meta: { title: string; detail?: string; accent?: PosActionPinAccent },
    action: (authorizedBy?: string) => void | Promise<void>
  ) => {
    if (!requiresPinPerAction) {
      void action();
      return;
    }
    setPendingPinAction({
      ...meta,
      onVerified: action
    });
  };

  const [floorRestrictionNotice, setFloorRestrictionNotice] = useState<string | null>(null);

  // Floor Selection & Filter State for Floor Plan Canvas View
  const [activeFloorId, setActiveFloorId] = useState<string>(() => {
    const saved = localStorage.getItem('quickims_active_floor_id');
    if (saved && floors.some(f => f.id === saved)) {
      return saved;
    }
    return floors[0]?.id || '';
  });
  const [activeSectionId, setActiveSectionId] = useState<string>('ALL');
  const [floorStatusFilter, setFloorStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (floors.length > 0 && (!activeFloorId || !floors.some(f => f.id === activeFloorId))) {
      const nextId = floors[0].id;
      setActiveFloorId(nextId);
      localStorage.setItem('quickims_active_floor_id', nextId);
    }
  }, [floors, activeFloorId]);

  // Takeaway Mode state (for counter sales without physical table)
  const [isTakeawayMode, setIsTakeawayMode] = useState<boolean>(false);

  // Quick Guest count prompt when selecting an available table
  const [pendingGuestTable, setPendingGuestTable] = useState<DiningTable | null>(null);
  const [guestCountInput, setGuestCountInput] = useState<number>(2);
  const [waiterInput, setWaiterInput] = useState<string>('');

  // Fired Order Item Cancellation & Uncancel/Restore State
  const [firedItemToCancel, setFiredItemToCancel] = useState<{ ticket: KitchenOrderTicket; item: KOTItem; mode?: 'cancel' | 'uncancel' } | null>(null);
  const [kotCancelNotice, setKotCancelNotice] = useState<string | null>(null);

  // Existing Order Item Add-on & Note Customization State (for both fired and draft items)
  const [customizationTarget, setCustomizationTarget] = useState<CustomizationTarget | null>(null);

  // Fired Orders Collapse state for cleaner receipt view
  const [isFiredOrdersCollapsed, setIsFiredOrdersCollapsed] = useState<boolean>(false);
  const [collapsedTicketIds, setCollapsedTicketIds] = useState<Set<string>>(new Set());

  const toggleTicketCollapse = (ticketId: string) => {
    setCollapsedTicketIds(prev => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const handleSaveCustomizationCartItem = (
    index: number,
    addons: { name: string; price: number }[],
    notes: string
  ) => {
    if (!canCreateOrder && !canUpdateOrder) return;
    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;
      const prod = products.find(p => p.id === item.productId);
      const basePrice = prod
        ? getProductPriceForCustomer(prod, selectedCustomer)
        : computeItemBaseUnitPrice(item.unitPrice, extractKOTItemAddons(item));
      const addonsTotal = addons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      const newUnitPrice = Math.max(0, basePrice + addonsTotal);
      const grossLine = item.quantity * newUnitPrice;
      const lineTotal = Math.max(0, grossLine - item.discountAmount);

      updated[index] = {
        ...item,
        addonsList: addons,
        itemNotes: notes.trim(),
        unitPrice: newUnitPrice,
        lineTotal
      };

      return updated;
    });
    setKotSuccessBanner(`✨ Updated add-on & notes on dish`);
    setTimeout(() => setKotSuccessBanner(null), 3000);
    setCustomizationTarget(null);
  };

  const handleSaveCustomizationFiredItem = async (
    kotId: string,
    itemId: string,
    addons: { name: string; price: number }[],
    notes: string
  ) => {
    if (!canUpdateOrder) return;
    await updateKOTItemCustomization(kotId, itemId, addons, notes);
    setKotSuccessBanner(`✨ Updated add-on & notes on KOT dish (Kitchen notified)`);
    setTimeout(() => setKotSuccessBanner(null), 4000);
    setCustomizationTarget(null);
  };

  const handleConfirmCancelFiredItem = async (
    quantityToCancel: number,
    reason: string,
    staffName: string,
    note?: string,
    disposition?: 'return_to_stock' | 'mark_as_waste',
    notifyKitchenBar?: boolean
  ) => {
    if (!firedItemToCancel) return;
    const { ticket, item, mode } = firedItemToCancel;
    if (mode === 'uncancel') {
      await uncancelKOTOrderItem(ticket.id, item.id, quantityToCancel, reason, staffName, note, notifyKitchenBar);
      const notifyLabel = notifyKitchenBar ? ' • Kitchen/Bar Alerted' : '';
      setKotSuccessBanner(`✓ Restored ${quantityToCancel}x ${item.productName}${notifyLabel}. Table bill updated.`);
      setTimeout(() => setKotSuccessBanner(null), 5000);
    } else {
      await cancelKOTOrderItem(ticket.id, item.id, quantityToCancel, reason, staffName, note, disposition, notifyKitchenBar);
      const dispLabel = disposition === 'mark_as_waste' ? 'Marked as Waste' : 'Returned to Stock';
      const notifyLabel = notifyKitchenBar ? ' • Printed & Alerted' : '';
      setKotCancelNotice(`🗑️ Cancelled ${quantityToCancel}x ${item.productName} (${dispLabel}${notifyLabel}). Table bill updated.`);
      setTimeout(() => setKotCancelNotice(null), 5000);

      // Trigger automatic print to Kitchen or Bar printer using the application's existing printer function when notifyKitchenBar is enabled
      if (notifyKitchenBar) {
        printCancelledItemSlip({
          ticket,
          item,
          quantityCancelled: quantityToCancel,
          reason,
          staffName,
          note,
          disposition,
          tableNumber: activeDiningTable?.tableNumber || ticket.tableNumber
        }).catch(printErr => {
          console.warn('Cancelled item slip print notice:', printErr);
        });
      }
    }
    setFiredItemToCancel(null);
  };

  const [isDissolvingTable, setIsDissolvingTable] = useState<boolean>(false);

  // Dissolve Table Action: Cancels all tickets, releases table to Available, and returns to floor plan
  const performConfirmDissolve = async (reason: string = 'All orders cancelled', staffName?: string) => {
    if (!activeDiningTable || isDissolvingTable) return;
    if (!canVoidOrderItem) {
      setKotCancelNotice('Dissolving tables / voiding orders is restricted for your role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    setIsDissolvingTable(true);
    const tableId = activeDiningTable.id;
    const tableNum = activeDiningTable.tableNumber;
    try {
      const result = await dissolveTable(tableId, reason, staffName || operatorName);
      if (result.success) {
        setCart([]);
        clearTableDraft(tableId);
        setKotSuccessBanner(result.message || `Table ${tableNum} dissolved successfully and is now available for new customers.`);
        setShowManageTableModal(false);
        setSelectedTableId(null);
        setIsTakeawayMode(false);
        setTimeout(() => {
          setKotSuccessBanner(null);
        }, 5000);
      } else {
        throw new Error(result.message || 'Failed to dissolve table.');
      }
    } catch (err: any) {
      console.error('Error dissolving table:', err);
    } finally {
      setIsDissolvingTable(false);
    }
  };

  const handleConfirmDissolve = (reason: string = 'All orders cancelled', staffName?: string) => {
    if (!activeDiningTable || isDissolvingTable) return;
    if (!canVoidOrderItem) {
      setKotCancelNotice('Dissolving tables / voiding orders is restricted for your role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    executeWithPinIfRequired(
      {
        title: `Enter PIN to Dissolve Table ${activeDiningTable.tableNumber}`,
        detail: reason,
        accent: 'rose'
      },
      authorizedBy => performConfirmDissolve(reason, staffName || authorizedBy)
    );
  };

  // Cart & Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'rs'>('percent');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [kitchenSpecialNotes, setKitchenSpecialNotes] = useState<string>('');

  // Table Manage Modal (Transfer, Merge, Swap, Details, Dissolve)
  const [showManageTableModal, setShowManageTableModal] = useState<boolean>(false);
  const [manageTab, setManageTab] = useState<'transfer' | 'merge' | 'swap' | 'details' | 'dissolve'>('transfer');
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [isExecutingManage, setIsExecutingManage] = useState<boolean>(false);
  const [manageNotice, setManageNotice] = useState<string>('');
  const [tempGuestCount, setTempGuestCount] = useState<number>(2);
  const [tempWaiterName, setTempWaiterName] = useState<string>('');
  const [manageFloorFilter, setManageFloorFilter] = useState<string>('ALL');
  const [manageSearchQuery, setManageSearchQuery] = useState<string>('');

  // Active dining table (null if in Floor View or Takeaway mode)
  const activeDiningTable = useMemo(() => {
    if (!selectedTableId) return null;
    return diningTables.find(t => t.id === selectedTableId) || null;
  }, [diningTables, selectedTableId]);

  // Helper to compute exact, real-time live running amount and order items count for any table
  const getTableRunningInfo = useCallback((tbl: DiningTable) => {
    // 1. Deduplicate tickets by id to prevent any double-counting
    const uniqueTicketsMap = new Map<string, KitchenOrderTicket>();
    kitchenTickets.forEach(k => {
      if (k && k.id && !uniqueTicketsMap.has(k.id)) {
        uniqueTicketsMap.set(k.id, k);
      }
    });
    const uniqueTickets = Array.from(uniqueTicketsMap.values());

    const activeTickets = uniqueTickets.filter(k => {
      const belongsToDifferentExistingTable =
        Boolean(k.tableId) &&
        k.tableId !== tbl.id &&
        diningTables.some(dt => dt.id === k.tableId);
      const matchesTable =
        k.tableId === tbl.id ||
        (!belongsToDifferentExistingTable && Boolean(tbl.tableNumber) && k.tableNumber === tbl.tableNumber);
      return (
        matchesTable &&
        !k.isSettled &&
        k.status !== 'cancelled' &&
        (!tbl.openedAt || (k.createdAt && k.createdAt >= (tbl.openedAt - 120000))) &&
        (!k.createdAt || k.createdAt >= (Date.now() - 24 * 3600 * 1000))
      );
    });
    // Exclude cancelled items from fired subtotal and item count
    const firedSubtotal = activeTickets.reduce((sum, k) => {
      return sum + (k.items || [])
        .filter(item => item.status !== 'cancelled')
        .reduce((is, item) => is + ((item.unitPrice || 0) * (item.quantity || 1)), 0);
    }, 0);
    const firedItemsCount = activeTickets.reduce((sum, k) => {
      return sum + (k.items || [])
        .filter(item => item.status !== 'cancelled')
        .reduce((is, item) => is + (item.quantity || 1), 0);
    }, 0);

    const draftCart = (selectedTableId === tbl.id && !isTakeawayMode)
      ? cart
      : (tableDrafts[tbl.id]?.cart || []);
    const draftSubtotal = (draftCart || []).reduce((sum, item) => {
      return sum + ((item.unitPrice || 0) * (item.quantity || 1));
    }, 0);
    const draftItemsCount = (draftCart || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

    const totalSubtotal = firedSubtotal + draftSubtotal;
    const totalItemsCount = firedItemsCount + draftItemsCount;
    const hasActiveOrder = (activeTickets.length > 0 || (draftCart && draftCart.length > 0)) && totalSubtotal > 0;

    return {
      activeTicketsCount: activeTickets.length,
      firedSubtotal,
      draftSubtotal,
      totalSubtotal,
      totalItemsCount,
      hasActiveOrder,
      isCooking: activeTickets.length > 0,
      isDraft: activeTickets.length === 0 && (draftCart && draftCart.length > 0)
    };
  }, [kitchenTickets, diningTables, selectedTableId, isTakeawayMode, cart, tableDrafts]);

  // Manage Table modal floors with real table counts based on active tab (Option A: Transfer = empty, Merge/Swap = occupied)
  const manageFloorsWithCounts = useMemo(() => {
    if (!activeDiningTable) return [];
    const candidateTables = diningTables.filter(t => {
      if (t.id === activeDiningTable.id) return false;
      if (!isRealDiningTable(t)) return false;
      const info = getTableRunningInfo(t);
      if (manageTab === 'transfer') {
        // Destination table must be empty (no active order)
        return !info.hasActiveOrder && t.status === 'available';
      } else {
        // Merge & Swap require tables that ACTUALLY have an active order
        return info.hasActiveOrder;
      }
    });

    return [
      { id: 'ALL', name: 'All Floors', count: candidateTables.length },
      ...floors.map(flr => ({
        id: flr.id,
        name: flr.name,
        count: candidateTables.filter(t => {
          const tFloorId = t.floorId || floors.find(f => f.name === t.floorName)?.id || floors[0]?.id;
          return tFloorId === flr.id;
        }).length
      }))
    ];
  }, [diningTables, activeDiningTable, floors, manageTab, getTableRunningInfo]);

  // Real dining tables eligible in manage modal based on active tab (Option A)
  const eligibleManageTables = useMemo(() => {
    if (!activeDiningTable) return [];

    return diningTables
      .filter(t => {
        if (t.id === activeDiningTable.id) return false;
        if (!isRealDiningTable(t)) return false;

        const info = getTableRunningInfo(t);
        // Option A filtering:
        if (manageTab === 'transfer') {
          // Destination table must be empty
          if (info.hasActiveOrder || t.status !== 'available') return false;
        } else if (manageTab === 'merge' || manageTab === 'swap') {
          // Destination table must have an active order to merge/swap
          if (!info.hasActiveOrder) return false;
        }

        if (manageFloorFilter !== 'ALL') {
          const tFloorId = t.floorId || floors.find(f => f.name === t.floorName)?.id || floors[0]?.id;
          if (tFloorId !== manageFloorFilter) return false;
        }
        if (manageSearchQuery && manageSearchQuery.trim()) {
          const q = String(manageSearchQuery).toLowerCase().trim();
          const matchNum = String(t.tableNumber || '').toLowerCase().includes(q);
          const matchFloor = String(t.floorName || '').toLowerCase().includes(q);
          const matchSec = String(t.sectionName || '').toLowerCase().includes(q);
          if (!matchNum && !matchFloor && !matchSec) return false;
        }
        return true;
      })
      .sort((a, b) => naturalTableSort(a, b, floors, sections));
  }, [diningTables, activeDiningTable, manageTab, manageFloorFilter, manageSearchQuery, floors, sections, getTableRunningInfo]);

  // Sync active floor
  useEffect(() => {
    if (floors.length > 0 && (!activeFloorId || !floors.some(f => f.id === activeFloorId))) {
      setActiveFloorId(floors[0].id);
    }
  }, [floors, activeFloorId]);

  // If table changes, update guest and waiter state
  useEffect(() => {
    if (activeDiningTable) {
      setTempGuestCount(activeDiningTable.currentGuests || 2);
      setTempWaiterName(resolveTableWaiter(activeDiningTable.assignedWaiter));
    }
  }, [activeDiningTable, activePOSStaff, activeStaffUser, currentUser]);

  // Current floor & sections
  const currentFloor = useMemo(() => {
    return floors.find(f => f.id === activeFloorId) || (floors.length > 0 ? floors[0] : null);
  }, [floors, activeFloorId]);

  const activeFloorSections = useMemo(() => {
    if (!currentFloor) return [];
    return sections.filter(s => s.floorId === currentFloor.id);
  }, [sections, currentFloor]);

  // Tables belonging to active floor for canvas rendering with real-time live amounts & statuses
  const canvasFloorTables = useMemo(() => {
    return diningTables.filter(t => {
      if (currentFloor) {
        const tFloor = t.floorId || floors[0]?.id;
        if (tFloor !== currentFloor.id) return false;
      }

      if (activeSectionId !== 'ALL' && t.sectionId && t.sectionId !== activeSectionId) {
        return false;
      }

      const info = getTableRunningInfo(t);
      const effectiveStatus: TableStatus = info.isCooking
        ? 'kot_fired'
        : info.isDraft
        ? 'draft'
        : 'available';

      if (floorStatusFilter !== 'all') {
        if (floorStatusFilter === 'cooking' && effectiveStatus !== 'kot_fired') return false;
        if (floorStatusFilter !== 'cooking' && effectiveStatus !== floorStatusFilter) return false;
      }

      return true;
    }).map(t => {
      const info = getTableRunningInfo(t);
      const effectiveStatus: TableStatus = info.isCooking
        ? 'kot_fired'
        : info.isDraft
        ? 'draft'
        : 'available';

      const vatMultiplier = (settings.defaultVatRate || 13) / 100;
      const totalWithTax = settings.taxInclusivePricing !== false
        ? info.totalSubtotal
        : Math.round(info.totalSubtotal * (1 + vatMultiplier));

      return {
        ...t,
        status: effectiveStatus,
        subtotal: info.totalSubtotal,
        totalWithTax,
        activeKOTCount: info.activeTicketsCount
      };
    });
  }, [diningTables, currentFloor, floors, activeSectionId, floorStatusFilter, getTableRunningInfo, settings]);

  // Stats for Floor View
  const floorStats = useMemo(() => {
    const allOnFloor = currentFloor
      ? diningTables.filter(t => isRealDiningTable(t) && (t.floorId || floors[0]?.id) === currentFloor.id)
      : diningTables.filter(t => isRealDiningTable(t));

    return {
      all: allOnFloor.length,
      available: allOnFloor.filter(t => !getTableRunningInfo(t).hasActiveOrder).length,
      cooking: allOnFloor.filter(t => getTableRunningInfo(t).isCooking).length,
      draft: allOnFloor.filter(t => getTableRunningInfo(t).isDraft).length
    };
  }, [diningTables, currentFloor, floors, getTableRunningInfo]);

  // =========================================================================
  // DYNAMIC MENU FILTERS (Strictly derived from REAL products in catalog)
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [selectedPrepStyle, setSelectedPrepStyle] = useState<string>('ALL');
  const [isMenuFiltersCollapsed, setIsMenuFiltersCollapsed] = useState<boolean>(true);

  // Horizontal scroll refs for filter categories (Root Dept, Category, Sub-Category, Prep-Style)
  const deptScrollRef = useRef<HTMLDivElement>(null);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const subCatScrollRef = useRef<HTMLDivElement>(null);
  const prepScrollRef = useRef<HTMLDivElement>(null);

  const scrollFilterRow = (ref: React.RefObject<HTMLDivElement | null>, offset: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Dish grid display control: display 3 rows at a time with option to show more
  const [visibleProductRows, setVisibleProductRows] = useState<number>(3);
  const [gridColumns, setGridColumns] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return 2;
    return 3;
  });

  useEffect(() => {
    const handleResize = () => {
      setGridColumns(window.innerWidth < 640 ? 2 : 3);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset to 3 rows whenever filters or search query change
  useEffect(() => {
    setVisibleProductRows(3);
  }, [selectedDepartment, selectedCategory, selectedSubCategory, selectedPrepStyle, searchQuery]);

  // Derived Department, Category, Sub-Category, and Prep-Style filter pills from visible menu catalog
  const { departments, categories, subCategories, prepStyles } = useMemo(
    () =>
      deriveMenuFilterOptions(
        products,
        selectedDepartment,
        selectedCategory,
        selectedSubCategory
      ),
    [products, selectedDepartment, selectedCategory, selectedSubCategory]
  );

  // Auto-reset any stale selected filter if product catalog updates or parent filter narrows options
  useEffect(() => {
    if (selectedDepartment !== 'ALL' && !departments.includes(selectedDepartment)) {
      setSelectedDepartment('ALL');
    }
    if (selectedCategory !== 'ALL' && !categories.includes(selectedCategory)) {
      setSelectedCategory('ALL');
    }
    if (selectedSubCategory !== 'ALL' && !subCategories.includes(selectedSubCategory)) {
      setSelectedSubCategory('ALL');
    }
    if (selectedPrepStyle !== 'ALL' && !prepStyles.includes(selectedPrepStyle)) {
      setSelectedPrepStyle('ALL');
    }
  }, [
    departments,
    categories,
    subCategories,
    prepStyles,
    selectedDepartment,
    selectedCategory,
    selectedSubCategory,
    selectedPrepStyle
  ]);

  // Customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cust-walkin');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [panVatMode, setPanVatMode] = useState<'PAN' | 'VAT'>('PAN');
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    companyName: '',
    addressStreet: '',
    phone: '',
    panVatNumber: '',
    customerType: 'retail' as 'retail' | 'wholesale' | 'contractor' | 'dealer',
    openingBalance: 0,
    creditLimit: 200000,
  });

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateCustomer) return;
    if (!newCustomerForm.name.trim() || isSubmittingCustomer) return;
    setIsSubmittingCustomer(true);

    try {
      const created = await addCustomer({
        customerCode: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: newCustomerForm.name.trim(),
        companyName: newCustomerForm.companyName.trim() || undefined,
        phone: newCustomerForm.phone.trim() || 'N/A',
        panVatNumber: newCustomerForm.panVatNumber.trim() || undefined,
        customerType: 'retail',
        address: {
          province: 'Bagmati',
          district: 'Kathmandu',
          municipality: 'Kathmandu Metro',
          street: newCustomerForm.addressStreet.trim() || 'Kathmandu'
        },
        currentBalance: newCustomerForm.openingBalance || 0,
        openingBalance: newCustomerForm.openingBalance || 0,
        creditLimit: newCustomerForm.creditLimit || 200000,
        paymentTermsDays: 30,
        active: true
      });

      setSelectedCustomerId(created.id);
      setShowAddCustomerModal(false);
      setNewCustomerForm({
        name: '',
        companyName: '',
        addressStreet: '',
        phone: '',
        panVatNumber: '',
        customerType: 'retail',
        openingBalance: 0,
        creditLimit: 200000,
      });
      setKotSuccessBanner(`✓ Customer "${created.name}" registered and selected`);
      setTimeout(() => setKotSuccessBanner(null), 3000);
    } catch (err) {
      console.error('Error adding customer:', err);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  // Payment & Settlement State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'esewa' | 'fonepay' | 'khalti' | 'connectips' | 'cheque' | 'credit' | 'partial' | 'split'>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [splitCashInput, setSplitCashInput] = useState<string>('');
  const [splitFonepayInput, setSplitFonepayInput] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [salesNotes, setSalesNotes] = useState<string>('');
  const [kotSuccessBanner, setKotSuccessBanner] = useState<string | null>(null);
  const [isFiringOrder, setIsFiringOrder] = useState<boolean>(false);
  const [isSettlingBill, setIsSettlingBill] = useState<boolean>(false);
  const [isCompletingSale, setIsCompletingSale] = useState<boolean>(false);
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState<boolean>(false);
  const [isPrintingDraftBill, setIsPrintingDraftBill] = useState<boolean>(false);

  // Thermal Slip Modal State for safe non-breaking receipt previews & direct print
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipModalKitchenTicket, setSlipModalKitchenTicket] = useState<KitchenOrderTicket | null>(null);
  const [slipModalBarTicket, setSlipModalBarTicket] = useState<KitchenOrderTicket | null>(null);
  const [slipModalStation, setSlipModalStation] = useState<'kitchen' | 'bar'>('kitchen');

  // In-app Clear Order Round Confirmation Modal State
  const [showClearRoundModal, setShowClearRoundModal] = useState<boolean>(false);

  // Quick '/' keyboard shortcut to focus the POS item searchbar immediately (disabled behind modals/settle drawer)
  useEffect(() => {
    if (!selectedTableId && !isTakeawayMode) return;
    const handlePosSearchShortcut = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        isSettlingBill ||
        Boolean(customizationTarget) ||
        showManageTableModal ||
        Boolean(firedItemToCancel) ||
        showAddCustomerModal ||
        showClearRoundModal ||
        slipModalOpen ||
        Boolean(pendingPinAction)
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('keydown', handlePosSearchShortcut);
    return () => window.removeEventListener('keydown', handlePosSearchShortcut);
  }, [
    selectedTableId,
    isTakeawayMode,
    isSettlingBill,
    customizationTarget,
    showManageTableModal,
    firedItemToCancel,
    showAddCustomerModal,
    showClearRoundModal,
    slipModalOpen,
    pendingPinAction
  ]);

  // Fast-tap cooldown ref to guarantee single-click execution (prevents 2 items on single click)
  const lastAddRef = React.useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Table Draft Synchronization (Preserves cart per table & reflects red fill on floor canvas)
  const isHydratingRef = React.useRef(false);
  const hydratingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFiringRef = React.useRef(false);
  const isSettlingActionRef = React.useRef(false);

  const scheduleEndHydration = (delayMs: number = 80) => {
    if (hydratingTimerRef.current) {
      clearTimeout(hydratingTimerRef.current);
    }
    hydratingTimerRef.current = setTimeout(() => {
      isHydratingRef.current = false;
      hydratingTimerRef.current = null;
    }, delayMs);
  };

  // When selected table changes, hydrate cart and notes from its draft (or reset cleanly so stale table state never leaks)
  useEffect(() => {
    if (selectedTableId) {
      isHydratingRef.current = true;
      const draft = getTableDraft(selectedTableId);
      if (draft && draft.cart && draft.cart.length > 0) {
        setCart(draft.cart.map(item => ({
          ...item,
          availableStock: item.availableStock ?? 50,
          orderRoutingStation: item.orderRoutingStation || (item as any).routingStation
        })));
        setKitchenSpecialNotes(draft.kitchenSpecialNotes ?? '');
        setDiscountType(draft.discountType || 'percent');
        setDiscountInput(draft.discountInput ?? '0');
      } else {
        setCart([]);
        setKitchenSpecialNotes('');
        setDiscountType('percent');
        setDiscountInput('0');
      }
      setPaymentMethod('cash');
      setSelectedCustomerId('cust-walkin');
      setPaidAmountInput('');
      setSplitCashInput('');
      setSplitFonepayInput('');
      setPaymentReference('');
      setSalesNotes('');
      setSearchQuery('');
      scheduleEndHydration(80);
      setIsSettlingBill(false);
      return () => {
        if (hydratingTimerRef.current) {
          clearTimeout(hydratingTimerRef.current);
        }
      };
    } else if (!isTakeawayMode) {
      setCart([]);
      setKitchenSpecialNotes('');
      setDiscountType('percent');
      setDiscountInput('0');
      setPaymentMethod('cash');
      setSelectedCustomerId('cust-walkin');
      setPaidAmountInput('');
      setSplitCashInput('');
      setSplitFonepayInput('');
      setPaymentReference('');
      setSalesNotes('');
      setSearchQuery('');
      setIsSettlingBill(false);
    }
  }, [selectedTableId]);

  // When cart or draft fields change, persist to table draft
  useEffect(() => {
    if (!isHydratingRef.current && selectedTableId && !isTakeawayMode) {
      saveTableDraft(selectedTableId, {
        cart,
        kitchenSpecialNotes,
        discountType,
        discountInput
      });
    }
  }, [cart, kitchenSpecialNotes, discountType, discountInput, selectedTableId, isTakeawayMode]);

  // Invoice Success Modal
  const [completedInvoice, setCompletedInvoice] = useState<SaleInvoice | null>(null);
  const [completedTable, setCompletedTable] = useState<DiningTable | null>(null);
  // Persist invoice number & id across adjustments for the same table/order session
  const [sessionInvoiceMap, setSessionInvoiceMap] = useState<Record<string, { invoiceNumber: string; invoiceId: string }>>({});

  // Live timer tick to ensure ticket elapsed minutes stay fresh and accurate in real-time
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  const isWalkInCustomer = useMemo(() => {
    return (
      !selectedCustomer ||
      selectedCustomer.id === 'cust-walkin' ||
      selectedCustomer.customerCode === 'CUST-WALKIN'
    );
  }, [selectedCustomer]);

  // Filtered Products based on Hierarchy and Smart Fuzzy Typo-Tolerant Search
  const { filteredProducts, searchCorrectedTerms, isGlobalSearch } = useMemo(
    () =>
      filterMenuProducts({
        products,
        searchQuery,
        selectedDepartment,
        selectedCategory,
        selectedSubCategory,
        selectedPrepStyle
      }),
    [products, selectedDepartment, selectedCategory, selectedSubCategory, selectedPrepStyle, searchQuery]
  );

  // Slice products by visible rows (displays 3 rows at a time with option to show more)
  const maxVisibleProducts = visibleProductRows * gridColumns;
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, maxVisibleProducts);
  }, [filteredProducts, maxVisibleProducts]);
  const remainingProductsCount = Math.max(0, filteredProducts.length - maxVisibleProducts);

  // Pricing helper
  const getProductPriceForCustomer = (product: Product, customer?: Customer): number => {
    if (!customer) return product.retailPrice;
    if (customer.customerType === 'wholesale' || customer.customerType === 'contractor') {
      return product.wholesalePrice || product.retailPrice;
    }
    if (customer.customerType === 'dealer' && product.dealerPrice) {
      return product.dealerPrice;
    }
    return product.retailPrice;
  };

  // Add Product to Cart directly (with cooldown protection against accidental double execution + stock guard)
  const addToCart = (
    product: Product,
    addons?: { name: string; price: number }[],
    notes?: string,
    quantityToAdd: number = 1
  ) => {
    if (!canCreateOrder) {
      setKotCancelNotice('Adding items to POS orders is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3000);
      return;
    }
    if (isProductOutOfStock(product)) {
      setKotCancelNotice(`"${product.name}" is currently out of stock.`);
      setTimeout(() => setKotCancelNotice(null), 3000);
      return;
    }

    const isCustomSubmission = Boolean((addons && addons.length > 0) || (notes && notes.trim()));
    const now = Date.now();
    if (!isCustomSubmission && lastAddRef.current.id === product.id && (now - lastAddRef.current.time) < 150) {
      return;
    }
    lastAddRef.current = { id: product.id, time: now };

    const isTrackedStock = product.itemType === 'raw_ingredient' || product.trackStock === true;
    const maxStock = product.currentStock ?? 0;
    const currentCartQtyForProduct = cart
      .filter(c => c.productId === product.id)
      .reduce((sum, c) => sum + c.quantity, 0);

    if (isTrackedStock && currentCartQtyForProduct + quantityToAdd > maxStock) {
      setKotCancelNotice(`Only ${maxStock} left in stock for "${product.name}".`);
      setTimeout(() => setKotCancelNotice(null), 3000);
      return;
    }

    const basePrice = getProductPriceForCustomer(product, selectedCustomer);
    const addonsTotal = (addons || []).reduce((sum, a) => sum + a.price, 0);
    const effectiveUnitPrice = basePrice + addonsTotal;
    const addonsKey = (addons || []).map(a => a.name).sort().join('|');

    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.productId === product.id && 
        item.selectedUnit === product.baseUnit &&
        ((item.addonsList || []).map(a => a.name).sort().join('|') === addonsKey) &&
        (item.itemNotes || '') === (notes || '')
      );

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + quantityToAdd;
        const newBaseQty = newQty * (existing.conversionFactor || 1);
        
        const newCart = [...prev];
        newCart[existingIndex] = {
          ...existing,
          quantity: newQty,
          baseQuantity: newBaseQty,
          lineTotal: (newQty * existing.unitPrice) - existing.discountAmount
        };
        return newCart;
      } else {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          hsCode: product.hsCode || '',
          selectedUnit: product.baseUnit,
          conversionFactor: 1,
          quantity: quantityToAdd,
          baseQuantity: quantityToAdd,
          unitPrice: effectiveUnitPrice,
          costPrice: product.costPrice,
          discountPercent: 0,
          discountAmount: 0,
          taxRatePercent: product.taxRatePercent !== undefined ? product.taxRatePercent : (settings.defaultVatRate || 13),
          isTaxInclusive: product.isTaxInclusive !== undefined ? product.isTaxInclusive : (settings.taxInclusivePricing !== false),
          taxAmount: 0,
          lineTotal: effectiveUnitPrice * quantityToAdd,
          availableStock: product.currentStock,
          addonsList: addons || [],
          itemNotes: notes,
          orderRoutingStation: resolveItemRoutingStation({
            explicitStation: product.orderRoutingStation,
            product,
            productName: product.name
          })
        };
        return [...prev, newItem];
      }
    });
  };

  // Open Addon Customization Modal for a specific menu dish (uses the same full OrderItemCustomizationModal as the order ticket)
  const handleOpenAddonModal = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canCreateOrder) {
      setKotCancelNotice('Adding items to POS orders is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3000);
      return;
    }
    if (isProductOutOfStock(product)) {
      setKotCancelNotice(`"${product.name}" is currently out of stock.`);
      setTimeout(() => setKotCancelNotice(null), 3000);
      return;
    }
    const customerPrice = getProductPriceForCustomer(product, selectedCustomer);
    setCustomizationTarget({
      type: 'new',
      product,
      unitPrice: customerPrice,
      quantity: 1
    });
  };

  // Update Cart Quantity (enforces tracked stock limit if configured)
  const updateQuantity = (index: number, newQty: number) => {
    if (!canCreateOrder && !canUpdateOrder) return;
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const targetItem = cart[index];
    if (targetItem) {
      const prod = products.find(p => p.id === targetItem.productId);
      const isTrackedStock = prod && (prod.itemType === 'raw_ingredient' || prod.trackStock === true);
      if (isTrackedStock && prod) {
        const otherCartQty = cart
          .filter((c, i) => i !== index && c.productId === prod.id)
          .reduce((sum, c) => sum + c.quantity, 0);
        if (otherCartQty + newQty > (prod.currentStock ?? 0)) {
          setKotCancelNotice(`Only ${prod.currentStock ?? 0} left in stock for "${prod.name}".`);
          setTimeout(() => setKotCancelNotice(null), 3000);
          return;
        }
      }
    }
    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;
      const baseQty = newQty * (item.conversionFactor || 1);
      const grossLine = newQty * item.unitPrice;
      const lineTotal = Math.max(0, grossLine - item.discountAmount);
      
      updated[index] = {
        ...item,
        quantity: newQty,
        baseQuantity: baseQty,
        lineTotal
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    if (!canCreateOrder && !canUpdateOrder) return;
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Active KOT / BOT Tickets for current selected table or takeaway session (deduplicated & cross-floor-safe)
  const activeTableTickets = useMemo(() => {
    return getActiveTicketsForSession({
      tickets: kitchenTickets,
      activeDiningTable,
      diningTables,
      isTakeawayMode
    });
  }, [kitchenTickets, activeDiningTable, isTakeawayMode, diningTables]);

  // Group and assign sequential round numbers chronologically based on ticket creation time
  const { renderedTicketsWithRounds, totalFiredRounds } = useMemo(() => {
    return assignRoundsToTickets(activeTableTickets);
  }, [activeTableTickets]);

  // Convert fired KOT items to sale items for billing and running order display
  const firedSaleItems = useMemo<SaleItem[]>(() => {
    if (activeTableTickets.length === 0) return [];
    return activeTableTickets.flatMap(ticket =>
      (ticket.items || [])
        .filter(item => item && item.status !== 'cancelled')
        .map(item => {
          const prod = products.find(
            p => p.id === item.productId || (Boolean(p.name && item.productName) && String(p.name || '').toLowerCase() === String(item.productName || '').toLowerCase())
          );
          const lineTotal = item.quantity * item.unitPrice;
          const isTaxInclusive = prod?.isTaxInclusive !== undefined ? prod.isTaxInclusive : (settings.taxInclusivePricing !== false);
          const taxRate = prod?.taxRatePercent !== undefined ? prod.taxRatePercent : (settings.defaultVatRate || 13);
          const itemTaxAmount = isTaxInclusive
            ? (taxRate > 0 ? (lineTotal * taxRate) / (100 + taxRate) : 0)
            : (taxRate > 0 ? (lineTotal * taxRate) / 100 : 0);

          const routingStation = resolveItemRoutingStation({
            explicitStation: (item as any).routingStation,
            ticketStation: ticket.destinationStation,
            ticketType: ticket.ticketType,
            kotNumber: ticket.kotNumber,
            course: item.course,
            product: prod,
            productName: item.productName
          });

          return {
            productId: item.productId,
            productName: item.productName,
            sku: prod?.sku || 'MENU-ITEM',
            barcode: prod?.barcode,
            selectedUnit: prod?.baseUnit || 'Portion',
            conversionFactor: 1,
            quantity: item.quantity,
            baseQuantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: prod?.costPrice || 0,
            discountPercent: 0,
            discountAmount: 0,
            taxRatePercent: taxRate,
            isTaxInclusive,
            taxAmount: Math.round(itemTaxAmount * 100) / 100,
            lineTotal,
            orderRoutingStation: routingStation
          };
        })
    );
  }, [activeTableTickets, products, settings.defaultVatRate, settings.taxInclusivePricing]);

  // Check if all fired order tickets on the active table have been cancelled
  const isTableAllCancelled = useMemo(() => {
    if (!activeDiningTable || activeTableTickets.length === 0) return false;
    const allItems = activeTableTickets.flatMap(t => t.items || []);
    if (allItems.length === 0) return true;
    return allItems.every(i => i.status === 'cancelled');
  }, [activeDiningTable, activeTableTickets]);

  // Combined bill items:
  // For dining tables: ONLY fired KOT/BOT orders can be billed (unfired drafts are excluded to prevent overcharging)
  // For takeaway counter: fired items if present, or direct cart items for quick counter walk-in
  const allBillItems = useMemo<SaleItem[]>(() => {
    if (activeDiningTable) {
      return firedSaleItems;
    }
    return firedSaleItems.length > 0 ? firedSaleItems : cart;
  }, [activeDiningTable, firedSaleItems, cart]);

  // Accurate breakdown of total items by station and draft vs billable state
  const stationCounts = useMemo(
    () => getTicketStationCounts(firedSaleItems, cart, allBillItems),
    [firedSaleItems, cart, allBillItems]
  );
  const totalBillItemsCount = stationCounts.billableItemsCount;
  const totalKitchenItemsCount = stationCounts.totalKitchenCount;
  const totalBarItemsCount = stationCounts.totalBarCount;
  const totalDraftItemsCount = stationCounts.draftTotalCount;

  const defaultVatRate = settings.defaultVatRate || 13;

  const splitCashNumber = Math.max(0, parseFloat(splitCashInput) || 0);
  const splitFonepayNumber = Math.max(0, parseFloat(splitFonepayInput) || 0);
  const effectivePaidAmountInput =
    paymentMethod === 'split'
      ? splitCashInput.trim() !== '' || splitFonepayInput.trim() !== ''
        ? String(splitCashNumber + splitFonepayNumber)
        : '0'
      : paidAmountInput;

  // Canonical IRD bill totals with clamped discount & payment guards
  const billTotals = useMemo(
    () =>
      calculateBillTotals({
        items: allBillItems,
        discountType,
        discountInput,
        paidAmountInput: effectivePaidAmountInput,
        paymentMethod,
        taxInclusivePricing: settings.taxInclusivePricing !== false,
        defaultVatRate
      }),
    [allBillItems, discountType, discountInput, effectivePaidAmountInput, paymentMethod, settings.taxInclusivePricing, defaultVatRate]
  );

  const subtotal = billTotals.subtotal;
  const grossDiscount = billTotals.grossDiscount;
  const taxableAmount = billTotals.taxableAmount;
  const taxAmount = billTotals.taxAmount;
  const nonTaxableAmount = billTotals.nonTaxableAmount;
  const grandTotal = billTotals.grandTotal;

  const totalCost = useMemo(() => {
    return allBillItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
  }, [allBillItems]);

  const grossProfit = grandTotal - taxAmount - totalCost;

  const paidAmountNumber = billTotals.paidAmountNumber;
  const isPaidAmountProvided = billTotals.isPaidAmountProvided;
  const dueAmount = billTotals.effectiveDueAmount;
  const changeToReturn = billTotals.changeToReturn;

  const rawDiscountVal = Math.max(0, Number(discountInput) || 0);
  const effectiveDiscountPercent = discountType === 'percent'
    ? Math.min(100, rawDiscountVal)
    : subtotal > 0
    ? (grossDiscount / subtotal) * 100
    : grossDiscount > 0
    ? 100
    : 0;
  const isDiscountOverLimit = Boolean(
    currentOperator &&
    grossDiscount > 0 &&
    (!canApplyDiscounts || effectiveDiscountPercent > maxDiscountPercent + 0.01)
  );

  const isCreditOnWalkIn = isWalkInCustomer && paymentMethod === 'credit';
  const isWalkInCreditBlocked = isCreditOnWalkIn;
  const isSplitInvalid =
    paymentMethod === 'split' && (splitCashNumber <= 0 || splitFonepayNumber <= 0);
  const walkInCreditWarning = isCreditOnWalkIn
    ? canCreateCustomer
      ? 'Select a named customer or click "+ Add" to bill on Credit (बाँकी). Walk-in Guest cannot take credit.'
      : 'Select a named customer to bill on Credit (बाँकी). Walk-in Guest cannot take credit.'
    : '';

  // Print Draft / Proforma Table Check WITHOUT settling the bill or closing the table
  const performPrintDraftBill = async () => {
    if (!canReprintBills) {
      setKotCancelNotice('Draft check / bill printing is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    if (allBillItems.length === 0 || isPrintingDraftBill) return;
    setIsPrintingDraftBill(true);

    try {
      const warehouse = warehouses.find(w => w.id === currentWarehouseId) || warehouses[0] || { id: 'wh-main', name: 'Main Kitchen / Store' };
      const cust = selectedCustomer || customers[0] || {
        id: 'cust-walkin',
        name: 'Counter Guest / Walk-in',
        phone: 'N/A',
        panVatNumber: '',
        address: { street: 'Kathmandu', district: 'Bagmati' },
        customerType: 'retail' as const
      };
      const customerAddress = cust.address ? `${cust.address.street || ''}, ${cust.address.district || ''}`.trim() : 'Kathmandu, Bagmati';

      const draftInvoiceData: SaleInvoice = {
        id: `draft-${Date.now()}`,
        invoiceNumber: activeDiningTable ? `DRAFT-${activeDiningTable.tableNumber}` : 'DRAFT-CHECK',
        date: Date.now(),
        fiscalYear: settings.fiscalYear || '2081/82',
        customerId: cust.id || 'cust-walkin',
        customerName: cust.name || 'Counter Guest / Walk-in',
        customerPhone: cust.phone || 'N/A',
        customerPanVat: cust.panVatNumber || '',
        customerAddress,
        customerType: (cust.customerType === 'wholesale' || cust.customerType === 'contractor' || cust.customerType === 'dealer') ? cust.customerType : 'retail',
        salespersonId: operatorId || 'staff-1',
        salespersonName: resolveTableWaiter(activeDiningTable?.assignedWaiter) || operatorName || 'Staff',
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        items: allBillItems,
        subtotal,
        discountAmount: grossDiscount,
        taxableAmount,
        taxAmount,
        nonTaxableAmount,
        grandTotal,
        totalCost,
        grossProfit,
        paymentMethod: 'cash',
        paidAmount: 0,
        dueAmount: grandTotal,
        paymentStatus: 'unpaid',
        paymentReference: '',
        status: 'draft',
        notes: 'Draft table check (not settled)',
        terms: settings.termsAndConditions || '',
        createdAt: Date.now()
      };

      const res = await printBillForInvoice(draftInvoiceData, activeDiningTable || null, undefined, { isDraft: true });
      const targetLabel = activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway';
      if (res.success) {
        setKotSuccessBanner(`🧾 Draft bill printed for ${targetLabel} (bill not settled)`);
        setTimeout(() => setKotSuccessBanner(null), 4000);
      } else {
        setKotCancelNotice(res.message || `Could not print draft bill for ${targetLabel}. Check billing printer setup.`);
      }
    } catch (err) {
      console.warn('Draft bill print notice:', err);
    } finally {
      setIsPrintingDraftBill(false);
    }
  };

  const handlePrintDraftBill = () => {
    if (!canReprintBills) {
      setKotCancelNotice('Draft check / bill printing is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    if (allBillItems.length === 0 || isPrintingDraftBill) return;
    executeWithPinIfRequired(
      {
        title: 'Enter PIN to Print Draft Bill',
        detail: `${activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway'} • ${formatNPR(grandTotal)}`,
        accent: 'amber'
      },
      performPrintDraftBill
    );
  };

  // Open Settle Bill & Payment Drawer/Panel
  const handleOpenSettleBill = () => {
    if (!canSettleBill) {
      setKotCancelNotice('Bill settlement & invoicing is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    if (activeDiningTable && cart.length > 0) return;
    if (allBillItems.length === 0) return;
    setPaidAmountInput('');
    setSplitCashInput('');
    setSplitFonepayInput('');
    setIsSettlingBill(true);
  };

  // Complete Sale & Print Bill (Prepares sale and opens confirmation popup instantly)
  const performCompleteSaleAndPrint = () => {
    if (!canSettleBill || isDiscountOverLimit || isWalkInCreditBlocked || isSplitInvalid) return;
    if ((activeDiningTable && cart.length > 0) || allBillItems.length === 0 || isCompletingSale || isSettlingActionRef.current) return;
    setIsCompletingSale(true);

    try {
      const warehouse = warehouses.find(w => w.id === currentWarehouseId) || warehouses[0] || { id: 'wh-main', name: 'Main Kitchen / Store' };
      
      const sessionKey = activeDiningTable?.id || (isTakeawayMode ? 'takeaway-counter' : 'counter');
      const existingSession = sessionInvoiceMap[sessionKey];

      // Reuse same invoice number if staff previously settled or adjusted this bill
      const invoiceNumber = 
        activeDiningTable?.assignedInvoiceNumber ||
        existingSession?.invoiceNumber ||
        generateNextInvoiceNumber(sales, settings.invoicePrefix || 'INV-');

      const invoiceId = 
        existingSession?.invoiceId || 
        `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Save into sessionInvoiceMap so any subsequent adjustments retain this exact invoice number
      setSessionInvoiceMap(prev => ({
        ...prev,
        [sessionKey]: { invoiceNumber, invoiceId }
      }));

      const effectivePaidAmount = billTotals.effectivePaidAmount;
      const effectiveDueAmount = billTotals.effectiveDueAmount;
      const paymentStatus = billTotals.paymentStatus;

      let normalizedSplit: { cash: number; fonepay: number } | undefined;
      if (paymentMethod === 'split') {
        const clampedFonepay = Math.min(grandTotal, Math.round(splitFonepayNumber * 100) / 100);
        const maxRemainingCash = Math.max(0, Math.round((grandTotal - clampedFonepay) * 100) / 100);
        const clampedCash = Math.min(maxRemainingCash, Math.round(splitCashNumber * 100) / 100);
        normalizedSplit = { cash: clampedCash, fonepay: clampedFonepay };
      }

      const cust = selectedCustomer || customers[0] || {
        id: 'cust-walkin',
        name: 'Counter Guest / Walk-in',
        phone: 'N/A',
        panVatNumber: '',
        address: { street: 'Kathmandu', district: 'Bagmati' },
        customerType: 'retail' as const
      };
      const customerAddress = cust.address ? `${cust.address.street || ''}, ${cust.address.district || ''}`.trim() : 'Kathmandu, Bagmati';

      const saleInvoiceData: SaleInvoice = {
        id: invoiceId,
        invoiceNumber,
        date: Date.now(),
        fiscalYear: settings.fiscalYear || '2081/82',
        customerId: cust.id || 'cust-walkin',
        customerName: cust.name || 'Counter Guest / Walk-in',
        customerPhone: cust.phone || 'N/A',
        customerPanVat: cust.panVatNumber || '',
        customerAddress,
        customerType: (cust.customerType === 'wholesale' || cust.customerType === 'contractor' || cust.customerType === 'dealer') ? cust.customerType : 'retail',
        salespersonId: operatorId || 'staff-1',
        salespersonName: operatorName || 'Staff',
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        items: allBillItems,
        subtotal,
        discountAmount: grossDiscount,
        taxableAmount,
        taxAmount,
        nonTaxableAmount,
        grandTotal,
        totalCost,
        grossProfit,
        paymentMethod,
        ...(normalizedSplit ? { paymentSplit: normalizedSplit } : {}),
        paidAmount: effectivePaidAmount,
        dueAmount: effectiveDueAmount,
        paymentStatus,
        paymentReference: paymentReference || '',
        status: 'completed',
        notes: salesNotes || '',
        terms: settings.termsAndConditions || '',
        createdAt: Date.now()
      };

      // Open confirmation popup IMMEDIATELY with 0ms latency (zero network blocking)
      setCompletedInvoice(saleInvoiceData);
      setCompletedTable(activeDiningTable || null);
    } catch (err) {
      console.error('Error preparing sale invoice:', err);
      setIsCompletingSale(false);
    }
  };

  const handleFinalCompleteSaleAndPrint = () => {
    if (!canSettleBill || isDiscountOverLimit || isWalkInCreditBlocked || isSplitInvalid) return;
    if ((activeDiningTable && cart.length > 0) || allBillItems.length === 0 || isCompletingSale || isSettlingActionRef.current) return;
    executeWithPinIfRequired(
      {
        title: 'Enter PIN to Settle Final Bill',
        detail: `${activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway'} • ${formatNPR(grandTotal)}`,
        accent: 'emerald'
      },
      performCompleteSaleAndPrint
    );
  };

  // Dismiss invoice settlement popup without printing and navigate back to floor plan
  const handleDismissCompletedInvoice = async () => {
    if (!completedInvoice || isSettlingActionRef.current) return;
    isSettlingActionRef.current = true;
    setIsSubmittingSettlement(true);

    const invoiceToFinalize = { ...completedInvoice };
    const tableToSettle = completedTable || activeDiningTable;
    const isTakeaway = isTakeawayMode;

    const sessionKey = (tableToSettle?.id) || (isTakeaway ? 'takeaway-counter' : 'counter');
    setSessionInvoiceMap(prev => {
      const next = { ...prev };
      delete next[sessionKey];
      return next;
    });

    // Immediately dismiss modal and navigate to floor plan
    setCompletedInvoice(null);
    setCompletedTable(null);
    setIsSettlingBill(false);
    setSelectedTableId(null);
    setIsTakeawayMode(false);
    setCart([]);
    setDiscountType('percent');
    setDiscountInput('0');
    setPaymentMethod('cash');
    setSelectedCustomerId('cust-walkin');
    setPaymentReference('');
    setSalesNotes('');
    setKitchenSpecialNotes('');
    setPaidAmountInput('');
    setSplitCashInput('');
    setSplitFonepayInput('');

    // Persist sale and table settlement (settleTableBill checks multi-device table lock before calling recordSale)
    try {
      if (tableToSettle) {
        await settleTableBill(tableToSettle.id, invoiceToFinalize);
      } else {
        const recorded = await recordSale(invoiceToFinalize);
        if (isTakeaway) {
          await settleTableBill('takeaway-counter', recorded);
        } else {
          await settleTableBill('counter', recorded);
        }
      }
    } catch (err) {
      console.error('Error settling bill:', err);
    } finally {
      isSettlingActionRef.current = false;
      setIsSubmittingSettlement(false);
      setIsCompletingSale(false);
    }
  };

  // Print bill from settlement popup and navigate back to floor plan
  const handlePrintAndDismissCompletedInvoice = () => {
    if (!completedInvoice || isSettlingActionRef.current) return;
    isSettlingActionRef.current = true;
    setIsSubmittingSettlement(true);

    const invoiceToFinalize = { ...completedInvoice };
    const tableToSettle = completedTable || activeDiningTable;
    const isTakeaway = isTakeawayMode;

    const sessionKey = (tableToSettle?.id) || (isTakeaway ? 'takeaway-counter' : 'counter');
    setSessionInvoiceMap(prev => {
      const next = { ...prev };
      delete next[sessionKey];
      return next;
    });

    // Immediately dismiss modal and navigate to floor plan
    setCompletedInvoice(null);
    setCompletedTable(null);
    setIsSettlingBill(false);
    setSelectedTableId(null);
    setIsTakeawayMode(false);
    setCart([]);
    setDiscountType('percent');
    setDiscountInput('0');
    setPaymentMethod('cash');
    setSelectedCustomerId('cust-walkin');
    setPaymentReference('');
    setSalesNotes('');
    setKitchenSpecialNotes('');
    setPaidAmountInput('');
    setSplitCashInput('');
    setSplitFonepayInput('');

    // Trigger thermal print IMMEDIATELY without waiting for Firestore writes (~20ms vs several seconds)
    void printBillForInvoice(invoiceToFinalize, tableToSettle || null).catch(printErr => {
      console.warn('Print bill notice:', printErr);
    });

    // Persist sale and table settlement in parallel/background
    void (async () => {
      try {
        if (tableToSettle) {
          await settleTableBill(tableToSettle.id, invoiceToFinalize);
        } else {
          const recorded = await recordSale(invoiceToFinalize);
          if (isTakeaway) {
            await settleTableBill('takeaway-counter', recorded);
          } else {
            await settleTableBill('counter', recorded);
          }
        }
      } catch (err) {
        console.error('Error settling bill:', err);
      } finally {
        isSettlingActionRef.current = false;
        setIsSubmittingSettlement(false);
        setIsCompletingSale(false);
      }
    })();
  };

  // Go back to adjust bill: instantaneously return to Settle Bill drawer with all bill items intact
  const handleGoBackToAdjustBill = () => {
    if (isSettlingActionRef.current) return;
    // Preserve current invoice number & id so subsequent re-settlement keeps the same invoice number
    if (completedInvoice) {
      const sessionKey = (completedTable?.id || activeDiningTable?.id) || (isTakeawayMode ? 'takeaway-counter' : 'counter');
      setSessionInvoiceMap(prev => ({
        ...prev,
        [sessionKey]: {
          invoiceNumber: completedInvoice.invoiceNumber,
          invoiceId: completedInvoice.id
        }
      }));
    }
    setCompletedInvoice(null);
    setCompletedTable(null);
    setIsCompletingSale(false);
  };

  // Reusable settlement success & print confirmation modal
  const renderCompletedInvoiceModal = () => {
    if (!completedInvoice) return null;
    return (
      <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center relative">
          {/* Top Left Action Icon to go back and make adjustment to bills */}
          <button
            type="button"
            disabled={isSubmittingSettlement}
            onClick={handleGoBackToAdjustBill}
            title="Go back to adjust bill"
            aria-label="Go back to adjust bill"
            className="absolute top-4 left-4 p-2 rounded-xl bg-slate-100/80 hover:bg-blue-50 dark:bg-slate-800/80 dark:hover:bg-blue-950/50 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700/60 transition-all cursor-pointer shadow-2xs group disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="sr-only">Go back to adjust bill</span>
          </button>

          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              Bill Settled Successfully!
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Invoice #{completedInvoice.invoiceNumber}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 font-mono text-sm font-black text-blue-600 dark:text-blue-400 space-y-1">
            <div>
              {completedInvoice.paymentMethod === 'credit'
                ? `Credit Due: ${formatNPR(completedInvoice.grandTotal)}`
                : `Total Paid: ${formatNPR(completedInvoice.paidAmount ?? completedInvoice.grandTotal)}`}
            </div>
            {completedInvoice.paymentMethod === 'split' && completedInvoice.paymentSplit && (
              <div className="text-2xs font-semibold text-slate-600 dark:text-slate-300">
                Cash: {formatNPR(completedInvoice.paymentSplit.cash)} • Fonepay: {formatNPR(completedInvoice.paymentSplit.fonepay)}
              </div>
            )}
            {completedInvoice.paymentMethod !== 'credit' && completedInvoice.dueAmount > 0 && (
              <div className="text-2xs font-bold text-amber-600 dark:text-amber-400">
                Remaining Due: {formatNPR(completedInvoice.dueAmount)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmittingSettlement}
              onClick={handleDismissCompletedInvoice}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmittingSettlement}
              onClick={handlePrintAndDismissCompletedInvoice}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full text-xs font-black shadow-md shadow-blue-500/25 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{isSubmittingSettlement ? 'Saving...' : 'Print Bill'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Open In-App Confirmation Popup for Clearing Order Round
  const handleOpenClearDraft = () => {
    if (!canCreateOrder && !canUpdateOrder) return;
    if (cart.length > 0) {
      setShowClearRoundModal(true);
    }
  };

  // Confirm Clear Table Draft (Discard unsent items)
  const performConfirmClearDraft = () => {
    if (!canCreateOrder && !canUpdateOrder) return;
    const targetLabel = activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway';
    if (activeDiningTable) {
      clearTableDraft(activeDiningTable.id);
    }
    setCart([]);
    setKitchenSpecialNotes('');
    setDiscountType('percent');
    setDiscountInput('0');
    setShowClearRoundModal(false);
    setKotSuccessBanner(`✓ Draft items cleared for ${targetLabel}`);
    setTimeout(() => setKotSuccessBanner(null), 3000);
  };

  const handleConfirmClearDraft = () => {
    if (!canCreateOrder && !canUpdateOrder) return;
    executeWithPinIfRequired(
      {
        title: 'Enter PIN to Clear Draft Order',
        detail: activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway',
        accent: 'rose'
      },
      performConfirmClearDraft
    );
  };

  // Fire KOT / BOT (Smart automated distribution between Kitchen KDS & Bar BOT)
  const performFireKOT = async () => {
    if (!canCreateOrder) {
      setKotCancelNotice('Firing KOT/BOT orders is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    if (cart.length === 0 || isFiringRef.current || isFiringOrder) return;
    if (!activeDiningTable && !isTakeawayMode) return;

    if (hydratingTimerRef.current) {
      clearTimeout(hydratingTimerRef.current);
      hydratingTimerRef.current = null;
    }

    isFiringRef.current = true;
    setIsFiringOrder(true);
    isHydratingRef.current = true; // Lock draft auto-saver so firing never re-saves cleared draft

    const tableId = activeDiningTable?.id || 'takeaway-counter';
    const tableNumber = activeDiningTable?.tableNumber || 'Takeaway';
    const zoneName = activeDiningTable?.zoneName || activeDiningTable?.floorName || 'Counter';
    const waiterName = resolveTableWaiter(activeDiningTable?.assignedWaiter);
    const guestsCount = activeDiningTable?.currentGuests || 1;
    const itemsToFire = [...cart];
    const notesToFire = kitchenSpecialNotes;
    const fireNow = Date.now();

    const kotItems: any[] = itemsToFire.map((item, idx) => {
      const isBar = item.orderRoutingStation === 'bar' || (item as any).routingStation === 'bar';
      const addons = extractKOTItemAddons(item);
      return {
        id: `ki-${fireNow}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        course: (isBar ? 'beverage' : 'main') as any,
        routingStation: (isBar ? 'bar' : 'kitchen') as 'kitchen' | 'bar',
        specialInstructions: item.itemNotes || notesToFire || undefined,
        addonsList: addons.length > 0 ? addons : undefined,
        selectedModifiers: addons.map(a => ({
          modifierName: 'Addon',
          optionName: a.name,
          priceDelta: a.price
        })),
        status: 'pending' as const,
        firedAt: fireNow
      };
    });

    // Find configured station printers cleanly (matches AppContext & individual ticket Reprint default priority)
    const resolveStationPrinter = (station: 'kitchen' | 'bar') => {
      const active = printers.filter(p => p.isActive);
      const exact = active.filter(p => p.station === station);
      const shared = active.filter(p => p.station === 'all');
      return (
        exact.find(p => p.isDefault) ||
        exact[0] ||
        shared.find(p => p.isDefault) ||
        shared[0] ||
        active.find(p => p.isDefault) ||
        active[0] ||
        printers[0] ||
        INITIAL_PRINTERS[0]
      );
    };
    const kitchenPrinter = resolveStationPrinter('kitchen');
    const barPrinter = resolveStationPrinter('bar');

    const dispatchTicketsPrint = (kTicket?: KitchenOrderTicket | null, bTicket?: KitchenOrderTicket | null) => {
      try {
        if (isElectronDesktop()) {
          if (kTicket && bTicket) {
            const samePhysicalPrinter =
              kitchenPrinter.id === barPrinter.id ||
              (kitchenPrinter.driverName && barPrinter.driverName && kitchenPrinter.driverName === barPrinter.driverName);
            if (samePhysicalPrinter) {
              const combinedHtml = generateCombinedOrderTicketsHtml(kTicket, bTicket, kitchenPrinter, settings);
              void executeThermalPrint(
                combinedHtml,
                kitchenPrinter,
                { type: 'combined', data: { kitchenTicket: kTicket, barTicket: bTicket }, settings },
                { triggerNativePrint: true }
              );
            } else {
              const kHtml = generateKOTSlipHtml(kTicket, kitchenPrinter, settings);
              const bHtml = generateBOTSlipHtml(bTicket, barPrinter, settings);
              void executeThermalPrint(kHtml, kitchenPrinter, { type: 'kot', data: kTicket, settings }, { triggerNativePrint: true });
              void executeThermalPrint(bHtml, barPrinter, { type: 'bot', data: bTicket, settings }, { triggerNativePrint: true });
            }
          } else if (kTicket) {
            const kHtml = generateKOTSlipHtml(kTicket, kitchenPrinter, settings);
            void executeThermalPrint(kHtml, kitchenPrinter, { type: 'kot', data: kTicket, settings }, { triggerNativePrint: true });
          } else if (bTicket) {
            const bHtml = generateBOTSlipHtml(bTicket, barPrinter, settings);
            void executeThermalPrint(bHtml, barPrinter, { type: 'bot', data: bTicket, settings }, { triggerNativePrint: true });
          }
        } else {
          let browserHtml = '';
          let browserWidth = kitchenPrinter.paperWidth;
          if (kTicket && bTicket) {
            browserHtml = generateCombinedOrderTicketsHtml(kTicket, bTicket, kitchenPrinter, settings);
          } else if (bTicket) {
            browserHtml = generateBOTSlipHtml(bTicket, barPrinter, settings);
            browserWidth = barPrinter.paperWidth;
          } else if (kTicket) {
            browserHtml = generateKOTSlipHtml(kTicket, kitchenPrinter, settings);
          }
          if (browserHtml) {
            safeThermalWindowPrint(browserHtml, browserWidth);
          }
        }
      } catch (printErr) {
        console.warn('Direct print attempt:', printErr);
      }
    };

    // Reserve ticket numbers & dispatch print immediately once tickets exist (before React state re-renders).
    // Cart is cleared only after ticket creation succeeds so a failure never loses the order!
    let printDispatchedEarly = false;
    try {
      const result = await splitAndFireTickets({
        tableId,
        tableNumber,
        zoneName,
        waiterName,
        guestsCount,
        notes: notesToFire || undefined,
        items: kotItems,
        onTicketsReady: ({ kitchenTicket, barTicket }) => {
          printDispatchedEarly = true;
          dispatchTicketsPrint(kitchenTicket || null, barTicket || null);
        }
      });

      setCart([]);
      setKitchenSpecialNotes('');

      const kTicket = result.kitchenTicket || null;
      const bTicket = result.barTicket || null;

      setSlipModalKitchenTicket(kTicket);
      setSlipModalBarTicket(bTicket);

      if (kTicket && bTicket) {
        setKotSuccessBanner(`🎉 Fired & Printed: ${kTicket.kotNumber} (Kitchen) & ${bTicket.kotNumber} (Bar) for ${tableNumber}!`);
      } else if (bTicket) {
        setKotSuccessBanner(`🍸 Fired & Printed: ${bTicket.kotNumber} to Bar for ${tableNumber}!`);
      } else if (kTicket) {
        setKotSuccessBanner(`👨‍🍳 Fired & Printed: ${kTicket.kotNumber} to Kitchen for ${tableNumber}!`);
      } else {
        setKotSuccessBanner(`✓ Order fired & printed for ${tableNumber}!`);
      }

      setTimeout(() => {
        setKotSuccessBanner(null);
      }, 7000);

      if (!printDispatchedEarly) {
        dispatchTicketsPrint(kTicket, bTicket);
      }
    } catch (err) {
      console.error('Error firing order:', err);
      setKotCancelNotice('Could not send order to kitchen/bar. Your draft items are preserved — please retry.');
    } finally {
      setIsFiringOrder(false);
      isFiringRef.current = false;
      scheduleEndHydration(200);
    }
  };

  const handleFireKOT = () => {
    if (!canCreateOrder) {
      setKotCancelNotice('Firing KOT/BOT orders is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    if (cart.length === 0 || isFiringRef.current || isFiringOrder) return;
    if (!activeDiningTable && !isTakeawayMode) return;
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    executeWithPinIfRequired(
      {
        title: 'Enter PIN to Fire Order',
        detail: `${activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway'} • ${totalQty} item${totalQty === 1 ? '' : 's'}`,
        accent: 'blue'
      },
      performFireKOT
    );
  };

  // Reprint ticket straight away on user action and increment printedCount cleanly
  const performReprintTicket = async (ticket: KitchenOrderTicket) => {
    if (!canReprintBills) {
      setKotCancelNotice('Reprinting KOT/BOT slips is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    const isBar = ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT';
    const targetPrinter =
      printers.find(p => p.isActive && (p.station === (isBar ? 'bar' : 'kitchen') || p.station === 'all')) ||
      printers[0] ||
      INITIAL_PRINTERS[0];
    try {
      if (isBar) {
        await printBOTForTicket(ticket, targetPrinter, true);
      } else {
        await printKOTForTicket(ticket, targetPrinter, true);
      }
      setKotSuccessBanner(`🖨️ ${ticket.kotNumber} printed straight away!`);
      setTimeout(() => setKotSuccessBanner(null), 4000);
    } catch (e: any) {
      console.warn('Straight-away reprint error:', e);
    }
  };

  const handleReprintTicket = (ticket: KitchenOrderTicket) => {
    if (!canReprintBills) {
      setKotCancelNotice('Reprinting KOT/BOT slips is restricted for your staff role.');
      setTimeout(() => setKotCancelNotice(null), 3500);
      return;
    }
    executeWithPinIfRequired(
      {
        title: `Enter PIN to Reprint ${ticket.kotNumber}`,
        detail: `${ticket.ticketType || 'KOT'} • Table ${ticket.tableNumber}`,
        accent: 'amber'
      },
      () => performReprintTicket(ticket)
    );
  };

  // Preview slip modal only if user explicitly clicks View Slip
  const handleViewTicketSlip = (ticket: KitchenOrderTicket) => {
    const isBar = ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT';
    if (isBar) {
      setSlipModalBarTicket(ticket);
      setSlipModalKitchenTicket(null);
      setSlipModalStation('bar');
    } else {
      setSlipModalKitchenTicket(ticket);
      setSlipModalBarTicket(null);
      setSlipModalStation('kitchen');
    }
    setSlipModalOpen(true);
  };

  // Manage Table Execution (Transfer, Merge, Swap, or Save Details)
  const performExecuteTableManage = async () => {
    if (!activeDiningTable || isExecutingManage) return;
    if (!canUpdateOrder) {
      setManageNotice('Modifying or transferring table orders is restricted for your staff role.');
      return;
    }

    if (manageTab === 'details') {
      setIsExecutingManage(true);
      try {
        await assignTableGuests(activeDiningTable.id, tempGuestCount, tempWaiterName);
        setShowManageTableModal(false);
      } catch (err) {
        console.error('Error saving table details:', err);
      } finally {
        setIsExecutingManage(false);
      }
      return;
    }

    if (!targetTableId || targetTableId === activeDiningTable.id) {
      setManageNotice(`Please select a different destination table to ${manageTab}.`);
      return;
    }

    const sourceTableSnapshot = activeDiningTable;
    const targetTableSnapshot = diningTables.find(t => t.id === targetTableId);
    if (!targetTableSnapshot) {
      setManageNotice('Destination table could not be found.');
      return;
    }

    setIsExecutingManage(true);
    setManageNotice('');

    // Prevent auto-save effect from running with stale cart while transitioning tables
    if (hydratingTimerRef.current) {
      clearTimeout(hydratingTimerRef.current);
      hydratingTimerRef.current = null;
    }
    isHydratingRef.current = true;

    // Pass current in-memory cart directly so transition executes atomically with zero draft race
    const sourceDraftOverride = {
      cart,
      kitchenSpecialNotes,
      discountType,
      discountInput
    };

    const hydrateTargetDraft = () => {
      const targetDraft = getTableDraft(targetTableId);
      if (targetDraft && Array.isArray(targetDraft.cart) && targetDraft.cart.length > 0) {
        setCart(targetDraft.cart.map(item => ({
          ...item,
          availableStock: item.availableStock ?? 50,
          orderRoutingStation: item.orderRoutingStation || (item as any).routingStation
        })));
        setKitchenSpecialNotes(targetDraft.kitchenSpecialNotes || '');
        setDiscountType(targetDraft.discountType || 'percent');
        setDiscountInput(targetDraft.discountInput || '0');
      } else {
        setCart([]);
        setKitchenSpecialNotes('');
        setDiscountInput('0');
      }
      scheduleEndHydration(140);
    };

    try {
      let success = false;
      let actionBanner = '';

      if (manageTab === 'transfer') {
        success = await transferTable(sourceTableSnapshot.id, targetTableId, sourceDraftOverride);
        if (success) {
          actionBanner = `✓ Transferred Table ${sourceTableSnapshot.tableNumber} → Table ${targetTableSnapshot.tableNumber}`;
        } else {
          setManageNotice('Failed to transfer table. Please check destination table.');
        }
      } else if (manageTab === 'merge') {
        success = await mergeTables(sourceTableSnapshot.id, targetTableId, sourceDraftOverride);
        if (success) {
          actionBanner = `✓ Merged Table ${sourceTableSnapshot.tableNumber} + Table ${targetTableSnapshot.tableNumber} into Table ${targetTableSnapshot.tableNumber}`;
        } else {
          setManageNotice('Failed to merge tables. Please try again.');
        }
      } else if (manageTab === 'swap') {
        success = await swapTables(sourceTableSnapshot.id, targetTableId, sourceDraftOverride);
        if (success) {
          actionBanner = `✓ Swapped orders: Table ${sourceTableSnapshot.tableNumber} ⇆ Table ${targetTableSnapshot.tableNumber}`;
        } else {
          setManageNotice('Failed to swap tables. Please try again.');
        }
      }

      if (success) {
        setShowManageTableModal(false);
        setTargetTableId('');

        // Clear any stale cached session invoice key for moved/merged/swapped tables
        setSessionInvoiceMap(prev => {
          const next = { ...prev };
          delete next[sourceTableSnapshot.id];
          delete next[targetTableId];
          return next;
        });

        // Align floor plan active floor with the destination table's floor
        const destFloorId = targetTableSnapshot.floorId || floors.find(f => f.name === targetTableSnapshot.floorName)?.id;
        if (destFloorId) {
          setActiveFloorId(destFloorId);
          setActiveSectionId('ALL');
          setFloorStatusFilter('all');
        }

        hydrateTargetDraft();
        if (actionBanner) {
          setKotSuccessBanner(actionBanner);
          setTimeout(() => setKotSuccessBanner(null), 4000);
        }
      } else {
        isHydratingRef.current = false;
      }
    } catch (err) {
      console.error('Error managing table:', err);
      setManageNotice('An error occurred during table operation.');
      isHydratingRef.current = false;
    } finally {
      setIsExecutingManage(false);
    }
  };

  const handleExecuteTableManage = () => {
    if (!activeDiningTable || isExecutingManage) return;
    if (!canUpdateOrder) {
      setManageNotice('Modifying or transferring table orders is restricted for your staff role.');
      return;
    }
    if (manageTab !== 'details') {
      if (!targetTableId || targetTableId === activeDiningTable.id) {
        setManageNotice(`Please select a different destination table to ${manageTab}.`);
        return;
      }
      if (!diningTables.find(t => t.id === targetTableId)) {
        setManageNotice('Destination table could not be found.');
        return;
      }
    }

    const actionVerb =
      manageTab === 'transfer'
        ? 'Transfer'
        : manageTab === 'merge'
        ? 'Merge'
        : manageTab === 'swap'
        ? 'Swap'
        : 'Update';

    executeWithPinIfRequired(
      {
        title: `Enter PIN to ${actionVerb} Table`,
        detail: `Table ${activeDiningTable.tableNumber}`,
        accent: 'indigo'
      },
      performExecuteTableManage
    );
  };

  // TABLE CLICK ACTION ON INTERACTIVE FLOOR CANVAS
  const handleCanvasTableClick = (table: DiningTable) => {
    setFloorRestrictionNotice(null);
    if (table.status === 'available') {
      if (!canCreateOrder) {
        setFloorRestrictionNotice('Opening new tables / creating orders is restricted for your staff role.');
        setTimeout(() => setFloorRestrictionNotice(null), 4000);
        return;
      }
      // Table is empty: open quick guest count prompt
      setPendingGuestTable(table);
      setGuestCountInput(table.capacity || 2);
      setWaiterInput(resolveTableWaiter(table.assignedWaiter));
    } else {
      // Table is already seated, cooking, or in draft: immediately open its order
      setSelectedTableId(table.id);
      setIsTakeawayMode(false);
    }
  };

  const handleConfirmGuestCount = async () => {
    if (!pendingGuestTable || !canCreateOrder) return;
    await assignTableGuests(pendingGuestTable.id, guestCountInput, waiterInput);
    setSelectedTableId(pendingGuestTable.id);
    setIsTakeawayMode(false);
    setPendingGuestTable(null);
  };

  const handleSwitchBackToFloorPlan = () => {
    setSelectedTableId(null);
    setIsTakeawayMode(false);
    setIsSettlingBill(false);
    setSearchQuery('');
  };

  // =========================================================================
  // SCREEN 1: INTERACTIVE FLOOR PLAN CANVAS VIEW (Shown first if no table selected)
  // =========================================================================
  if (!selectedTableId && !isTakeawayMode) {
    return (
      <div className="space-y-3 max-w-7xl mx-auto select-none">
        
        {/* FLOOR CANVAS TOP CONTROL BAR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs space-y-2">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                Restaurant Floor Plan
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Takeaway Button */}
              <button
                type="button"
                disabled={!canCreateOrder}
                onClick={() => {
                  if (!canCreateOrder) return;
                  setSelectedTableId(null);
                  setIsTakeawayMode(true);
                }}
                title={!canCreateOrder ? 'Order creation is restricted for your role' : 'Start Quick Takeaway / Counter order'}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-2xs ${
                  !canCreateOrder
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                    : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800 cursor-pointer'
                }`}
              >
                <ShoppingBag className={`w-3.5 h-3.5 ${!canCreateOrder ? 'text-slate-400' : 'text-amber-600'}`} />
                <span>Quick Takeaway / Counter (No Table)</span>
              </button>
            </div>
          </div>

          {floorRestrictionNotice && (
            <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{floorRestrictionNotice}</span>
            </div>
          )}

          {/* FLOORS & SECTIONS ROW */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Floor Tabs */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Floor:</span>
              </span>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1.5 py-1 -mx-1.5">
                {floors.map(flr => (
                  <button
                    key={flr.id}
                    type="button"
                    onClick={() => {
                      setActiveFloorId(flr.id);
                      setActiveSectionId('ALL');
                    }}
                    className={`px-3.5 sm:px-4 py-1.5 min-h-[36px] rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border-2 ${
                      currentFloor?.id === flr.id
                        ? 'bg-blue-600 text-white border-amber-400 shadow-md shadow-blue-500/25'
                        : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {flr.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sections (if any) */}
            {activeFloorSections.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0">Section:</span>
                <button
                  type="button"
                  onClick={() => setActiveSectionId('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    activeSectionId === 'ALL'
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                {activeFloorSections.map(sec => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      activeSectionId === sec.id
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* INTERACTIVE 2D FLOOR PLAN CANVAS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <InteractiveFloorCanvas
            tables={canvasFloorTables}
            selectedTableId={null}
            onSelectTable={() => {}}
            mode="pos"
            onTableActionClick={handleCanvasTableClick}
            snapToGrid={false}
            setSnapToGrid={() => {}}
            headerLeftContent={
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setFloorStatusFilter('all')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    floorStatusFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({floorStats.all})
                </button>

                <button
                  type="button"
                  onClick={() => setFloorStatusFilter('available')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    floorStatusFilter === 'available'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Available ({floorStats.available})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFloorStatusFilter('cooking')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    floorStatusFilter === 'cooking'
                      ? 'bg-amber-500 text-white font-black'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Cooking ({floorStats.cooking})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFloorStatusFilter('draft')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    floorStatusFilter === 'draft'
                      ? 'bg-rose-600 text-white font-black shadow-xs ring-1 ring-rose-400/50'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Drafts ({floorStats.draft})</span>
                </button>
              </div>
            }
          />
        </div>

        {/* QUICK GUEST PROMPT MODAL WHEN CLICKING AN AVAILABLE TABLE */}
        {pendingGuestTable && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Open Table {pendingGuestTable.tableNumber}
                  </h3>
                  <p className="text-3xs text-slate-500">
                    {currentFloor?.name} • Capacity: {pendingGuestTable.capacity} seats
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingGuestTable(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
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
                      onClick={() => setGuestCountInput(cnt)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        guestCountInput === cnt
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cnt} {cnt === 1 ? 'Guest' : 'Guests'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff / Waiter */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Assigned Staff / Waiter
                </label>
                <select
                  value={waiterInput}
                  onChange={(e) => setWaiterInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-hidden"
                >
                  <option value={operatorName}>
                    {operatorName} (Current Staff)
                  </option>
                  {staffMembers.filter(s => s.name !== operatorName).map(staff => (
                    <option key={staff.id} value={staff.name}>
                      {staff.name} ({staff.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPendingGuestTable(null)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmGuestCount}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Proceed to Menu</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Success / Receipt Modal */}
        {renderCompletedInvoiceModal()}

      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: MENU SELECTION & TABLE ORDER TICKET (Exact Match to User Sketch)
  // =========================================================================
  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full max-w-[1600px] mx-auto select-none items-start px-1 sm:px-3">
      
      {/* LEFT PANEL: MENU & ITEM SELECTION */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 w-full">
        
        {/* 1. TOP BAR: [ Back to Floor Plan ] + Spacious Search Bar with '/' Shortcut */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs flex items-center gap-3 shrink-0">
          {/* Back to Floor Canvas Button */}
          <button
            type="button"
            onClick={handleSwitchBackToFloorPlan}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap border border-slate-200 dark:border-slate-700"
            title="Return to visual floor layout"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>Floor Plan</span>
          </button>

          {/* Search Bar with Instant Typo Tolerance & '/' Quick Key */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search dishes (e.g. momo, biryani, beer, SKU)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                }
              }}
              autoComplete="off"
              spellCheck="false"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-10 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                title="Clear search (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd
                title="Quick access: press '/' on keyboard"
                className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none select-none shadow-2xs"
              >
                /
              </kbd>
            )}
          </div>
        </div>

        {/* =========================================================================
            UNIFIED CATEGORIES & DEPARTMENTS CONTAINER (WHOLE ROW CLICKABLE TO COLLAPSE/EXPAND)
            ========================================================================= */}
        {isMenuFiltersCollapsed ? (
          /* COLLAPSED BAR: ENTIRE ROW IS CLICKABLE TO EXPAND */
          <div
            onClick={() => setIsMenuFiltersCollapsed(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsMenuFiltersCollapsed(false);
              }
            }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-xs flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-blue-300 dark:hover:border-blue-700/60 transition-all select-none group"
            title="Click anywhere on this row to expand menu category filters"
            aria-expanded="false"
          >
            <div className="flex items-center gap-2 min-w-0 pointer-events-none">
              <div className="flex items-center gap-1.5 text-3xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider shrink-0">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Filters & Categories</span>
              </div>
              
              {/* Active filter summary pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
                {selectedDepartment !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-3xs font-bold whitespace-nowrap">
                    Dept: {selectedDepartment}
                  </span>
                )}
                {selectedCategory !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-3xs font-bold whitespace-nowrap">
                    {selectedCategory}
                  </span>
                )}
                {selectedSubCategory !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-3xs font-bold whitespace-nowrap">
                    {selectedSubCategory}
                  </span>
                )}
                {selectedPrepStyle !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-3xs font-bold whitespace-nowrap">
                    {selectedPrepStyle}
                  </span>
                )}
                {selectedDepartment === 'ALL' && selectedCategory === 'ALL' && selectedSubCategory === 'ALL' && selectedPrepStyle === 'ALL' && (
                  <span className="text-3xs text-slate-500 dark:text-slate-400 font-medium">
                    (All Dishes)
                  </span>
                )}
              </div>
            </div>

            {/* Right corner actions: Reset (if any active) + Expand Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {(selectedDepartment !== 'ALL' || selectedCategory !== 'ALL' || selectedSubCategory !== 'ALL' || selectedPrepStyle !== 'ALL') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDepartment('ALL');
                    setSelectedCategory('ALL');
                    setSelectedSubCategory('ALL');
                    setSelectedPrepStyle('ALL');
                  }}
                  className="text-3xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer px-1.5 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/60 pointer-events-auto"
                >
                  Reset
                </button>
              )}
              <span className="text-3xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors pointer-events-none">
                Expand
              </span>
              <div 
                className="p-1 rounded-lg text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors pointer-events-none"
                aria-hidden="true"
              >
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
          /* EXPANDED CONTAINER: UNIFIED CARD WITH ROOT DEPT, CATEGORY, SUB-CATEGORY & PREP-STYLE */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2.5 transition-all">
            {/* COLLAPSE HEADER ROW (WHOLE ROW CLICKABLE TO COLLAPSE FILTERS) */}
            <div
              onClick={() => setIsMenuFiltersCollapsed(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMenuFiltersCollapsed(true);
                }
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 -mx-1 -mt-1 rounded-xl cursor-pointer select-none hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-all border-b border-slate-100 dark:border-slate-800/80 group"
              title="Click anywhere on this row to collapse filters"
              aria-expanded="true"
            >
              <div className="flex items-center gap-2 pointer-events-none min-w-0">
                <span className="text-3xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Filters & Categories</span>
                </span>
              </div>

              {/* Right side: Reset (with stopPropagation) + Collapse icon & label */}
              <div className="flex items-center gap-2 shrink-0">
                {(selectedDepartment !== 'ALL' || selectedCategory !== 'ALL' || selectedSubCategory !== 'ALL' || selectedPrepStyle !== 'ALL') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDepartment('ALL');
                      setSelectedCategory('ALL');
                      setSelectedSubCategory('ALL');
                      setSelectedPrepStyle('ALL');
                    }}
                    className="text-3xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer px-1.5 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/60 pointer-events-auto"
                  >
                    Reset All
                  </button>
                )}
                <span className="text-3xs font-semibold text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors pointer-events-none">
                  Collapse
                </span>
                <div className="p-1 rounded-md text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors pointer-events-none">
                  <ChevronUp className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </div>
              </div>
            </div>

            {/* 1. ROOT DEPARTMENT SLIDER ROW (Only real departments from products) */}
            {departments.length > 1 && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <ChefHat className="w-3 h-3 text-blue-600" />
                    <span>Root Department</span>
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => scrollFilterRow(deptScrollRef, -180)}
                    className="shrink-0 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    title="Scroll left"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div ref={deptScrollRef} className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                    {departments.map(dept => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => {
                          setSelectedDepartment(dept);
                          if (dept !== selectedDepartment) {
                            setSelectedCategory('ALL');
                            setSelectedSubCategory('ALL');
                            setSelectedPrepStyle('ALL');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                          selectedDepartment === dept
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollFilterRow(deptScrollRef, 180)}
                    className="shrink-0 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    title="Scroll right"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 2. CATEGORY SLIDER ROW (Only real categories from products) */}
            {categories.length > 1 && (
              <div className={`space-y-1.5 ${departments.length > 1 ? 'pt-2 border-t border-slate-100 dark:border-slate-800/80' : 'pt-0.5'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3 h-3 text-blue-600" />
                    <span>Category</span>
                  </span>
                  
                  {selectedCategory !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('ALL');
                        setSelectedSubCategory('ALL');
                        setSelectedPrepStyle('ALL');
                      }}
                      className="text-3xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => scrollFilterRow(catScrollRef, -200)}
                    className="shrink-0 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    title="Scroll left"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div ref={catScrollRef} className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          if (cat !== selectedCategory) {
                            setSelectedSubCategory('ALL');
                            setSelectedPrepStyle('ALL');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                          selectedCategory === cat
                            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollFilterRow(catScrollRef, 200)}
                    className="shrink-0 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    title="Scroll right"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 3. SUB - CATEGORY ROW (Only real sub-categories if present) */}
            {subCategories.length > 1 && (
              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  Sub - Category
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => scrollFilterRow(subCatScrollRef, -200)}
                    className="shrink-0 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    title="Scroll left"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div ref={subCatScrollRef} className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                    {subCategories.map(sc => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => {
                          setSelectedSubCategory(sc);
                          if (sc !== selectedSubCategory) {
                            setSelectedPrepStyle('ALL');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                          selectedSubCategory === sc
                            ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {sc}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollFilterRow(subCatScrollRef, 200)}
                    className="shrink-0 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    title="Scroll right"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 4. PREP - STYLE ROW (Only real prep styles if present) */}
            {prepStyles.length > 1 && (
              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  Prep - style
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => scrollFilterRow(prepScrollRef, -200)}
                    className="shrink-0 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    title="Scroll left"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div ref={prepScrollRef} className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                    {prepStyles.map(ps => (
                      <button
                        key={ps}
                        type="button"
                        onClick={() => setSelectedPrepStyle(ps)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                          selectedPrepStyle === ps
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {ps}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollFilterRow(prepScrollRef, 200)}
                    className="shrink-0 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                    title="Scroll right"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRODUCT CARD GRID CONTAINER (DISPLAYS 3 ROWS AT A TIME WITH DYNAMIC EXPANSION VIA SHOW MORE) */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-sm flex flex-col gap-3">
          
          {/* PRODUCT CARD GRID WITH DEDICATED "ADD ON" BUTTON */}
          <div className="flex-1 pr-1">
            {/* ACTIVE SEARCH STATUS (ONLY SHOWN WHEN SEARCHING TO SAVE VERTICAL SPACE) */}
            {searchQuery.trim() && (
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-3xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                    "{searchQuery.trim()}"
                  </span>
                  {searchCorrectedTerms && searchCorrectedTerms.length > 0 && (
                    <span className="text-3xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                      matched: {searchCorrectedTerms.join(', ')}
                    </span>
                  )}
                  {isGlobalSearch && (
                    <span className="text-3xs text-amber-600 dark:text-amber-400 font-semibold">
                      • Searching all categories
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-3xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400">
                <UtensilsCrossed className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {searchQuery.trim() ? `No dishes found for "${searchQuery.trim()}"` : 'No matching dishes'}
                </p>
                <p className="text-3xs text-slate-400 max-w-xs mt-0.5">
                  {searchQuery.trim()
                    ? 'Try searching broader terms like "momo", "chicken", "biryani", "chowmein", "beer" or SKU'
                    : 'Try changing department, category, or sub-category filter'}
                </p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3 gap-3">
                {displayedProducts.map(product => {
                  const customerPrice = getProductPriceForCustomer(product, selectedCustomer);
                  const isOutOfStock = isProductOutOfStock(product);
                  const vatLabel = getProductVatBadgeLabel(product, settings);
                  const inCartCount = cart
                    .filter(c => c.productId === product.id)
                    .reduce((sum, c) => sum + c.quantity, 0);

                  const isLockedAdd = isOutOfStock || !canCreateOrder;
                  return (
                    <div
                      key={product.id}
                      onClick={() => !isLockedAdd && addToCart(product)}
                      className={`relative overflow-hidden p-3 rounded-2xl border-2 text-left flex flex-col justify-between transition-all duration-150 select-none ${
                        isLockedAdd
                          ? 'opacity-50 border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40'
                          : inCartCount > 0
                          ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/30 shadow-xs cursor-pointer active:scale-98'
                          : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 bg-white dark:bg-slate-900 shadow-2xs cursor-pointer active:scale-98'
                      }`}
                    >
                      {/* Top Info */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-3xs font-mono text-slate-400">
                            {product.sku}
                          </span>
                          {isOutOfStock ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[9px]">
                              Out of Stock
                            </span>
                          ) : inCartCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-3xs flex items-center justify-center">
                              {inCartCount}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                          {product.name}
                        </h4>

                        <div className="flex items-baseline justify-between gap-1">
                          <div className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                            {formatNPR(customerPrice)}
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                            {vatLabel}
                          </span>
                        </div>
                      </div>

                      {/* Card Action: Dedicated "Add on" Button */}
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          disabled={isLockedAdd}
                          onClick={(e) => handleOpenAddonModal(product, e)}
                          className={`px-2.5 py-1 rounded-lg text-3xs font-bold border transition-colors flex items-center gap-1 ${
                            isLockedAdd
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer'
                          }`}
                          title={isOutOfStock ? 'Out of stock' : !canCreateOrder ? 'Order creation restricted' : 'Configure modifiers & add-ons'}
                        >
                          <Plus className={`w-2.5 h-2.5 ${isLockedAdd ? 'text-slate-400' : 'text-blue-600 dark:text-blue-400'}`} />
                          <span>Add on</span>
                        </button>

                        <button
                          type="button"
                          disabled={isLockedAdd}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLockedAdd) addToCart(product);
                          }}
                          className={`px-2 py-1 rounded-lg text-3xs font-bold transition-colors ${
                            isLockedAdd
                              ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                          }`}
                        >
                          + Add
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* COMPACT ITEM VISIBILITY & SHOW MORE CONTROLS (SHOWING - OF - ITEMS | SHOW MORE | SHOW ALL() | COLLAPSE ICON) */}
            {(filteredProducts.length > gridColumns * 3 || visibleProductRows > 3) && (
              <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Showing {displayedProducts.length} of {filteredProducts.length} items
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={displayedProducts.length >= filteredProducts.length}
                    onClick={() => setVisibleProductRows(prev => prev + 3)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      displayedProducts.length < filteredProducts.length
                        ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xs cursor-pointer'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    Show More
                  </button>

                  <button
                    type="button"
                    disabled={displayedProducts.length >= filteredProducts.length}
                    onClick={() => setVisibleProductRows(Math.ceil(filteredProducts.length / gridColumns))}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      displayedProducts.length < filteredProducts.length
                        ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 cursor-pointer'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    Show All ({filteredProducts.length})
                  </button>

                  <button
                    type="button"
                    disabled={visibleProductRows <= 3}
                    onClick={() => setVisibleProductRows(3)}
                    title={visibleProductRows > 3 ? "Collapse back to 3 rows" : "Already showing 3 rows"}
                    className={`p-1.5 rounded-xl transition-all flex items-center justify-center ${
                      visibleProductRows > 3
                        ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 cursor-pointer shadow-xs'
                        : 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                    }`}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* RIGHT PANEL: DYNAMIC TABLE ORDER TICKET & SETTLE BILL CONTAINER (EXPANDS NATURALLY AS ORDERS PILE UP) */}
      <div className={`w-full lg:w-[460px] xl:w-[490px] 2xl:w-[520px] bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shrink-0 flex flex-col shadow-lg lg:sticky lg:top-3 ${
        isSettlingBill 
          ? 'h-auto max-h-[calc(100vh-3rem)]' 
          : 'h-auto'
      }`}>
        
        {isSettlingBill ? (
          /* =========================================================================
             SETTLE BILL & PAYMENT VIEW (PINNED COMPLETE SALE FOOTER, NO SCROLL TO SETTLE)
             ========================================================================= */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Top Bar: Back to order & Table/Takeaway info */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsSettlingBill(false)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Back to Order</span>
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway'}
                </span>
                <span className="text-3xs text-slate-400 font-mono">
                  {totalBillItemsCount} {totalBillItemsCount === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            {/* Settle Bill Inputs Form (Scrollable within viewport) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
              
              {/* 1. AMOUNT RECEIVED */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider">
                    AMOUNT RECEIVED
                  </label>
                  {paymentMethod !== 'split' && (
                    <button
                      type="button"
                      onClick={() => setPaidAmountInput(String(grandTotal))}
                      className="text-3xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Exact (Rs. {grandTotal})
                    </button>
                  )}
                </div>
                {paymentMethod === 'split' ? (
                  <div className="flex items-center justify-between border border-blue-200 dark:border-blue-800/70 rounded-lg bg-blue-50/40 dark:bg-blue-950/30 px-3 py-1.5">
                    <span className="text-2xs font-semibold text-blue-700 dark:text-blue-300">
                      Split Total
                    </span>
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                      {formatNPR(paidAmountNumber)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/30">
                    <span className="text-slate-400 font-mono text-xs mr-2">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      placeholder="0"
                      className="w-full text-right font-mono font-black text-sm text-slate-900 dark:text-slate-100 outline-hidden bg-transparent"
                    />
                  </div>
                )}
                {isPaidAmountProvided && paidAmountNumber > grandTotal && (
                  <div className="text-3xs font-bold text-emerald-600 flex justify-between px-1">
                    <span>Change to Return:</span>
                    <span className="font-mono">{formatNPR(changeToReturn)}</span>
                  </div>
                )}
                {isPaidAmountProvided && paidAmountNumber < grandTotal && paidAmountNumber > 0 && (
                  <div className="text-3xs font-bold text-amber-600 flex justify-between px-1">
                    <span>Remaining Due:</span>
                    <span className="font-mono">{formatNPR(dueAmount)}</span>
                  </div>
                )}
              </div>

              {/* 2. PAYMENT METHOD */}
              <div className="space-y-1.5">
                <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                  PAYMENT METHOD
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'fonepay', label: 'Fonepay' },
                    { id: 'split', label: 'Split' },
                    { id: 'credit', label: 'Credit (बाँकी)' },
                  ].map(pm => {
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          const nextPm = pm.id as typeof paymentMethod;
                          setPaymentMethod(nextPm);
                          if (nextPm === 'credit' && Number(paidAmountInput) >= grandTotal) {
                            setPaidAmountInput('');
                          } else if (nextPm !== 'credit' && nextPm !== 'split' && paidAmountInput.trim() === '0') {
                            setPaidAmountInput('');
                          }
                        }}
                        className={`py-1.5 px-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center whitespace-nowrap ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500 shadow-2xs ring-1 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        {pm.label}
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-2 gap-2 pt-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-3xs font-bold text-slate-600 dark:text-slate-300">
                          Cash (Rs.)
                        </label>
                        {grandTotal > splitFonepayNumber && (
                          <button
                            type="button"
                            onClick={() => setSplitCashInput(String(Math.max(0, Math.round((grandTotal - splitFonepayNumber) * 100) / 100)))}
                            className="text-3xs font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                          >
                            Rest ({Math.max(0, Math.round((grandTotal - splitFonepayNumber) * 100) / 100)})
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={splitCashInput}
                        onChange={(e) => setSplitCashInput(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-3xs font-bold text-slate-600 dark:text-slate-300">
                          Fonepay (Rs.)
                        </label>
                        {grandTotal > splitCashNumber && (
                          <button
                            type="button"
                            onClick={() => setSplitFonepayInput(String(Math.max(0, Math.round((grandTotal - splitCashNumber) * 100) / 100)))}
                            className="text-3xs font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                          >
                            Rest ({Math.max(0, Math.round((grandTotal - splitCashNumber) * 100) / 100)})
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={splitFonepayInput}
                        onChange={(e) => setSplitFonepayInput(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>

                    {isSplitInvalid && (
                      <p className="col-span-2 text-3xs font-semibold text-amber-600 dark:text-amber-400">
                        Enter amounts for both Cash and Fonepay.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. DISCOUNT */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                    DISCOUNT
                  </label>
                  {currentOperator && (
                    <span className={`text-3xs font-bold ${!canApplyDiscounts ? 'text-rose-500' : maxDiscountPercent < 100 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                      {!canApplyDiscounts ? 'Restricted' : maxDiscountPercent < 100 ? `Max ${maxDiscountPercent}%` : ''}
                    </span>
                  )}
                </div>
                <div className={`flex items-center border rounded-lg overflow-hidden ${
                  !canApplyDiscounts
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 opacity-60'
                    : isDiscountOverLimit
                    ? 'border-rose-400 dark:border-rose-700 bg-rose-50/40 dark:bg-rose-950/30 ring-1 ring-rose-400/50'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500/30'
                }`}>
                  <div className="px-2.5 text-slate-400 font-mono text-xs">
                    {discountType === 'percent' ? '%' : 'Rs.'}
                  </div>
                  <input
                    type="number"
                    min="0"
                    disabled={!canApplyDiscounts}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="0"
                    className="flex-1 py-1 text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100 outline-hidden bg-transparent pr-2 disabled:cursor-not-allowed"
                  />
                  <div className="flex p-0.5 gap-0.5 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <button
                      type="button"
                      disabled={!canApplyDiscounts}
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-0.5 rounded text-2xs font-bold cursor-pointer transition-colors disabled:cursor-not-allowed ${
                        discountType === 'percent'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      disabled={!canApplyDiscounts}
                      onClick={() => setDiscountType('rs')}
                      className={`px-2 py-0.5 rounded text-2xs font-bold cursor-pointer transition-colors disabled:cursor-not-allowed ${
                        discountType === 'rs'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      Rs
                    </button>
                  </div>
                </div>
                {isDiscountOverLimit && (
                  <p className="text-3xs font-bold text-rose-600 dark:text-rose-400">
                    {!canApplyDiscounts
                      ? 'Your staff permissions do not allow applying bill discounts.'
                      : `Discount (${effectiveDiscountPercent.toFixed(1)}%) exceeds your role cap of ${maxDiscountPercent}%.`}
                  </p>
                )}
              </div>

              {/* 4. CUSTOMER */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                    CUSTOMER
                  </label>
                  {isWalkInCreditBlocked && (
                    <span className="text-3xs font-bold text-rose-600 dark:text-rose-400">
                      Named Customer Required
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className={`flex-1 bg-white dark:bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-hidden truncate focus:ring-2 ${
                      isWalkInCreditBlocked
                        ? 'border-rose-400 dark:border-rose-600 ring-1 ring-rose-400/50 focus:ring-rose-500/30'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/30'
                    }`}
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerType})
                      </option>
                    ))}
                  </select>
                  {canCreateCustomer && (
                    <button
                      type="button"
                      onClick={() => setShowAddCustomerModal(true)}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs transition-colors ${
                        isWalkInCreditBlocked
                          ? 'border-blue-500 bg-blue-600 text-white hover:bg-blue-700'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <UserPlus className={`w-3.5 h-3.5 ${isWalkInCreditBlocked ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Pinned Bottom Bar: Settle Bill Summary & Complete Action */}
            <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 space-y-2 mt-auto">
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Menu Subtotal:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(subtotal)}</span>
                </div>

                {grossDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">-{formatNPR(grossDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Taxable Base (Ex-VAT):</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(taxableAmount)}</span>
                </div>

                <div className="flex justify-between text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>VAT ({defaultVatRate}%):</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold">
                      Included
                    </span>
                  </div>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(taxAmount)}</span>
                </div>

                <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline font-black">
                  <span className="text-xs uppercase text-slate-900 dark:text-slate-100">Total Payable:</span>
                  <span className="text-sm font-mono text-blue-600 dark:text-blue-400 font-extrabold">
                    {formatNPR(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Complete Sale Button */}
              <button
                type="button"
                onClick={handleFinalCompleteSaleAndPrint}
                disabled={allBillItems.length === 0 || isCompletingSale || !canSettleBill || isDiscountOverLimit || isWalkInCreditBlocked || isSplitInvalid}
                title={
                  !canSettleBill
                    ? 'Bill settlement permission required'
                    : isDiscountOverLimit
                    ? `Discount exceeds your allowed cap (${maxDiscountPercent}%)`
                    : isWalkInCreditBlocked
                    ? walkInCreditWarning
                    : isSplitInvalid
                    ? 'Enter amounts for both Cash and Fonepay'
                    : 'Complete sale and print receipt'
                }
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  allBillItems.length === 0 || isCompletingSale || !canSettleBill || isDiscountOverLimit || isWalkInCreditBlocked || isSplitInvalid
                    ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow active:scale-[0.99]'
                }`}
              >
                <Check className={`w-4 h-4 ${allBillItems.length === 0 || isCompletingSale || !canSettleBill || isDiscountOverLimit || isWalkInCreditBlocked || isSplitInvalid ? 'text-slate-400 dark:text-slate-600' : 'text-white'}`} />
                <span>
                  {isCompletingSale
                    ? 'Completing Sale & Printing...'
                    : isWalkInCreditBlocked
                    ? 'Select or Add Customer for Credit'
                    : isSplitInvalid
                    ? 'Enter Cash & Fonepay Amounts'
                    : 'Complete Sale & Print Receipt'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================================
             STANDARD ORDER TICKET PANEL (NATURAL VERTICAL EXPANSION AS ORDERS PILE UP)
             ========================================================================= */
          <div className="flex flex-col">
            {/* TICKET TOP HEADER: Formatted unified table information, management and routing summary */}
            <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 shrink-0 space-y-1.5">
              {/* Row 1: table name              (Manage)                 (fire button) */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={handleSwitchBackToFloorPlan}
                    className="w-6 h-6 rounded-lg bg-slate-200/80 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/60 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors shrink-0"
                    title="Switch Table (Back to Floor Layout)"
                  >
                    ✕
                  </button>
                  <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                    {activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway'}
                  </span>
                  {activeDiningTable && (
                    <>
                      {(canUpdateOrder || canVoidOrderItem) && (
                        <button
                          type="button"
                          onClick={() => {
                            // Flush in-memory cart to draft so Manage operations operate on latest items
                            if (cart.length > 0 && activeDiningTable) {
                              saveTableDraft(activeDiningTable.id, {
                                cart,
                                kitchenSpecialNotes,
                                discountType,
                                discountInput
                              });
                            }
                            setManageTab(canUpdateOrder ? 'transfer' : 'dissolve');
                            setTargetTableId('');
                            setManageNotice('');
                            setManageFloorFilter('ALL');
                            setManageSearchQuery('');
                            setTempGuestCount(activeDiningTable.currentGuests || 2);
                            setTempWaiterName(resolveTableWaiter(activeDiningTable.assignedWaiter));
                            setShowManageTableModal(true);
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/90 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                          title="Manage Table: Transfer, Merge, Swap or Update Guests"
                        >
                          <ArrowLeftRight className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          <span>Manage</span>
                        </button>
                      )}

                      {isTableAllCancelled && canVoidOrderItem && (
                        <button
                          type="button"
                          onClick={() => handleConfirmDissolve('All orders cancelled')}
                          disabled={isDissolvingTable}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:text-slate-300 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 group disabled:opacity-50"
                          title={`All orders cancelled. Click to dissolve Table ${activeDiningTable.tableNumber} and make it available for new customers`}
                        >
                          <LogOut className="w-3 h-3 text-slate-500 group-hover:text-rose-600 dark:text-slate-400 dark:group-hover:text-rose-400 transition-colors" />
                          <span>{isDissolvingTable ? 'Dissolving...' : 'Dissolve'}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* (fire button) */}
                <button
                  type="button"
                  onClick={handleFireKOT}
                  disabled={!canCreateOrder || isFiringOrder || cart.length === 0 || (!activeDiningTable && !isTakeawayMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 ${
                    cart.length > 0 && canCreateOrder
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-blue-500/25 ring-2 ring-blue-400/30 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                  }`}
                  title={
                    !canCreateOrder
                      ? 'Firing orders is restricted for your staff role'
                      : cart.length > 0
                      ? "Send order to kitchen and print KOT ticket"
                      : activeTableTickets.length > 0
                      ? "First order is already fired to kitchen. Add dishes from menu to fire another round."
                      : "Select items from the menu to fire order"
                  }
                >
                  <ChefHat className={`w-3.5 h-3.5 ${isFiringOrder ? 'animate-spin' : ''}`} />
                  <span>
                    {isFiringOrder
                      ? 'Firing...'
                      : cart.length > 0 
                      ? totalFiredRounds > 0 ? `Fire R#${totalFiredRounds + 1} (${cart.reduce((s, i) => s + i.quantity, 0)})` : `Fire (${cart.reduce((s, i) => s + i.quantity, 0)})` 
                      : activeTableTickets.length > 0 
                      ? 'Fired ✓' 
                      : 'Fire Order'}
                  </span>
                </button>
              </div>

              {/* Row 2: (floor,section : people) */}
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {activeDiningTable ? (
                  `(${activeDiningTable.floorName || currentFloor?.name || 'Main Floor'}, ${activeDiningTable.sectionName || activeDiningTable.zoneName || 'Main Area'} : ${activeDiningTable.currentGuests || activeDiningTable.capacity || 2} ${((activeDiningTable.currentGuests || activeDiningTable.capacity || 2) === 1) ? 'person' : 'people'})`
                ) : (
                  '(Takeaway, Counter : 1 person)'
                )}
              </div>

              {/* Row 3: staff: name */}
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                staff: <span className="text-slate-700 dark:text-slate-200 font-semibold">{resolveTableWaiter(activeDiningTable?.assignedWaiter)}</span>
              </div>

              {/* Divider: ------------------- */}
              <div className="border-t border-slate-200 dark:border-slate-700/80 pt-1" />

              {/* Row 4: kitchen() Bar()                                      ()items */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300">
                    <ChefHat className="w-3.5 h-3.5 text-blue-500" />
                    <span>kitchen({totalKitchenItemsCount})</span>
                  </span>
                  <span className="flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300">
                    <Wine className="w-3.5 h-3.5 text-amber-500" />
                    <span>Bar({totalBarItemsCount})</span>
                  </span>
                </div>
                <div className="text-slate-700 dark:text-slate-200 font-mono font-bold flex items-center gap-1.5">
                  <span>
                    ({totalBillItemsCount}) {totalBillItemsCount === 1 ? 'item' : 'items'}
                  </span>
                  {activeDiningTable && totalDraftItemsCount > 0 && (
                    <span className="text-3xs font-bold text-blue-600 dark:text-blue-400">
                      (+{totalDraftItemsCount} draft)
                    </span>
                  )}
                </div>
              </div>

              {/* KOT success banner */}
              {kotSuccessBanner && (
                <div className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-3xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{kotSuccessBanner}</span>
                </div>
              )}

              {/* KOT item cancellation notice banner */}
              {kotCancelNotice && (
                <div className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-3xs font-bold flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <Trash2 className="w-3 h-3 text-rose-600 shrink-0" />
                    <span className="truncate">{kotCancelNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKotCancelNotice(null)}
                    className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 p-0.5 cursor-pointer text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* RUNNING ORDER ITEMS LIST (NATURALLY EXPANDS: BORDER ABOVE MENU SUBTOTAL GOES DOWN AS ORDERS PILE UP) */}
            <div className="p-3 space-y-2.5">
              {activeTableTickets.length === 0 && cart.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center p-4 text-slate-400">
                  <ShoppingCart className="w-8 h-8 opacity-30 mb-2 text-slate-400 dark:text-slate-500" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Ticket is empty</p>
                  <p className="text-3xs text-slate-400 mt-0.5 max-w-[220px]">
                    Select items from the menu on the left to start this table's order
                  </p>
                </div>
              ) : (
                <>


                  {/* 1. NEW ITEMS TO FIRE (DRAFT / NEW ROUND) - POSITIONED AT TOP FOR IMMEDIATE ACCESS & EDITING */}
                  {cart.length > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-xs font-black text-blue-800 dark:text-blue-200">
                          <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>
                            {`Order Round #${totalFiredRounds + 1} (${cart.reduce((s, i) => s + i.quantity, 0)} ${cart.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'items'})`}
                          </span>
                        </div>

                        {/* Clear action in the right corner */}
                        {(canCreateOrder || canUpdateOrder) && (
                          <button
                            type="button"
                            onClick={handleOpenClearDraft}
                            className="text-xs font-bold text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 underline cursor-pointer transition-colors px-1 py-0.5"
                            title="Discard all unsent draft items in this round"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-blue-200/90 dark:border-blue-900/60 bg-white dark:bg-slate-800/40 overflow-hidden shadow-2xs">
                        {cart.map((item, index) => {
                          const isBar = item.orderRoutingStation === 'bar';
                          return (
                            <div
                              key={`${item.productId}-${index}`}
                              className="p-2 sm:p-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors flex flex-col gap-1.5"
                            >
                              {/* Row Top: Sequence #, Station Indicator, Name, Unit Price, Void Button */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {/* (#1 in dark blue color) without box */}
                                      <span className="font-mono text-xs font-black text-blue-900 dark:text-blue-300 shrink-0">
                                        #{index + 1}.
                                      </span>

                                      {/* ((icon)Kitchen in blue color / (icon)Bar in orange color) */}
                                      <span className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 ${
                                        isBar 
                                          ? 'text-amber-600 dark:text-amber-400' 
                                          : 'text-blue-600 dark:text-blue-400'
                                      }`}>
                                        {isBar ? <Wine className="w-3.5 h-3.5" /> : <ChefHat className="w-3.5 h-3.5" />}
                                        <span>{isBar ? 'Bar' : 'Kitchen'}.</span>
                                      </span>

                                      {/* Item name */}
                                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {item.productName}
                                      </span>
                                    </div>

                                    <p className="text-3xs text-slate-400 font-mono mt-0.5">
                                      {formatNPR(item.unitPrice)} each
                                    </p>

                                    {/* Addons List display */}
                                    {item.addonsList && item.addonsList.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {item.addonsList.map((addon, aIdx) => (
                                          <span
                                            key={aIdx}
                                            className="text-3xs px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800"
                                          >
                                            +{addon.name} ({formatNPR(addon.price)})
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {item.itemNotes && (
                                      <p className="text-3xs text-blue-900 dark:text-blue-300 font-semibold italic mt-0.5">
                                        Note: {item.itemNotes}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Quick Delete / Remove draft item button (No PIN or void confirmation needed for unfired items) */}
                                {(canCreateOrder || canUpdateOrder) && (
                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(index)}
                                    title="Remove item"
                                    className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 cursor-pointer transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Row Bottom: Add on trigger + Tactile Stepper + Line Total */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                <button
                                  type="button"
                                  disabled={!canCreateOrder && !canUpdateOrder}
                                  onClick={() => setCustomizationTarget({ type: 'cart', index, item })}
                                  title={!canCreateOrder && !canUpdateOrder ? 'Editing order items is restricted' : 'Add or edit add-ons and kitchen notes'}
                                  className="px-1.5 py-0.5 rounded-lg text-3xs font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:hover:bg-blue-950/70 dark:hover:text-blue-300 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Add on</span>
                                </button>

                                <div className="flex items-center gap-3">
                                  {/* Quantity Stepper */}
                                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 overflow-hidden shadow-2xs">
                                    <button
                                      type="button"
                                      disabled={!canCreateOrder && !canUpdateOrder}
                                      onClick={() => updateQuantity(index, item.quantity - 1)}
                                      className="px-1.5 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Decrease quantity"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="w-6 text-center text-xs font-mono font-black text-slate-900 dark:text-slate-100">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={!canCreateOrder && !canUpdateOrder}
                                      onClick={() => updateQuantity(index, item.quantity + 1)}
                                      className="px-1.5 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Increase quantity"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Line Total */}
                                  <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100 min-w-[60px] text-right">
                                    {formatNPR(item.lineTotal)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. FIRED ORDERS SECTION (Running KOT / BOT orders already dispatched to kitchen/bar - Newest Rounds on Top) */}
                  {activeTableTickets.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-slate-200/80 dark:border-slate-800">
                      <div 
                        onClick={() => setIsFiredOrdersCollapsed(prev => !prev)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIsFiredOrdersCollapsed(prev => !prev);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-expanded={!isFiredOrdersCollapsed}
                        title={isFiredOrdersCollapsed ? "Expand fired orders" : "Collapse fired orders"}
                        className="flex items-center justify-between px-1.5 py-1.5 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors border-b border-slate-200/80 dark:border-slate-800 group focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
                          <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>
                            Fired Orders ({firedSaleItems.reduce((s, i) => s + i.quantity, 0)} {firedSaleItems.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'items'} · {activeTableTickets.length} {activeTableTickets.length === 1 ? 'ticket' : 'tickets'})
                          </span>
                          {isTableAllCancelled && (
                            <span className="text-3xs font-extrabold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              All Cancelled
                            </span>
                          )}
                        </div>

                        {/* Right side: corner collapse toggle */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isFiredOrdersCollapsed && (
                            <span className="text-3xs font-semibold text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              Expand orders
                            </span>
                          )}
                          <div 
                            className="p-1 rounded-md text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors inline-flex items-center justify-center"
                            aria-hidden="true"
                          >
                            {isFiredOrdersCollapsed ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronUp className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>
                      </div>

                      {!isFiredOrdersCollapsed && renderedTicketsWithRounds.map(({ ticket, roundNumber }) => {
                        const isLatestRound = totalFiredRounds > 1 && roundNumber === totalFiredRounds;
                        const elapsedMin = Math.max(0, Math.floor((currentTime - ticket.createdAt) / 60000));
                        const timeStr = new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isTicketCollapsed = collapsedTicketIds.has(ticket.id);
                        const activeTicketItems = ticket.items.filter(i => i.status !== 'cancelled');
                        const ticketItemsCount = activeTicketItems.reduce((s, i) => s + i.quantity, 0);

                        return (
                        <div 
                          key={ticket.id}
                          className="rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-2xs"
                        >
                          {/* Ticket Header: Sleek, tabular receipt header */}
                          <div className="p-2 bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-1.5 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-3xs font-extrabold px-1.5 py-0.5 rounded ${
                                isLatestRound 
                                  ? 'bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700' 
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}>
                                R{roundNumber}{isLatestRound ? ' · Latest' : ''}
                              </span>
                              <span className="font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap text-xs">
                                {ticket.kotNumber}
                              </span>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap text-2xs">
                                {ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT' ? (
                                  <>
                                    <Wine className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span>Bar</span>
                                  </>
                                ) : (
                                  <>
                                    <ChefHat className="w-3 h-3 text-blue-500 shrink-0" />
                                    <span>Kitchen</span>
                                  </>
                                )}
                              </span>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="inline-flex items-center gap-1 text-2xs font-semibold whitespace-nowrap">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  ticket.status === 'ready' 
                                    ? 'bg-emerald-500'
                                    : ticket.status === 'completed'
                                    ? 'bg-blue-500'
                                    : 'bg-amber-500'
                                }`} />
                                <span className={
                                  ticket.status === 'ready' 
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : ticket.status === 'completed'
                                    ? 'text-blue-700 dark:text-blue-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }>
                                  {ticket.status === 'ready' ? 'Ready' : ticket.status === 'completed' ? 'Served' : 'Cooking'}
                                </span>
                              </span>
                            </div>

                            {/* Right: Elapsed Time & Clean Reprint Button & Ticket Collapse */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span 
                                className="text-3xs text-slate-500 dark:text-slate-400 font-mono font-medium"
                                title={`Fired at ${timeStr}`}
                              >
                                {elapsedMin === 0 ? 'Just now' : `${elapsedMin}m ago`}
                              </span>
                              <button
                                type="button"
                                disabled={!canReprintBills}
                                onClick={() => handleReprintTicket(ticket)}
                                className="px-1.5 py-0.5 rounded-md text-3xs font-bold text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white bg-white hover:bg-slate-100 dark:bg-slate-700/80 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-600 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                                title={!canReprintBills ? 'Ticket reprinting restricted for your staff role' : 'View and print thermal ticket slip'}
                              >
                                <Printer className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                                <span>Print</span>
                                {ticket.printedCount && ticket.printedCount > 1 && (
                                  <span className="font-mono text-3xs text-slate-400">×{ticket.printedCount}</span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleTicketCollapse(ticket.id)}
                                className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-white hover:bg-slate-100 dark:bg-slate-700/80 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-600 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                                title={isTicketCollapsed ? "Expand this ticket" : "Collapse this ticket"}
                              >
                                {isTicketCollapsed ? (
                                  <ChevronDown className="w-2.5 h-2.5" />
                                ) : (
                                  <ChevronUp className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Ticket Items: Clean Tabular Rows */}
                          {!isTicketCollapsed ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                            {ticket.items.map((kItem, kIdx) => {
                              const isCancelled = kItem.status === 'cancelled';
                              return (
                                <div 
                                  key={kItem.id || kIdx} 
                                  className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg transition-colors ${
                                    isCancelled 
                                      ? 'bg-rose-50/50 dark:bg-rose-950/20 opacity-60' 
                                      : 'hover:bg-slate-100/70 dark:hover:bg-slate-750/50'
                                  }`}
                                >
                                  <div className="flex items-baseline gap-2 min-w-0 pr-2">
                                    <span className={`font-mono font-black text-xs shrink-0 ${
                                      isCancelled ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                                    }`}>
                                      {kItem.quantity}×
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`font-semibold truncate block ${
                                          isCancelled ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                                        }`}>
                                          {kItem.productName}
                                        </span>
                                        {isCancelled && (
                                          <div className="inline-flex items-center gap-1">
                                            <span className="text-3xs font-black px-1.5 py-0.2 rounded bg-rose-600 text-white uppercase tracking-wider">
                                              Cancelled
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setFiredItemToCancel({ ticket, item: kItem, mode: 'uncancel' })}
                                              title={`Undo cancellation: restore ${kItem.quantity}x ${kItem.productName} back to active ticket`}
                                              className="px-1.5 py-0.5 rounded-lg text-3xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer inline-flex items-center gap-1 shadow-2xs transition-colors active:scale-95"
                                            >
                                              <RotateCcw className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                                              <span>Undo</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      {kItem.specialInstructions && !isCancelled && (
                                        <span className="text-3xs text-blue-900 dark:text-blue-300 font-semibold italic block">
                                          Note: {kItem.specialInstructions}
                                        </span>
                                      )}

                                      {/* Fired item addons list display */}
                                      {(() => {
                                        const displayAddons = extractKOTItemAddons(kItem);
                                        if (displayAddons.length === 0 || isCancelled) return null;
                                        return (
                                          <div className="flex flex-wrap gap-1 mt-0.5">
                                            {displayAddons.map((addon, aIdx) => (
                                              <span
                                                key={aIdx}
                                                className="text-3xs px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800"
                                              >
                                                +{addon.name} ({formatNPR(addon.price)})
                                              </span>
                                            ))}
                                          </div>
                                        );
                                      })()}

                                      {isCancelled && (kItem.cancelReason || kItem.cancelDisposition || kItem.notifiedKitchenBar) && (
                                        <div className="mt-0.5 space-y-0.5">
                                          {kItem.cancelReason && (
                                            <span className="text-3xs text-rose-500 dark:text-rose-400 italic block">
                                              Reason: {kItem.cancelReason}
                                            </span>
                                          )}
                                          <div className="flex items-center gap-2 flex-wrap text-3xs font-bold">
                                            {kItem.cancelDisposition === 'return_to_stock' && (
                                              <span className="text-emerald-600 dark:text-emerald-400">
                                                .Restocked
                                              </span>
                                            )}
                                            {kItem.cancelDisposition === 'mark_as_waste' && (
                                              <span className="text-rose-600 dark:text-rose-400">
                                                .Kitchen Waste
                                              </span>
                                            )}
                                            {kItem.notifiedKitchenBar && (
                                              <span className="text-blue-600 dark:text-blue-400">
                                                .Alert Sent
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`font-mono font-bold text-xs ${
                                      isCancelled ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                                    }`}>
                                      {formatNPR(kItem.quantity * kItem.unitPrice)}
                                    </span>

                                    {/* Action Buttons: Add-on/Note and Cancel on each fired item */}
                                    {!isCancelled && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={!canUpdateOrder}
                                          onClick={() => setCustomizationTarget({ type: 'fired', ticket, item: kItem })}
                                          title={!canUpdateOrder ? 'Updating fired items is restricted for your staff role' : 'Add/edit add-ons and kitchen notes for this fired item'}
                                          className="px-1.5 py-0.5 rounded-lg text-3xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1 shadow-2xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Plus className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                                          <span>Add on</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setFiredItemToCancel({ ticket, item: kItem })}
                                          title={`Cancel order for ${kItem.quantity}x ${kItem.productName}`}
                                          className="px-1.5 py-0.5 rounded-lg text-3xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:hover:bg-rose-900/90 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer flex items-center gap-1 shadow-2xs"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                          <span>Cancel</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          ) : (
                            <div 
                              onClick={() => toggleTicketCollapse(ticket.id)}
                              className="px-2.5 py-1.5 text-3xs text-slate-500 dark:text-slate-400 font-medium cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60 flex items-center justify-between transition-colors"
                              title="Click to view ticket items"
                            >
                              <span>{ticketItemsCount} {ticketItemsCount === 1 ? 'item' : 'items'} in ticket</span>
                              <span className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Show items</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  )}


                </>
              )}
            </div>

            {/* BOTTOM SUMMARY & BILL SETTLEMENT - DIRECTLY BELOW ITEMS, MOVES DOWN NATURALLY AS ORDERS PILE UP */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 space-y-2">
              
              {/* Amount Breakdown */}
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Menu Subtotal:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(subtotal)}</span>
                </div>

                {grossDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">-{formatNPR(grossDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Taxable Base (Ex-VAT):</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(taxableAmount)}</span>
                </div>

                <div className="flex justify-between text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>VAT ({defaultVatRate}%):</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold">
                      Included
                    </span>
                  </div>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(taxAmount)}</span>
                </div>

                <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline font-black text-slate-900 dark:text-slate-100">
                  <span className="text-xs uppercase">Total Payable:</span>
                  <span className="text-base font-mono text-blue-600 dark:text-blue-400 font-extrabold">
                    {formatNPR(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Settle Bill Button or Dissolve Table Button */}
              {activeDiningTable && isTableAllCancelled && cart.length === 0 ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleConfirmDissolve('All orders cancelled')}
                    disabled={isDissolvingTable || !canVoidOrderItem}
                    className="w-full py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:text-slate-300 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs group disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canVoidOrderItem ? 'Dissolving / voiding orders requires void permission' : `All orders cancelled. Click to dissolve Table ${activeDiningTable.tableNumber} and make available for new customers`}
                  >
                    <LogOut className="w-4 h-4 text-slate-500 group-hover:text-rose-600 dark:text-slate-400 dark:group-hover:text-rose-400 transition-colors" />
                    <span>{isDissolvingTable ? 'Dissolving Table...' : `Dissolve Table ${activeDiningTable.tableNumber} (Release for New Customer)`}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintDraftBill}
                    disabled={allBillItems.length === 0 || isPrintingDraftBill || !canReprintBills}
                    className={`shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      allBillItems.length === 0 || isPrintingDraftBill || !canReprintBills
                        ? 'bg-slate-100 text-slate-400 dark:bg-slate-800/70 dark:text-slate-600 cursor-not-allowed border-slate-200 dark:border-slate-700'
                        : 'bg-white hover:bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-400 dark:bg-slate-800 dark:hover:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/80 shadow-2xs active:scale-[0.99]'
                    }`}
                    title={
                      !canReprintBills
                        ? "Draft check / bill printing is restricted for your staff role"
                        : allBillItems.length === 0
                        ? "Fire orders first to print a draft bill"
                        : "Print a draft check / proforma bill without settling or closing the table"
                    }
                  >
                    <Printer className={`w-3.5 h-3.5 ${isPrintingDraftBill ? 'animate-pulse' : ''}`} />
                    <span>{isPrintingDraftBill ? 'Printing...' : 'Draft Bill'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenSettleBill}
                    disabled={!canSettleBill || allBillItems.length === 0 || (Boolean(activeDiningTable) && cart.length > 0)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      !canSettleBill || allBillItems.length === 0 || (Boolean(activeDiningTable) && cart.length > 0)
                        ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-sm hover:shadow-md cursor-pointer'
                    }`}
                    title={
                      !canSettleBill
                        ? "Bill settlement / invoicing permission required"
                        : Boolean(activeDiningTable) && cart.length > 0
                        ? "Please manage above items before generating the final bill"
                        : allBillItems.length === 0
                        ? "No fired orders to bill yet"
                        : "Proceed to settle and print bill"
                    }
                  >
                    <Receipt className="w-4 h-4 shrink-0" />
                    <span className="truncate">Settle &amp; Print Bill ({totalBillItemsCount} {totalBillItemsCount === 1 ? 'item' : 'items'})</span>
                  </button>
                </div>
              )}

              {/* Alert text below the button when unfired draft items exist */}
              {Boolean(activeDiningTable) && cart.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold leading-snug">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Please manage above items before generating the final bill</span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* MANAGE TABLE MODAL (Transfer, Merge, Swap, Guests & Staff) */}
      {showManageTableModal && activeDiningTable && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl sm:max-w-2xl w-full p-5 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Manage Table {activeDiningTable.tableNumber}</span>
                    <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {activeDiningTable.floorName || currentFloor?.name || 'Main Floor'}
                    </span>
                  </h3>
                  {(() => {
                    const activeTableInfo = getTableRunningInfo(activeDiningTable);
                    return (
                      <p className="text-3xs text-slate-400">
                        Running: {activeTableInfo.totalItemsCount} {activeTableInfo.totalItemsCount === 1 ? 'item' : 'items'} • Subtotal: {formatNPR(activeTableInfo.totalSubtotal)}
                        {activeTableInfo.firedSubtotal > 0 && activeTableInfo.draftSubtotal > 0 && (
                          <span className="ml-1 text-slate-500 dark:text-slate-400">
                            (Fired: {formatNPR(activeTableInfo.firedSubtotal)} + Draft: {formatNPR(activeTableInfo.draftSubtotal)})
                          </span>
                        )}
                      </p>
                    );
                  })()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManageTableModal(false)}
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation: Transfer, Merge, Swap, Details, Dissolve */}
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
              <button
                type="button"
                disabled={!canUpdateOrder}
                onClick={() => { setManageTab('transfer'); setManageNotice(''); setTargetTableId(''); }}
                className={`py-1.5 px-1.5 sm:px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  manageTab === 'transfer'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs cursor-pointer'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Transfer</span>
              </button>
              <button
                type="button"
                disabled={!canUpdateOrder}
                onClick={() => { setManageTab('merge'); setManageNotice(''); setTargetTableId(''); }}
                className={`py-1.5 px-1.5 sm:px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  manageTab === 'merge'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs cursor-pointer'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Merge</span>
              </button>
              <button
                type="button"
                disabled={!canUpdateOrder}
                onClick={() => { setManageTab('swap'); setManageNotice(''); setTargetTableId(''); }}
                className={`py-1.5 px-1.5 sm:px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  manageTab === 'swap'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs cursor-pointer'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Swap</span>
              </button>
              <button
                type="button"
                disabled={!canUpdateOrder}
                onClick={() => { setManageTab('details'); setManageNotice(''); setTargetTableId(''); }}
                className={`py-1.5 px-1.5 sm:px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  manageTab === 'details'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs cursor-pointer'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Details</span>
              </button>
              <button
                type="button"
                disabled={!canVoidOrderItem}
                onClick={() => { setManageTab('dissolve'); setManageNotice(''); setTargetTableId(''); }}
                className={`py-1.5 px-1.5 sm:px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  manageTab === 'dissolve'
                    ? 'bg-amber-500 text-white shadow-xs cursor-pointer'
                    : 'text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 cursor-pointer'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Dissolve</span>
              </button>
            </div>

            {/* Notice Message Banner */}
            {manageNotice && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-medium">
                {manageNotice}
              </div>
            )}

            {/* TAB CONTENT (Single clean scroll container) */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
              {/* TABLE PICKER FOR TRANSFER, MERGE, SWAP */}
              {manageTab !== 'details' && manageTab !== 'dissolve' && (
                <div className="space-y-2.5 animate-in fade-in">
                  {/* Floor Filter Strip & Search */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {manageTab === 'transfer' 
                          ? 'Select Destination Table (Empty):' 
                          : manageTab === 'merge' 
                          ? 'Select Target Table to Merge With (Occupied):' 
                          : 'Select Table to Swap With (Occupied):'}
                      </label>
                      <span className="text-3xs text-slate-400 font-semibold">
                        {eligibleManageTables.length} {manageTab === 'transfer'
                          ? (eligibleManageTables.length === 1 ? 'empty table' : 'empty tables')
                          : (eligibleManageTables.length === 1 ? 'occupied table' : 'occupied tables')}
                      </span>
                    </div>

                    {/* Floor Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                      {manageFloorsWithCounts.map(flr => {
                        const isActive = manageFloorFilter === flr.id;
                        return (
                          <button
                            key={flr.id}
                            type="button"
                            onClick={() => setManageFloorFilter(flr.id)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                            }`}
                          >
                            <span>{flr.name}</span>
                            <span className={`text-3xs px-1.5 py-0.2 rounded-full font-mono ${
                              isActive
                                ? 'bg-white/25 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}>
                              {flr.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder={manageTab === 'transfer' ? "Search empty table number (e.g. G2, T-4)..." : "Search occupied table number (e.g. G1, T-2)..."}
                        value={manageSearchQuery}
                        onChange={(e) => setManageSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-7 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                      />
                      {manageSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setManageSearchQuery('')}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clean Dining Tables Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
                    {eligibleManageTables.length === 0 ? (
                      <div className="col-span-full py-8 text-center text-slate-400">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {manageSearchQuery 
                            ? 'No matching tables found' 
                            : manageTab === 'transfer' 
                            ? 'No empty tables on this floor' 
                            : manageTab === 'merge' 
                            ? 'No other occupied tables to merge with' 
                            : 'No other occupied tables to swap with'}
                        </p>
                        <p className="text-3xs text-slate-400 mt-1 max-w-xs mx-auto">
                          {manageSearchQuery 
                            ? 'Try clearing your search query' 
                            : manageTab === 'transfer' 
                            ? 'All tables on this floor are currently occupied.' 
                            : manageTab === 'merge' 
                            ? 'Merge combines two active orders. There are no other tables with active orders right now.' 
                            : 'Swap exchanges orders between two active tables. There are no other tables with active orders right now.'}
                        </p>
                      </div>
                    ) : (
                      eligibleManageTables.map(tbl => {
                        const isCurrentTable = tbl.id === activeDiningTable.id;
                        const isSelected = targetTableId === tbl.id;
                        const info = getTableRunningInfo(tbl);
                        const isAvail = !info.hasActiveOrder && tbl.status === 'available';
                        const isOccupied = info.hasActiveOrder || tbl.status !== 'available';
                        const cleanNumber = String(tbl.tableNumber || '').trim();
                        const lowerNum = cleanNumber.toLowerCase();
                        const titleText = lowerNum.startsWith('table')
                          ? cleanNumber
                          : lowerNum.startsWith('t-')
                          ? `Table ${cleanNumber.slice(2)}`
                          : lowerNum.startsWith('bar') || lowerNum.startsWith('booth') || lowerNum.startsWith('counter')
                          ? cleanNumber
                          : `Table ${cleanNumber}`;
                        const displayFloor = tbl.floorName || floors.find(f => f.id === tbl.floorId)?.name || 'Floor';
                        const displaySection = tbl.sectionName || sections.find(s => s.id === tbl.sectionId)?.name || '';

                        return (
                          <div
                            key={tbl.id}
                            onClick={() => {
                              if (isCurrentTable) {
                                setManageNotice(`Table ${cleanNumber} is the current table being managed. Select another destination table to ${manageTab}.`);
                                return;
                              }
                              setTargetTableId(tbl.id);
                              setManageNotice('');
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              isCurrentTable
                                ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-300/40 cursor-default'
                                : isSelected
                                ? manageTab === 'merge'
                                  ? 'border-purple-600 bg-purple-50/90 dark:bg-purple-950/80 ring-2 ring-purple-500/40 shadow-sm cursor-pointer'
                                  : manageTab === 'swap'
                                  ? 'border-blue-600 bg-blue-50/90 dark:bg-blue-950/80 ring-2 ring-blue-500/40 shadow-sm cursor-pointer'
                                  : 'border-indigo-600 bg-indigo-50/90 dark:bg-indigo-950/80 ring-2 ring-indigo-500/40 shadow-sm cursor-pointer'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-black text-xs text-slate-900 dark:text-slate-100 truncate">
                                {titleText}
                              </span>

                              {isCurrentTable ? (
                                <span className="text-3xs px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  Current Table
                                </span>
                              ) : manageTab === 'transfer' ? (
                                <span className={`text-3xs px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                                  isAvail
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}>
                                  {isAvail ? 'Empty' : 'Occupied'}
                                </span>
                              ) : manageTab === 'merge' ? (
                                <span className={`text-3xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                                  isOccupied
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                  {info.isCooking ? 'Cooking' : info.isDraft ? 'Draft' : isOccupied ? 'Has Order' : 'Empty'}
                                </span>
                              ) : (
                                <span className={`text-3xs px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                                  isAvail
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : info.isCooking
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : info.isDraft
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                }`}>
                                  {isAvail ? 'Empty' : info.isCooking ? 'Cooking' : info.isDraft ? 'Draft' : 'Occupied'}
                                </span>
                              )}
                            </div>

                            <p className="text-3xs text-slate-400 mt-1 truncate">
                              {displayFloor}{displaySection ? ` • ${displaySection}` : ''} • {tbl.capacity} seats
                            </p>

                            {info.totalSubtotal > 0 ? (
                              <div className="mt-1 flex items-center justify-between">
                                <span className={`text-3xs font-mono font-bold ${
                                  isCurrentTable
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : manageTab === 'merge'
                                    ? 'text-purple-600 dark:text-purple-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}>
                                  Running: {formatNPR(info.totalSubtotal)}
                                </span>
                                {info.totalItemsCount > 0 && (
                                  <span className="text-3xs text-slate-400 font-medium">
                                    ({info.totalItemsCount} {info.totalItemsCount === 1 ? 'item' : 'items'})
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Selected Target Action Preview Card */}
                  {targetTableId && (() => {
                    const selectedTarget = diningTables.find(t => t.id === targetTableId);
                    if (!selectedTarget) return null;
                    const srcInfo = getTableRunningInfo(activeDiningTable);
                    const tgtInfo = getTableRunningInfo(selectedTarget);
                    const mergedSubtotal = srcInfo.totalSubtotal + tgtInfo.totalSubtotal;
                    const mergedItemsCount = srcInfo.totalItemsCount + tgtInfo.totalItemsCount;

                    if (manageTab === 'merge') {
                      return (
                        <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                              <GitMerge className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>Merge Preview: Table {activeDiningTable.tableNumber} + Table {selectedTarget.tableNumber}</span>
                            </span>
                            <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                              Combined {mergedItemsCount} items
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-3xs">
                            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/60">
                              <div className="font-bold text-slate-800 dark:text-slate-200">Table {activeDiningTable.tableNumber} (Current)</div>
                              <div className="text-slate-500 mt-0.5">{srcInfo.totalItemsCount} items ({srcInfo.activeTicketsCount} KOT)</div>
                              <div className="font-mono font-bold text-purple-700 dark:text-purple-300 mt-1">Subtotal: {formatNPR(srcInfo.totalSubtotal)}</div>
                            </div>
                            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/60">
                              <div className="font-bold text-slate-800 dark:text-slate-200">Table {selectedTarget.tableNumber} (Target)</div>
                              <div className="text-slate-500 mt-0.5">{tgtInfo.totalItemsCount} items ({tgtInfo.activeTicketsCount} KOT)</div>
                              <div className="font-mono font-bold text-purple-700 dark:text-purple-300 mt-1">Subtotal: {formatNPR(tgtInfo.totalSubtotal)}</div>
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-purple-200 dark:border-purple-900 flex items-center justify-between text-xs">
                            <span className="font-bold text-purple-900 dark:text-purple-200">New Merged Total Subtotal:</span>
                            <span className="font-mono font-black text-purple-700 dark:text-purple-300 text-sm">
                              {formatNPR(mergedSubtotal)}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (manageTab === 'transfer') {
                      return (
                        <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs animate-in fade-in">
                          <div>
                            <span className="font-bold text-indigo-900 dark:text-indigo-200">
                              Transfer {srcInfo.totalItemsCount} items to Table {selectedTarget.tableNumber}
                            </span>
                            <p className="text-3xs text-slate-500 mt-0.5">
                              Table {activeDiningTable.tableNumber} will become empty &amp; available
                            </p>
                          </div>
                          <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                            {formatNPR(srcInfo.totalSubtotal)}
                          </span>
                        </div>
                      );
                    }

                    if (manageTab === 'swap') {
                      return (
                        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-1.5 text-xs animate-in fade-in">
                          <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center justify-between">
                            <span>Swap Orders: Table {activeDiningTable.tableNumber} ⇆ Table {selectedTarget.tableNumber}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-3xs text-slate-600 dark:text-slate-300">
                            <div>Table {activeDiningTable.tableNumber}: <span className="font-mono font-bold">{formatNPR(srcInfo.totalSubtotal)}</span></div>
                            <div>Table {selectedTarget.tableNumber}: <span className="font-mono font-bold">{formatNPR(tgtInfo.totalSubtotal)}</span></div>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
              )}

              {manageTab === 'details' && (
                <div className="space-y-3.5 animate-in fade-in">
                  {/* Guest Count */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Number of Guests:
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                      {[1, 2, 4, 6, 8, 10].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTempGuestCount(cnt)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            tempGuestCount === cnt
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Staff / Waiter Selection */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Assigned Waiter / Staff:
                    </label>
                    <select
                      value={tempWaiterName}
                      onChange={(e) => setTempWaiterName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-hidden"
                    >
                      <option value={operatorName}>
                        {operatorName} (Current Staff)
                      </option>
                      {staffMembers.filter(s => s.name !== operatorName).map(staff => (
                        <option key={staff.id} value={staff.name}>
                          {staff.name} ({staff.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {manageTab === 'dissolve' && (
                <div className="space-y-4 animate-in fade-in p-1">
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <LogOut className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-amber-950 dark:text-amber-200">
                          Dissolve &amp; Release Table {activeDiningTable.tableNumber}
                        </h4>
                        <p className="text-3xs text-amber-800 dark:text-amber-300">
                          Clears running tickets and table drafts, resets table status to Available, and frees it for new customers.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 text-center">
                        <span className="text-3xs text-slate-400 block font-semibold">Fired Tickets</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {activeTableTickets.length}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 text-center">
                        <span className="text-3xs text-slate-400 block font-semibold">Active Items</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {firedSaleItems.reduce((s, i) => s + i.quantity, 0)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 text-center">
                        <span className="text-3xs text-slate-400 block font-semibold">Cancelled Items</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                          {activeTableTickets.flatMap(t => t.items || []).filter(i => i.status === 'cancelled').reduce((sum, i) => sum + i.quantity, 0)}
                        </span>
                      </div>
                    </div>

                    {isTableAllCancelled ? (
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>All orders are already cancelled. Ready to release table immediately for new guests.</span>
                      </div>
                    ) : firedSaleItems.length > 0 ? (
                      <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Notice: {firedSaleItems.reduce((s, i) => s + i.quantity, 0)} active item(s) remain. Dissolving will cancel all remaining items and release the table.</span>
                      </div>
                    ) : (
                      <div className="text-3xs text-slate-500 dark:text-slate-400">
                        This table has no active running balance. Releasing it will make it ready for new customers.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowManageTableModal(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (manageTab === 'dissolve') {
                    if (!canVoidOrderItem) return;
                    handleConfirmDissolve('All orders cancelled');
                  } else {
                    if (!canUpdateOrder) return;
                    handleExecuteTableManage();
                  }
                }}
                disabled={
                  isExecutingManage ||
                  (manageTab === 'dissolve' ? !canVoidOrderItem : !canUpdateOrder) ||
                  (manageTab !== 'details' && manageTab !== 'dissolve' && (!targetTableId || targetTableId === activeDiningTable.id))
                }
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all ${
                  isExecutingManage ||
                  (manageTab === 'dissolve' ? !canVoidOrderItem : !canUpdateOrder) ||
                  (manageTab !== 'details' && manageTab !== 'dissolve' && (!targetTableId || targetTableId === activeDiningTable.id))
                    ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                    : manageTab === 'dissolve'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/25 cursor-pointer'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25 cursor-pointer'
                }`}
              >
                {isExecutingManage ? (
                  <span>Processing...</span>
                ) : manageTab === 'transfer' ? (
                  <span>Confirm Transfer</span>
                ) : manageTab === 'merge' ? (
                  <span>Confirm Merge</span>
                ) : manageTab === 'swap' ? (
                  <span>Confirm Swap</span>
                ) : manageTab === 'dissolve' ? (
                  <span className="flex items-center gap-1.5">
                    <LogOut className="w-4 h-4" />
                    <span>Dissolve Table Now</span>
                  </span>
                ) : (
                  <span>Save Details</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* INVOICE SUCCESS / RECEIPT MODAL */}
      {renderCompletedInvoiceModal()}

      {/* Safe Thermal KOT / BOT Slip Print & Preview Modal */}
      <ThermalSlipModal
        isOpen={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        kitchenTicket={slipModalKitchenTicket}
        barTicket={slipModalBarTicket}
        initialStation={slipModalStation}
      />

      {/* Cancel / Uncancel Fired Order Item Modal */}
      <CancelFiredOrderItemModal
        isOpen={!!firedItemToCancel}
        ticket={firedItemToCancel?.ticket || null}
        item={firedItemToCancel?.item || null}
        tableNumber={activeDiningTable?.tableNumber}
        mode={firedItemToCancel?.mode || 'cancel'}
        onClose={() => setFiredItemToCancel(null)}
        onConfirm={handleConfirmCancelFiredItem}
      />

      {/* Order Item Add-on & Note Customization Modal */}
      <OrderItemCustomizationModal
        isOpen={!!customizationTarget}
        target={customizationTarget}
        tableNumber={activeDiningTable?.tableNumber}
        onClose={() => setCustomizationTarget(null)}
        onSaveCartItem={handleSaveCustomizationCartItem}
        onSaveFiredItem={handleSaveCustomizationFiredItem}
        onAddNewItem={(product, addons, notes, quantity) => {
          addToCart(product, addons, notes, quantity);
          setKotSuccessBanner(`✓ Added ${quantity}× ${product.name} to ticket`);
          setTimeout(() => setKotSuccessBanner(null), 2500);
        }}
      />

      {/* Clear Order Round Confirmation In-App Modal */}
      <ClearOrderRoundModal
        isOpen={showClearRoundModal}
        onClose={() => setShowClearRoundModal(false)}
        onConfirm={handleConfirmClearDraft}
        targetLabel={activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway'}
        roundNumber={totalFiredRounds + 1}
        totalQuantity={cart.reduce((s, i) => s + i.quantity, 0)}
        items={cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          orderRoutingStation: item.orderRoutingStation
        }))}
      />

      {/* Per-Action Staff 4-Digit PIN Verification Modal */}
      <PosActionPinModal
        isOpen={Boolean(pendingPinAction)}
        title={pendingPinAction?.title || 'Enter Staff PIN'}
        detail={pendingPinAction?.detail}
        accent={pendingPinAction?.accent || 'indigo'}
        currentOperator={currentOperator}
        staffMembers={staffMembers}
        onClose={() => setPendingPinAction(null)}
        onVerified={async authorizedBy => {
          const actionToRun = pendingPinAction?.onVerified;
          setPendingPinAction(null);
          if (actionToRun) {
            await actionToRun(authorizedBy);
          }
        }}
      />

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    Add New Customer
                  </h3>
                  <p className="text-3xs text-slate-500">
                    Quick register customer for billing & tax invoice
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Ramesh Shrestha"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / Mobile (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="98XXXXXXXX (Optional)"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300">
                      {panVatMode} (Optional)
                    </label>
                    <div className="inline-flex p-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setPanVatMode('PAN')}
                        className={`px-1.5 py-0.5 text-3xs font-black rounded-sm transition-all cursor-pointer ${
                          panVatMode === 'PAN'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        PAN
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanVatMode('VAT')}
                        className={`px-1.5 py-0.5 text-3xs font-black rounded-sm transition-all cursor-pointer ${
                          panVatMode === 'VAT'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        VAT
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder={`9-digit ${panVatMode}`}
                    value={newCustomerForm.panVatNumber}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, panVatNumber: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Address / City (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. New Road, Kathmandu"
                  value={newCustomerForm.addressStreet}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, addressStreet: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 cursor-pointer flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSubmittingCustomer ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Save & Select</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



    </div>
  );
};

export default POSView;
