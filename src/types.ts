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

export interface AppAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
  providerId: 'google.com' | 'password' | 'demo';
  verificationCode?: string;
}

export interface StoredUserAccount {
  uid: string;
  email: string;
  password?: string;
  name: string;
  role: 'super_admin' | 'admin' | 'sales' | 'inventory' | 'accountant';
  emailVerified: boolean;
  verificationCode?: string;
  createdAt: string;
  provider: 'google' | 'password';
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
  hsCode?: string;
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
  
  // Restaurant-specific fields
  itemType?: 'menu_item' | 'raw_ingredient' | 'beverage';
  department?: string; // e.g. "Food" | "Drink" | "Combos"
  subCategory?: string; // e.g. "Chick", "Veg", "Buff", "Beer", "Coffee"
  prepStyle?: string; // e.g. "Steam", "Fry", "Jhol", "Chilled Bottle"
  tileColor?: string; // e.g. "#2563eb"
  customAddons?: { id?: string; name: string; price: number }[];
  recipeIngredients?: RecipeIngredient[];
  linkedRecipeId?: string; // Reference to KitchenMasterRecipe ID
  linkedRecipeName?: string;
  modifiers?: MenuItemModifier[];
  prepTimeMinutes?: number;
  dietaryType?: 'veg' | 'non_veg' | 'vegan' | 'halal' | 'contains_alcohol';
  spiceLevel?: 'none' | 'mild' | 'medium' | 'hot' | 'extra_hot';
  
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

export interface SupplierContactPerson {
  name: string;
  phone: string;
}

export interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  companyName: string;
  phone: string;
  additionalPhones?: string[];
  additionalContacts?: SupplierContactPerson[];
  email?: string;
  panVatNumber: string;
  panVatType?: 'PAN' | 'VAT';
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
  hsCode?: string;
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
  serviceChargePercent?: number; // 10%
  currencySymbol: string; // "Rs. "
  currencyCode: string; // "NPR"
  fiscalYear: string; // "2082/83"
  invoicePrefix: string; // "INV-"
  purchasePrefix: string; // "PUR-"
  quotePrefix: string; // "QUO-"
  kotPrefix?: string; // "KOT-"
  termsAndConditions: string;
  invoiceFooterMessage: string;
  lowStockThresholdDefault: number;
}

export type BusinessSettings = CompanySettings;

// ==========================================
// RESTAURANT MANAGEMENT DOMAIN MODELS
// ==========================================

export type TableStatus = 'available' | 'seated' | 'kot_fired' | 'billed';

export type TableShape = 'square' | 'rectangular' | 'round' | 'bar_stool' | 'booth' | 'community' | 'wall' | 'window' | 'door' | 'plant' | 'counter' | 'section' | 'other';

export interface RestaurantFloor {
  id: string;
  name: string; // e.g. "Ground Floor", "1st Floor", "Rooftop"
  code?: string; // e.g. "GF", "1F", "RF"
  description?: string;
  order: number;
  active: boolean;
}

export interface RestaurantSection {
  id: string;
  floorId: string;
  floorName?: string;
  name: string; // e.g. "Main Dining Hall", "Balcony & Terrace", "AC Family Cabin", "Bar Counter"
  code?: string;
  description?: string;
  order: number;
  active: boolean;
}

export interface DiningZone {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  order: number;
}

export interface DiningTable {
  id: string;
  tableNumber: string; // e.g., "T-01", "R-05", "BAR-3", "CABIN-1"
  floorId?: string;
  floorName?: string;
  sectionId?: string;
  sectionName?: string;
  zoneId?: string;
  zoneName?: string;
  capacity: number; // 2, 4, 6, 8 guests
  shape: TableShape;
  status: TableStatus;
  currentGuests?: number;
  assignedWaiter?: string;
  activeSessionId?: string;
  openedAt?: number;
  lastOrderAt?: number;
  subtotal?: number;
  totalWithTax?: number;
  activeKOTCount?: number;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  rotation?: number; // 0, 45, 90, 180, 270 degrees
  isDecor?: boolean; // For architectural assets: plants, divider walls, bar counter, window, door
  decorType?: 'plant' | 'tree' | 'wall' | 'window' | 'door' | 'counter' | 'section' | 'other';
}

export interface RecipeIngredient {
  ingredientId: string; // Reference to Product ID (raw material/stock item)
  ingredientName: string;
  category?: string; // Ingredient category (Meat, Dairy, Veg, etc.)
  quantityRequired: number; // In ingredient's base unit
  unit: string; // e.g. "g", "ml", "pcs", "kg"
  costPerUnit: number;
  totalCost: number;
  currentStock?: number;
  trackStock?: boolean;
}

export interface MenuItemModifier {
  id: string;
  name: string; // e.g. "Spice Level", "Cooking Temp", "Add-on Cheese", "Extra Dip"
  options: {
    name: string; // e.g. "Mild", "Medium", "Extra Spicy"
    priceDelta: number; // 0 or +50 NPR
  }[];
}

export interface SelectedModifier {
  modifierName: string;
  optionName: string;
  priceDelta: number;
}

export interface KOTItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string; // e.g., "No onions", "Well done"
  selectedModifiers?: SelectedModifier[];
  status: 'ordered' | 'preparing' | 'ready' | 'served' | 'cancelled';
  course?: 'appetizer' | 'main' | 'beverage' | 'dessert' | 'other';
  prepTimeMinutes?: number;
  firedAt: number;
}

