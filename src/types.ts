export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'sales' | 'inventory' | 'accountant';
  branchId: string;
  avatarUrl?: string;
  phone?: string;
  active: boolean;
}

export type UnitType = 'quantity' | 'length' | 'area' | 'weight' | 'volume';

export interface ProductCategory {
  id: string;
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
}

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  type: UnitType;
  baseUnit?: string;
  conversionFactor?: number; // Multiply by this to get base unit
  description?: string;
}

export interface UnitConversion {
  unitName: string; // e.g. "Bundle", "Box", "Length"
  unitSymbol: string; // e.g. "bdl", "box", "len"
  multiplierToBase: number; // e.g., 1 bundle = 10 pcs -> 10
  priceMultiplier?: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string; // e.g. "1/2 inch", "3/4 inch", "White", "600x600"
  attributes: {
    size?: string;
    color?: string;
    thickness?: string;
    diameter?: string;
    finish?: string;
    material?: string;
  };
  barcode?: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  currentStock: number; // Stored in base unit
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand: string;
  model?: string;
  supplierId?: string;
  supplierName?: string;
  
  // Units system
  baseUnit: string; // e.g. "Piece", "Meter", "Kg"
  baseUnitSymbol: string; // "pcs", "m", "kg"
  alternativeUnits: UnitConversion[]; // e.g. [{ unitName: 'Box', unitSymbol: 'box', multiplierToBase: 50 }]
  
  // Pricing (all in NPR)
  costPrice: number; // Landed / Average Cost
  retailPrice: number; // MRP / Standard counter rate
  wholesalePrice: number; // Bulk contractor rate
  dealerPrice?: number;
  minSellingPrice?: number;
  taxRatePercent: number; // 0 or 13% for VAT in Nepal
  
  // Inventory tracking
  trackStock: boolean;
  currentStock: number; // internal base unit
  reorderLevel: number;
  maxStock?: number;
  warehouseId: string;
  warehouseName: string;
  locationBin?: string; // Rack-A, Shelf-2
  
  hasVariants: boolean;
  variants?: ProductVariant[];
  
  warrantyMonths?: number;
  hasSerialNumber?: boolean;
  hasBatchNumber?: boolean;
  
  status: 'active' | 'inactive' | 'discontinued';
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location: string;
  managerName?: string;
  contact?: string;
  isMain: boolean;
  active: boolean;
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  panVatNumber?: string;
  customerType: 'retail' | 'wholesale' | 'contractor' | 'dealer';
  address: {
    province: string;
    district: string;
    municipality: string;
    street: string;
  };
  creditLimit: number;
  currentBalance: number; // Positive = customer owes money (Receivable)
  openingBalance: number;
  paymentTermsDays: number;
  active: boolean;
  notes?: string;
  createdAt: number;
}

export interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  panVatNumber: string;
  address: {
    province: string;
    district: string;
    municipality: string;
    street: string;
  };
  creditLimit?: number;
  currentBalance: number; // Positive = we owe supplier money (Payable)
  openingBalance: number;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    branch: string;
  };
  active: boolean;
  notes?: string;
  createdAt: number;
}

export interface SaleItem {
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  barcode?: string;
  selectedUnit: string; // e.g. "Box" or "Piece"
  conversionFactor: number; // multiplier to base unit
  quantity: number; // quantity in selectedUnit
  baseQuantity: number; // quantity in baseUnit (quantity * conversionFactor)
  unitPrice: number; // price per selectedUnit
  costPrice: number; // base unit cost * conversionFactor
  discountPercent: number;
  discountAmount: number;
  taxRatePercent: number;
  taxAmount: number;
  lineTotal: number;
  returnedQuantity?: number; // quantity already returned in selectedUnit
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-0001
  date: number; // timestamp
  fiscalYear: string; // e.g. "2082/2083" or "2026/2027"
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerPanVat?: string;
  customerAddress?: string;
  customerType: 'retail' | 'wholesale' | 'contractor' | 'dealer';
  salespersonId: string;
  salespersonName: string;
  warehouseId: string;
  warehouseName: string;
  
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number; // 13% VAT
  nonTaxableAmount: number;
  grandTotal: number;
  totalCost: number; // Sum of cost of goods sold
  grossProfit: number;
  
  paymentMethod: 'cash' | 'bank_transfer' | 'esewa' | 'fonepay' | 'khalti' | 'connectips' | 'cheque' | 'credit' | 'partial';
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overdue';
  paymentReference?: string;
  
