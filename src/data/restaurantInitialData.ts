import { 
  DiningZone, DiningTable, ProductCategory, Product, 
  KitchenOrderTicket, Customer, Warehouse, CompanySettings,
  StaffRoleDefinition, StaffDepartmentDefinition, StaffStatusDefinition,
  StaffShiftDefinition, StaffMember, AttendanceRecord, StaffAuditLog,
  FoodWasteRecord, POSPrinterConfig, KitchenMasterRecipe, StaffPermissions
} from '../types';

export const DEFAULT_WALKIN_CUSTOMER: Customer = {
  id: 'cust-walkin',
  customerCode: 'CUST-WALKIN',
  name: 'Walk-in Guest (Counter Sale)',
  phone: '9800000000',
  customerType: 'retail',
  address: {
    province: 'Bagmati',
    district: 'Kathmandu',
    municipality: 'Kathmandu',
    street: 'Direct Counter Sale'
  },
  creditLimit: 0,
  currentBalance: 0,
  openingBalance: 0,
  paymentTermsDays: 0,
  active: true,
  createdAt: 1735689600000
};

export const RESTAURANT_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-main',
    name: 'Main Kitchen & Dining Store',
    code: 'WH-KIT-01',
    location: 'Central Kitchen Floor',
    managerName: 'Head Chef',
    contact: '+977-9851011223',
    isMain: true,
    active: true
  },
  {
    id: 'wh-bar',
    name: 'Bar & Beverage Cellar',
    code: 'WH-BAR-02',
    location: 'Lounge Bar Counter',
    managerName: 'Bar Manager',
    contact: '+977-9841234567',
    isMain: false,
    active: true
  },
  {
    id: 'wh-cold',
    name: 'Cold Storage & Deep Freezer',
    code: 'WH-COLD-03',
    location: 'Basement Cold Room',
    managerName: 'Store In-charge',
    contact: '+977-9801234890',
    isMain: false,
    active: true
  }
];

export const DEFAULT_RESTAURANT_SETTINGS: CompanySettings = {
  companyName: 'My Restaurant & Bar',
  tagline: 'Fine Dining, Live Floor Management & POS',
  panNumber: '',
  vatNumber: '',
  phone: '',
  mobile: '',
  email: '',
  website: '',
  address: {
    province: 'Bagmati Province',
    district: 'Kathmandu',
    municipality: 'Kathmandu',
    ward: '',
    street: ''
  },
  defaultVatRate: 13,
  currencySymbol: 'Rs. ',
  currencyCode: 'NPR',
  fiscalYear: '2082/83',
  invoicePrefix: 'INV-',
  purchasePrefix: 'PO-',
  quotePrefix: 'QT-',
  termsAndConditions: '1. Food once served or billed cannot be cancelled. 2. Please retain receipt for table verification.',
  invoiceFooterMessage: 'Thank you for dining with us! We hope to serve you again soon.',
  lowStockThresholdDefault: 5
};

export const INITIAL_RESTAURANT_ZONES: DiningZone[] = [
  { id: 'zone-main', name: 'Main Dining Hall', code: 'MAIN', description: 'Central indoor dining area', active: true, order: 1 },
  { id: 'zone-rooftop', name: 'Rooftop Lounge & Terrace', code: 'ROOF', description: 'Outdoor scenic terrace seating', active: true, order: 2 },
  { id: 'zone-bar', name: 'Bar & High Top Stools', code: 'BAR', description: 'Cocktail counter and bar seating', active: true, order: 3 }
];

// Production Clean Slate: No dummy tables
export const INITIAL_TABLES: DiningTable[] = [];

export const CLEAN_AVAILABLE_TABLES: DiningTable[] = [];

