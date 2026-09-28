import { 
  Product, Customer, Supplier, Warehouse, SaleInvoice, PurchaseInvoice, 
  StockMovement, ExpenseRecord, CompanySettings, UnitDefinition, ProductCategory 
} from '../types';
import { 
  RESTAURANT_MENU_CATEGORIES, 
  INITIAL_MENU_PRODUCTS, 
  INITIAL_RESTAURANT_ZONES, 
  INITIAL_TABLES, 
  INITIAL_KOTS 
} from './restaurantInitialData';

export const INITIAL_CATEGORIES: ProductCategory[] = RESTAURANT_MENU_CATEGORIES;

export const INITIAL_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'The Royal Heritage Restro & Bar',
  tagline: 'Artisanal Dining, Craft Cocktails & Live Kitchen',
  panNumber: '609823412',
  vatNumber: '609823412',
  phone: '+977-1-4432100',
  mobile: '+977-9801998877',
  email: 'hospitality@royalheritage.com.np',
  website: 'www.royalheritagerestro.com.np',
  address: {
    province: 'Bagmati Province',
    district: 'Kathmandu',
    municipality: 'Kathmandu Metropolitan City',
    ward: 'Ward 03',
    street: 'Lazimpat Food Corridor, Near Embassy Way'
  },
  defaultVatRate: 13,
  currencySymbol: 'Rs. ',
  currencyCode: 'NPR',
  fiscalYear: '2082/83',
  invoicePrefix: 'REST-2082-',
  purchasePrefix: 'PO-2082-',
  quotePrefix: 'EVT-2082-',
  termsAndConditions: '1. Food once served or billed cannot be cancelled. 2. 10% Service Charge and 13% Government VAT applied as per regulations. 3. Please retain receipt for table verification.',
  invoiceFooterMessage: 'Thank you for dining at The Royal Heritage! We hope to serve you again soon.',
  lowStockThresholdDefault: 5
};

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-main',
    name: 'Central Cold Storage & Kitchen Pantry',
    code: 'KIT-MAIN-01',
    location: 'Lazimpat, Ground Floor Kitchen',
    managerName: 'Kitchen Executive',
    contact: '+977-9851098123',
    isMain: true,
    active: true
  },
  {
    id: 'wh-bar',
    name: 'Bar Liquor Locker & Beverage Depot',
    code: 'BAR-STK-02',
    location: 'Rooftop Bar Backroom',
    managerName: 'Beverage Manager',
    contact: '+977-9841882233',
    isMain: false,
    active: true
  }
];

export const INITIAL_UNITS: UnitDefinition[] = [
  { id: 'u-plate', name: 'Plate', symbol: 'plt', type: 'quantity', description: 'Standard dining plate or serving portion' },
  { id: 'u-portion', name: 'Portion', symbol: 'prt', type: 'quantity', description: 'Chef preparation portion' },
  { id: 'u-glass', name: 'Glass', symbol: 'gls', type: 'quantity', description: 'Single drink or cocktail serving' },
  { id: 'u-bottle', name: 'Bottle', symbol: 'btl', type: 'quantity', description: 'Full beverage bottle (750ml / 650ml)' },
  { id: 'u-kg', name: 'Kilogram', symbol: 'kg', type: 'weight', description: 'Kitchen meat, flour, produce raw weight' },
  { id: 'u-gram', name: 'Gram', symbol: 'g', type: 'weight', description: 'Recipe spice or cheese ingredient weight' },
  { id: 'u-liter', name: 'Liter', symbol: 'L', type: 'volume', description: 'Dairy milk, cooking oils and bulk liquids' },
  { id: 'u-pcs', name: 'Piece', symbol: 'pcs', type: 'quantity', description: 'Individual bakery, buns or fruit piece' },
  { id: 'u-box', name: 'Box / Crate', symbol: 'box', type: 'quantity', description: 'Packaged beverage crates or produce boxes' }
];

