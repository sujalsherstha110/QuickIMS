import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, Check, 
  Printer, ArrowRight, UserPlus, CreditCard, DollarSign,
  QrCode, User, FileText, ChevronDown, CheckCircle2, RotateCcw,
  X, Tag, ArrowLeft, Receipt, Flame, UtensilsCrossed, ChefHat, 
  Wine, Cake, Sparkles, ChevronLeft, ChevronRight, Settings,
  SlidersHorizontal, CheckSquare, Coffee, Layers, Building2, ShoppingBag
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, Customer, SaleItem, SaleInvoice, DiningTable, StaffMember } from '../../types';
import { formatNPR, numberToWordsNPR, formatDate } from '../../utils/nepalFormatters';
import { spawnTouchRipple } from '../../utils/touchFeedback';
import { TableSelectionModal } from './TableSelectionModal';

interface CartItem extends SaleItem {
  availableStock: number;
  addonsList?: { name: string; price: number }[];
  itemNotes?: string;
}

export const POSView: React.FC = () => {
  const { 
    products, categories: categoryDefinitions, customers, addCustomer, recordSale, 
    currentUser, settings, currentWarehouseId, warehouses, sales,
    floors, diningTables, selectedTableId, setSelectedTableId, 
    fireKitchenOrderTicket, settleTableBill, kitchenTickets,
    staffMembers, assignTableGuests
  } = useApp();

  // Table Selection Modal state
  const [showTableSelectModal, setShowTableSelectModal] = useState<boolean>(() => {
    return !selectedTableId;
  });

  // Table Manage Modal
  const [showManageTableModal, setShowManageTableModal] = useState<boolean>(false);
  const [tempGuestCount, setTempGuestCount] = useState<number>(2);
  const [tempWaiterName, setTempWaiterName] = useState<string>('');

  // Active dining table
  const activeDiningTable = useMemo(() => {
    if (!selectedTableId) return null;
    return diningTables.find(t => t.id === selectedTableId) || null;
  }, [diningTables, selectedTableId]);

  // If table changes, update guest and waiter state
  useEffect(() => {
    if (activeDiningTable) {
      setTempGuestCount(activeDiningTable.currentGuests || 2);
      setTempWaiterName(activeDiningTable.assignedWaiter || currentUser.name);
    }
  }, [activeDiningTable, currentUser]);

  // Auto-prompt table selection if no table is selected on load
  useEffect(() => {
    if (!selectedTableId && !showTableSelectModal) {
      setShowTableSelectModal(true);
    }
  }, [selectedTableId]);

  // =========================================================================
  // SKETCH HIERARCHY FILTERS (Department -> Category -> SubCategory -> PrepStyle)
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

  // Departments List (Root Department)
  const departments = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.department) set.add(p.department);
    });
    // Ensure standard hospitality departments exist
    ['Kitchen', 'Bar', 'Bakery', 'Desserts'].forEach(d => set.add(d));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Categories List
  const categories = useMemo(() => {
    const set = new Set<string>();
    categoryDefinitions.forEach(c => set.add(c.name));
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [categoryDefinitions, products]);

  // Sub-Categories List (Filtered or General)
  const subCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.subCategory) set.add(p.subCategory);
      if (p.subcategory) set.add(p.subcategory);
    });
    // Add typical restaurant subcategories if catalog is flexible
    ['Chicken', 'Veg', 'Buff', 'Pork', 'Paneer', 'Beverage', 'Fast Food'].forEach(sc => set.add(sc));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Prep-Styles List
  const prepStyles = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.prepStyle) set.add(p.prepStyle);
    });
    ['Steam', 'Fried', 'Jhol', 'C-Momo', 'Kothey', 'Chilly', 'Crispy', 'Spicy', 'Grilled'].forEach(ps => set.add(ps));
    return ['ALL', ...Array.from(set)];
  }, [products]);

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

  // Invoice Success Modal
  const [completedInvoice, setCompletedInvoice] = useState<SaleInvoice | null>(null);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  // Filtered Products based on Sketch Hierarchy
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Department match
      if (selectedDepartment !== 'ALL') {
        const pDept = (p.department || '').toLowerCase();
        const targetDept = selectedDepartment.toLowerCase();
        if (targetDept === 'kitchen' && !pDept && p.category !== 'Drinks' && p.category !== 'Beer') {
          // Defaults to kitchen
        } else if (!pDept.includes(targetDept) && !p.category.toLowerCase().includes(targetDept)) {
          return false;
        }
      }

      // 2. Category match
      if (selectedCategory !== 'ALL') {
        if (p.category !== selectedCategory) return false;
      }

      // 3. Sub-Category match
      if (selectedSubCategory !== 'ALL') {
        const pSub = (p.subCategory || p.subcategory || '').toLowerCase();
        const pName = p.name.toLowerCase();
        const targetSub = selectedSubCategory.toLowerCase();
        if (!pSub.includes(targetSub) && !pName.includes(targetSub)) {
          return false;
        }
      }

      // 4. Prep-Style match
      if (selectedPrepStyle !== 'ALL') {
        const pPrep = (p.prepStyle || '').toLowerCase();
        const pName = p.name.toLowerCase();
        const targetPrep = selectedPrepStyle.toLowerCase();
        if (!pPrep.includes(targetPrep) && !pName.includes(targetPrep)) {
          return false;
        }
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
    const existingIndex = cart.findIndex(item => 
      item.productId === product.id && 
      item.selectedUnit === product.baseUnit &&
      ((item.addonsList || []).map(a => a.name).sort().join('|') === addonsKey)
    );

    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      const newQty = existing.quantity + 1;
      const newBaseQty = newQty * (existing.conversionFactor || 1);
      
      const newCart = [...cart];
      newCart[existingIndex] = {
        ...existing,
        quantity: newQty,
        baseQuantity: newBaseQty,
        lineTotal: (newQty * existing.unitPrice) - existing.discountAmount
      };
      setCart(newCart);
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
        itemNotes: notes
      };
      setCart(prev => [...prev, newItem]);
    }
  };

  // Open Addon Customization Modal
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

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [cart]);

  const defaultVatRate = settings.defaultVatRate || 13;
  const parsedDiscountValue = parseFloat(discountInput) || 0;
  
  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (subtotal * parsedDiscountValue) / 100;
    }
    return Math.min(parsedDiscountValue, subtotal);
  }, [subtotal, discountType, parsedDiscountValue]);

  const totalItemDiscounts = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  }, [cart]);

  const grossDiscount = discountAmount + totalItemDiscounts;
  const taxableAmount = Math.max(0, subtotal - grossDiscount);
  const taxAmount = (taxableAmount * defaultVatRate) / 100;
  const nonTaxableAmount = 0;
  const grandTotal = Math.round(taxableAmount + taxAmount);

  const totalCost = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
  }, [cart]);

  const grossProfit = grandTotal - taxAmount - totalCost;

  const paidAmountNumber = parseFloat(paidAmountInput) || 0;
  const dueAmount = Math.max(0, grandTotal - paidAmountNumber);
  const changeToReturn = paidAmountNumber > grandTotal ? paidAmountNumber - grandTotal : 0;

  // Checkout / Settle Sale
  const handleCheckout = async () => {
    if (cart.length === 0) return;

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
      salespersonId: currentUser.id,
      salespersonName: currentUser.name,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      items: cart,
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
  };

  // Fire KOT / BOT
  const handleFireKOT = async () => {
    if (cart.length === 0 || !activeDiningTable) return;

    const kotItems = cart.map((item, idx) => ({
      id: `ki-${Date.now()}-${idx}`,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      course: 'main' as const,
      specialInstructions: item.itemNotes || kitchenSpecialNotes || undefined,
      selectedModifiers: (item.addonsList || []).map(a => ({
        modifierName: 'Addon',
        optionName: a.name,
        priceDelta: a.price
      })),
      status: 'pending' as const,
      firedAt: Date.now()
    }));

    const kot = await fireKitchenOrderTicket({
      tableId: activeDiningTable.id,
      tableNumber: activeDiningTable.tableNumber,
      zoneName: activeDiningTable.zoneName || activeDiningTable.floorName || 'Dining Area',
      waiterName: activeDiningTable.assignedWaiter || currentUser.name,
      guestsCount: activeDiningTable.currentGuests || 2,
      status: 'in_kitchen',
      notes: kitchenSpecialNotes || undefined,
      items: kotItems
    });

    setKotSuccessBanner(`Ticket ${kot.kotNumber} fired to KDS for Table ${activeDiningTable.tableNumber}!`);
    setTimeout(() => {
      setKotSuccessBanner(null);
    }, 4500);

    setKitchenSpecialNotes('');
  };

  // Manage Table Save
  const handleSaveTableManage = async () => {
    if (!activeDiningTable) return;
    await assignTableGuests(activeDiningTable.id, tempGuestCount, tempWaiterName);
    setShowManageTableModal(false);
  };

  // Available Addons List for Modal
  const availablePresetAddons = useMemo(() => {
    return [
      { name: 'Extra Cheese', price: 50 },
      { name: 'Extra Mayonnaise', price: 30 },
      { name: 'Spicy Schezwan Dip', price: 25 },
      { name: 'Jhol Gravy Bowl', price: 40 },
      { name: 'Extra Butter / Ghee', price: 35 },
      { name: 'Green Salad Portion', price: 45 },
    ];
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full max-w-7xl mx-auto select-none">
      
      {/* ========================================================================= */}
      {/* LEFT PANEL: MENU & ITEM SELECTION (Exact Match to User Sketch)            */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* 1. TOP SEARCH BAR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Menu Items (Momo, Chowmein, Pizza, Drinks, SKU...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500"
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
        </div>

        {/* 2. ROOT DEPARTMENT SLIDER ROW (< [ Kitchen ] [ Bar ] [ Bakery ] >) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ChefHat className="w-3 h-3 text-indigo-600" />
              <span>Root Department</span>
            </span>
            <span className="text-3xs text-slate-400 font-mono">Main Prep Area</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {departments.map(dept => (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDepartment(dept)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedDepartment === dept
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* 3. CATEGORY SLIDER ROW (< [ Momo ] [ Pizza ] [ Chowmein ] [ Drinks ] >) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-600" />
              <span>Category</span>
            </span>
            {selectedCategory !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className="text-3xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
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

        {/* 4. NESTED BOX: SUB-CATEGORY + PREP-STYLE + PRODUCT CARD GRID */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-sm flex-1 flex flex-col gap-3 min-h-[380px]">
          
          {/* Sub - Category Row */}
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
                      ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>
          </div>

          {/* Prep - style Row */}
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
                          ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 bg-white dark:bg-slate-900 shadow-2xs'
                      }`}
                    >
                      {/* Top Info */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-3xs font-mono text-slate-400">
                            {product.sku}
                          </span>
                          {inCartCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-3xs flex items-center justify-center">
                              {inCartCount}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                          {product.name}
                        </h4>

                        <div className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                          {formatNPR(customerPrice)}
                        </div>
                      </div>

                      {/* Card Action: Dedicated "Add on" Button (as shown in Sketch) */}
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleOpenAddonModal(product, e)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-3xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                          title="Configure item modifiers and addons"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Add on</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-3xs font-bold transition-colors cursor-pointer"
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

      {/* ========================================================================= */}
      {/* RIGHT PANEL: TABLE ORDER TICKET (Exact Match to User Sketch)              */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shrink-0 flex flex-col shadow-md">
        
        {/* TICKET TOP HEADER: [ X ] Table Order Ticket [ Manage ] */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTableSelectModal(true)}
                className="w-7 h-7 rounded-xl bg-slate-200/80 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/60 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
                title="Switch Table (Select another table)"
              >
                ✕
              </button>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed className="w-4 h-4 text-indigo-600" />
                <span>Table Order Ticket</span>
              </h2>
            </div>

            {/* [ Manage ] Button */}
            <button
              type="button"
              onClick={() => setShowManageTableModal(true)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-3xs font-extrabold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Settings className="w-3 h-3 text-indigo-600" />
              <span>Manage</span>
            </button>
          </div>

          {/* TABLE & STAFF ROW WITH [ KOT / BOT ] BUTTON */}
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 shadow-2xs">
            <div className="space-y-0.5 min-w-0">
              {/* Table : Floor (Table No.) */}
              <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                <span className="text-slate-400 font-bold">Table: </span>
                {activeDiningTable ? (
                  <span>
                    {activeDiningTable.floorName || 'Main Floor'} ({activeDiningTable.tableNumber})
                  </span>
                ) : (
                  <span className="text-amber-600 italic">No Table Selected</span>
                )}
              </div>

              {/* Staff : _______ */}
              <div className="text-2xs font-bold text-slate-600 dark:text-slate-300 truncate">
                <span className="text-slate-400">Staff: </span>
                <span>{activeDiningTable?.assignedWaiter || currentUser.name}</span>
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
              disabled={cart.length === 0 || !activeDiningTable}
              className={`px-3 py-2 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                cart.length === 0 || !activeDiningTable
                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                  : 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-amber-600/25'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>KOT / BOT</span>
            </button>
          </div>

          {/* KOT fired success banner */}
          {kotSuccessBanner && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-3xs font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{kotSuccessBanner}</span>
            </div>
          )}
        </div>

        {/* RUNNING ORDER ITEMS LIST */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400">
              <ShoppingCart className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Ticket is empty</p>
              <p className="text-3xs text-slate-400 mt-0.5">
                Select items from the menu on the left to add dishes
              </p>
            </div>
          ) : (
            cart.map((item, index) => (
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
                            className="text-3xs px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800"
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
                    onClick={() => removeFromCart(index)}
                    className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
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
            ))
          )}
        </div>

        {/* BOTTOM SUMMARY & BILL SETTLEMENT */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 space-y-2.5">
          
          {/* Amount Breakdown */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Subtotal:</span>
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
              <span className="text-base font-mono text-indigo-600 dark:text-indigo-400">
                {formatNPR(grandTotal)}
              </span>
            </div>
          </div>

          {/* Settle Bill Button */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
              cart.length === 0
                ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-98'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Settle & Print Bill</span>
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* TABLE SELECTION MODAL                                                     */}
      {/* ========================================================================= */}
      <TableSelectionModal
        isOpen={showTableSelectModal}
        onClose={() => setShowTableSelectModal(false)}
        onSelectTable={(tableId) => {
          setSelectedTableId(tableId);
          setShowTableSelectModal(false);
        }}
        onSelectTakeaway={() => {
          setSelectedTableId(null);
          setShowTableSelectModal(false);
        }}
      />

      {/* ========================================================================= */}
      {/* MANAGE TABLE MODAL (Guests Count & Staff Waiter)                          */}
      {/* ========================================================================= */}
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
                        ? 'bg-indigo-600 text-white border-indigo-600'
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
                <option value={currentUser.name}>{currentUser.name} (Current User)</option>
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
                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADDON CUSTOMIZATION MODAL (When clicking "Add on" on Dish Cards)          */}
      {/* ========================================================================= */}
      {addonItemProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Addons for {addonItemProduct.name}
                </h3>
                <p className="text-3xs font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  Base: {formatNPR(getProductPriceForCustomer(addonItemProduct, selectedCustomer))}
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

            {/* Preset Addons List */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Select Add-ons / Modifiers:
              </label>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {availablePresetAddons.map(addon => {
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
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-indigo-600"
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

            {/* Special Instruction */}
            <div>
              <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Special Note (Kitchen Instructions)
              </label>
              <input
                type="text"
                placeholder="e.g. Extra spicy, no onions, dip on side..."
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
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Add to Ticket</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INVOICE SUCCESS / RECEIPT MODAL                                           */}
      {/* ========================================================================= */}
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

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
              Total Paid: {formatNPR(completedInvoice.grandTotal)}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletedInvoice(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setCompletedInvoice(null);
                }}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