// Clean standard category structure for menu organization
export const RESTAURANT_MENU_CATEGORIES: ProductCategory[] = [
  { id: 'cat-starters', name: 'Appetizers & Starters', code: 'APP', description: 'Finger foods, starters and platters', isDefault: true },
  { id: 'cat-mains', name: 'Main Courses & Grills', code: 'MAIN', description: 'Curries, sizzlers, steaks, and entrees', isDefault: true },
  { id: 'cat-pizza-pasta', name: 'Pizza & Pasta', code: 'PIZZA', description: 'Woodfired artisan pizzas and pastas', isDefault: true },
  { id: 'cat-burgers', name: 'Burgers & Sandwiches', code: 'BRG', description: 'Brioche burgers, sliders, and wraps', isDefault: true },
  { id: 'cat-cocktails', name: 'Craft Cocktails & Bar', code: 'BAR', description: 'Cocktails, draught beer, spirits, and wine', isDefault: true },
  { id: 'cat-beverages', name: 'Beverages & Mocktails', code: 'BEV', description: 'Fresh juices, smoothies, espresso, and teas', isDefault: true },
  { id: 'cat-desserts', name: 'Desserts & Sweets', code: 'DES', description: 'Cakes, pastries, ice cream, and desserts', isDefault: true },
  { id: 'cat-raw-stock', name: 'Kitchen Raw Stock & Meat', code: 'RAW', description: 'Depletable pantry ingredients and stock', isDefault: true },
];

// Production Clean Slate: No dummy products
export const INITIAL_MENU_PRODUCTS: Product[] = [];

// Production Clean Slate: No dummy recipes
export const INITIAL_MASTER_RECIPES: KitchenMasterRecipe[] = [];

// Production Clean Slate: No dummy KOT tickets
export const INITIAL_KOTS: KitchenOrderTicket[] = [];

export const getDefaultStaffPermissions = (role: string): StaffPermissions => {
  const r = (role || '').toLowerCase();

  if (r.includes('manager') || r.includes('admin') || r.includes('owner') || r.includes('supervisor')) {
    return {
      canPunchOrders: true,
      canApplyDiscounts: true,
      maxDiscountPercent: 100,
      canVoidItems: true,
      canCancelBills: true,
      canReprintBills: true,
      canOpenCashDrawer: true,
      canAccessKDS: true,
      canAccessBOT: true,
      canAccessInventory: true,
      canViewReports: true,
      canManageStaff: true
    };
  }

  if (r.includes('cashier') || r.includes('billing') || r.includes('accountant')) {
    return {
      canPunchOrders: true,
      canApplyDiscounts: true,
      maxDiscountPercent: 15,
      canVoidItems: true,
      canCancelBills: true,
      canReprintBills: true,
      canOpenCashDrawer: true,
      canAccessKDS: false,
      canAccessBOT: false,
      canAccessInventory: false,
      canViewReports: true,
      canManageStaff: false
    };
  }

  if (r.includes('chef') || r.includes('cook') || r.includes('bakery') || r.includes('pastry') || r.includes('kitchen')) {
    return {
      canPunchOrders: false,
      canApplyDiscounts: false,
      maxDiscountPercent: 0,
      canVoidItems: false,
      canCancelBills: false,
      canReprintBills: false,
      canOpenCashDrawer: false,
      canAccessKDS: true,
      canAccessBOT: false,
      canAccessInventory: true,
      canViewReports: false,
      canManageStaff: r.includes('head') || r.includes('executive')
    };
  }

  if (r.includes('bar') || r.includes('beverage') || r.includes('sommelier') || r.includes('barista')) {
    return {
      canPunchOrders: true,
      canApplyDiscounts: true,
      maxDiscountPercent: 10,
      canVoidItems: true,
      canCancelBills: false,
      canReprintBills: true,
      canOpenCashDrawer: true,
      canAccessKDS: false,
      canAccessBOT: true,
      canAccessInventory: true,
      canViewReports: false,
      canManageStaff: false
    };
  }

  if (r.includes('waiter') || r.includes('server') || r.includes('captain') || r.includes('host') || r.includes('runner') || r.includes('steward')) {
    return {
      canPunchOrders: true,
      canApplyDiscounts: false,
      maxDiscountPercent: 0,
      canVoidItems: true,
      canCancelBills: false,
      canReprintBills: false,
      canOpenCashDrawer: false,
      canAccessKDS: false,
      canAccessBOT: false,
      canAccessInventory: false,
      canViewReports: false,
      canManageStaff: false
    };
  }

  // Default fallback for any other role
  return {
    canPunchOrders: true,
    canApplyDiscounts: false,
    maxDiscountPercent: 0,
    canVoidItems: true,
    canCancelBills: false,
    canReprintBills: false,
    canOpenCashDrawer: false,
    canAccessKDS: false,
    canAccessBOT: false,
    canAccessInventory: false,
    canViewReports: false,
    canManageStaff: false
  };
};

