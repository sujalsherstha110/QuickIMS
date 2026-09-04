import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, Check, 
  Printer, ArrowRight, UserPlus, CreditCard, DollarSign,
  QrCode, User, FileText, ChevronDown, CheckCircle2, RotateCcw,
  X, Tag, ArrowLeft, Receipt, Flame
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, Customer, SaleItem, SaleInvoice } from '../../types';
import { formatNPR, numberToWordsNPR, formatDate } from '../../utils/nepalFormatters';
import { spawnTouchRipple } from '../../utils/touchFeedback';

interface CartItem extends SaleItem {
  availableStock: number;
}

export const POSView: React.FC = () => {
  const { 
    products, categories: categoryDefinitions, customers, addCustomer, recordSale, 
    currentUser, settings, currentWarehouseId, warehouses, sales 
  } = useApp();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
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

  // Mobile Bottom Sheet
  const [mobileCartSheetOpen, setMobileCartSheetOpen] = useState(false);

  // Invoice Success Modal
  const [completedInvoice, setCompletedInvoice] = useState<SaleInvoice | null>(null);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    categoryDefinitions.forEach(c => cats.add(c.name));
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return ['ALL', ...Array.from(cats)];
  }, [categoryDefinitions, products]);

  // Frequent Selling Categories computed from sales history & item velocity
  const { frequentCategories, categorySalesStats } = useMemo(() => {
    const productCatMap = new Map<string, string>();
    products.forEach(p => {
      if (p.category) productCatMap.set(p.id, p.category);
    });

    const stats: Record<string, { count: number; quantity: number }> = {};
    (sales || []).forEach(sale => {
      if (sale.status === 'cancelled') return;
      (sale.items || []).forEach(item => {
        const cat = productCatMap.get(item.productId);
        if (cat) {
          if (!stats[cat]) stats[cat] = { count: 0, quantity: 0 };
          stats[cat].count += 1;
          stats[cat].quantity += (item.quantity || 1);
        }
      });
    });

    // Categories with sales ordered descending by units sold
    const sortedBySales = Object.keys(stats).sort((a, b) => stats[b].quantity - stats[a].quantity);

    // Other categories in catalog that have not sold yet
    const others = categories.filter(c => c !== 'ALL' && !stats[c]);

    return {
      frequentCategories: [...sortedBySales, ...others],
      categorySalesStats: stats
    };
  }, [sales, products, categories]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchQuery));
      return matchCat && matchSearch && p.status === 'active';
    });
  }, [products, selectedCategory, searchQuery]);

  // Pricing based on customer type
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

  // Add product to cart
  const addToCart = (product: Product) => {
    const existingIndex = cart.findIndex(item => item.productId === product.id && item.selectedUnit === product.baseUnit);
    const unitPrice = getProductPriceForCustomer(product, selectedCustomer);
    
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
        selectedUnit: product.baseUnit,
        conversionFactor: 1,
        quantity: 1,
        baseQuantity: 1,
        unitPrice: unitPrice,
        costPrice: product.costPrice,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: product.taxRatePercent || settings.defaultVatRate || 13,
        taxAmount: 0,
        lineTotal: unitPrice,
        availableStock: product.currentStock
      };
      setCart([...cart, newItem]);
    }
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

  // Switch Unit for item
  const changeItemUnit = (index: number, unitName: string) => {
    const item = cart[index];
    const product = products.find(p => p.id === item.productId);
    if (!product) return;

    let conversionFactor = 1;
    let basePrice = getProductPriceForCustomer(product, selectedCustomer);
    let unitPrice = basePrice;

    if (unitName === product.baseUnit) {
      conversionFactor = 1;
      unitPrice = basePrice;
    } else {
      const alt = product.alternativeUnits.find(u => u.unitName === unitName);
      if (alt) {
        conversionFactor = alt.multiplierToBase;
        unitPrice = basePrice * alt.multiplierToBase;
      }
    }

    setCart(prev => {
      const updated = [...prev];
      const newBaseQty = item.quantity * conversionFactor;
      const lineTotal = (item.quantity * unitPrice) - item.discountAmount;
      updated[index] = {
        ...item,
        selectedUnit: unitName,
        conversionFactor,
        unitPrice,
        baseQuantity: newBaseQty,
        lineTotal
      };
      return updated;
    });
  };

  // Remove from cart
  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const totalItemCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = cart.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
  const totalItemDiscounts = cart.reduce((acc, i) => acc + (i.discountAmount || 0), 0);
  
  const parsedDiscountValue = Math.max(0, parseFloat(discountInput) || 0);
  const discountAmount = discountType === 'percent'
    ? Math.min(subtotal, Math.round((subtotal * Math.min(100, parsedDiscountValue)) / 100))
    : Math.min(subtotal, parsedDiscountValue);

  const grossDiscount = totalItemDiscounts + discountAmount;
  const taxableAmount = Math.max(0, subtotal - grossDiscount);
  const defaultVatRate = settings.defaultVatRate || 13;
  const taxAmount = Math.round((taxableAmount * (defaultVatRate / 100)) * 100) / 100;
  const grandTotal = Math.round(taxableAmount + taxAmount);
  const totalCost = cart.reduce((acc, i) => acc + (i.baseQuantity * i.costPrice), 0);
  const grossProfit = grandTotal - taxAmount - totalCost;

  // Auto set paid amount input
  useEffect(() => {
    if (paymentMethod === 'credit') {
      setPaidAmountInput('0');
    } else {
      setPaidAmountInput(grandTotal.toString());
    }
  }, [grandTotal, paymentMethod]);

  const paidAmountNumber = parseFloat(paidAmountInput) || 0;
  const dueAmount = Math.max(0, grandTotal - paidAmountNumber);
  const changeToReturn = paidAmountNumber > grandTotal ? paidAmountNumber - grandTotal : 0;

  // Submit Sale Invoice
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
      nonTaxableAmount: 0,
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
    setCompletedInvoice(recorded);
    setCart([]);
    setDiscountInput('0');
    setPaymentReference('');
    setSalesNotes('');
    setMobileCartSheetOpen(false);
  };

  // Add New Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name || !newCustomerForm.phone) return;

    const created = await addCustomer({
      customerCode: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newCustomerForm.name,
      companyName: newCustomerForm.companyName,
      phone: newCustomerForm.phone,
      panVatNumber: newCustomerForm.panVatNumber,
      customerType: newCustomerForm.customerType,
      address: {
        province: 'Bagmati',
        district: 'Kathmandu',
        municipality: 'Kathmandu',
        street: newCustomerForm.addressStreet || 'Kathmandu'
      },
      creditLimit: newCustomerForm.creditLimit,
      currentBalance: newCustomerForm.openingBalance || 0,
      openingBalance: newCustomerForm.openingBalance || 0,
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
      creditLimit: 200000
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full max-w-7xl mx-auto">
      
      {/* LEFT AREA: Search, Filter & Product Grid */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* Controls: Search */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-lg p-3 sm:p-4 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Scan barcode or type product name, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500"
              autoFocus
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown below Search Bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-3xs font-medium text-slate-500 uppercase tracking-wider block">
                Category
              </label>
              {selectedCategory !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className="text-3xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-3 pr-8 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Categories ({products.filter(p => p.status === 'active').length} items)</option>
                {categories.filter(c => c !== 'ALL').map(cat => {
                  const count = products.filter(p => p.category === cat && p.status === 'active').length;
                  return (
                    <option key={cat} value={cat}>
                      {cat} {count ? `(${count} items)` : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Frequent Selling Categories Horizontal Scroll */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center gap-1.5 text-3xs font-semibold text-slate-500 uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
              <span>Frequent Selling Categories (धेरै बिक्ने वर्ग)</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 font-medium ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>All Categories</span>
              </button>

              {frequentCategories.map((cat, idx) => {
                const stats = categorySalesStats[cat];
                const isSelected = selectedCategory === cat;
                const isTopSeller = idx < 3 && stats && stats.quantity > 0;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat)}
                    className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white font-medium shadow-2xs'
                        : isTopSeller
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100/70'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isTopSeller && (
                      <Flame className={`w-3 h-3 ${isSelected ? 'text-white fill-white/30' : 'text-amber-500 fill-amber-500'}`} />
                    )}
                    <span>{cat}</span>
                    {stats && stats.quantity > 0 && (
                      <span className={`text-3xs font-mono px-1 py-0.5 rounded leading-none ${
                        isSelected 
                          ? 'bg-indigo-700/80 text-white' 
                          : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {stats.quantity} sold
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-lg p-3 sm:p-4 flex-1 overflow-y-auto">
          <div className="text-2xs text-slate-500 dark:text-slate-400 mb-3 font-medium">
            {filteredProducts.length} items available
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {filteredProducts.map(product => {
              const customerPrice = getProductPriceForCustomer(product, selectedCustomer);
              const isOutOfStock = product.currentStock <= 0;
              const cartItem = cart.find(c => c.productId === product.id);

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && addToCart(product)}
                  onPointerDown={(e) => !isOutOfStock && spawnTouchRipple(e, 'bg-indigo-200/30')}
                  className={`relative overflow-hidden p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer select-none active:scale-[0.985] ${
                    isOutOfStock
                      ? 'opacity-40 border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40'
                      : cartItem
                        ? 'border-indigo-500 bg-indigo-50/25 dark:bg-indigo-950/25 shadow-2xs ring-1 ring-indigo-500/30'
                        : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-2xs bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="space-y-1">
                    {/* 1. SKU at top (clean, unhighlighted) */}
                    <div className="font-mono text-2xs text-slate-400 dark:text-slate-500">
                      {product.sku}
                    </div>

                    {/* 2. Pieces below that (clean, uncolored) */}
                    <div className="text-2xs text-slate-500 dark:text-slate-400">
                      {product.currentStock} pieces
                    </div>

                    {/* 3. Product name */}
                    <h4
                      className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug"
                      title={product.name}
                    >
                      {product.name}
                    </h4>
                  </div>

                  {/* 4. Below down: price and add (clean as previous version) */}
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {formatNPR(customerPrice)}
                    </span>
                    {cartItem ? (
                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-2xs rounded font-medium">
                        {cartItem.quantity} {cartItem.selectedUnit}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400 font-medium">
                        + Add
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* DESKTOP RIGHT: Clean Live Cart Panel */}
      <div className="hidden lg:flex flex-col w-96 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-lg overflow-hidden shrink-0">
        
        {/* Cart Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Current Sale ({cart.length})
            </h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-2xs text-slate-400 hover:text-rose-600 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart Item Rows */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
              <p>Cart is empty</p>
              <p className="text-2xs text-slate-500 mt-0.5">Select products from catalog</p>
            </div>
          ) : (
            cart.map((item, index) => {
              const product = products.find(p => p.id === item.productId);
              return (
                <div key={`${item.productId}-${index}`} className="p-2.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-md border border-slate-200/70 dark:border-slate-800/70 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.productName}
                      </p>
                      <p className="text-2xs text-slate-500">
                        {formatNPR(item.unitPrice)} / {item.selectedUnit}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/50">
                    {/* Unit Switcher */}
                    <select
                      value={item.selectedUnit}
                      onChange={(e) => changeItemUnit(index, e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-2xs rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300 outline-hidden"
                    >
                      <option value={product?.baseUnit}>{product?.baseUnit}</option>
                      {product?.alternativeUnits.map(alt => (
                        <option key={alt.unitName} value={alt.unitName}>
                          {alt.unitName} (×{alt.multiplierToBase})
                        </option>
                      ))}
                    </select>

                    {/* Quantity Stepper */}
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900">
                      <button
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Total */}
                    <span className="font-mono font-medium text-xs text-slate-900 dark:text-slate-100">
                      {formatNPR(item.lineTotal)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Checkout Summary & Pay Area */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-3">
          
          {/* Amount Received (Above Payment Method) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-3xs font-medium text-slate-500 uppercase tracking-wider block">Amount Received</label>
              <button
                type="button"
                onClick={() => setPaidAmountInput(grandTotal.toString())}
                className="text-3xs text-indigo-600 dark:text-indigo-400 hover:underline font-mono cursor-pointer"
              >
                Exact ({formatNPR(grandTotal)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400">Rs.</span>
              <input
                type="number"
                min="0"
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(e.target.value)}
                placeholder="0"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs font-mono font-medium text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 text-right"
              />
            </div>
          </div>

          {/* Payment Method Pills */}
          <div>
            <label className="text-3xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Payment Method</label>
            <div className="grid grid-cols-3 gap-1 text-2xs">
              {[
                { id: 'cash', label: 'Cash' },
                { id: 'fonepay', label: 'Fonepay' },
                { id: 'bank_transfer', label: 'Bank' },
                { id: 'connectips', label: 'ConnectIPS' },
                { id: 'cheque', label: 'Cheque' },
                { id: 'credit', label: 'Credit (बाँकी)' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`py-1 px-2 rounded border text-center font-medium transition-colors ${
                    paymentMethod === m.id
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Discount Section (Below Payment Method) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-3xs font-medium text-slate-500 uppercase tracking-wider block">Discount</label>
              {discountType === 'percent' && parsedDiscountValue > 0 && (
                <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                  = -{formatNPR(discountAmount)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-2.5 top-1.5 text-xs font-mono text-slate-400">
                  {discountType === 'percent' ? '%' : 'Rs.'}
                </span>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'percent' ? 100 : undefined}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  onFocus={(e) => {
                    if (e.target.value === '0') setDiscountInput('');
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') setDiscountInput('0');
                  }}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 text-right"
                />
              </div>

              {/* Toggle switch of % / Rs */}
              <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setDiscountType('percent')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                    discountType === 'percent'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('rs')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                    discountType === 'rs'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Rs
                </button>
              </div>
            </div>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="text-3xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Customer</label>
            <div className="flex items-center gap-1.5">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-hidden focus:border-indigo-500 min-w-0"
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
                className="inline-flex items-center gap-1 px-2 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300 shrink-0 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium transition-colors cursor-pointer"
                title="Add Customer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Amount Breakdown */}
          <div className="space-y-1 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Discount {discountType === 'percent' && parsedDiscountValue > 0 ? `(${parsedDiscountValue}%)` : ''}:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {discountAmount > 0 ? `-${formatNPR(discountAmount)}` : formatNPR(0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>VAT ({defaultVatRate}%):</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{formatNPR(taxAmount)}</span>
            </div>
            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline text-xs font-semibold text-slate-900 dark:text-slate-100">
              <span>Total Payable:</span>
              <span className="text-sm font-mono text-indigo-600 dark:text-indigo-400">{formatNPR(grandTotal)}</span>
            </div>
            {dueAmount > 0 && (
              <div className="flex items-center justify-between text-2xs font-medium text-amber-600 dark:text-amber-400 pt-0.5">
                <span>Credit Due (बाँकी):</span>
                <span className="font-mono">{formatNPR(dueAmount)}</span>
              </div>
            )}
            {changeToReturn > 0 && (
              <div className="flex items-center justify-between text-2xs font-medium text-emerald-600 dark:text-emerald-400 pt-0.5">
                <span>Change to Return:</span>
                <span className="font-mono">{formatNPR(changeToReturn)}</span>
              </div>
            )}
          </div>

          {/* Checkout CTA */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-2.5 px-4 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
              cart.length === 0
                ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Complete Sale & Print</span>
          </button>
        </div>

      </div>

      {/* MOBILE STICKY BOTTOM CART BAR */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-14 left-0 right-0 z-30 p-2.5 px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-3xs text-slate-400 uppercase">Cart Total ({totalItemCount} items)</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono block">
                {formatNPR(grandTotal)}
              </span>
            </div>

            <button
              onClick={() => setMobileCartSheetOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 text-white rounded-md text-xs font-medium flex items-center gap-1.5"
            >
              <span>View Cart & Pay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM SHEET MODAL */}
      {mobileCartSheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div 
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileCartSheetOpen(false)}
          />

          <div className="relative bg-white dark:bg-slate-900 rounded-t-xl max-h-[85vh] flex flex-col shadow-xl z-10">
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Cart Items ({cart.length})
              </h3>
              <button 
                onClick={() => setMobileCartSheetOpen(false)}
                className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.map((item, index) => (
                <div key={index} className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{item.productName}</p>
                      <p className="text-2xs text-slate-500">{formatNPR(item.unitPrice)} / {item.selectedUnit}</p>
                    </div>
                    <button onClick={() => removeFromCart(index)} className="text-slate-400 hover:text-rose-500 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900">
                      <button onClick={() => updateQuantity(index, item.quantity - 1)} className="px-2 py-1 text-slate-700 dark:text-slate-300">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, item.quantity + 1)} className="px-2 py-1 text-slate-700 dark:text-slate-300">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-mono font-medium text-xs text-slate-900 dark:text-slate-100">{formatNPR(item.lineTotal)}</span>
                  </div>
                </div>
              ))}

              {/* Amount Received (Above Payment Method) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-3xs font-medium text-slate-500 uppercase block">Amount Received</label>
                  <button
                    type="button"
                    onClick={() => setPaidAmountInput(grandTotal.toString())}
                    className="text-3xs text-indigo-600 dark:text-indigo-400 font-mono cursor-pointer"
                  >
                    Exact ({formatNPR(grandTotal)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs font-mono font-medium text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 text-right"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="text-3xs font-medium text-slate-500 uppercase block mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'fonepay', label: 'Fonepay' },
                    { id: 'bank_transfer', label: 'Bank' },
                    { id: 'connectips', label: 'ConnectIPS' },
                    { id: 'cheque', label: 'Cheque' },
                    { id: 'credit', label: 'Credit' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2 rounded border text-center text-xs font-medium ${
                        paymentMethod === m.id
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount Section (Below Payment Method) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-3xs font-medium text-slate-500 uppercase block">Discount</label>
                  {discountType === 'percent' && parsedDiscountValue > 0 && (
                    <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                      = -{formatNPR(discountAmount)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400">
                      {discountType === 'percent' ? '%' : 'Rs.'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percent' ? 100 : undefined}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      onFocus={(e) => {
                        if (e.target.value === '0') setDiscountInput('');
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '') setDiscountInput('0');
                      }}
                      placeholder="0"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 text-right"
                    />
                  </div>

                  {/* Toggle switch of % / Rs */}
                  <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                        discountType === 'percent'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('rs')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                        discountType === 'rs'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Rs
                    </button>
                  </div>
                </div>
              </div>

              {/* Customer Selection */}
              <div className="pt-2">
                <label className="text-3xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Customer</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-md px-2.5 py-2 text-slate-800 dark:text-slate-200 outline-hidden focus:border-indigo-500 min-w-0"
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
                    className="inline-flex items-center gap-1 px-2.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300 shrink-0 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium transition-colors"
                    title="Add Customer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatNPR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Discount {discountType === 'percent' && parsedDiscountValue > 0 ? `(${parsedDiscountValue}%)` : ''}:</span>
                  <span className="font-mono">{discountAmount > 0 ? `-${formatNPR(discountAmount)}` : formatNPR(0)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>VAT ({defaultVatRate}%):</span>
                  <span className="font-mono">{formatNPR(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-xs text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Grand Total:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{formatNPR(grandTotal)}</span>
                </div>
                {dueAmount > 0 && (
                  <div className="flex items-center justify-between text-2xs font-medium text-amber-600 dark:text-amber-400 pt-0.5">
                    <span>Credit Due (बाँकी):</span>
                    <span className="font-mono">{formatNPR(dueAmount)}</span>
                  </div>
                )}
                {changeToReturn > 0 && (
                  <div className="flex items-center justify-between text-2xs font-medium text-emerald-600 dark:text-emerald-400 pt-0.5">
                    <span>Change to Return:</span>
                    <span className="font-mono">{formatNPR(changeToReturn)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleCheckout}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Print Bill ({formatNPR(grandTotal)})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOMER POPUP */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Add New Customer (नयाँ ग्राहक दर्ता)
            </h3>
            
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Company / Firm Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Sharma Builders & Construction"
                  value={newCustomerForm.companyName}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, companyName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Address / Location (ठेगाना)</label>
                <input
                  type="text"
                  placeholder="e.g. New Road, Kathmandu"
                  value={newCustomerForm.addressStreet}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, addressStreet: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Phone / Mobile *</label>
                  <input
                    type="text"
                    required
                    placeholder="98XXXXXXXX"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Buyer's PAN / VAT</label>
                  <input
                    type="text"
                    placeholder="9-digit PAN"
                    value={newCustomerForm.panVatNumber}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, panVatNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Pricing Category</label>
                  <select
                    value={newCustomerForm.customerType}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customerType: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="retail">Retail Counter</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="contractor">Builder / Contractor</option>
                    <option value="dealer">Sub-Dealer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Opening Balance (बाँकी)</label>
                  <input
                    type="number"
                    value={newCustomerForm.openingBalance}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVOICE PRINT PREVIEW */}
      {completedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-xl w-full p-4 sm:p-6 shadow-xl space-y-4 my-auto text-slate-900 dark:text-slate-100">
            
            {/* Modal Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 print:hidden">
              <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs sm:text-sm">
                <Check className="w-4 h-4" />
                <span>Invoice Generated Successfully</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setCompletedInvoice(null)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Printable Bill Paper */}
            <div className="border border-slate-200 dark:border-slate-800 rounded p-4 sm:p-5 bg-slate-50/30 dark:bg-slate-950/30 text-xs space-y-3 font-sans print:border-none print:p-0">
              
              <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <h2 className="text-sm font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  {settings.companyName}
                </h2>
                <p className="text-2xs text-slate-500">
                  {settings.address.street}, {settings.address.district} | Tel: {settings.phone}
                </p>
                <p className="text-2xs font-mono font-medium text-slate-600 dark:text-slate-400">
                  PAN/VAT: {settings.panNumber}
                </p>
                <div className="mt-1 inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-3xs font-semibold uppercase">
                  TAX INVOICE
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div>
                  <p className="text-slate-500">Customer:</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{completedInvoice.customerName}</p>
                  {completedInvoice.customerPhone && <p className="text-slate-500 font-mono">Tel: {completedInvoice.customerPhone}</p>}
                </div>
                <div className="text-right font-mono">
                  <p><span className="text-slate-500">Invoice:</span> <span className="font-semibold">{completedInvoice.invoiceNumber}</span></p>
                  <p><span className="text-slate-500">Date:</span> {formatDate(completedInvoice.date)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-2xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-semibold border-y border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-1 px-2">Item</th>
                      <th className="py-1 px-2 text-center">Qty</th>
                      <th className="py-1 px-2 text-right">Rate</th>
                      <th className="py-1 px-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {completedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 px-2 font-medium">{item.productName}</td>
                        <td className="py-1 px-2 text-center">{item.quantity} {item.selectedUnit}</td>
                        <td className="py-1 px-2 text-right font-mono">{item.unitPrice.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right font-mono font-medium">{item.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-1 text-2xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-mono">{formatNPR(completedInvoice.subtotal)}</span>
                </div>
                {completedInvoice.discountAmount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatNPR(completedInvoice.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>VAT ({settings.defaultVatRate}%):</span>
                  <span className="font-mono">{formatNPR(completedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Grand Total:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{formatNPR(completedInvoice.grandTotal)}</span>
                </div>
                <div className="pt-1 text-2xs text-slate-500">
                  In Words: <span className="font-medium text-slate-700 dark:text-slate-300">{numberToWordsNPR(completedInvoice.grandTotal)}</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
