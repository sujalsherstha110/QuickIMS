import { 
  Product, Customer, Supplier, Warehouse, SaleInvoice, PurchaseInvoice, 
  StockMovement, ExpenseRecord, CompanySettings, UnitDefinition, ProductCategory 
} from '../types';
import { 
  RESTAURANT_MENU_CATEGORIES, 
  INITIAL_MENU_PRODUCTS, 
  DEFAULT_RESTAURANT_SETTINGS,
  RESTAURANT_WAREHOUSES,
  DEFAULT_WALKIN_CUSTOMER
} from './restaurantInitialData';

export const INITIAL_CATEGORIES: ProductCategory[] = RESTAURANT_MENU_CATEGORIES;

export const INITIAL_COMPANY_SETTINGS: CompanySettings = DEFAULT_RESTAURANT_SETTINGS;

export const INITIAL_WAREHOUSES: Warehouse[] = RESTAURANT_WAREHOUSES;

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

// Production Clean Slate: No dummy products
export const INITIAL_PRODUCTS: Product[] = INITIAL_MENU_PRODUCTS;

// Production Clean Slate: Walk-in guest only
export const INITIAL_CUSTOMERS: Customer[] = [DEFAULT_WALKIN_CUSTOMER];

// Production Clean Slate: No dummy suppliers
export const INITIAL_SUPPLIERS: Supplier[] = [];

// Production Clean Slate: No dummy sales invoices
export const INITIAL_SALES_INVOICES: SaleInvoice[] = [];

// Production Clean Slate: No dummy purchase bills
export const INITIAL_PURCHASES: PurchaseInvoice[] = [];

// Production Clean Slate: No dummy expenses
export const INITIAL_EXPENSES: ExpenseRecord[] = [];

// Production Clean Slate: No dummy movements
export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];