export interface KitchenOrderTicket {
  id: string;
  kotNumber: string; // e.g. "KOT-0042"
  tableId: string;
  tableNumber: string;
  zoneName: string;
  waiterName: string;
  guestsCount: number;
  items: KOTItem[];
  status: 'pending' | 'in_kitchen' | 'ready' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TableSession {
  id: string;
  tableId: string;
  tableNumber: string;
  zoneId: string;
  zoneName: string;
  status: 'active' | 'billed' | 'settled';
  guestsCount: number;
  waiterId: string;
  waiterName: string;
  customerName?: string;
  customerPhone?: string;
  openedAt: number;
  closedAt?: number;
  kots: KitchenOrderTicket[];
  items: SaleItem[];
  subtotal: number;
  serviceCharge: number;
  vatAmount: number;
  discountAmount: number;
  grandTotal: number;
}

export interface StaffPermissions {
  canPunchOrders: boolean;
  canApplyDiscounts: boolean;
  maxDiscountPercent: number;
  canVoidItems: boolean;
  canCancelBills: boolean;
  canReprintBills: boolean;
  canOpenCashDrawer: boolean;
  canAccessKDS: boolean;
  canAccessBOT: boolean;
  canAccessInventory: boolean;
  canViewReports: boolean;
  canManageStaff: boolean;
}

export interface StaffEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface StaffDocument {
  id: string;
  category: 'citizenship' | 'pan' | 'nid' | 'passport' | 'driving_license' | 'other';
  customCategoryName?: string;
  documentNumber: string;
  issuedDate?: string;
  issuedDistrict?: string;
  notes?: string;
}

export interface StaffRoleDefinition {
  id: string;
  name: string;
  departmentDefault?: string;
  description?: string;
  isSystem?: boolean;
}

export interface StaffDepartmentDefinition {
  id: string;
  name: string;
  description?: string;
  isSystem?: boolean;
}

export interface StaffStatusDefinition {
  id: string;
  name: string;
  color?: string;
  description?: string;
  isSystem?: boolean;
}

export interface StaffMember {
  id: string;
  employeeCode: string;
  name: string;
  username?: string; // QuickIMS Staff Portal username
  dob?: string; // Date of Birth (YYYY-MM-DD)
  role: string; // Standard role or custom role
  department: string; // Standard or custom department
  phone: string;
  alternatePhone?: string; // Additional phone number
  address?: string; // Residential or permanent address
  email?: string;
  emailVerified?: boolean; // Email verification status
  verificationCode?: string; // 6-digit email confirmation code
  verificationToken?: string; // Unique token for direct verification link
  verificationSentAt?: number; // Timestamp when verification was dispatched
  pin: string; // 4-digit numeric PIN
  shift: string; // Shift name or timetable identifier
  shiftId?: string; // Linked shift definition ID
  shiftStartTime?: string; // Exact timetable start time (e.g. "07:30")
  shiftEndTime?: string; // Exact timetable end time (e.g. "15:30")
  shiftDays?: string[]; // Active timetable days e.g. ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]
  status: string; // 'active' | 'on_break' | 'off_duty' | 'on_leave' or custom status
  joinedDate: string; // Joining/Starting Date (YYYY-MM-DD)
  tablesAssigned?: string[];
  salary?: number;
  hourlyRate?: number;
  citizenshipOrPan?: string;
  documents?: StaffDocument[]; // Category-based documents (PAN, NID, Citizenship, etc.)
  emergencyContact?: StaffEmergencyContact;
  avatarColor?: string;
  notes?: string;
  permissions: StaffPermissions;
  qrToken?: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  staffRole: string;
  date: string; // YYYY-MM-DD
  clockInTime: number; // Unix timestamp
  clockOutTime?: number; // Unix timestamp
  breakStartTime?: number;
  breakEndTime?: number;
  totalBreakMinutes: number;
  totalWorkedHours: number;
  status: 'present' | 'on_break' | 'completed' | 'half_day' | 'absent';
  method: 'pin' | 'qr_kiosk' | 'badge_scan' | 'manual';
  notes?: string;
}

export interface StaffAuditLog {
  id: string;
  timestamp: number;
  staffId: string;
  staffName: string;
  staffRole: string;
  actionType: 
    | 'clock_in' 
    | 'clock_out' 
    | 'break_start' 
    | 'break_end' 
    | 'item_void' 
    | 'bill_cancelled' 
    | 'discount_applied' 
    | 'table_transfer' 
    | 'manual_drawer_open' 
    | 'pin_override'
    | 'table_assigned'
    | 'staff_created'
    | 'staff_updated';
  targetEntityId?: string;
  targetEntityName?: string;
  details: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface StaffShiftDefinition {
  id: string;
  name: string;
  startTime: string; // "07:00"
  endTime: string; // "15:30"
  color: string;
  daysActive?: string[];
  notes?: string;
}

export interface KitchenMasterRecipe {
  id: string;
  name: string; // e.g. "Buff Momo Standard Plate (10 pcs)", "Jhol Gravy Base (1 L)"
  category: string; // e.g. "Momo", "Curry & Gravy", "Beverage Base", "Bakery", "General"
  type: 'portion_prep' | 'batch_base'; // portion prep (1 plate) or batch prep (e.g. 5kg / 10L)
  yieldQuantity: number; // e.g. 1 portion or 10 portions
  yieldUnit: string; // e.g. "portion", "plate", "kg", "L"
  ingredients: RecipeIngredient[];
  totalCost: number;
  costPerYieldUnit: number;
  description?: string;
  prepTimeMinutes?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FoodWasteRecord {
  id: string;
  date: string;
  timestamp: number;
  productId: string;
  productName: string;
  category: string;
  itemType?: 'raw_ingredient' | 'menu_item';
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalLoss: number;
  reason: 'spoilage_expired' | 'cooking_error_burned' | 'customer_return' | 'prep_trimming' | 'spilled_dropped';
  loggedBy: string;
  notes?: string;
}