export const INITIAL_STAFF_ROLES: StaffRoleDefinition[] = [
  { id: 'role-mgr', name: 'Restaurant Manager', departmentDefault: 'Management & Accounts', description: 'Overall venue operations & admin overrides', isSystem: true },
  { id: 'role-asst-mgr', name: 'Assistant Manager', departmentDefault: 'Management & Accounts', description: 'Floor supervision & shift management', isSystem: true },
  { id: 'role-cashier', name: 'Cashier / Billing', departmentDefault: 'Front of House', description: 'Counter POS, bill settlement & IRD VAT invoices', isSystem: true },
  { id: 'role-captain', name: 'Captain / Head Waiter', departmentDefault: 'Front of House', description: 'Table allocation & guest dining experience', isSystem: true },
  { id: 'role-waiter', name: 'Waiter / Server', departmentDefault: 'Front of House', description: 'Order taking, table service & guest KOT', isSystem: true },
  { id: 'role-host', name: 'Host / Greeter', departmentDefault: 'Front of House', description: 'Reservations, door greeting & seating', isSystem: true },
  { id: 'role-head-chef', name: 'Head Chef', departmentDefault: 'Kitchen & Food Prep', description: 'Kitchen line command, recipe costing & inventory prep', isSystem: true },
  { id: 'role-line-cook', name: 'Line Cook', departmentDefault: 'Kitchen & Food Prep', description: 'Station cooking, dish assembly & KDS bumping', isSystem: true },
  { id: 'role-pastry', name: 'Pastry / Bakery Chef', departmentDefault: 'Bakery & Pastry', description: 'Desserts, cakes, bread baking & display stock', isSystem: true },
  { id: 'role-bartender', name: 'Bartender', departmentDefault: 'Bar & Beverages', description: 'Cocktail mixing, bar dispense & alcohol inventory', isSystem: true },
  { id: 'role-barista', name: 'Barista', departmentDefault: 'Bar & Beverages', description: 'Specialty coffee, espresso bar & morning beverages', isSystem: true },
  { id: 'role-sommelier', name: 'Sommelier', departmentDefault: 'Bar & Beverages', description: 'Wine pairings & cellar inventory management', isSystem: true },
  { id: 'role-runner', name: 'Food Runner / Busser', departmentDefault: 'Front of House', description: 'Plate delivery from kitchen pass to dining tables', isSystem: true },
  { id: 'role-cleaner', name: 'Housekeeping / Cleaner', departmentDefault: 'Housekeeping', description: 'Dining area hygiene, kitchen sanitation & dishwashing', isSystem: true },
  { id: 'role-store', name: 'Storekeeper / Inventory', departmentDefault: 'Store & Inventory', description: 'Purchase goods receiving, pantry audits & stock issue', isSystem: true }
];

export const INITIAL_STAFF_DEPARTMENTS: StaffDepartmentDefinition[] = [
  { id: 'dept-foh', name: 'Front of House', description: 'Dining halls, private rooms & table service', isSystem: true },
  { id: 'dept-kitchen', name: 'Kitchen & Food Prep', description: 'Hot line, prep kitchen, tandoor & wok stations', isSystem: true },
  { id: 'dept-bar', name: 'Bar & Beverages', description: 'Cocktail bar, dispense & beverage counter', isSystem: true },
  { id: 'dept-mgmt', name: 'Management & Accounts', description: 'Cash register, admin desk & financial records', isSystem: true },
  { id: 'dept-bakery', name: 'Bakery & Pastry', description: 'Bakehouse, dessert display & breakfast pastries', isSystem: true },
  { id: 'dept-patio', name: 'Outdoor Terrace', description: 'Open garden, rooftop & patio seating', isSystem: true },
  { id: 'dept-delivery', name: 'Delivery & Takeaway', description: 'Packaging counter & online rider handoff', isSystem: true },
  { id: 'dept-store', name: 'Store & Inventory', description: 'Dry warehouse, cold rooms & vendor receiving', isSystem: true },
  { id: 'dept-housekeeping', name: 'Housekeeping', description: 'Sanitation, dishwashing & facility maintenance', isSystem: true }
];

