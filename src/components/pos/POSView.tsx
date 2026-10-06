import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, Check, 
  Printer, ArrowRight, UserPlus, CreditCard, DollarSign,
  QrCode, User, FileText, ChevronDown, CheckCircle2, RotateCcw,
  X, Tag, ArrowLeft, Receipt, Flame, UtensilsCrossed, ChefHat, 
  Wine, Cake, Sparkles, Settings, Layers, Building2, ShoppingBag,
  Circle, Square, RectangleHorizontal, LayoutGrid, Clock,
  ArrowLeftRight, GitMerge, RefreshCw, Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, Customer, SaleItem, SaleInvoice, DiningTable, StaffMember, KitchenOrderTicket } from '../../types';
import { formatNPR, numberToWordsNPR, formatDate } from '../../utils/nepalFormatters';
import { InteractiveFloorCanvas } from './InteractiveFloorCanvas';
import { StaffPinSwitchModal } from './StaffPinSwitchModal';
import { ItemVoidConfirmModal } from './ItemVoidConfirmModal';
import { ThermalSlipModal } from './ThermalSlipModal';
import { generateKOTSlipHtml, generateBOTSlipHtml, generateBillReceiptSlipHtml, generateCombinedOrderTicketsHtml, safeThermalWindowPrint } from '../../utils/printerService';
import { searchFoodProducts } from '../../utils/fuzzySearch';
import { INITIAL_PRINTERS } from '../../data/restaurantInitialData';

interface CartItem extends SaleItem {
  availableStock: number;
  addonsList?: { name: string; price: number }[];
  itemNotes?: string;
  orderRoutingStation?: 'kitchen' | 'bar';
}