export const INITIAL_PRODUCTS: Product[] = INITIAL_MENU_PRODUCTS;

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-walkin',
    customerCode: 'CUST-0000',
    name: 'Walk-in Table Guest (टेबल पाहुना)',
    phone: '9800000000',
    customerType: 'retail',
    address: {
      province: 'Bagmati',
      district: 'Kathmandu',
      municipality: 'Kathmandu',
      street: 'Dine-In Floor'
    },
    creditLimit: 0,
    currentBalance: 0,
    openingBalance: 0,
    paymentTermsDays: 0,
    active: true,
    createdAt: Date.now() - 100 * 86400000
  },
  {
    id: 'cust-vip-prashant',
    customerCode: 'CUST-0001',
    name: 'Prashant Bikram Shah',
    companyName: 'Shah Capital Holdings',
    phone: '+977-9851088776',
    email: 'prashant.shah@shahholdings.com',
    panVatNumber: '302918231',
    customerType: 'dealer', // VIP corporate guest
    address: {
      province: 'Bagmati',
      district: 'Kathmandu',
      municipality: 'Kathmandu Metropolitan',
      street: 'Baluwatar Diplomatic Zone'
    },
    creditLimit: 250000,
    currentBalance: 34500, // Corporate dining tab balance
    openingBalance: 0,
    paymentTermsDays: 30,
    active: true,
    notes: 'Rooftop VIP table frequent guest. Corporate entertaining account.',
    createdAt: Date.now() - 60 * 86400000
  },
  {
    id: 'cust-reg-aarav',
    customerCode: 'CUST-0002',
    name: 'Dr. Aarav Shakya',
    companyName: 'Kathmandu Medical Institute',
    phone: '+977-9841223344',
    email: 'dr.shakya@kmi.org.np',
    customerType: 'retail',
    address: {
      province: 'Bagmati',
      district: 'Lalitpur',
      municipality: 'Lalitpur Metropolitan',
      street: 'Sanepa Heights'
    },
    creditLimit: 50000,
    currentBalance: 0,
    openingBalance: 0,
    paymentTermsDays: 15,
    active: true,
    notes: 'Regular weekend family brunch guest. Prefers garden patio seating.',
    createdAt: Date.now() - 40 * 86400000
  },
  {
    id: 'cust-embassy-event',
    customerCode: 'CUST-0003',
    name: 'Consular Banquet & Social Club',
    companyName: 'Diplomatic Mission Alliance',
    phone: '+977-1-4419988',
    email: 'events@consularnepal.org',
    panVatNumber: '601123998',
    customerType: 'wholesale',
    address: {
      province: 'Bagmati',
      district: 'Kathmandu',
      municipality: 'Kathmandu',
      street: 'Lazimpat Embassy Quarter'
    },
    creditLimit: 500000,
    currentBalance: 86000,
    openingBalance: 0,
    paymentTermsDays: 30,
    active: true,
    notes: 'Host of monthly executive tasting dinners in VIP Suite.',
    createdAt: Date.now() - 80 * 86400000
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-valley-coldstore',
    supplierCode: 'SUP-0001',
    name: 'Valley Poultry & Fresh Meat Supply',
    companyName: 'Valley Cold Store Pvt. Ltd.',
    phone: '+977-1-5523456',
    additionalContacts: [
      { name: 'Delivery Desk', phone: '9851082211' }
    ],
    email: 'orders@valleymeat.com.np',
    panVatNumber: '300189234',
    panVatType: 'VAT',
    address: {
      province: 'Bagmati',
      district: 'Kathmandu',
      municipality: 'Kathmandu',
      street: 'Balaju Industrial District'
    },
    creditLimit: 500000,
    currentBalance: 64000, // We owe Rs. 64,000
    openingBalance: 0,
    bankDetails: {
      bankName: 'Nabil Bank Ltd.',
      accountName: 'Valley Cold Store Pvt Ltd',
      accountNumber: '02000182390112',
      branch: 'Balaju Branch'
    },
    active: true,
    notes: 'Daily morning fresh farm chicken, minced meat, and duck meat supplier.',
    createdAt: Date.now() - 100 * 86400000
  },
  {
    id: 'sup-alpine-dairy',
    supplierCode: 'SUP-0002',
    name: 'Alpine Artisanal Dairy & Cheese',
    companyName: 'Alpine Agro Industries Pvt. Ltd.',
    phone: '+977-1-4428900',
    additionalContacts: [
      { name: 'Accounts Desk', phone: '9841992200' }
    ],
    email: 'sales@alpinedairy.com.np',
    panVatNumber: '601829301',
    panVatType: 'VAT',
    address: {
      province: 'Bagmati',
      district: 'Lalitpur',
      municipality: 'Lalitpur',
      street: 'Godavari Road, Lalitpur'
    },
    creditLimit: 300000,
    currentBalance: 28500,
    openingBalance: 0,
    bankDetails: {
      bankName: 'Global IME Bank Ltd.',
      accountName: 'Alpine Agro Industries',
      accountNumber: '00210200391201',
      branch: 'Jawalakhel Branch'
    },
    active: true,
    notes: 'Buffalo mozzarella, aged cheddar, heavy cream and pure butter vendor.',
    createdAt: Date.now() - 90 * 86400000
  },
  {
    id: 'sup-nepal-distilleries',
    supplierCode: 'SUP-0003',
    name: 'Nepal Distilleries & Beverage House',
    companyName: 'Nepal Distilleries Pvt. Ltd.',
    phone: '+977-1-4251100',
    email: 'commercial@nepaldistilleries.com.np',
    panVatNumber: '300012098',
    panVatType: 'VAT',
    address: {
      province: 'Bagmati',
      district: 'Kathmandu',
      municipality: 'Kathmandu',
      street: 'Tripureshwor Trading Center'
    },
    creditLimit: 1000000,
    currentBalance: 112000,
    openingBalance: 0,
    bankDetails: {
      bankName: 'Standard Chartered Bank Nepal',
      accountName: 'The Nepal Distilleries Pvt Ltd',
      accountNumber: '01010192837401',
      branch: 'New Road Branch'
    },
    active: true,
    notes: 'Khukri XXX rum, spirits, craft beers and bar cellar inventory.',
    createdAt: Date.now() - 120 * 86400000
  }
];