export const INITIAL_STAFF_STATUSES: StaffStatusDefinition[] = [
  { id: 'stat-active', name: 'Active (On Duty)', color: '#059669', description: 'Currently on shift and available on floor', isSystem: true },
  { id: 'stat-break', name: 'On Break', color: '#d97706', description: 'Taking scheduled lunch or tea break', isSystem: true },
  { id: 'stat-off', name: 'Off Duty', color: '#64748b', description: 'Shift completed or not scheduled today', isSystem: true },
  { id: 'stat-leave', name: 'On Leave', color: '#dc2626', description: 'Approved annual, sick, or casual leave', isSystem: true },
  { id: 'stat-training', name: 'In Training / Probation', color: '#7c3aed', description: 'New trainee under onboarding period', isSystem: true }
];

export const INITIAL_SHIFTS: StaffShiftDefinition[] = [
  {
    id: 'shift-morning',
    name: 'Morning Prep & Breakfast',
    startTime: '07:30',
    endTime: '15:30',
    color: '#0284c7',
    daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    notes: 'Morning station prep, breakfast orders, bakery stock intake'
  },
  {
    id: 'shift-evening',
    name: 'Evening & Dinner Rush',
    startTime: '15:00',
    endTime: '23:30',
    color: '#7c3aed',
    daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    notes: 'Dinner rush, cocktail service, closing kitchen sanitization'
  },
  {
    id: 'shift-split',
    name: 'Split Lunch & Dinner',
    startTime: '11:00',
    endTime: '22:30',
    color: '#059669',
    daysActive: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    notes: '11:00-15:00 Lunch rush + 18:00-22:30 Dinner rush'
  }
];

// Production Clean Slate: No dummy staff
export const INITIAL_STAFF: StaffMember[] = [];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

export const INITIAL_STAFF_AUDIT_LOGS: StaffAuditLog[] = [];

// Production Clean Slate: No dummy food waste
export const INITIAL_FOOD_WASTE: FoodWasteRecord[] = [];

// Production Thermal Printers: Pre-configured default stations (Cashier, Kitchen KOT, Bar BOT)
export const INITIAL_PRINTERS: POSPrinterConfig[] = [
  {
    id: 'prn-kitchen-default',
    name: 'Kitchen KOT Line Printer',
    station: 'kitchen',
    connectionType: 'universal',
    paperWidth: '80mm',
    isDefault: true,
    isActive: true,
    autoPrintKOT: true,
    autoPrintBOT: false,
    autoPrintBill: false,
    copiesCount: 1,
    headerCustomText: '*** KITCHEN ORDER TICKET (KOT) ***',
    footerCustomText: 'Dispatch dishes immediately upon preparation',
    showQrCode: false,
    kickCashDrawer: false,
    lastTestedAt: Date.now()
  },
  {
    id: 'prn-bar-default',
    name: 'Bar Dispense BOT Printer',
    station: 'bar',
    connectionType: 'universal',
    paperWidth: '80mm',
    isDefault: true,
    isActive: true,
    autoPrintKOT: false,
    autoPrintBOT: true,
    autoPrintBill: false,
    copiesCount: 1,
    headerCustomText: '*** BAR ORDER TICKET (BOT) ***',
    footerCustomText: 'Dispense chilled to table server',
    showQrCode: false,
    kickCashDrawer: false,
    lastTestedAt: Date.now()
  },
  {
    id: 'prn-cashier-default',
    name: 'Cashier Tax Invoice Printer',
    station: 'billing',
    connectionType: 'universal',
    paperWidth: '80mm',
    isDefault: true,
    isActive: true,
    autoPrintKOT: false,
    autoPrintBOT: false,
    autoPrintBill: true,
    copiesCount: 1,
    headerCustomText: 'TAX INVOICE',
    footerCustomText: 'Thank you for dining with us! Visit again.',
    showQrCode: true,
    kickCashDrawer: true,
    lastTestedAt: Date.now()
  }
];
