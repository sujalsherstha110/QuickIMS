import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, Check, 
  Printer, ArrowRight, UserPlus, CreditCard, DollarSign,
  QrCode, User, FileText, ChevronDown, CheckCircle2, RotateCcw,
  X, Tag, ArrowLeft, Receipt, Flame, UtensilsCrossed, ChefHat, 
  Wine, Cake, Sparkles, Settings, Layers, Building2, ShoppingBag,
  Circle, Square, RectangleHorizontal, LayoutGrid, Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, Customer, SaleItem, SaleInvoice, DiningTable, StaffMember, KitchenOrderTicket } from '../../types';
import { formatNPR, numberToWordsNPR, formatDate } from '../../utils/nepalFormatters';
import { InteractiveFloorCanvas } from './InteractiveFloorCanvas';
import { StaffPinSwitchModal } from './StaffPinSwitchModal';
import { ItemVoidConfirmModal } from './ItemVoidConfirmModal';
import { ThermalSlipModal, ThermalSlipItem } from '../common/ThermalSlipModal';
import { generateKOTSlipHtml, generateBOTSlipHtml, generateBillReceiptSlipHtml } from '../../utils/printerService';
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
    staffMembers, assignTableGuests, activePOSStaff,
    printers, printKOTForTicket, printBOTForTicket, printBillForInvoice
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

  // Table Manage Modal
  const [showManageTableModal, setShowManageTableModal] = useState<boolean>(false);
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

  // Table Draft Synchronization (Preserves cart per table & reflects red fill on floor canvas)
  const isHydratingRef = React.useRef(false);

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
      return () => clearTimeout(timer);
    } else if (!isTakeawayMode) {
      setCart([]);
      setKitchenSpecialNotes('');
      setDiscountInput('0');
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
  // Thermal Slip Modal State for KOT / BOT / Bill
  const [thermalModalState, setThermalModalState] = useState<{ isOpen: boolean; tickets: ThermalSlipItem[]; autoPrintNotice?: string } | null>(null);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  // Filtered Products based on Sketch Hierarchy
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Department match
      if (selectedDepartment !== 'ALL' && p.department !== selectedDepartment) {
        return false;
      }

      // 2. Category match
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }

      // 3. Sub-Category match
      if (selectedSubCategory !== 'ALL') {
        const pSub = p.subCategory || p.subcategory || '';
        if (pSub !== selectedSubCategory) return false;
      }

      // 4. Prep-Style match
      if (selectedPrepStyle !== 'ALL' && p.prepStyle !== selectedPrepStyle) {
        return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSearch = p.name.toLowerCase().includes(q) ||
                            p.sku.toLowerCase().includes(q) ||
                            (p.barcode && p.barcode.includes(q)) ||
                            (p.category && p.category.toLowerCase().includes(q));
        if (!matchSearch) return false;
      }

      return p.status === 'active';
    });
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

  // Add Product to Cart directly
  const addToCart = (product: Product, addons?: { name: string; price: number }[], notes?: string) => {
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

  // Active KOT / BOT Tickets for current selected table (orders already fired to kitchen/bar)
  const activeTableTickets = useMemo(() => {
    if (!activeDiningTable) return [];
    return kitchenTickets.filter(k => 
      (k.tableId === activeDiningTable.id || k.tableNumber === activeDiningTable.tableNumber) && 
      !k.isSettled && 
      k.status !== 'cancelled'
    );
  }, [kitchenTickets, activeDiningTable]);

  // Convert fired KOT items to sale items for billing and running order display
  const firedSaleItems = useMemo<SaleItem[]>(() => {
    if (!activeDiningTable || activeTableTickets.length === 0) return [];
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
  }, [activeDiningTable, activeTableTickets, products, settings.defaultVatRate]);

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

  // Checkout / Settle Sale
  const handleCheckout = async () => {
    if (allBillItems.length === 0) return;

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
    }

    setCompletedInvoice(recorded);
    setCart([]);
    setDiscountInput('0');
    setPaymentReference('');
    setSalesNotes('');
    setKitchenSpecialNotes('');
    setSelectedTableId(null);
    setIsTakeawayMode(false);
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
    if (cart.length === 0 || isFiringOrder) return;
    if (!activeDiningTable && !isTakeawayMode) return;

    setIsFiringOrder(true);
    isHydratingRef.current = true; // Lock draft auto-saver so firing never re-saves draft

    const tableId = activeDiningTable?.id || 'takeaway-counter';
    const tableNumber = activeDiningTable?.tableNumber || 'Takeaway';
    const zoneName = activeDiningTable?.zoneName || activeDiningTable?.floorName || 'Counter';
    const waiterName = activeDiningTable?.assignedWaiter || activePOSStaff?.name || currentUser.name;
    const guestsCount = activeDiningTable?.currentGuests || 1;
    const itemsToFire = [...cart];
    const notesToFire = kitchenSpecialNotes;

    // Immediately clear local cart and table draft so UI immediately updates
    setCart([]);
    setKitchenSpecialNotes('');
    if (activeDiningTable) {
      clearTableDraft(tableId);
    }

    try {
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

      const result = await splitAndFireTickets({
        tableId,
        tableNumber,
        zoneName,
        waiterName,
        guestsCount,
        notes: notesToFire || undefined,
        items: kotItems
      });

      // Auto-print thermal slips to active printers and prepare modal preview
      const printLogs: string[] = [];
      const firedSlips: ThermalSlipItem[] = [];

      if (result.kitchenTicket) {
        const kitchenPrinters = printers.filter(p => p.isActive && (p.station === 'kitchen' || p.station === 'all'));
        const autoTargets = kitchenPrinters.filter(p => p.autoPrintKOT);
        const targetList = autoTargets.length > 0 ? autoTargets : (kitchenPrinters.length > 0 ? [kitchenPrinters[0]] : []);
        const pToUse = targetList[0] || printers.find(p => p.station === 'kitchen') || printers[0];

        if (pToUse) {
          const html = generateKOTSlipHtml(result.kitchenTicket, pToUse, settings);
          firedSlips.push({
            id: result.kitchenTicket.id,
            label: `Kitchen KOT (${result.kitchenTicket.kotNumber})`,
            station: 'kitchen',
            html,
            ticketNumber: result.kitchenTicket.kotNumber
          });

          for (const pr of (targetList.length > 0 ? targetList : [pToUse])) {
            try {
              const printRes = await printKOTForTicket(result.kitchenTicket, pr);
              if (printRes.success) {
                printLogs.push(`🖨️ ${result.kitchenTicket.kotNumber} sent to ${pr.name}`);
              } else {
                printLogs.push(`⚠️ ${pr.name}: ${printRes.message}`);
              }
            } catch (pErr: any) {
              console.error('KOT auto-print error:', pErr);
            }
          }
        }
      }

      if (result.barTicket) {
        const barPrinters = printers.filter(p => p.isActive && (p.station === 'bar' || p.station === 'all'));
        const autoTargets = barPrinters.filter(p => p.autoPrintBOT);
        const targetList = autoTargets.length > 0 ? autoTargets : (barPrinters.length > 0 ? [barPrinters[0]] : []);
        const pToUse = targetList[0] || printers.find(p => p.station === 'bar') || printers[0];

        if (pToUse) {
          const html = generateBOTSlipHtml(result.barTicket, pToUse, settings);
          firedSlips.push({
            id: result.barTicket.id,
            label: `Bar BOT (${result.barTicket.kotNumber})`,
            station: 'bar',
            html,
            ticketNumber: result.barTicket.kotNumber
          });

          for (const pr of (targetList.length > 0 ? targetList : [pToUse])) {
            try {
              const printRes = await printBOTForTicket(result.barTicket, pr);
              if (printRes.success) {
                printLogs.push(`🖨️ ${result.barTicket.kotNumber} sent to ${pr.name}`);
              } else {
                printLogs.push(`⚠️ ${pr.name}: ${printRes.message}`);
              }
            } catch (pErr: any) {
              console.error('BOT auto-print error:', pErr);
            }
          }
        }
      }

      // Open interactive thermal slip dialog so user can verify or 1-click print directly
      if (firedSlips.length > 0) {
        setThermalModalState({
          isOpen: true,
          tickets: firedSlips,
          autoPrintNotice: `Dispatched ${firedSlips.length} ticket(s) to printers • Ready to print or tear`
        });
      }

      const printSummary = printLogs.length > 0 ? ` (${printLogs.join(' • ')})` : '';

      if (result.kitchenTicket && result.barTicket) {
        setKotSuccessBanner(`🎉 Dispatched 2 Tickets: ${result.kitchenTicket.kotNumber} (Kitchen) & ${result.barTicket.kotNumber} (Bar) for ${tableNumber}!${printSummary}`);
      } else if (result.barTicket) {
        setKotSuccessBanner(`🍸 Dispatched Ticket ${result.barTicket.kotNumber} to Bar BOT for ${tableNumber}!${printSummary}`);
      } else if (result.kitchenTicket) {
        setKotSuccessBanner(`👨‍🍳 Dispatched Ticket ${result.kitchenTicket.kotNumber} to Kitchen KDS for ${tableNumber}!${printSummary}`);
      } else {
        setKotSuccessBanner(`✓ Order fired for ${tableNumber}!${printSummary}`);
      }

      setTimeout(() => {
        setKotSuccessBanner(null);
      }, 6000);
    } catch (err) {
      console.error('Error firing order:', err);
    } finally {
      setIsFiringOrder(false);
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 300);
    }
  };

  // Reprint all active tickets for currently selected table
  const handleReprintTableTickets = () => {
    if (activeTableTickets.length === 0) return;
    const slips: ThermalSlipItem[] = [];

    activeTableTickets.forEach(ticket => {
      const isBar = ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT';
      const targetPrinters = printers.filter(p => p.isActive && (p.station === (isBar ? 'bar' : 'kitchen') || p.station === 'all'));
      const pToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
      const html = isBar
        ? generateBOTSlipHtml(ticket, pToUse, settings)
        : generateKOTSlipHtml(ticket, pToUse, settings);

      slips.push({
        id: ticket.id,
        label: `${isBar ? 'Bar BOT' : 'Kitchen KOT'} (${ticket.kotNumber})`,
        station: isBar ? 'bar' : 'kitchen',
        html,
        ticketNumber: ticket.kotNumber
      });
    });

    if (slips.length > 0) {
      setThermalModalState({
        isOpen: true,
        tickets: slips,
        autoPrintNotice: `Reprinting ${slips.length} ticket(s) for Table ${activeDiningTable?.tableNumber || 'Takeaway'}`
      });
    }
  };

  // Manual print handler for specific fired ticket
  const handlePrintSpecificTicket = async (ticket: KitchenOrderTicket) => {
    try {
      const isBar = ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT';
      const targetPrinters = printers.filter(p => p.isActive && (p.station === (isBar ? 'bar' : 'kitchen') || p.station === 'all'));
      const pToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
      const html = isBar
        ? generateBOTSlipHtml(ticket, pToUse, settings)
        : generateKOTSlipHtml(ticket, pToUse, settings);

      setThermalModalState({
        isOpen: true,
        tickets: [{
          id: ticket.id,
          label: `${isBar ? 'Bar BOT' : 'Kitchen KOT'} (${ticket.kotNumber})`,
          station: isBar ? 'bar' : 'kitchen',
          html,
          ticketNumber: ticket.kotNumber
        }],
        autoPrintNotice: `Direct print slip for ${ticket.kotNumber}`
      });

      if (isBar) {
        await printBOTForTicket(ticket);
      } else {
        await printKOTForTicket(ticket);
      }
    } catch (e: any) {
      console.warn('Print ticket error:', e);
    }
  };

  // Manage Table Save
  const handleSaveTableManage = async () => {
    if (!activeDiningTable) return;
    await assignTableGuests(activeDiningTable.id, tempGuestCount, tempWaiterName);
    setShowManageTableModal(false);
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

          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Menu Items (Momo, Chowmein, Pizza, Drinks, SKU...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xs font-mono text-slate-400">
                {filteredProducts.length} items available
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400">
                <UtensilsCrossed className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No matching dishes</p>
                <p className="text-3xs text-slate-400">Try changing department, category, or search filter</p>
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

      {/* RIGHT PANEL: TABLE ORDER TICKET */}
      <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shrink-0 flex flex-col shadow-md">
        
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
            </div>

            {/* [ Manage ] Button */}
            {activeDiningTable && (
              <button
                type="button"
                onClick={() => setShowManageTableModal(true)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-3xs font-extrabold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Settings className="w-3 h-3 text-blue-600" />
                <span>Manage</span>
              </button>
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
              onClick={cart.length > 0 ? handleFireKOT : handleReprintTableTickets}
              disabled={isFiringOrder || (cart.length === 0 && activeTableTickets.length === 0) || (!activeDiningTable && !isTakeawayMode)}
              className={`px-4 py-2.5 rounded-full text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                cart.length > 0
                  ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white shadow-blue-500/25 ring-2 ring-blue-400/40'
                  : activeTableTickets.length > 0
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/30'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
              }`}
              title={
                cart.length > 0
                  ? "Automated smart distribution: routes food to Kitchen KDS and drinks to Bar BOT with instant thermal print"
                  : activeTableTickets.length > 0
                  ? "Preview, print or reprint thermal KOT / BOT tickets for this table"
                  : "Add items to menu ticket to fire order"
              }
            >
              {cart.length > 0 ? (
                <>
                  <ChefHat className={`w-4 h-4 ${isFiringOrder ? 'animate-spin' : ''}`} />
                  <span>{isFiringOrder ? 'Firing...' : `Fire Order (${cart.length})`}</span>
                </>
              ) : activeTableTickets.length > 0 ? (
                <>
                  <Printer className="w-4 h-4 text-emerald-100" />
                  <span>Reprint KOT / BOT ({activeTableTickets.length})</span>
                </>
              ) : (
                <>
                  <ChefHat className="w-4 h-4" />
                  <span>Fire Order</span>
                </>
              )}
            </button>
          </div>

          {/* Table Draft Auto-Saved Indicator */}
          {activeDiningTable && cart.length > 0 && (
            <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-3xs font-bold flex items-center justify-between gap-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span>Draft Saved (Red on Floor) • {cart.length} item{cart.length > 1 ? 's' : ''}</span>
              </div>
              <button
                type="button"
                onClick={handleClearDraft}
                className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 underline cursor-pointer text-3xs font-extrabold"
              >
                Clear Draft
              </button>
            </div>
          )}

          {/* KOT success banner */}
          {kotSuccessBanner && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-3xs font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{kotSuccessBanner}</span>
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
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1 py-1 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 dark:text-amber-200">
                      <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      <span>Fired Orders ({firedSaleItems.reduce((s, i) => s + i.quantity, 0)} dishes across {activeTableTickets.length} ticket{activeTableTickets.length > 1 ? 's' : ''})</span>
                    </div>
                    <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {activeTableTickets.length} Ticket{activeTableTickets.length > 1 ? 's' : ''} Active
                    </span>
                  </div>

                  {activeTableTickets.map(ticket => (
                    <div 
                      key={ticket.id}
                      className="p-2.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-2xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                            {ticket.kotNumber}
                          </span>
                          <span className="font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            {ticket.destinationStation === 'bar' || ticket.ticketType === 'BOT' ? (
                              <>
                                <Wine className="w-3 h-3 text-amber-600" />
                                <span>Bar Station</span>
                              </>
                            ) : (
                              <>
                                <ChefHat className="w-3 h-3 text-blue-600" />
                                <span>Kitchen KDS</span>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePrintSpecificTicket(ticket)}
                            className="px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-3xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Print or reprint thermal slip"
                          >
                            <Printer className="w-2.5 h-2.5 text-blue-600" />
                            <span>Print Slip</span>
                          </button>
                          <span className="text-3xs text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-2.5 h-2.5" />
                            {Math.max(0, Math.floor((Date.now() - ticket.createdAt) / 60000))}m ago
                          </span>
                          <span className={`text-3xs font-black uppercase px-1.5 py-0.5 rounded ${
                            ticket.status === 'ready' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : ticket.status === 'completed'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {ticket.status === 'ready' ? 'Ready' : ticket.status === 'completed' ? 'Served ✓' : 'Cooking'}
                          </span>
                        </div>
                      </div>

                      {/* Ticket Items List */}
                      <div className="space-y-1 pt-1 border-t border-amber-200/50 dark:border-amber-800/40">
                        {ticket.items.map((kItem, kIdx) => (
                          <div key={kIdx} className="flex items-start justify-between text-xs py-1">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center font-mono font-black text-2xs text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                                {kItem.quantity}×
                              </span>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {kItem.productName}
                                </p>
                                <p className="text-3xs text-slate-400 font-mono">
                                  {formatNPR(kItem.unitPrice)} each
                                </p>
                                {kItem.specialInstructions && (
                                  <p className="text-3xs text-amber-600 italic">
                                    Note: {kItem.specialInstructions}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100 block">
                                {formatNPR(kItem.quantity * kItem.unitPrice)}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-xs uppercase inline-block ${
                                kItem.status === 'ready'
                                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40'
                                  : kItem.status === 'served' || ticket.status === 'completed'
                                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40'
                                  : 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40'
                              }`}>
                                {kItem.status === 'ready' ? 'Ready' : (kItem.status === 'served' || ticket.status === 'completed') ? 'Served ✓' : (kItem.status || 'Cooking')}
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
            onClick={handleCheckout}
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

      </div>

      {/* MANAGE TABLE MODAL (Guests Count & Staff Waiter) */}
      {showManageTableModal && activeDiningTable && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Manage Table {activeDiningTable.tableNumber}
                </h3>
                <p className="text-3xs text-slate-400">
                  {activeDiningTable.floorName} • Capacity: {activeDiningTable.capacity}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManageTableModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Guest Count */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Guest Count:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 4, 6, 8, 10].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setTempGuestCount(cnt)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      tempGuestCount === cnt
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff / Waiter Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Assigned Staff / Waiter:
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

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowManageTableModal(false)}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTableManage}
                className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Save
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
                  const pToUse = printers.find(p => (p.station === 'billing' || p.station === 'all') && p.isActive) || printers[0];
                  const billHtml = generateBillReceiptSlipHtml(completedInvoice, activeDiningTable || null, pToUse, settings);
                  
                  setThermalModalState({
                    isOpen: true,
                    tickets: [{
                      id: completedInvoice.id,
                      label: `Tax Invoice (${completedInvoice.invoiceNumber})`,
                      station: 'billing',
                      html: billHtml,
                      ticketNumber: completedInvoice.invoiceNumber
                    }],
                    autoPrintNotice: `Tax invoice ${completedInvoice.invoiceNumber} ready for printing`
                  });

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

      {/* GLOBAL THERMAL RECEIPT & KOT / BOT PRINT MODAL */}
      {thermalModalState && (
        <ThermalSlipModal
          isOpen={thermalModalState.isOpen}
          onClose={() => setThermalModalState(null)}
          tickets={thermalModalState.tickets}
          autoPrintNotice={thermalModalState.autoPrintNotice}
          paperWidth="80mm"
        />
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

    </div>
  );
};