export const INITIAL_SALES_INVOICES: SaleInvoice[] = [
  {
    id: 'inv-rest-001',
    invoiceNumber: 'REST-2082-0001',
    date: Date.now() - 2 * 3600 * 1000,
    fiscalYear: '2082/83',
    customerId: 'cust-walkin',
    customerName: 'Walk-in Table Guest (Table M-01)',
    customerPhone: '9800000000',
    customerAddress: 'Table M-01, Main Dining Hall',
    customerType: 'retail',
    salespersonId: 'usr-1',
    salespersonName: 'Floor Server 1',
    warehouseId: 'wh-main',
    warehouseName: 'Central Cold Storage & Kitchen Pantry',
    items: [
      {
        productId: 'prod-momo-c',
        productName: 'Steamed Chicken C-Momo (Spicy Chilly)',
        sku: 'MOMO-CHK-01',
        selectedUnit: 'Plate',
        conversionFactor: 1,
        quantity: 2,
        baseQuantity: 2,
        unitPrice: 380,
        costPrice: 140,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 98.8,
        lineTotal: 858.8
      },
      {
        productId: 'prod-pizza-woodfired',
        productName: '12" Woodfired Buffalo Margherita Pizza',
        sku: 'PIZZA-MARG-01',
        selectedUnit: 'Plate',
        conversionFactor: 1,
        quantity: 1,
        baseQuantity: 1,
        unitPrice: 650,
        costPrice: 210,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 84.5,
        lineTotal: 734.5
      },
      {
        productId: 'prod-mojito-mint',
        productName: 'Signature Himalayan Mint Mojito',
        sku: 'BAR-MOJ-01',
        selectedUnit: 'Glass',
        conversionFactor: 1,
        quantity: 2,
        baseQuantity: 2,
        unitPrice: 420,
        costPrice: 110,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 109.2,
        lineTotal: 949.2
      }
    ],
    subtotal: 2250,
    discountAmount: 0,
    taxableAmount: 2250,
    taxAmount: 292.5,
    nonTaxableAmount: 0,
    grandTotal: 2542.5,
    totalCost: 710,
    grossProfit: 1540,
    paymentMethod: 'fonepay',
    paidAmount: 2542.5,
    dueAmount: 0,
    paymentStatus: 'paid',
    paymentReference: 'Fonepay QR Ref: FP-9812441',
    status: 'completed',
    notes: 'Table M-01 guest dinner. Served by Floor Server.',
    createdAt: Date.now() - 2 * 3600 * 1000
  },
  {
    id: 'inv-rest-002',
    invoiceNumber: 'REST-2082-0002',
    date: Date.now() - 5 * 3600 * 1000,
    fiscalYear: '2082/83',
    customerId: 'cust-vip-prashant',
    customerName: 'Prashant Bikram Shah (VIP)',
    customerPhone: '+977-9851088776',
    customerPanVat: '302918231',
    customerAddress: 'Rooftop Lounge VIP Table',
    customerType: 'dealer',
    salespersonId: 'usr-1',
    salespersonName: 'Floor Server 2',
    warehouseId: 'wh-main',
    warehouseName: 'Central Cold Storage & Kitchen Pantry',
    items: [
      {
        productId: 'prod-steak-angus',
        productName: 'Prime Angus Ribeye Steak (300g with Truffle Mash)',
        sku: 'STEAK-RIB-01',
        selectedUnit: 'Plate',
        conversionFactor: 1,
        quantity: 2,
        baseQuantity: 2,
        unitPrice: 1850,
        costPrice: 780,
        discountPercent: 10,
        discountAmount: 370,
        taxRatePercent: 13,
        taxAmount: 432.9,
        lineTotal: 3762.9
      },
      {
        productId: 'prod-mojito-mint',
        productName: 'Signature Himalayan Mint Mojito',
        sku: 'BAR-MOJ-01',
        selectedUnit: 'Glass',
        conversionFactor: 1,
        quantity: 3,
        baseQuantity: 3,
        unitPrice: 420,
        costPrice: 110,
        discountPercent: 10,
        discountAmount: 126,
        taxRatePercent: 13,
        taxAmount: 147.4,
        lineTotal: 1281.4
      }
    ],
    subtotal: 4960,
    discountAmount: 496,
    taxableAmount: 4464,
    taxAmount: 580.3,
    nonTaxableAmount: 0,
    grandTotal: 5044.3,
    totalCost: 1890,
    grossProfit: 2574,
    paymentMethod: 'bank_transfer',
    paidAmount: 5044.3,
    dueAmount: 0,
    paymentStatus: 'paid',
    paymentReference: 'HBL POS Card Approval: 882190',
    status: 'completed',
    notes: 'Rooftop Terrace table R-02 executive dinner.',
    createdAt: Date.now() - 5 * 3600 * 1000
  }
];

