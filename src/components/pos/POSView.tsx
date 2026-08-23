import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, Check, 
  Printer, ArrowRight, UserPlus, CreditCard, DollarSign,
  QrCode, User, FileText, ChevronDown, CheckCircle2, RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, Customer, SaleItem, SaleInvoice } from '../../types';
import { formatNPR, numberToWordsNPR, formatDate, toNepaliBSDate, formatStockInUnits } from '../../utils/nepalFormatters';
import confetti from 'canvas-confetti';

interface CartItem extends SaleItem {
  availableStock: number;
}

export const POSView: React.FC = () => {
  const { 
    products, categories: categoryDefinitions, customers, addCustomer, recordSale, 
    currentUser, settings, currentWarehouseId, warehouses 
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
    phone: '',
    panVatNumber: '',
    customerType: 'retail' as 'retail' | 'wholesale' | 'contractor' | 'dealer',
    creditLimit: 100000,
    addressStreet: 'Kathmandu'
  });

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'esewa' | 'khalti' | 'connectips' | 'cheque' | 'credit' | 'partial'>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [salesNotes, setSalesNotes] = useState<string>('');

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

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.barcode.includes(searchQuery);
      return matchCat && matchSearch && p.status === 'active';
    });
  }, [products, selectedCategory, searchQuery]);

  // Determine pricing depending on customer type
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

  // Switch Unit for item (e.g. Piece -> Bundle or Box)
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

  // Update Unit Price Override
  const updateUnitPrice = (index: number, newPrice: number) => {
    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      const lineTotal = (item.quantity * newPrice) - item.discountAmount;
      updated[index] = {
        ...item,
        unitPrice: newPrice,
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
  const subtotal = cart.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
  const totalItemDiscounts = cart.reduce((acc, i) => acc + (i.discountAmount || 0), 0);
  const grossDiscount = totalItemDiscounts + discountAmount;
  const taxableAmount = Math.max(0, subtotal - grossDiscount);
  const defaultVatRate = settings.defaultVatRate || 13;
  const taxAmount = Math.round((taxableAmount * (defaultVatRate / 100)) * 100) / 100;
  const grandTotal = Math.round(taxableAmount + taxAmount);
  const totalCost = cart.reduce((acc, i) => acc + (i.baseQuantity * i.costPrice), 0);
  const grossProfit = grandTotal - taxAmount - totalCost;

  // Auto set paid amount input when grand total changes unless manually edited
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

    // Check stock warning
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
    setDiscountAmount(0);
    setPaymentReference('');
    setSalesNotes('');
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
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
        street: newCustomerForm.addressStreet
      },
      creditLimit: newCustomerForm.creditLimit,
      currentBalance: 0,
      openingBalance: 0,
      paymentTermsDays: 30,
      active: true
    });

    setSelectedCustomerId(created.id);
    setShowAddCustomerModal(false);
    setNewCustomerForm({
      name: '',
      companyName: '',
      phone: '',
      panVatNumber: '',
      customerType: 'retail',
      creditLimit: 100000,
      addressStreet: 'Kathmandu'
    });
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-4">
      
      {/* LEFT & CENTER: Product Catalog & Cart */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        
        {/* Top Control Bar: Search & Category Chips */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Scan Barcode or Search Hardware / Sanitary product by name, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500 font-medium"
                autoFocus
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Customer Selector Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 font-medium outline-hidden focus:border-indigo-500 max-w-[200px]"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customerType})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400"
                title="Add New Customer"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs scrollbar-thin">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid & Active Cart Split View */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden">
          
          {/* Left Grid: Products Catalog (7 cols) */}
          <div className="md:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 overflow-y-auto shadow-xs space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredProducts.map(product => {
                const customerPrice = getProductPriceForCustomer(product, selectedCustomer);
                const isOutOfStock = product.currentStock <= 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer select-none ${
                      isOutOfStock
                        ? 'opacity-40 border-dashed border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-950'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-3xs font-mono text-slate-400 mb-1">
                        <span>{product.sku}</span>
                        <span className={`font-semibold ${product.currentStock <= product.reorderLevel ? 'text-amber-500' : 'text-slate-500'}`}>
                          {product.currentStock} {product.baseUnitSymbol}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {formatNPR(customerPrice)}
                      </span>
                      <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-3xs rounded font-medium">
                        + Add
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center Table: Current Cart Items (5 cols) */}
          <div className="md:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xs">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Cart Items ({cart.length})
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-3xs text-rose-500 hover:text-rose-700 font-semibold"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
                  <ShoppingCart className="w-10 h-10 stroke-1 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">Cart is currently empty</p>
                  <p className="text-2xs text-slate-400 mt-1">Select hardware & sanitary items from catalog to start billing</p>
                </div>
              ) : (
                cart.map((item, index) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <div key={`${item.productId}-${index}`} className="p-2 bg-slate-50/70 dark:bg-slate-800/30 rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {item.productName}
                          </p>
                          <p className="text-3xs text-slate-400 font-mono">
                            Rate: {formatNPR(item.unitPrice)} / {item.selectedUnit}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Multi-Unit conversion selector & Quantity controls */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/40">
                        {/* Unit selector dropdown */}
                        <div className="flex items-center gap-1">
                          <select
                            value={item.selectedUnit}
                            onChange={(e) => changeItemUnit(index, e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-3xs font-semibold rounded px-1.5 py-1 text-slate-700 dark:text-slate-300 outline-hidden"
                          >
                            <option value={product?.baseUnit}>{product?.baseUnit}</option>
                            {product?.alternativeUnits.map(alt => (
                              <option key={alt.unitName} value={alt.unitName}>
                                {alt.unitName} (×{alt.multiplierToBase})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 overflow-hidden">
                          <button
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseFloat(e.target.value) || 1)}
                            className="w-10 text-center text-xs font-mono font-bold bg-transparent outline-hidden"
                          />
                          <button
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Line Total */}
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                          {formatNPR(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* RIGHT PANEL: Totals, Payment Method & Instant Checkout */}
      <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
        <div className="space-y-4">
          
          {/* Customer Summary Card */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-2xs mb-1">
              <span className="font-bold uppercase tracking-wider text-slate-500">Customer Account</span>
              <span className="capitalize px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold text-3xs">
                {selectedCustomer.customerType}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.name}</p>
            {selectedCustomer.currentBalance > 0 && (
              <p className="text-2xs text-amber-600 dark:text-amber-400 font-mono mt-1">
                Outstanding Balance: {formatNPR(selectedCustomer.currentBalance)}
              </p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-3xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Payment Method (भुक्तानी माध्यम)
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
              {[
                { id: 'cash', label: 'Cash (नगद)' },
                { id: 'esewa', label: 'eSewa QR' },
                { id: 'bank_transfer', label: 'Bank Transfer' },
                { id: 'connectips', label: 'ConnectIPS' },
                { id: 'cheque', label: 'Cheque' },
                { id: 'credit', label: 'Credit (बाँकी खाता)' },
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg border text-2xs text-left transition-all ${
                    paymentMethod === method.id
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference / Txn Number if bank/digital */}
          {['esewa', 'bank_transfer', 'connectips', 'cheque'].includes(paymentMethod) && (
            <div>
              <label className="text-3xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Txn / Cheque Reference #
              </label>
              <input
                type="text"
                placeholder="e.g. TXN-998412 or Cheque 004812"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-hidden focus:border-indigo-500"
              />
            </div>
          )}

          {/* Bill Summary Breakdown */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono">{formatNPR(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1">Flat Discount:</span>
              <div className="flex items-center gap-1">
                <span className="text-3xs text-slate-400">Rs.</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-16 text-right font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>VAT ({defaultVatRate}%):</span>
              <span className="font-mono">{formatNPR(taxAmount)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-baseline justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
              <span>Grand Total:</span>
              <span className="text-lg text-indigo-600 dark:text-indigo-400 font-mono">
                {formatNPR(grandTotal)}
              </span>
            </div>
          </div>

          {/* Amount Paid & Due Breakdown */}
          <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Amount Received:</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold text-indigo-600">Rs.</span>
                <input
                  type="number"
                  min="0"
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  className="w-24 text-right font-mono font-bold bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded px-1.5 py-1 text-xs outline-hidden"
                />
              </div>
            </div>

            {dueAmount > 0 && (
              <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                <span>Credit Due (बाँकी):</span>
                <span className="font-mono">{formatNPR(dueAmount)}</span>
              </div>
            )}

            {changeToReturn > 0 && (
              <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>Change to Return:</span>
                <span className="font-mono">{formatNPR(changeToReturn)}</span>
              </div>
            )}
          </div>

        </div>

        {/* Complete Checkout Button */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all ${
              cart.length === 0
                ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 active:scale-[0.98]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete Sale & Print Bill</span>
          </button>
        </div>
      </div>

      {/* MODAL: ADD CUSTOMER POPUP */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Register New Customer (नयाँ ग्राहक दर्ता)
            </h3>
            
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer / Contact Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Company / Firm Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Sharma Builders Pvt. Ltd."
                  value={newCustomerForm.companyName}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, companyName: e.target.value })}
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
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">PAN / VAT Number</label>
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
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer Pricing Type</label>
                  <select
                    value={newCustomerForm.customerType}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customerType: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="retail">Retail Counter</option>
                    <option value="wholesale">Wholesale Buyer</option>
                    <option value="contractor">Builder / Contractor</option>
                    <option value="dealer">Sub-Dealer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    value={newCustomerForm.creditLimit}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, creditLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVOICE PRINT PREVIEW MODAL */}
      {completedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-auto text-slate-900 dark:text-slate-100">
            
            {/* Modal Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 print:hidden">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Invoice Successfully Generated & Recorded!</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print A4 / Receipt
                </button>
                <button
                  onClick={() => setCompletedInvoice(null)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                >
                  Done (Close)
                </button>
              </div>
            </div>

            {/* Printable A4 Tax Invoice Card */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50/50 dark:bg-slate-950/50 text-xs space-y-4 font-sans print:border-none print:p-0">
              
              {/* Company Header */}
              <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-4">
                <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  {settings.companyName}
                </h2>
                <p className="text-2xs text-slate-500 mt-1">
                  {settings.address.street}, {settings.address.municipality}, {settings.address.district} | Tel: {settings.phone}, {settings.mobile}
                </p>
                <p className="text-2xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  PAN/VAT No: {settings.panNumber}
                </p>
                <div className="mt-2 inline-block px-3 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-3xs font-bold uppercase tracking-widest">
                  TAX INVOICE / बिल
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 gap-4 text-2xs">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-300">Customer Details:</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs">{completedInvoice.customerName}</p>
                  {completedInvoice.customerAddress && <p className="text-slate-500">{completedInvoice.customerAddress}</p>}
                  {completedInvoice.customerPhone && <p className="text-slate-500 font-mono">Tel: {completedInvoice.customerPhone}</p>}
                  {completedInvoice.customerPanVat && <p className="text-slate-500 font-mono">Buyer's PAN: {completedInvoice.customerPanVat}</p>}
                </div>
                <div className="text-right font-mono">
                  <p><span className="text-slate-500">Invoice No:</span> <span className="font-bold text-slate-900 dark:text-slate-100">{completedInvoice.invoiceNumber}</span></p>
                  <p><span className="text-slate-500">Date:</span> {formatDate(completedInvoice.date)} ({toNepaliBSDate(new Date(completedInvoice.date))})</p>
                  <p><span className="text-slate-500">Fiscal Year:</span> {completedInvoice.fiscalYear}</p>
                  <p><span className="text-slate-500">Salesperson:</span> {completedInvoice.salespersonName}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-2xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold border-y border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-1.5 px-2">SN</th>
                      <th className="py-1.5 px-2">Description of Goods</th>
                      <th className="py-1.5 px-2 text-center">Unit</th>
                      <th className="py-1.5 px-2 text-right">Qty</th>
                      <th className="py-1.5 px-2 text-right">Rate (Rs.)</th>
                      <th className="py-1.5 px-2 text-right">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {completedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2 font-mono">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-medium">
                          {item.productName}
                          <span className="block text-3xs text-slate-400 font-mono">SKU: {item.sku}</span>
                        </td>
                        <td className="py-1.5 px-2 text-center">{item.selectedUnit}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{item.quantity}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{item.unitPrice.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-semibold">{item.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & In Words */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1 text-2xs">
                <div className="flex justify-between font-medium">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatNPR(completedInvoice.subtotal)}</span>
                </div>
                {completedInvoice.discountAmount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatNPR(completedInvoice.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Taxable Amount:</span>
                  <span className="font-mono">{formatNPR(completedInvoice.taxableAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>VAT ({settings.defaultVatRate}%):</span>
                  <span className="font-mono">{formatNPR(completedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Grand Total:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{formatNPR(completedInvoice.grandTotal)}</span>
                </div>
                <div className="pt-2 text-3xs italic text-slate-600 dark:text-slate-400">
                  In Words: <span className="font-semibold not-italic">{numberToWordsNPR(completedInvoice.grandTotal)}</span>
                </div>
              </div>

              {/* Footer Terms */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-3xs text-slate-500 flex justify-between items-end">
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Terms & Conditions:</p>
                  <p className="max-w-md">{completedInvoice.terms || settings.termsAndConditions}</p>
                </div>
                <div className="text-center">
                  <div className="h-8 border-b border-slate-300 dark:border-slate-700 w-32 mb-1" />
                  <p className="font-medium">Authorized Signature</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