  status: 'completed' | 'cancelled' | 'returned' | 'partially_returned';
  notes?: string;
  terms?: string;
  createdAt: number;
}

export interface PurchaseItem {
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  selectedUnit: string;
  conversionFactor: number;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  discountPercent: number;
  taxRatePercent: number;
  lineTotal: number;
}

export interface PurchaseInvoice {
  id: string;
  purchaseNumber: string; // PUR-2026-0001
  supplierInvoiceNumber?: string;
  date: number;
  supplierId: string;
  supplierName: string;
  supplierPanVat?: string;
  warehouseId: string;
  warehouseName: string;
  
  items: PurchaseItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  freightCost: number;
  otherExpenses: number;
  grandTotal: number;
  
  paymentMethod: 'cash' | 'bank_transfer' | 'connectips' | 'cheque' | 'credit' | 'partial';
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overdue';
  status: 'received' | 'partially_received' | 'ordered' | 'cancelled' | 'returned';
  notes?: string;
  createdAt: number;
}

export interface StockMovement {
  id: string;
  date: number;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  movementType: 'purchase' | 'sale' | 'sale_return' | 'purchase_return' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'damage' | 'opening';
  referenceId: string; // e.g. Invoice #, Purchase #, Transfer #
  quantityIn: number; // Base unit
  quantityOut: number; // Base unit
  previousBalance: number;
  newBalance: number;
  unitCost: number;
  totalValue: number;
  notes?: string;
  performedBy: string;
}

export interface StockAdjustment {
  id: string;
  date: number;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  type: 'damage' | 'loss' | 'found' | 'correction' | 'internal_use';
  quantityDelta: number; // Positive = add stock, negative = reduce
  unitCost: number;
  reason: string;
  performedBy: string;
  createdAt: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string; // STK-2026-0001
  date: number;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  items: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number; // Base unit
    unitCost: number;
  }[];
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  initiatedBy: string;
  createdAt: number;
}

export interface ExpenseRecord {
  id: string;
  expenseNumber: string; // EXP-2026-0001
  date: number;
  category: 'Rent' | 'Electricity & Water' | 'Salary & Wages' | 'Transportation & Fuel' | 'Internet & Phone' | 'Maintenance & Repair' | 'Marketing' | 'Packaging' | 'Bank Charges' | 'Miscellaneous';
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'esewa' | 'khalti' | 'connectips' | 'cheque';
  paidTo: string;
  accountName: string; // e.g., "Cash in Hand", "Nabil Bank Current"
  notes?: string;
  recordedBy: string;
  createdAt: number;
}

export interface Quotation {
  id: string;
  quoteNumber: string; // QUO-2026-0001
  date: number;
  validUntil: number;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted' | 'expired';
  notes?: string;
  createdBy: string;
  createdAt: number;
}

export interface SalesReturn {
  id: string;
  returnNumber: string; // RET-2026-0001
  date: number;
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  customerId: string;
  customerName: string;
  items: {
    productId: string;
    productName: string;
    returnedQuantity: number; // selected unit
    baseQuantity: number;
    unitPrice: number;
    refundAmount: number;
    reason: 'damaged' | 'wrong_item' | 'defective' | 'customer_choice' | 'exchange' | 'other';
  }[];
  totalRefundAmount: number;
  restockItems: boolean;
  refundMethod: 'cash' | 'credit_note' | 'bank_transfer' | 'deduct_due';
  status: 'completed' | 'pending';
  notes?: string;
  processedBy: string;
  createdAt: number;
}

export interface CompanySettings {
  companyName: string;
  tagline: string;
  panNumber: string;
  vatNumber?: string;
  phone: string;
  mobile: string;
  email: string;
  website?: string;
  address: {
    province: string;
    district: string;
    municipality: string;
    ward: string;
    street: string;
  };
  defaultVatRate: number; // 13
  currencySymbol: string; // "Rs. "
  currencyCode: string; // "NPR"
  fiscalYear: string; // "2082/83"
  invoicePrefix: string; // "INV-"
  purchasePrefix: string; // "PUR-"
  quotePrefix: string; // "QUO-"
  termsAndConditions: string;
  invoiceFooterMessage: string;
  lowStockThresholdDefault: number;
}

export type BusinessSettings = CompanySettings;