export const INITIAL_PURCHASES: PurchaseInvoice[] = [
  {
    id: 'po-rest-001',
    purchaseNumber: 'PO-2082-0012',
    date: Date.now() - 24 * 3600 * 1000,
    supplierId: 'sup-valley-coldstore',
    supplierName: 'Valley Cold Store Pvt. Ltd.',
    supplierPanVat: '300189234',
    warehouseId: 'wh-main',
    warehouseName: 'Central Cold Storage & Kitchen Pantry',
    items: [
      {
        productId: 'raw-chicken-mince',
        productName: 'Fresh Boneless Minced Chicken Breast',
        sku: 'RAW-CHK-01',
        selectedUnit: 'Kilogram',
        conversionFactor: 1,
        quantity: 40,
        baseQuantity: 40,
        unitCost: 420,
        discountPercent: 0,
        taxRatePercent: 0,
        lineTotal: 16800
      }
    ],
    subtotal: 16800,
    discountAmount: 0,
    taxAmount: 0,
    freightCost: 0,
    otherExpenses: 0,
    grandTotal: 16800,
    paidAmount: 16800,
    dueAmount: 0,
    paymentMethod: 'bank_transfer',
    paymentStatus: 'paid',
    status: 'received',
    createdAt: Date.now() - 24 * 3600 * 1000
  },
  {
    id: 'po-rest-002',
    purchaseNumber: 'PO-2082-0013',
    date: Date.now() - 48 * 3600 * 1000,
    supplierId: 'sup-alpine-dairy',
    supplierName: 'Alpine Agro Industries Pvt. Ltd.',
    supplierPanVat: '601829301',
    warehouseId: 'wh-main',
    warehouseName: 'Central Cold Storage & Kitchen Pantry',
    items: [
      {
        productId: 'raw-mozzarella',
        productName: 'Fresh Whole Milk Buffalo Mozzarella',
        sku: 'RAW-MOZZ-02',
        selectedUnit: 'Kilogram',
        conversionFactor: 1,
        quantity: 20,
        baseQuantity: 20,
        unitCost: 800,
        discountPercent: 0,
        taxRatePercent: 0,
        lineTotal: 16000
      }
    ],
    subtotal: 16000,
    discountAmount: 0,
    taxAmount: 0,
    freightCost: 0,
    otherExpenses: 0,
    grandTotal: 16000,
    paidAmount: 10000,
    dueAmount: 6000,
    paymentMethod: 'bank_transfer',
    paymentStatus: 'partial',
    status: 'received',
    createdAt: Date.now() - 48 * 3600 * 1000
  }
];