export const POSView: React.FC = () => {
  const { 
    products, customers, addCustomer, recordSale, 
    currentUser, settings, currentWarehouseId, warehouses,
    floors, sections, diningTables, selectedTableId, setSelectedTableId, 
    fireKitchenOrderTicket, splitAndFireTickets, settleTableBill, kitchenTickets,
    updateKOTItemStatus,
    tableDrafts, saveTableDraft, getTableDraft, clearTableDraft,
    staffMembers, assignTableGuests, transferTable, mergeTables, swapTables, activePOSStaff,
    printers, printKOTForTicket, printBOTForTicket, printCombinedOrderTickets, printBillForInvoice
  } = useApp();

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

  // Takeaway Mode state (for counter sales without physical table)
  const [isTakeawayMode, setIsTakeawayMode] = useState<boolean>(false);

  // Quick Guest count prompt when selecting an available table
  const [pendingGuestTable, setPendingGuestTable] = useState<DiningTable | null>(null);
  const [guestCountInput, setGuestCountInput] = useState<number>(2);
  const [waiterInput, setWaiterInput] = useState<string>('');

  // Staff Switch Modal State
  const [showStaffSwitchModal, setShowStaffSwitchModal] = useState<boolean>(false);
  const [itemToVoid, setItemToVoid] = useState<{ index: number; item: CartItem } | null>(null);

  // Table Manage Modal (Transfer, Merge, Swap, Details)
  const [showManageTableModal, setShowManageTableModal] = useState<boolean>(false);
  const [manageTab, setManageTab] = useState<'transfer' | 'merge' | 'swap' | 'details'>('transfer');
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [isExecutingManage, setIsExecutingManage] = useState<boolean>(false);
  const [manageNotice, setManageNotice] = useState<string>('');
  const [tempGuestCount, setTempGuestCount] = useState<number>(2);
  const [tempWaiterName, setTempWaiterName] = useState<string>('');

  // Active dining table (null if in Floor View or Takeaway mode)
  const activeDiningTable = useMemo(() => {
    if (!selectedTableId) return null;
    return diningTables.find(t => t.id === selectedTableId) || null;
  }, [diningTables, selectedTableId]);

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
      setTempWaiterName(activeDiningTable.assignedWaiter || activePOSStaff?.name || currentUser.name);
    }
  }, [activeDiningTable, activePOSStaff, currentUser]);

  // Current floor & sections
  const currentFloor = useMemo(() => {
    return floors.find(f => f.id === activeFloorId) || (floors.length > 0 ? floors[0] : null);
  }, [floors, activeFloorId]);

  const activeFloorSections = useMemo(() => {
    if (!currentFloor) return [];
    return sections.filter(s => s.floorId === currentFloor.id);
  }, [sections, currentFloor]);

  // Tables belonging to active floor for canvas rendering
  const canvasFloorTables = useMemo(() => {
    return diningTables.filter(t => {
      if (currentFloor) {
        const tFloor = t.floorId || floors[0]?.id;
        if (tFloor !== currentFloor.id) return false;
      }

      if (activeSectionId !== 'ALL' && t.sectionId && t.sectionId !== activeSectionId) {
        return false;
      }

      if (floorStatusFilter !== 'all') {
        if (floorStatusFilter === 'cooking' && t.status !== 'kot_fired') return false;
        if (floorStatusFilter !== 'cooking' && t.status !== floorStatusFilter) return false;
      }

      return true;
    });
  }, [diningTables, currentFloor, floors, activeSectionId, floorStatusFilter]);

  // Stats for Floor View
  const floorStats = useMemo(() => {
    const allOnFloor = currentFloor
      ? diningTables.filter(t => !t.isDecor && (t.floorId || floors[0]?.id) === currentFloor.id)
      : diningTables.filter(t => !t.isDecor);

    return {
      all: allOnFloor.length,
      available: allOnFloor.filter(t => t.status === 'available').length,
      seated: allOnFloor.filter(t => t.status === 'seated').length,
      cooking: allOnFloor.filter(t => t.status === 'kot_fired').length,
      billed: allOnFloor.filter(t => t.status === 'billed').length,
      draft: allOnFloor.filter(t => t.status === 'draft').length
    };
  }, [diningTables, currentFloor, floors]);

  // =========================================================================
  // DYNAMIC MENU FILTERS (Strictly derived from REAL products in catalog)
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [selectedPrepStyle, setSelectedPrepStyle] = useState<string>('ALL');

  // Addon Modal for Item Customization
  const [addonItemProduct, setAddonItemProduct] = useState<Product | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<{ name: string; price: number }[]>([]);
  const [addonSpecialNote, setAddonSpecialNote] = useState<string>('');

  // 1. Root Departments: strictly real departments from products in inventory
  const departments = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.department && p.department.trim()) {
        set.add(p.department.trim());
      }
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? ['ALL', ...list] : ['ALL'];
  }, [products]);

  // 2. Categories: strictly real categories matching selected department
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      const matchDept = selectedDepartment === 'ALL' || p.department === selectedDepartment;
      if (matchDept && p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? ['ALL', ...list] : ['ALL'];
  }, [products, selectedDepartment]);

  // 3. Sub-Categories: strictly real subcategories matching department + category
  const subCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      const matchDept = selectedDepartment === 'ALL' || p.department === selectedDepartment;
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      if (matchDept && matchCat) {
        if (p.subCategory && p.subCategory.trim()) set.add(p.subCategory.trim());
        else if (p.subcategory && p.subcategory.trim()) set.add(p.subcategory.trim());
      }
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? ['ALL', ...list] : ['ALL'];
  }, [products, selectedDepartment, selectedCategory]);

  // 4. Prep-Styles: strictly real prepStyles matching department + category + subcategory
  const prepStyles = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      const matchDept = selectedDepartment === 'ALL' || p.department === selectedDepartment;
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const pSub = p.subCategory || p.subcategory;
      const matchSub = selectedSubCategory === 'ALL' || pSub === selectedSubCategory;
      if (matchDept && matchCat && matchSub) {
        if (p.prepStyle && p.prepStyle.trim()) set.add(p.prepStyle.trim());
      }
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? ['ALL', ...list] : ['ALL'];
  }, [products, selectedDepartment, selectedCategory, selectedSubCategory]);

  // Customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cust-walkin');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
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

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'rs'>('percent');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'esewa' | 'fonepay' | 'khalti' | 'connectips' | 'cheque' | 'credit' | 'partial'>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [salesNotes, setSalesNotes] = useState<string>('');
  const [kitchenSpecialNotes, setKitchenSpecialNotes] = useState<string>('');
  const [kotSuccessBanner, setKotSuccessBanner] = useState<string | null>(null);
  const [isFiringOrder, setIsFiringOrder] = useState<boolean>(false);
  const [isSettlingBill, setIsSettlingBill] = useState<boolean>(false);
  const [isCompletingSale, setIsCompletingSale] = useState<boolean>(false);

  // Thermal Slip Modal State for safe non-breaking receipt previews & direct print
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipModalKitchenTicket, setSlipModalKitchenTicket] = useState<KitchenOrderTicket | null>(null);
  const [slipModalBarTicket, setSlipModalBarTicket] = useState<KitchenOrderTicket | null>(null);
  const [slipModalStation, setSlipModalStation] = useState<'kitchen' | 'bar'>('kitchen');

  // Fast-tap cooldown ref to guarantee single-click execution (prevents 2 items on single click)
  const lastAddRef = React.useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Table Draft Synchronization (Preserves cart per table & reflects red fill on floor canvas)
  const isHydratingRef = React.useRef(false);
  const isFiringRef = React.useRef(false);

  // When selected table changes, hydrate cart and notes from its draft (or reset to empty)
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
        if (draft.kitchenSpecialNotes !== undefined) setKitchenSpecialNotes(draft.kitchenSpecialNotes);
        if (draft.discountType !== undefined) setDiscountType(draft.discountType);
        if (draft.discountInput !== undefined) setDiscountInput(draft.discountInput);
      } else {
        setCart([]);
        setKitchenSpecialNotes('');
        setDiscountInput('0');
      }
      const timer = setTimeout(() => {
        isHydratingRef.current = false;
      }, 60);
      setIsSettlingBill(false);
      return () => clearTimeout(timer);
    } else if (!isTakeawayMode) {
      setCart([]);
      setKitchenSpecialNotes('');
      setDiscountInput('0');
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

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  // Filtered Products based on Hierarchy and Smart Fuzzy Typo-Tolerant Search
  const { filteredProducts, searchCorrectedTerms, isGlobalSearch } = useMemo(() => {
    const trimmed = searchQuery.trim();

    // CASE 1: No search query -> Standard hierarchical browsing
    if (!trimmed) {
      const standardFiltered = products.filter(p => {
        if (p.status !== 'active') return false;
        if (selectedDepartment !== 'ALL' && p.department !== selectedDepartment) return false;
        if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
        if (selectedSubCategory !== 'ALL') {
          const pSub = p.subCategory || p.subcategory || '';
          if (pSub !== selectedSubCategory) return false;
        }
        if (selectedPrepStyle !== 'ALL' && p.prepStyle !== selectedPrepStyle) return false;
        return true;
      });
      return { filteredProducts: standardFiltered, searchCorrectedTerms: [], isGlobalSearch: false };
    }

    // CASE 2: Active search query
    // Run smart fuzzy search across all products with typo tolerance
    const { results: globalResults, correctedTerms } = searchFoodProducts(products, trimmed, selectedCategory);

    const hasCategoryFilter = selectedCategory !== 'ALL' || selectedDepartment !== 'ALL' || selectedSubCategory !== 'ALL' || selectedPrepStyle !== 'ALL';

    if (hasCategoryFilter) {
      // Find matches that also adhere to the active filter
      const categoryMatches = globalResults.filter(p => {
        if (selectedDepartment !== 'ALL' && p.department !== selectedDepartment) return false;
        if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
        if (selectedSubCategory !== 'ALL') {
          const pSub = p.subCategory || p.subcategory || '';
          if (pSub !== selectedSubCategory) return false;
        }
        if (selectedPrepStyle !== 'ALL' && p.prepStyle !== selectedPrepStyle) return false;
        return true;
      });

      if (categoryMatches.length > 0) {
        // Place category matches first, followed by other global matches
        const otherMatches = globalResults.filter(p => !categoryMatches.some(cm => cm.id === p.id));
        return {
          filteredProducts: [...categoryMatches, ...otherMatches],
          searchCorrectedTerms: correctedTerms,
          isGlobalSearch: otherMatches.length > 0
        };
      } else {
        // No matches in the selected category, but matches exist in the menu!
        // Show global matches so the user isn't blocked by the wrong category filter
        return {
          filteredProducts: globalResults,
          searchCorrectedTerms: correctedTerms,
          isGlobalSearch: true
        };
      }
    }

    return {
      filteredProducts: globalResults,
      searchCorrectedTerms: correctedTerms,
      isGlobalSearch: false
    };
  }, [products, selectedDepartment, selectedCategory, selectedSubCategory, selectedPrepStyle, searchQuery]);

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

  // Add Product to Cart directly (with cooldown protection against accidental double execution)
  const addToCart = (product: Product, addons?: { name: string; price: number }[], notes?: string) => {
    const now = Date.now();
    if (lastAddRef.current.id === product.id && (now - lastAddRef.current.time) < 250) {
      return;
    }
    lastAddRef.current = { id: product.id, time: now };

    const basePrice = getProductPriceForCustomer(product, selectedCustomer);
    const addonsTotal = (addons || []).reduce((sum, a) => sum + a.price, 0);
    const effectiveUnitPrice = basePrice + addonsTotal;
    const addonsKey = (addons || []).map(a => a.name).sort().join('|');

    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.productId === product.id && 
        item.selectedUnit === product.baseUnit &&
        ((item.addonsList || []).map(a => a.name).sort().join('|') === addonsKey)
      );

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + 1;
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
          quantity: 1,
          baseQuantity: 1,
          unitPrice: effectiveUnitPrice,
          costPrice: product.costPrice,
          discountPercent: 0,
          discountAmount: 0,
          taxRatePercent: product.taxRatePercent !== undefined ? product.taxRatePercent : (settings.defaultVatRate || 13),
          taxAmount: 0,
          lineTotal: effectiveUnitPrice,
          availableStock: product.currentStock,
          addonsList: addons || [],
          itemNotes: notes,
          orderRoutingStation: product.orderRoutingStation || ((product.department === 'Drink' || product.itemType === 'beverage') ? 'bar' : 'kitchen')
        };
        return [...prev, newItem];
      }
    });
  };

  // Open Addon Customization Modal for a specific dish
  const handleOpenAddonModal = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddonItemProduct(product);
    setSelectedAddons([]);
    setAddonSpecialNote('');
  };

  // Confirm Addon and Add to Cart
  const handleConfirmAddonModal = () => {
    if (!addonItemProduct) return;
    addToCart(addonItemProduct, selectedAddons, addonSpecialNote);
    setAddonItemProduct(null);
  };

  // Update Cart Quantity
  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
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
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Active KOT / BOT Tickets for current selected table or takeaway session
  const activeTableTickets = useMemo(() => {
    const currentTableId = activeDiningTable?.id || (isTakeawayMode ? 'takeaway-counter' : null);
    const currentTableNum = activeDiningTable?.tableNumber || (isTakeawayMode ? 'Takeaway' : null);
    
    if (!currentTableId && !isTakeawayMode) return [];

    return kitchenTickets.filter(k => {
      if (k.isSettled || k.status === 'cancelled') return false;
      if (currentTableId && (k.tableId === currentTableId || (currentTableNum && k.tableNumber === currentTableNum))) {
        return true;
      }
      if (isTakeawayMode && (k.tableId === 'takeaway-counter' || k.tableNumber === 'Takeaway' || !k.tableId)) {
        return true;
      }
      return false;
    });
  }, [kitchenTickets, activeDiningTable, isTakeawayMode]);

  // Convert fired KOT items to sale items for billing and running order display
  const firedSaleItems = useMemo<SaleItem[]>(() => {
    if (activeTableTickets.length === 0) return [];
    return activeTableTickets.flatMap(ticket => 
      ticket.items
        .filter(item => item.status !== 'cancelled')
        .map(item => {
          const prod = products.find(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
          const lineTotal = item.quantity * item.unitPrice;
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
            taxRatePercent: prod?.taxRatePercent !== undefined ? prod.taxRatePercent : (settings.defaultVatRate || 13),
            taxAmount: Math.round(lineTotal * ((settings.defaultVatRate || 13) / 100)),
            lineTotal
          };
        })
    );
  }, [activeTableTickets, products, settings.defaultVatRate]);

  // Combined bill items (all fired items from active tickets + any newly added cart items)
  const allBillItems = useMemo<SaleItem[]>(() => {
    return [...firedSaleItems, ...cart];
  }, [firedSaleItems, cart]);

  // Calculations: Total running subtotal for this table (Fired + New Draft)
  const subtotal = useMemo(() => {
    const firedSubtotal = firedSaleItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const cartSubtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    return firedSubtotal + cartSubtotal;
  }, [firedSaleItems, cart]);

  const defaultVatRate = settings.defaultVatRate || 13;
  const parsedDiscountValue = parseFloat(discountInput) || 0;
  
  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (subtotal * parsedDiscountValue) / 100;
    }
    return Math.min(parsedDiscountValue, subtotal);
  }, [subtotal, discountType, parsedDiscountValue]);

  const totalItemDiscounts = useMemo(() => {
    return allBillItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  }, [allBillItems]);

  const grossDiscount = discountAmount + totalItemDiscounts;
  const taxableAmount = Math.max(0, subtotal - grossDiscount);
  const taxAmount = (taxableAmount * defaultVatRate) / 100;
  const nonTaxableAmount = 0;
  const grandTotal = Math.round(taxableAmount + taxAmount);

  const totalCost = useMemo(() => {
    return allBillItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
  }, [allBillItems]);

  const grossProfit = grandTotal - taxAmount - totalCost;

  const paidAmountNumber = parseFloat(paidAmountInput) || 0;
  const dueAmount = Math.max(0, grandTotal - paidAmountNumber);
  const changeToReturn = paidAmountNumber > grandTotal ? paidAmountNumber - grandTotal : 0;

  // Open Settle Bill & Payment Drawer/Panel
  const handleOpenSettleBill = () => {
    if (allBillItems.length === 0) return;
    setPaidAmountInput(String(grandTotal));
    setIsSettlingBill(true);
  };

  // Complete Sale & Print Bill (Executes from Settle Bill panel)
  const handleFinalCompleteSaleAndPrint = async () => {
    if (allBillItems.length === 0 || isCompletingSale) return;
    setIsCompletingSale(true);

    try {
      const warehouse = warehouses.find(w => w.id === currentWarehouseId) || warehouses[0];
      const invoiceNumber = `${settings.invoicePrefix}${Math.floor(100000 + Math.random() * 900000)}`;
      const paymentStatus = dueAmount === 0 ? 'paid' : (paidAmountNumber > 0 ? 'partial' : 'unpaid');

      const saleInvoiceData: Omit<SaleInvoice, 'id' | 'createdAt'> = {
        invoiceNumber,
        date: Date.now(),
        fiscalYear: settings.fiscalYear,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerPanVat: selectedCustomer.panVatNumber,
        customerAddress: `${selectedCustomer.address.street}, ${selectedCustomer.address.district}`,
        customerType: selectedCustomer.customerType,
        salespersonId: activePOSStaff?.id || currentUser.id,
        salespersonName: activePOSStaff?.name || currentUser.name,
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
        paidAmount: Math.min(paidAmountNumber, grandTotal),
        dueAmount,
        paymentStatus,
        paymentReference,
        status: 'completed',
        notes: salesNotes,
        terms: settings.termsAndConditions
      };

      const recorded = await recordSale(saleInvoiceData);

      if (activeDiningTable) {
        await settleTableBill(activeDiningTable.id, recorded);
      } else if (isTakeawayMode) {
        await settleTableBill('takeaway-counter', recorded);
      }

      // 1. Generate tax invoice slip HTML & print straight away
      const targetPrinter = printers.find(p => p.isActive && (p.station === 'billing' || p.station === 'all')) || printers[0] || INITIAL_PRINTERS[0];
      const billSlipHtml = generateBillReceiptSlipHtml(recorded, activeDiningTable || null, targetPrinter, settings);

      try {
        await safeThermalWindowPrint(billSlipHtml, targetPrinter.paperWidth);
      } catch (printErr) {
        console.warn('Bill thermal print trigger notice:', printErr);
      }

      // 2. Clear table and drafts
      const currentTid = activeDiningTable?.id || selectedTableId;
      if (currentTid) {
        clearTableDraft(currentTid);
      }
      setCompletedInvoice(recorded);
      setCart([]);
      setDiscountInput('0');
      setPaymentReference('');
      setSalesNotes('');
      setKitchenSpecialNotes('');
      setIsSettlingBill(false);
      setSelectedTableId(null);
      setIsTakeawayMode(false);
    } catch (err) {
      console.error('Error settling bill:', err);
    } finally {
      setIsCompletingSale(false);
    }
  };

  // Clear Table Draft (Discard unsent items)
  const handleClearDraft = () => {
    if (!activeDiningTable) return;
    if (cart.length > 0) {
      if (!confirm(`Discard unsent draft items for Table ${activeDiningTable.tableNumber}?`)) {
        return;
      }
    }
    clearTableDraft(activeDiningTable.id);
    setCart([]);
    setKitchenSpecialNotes('');
    setDiscountInput('0');
  };

  // Fire KOT / BOT (Smart automated distribution between Kitchen KDS & Bar BOT)
  const handleFireKOT = async () => {
    if (cart.length === 0 || isFiringRef.current || isFiringOrder) return;
    if (!activeDiningTable && !isTakeawayMode) return;

    isFiringRef.current = true;
    setIsFiringOrder(true);
    isHydratingRef.current = true; // Lock draft auto-saver so firing never re-saves draft

    const tableId = activeDiningTable?.id || 'takeaway-counter';
    const tableNumber = activeDiningTable?.tableNumber || 'Takeaway';
    const zoneName = activeDiningTable?.zoneName || activeDiningTable?.floorName || 'Counter';
    const waiterName = activeDiningTable?.assignedWaiter || activePOSStaff?.name || currentUser.name;
    const guestsCount = activeDiningTable?.currentGuests || 1;
    const itemsToFire = [...cart];
    const notesToFire = kitchenSpecialNotes;

    const kotItems: any[] = itemsToFire.map((item, idx) => ({
      id: `ki-${Date.now()}-${idx}`,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      course: (item.orderRoutingStation === 'bar' ? 'beverage' : 'main') as any,
      routingStation: item.orderRoutingStation,
      specialInstructions: item.itemNotes || notesToFire || undefined,
      selectedModifiers: (item.addonsList || []).map(a => ({
        modifierName: 'Addon',
        optionName: a.name,
        priceDelta: a.price
      })),
      status: 'pending' as const,
      firedAt: Date.now()
    }));

    // Find configured printer
    const targetPrinter = printers.find(p => p.isActive && (p.station === 'kitchen' || p.station === 'all')) || printers[0] || INITIAL_PRINTERS[0];

    const nextKotNum = `KOT-${String(kitchenTickets.length + 1).padStart(4, '0')}`;
    const nextBotNum = `BOT-${String(kitchenTickets.length + 1).padStart(4, '0')}`;

    const hasBar = kotItems.some(i => i.routingStation === 'bar');
    const hasKitchen = kotItems.some(i => i.routingStation !== 'bar');

    let slipHtml = '';
    if (hasKitchen && hasBar) {
      const kTicket: any = { kotNumber: nextKotNum, tableNumber, zoneName, waiterName, guestsCount, notes: notesToFire, items: kotItems.filter(i => i.routingStation !== 'bar'), createdAt: Date.now() };
      const bTicket: any = { kotNumber: nextBotNum, tableNumber, zoneName, waiterName, guestsCount, notes: notesToFire, items: kotItems.filter(i => i.routingStation === 'bar'), createdAt: Date.now() };
      slipHtml = generateCombinedOrderTicketsHtml(kTicket, bTicket, targetPrinter, settings);
    } else if (hasBar) {
      const bTicket: any = { kotNumber: nextBotNum, tableNumber, zoneName, waiterName, guestsCount, notes: notesToFire, items: kotItems, createdAt: Date.now() };
      slipHtml = generateBOTSlipHtml(bTicket, targetPrinter, settings);
    } else {
      const kTicket: any = { kotNumber: nextKotNum, tableNumber, zoneName, waiterName, guestsCount, notes: notesToFire, items: kotItems, createdAt: Date.now() };
      slipHtml = generateKOTSlipHtml(kTicket, targetPrinter, settings);
    }

    // 1. Commit and save tickets to KDS and activeTableTickets synchronously
    splitAndFireTickets({
      tableId,
      tableNumber,
      zoneName,
      waiterName,
      guestsCount,
      notes: notesToFire || undefined,
      items: kotItems
    }).then(result => {
      setSlipModalKitchenTicket(result.kitchenTicket || null);
      setSlipModalBarTicket(result.barTicket || null);

      if (result.kitchenTicket && result.barTicket) {
        setKotSuccessBanner(`🎉 Fired & Printed: ${result.kitchenTicket.kotNumber} (Kitchen) & ${result.barTicket.kotNumber} (Bar) for ${tableNumber}!`);
      } else if (result.barTicket) {
        setKotSuccessBanner(`🍸 Fired & Printed: ${result.barTicket.kotNumber} to Bar for ${tableNumber}!`);
      } else if (result.kitchenTicket) {
        setKotSuccessBanner(`👨‍🍳 Fired & Printed: ${result.kitchenTicket.kotNumber} to Kitchen for ${tableNumber}!`);
      } else {
        setKotSuccessBanner(`✓ Order fired & printed for ${tableNumber}!`);
      }

      setTimeout(() => {
        setKotSuccessBanner(null);
      }, 7000);
    }).catch(err => {
      console.error('Error firing order:', err);
    }).finally(() => {
      setIsFiringOrder(false);
      setTimeout(() => {
        isFiringRef.current = false;
        isHydratingRef.current = false;
      }, 500);
    });

    // 2. Clear draft cart and table drafts immediately so duplicate order cannot be fired
    setCart([]);
    setKitchenSpecialNotes('');
    clearTableDraft(tableId);
    if (selectedTableId) {
      clearTableDraft(selectedTableId);
    }

    // 3. TRIGGER PRINT SYNCHRONOUSLY IN DIRECT USER CLICK (Zero await delay guarantees Chrome print popup!)
    try {
      safeThermalWindowPrint(slipHtml, targetPrinter.paperWidth);
    } catch (printErr) {
      console.warn('Direct print attempt:', printErr);
    }
  };

  // Reprint ticket straight away on user action
  const handleReprintTicket = (ticket: KitchenOrderTicket) => {
    const isBar = ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT';
    const targetPrinter = printers.find(p => p.isActive && (p.station === (isBar ? 'bar' : 'kitchen') || p.station === 'all')) || printers[0] || INITIAL_PRINTERS[0];
    const slipHtml = isBar 
      ? generateBOTSlipHtml(ticket, targetPrinter, settings, true)
      : generateKOTSlipHtml(ticket, targetPrinter, settings, true);
    
    try {
      safeThermalWindowPrint(slipHtml, targetPrinter.paperWidth);
      setKotSuccessBanner(`🖨️ ${ticket.kotNumber} printed straight away!`);
      setTimeout(() => setKotSuccessBanner(null), 4000);
    } catch (e: any) {
      console.warn('Straight-away reprint error:', e);
    }
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
  const handleExecuteTableManage = async () => {
    if (!activeDiningTable || isExecutingManage) return;

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

    if (!targetTableId) {
      setManageNotice('Please select a target table to continue.');
      return;
    }

    setIsExecutingManage(true);
    setManageNotice('');

    try {
      if (manageTab === 'transfer') {
        const success = await transferTable(activeDiningTable.id, targetTableId);
        if (success) {
          setShowManageTableModal(false);
        } else {
          setManageNotice('Failed to transfer table. Please check destination table.');
        }
      } else if (manageTab === 'merge') {
        const success = await mergeTables(activeDiningTable.id, targetTableId);
        if (success) {
          setShowManageTableModal(false);
        } else {
          setManageNotice('Failed to merge tables. Please try again.');
        }
      } else if (manageTab === 'swap') {
        const success = await swapTables(activeDiningTable.id, targetTableId);
        if (success) {
          setShowManageTableModal(false);
        } else {
          setManageNotice('Failed to swap tables. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error managing table:', err);
      setManageNotice('An error occurred during table operation.');
    } finally {
      setIsExecutingManage(false);
    }
  };

  // TABLE CLICK ACTION ON INTERACTIVE FLOOR CANVAS
  const handleCanvasTableClick = (table: DiningTable) => {
    if (table.status === 'available') {
      // Table is empty: open quick guest count prompt
      setPendingGuestTable(table);
      setGuestCountInput(table.capacity || 2);
      setWaiterInput(table.assignedWaiter || activePOSStaff?.name || currentUser.name);
    } else {
      // Table is already seated, cooking, or billed: immediately open its order
      setSelectedTableId(table.id);
      setIsTakeawayMode(false);
    }
  };

  const handleConfirmGuestCount = async () => {
    if (!pendingGuestTable) return;
    await assignTableGuests(pendingGuestTable.id, guestCountInput, waiterInput);
    setSelectedTableId(pendingGuestTable.id);
    setIsTakeawayMode(false);
    setPendingGuestTable(null);
  };

  const handleSwitchBackToFloorPlan = () => {
    setSelectedTableId(null);
    setIsTakeawayMode(false);
    setIsSettlingBill(false);
  };

  // =========================================================================
  // SCREEN 1: INTERACTIVE FLOOR PLAN CANVAS VIEW (Shown first if no table selected)
  // =========================================================================
  if (!selectedTableId && !isTakeawayMode) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto select-none">
        
        {/* FLOOR CANVAS TOP CONTROL BAR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Restaurant Floor Plan</span>
                  <span className="text-3xs font-mono font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    Step 1: Select Table
                  </span>
                </h1>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Click any dining table on the layout canvas to start order taking or manage running bill
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Takeaway Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedTableId(null);
                  setIsTakeawayMode(true);
                }}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <ShoppingBag className="w-4 h-4 text-amber-600" />
                <span>Quick Takeaway / Counter (No Table)</span>
              </button>

              {/* Operator Switch Button */}
              <button
                type="button"
                onClick={() => setShowStaffSwitchModal(true)}
                title="Switch active operator PIN"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <div 
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-black shadow-xs"
                  style={{ backgroundColor: activePOSStaff?.avatarColor || '#2563eb' }}
                >
                  {activePOSStaff?.name.slice(0, 1) || 'O'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                    {activePOSStaff?.name.split(' ')[0] || currentUser.name}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize block leading-none font-medium">
                    {activePOSStaff?.role.replace(/_/g, ' ') || 'Staff'} • PIN
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* FLOORS & SECTIONS ROW */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Floor Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-12 shrink-0 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
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
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
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
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">Section:</span>
                <button
                  type="button"
                  onClick={() => setActiveSectionId('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    activeSectionId === 'ALL'
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All
                </button>
                {activeFloorSections.map(sec => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      activeSectionId === sec.id
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* STATUS PILLS */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFloorStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                floorStatusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              All ({floorStats.all})
            </button>

            <button
              type="button"
              onClick={() => setFloorStatusFilter('available')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                floorStatusFilter === 'available'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Available ({floorStats.available})</span>
            </button>

            <button
              type="button"
              onClick={() => setFloorStatusFilter('seated')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                floorStatusFilter === 'seated'
                  ? 'bg-sky-500 text-white font-black'
                  : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>Seated ({floorStats.seated})</span>
            </button>

            <button
              type="button"
              onClick={() => setFloorStatusFilter('cooking')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                floorStatusFilter === 'cooking'
                  ? 'bg-amber-500 text-white font-black'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Cooking ({floorStats.cooking})</span>
            </button>

            <button
              type="button"
              onClick={() => setFloorStatusFilter('billed')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                floorStatusFilter === 'billed'
                  ? 'bg-purple-600 text-white font-black'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Billed ({floorStats.billed})</span>
            </button>

            <button
              type="button"
              onClick={() => setFloorStatusFilter('draft')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                floorStatusFilter === 'draft'
                  ? 'bg-rose-600 text-white font-black shadow-xs ring-2 ring-rose-400/50'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Drafts ({floorStats.draft})</span>
            </button>
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
                  <option value={activePOSStaff?.name || currentUser.name}>
                    {activePOSStaff?.name || currentUser.name} (Current Staff)
                  </option>
                  {staffMembers.map(staff => (
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

        {/* Staff PIN Switcher Modal */}
        <StaffPinSwitchModal
          isOpen={showStaffSwitchModal}
          onClose={() => setShowStaffSwitchModal(false)}
        />

      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: MENU SELECTION & TABLE ORDER TICKET (Exact Match to User Sketch)
  // =========================================================================
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full max-w-7xl mx-auto select-none">
      
      {/* LEFT PANEL: MENU & ITEM SELECTION */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* 1. TOP BAR: [ Back to Floor Plan ] + Search Bar + Operator Chip */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs flex items-center gap-2.5">
          {/* Back to Floor Canvas Button */}
          <button
            type="button"
            onClick={handleSwitchBackToFloorPlan}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
            title="Return to visual floor layout"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Floor Plan</span>
          </button>

          {/* Search Bar with Instant Typo Tolerance */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search dishes (e.g. momo, chiken, biryani, chowmein, beer, SKU...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchQuery('');
              }}
              autoComplete="off"
              spellCheck="false"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                title="Clear search (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Operator Chip */}
          <button
            type="button"
            onClick={() => setShowStaffSwitchModal(true)}
            title="Switch operator PIN"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            <div 
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-xs"
              style={{ backgroundColor: activePOSStaff?.avatarColor || '#2563eb' }}
            >
              {activePOSStaff?.name.slice(0, 1) || 'O'}
            </div>
            <div className="text-left hidden md:block">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                {activePOSStaff?.name.split(' ')[0] || currentUser.name}
              </span>
              <span className="text-[10px] text-slate-400 capitalize block leading-none font-medium">
                {activePOSStaff?.role.replace(/_/g, ' ') || 'Staff'}
              </span>
            </div>
          </button>
        </div>

        {/* 2. ROOT DEPARTMENT SLIDER ROW (Only real departments from products) */}
        {departments.length > 1 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ChefHat className="w-3 h-3 text-blue-600" />
                <span>Root Department</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {departments.map(dept => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDepartment(dept)}
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
          </div>
        )}

        {/* 3. CATEGORY SLIDER ROW (Only real categories from products) */}
        {categories.length > 1 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-blue-600" />
                <span>Category</span>
              </span>
              {selectedCategory !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className="text-3xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
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
          </div>
        )}

        {/* 4. NESTED BOX: SUB-CATEGORY + PREP-STYLE + PRODUCT CARD GRID */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-sm flex-1 flex flex-col gap-3 min-h-[380px]">
          
          {/* Sub - Category Row (Only real sub-categories if present) */}
          {subCategories.length > 1 && (
            <div className="space-y-1 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Sub - Category
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {subCategories.map(sc => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setSelectedSubCategory(sc)}
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
            </div>
          )}

          {/* Prep - style Row (Only real prep styles if present) */}
          {prepStyles.length > 1 && (
            <div className="space-y-1 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Prep - style
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
            </div>
          )}

          {/* PRODUCT CARD GRID WITH DEDICATED "ADD ON" BUTTON */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-3xs font-mono font-bold text-slate-600 dark:text-slate-300">
                  {filteredProducts.length} dish{filteredProducts.length !== 1 ? 'es' : ''} available
                </span>
                {searchQuery.trim() && (
                  <span className="text-3xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                    "{searchQuery.trim()}"
                  </span>
                )}
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

              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-3xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>

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
                {filteredProducts.map(product => {
                  const customerPrice = getProductPriceForCustomer(product, selectedCustomer);
                  const isOutOfStock = product.currentStock <= 0;
                  const inCartCount = cart
                    .filter(c => c.productId === product.id)
                    .reduce((sum, c) => sum + c.quantity, 0);

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={`relative overflow-hidden p-3 rounded-2xl border-2 text-left flex flex-col justify-between transition-all duration-150 cursor-pointer select-none active:scale-98 ${
                        isOutOfStock
                          ? 'opacity-40 border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40'
                          : inCartCount > 0
                          ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 bg-white dark:bg-slate-900 shadow-2xs'
                      }`}
                    >
                      {/* Top Info */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-3xs font-mono text-slate-400">
                            {product.sku}
                          </span>
                          {inCartCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-3xs flex items-center justify-center">
                              {inCartCount}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                          {product.name}
                        </h4>

                        <div className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                          {formatNPR(customerPrice)}
                        </div>
                      </div>

                      {/* Card Action: Dedicated "Add on" Button */}
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleOpenAddonModal(product, e)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-3xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                          title="Configure modifiers & add-ons"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Add on</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold transition-colors cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* RIGHT PANEL: TABLE ORDER TICKET & SETTLE BILL */}
      <div className="w-full lg:w-[410px] xl:w-[430px] bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shrink-0 flex flex-col shadow-md">
        
        {isSettlingBill ? (
          /* =========================================================================
             SETTLE BILL & PAYMENT VIEW (EXACTLY MATCHING USER SCREENSHOT)
             ========================================================================= */
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in">
            {/* Top Bar: Back to order & Table/Takeaway info */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsSettlingBill(false)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-600" />
                <span>Back to Order</span>
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {activeDiningTable ? `Table ${activeDiningTable.tableNumber}` : 'Takeaway'}
                </span>
                <span className="text-3xs text-slate-400 font-mono">
                  {allBillItems.length} dish{allBillItems.length > 1 ? 'es' : ''}
                </span>
              </div>
            </div>

            {/* Settle Bill Content: Matches Screenshot Pixel-for-Pixel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* 1. AMOUNT RECEIVED */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider">
                    AMOUNT RECEIVED
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaidAmountInput(String(grandTotal))}
                    className="text-3xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Exact (Rs. {grandTotal})
                  </button>
                </div>
                <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/30">
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
                {paidAmountNumber > grandTotal && (
                  <div className="text-3xs font-bold text-emerald-600 flex justify-between px-1">
                    <span>Change to Return:</span>
                    <span className="font-mono">{formatNPR(changeToReturn)}</span>
                  </div>
                )}
                {paidAmountNumber < grandTotal && paidAmountNumber > 0 && (
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
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'fonepay', label: 'Fonepay' },
                    { id: 'bank_transfer', label: 'Bank' },
                    { id: 'connectips', label: 'ConnectIPS' },
                    { id: 'cheque', label: 'Cheque' },
                    { id: 'credit', label: 'Credit (बाँकी)' },
                  ].map(pm => {
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500 shadow-2xs ring-1 ring-indigo-500/30'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        {pm.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. DISCOUNT */}
              <div className="space-y-1.5">
                <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                  DISCOUNT
                </label>
                <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30">
                  <div className="px-3 text-slate-400 font-mono text-xs">
                    {discountType === 'percent' ? '%' : 'Rs.'}
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="0"
                    className="flex-1 py-1.5 text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100 outline-hidden bg-transparent pr-3"
                  />
                  <div className="flex p-0.5 gap-0.5 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2.5 py-1 rounded text-2xs font-bold cursor-pointer transition-colors ${
                        discountType === 'percent'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('rs')}
                      className={`px-2.5 py-1 rounded text-2xs font-bold cursor-pointer transition-colors ${
                        discountType === 'rs'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      Rs
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. CUSTOMER */}
              <div className="space-y-1.5">
                <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                  CUSTOMER
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-hidden truncate"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerType})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>+ Add</span>
                  </button>
                </div>
              </div>

              {/* 5. SUMMARY BREAKDOWN */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">Rs. {subtotal.toFixed(0)}</span>
                </div>

                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Discount :</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">Rs. {grossDiscount.toFixed(0)}</span>
                </div>

                <div className="flex justify-between text-slate-500 font-medium">
                  <span>VAT ({defaultVatRate}%):</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">Rs. {taxAmount.toFixed(0)}</span>
                </div>

                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline font-black">
                  <span className="text-xs uppercase text-slate-900 dark:text-slate-100">Total Payable:</span>
                  <span className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                    Rs. {grandTotal.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* 6. COMPLETE SALE & PRINT BUTTON */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFinalCompleteSaleAndPrint}
                  disabled={allBillItems.length === 0 || isCompletingSale}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    allBillItems.length === 0 || isCompletingSale
                      ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                      : 'bg-slate-200 hover:bg-indigo-600 text-slate-700 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-600 dark:hover:text-white shadow-xs'
                  }`}
                >
                  <Check className="w-4 h-4 text-indigo-600 group-hover:text-white" />
                  <span>{isCompletingSale ? 'Completing Sale & Printing...' : 'Complete Sale & Print'}</span>
                </button>
              </div>

            </div>
          </div>
        ) : (
          /* STANDARD ORDER TICKET PANEL */
          <>
            {/* TICKET TOP HEADER: [ X Switch Table ] Table Order Ticket [ Manage ] */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSwitchBackToFloorPlan}
                className="w-7 h-7 rounded-xl bg-slate-200/80 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/60 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
                title="Switch Table (Back to Floor Layout)"
              >
                ✕
              </button>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed className="w-4 h-4 text-blue-600" />
                <span>Table Order Ticket</span>
              </h2>

              {/* Action Button: Manage (Transfer, Merge, Swap, Details) right beside Table Order Ticket */}
              {activeDiningTable && (
                <button
                  type="button"
                  onClick={() => {
                    setManageTab('transfer');
                    setTargetTableId('');
                    setManageNotice('');
                    setTempGuestCount(activeDiningTable.currentGuests || 2);
                    setTempWaiterName(activeDiningTable.assignedWaiter || activePOSStaff?.name || currentUser.name);
                    setShowManageTableModal(true);
                  }}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/90 text-indigo-700 dark:text-indigo-300 rounded-lg text-2xs font-extrabold border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 ml-1"
                  title="Manage Table: Transfer, Merge, Swap or Update Guests"
                >
                  <ArrowLeftRight className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Manage</span>
                </button>
              )}
            </div>

            {/* Table Number or Takeaway Badge */}
            {activeDiningTable ? (
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Table {activeDiningTable.tableNumber}
              </span>
            ) : (
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Takeaway
              </span>
            )}
          </div>

          {/* TABLE & STAFF ROW WITH [ KOT / BOT ] BUTTON */}
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 shadow-2xs">
            <div className="space-y-0.5 min-w-0">
              {/* Table : Floor (Table No.) */}
              <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                <span className="text-slate-400 font-bold">Table: </span>
                {activeDiningTable ? (
                  <span>
                    {activeDiningTable.floorName || currentFloor?.name || 'Main Floor'} ({activeDiningTable.tableNumber})
                  </span>
                ) : (
                  <span className="text-amber-600 font-bold">Walk-in Takeaway / Counter</span>
                )}
              </div>

              {/* Staff : _______ */}
              <div className="text-2xs font-bold text-slate-600 dark:text-slate-300 truncate">
                <span className="text-slate-400">Staff: </span>
                <span>{activeDiningTable?.assignedWaiter || activePOSStaff?.name || currentUser.name}</span>
                {activeDiningTable && (
                  <span className="text-slate-400 font-normal ml-2">
                    ({activeDiningTable.currentGuests || 2} guests)
                  </span>
                )}
              </div>
            </div>

            {/* [ KOT / BOT ] ACTION BUTTON */}
            <button
              type="button"
              onClick={handleFireKOT}
              disabled={isFiringOrder || cart.length === 0 || (!activeDiningTable && !isTakeawayMode)}
              className={`px-4 py-2.5 rounded-full text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                cart.length > 0
                  ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white shadow-blue-500/25 ring-2 ring-blue-400/40'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
              }`}
              title={
                cart.length > 0
                  ? "Send order to kitchen and print KOT ticket"
                  : activeTableTickets.length > 0
                  ? "First order is already fired to kitchen. Add new dishes from menu to fire another round."
                  : "Select items from the menu to fire order"
              }
            >
              <ChefHat className={`w-4 h-4 ${isFiringOrder ? 'animate-spin' : ''}`} />
              <span>
                {isFiringOrder
                  ? 'Firing & Printing...'
                  : cart.length > 0 
                  ? `Fire Order (${cart.length})` 
                  : activeTableTickets.length > 0 
                  ? 'Order Fired ✓' 
                  : 'Fire Order'}
              </span>
            </button>
          </div>

          {/* Table Draft Auto-Saved Indicator */}
          {activeDiningTable && cart.length > 0 && (
            <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-3xs font-bold flex items-center justify-between gap-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>Unfired Items (Ready to Fire) • {cart.length} item{cart.length > 1 ? 's' : ''}</span>
              </div>
              <button
                type="button"
                onClick={handleClearDraft}
                className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline cursor-pointer text-3xs font-extrabold"
              >
                Clear
              </button>
            </div>
          )}

          {/* KOT success banner */}
          {kotSuccessBanner && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-3xs font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{kotSuccessBanner}</span>
            </div>
          )}
        </div>

        {/* RUNNING ORDER ITEMS LIST */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activeTableTickets.length === 0 && cart.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400">
              <ShoppingCart className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Ticket is empty</p>
              <p className="text-3xs text-slate-400 mt-0.5">
                Select items from the menu on the left to start this table's order
              </p>
            </div>
          ) : (
            <>
              {/* 1. FIRED ORDERS SECTION (Running KOT / BOT orders already dispatched to kitchen/bar) */}
              {activeTableTickets.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1 py-1 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        Fired Orders ({firedSaleItems.reduce((s, i) => s + i.quantity, 0)} {firedSaleItems.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'items'}{activeTableTickets.length > 1 ? ` · ${activeTableTickets.length} tickets` : ''})
                      </span>
                    </div>
                    <span className="text-3xs text-slate-400 font-mono">
                      In Progress
                    </span>
                  </div>

                  {activeTableTickets.map(ticket => (
                    <div 
                      key={ticket.id}
                      className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2.5 shadow-2xs"
                    >
                      {/* Ticket Header: Unboxed, spacious, no wrapping */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
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
                                : 'bg-amber-500 animate-pulse'
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

                        {/* Right: Timestamp & Clean Reprint Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-3xs text-slate-400 font-mono">
                            {Math.max(0, Math.floor((Date.now() - ticket.createdAt) / 60000))}m ago
                          </span>
                          <button
                            type="button"
                            onClick={() => handleReprintTicket(ticket)}
                            className="px-2 py-0.5 rounded-lg text-3xs font-bold text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white bg-white hover:bg-slate-100 dark:bg-slate-700/80 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-600 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="View and print thermal ticket slip"
                          >
                            <Printer className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>Print Slip</span>
                            {ticket.printedCount && ticket.printedCount > 1 && (
                              <span className="font-mono text-3xs text-slate-400">×{ticket.printedCount}</span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Ticket Items List: Clean, high legibility */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/50">
                        {ticket.items.map((kItem, kIdx) => (
                          <div key={kIdx} className="flex items-baseline justify-between text-xs py-0.5">
                            <div className="flex items-baseline gap-2 min-w-0 pr-2">
                              <span className="font-mono font-black text-xs text-slate-700 dark:text-slate-300 shrink-0">
                                {kItem.quantity}×
                              </span>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                                  {kItem.productName}
                                </span>
                                {kItem.specialInstructions && (
                                  <span className="text-3xs text-amber-600 dark:text-amber-400 italic block mt-0.5">
                                    Note: {kItem.specialInstructions}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                {formatNPR(kItem.quantity * kItem.unitPrice)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Informative notice when current orders are cooking and cart is empty */}
              {activeTableTickets.length > 0 && cart.length === 0 && (
                <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/50 text-center space-y-1">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Orders are active in Kitchen &amp; Bar!</span>
                  </p>
                  <p className="text-3xs text-slate-500">
                    Select additional items from the menu to punch a second round, or click Settle Bill below when guests finish.
                  </p>
                </div>
              )}

              {/* 2. NEW ITEMS TO FIRE (DRAFT / CURRENT ROUND) */}
              {cart.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-1 py-1 border-b border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-300">
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {activeTableTickets.length > 0 ? `New Round Items (${cart.length})` : `New Items (${cart.length})`}
                      </span>
                    </div>
                    <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Ready to Fire
                    </span>
                  </div>

                  {cart.map((item, index) => (
                    <div
                      key={`${item.productId}-${index}`}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {item.productName}
                          </p>
                          <p className="text-3xs text-slate-500 font-mono">
                            {formatNPR(item.unitPrice)} each
                          </p>

                          {/* Addons List display */}
                          {item.addonsList && item.addonsList.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.addonsList.map((addon, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="text-3xs px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800"
                                >
                                  +{addon.name} ({formatNPR(addon.price)})
                                </span>
                              ))}
                            </div>
                          )}

                          {item.itemNotes && (
                            <p className="text-3xs text-amber-600 italic mt-0.5">
                              Note: {item.itemNotes}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setItemToVoid({ index, item })}
                          title="Void item (PIN verified & logged)"
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Quantity Stepper & Line Total */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                            className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-black">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                            className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">
                          {formatNPR(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* BOTTOM SUMMARY & BILL SETTLEMENT */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 space-y-2.5">
          
          {/* Amount Breakdown */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Running Subtotal:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(subtotal)}</span>
            </div>

            {grossDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount:</span>
                <span className="font-mono">-{formatNPR(grossDiscount)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-500 font-medium">
              <span>VAT ({defaultVatRate}%):</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(taxAmount)}</span>
            </div>

            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline font-black text-slate-900 dark:text-slate-100">
              <span className="text-xs uppercase">Total Payable:</span>
              <span className="text-base font-mono text-blue-600 dark:text-blue-400">
                {formatNPR(grandTotal)}
              </span>
            </div>
          </div>

          {/* Settle Bill Button */}
          <button
            type="button"
            onClick={handleOpenSettleBill}
            disabled={allBillItems.length === 0}
            className={`w-full py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              allBillItems.length === 0
                ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                : 'btn-pill-primary'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Settle &amp; Print Bill ({allBillItems.length} dish{allBillItems.length > 1 ? 'es' : ''})</span>
          </button>
        </div>

      </>
    )}
  </div>

      {/* MANAGE TABLE MODAL (Transfer, Merge, Swap, Guests & Staff) */}
      {showManageTableModal && activeDiningTable && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
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
                  <p className="text-3xs text-slate-400">
                    Running: {allBillItems.length} dish{allBillItems.length > 1 ? 'es' : ''} • Subtotal: {formatNPR(subtotal)}
                  </p>
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

            {/* Tab Navigation: Transfer, Merge, Swap, Details */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
              <button
                type="button"
                onClick={() => { setManageTab('transfer'); setManageNotice(''); }}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  manageTab === 'transfer'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => { setManageTab('merge'); setManageNotice(''); }}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  manageTab === 'merge'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Merge</span>
              </button>
              <button
                type="button"
                onClick={() => { setManageTab('swap'); setManageNotice(''); }}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  manageTab === 'swap'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Swap</span>
              </button>
              <button
                type="button"
                onClick={() => { setManageTab('details'); setManageNotice(''); }}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  manageTab === 'details'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Details</span>
              </button>
            </div>

            {/* Notice Message Banner */}
            {manageNotice && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-medium">
                {manageNotice}
              </div>
            )}

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5">
              {manageTab === 'transfer' && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200">
                    <p className="font-bold">Move Table {activeDiningTable.tableNumber} Order</p>
                    <p className="text-3xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                      All active KOT tickets and draft dishes will be moved to the selected destination table. Table {activeDiningTable.tableNumber} will become available.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Select Destination Table:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1">
                      {diningTables.filter(t => t.id !== activeDiningTable.id).map(tbl => {
                        const isSelected = targetTableId === tbl.id;
                        const isAvail = tbl.status === 'available';
                        return (
                          <div
                            key={tbl.id}
                            onClick={() => setTargetTableId(tbl.id)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/80 ring-2 ring-indigo-500/30'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-xs text-slate-900 dark:text-slate-100">
                                Table {tbl.tableNumber}
                              </span>
                              <span className={`text-3xs px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                isAvail 
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}>
                                {isAvail ? 'Empty' : 'Occupied'}
                              </span>
                            </div>
                            <p className="text-3xs text-slate-400 mt-0.5 truncate">
                              {tbl.floorName || 'Floor'} • {tbl.capacity} seats
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {manageTab === 'merge' && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 text-xs text-purple-900 dark:text-purple-200">
                    <p className="font-bold">Merge Table {activeDiningTable.tableNumber} into another Table</p>
                    <p className="text-3xs text-purple-700 dark:text-purple-300 mt-0.5">
                      Combines this table's orders with the target table into a single unified bill. Table {activeDiningTable.tableNumber} will be freed up.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Select Target Table to Merge With:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1">
                      {diningTables.filter(t => t.id !== activeDiningTable.id).map(tbl => {
                        const isSelected = targetTableId === tbl.id;
                        const isOccupied = tbl.status !== 'available';
                        return (
                          <div
                            key={tbl.id}
                            onClick={() => setTargetTableId(tbl.id)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'border-purple-600 bg-purple-50/80 dark:bg-purple-950/80 ring-2 ring-purple-500/30'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-xs text-slate-900 dark:text-slate-100">
                                Table {tbl.tableNumber}
                              </span>
                              <span className={`text-3xs px-1.5 py-0.5 rounded-full font-bold ${
                                isOccupied
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                                {isOccupied ? 'Has Order' : 'Empty'}
                              </span>
                            </div>
                            <p className="text-3xs text-slate-400 mt-0.5 truncate">
                              {tbl.floorName || 'Floor'} • {tbl.capacity} seats
                            </p>
                            {tbl.subtotal && tbl.subtotal > 0 ? (
                              <p className="text-3xs font-mono font-bold text-purple-600 dark:text-purple-400 mt-1">
                                Running: Rs. {tbl.subtotal}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {manageTab === 'swap' && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
                    <p className="font-bold">Swap Table {activeDiningTable.tableNumber} with another Table</p>
                    <p className="text-3xs text-blue-700 dark:text-blue-300 mt-0.5">
                      Exchanges orders, active KOTs, and guest details between Table {activeDiningTable.tableNumber} and the selected table.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Select Table to Swap With:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1">
                      {diningTables.filter(t => t.id !== activeDiningTable.id).map(tbl => {
                        const isSelected = targetTableId === tbl.id;
                        return (
                          <div
                            key={tbl.id}
                            onClick={() => setTargetTableId(tbl.id)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/80 ring-2 ring-blue-500/30'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black text-xs text-slate-900 dark:text-slate-100">
                                Table {tbl.tableNumber}
                              </span>
                              <span className="text-3xs px-1.5 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                                {tbl.status}
                              </span>
                            </div>
                            <p className="text-3xs text-slate-400 mt-0.5 truncate">
                              {tbl.floorName || 'Floor'} • {tbl.currentGuests || tbl.capacity} guests
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
                      <option value={activePOSStaff?.name || currentUser.name}>
                        {activePOSStaff?.name || currentUser.name} (Current Staff)
                      </option>
                      {staffMembers.map(staff => (
                        <option key={staff.id} value={staff.name}>
                          {staff.name} ({staff.role})
                        </option>
                      ))}
                    </select>
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
                onClick={handleExecuteTableManage}
                disabled={isExecutingManage || (manageTab !== 'details' && !targetTableId)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                  isExecutingManage || (manageTab !== 'details' && !targetTableId)
                    ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25'
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
                ) : (
                  <span>Save Details</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADDON CUSTOMIZATION MODAL (Uses ONLY real product addons or kitchen notes) */}
      {addonItemProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Customization: {addonItemProduct.name}
                </h3>
                <p className="text-3xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                  Base Price: {formatNPR(getProductPriceForCustomer(addonItemProduct, selectedCustomer))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddonItemProduct(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Real Product Addons List (if defined on this specific product) */}
            {addonItemProduct.customAddons && addonItemProduct.customAddons.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Select Add-ons:
                </label>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {addonItemProduct.customAddons.map(addon => {
                    const isChecked = selectedAddons.some(a => a.name === addon.name);
                    return (
                      <div
                        key={addon.name}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedAddons(prev => prev.filter(a => a.name !== addon.name));
                          } else {
                            setSelectedAddons(prev => [...prev, addon]);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-blue-600"
                          />
                          <span>{addon.name}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">
                          +{formatNPR(addon.price)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-3xs text-slate-500">
                No pre-configured extra add-ons for this item. You can enter specific kitchen cooking instructions below.
              </div>
            )}

            {/* Special Instruction / Kitchen Notes */}
            <div>
              <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Special Kitchen Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Less spicy, serve starter first, dip on side..."
                value={addonSpecialNote}
                onChange={(e) => setAddonSpecialNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAddonItemProduct(null)}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddonModal}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Add to Ticket</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE SUCCESS / RECEIPT MODAL */}
      {completedInvoice && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
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

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 font-mono text-sm font-black text-blue-600 dark:text-blue-400">
              Total Paid: {formatNPR(completedInvoice.grandTotal)}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletedInvoice(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  await printBillForInvoice(completedInvoice, activeDiningTable || null);
                  setCompletedInvoice(null);
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full text-xs font-black shadow-md shadow-blue-500/25 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill (Thermal)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff PIN Switcher Modal */}
      <StaffPinSwitchModal
        isOpen={showStaffSwitchModal}
        onClose={() => setShowStaffSwitchModal(false)}
      />

      {/* Item Void PIN & Reason Modal */}
      <ItemVoidConfirmModal
        isOpen={!!itemToVoid}
        item={itemToVoid?.item || null}
        tableNumber={activeDiningTable?.tableNumber}
        onClose={() => setItemToVoid(null)}
        onConfirm={() => {
          if (itemToVoid) {
            removeFromCart(itemToVoid.index);
            setItemToVoid(null);
          }
        }}
      />

      {/* Safe Thermal KOT / BOT Slip Print & Preview Modal */}
      <ThermalSlipModal
        isOpen={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        kitchenTicket={slipModalKitchenTicket}
        barTicket={slipModalBarTicket}
        initialStation={slipModalStation}
      />

    </div>
  );
};

export default POSView;