export const INITIAL_EXPENSES: ExpenseRecord[] = [
  {
    id: 'exp-001',
    expenseNumber: 'EXP-2026-0001',
    date: Date.now() - 24 * 3600 * 1000,
    category: 'Miscellaneous',
    amount: 14500,
    paymentMethod: 'cash',
    paidTo: 'Shree Krishna Gas Agency',
    accountName: 'Cash in Hand',
    notes: 'HP Commercial LPG Cylinder Refill (5 Cylinders) for kitchen woks',
    recordedBy: 'Admin',
    createdAt: Date.now() - 24 * 3600 * 1000
  },
  {
    id: 'exp-002',
    expenseNumber: 'EXP-2026-0002',
    date: Date.now() - 48 * 3600 * 1000,
    category: 'Electricity & Water',
    amount: 22000,
    paymentMethod: 'bank_transfer',
    paidTo: 'Nepal Electricity Authority',
    accountName: 'Nabil Bank Current',
    notes: 'NEA Commercial Cold Storage Power Bill (meter #89021)',
    recordedBy: 'Admin',
    createdAt: Date.now() - 48 * 3600 * 1000
  }
];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'stk-mov-001',
    date: Date.now() - 24 * 3600 * 1000,
    productId: 'raw-chicken-mince',
    productName: 'Fresh Boneless Minced Chicken Breast',
    sku: 'RAW-CHK-01',
    warehouseId: 'wh-main',
    warehouseName: 'Central Cold Storage & Kitchen Pantry',
    movementType: 'purchase',
    referenceId: 'PO-2082-0012',
    quantityIn: 40,
    quantityOut: 0,
    previousBalance: 12.5,
    newBalance: 52.5,
    unitCost: 420,
    totalValue: 16800,
    notes: 'Daily poultry stock received from Valley Cold Store',
    performedBy: 'Kitchen Executive'
  },
  {
    id: 'stk-mov-002',
    date: Date.now() - 2 * 3600 * 1000,
    productId: 'raw-chicken-mince',
    productName: 'Fresh Boneless Minced Chicken Breast',
    sku: 'RAW-CHK-01',
    warehouseId: 'wh-main',
    warehouseName: 'Central Cold Storage & Kitchen Pantry',
    movementType: 'sale',
    referenceId: 'KOT-0081',
    quantityIn: 0,
    quantityOut: 0.5,
    previousBalance: 52.5,
    newBalance: 52.0,
    unitCost: 420,
    totalValue: 210,
    notes: 'Kitchen consumption for 2 plates Chicken C-Momo (Table M-01)',
    performedBy: 'Kitchen System Auto-Depletion'
  }
];
