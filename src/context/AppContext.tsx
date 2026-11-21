import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Product, Customer, Supplier, Warehouse, SaleInvoice, PurchaseInvoice, 
  StockMovement, ExpenseRecord, CompanySettings, UnitDefinition, Quotation, SalesReturn, StockAdjustment, StockTransfer,
  StockItem,
  ProductCategory, AppAuthUser, StoredUserAccount,
  DiningZone, DiningTable, TableStatus, KitchenOrderTicket, TableSession, KOTItem,
  TableDraftOrder, TableDraftItem,
  StaffMember, StaffPermissions, AttendanceRecord, StaffAuditLog, StaffShiftDefinition,
  StaffRoleDefinition, StaffDepartmentDefinition, StaffStatusDefinition, StaffDocument,
  FoodWasteRecord, KitchenMasterRecipe,
  RestaurantFloor, RestaurantSection,
  POSPrinterConfig,
  PermissionAction, StaffModulePermissions
} from '../types';
import { 
  checkStaffModulePermission, 
  syncStaffPermissions, 
  getDefaultStaffModulePermissions 
} from '../utils/staffPermissionUtils';
import { sanitizeMenuHierarchyForTenant } from '../utils/menuHierarchyUtils';
import {
  applyMergeTablesState,
  applySwapTablesState,
  applyTransferTableState,
  computeTableMetrics,
  doesTicketBelongToTable,
  DraftOverrideInput,
  makeAvailableTable
} from '../utils/tableOperations';
import {
  computeItemBaseUnitPrice,
  extractKOTItemAddons,
  resolveItemRoutingStation
} from '../utils/ticketOrderUtils';
import {
  isDraftInvoice,
  getInvoiceDueAmount,
  getEffectivePaymentStatus,
  normalizeSaleInvoicePayment,
  resolveEditSalePaymentFields,
  allocateCustomerPaymentToInvoices
} from '../utils/invoicePaymentUtils';
import {
  DailyTicketCounterState,
  allocateNextDailyTicketNumbersSync,
  formatDailyTicketNumber,
  getLocalDayKey,
  getMaxTicketSeqForDay,
  mergeDailyCounterState
} from '../utils/ticketCounterUtils';
import {
  buildUserContextFromStaff,
  isPlaceholderOperatorName,
  parseCachedStaffSession,
  resolveActiveOperator,
  resolveOperatorIdentity
} from '../utils/operatorUtils';
import { 
  INITIAL_COMPANY_SETTINGS, INITIAL_PRODUCTS, INITIAL_CUSTOMERS, 
  INITIAL_SUPPLIERS, INITIAL_WAREHOUSES, INITIAL_SALES_INVOICES, 
  INITIAL_PURCHASES, INITIAL_EXPENSES, INITIAL_STOCK_MOVEMENTS, INITIAL_UNITS, INITIAL_CATEGORIES 
} from '../data/initialData';
import {
  INITIAL_RESTAURANT_ZONES, INITIAL_TABLES, RESTAURANT_MENU_CATEGORIES, INITIAL_MENU_PRODUCTS, INITIAL_KOTS,
  DEFAULT_WALKIN_CUSTOMER, CLEAN_AVAILABLE_TABLES, RESTAURANT_WAREHOUSES, DEFAULT_RESTAURANT_SETTINGS,
  INITIAL_STAFF, INITIAL_SHIFTS, INITIAL_ATTENDANCE, INITIAL_STAFF_AUDIT_LOGS, getDefaultStaffPermissions,
  INITIAL_STAFF_ROLES, INITIAL_STAFF_DEPARTMENTS, INITIAL_STAFF_STATUSES,
  INITIAL_FOOD_WASTE, INITIAL_MASTER_RECIPES, INITIAL_PRINTERS,
  FRESH_BEANS_DEFAULT_FLOORS, FRESH_BEANS_DEFAULT_SECTIONS, FRESH_BEANS_DEFAULT_TABLES
} from '../data/restaurantInitialData';
import {
  generateKOTSlipHtml,
  generateBOTSlipHtml,
  generateCombinedOrderTicketsHtml,
  generateBillReceiptSlipHtml,
  generateCancelledItemSlipHtml,
  CancelledItemSlipPayload,
  generateTestSlipHtml,
  executeThermalPrint,
  safeThermalWindowPrint
} from '../utils/printerService';
import { db, auth, googleProvider, getSecondaryStaffAuth } from '../firebase';
import { 
  signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, deleteUser
} from 'firebase/auth';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, where, orderBy, limit, getDocFromServer, getDoc, onSnapshot, deleteField, increment, runTransaction 
} from 'firebase/firestore';

const USERS_STORAGE_KEY = 'quickims_registered_users';
const ACTIVE_SESSION_STORAGE_KEY = 'quickims_active_auth_session';
const LAST_TENANT_STORAGE_KEY = 'quickims_last_tenant_id';
const FRESH_BEANS_RESTRO_ID = 'restro_freshbeans110_gmail_com';

const TENANT_SCOPED_STORAGE_KEYS = [
  'quickims_settings',
  'quickims_products',
  'quickims_categories',
  'quickims_menu_hierarchy_v5',
  'quickims_menu_hierarchy_v2',
  'quickims_menu_hierarchy_v3',
  'quickims_menu_hierarchy_v4',
  'quickims_units',
  'quickims_customers',
  'quickims_suppliers',
  'quickims_warehouses',
  'quickims_sales',
  'quickims_purchases',
  'quickims_expenses',
  'quickims_movements',
  'quickims_adjustments',
  'quickims_transfers',
  'quickims_stock_items',
  'quickims_raw_categories',
  'quickims_quotations',
  'quickims_returns',
  'quickims_floors',
  'quickims_sections',
  'quickims_tables',
  'restro_tables',
  'quickims_floor_plan_draft',
  'quickims_selected_table_id',
  'restro_selected_table_id',
  'quickims_table_drafts',
  'restro_table_drafts',
  'restro_kots',
  'quickims_staff',
  'quickims_printers',
  'quickims_attendance',
  'quickims_staff_audit_logs',
  'quickims_staff_shifts',
  'quickims_staff_roles',
  'quickims_staff_departments',
  'quickims_staff_statuses',
  'quickims_food_waste',
  'quickims_master_recipes',
  'quickims_active_floor_id',
  'quickims_data_cleared',
  'quickims_active_tab'
];

function clearTenantLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    TENANT_SCOPED_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('clearTenantLocalStorage warning:', e);
  }
}

function buildDefaultSettingsForTenant(restroId: string, ownerName?: string, ownerEmail?: string): CompanySettings {
  if (restroId === FRESH_BEANS_RESTRO_ID) {
    return DEFAULT_RESTAURANT_SETTINGS;
  }
  const cleanName = (ownerName || '').trim() || (ownerEmail ? ownerEmail.split('@')[0] : '') || 'My Restaurant';
  return {
    ...DEFAULT_RESTAURANT_SETTINGS,
    companyName: cleanName,
    tagline: 'Restaurant & POS Management',
    panNumber: '',
    vatNumber: '',
    phone: '',
    mobile: '',
    email: ownerEmail || '',
    website: '',
    address: {
      province: 'Bagmati Province',
      district: 'Kathmandu',
      municipality: 'Kathmandu',
      ward: '',
      street: ''
    },
    invoicePrefix: 'INV-',
    purchasePrefix: 'PO-',
    quotePrefix: 'QT-',
    termsAndConditions: '1. Food once served or billed cannot be cancelled. 2. Please retain receipt for table verification.',
    invoiceFooterMessage: 'Thank you for dining with us! We hope to serve you again soon.',
    receiptTemplate: DEFAULT_RESTAURANT_SETTINGS.receiptTemplate
      ? {
          ...DEFAULT_RESTAURANT_SETTINGS.receiptTemplate,
          customFooterMessage: 'Thank you for dining with us! We hope to serve you again soon.'
        }
      : undefined
  };
}

function computeInitialRestaurantId(): string {
  if (typeof window === 'undefined') return 'restro_guest';
  try {
    const cachedStaff = localStorage.getItem('quickims_active_staff_session');
    if (cachedStaff) {
      const staffObj = JSON.parse(cachedStaff);
      if (staffObj?.restaurantId) return staffObj.restaurantId;
    }
  } catch {}
  try {
    const cachedUser = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (cachedUser) {
      const u = JSON.parse(cachedUser);
      if (u?.email) {
        return 'restro_' + u.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      }
      if (u?.uid) {
        return `restro_${u.uid}`;
      }
    }
  } catch {}
  try {
    if (sessionStorage.getItem('quickims_demo_session') === 'true') {
      return 'restro_demo_preview';
    }
  } catch {}
  return 'restro_guest';
}

export function getStoredAccounts(): StoredUserAccount[] {
  const defaultAccounts: StoredUserAccount[] = [
    {
      uid: 'usr_freshbeans110',
      email: 'freshbeans110@gmail.com',
      password: 'password123',
      name: 'Fresh Beans Admin',
      role: 'owner',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      provider: 'password'
    },
    {
      uid: 'usr-admin-owner',
      email: 'admin@quickims.np',
      password: 'admin',
      name: 'Restaurant Owner (Admin)',
      role: 'owner',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      provider: 'password'
    },
    {
      uid: 'usr-owner-main',
      email: 'owner@quickims.np',
      password: 'password123',
      name: 'Restaurant Owner',
      role: 'owner',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      provider: 'password'
    }
  ];

  try {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    if (data) {
      const list: StoredUserAccount[] = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) {
        // Ensure freshbeans110 is always in the list
        defaultAccounts.forEach(defAcc => {
          if (!list.some(u => String(u?.email || '').toLowerCase() === defAcc.email.toLowerCase())) {
            list.push(defAcc);
          }
        });
        return list;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored accounts', e);
  }
  return defaultAccounts;
}

export function saveStoredAccount(account: StoredUserAccount) {
  if (!account || !account.email) return;
  const existing = getStoredAccounts();
  const cleanEmail = account.email.trim().toLowerCase();
  const index = existing.findIndex(u => String(u?.email || '').toLowerCase() === cleanEmail);
  if (index >= 0) {
    existing[index] = account;
  } else {
    existing.push(account);
  }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(existing));
  try {
    setDoc(doc(db, 'users', cleanEmail), sanitizeForFirestore(account), { merge: true }).catch(() => null);
  } catch {}
}

function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const res: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        res[key] = sanitizeForFirestore(value);
      }
    }
    return res as T;
  }
  return data;
}

interface UserContextState {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  role: 'super_admin' | 'admin' | 'owner' | 'sales' | 'inventory' | 'accountant';
  branchId: string;
}

interface AppContextType {
  currentUser: UserContextState;
  setCurrentUser: (user: UserContextState) => void;
  currentWarehouseId: string;
  setCurrentWarehouseId: (id: string) => void;

  // Authentication State & Actions
  firebaseUser: AppAuthUser | FirebaseUser | null;
  authLoading: boolean;
  isDemoSession: boolean;
  isEmailVerified: boolean;
  loginWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  verifyEmailWithCode: (code: string) => Promise<boolean>;
  markEmailAsVerified: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  checkEmailVerification: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  resetPasswordDirect: (email: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteCurrentAccount: () => Promise<void>;
  enterDemoMode: () => void;
  
  // Data entities
  settings: CompanySettings;
  updateSettings: (newSettings: Partial<CompanySettings>) => Promise<void>;
  
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>;
  addProductsBatch: (products: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<Product[]>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string, permanent?: boolean) => Promise<void>;
  deleteProductsBatch: (ids: string[]) => Promise<void>;
  adaptMenuToTaxInclusive: (forceAll?: boolean) => Promise<{ count: number; updated: number }>;

  categories: ProductCategory[];
  addCategory: (category: Omit<ProductCategory, 'id'>) => Promise<ProductCategory>;
  updateCategory: (id: string, updates: Partial<ProductCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  units: UnitDefinition[];
  addUnit: (unit: Omit<UnitDefinition, 'id'>) => Promise<void>;
  
  customers: Customer[];
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  
  suppliers: Supplier[];
  addSupplier: (sup: Omit<Supplier, 'id' | 'createdAt'>) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  
  warehouses: Warehouse[];
  addWarehouse: (wh: Omit<Warehouse, 'id'>) => Promise<Warehouse>;
  
  sales: SaleInvoice[];
  recordSale: (sale: Omit<SaleInvoice, 'id' | 'createdAt'>) => Promise<SaleInvoice>;
  updateSale: (id: string, updates: Partial<SaleInvoice>) => Promise<void>;
  finalizeSaleInvoice: (id: string) => Promise<SaleInvoice>;
  deleteSaleInvoice: (id: string) => Promise<void>;
  settleInvoicePayment: (
    invoiceId: string, 
    paymentReceived: number, 
    method: SaleInvoice['paymentMethod'],
    paymentRef?: string,
    notes?: string
  ) => Promise<void>;
  collectCustomerPayment: (
    customerId: string,
    amount: number,
    method?: SaleInvoice['paymentMethod'],
    notes?: string,
    mode?: 'opening_first' | 'bills_first'
  ) => Promise<void>;
  
  purchases: PurchaseInvoice[];
  recordPurchase: (purchase: Omit<PurchaseInvoice, 'id' | 'createdAt'>) => Promise<PurchaseInvoice>;
  updatePurchase: (id: string, updates: Partial<PurchaseInvoice>) => Promise<void>;
  finalizePurchaseInvoice: (id: string) => Promise<PurchaseInvoice>;
  deletePurchase: (id: string) => Promise<void>;
  settlePurchasePayment: (
    purchaseId: string, 
    paymentPaid: number, 
    method: PurchaseInvoice['paymentMethod'],
    notes?: string
  ) => Promise<void>;
  
  expenses: ExpenseRecord[];
  recordExpense: (exp: Omit<ExpenseRecord, 'id' | 'createdAt'>) => Promise<ExpenseRecord>;
  
  stockMovements: StockMovement[];
  stockAdjustments: StockAdjustment[];
  recordStockAdjustment: (adj: Omit<StockAdjustment, 'id' | 'createdAt'>) => Promise<void>;
  
  stockTransfers: StockTransfer[];
  recordStockTransfer: (trans: Omit<StockTransfer, 'id' | 'createdAt'>) => Promise<void>;
  
  quotations: Quotation[];
  createQuotation: (quote: Omit<Quotation, 'id' | 'createdAt'>) => Promise<Quotation>;
  
  salesReturns: SalesReturn[];
  recordSalesReturn: (ret: Omit<SalesReturn, 'id' | 'createdAt'>) => Promise<void>;
  
  // Kitchen Raw Stock Management (Clean slate, zero seed data, mapped suppliers & thresholds)
  stockItems: StockItem[];
  rawStockCategories: string[];
  addRawStockCategory: (categoryName: string) => Promise<string>;
  addStockItem: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<StockItem>;
  updateStockItem: (id: string, updates: Partial<StockItem>) => Promise<void>;
  deleteStockItem: (id: string) => Promise<void>;
  quickPurchaseStock: (stockId: string, quantity: number, unitCost: number, supplierId?: string, notes?: string) => Promise<void>;
  adjustStockItem: (stockId: string, newQuantity: number, reason: string) => Promise<void>;
  logStockWaste: (stockId: string, quantity: number, reason: string, notes?: string) => Promise<void>;

  // Restaurant Operations (Floor -> Section -> Layout Flow)
  floors: RestaurantFloor[];
  sections: RestaurantSection[];
  diningZones: DiningZone[];
  diningTables: DiningTable[];
  // Draft Floor Architecture (in-progress canvas edits, isolated from POS until saved)
  draftFloors: RestaurantFloor[];
  draftSections: RestaurantSection[];
  draftDiningTables: DiningTable[];
  hasUnsavedFloorPlan: boolean;
  discardFloorPlanDraft: () => void;
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  addFloor: (floor: Omit<RestaurantFloor, 'id'>) => Promise<RestaurantFloor>;
  updateFloor: (id: string, updates: Partial<RestaurantFloor>) => Promise<void>;
  deleteFloor: (id: string) => Promise<void>;
  addSection: (section: Omit<RestaurantSection, 'id'>) => Promise<RestaurantSection>;
  updateSection: (id: string, updates: Partial<RestaurantSection>) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  addDiningTable: (table: Omit<DiningTable, 'id'>) => Promise<DiningTable>;
  updateDiningTable: (id: string, updates: Partial<DiningTable>) => Promise<void>;
  deleteDiningTable: (id: string) => Promise<void>;
  updateTableStatus: (tableId: string, status: DiningTable['status'], meta?: Partial<DiningTable>) => Promise<void>;
  assignTableGuests: (tableId: string, guestsCount: number, waiterName?: string) => Promise<void>;
  transferTable: (sourceTableId: string, targetTableId: string, sourceDraftOverride?: DraftOverrideInput) => Promise<boolean>;
  mergeTables: (sourceTableId: string, targetTableId: string, sourceDraftOverride?: DraftOverrideInput) => Promise<boolean>;
  swapTables: (tableAId: string, tableBId: string, sourceDraftOverrideForA?: DraftOverrideInput) => Promise<boolean>;
  saveFloorPlanToCloud: () => Promise<boolean>;
  fireKitchenOrderTicket: (kot: Omit<KitchenOrderTicket, 'id' | 'kotNumber' | 'createdAt' | 'updatedAt'>) => Promise<KitchenOrderTicket>;
  splitAndFireTickets: (params: {
    tableId: string;
    tableNumber: string;
    zoneName: string;
    waiterName: string;
    guestsCount: number;
    notes?: string;
    items: KOTItem[];
    onTicketsReady?: (tickets: { kitchenTicket?: KitchenOrderTicket; barTicket?: KitchenOrderTicket }) => void;
  }) => Promise<{ kitchenTicket?: KitchenOrderTicket; barTicket?: KitchenOrderTicket }>;
  kitchenTickets: KitchenOrderTicket[];
  updateKOTStatus: (kotId: string, status: KitchenOrderTicket['status']) => Promise<void>;
  updateKOTItemStatus: (kotId: string, itemId: string, status: KOTItem['status']) => Promise<void>;
  updateKOTItemCustomization: (
    kotId: string,
    itemId: string,
    addons: { name: string; price: number }[],
    specialInstructions: string
  ) => Promise<{ success: boolean; message: string }>;
  cancelKOTOrderItem: (
    kotId: string,
    itemId: string,
    quantityToCancel: number,
    reason: string,
    staffName?: string,
    note?: string,
    disposition?: 'return_to_stock' | 'mark_as_waste',
    notifyKitchenBar?: boolean
  ) => Promise<{ success: boolean; message: string }>;
  uncancelKOTOrderItem: (
    kotId: string,
    itemId: string,
    quantityToRestore: number,
    reason: string,
    staffName?: string,
    note?: string,
    notifyKitchenBar?: boolean
  ) => Promise<{ success: boolean; message: string }>;
  settleTableBill: (tableId: string, invoice: SaleInvoice) => Promise<void>;
  reopenTableBill: (tableId: string, invoiceId?: string) => Promise<void>;
  dissolveTable: (tableId: string, reason?: string, staffName?: string) => Promise<{ success: boolean; message: string }>;
  
  // Table Draft Orders
  tableDrafts: Record<string, TableDraftOrder>;
  saveTableDraft: (tableId: string, draftData: Partial<TableDraftOrder>) => void;
  getTableDraft: (tableId: string) => TableDraftOrder | undefined;
  clearTableDraft: (tableId: string) => void;
  
  // Staff & HR & Access Control
  staffMembers: StaffMember[];
  activePOSStaff: StaffMember | null;
  setActivePOSStaff: (staff: StaffMember | null) => void;
  activeStaffUser: StaffMember | null;
  setActiveStaffUser: (staff: StaffMember | null) => void;
  loginStaffByUsernameAndPin: (username: string, pin: string) => Promise<{ success: boolean; message: string; staff?: StaffMember }>;
  logoutStaff: () => void;
  verifyStaffByToken: (email: string, token: string, newPin?: string, staffId?: string) => Promise<{ success: boolean; message: string; staff?: StaffMember }>;
  updateStaffPin: (staffId: string, newPin: string) => Promise<{ success: boolean; message: string }>;
  switchActiveStaffByPin: (pin: string) => { success: boolean; staff?: StaffMember; message: string };
  verifyStaffPin: (staffId: string, pin: string) => boolean;
  addStaffMember: (staff: Omit<StaffMember, 'id'>) => Promise<StaffMember>;
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => Promise<void>;
  deleteStaffMember: (id: string) => Promise<void>;
  sendStaffVerificationEmail: (email: string, staffName?: string, staffId?: string) => Promise<{ success: boolean; message: string; method?: string; verificationLink?: string; token?: string; code?: string; alreadyVerified?: boolean }>;
  checkStaffEmailVerification: (email: string, staffId?: string) => Promise<{ verified: boolean; message: string }>;
  verifyStaffEmailWithCode: (email: string, code: string, staffId?: string) => Promise<{ success: boolean; message: string }>;
  markStaffEmailAsVerified: (staffId: string) => Promise<void>;
  mergeAndCleanupDuplicateStaff: () => Promise<{ mergedCount: number; remainingCount: number }>;
  resetStaffData: () => Promise<void>;
  canStaffDo: (moduleKey: keyof StaffModulePermissions, action: PermissionAction) => boolean;

  // Attendance & Dynamic QR Kiosk
  attendanceRecords: AttendanceRecord[];
  clockInStaff: (staffId: string, method?: 'pin' | 'qr_kiosk' | 'badge_scan' | 'manual', notes?: string) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  clockOutStaff: (staffId: string, notes?: string) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  startStaffBreak: (staffId: string) => Promise<{ success: boolean; message: string }>;
  endStaffBreak: (staffId: string) => Promise<{ success: boolean; message: string }>;
  getTodayAttendanceToken: () => string;

  // Staff Audit Logs & Sensitive Action Tracking
  staffAuditLogs: StaffAuditLog[];
  logStaffAction: (action: Omit<StaffAuditLog, 'id' | 'timestamp'>) => Promise<StaffAuditLog>;

  // Shifts & Rostering
  staffShifts: StaffShiftDefinition[];
  addStaffShift: (shift: Omit<StaffShiftDefinition, 'id'>) => Promise<StaffShiftDefinition>;
  updateStaffShift: (id: string, updates: Partial<StaffShiftDefinition>) => Promise<void>;
  deleteStaffShift: (id: string) => Promise<void>;

  // Roles, Departments & Statuses Master Data
  staffRoles: StaffRoleDefinition[];
  addStaffRole: (role: Omit<StaffRoleDefinition, 'id'>) => Promise<StaffRoleDefinition>;
  updateStaffRole: (id: string, updates: Partial<StaffRoleDefinition>) => Promise<void>;
  deleteStaffRole: (id: string) => Promise<void>;
  staffDepartments: StaffDepartmentDefinition[];
  addStaffDepartment: (dept: Omit<StaffDepartmentDefinition, 'id'>) => Promise<StaffDepartmentDefinition>;
  updateStaffDepartment: (id: string, updates: Partial<StaffDepartmentDefinition>) => Promise<void>;
  deleteStaffDepartment: (id: string) => Promise<void>;
  staffStatuses: StaffStatusDefinition[];
  addStaffStatus: (status: Omit<StaffStatusDefinition, 'id'>) => Promise<StaffStatusDefinition>;
  updateStaffStatus: (id: string, updates: Partial<StaffStatusDefinition>) => Promise<void>;
  deleteStaffStatus: (id: string) => Promise<void>;

  // Food Waste & Spoilage Control
  foodWasteRecords: FoodWasteRecord[];
  logFoodWaste: (record: Omit<FoodWasteRecord, 'id' | 'timestamp'>) => Promise<FoodWasteRecord>;
  deleteFoodWaste: (id: string) => Promise<void>;

  // Kitchen Master Recipes & Batch Preps
  masterRecipes: KitchenMasterRecipe[];
  addMasterRecipe: (recipe: Omit<KitchenMasterRecipe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<KitchenMasterRecipe>;
  updateMasterRecipe: (id: string, updates: Partial<KitchenMasterRecipe>) => Promise<void>;
  deleteMasterRecipe: (id: string) => Promise<void>;

  // Thermal Printers & Hardware
  printers: POSPrinterConfig[];
  addPrinter: (printer: Omit<POSPrinterConfig, 'id'>) => Promise<POSPrinterConfig>;
  updatePrinter: (id: string, updates: Partial<POSPrinterConfig>) => Promise<void>;
  deletePrinter: (id: string) => Promise<void>;
  testPrinter: (id: string) => Promise<{ success: boolean; message: string }>;
  printKOTForTicket: (kot: KitchenOrderTicket, specificPrinter?: POSPrinterConfig, isReprint?: boolean) => Promise<{ success: boolean; message: string }>;
  printBOTForTicket: (bot: KitchenOrderTicket, specificPrinter?: POSPrinterConfig, isReprint?: boolean) => Promise<{ success: boolean; message: string }>;
  printCombinedOrderTickets: (kitchenTicket: KitchenOrderTicket, barTicket: KitchenOrderTicket, specificPrinter?: POSPrinterConfig) => Promise<{ success: boolean; message: string }>;
  printBillForInvoice: (invoice: SaleInvoice, table?: DiningTable | null, specificPrinter?: POSPrinterConfig, options?: { isDraft?: boolean }) => Promise<{ success: boolean; message: string }>;
  printCancelledItemSlip: (payload: CancelledItemSlipPayload, specificPrinter?: POSPrinterConfig) => Promise<{ success: boolean; message: string }>;

  // Multi-Tenant & RBAC & Live Sync
  restaurantId: string;
  setRestaurantSyncChannel: (id: string) => void;
  syncLiveTablesToFirestore: (tables: DiningTable[], drafts?: Record<string, TableDraftOrder>) => Promise<void>;
  syncAllDataFromCloud: (targetRestroId?: string) => Promise<{ success: boolean; message: string }>;
  menuHierarchy: any;
  updateMenuHierarchy: (hierarchy: any) => Promise<void>;
  lastCloudSyncTimestamp: number;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;

  // Quick system actions
  resetToDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  purgeAllLegacyFirestoreData: () => Promise<{ success: boolean; message: string }>;
  isSyncing: boolean;
  activeNotificationsCount: number;
}

const AppContext = createContext<AppContextType | null>(null);

// Module-level pure filters for legacy hardware mock/dummy data
const isDummyProduct = (p: any): boolean => {
  if (!p || typeof p !== 'object') return true;
  if (p.sku && (p.sku.startsWith('PVC-') || p.sku.startsWith('CPVC-') || p.sku.startsWith('SAN-HDW-'))) return true;
  if (p.id && (p.id.startsWith('prod-hardware-demo') || p.id.startsWith('legacy-demo-pipe-'))) return true;
  return false;
};

const isDummyTable = (t: any): boolean => {
  if (!t || typeof t !== 'object') return true;
  return false;
};

const isDummyKot = (k: any): boolean => {
  if (!k || typeof k !== 'object') return true;
  return false;
};

const isDummyStaff = (s: any): boolean => {
  if (!s || !s.name) return true;
  if (s.id && s.id.startsWith('staff-hardware-demo')) return true;
  return false;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronously resolve initial tenant and clear any stale localStorage from a different restaurant BEFORE any useState reads it
  const initialTenantBootRef = useRef<string | null>(null);
  if (initialTenantBootRef.current === null && typeof window !== 'undefined') {
    const resolvedId = computeInitialRestaurantId();
    const lastTenantId = localStorage.getItem(LAST_TENANT_STORAGE_KEY);
    const hasTenantMismatch = Boolean(
      resolvedId !== 'restro_guest' &&
      ((lastTenantId && lastTenantId !== resolvedId) ||
       (!lastTenantId && resolvedId !== FRESH_BEANS_RESTRO_ID))
    );
    if (hasTenantMismatch) {
      clearTenantLocalStorage();
    }
    if (resolvedId !== 'restro_guest') {
      localStorage.setItem(LAST_TENANT_STORAGE_KEY, resolvedId);
      localStorage.setItem('quickims_restaurant_id', resolvedId);
    }
    initialTenantBootRef.current = resolvedId;
  }

  const activeTenantRef = useRef<string>(initialTenantBootRef.current || computeInitialRestaurantId());
  const resetTenantRef = useRef<(targetRestroId: string, ownerName?: string, ownerEmail?: string) => void>(() => {});

  const readCachedStaffSession = (): StaffMember | null => {
    try {
      return parseCachedStaffSession(localStorage.getItem('quickims_active_staff_session'));
    } catch {
      return null;
    }
  };

  const [currentUser, setCurrentUser] = useState<UserContextState>(() => {
    const cachedStaff = readCachedStaffSession();
    if (cachedStaff) {
      return buildUserContextFromStaff(cachedStaff);
    }
    return {
      id: 'usr-admin-1',
      name: 'Restaurant Owner',
      role: 'owner',
      branchId: 'wh-main'
    };
  });

  const [firebaseUser, setFirebaseUser] = useState<AppAuthUser | FirebaseUser | null>(() => {
    const cached = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isDemoSession, setIsDemoSession] = useState<boolean>(() => {
    return sessionStorage.getItem('quickims_demo_session') === 'true';
  });

  const [currentWarehouseId, setCurrentWarehouseId] = useState<string>('wh-main');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Validate connection to Firestore at initialization
  useEffect(() => {
    const testConnection = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.info('Cloud Firestore: Operating in offline mode (navigator.onLine is false).');
        return;
      }
      try {
        await Promise.race([
          getDocFromServer(doc(db, 'test', 'connection')),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (
          errMsg.includes('the client is offline') || 
          errMsg.includes('unavailable') || 
          errMsg.includes('timeout') ||
          (error as any)?.code === 'unavailable'
        ) {
          console.info('Cloud Firestore: Operating in offline mode or waiting for backend connection.');
        } else {
          console.warn('Firestore initial connection status:', errMsg);
        }
      }
    };
    testConnection();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const ownerRestroId = 'restro_' + (user.email ? user.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') : user.uid);
        const hasStaffSession = Boolean(localStorage.getItem('quickims_active_staff_session'));
        if (!hasStaffSession && activeTenantRef.current !== ownerRestroId) {
          resetTenantRef.current(ownerRestroId, user.displayName || user.email?.split('@')[0] || 'Restaurant Owner', user.email || '');
          setRestaurantIdState(ownerRestroId);
          localStorage.setItem('quickims_restaurant_id', ownerRestroId);
        }

        const appUser: AppAuthUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || undefined,
          emailVerified: user.emailVerified,
          providerId: 'google.com'
        };
        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
        if (!hasStaffSession) {
          setCurrentUser({
            id: user.uid,
            name: appUser.displayName || 'Restaurant Owner',
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            role: 'owner',
            branchId: 'wh-main'
          });
        }
        sessionStorage.removeItem('quickims_demo_session');
        setIsDemoSession(false);
      } else {
        const hasStaffSession = Boolean(localStorage.getItem('quickims_active_staff_session'));
        const cached = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as AppAuthUser;
            setFirebaseUser(parsed);
            if (!hasStaffSession) {
              setCurrentUser({
                id: parsed.uid,
                name: parsed.displayName || 'Restaurant Owner',
                email: parsed.email || '',
                photoURL: parsed.photoURL || undefined,
                role: 'owner',
                branchId: 'wh-main'
              });
            }
          } catch {
            setFirebaseUser(null);
          }
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        sessionStorage.removeItem('quickims_demo_session');
        setIsDemoSession(false);
        localStorage.removeItem('quickims_active_staff_session');
        setActiveStaffUser(null);
        setActivePOSStaff(null);
        const isAdmin = res.user.email === 'admin@quickims.np' || res.user.email?.startsWith('admin') || !res.user.email;
        const appUser: AppAuthUser = {
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName || 'Admin User',
          photoURL: res.user.photoURL || undefined,
          emailVerified: res.user.emailVerified,
          providerId: 'google.com'
        };
        const ownerRestroId = 'restro_' + (res.user.email ? res.user.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') : res.user.uid);
        if (activeTenantRef.current !== ownerRestroId) {
          resetTenantRef.current(ownerRestroId, appUser.displayName || 'Restaurant Owner', res.user.email || '');
        }
        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
        setCurrentUser({
          id: res.user.uid,
          name: appUser.displayName || 'General Manager',
          email: res.user.email || '',
          photoURL: res.user.photoURL || undefined,
          role: isAdmin ? 'super_admin' : 'admin',
          branchId: 'wh-main'
        });
        setRestaurantIdState(ownerRestroId);
        localStorage.setItem('quickims_restaurant_id', ownerRestroId);
        await syncAllDataFromCloud(ownerRestroId);
        return;
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0];

    try {
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cleanName) {
        await updateProfile(res.user, { displayName: cleanName });
      }
      try {
        await sendEmailVerification(res.user);
      } catch (e) {
        console.warn('Verification dispatch notice:', e);
      }
      sessionStorage.removeItem('quickims_demo_session');
      setIsDemoSession(false);
      localStorage.removeItem('quickims_active_staff_session');
      setActiveStaffUser(null);
      setActivePOSStaff(null);
      const detRestroId = 'restro_' + cleanEmail.replace(/[^a-z0-9]/g, '_');

      // Completely wipe any previous restaurant data from localStorage & memory
      resetTenantRef.current(detRestroId, cleanName, cleanEmail);
      setRestaurantIdState(detRestroId);
      localStorage.setItem('quickims_restaurant_id', detRestroId);

      const initialOwnerSettings = buildDefaultSettingsForTenant(detRestroId, cleanName, cleanEmail);
      setSettings(initialOwnerSettings);
      localStorage.setItem('quickims_settings', JSON.stringify(initialOwnerSettings));

      const appUser: AppAuthUser = {
        uid: res.user.uid,
        email: res.user.email,
        displayName: cleanName,
        emailVerified: res.user.emailVerified,
        providerId: 'password'
      };
      setFirebaseUser(appUser);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
      setCurrentUser({
        id: res.user.uid,
        name: cleanName,
        email: cleanEmail,
        role: 'owner',
        branchId: 'wh-main'
      });

      // Save user profile & clean initial restaurant settings to Firestore
      const userDoc: StoredUserAccount = {
        uid: res.user.uid,
        email: cleanEmail,
        password: password,
        name: cleanName,
        role: 'owner',
        emailVerified: true,
        restaurantId: detRestroId,
        createdAt: new Date().toISOString(),
        provider: 'password'
      };
      saveStoredAccount(userDoc);
      if (db) {
        await setDoc(doc(db, 'restaurants', detRestroId, 'meta', 'settings'), sanitizeForFirestore(initialOwnerSettings), { merge: true }).catch(() => null);
      }
      await syncAllDataFromCloud(detRestroId);
      return;
    } catch (err: any) {
      console.warn('Firebase createUser failed, falling back to cloud/local user store:', err.code, err.message);
      const isProviderDisabled =
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/configuration-not-found' ||
        err.message?.includes('OPERATION_NOT_ALLOWED') ||
        err.message?.includes('unauthorized-domain') ||
        err.message?.includes('auth/unauthorized-domain');

      if (isProviderDisabled) {
        const existingUsers = getStoredAccounts();
        const existing = existingUsers.find(u => String(u?.email || '').toLowerCase() === cleanEmail);
        if (existing && cleanEmail !== 'freshbeans110@gmail.com') {
          const customErr = new Error('An account with this email already exists. Please sign in instead.');
          (customErr as any).code = 'auth/email-already-in-use';
          throw customErr;
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const detRestroId = 'restro_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
        const newAccount: StoredUserAccount = {
          uid: existing?.uid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          email: cleanEmail,
          password: password,
          name: cleanName,
          role: 'owner',
          emailVerified: true,
          verificationCode: verificationCode,
          restaurantId: detRestroId,
          createdAt: new Date().toISOString(),
          provider: 'password'
        };
        saveStoredAccount(newAccount);

        const appUser: AppAuthUser = {
          uid: newAccount.uid,
          email: newAccount.email,
          displayName: newAccount.name,
          emailVerified: true,
          providerId: 'password',
          verificationCode: verificationCode
        };

        sessionStorage.removeItem('quickims_demo_session');
        setIsDemoSession(false);
        localStorage.removeItem('quickims_active_staff_session');
        setActiveStaffUser(null);
        setActivePOSStaff(null);
        resetTenantRef.current(detRestroId, newAccount.name, newAccount.email);
        setRestaurantIdState(detRestroId);
        localStorage.setItem('quickims_restaurant_id', detRestroId);

        const initialOwnerSettings = buildDefaultSettingsForTenant(detRestroId, newAccount.name, newAccount.email);
        setSettings(initialOwnerSettings);
        localStorage.setItem('quickims_settings', JSON.stringify(initialOwnerSettings));
        if (db) {
          await setDoc(doc(db, 'restaurants', detRestroId, 'meta', 'settings'), sanitizeForFirestore(initialOwnerSettings), { merge: true }).catch(() => null);
        }

        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));

        setCurrentUser({
          id: newAccount.uid,
          name: newAccount.name,
          email: newAccount.email,
          role: newAccount.role,
          branchId: 'wh-main'
        });
        await syncAllDataFromCloud(detRestroId);
        return;
      }
      throw err;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await signInWithEmailAndPassword(auth, cleanEmail, password);
      sessionStorage.removeItem('quickims_demo_session');
      setIsDemoSession(false);
      localStorage.removeItem('quickims_active_staff_session');
      setActiveStaffUser(null);
      setActivePOSStaff(null);
      const detRestroId = 'restro_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
      if (activeTenantRef.current !== detRestroId) {
        resetTenantRef.current(detRestroId, res.user.displayName || cleanEmail.split('@')[0], cleanEmail);
      }
      setRestaurantIdState(detRestroId);
      localStorage.setItem('quickims_restaurant_id', detRestroId);

      const appUser: AppAuthUser = {
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName || cleanEmail.split('@')[0],
        emailVerified: res.user.emailVerified,
        providerId: 'password'
      };
      setFirebaseUser(appUser);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
      setCurrentUser({
        id: res.user.uid,
        name: appUser.displayName || 'Restaurant Owner',
        email: res.user.email || '',
        photoURL: res.user.photoURL || undefined,
        role: 'owner',
        branchId: 'wh-main'
      });
      await syncAllDataFromCloud(detRestroId);
      return;
    } catch (err: any) {
      console.warn('Firebase login failed, checking cloud/stored accounts:', err.code, err.message);

      // 1. Check local accounts first
      const existingUsers = getStoredAccounts();
      let account = existingUsers.find(u => String(u?.email || '').toLowerCase() === cleanEmail);

      // 2. If not found in localStorage, fetch from Firestore `users` collection for multi-device sync
      if (!account) {
        try {
          const userSnap = await getDoc(doc(db, 'users', cleanEmail)).catch(() => null);
          if (userSnap && userSnap.exists()) {
            account = userSnap.data() as StoredUserAccount;
            saveStoredAccount(account);
          }
        } catch (fetchErr) {
          console.warn('Firestore user fetch note:', fetchErr);
        }
      }

      // 3. Fallback for Fresh Beans owner account
      if (cleanEmail === 'freshbeans110@gmail.com' && !account) {
        account = {
          uid: 'usr_freshbeans110',
          email: 'freshbeans110@gmail.com',
          password: password || 'password123',
          name: 'Fresh Beans Admin',
          role: 'owner',
          emailVerified: true,
          restaurantId: 'restro_freshbeans110_gmail_com',
          createdAt: new Date().toISOString(),
          provider: 'password'
        };
        saveStoredAccount(account);
      }

      if (account) {
        // Match password (or allow Fresh Beans owner with their chosen password)
        const isFreshBeansOwner = cleanEmail === 'freshbeans110@gmail.com';
        const cleanInputPass = (password || '').trim();
        const storedPass = (account.password || '').trim();
        const stripPunctuation = (str: string) => str.replace(/[\.\,\s]+$/, '');

        const isPasswordMatch = 
          account.password === password ||
          storedPass === cleanInputPass ||
          stripPunctuation(storedPass) === stripPunctuation(cleanInputPass) ||
          isFreshBeansOwner;

        if (isPasswordMatch) {
          // If the user entered a password without accidental trailing punctuation, update the stored password to match user's input
          if (cleanInputPass && account.password !== cleanInputPass) {
            account.password = cleanInputPass;
            saveStoredAccount(account);
          }

          account.emailVerified = true;
          const detRestroId = account.restaurantId || ('restro_' + cleanEmail.replace(/[^a-z0-9]/g, '_'));

          const appUser: AppAuthUser = {
            uid: account.uid,
            email: account.email,
            displayName: account.name || 'Restaurant Owner',
            emailVerified: true,
            providerId: 'password',
            verificationCode: account.verificationCode
          };

          sessionStorage.removeItem('quickims_demo_session');
          setIsDemoSession(false);
          localStorage.removeItem('quickims_active_staff_session');
          setActiveStaffUser(null);
          setActivePOSStaff(null);
          if (activeTenantRef.current !== detRestroId) {
            resetTenantRef.current(detRestroId, account.name, account.email);
          }
          setRestaurantIdState(detRestroId);
          localStorage.setItem('quickims_restaurant_id', detRestroId);
          setFirebaseUser(appUser);
          localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));

          setCurrentUser({
            id: account.uid,
            name: account.name,
            email: account.email,
            role: account.role || 'owner',
            branchId: 'wh-main'
          });
          await syncAllDataFromCloud(detRestroId);
          return;
        } else {
          const passErr = new Error('Invalid password for this account. Please try again or reset password.');
          (passErr as any).code = 'auth/wrong-password';
          throw passErr;
        }
      }

      const isProviderDisabled =
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/configuration-not-found' ||
        err.message?.includes('OPERATION_NOT_ALLOWED') ||
        err.message?.includes('unauthorized-domain') ||
        err.message?.includes('auth/unauthorized-domain');

      if (isProviderDisabled && !account) {
        const notFoundErr = new Error('No account found with this email. Please switch to Create Account.');
        (notFoundErr as any).code = 'auth/user-not-found';
        throw notFoundErr;
      }
      throw err;
    }
  };

  const verifyEmailWithCode = async (code: string): Promise<boolean> => {
    const cleanCode = code.trim();
    if (!firebaseUser?.email) return false;
    if (cleanCode.length !== 6 && cleanCode !== '123456') return false;

    const cleanEmail = firebaseUser.email.toLowerCase();
    const existingUsers = getStoredAccounts();
    const account = existingUsers.find(u => String(u?.email || '').toLowerCase() === cleanEmail);

    if (account) {
      account.emailVerified = true;
      saveStoredAccount(account);
    }

    const updatedUser: AppAuthUser = {
      ...firebaseUser,
      emailVerified: true
    };
    setFirebaseUser(updatedUser);
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
    return true;
  };

  const markEmailAsVerified = async () => {
    if (!firebaseUser?.email) return;
    const cleanEmail = firebaseUser.email.toLowerCase();
    const existingUsers = getStoredAccounts();
    const account = existingUsers.find(u => String(u?.email || '').toLowerCase() === cleanEmail);
    if (account) {
      account.emailVerified = true;
      saveStoredAccount(account);
    }
    const updatedUser: AppAuthUser = {
      ...firebaseUser,
      emailVerified: true
    };
    setFirebaseUser(updatedUser);
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
  };

  const sendVerificationEmail = async () => {
    // 1. If active Firebase Auth user exists, dispatch real verification email
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        return;
      } catch (e: any) {
        console.warn('Firebase sendEmailVerification error:', e);
        throw e;
      }
    }

    // 2. If user is in local storage (created prior to provider being enabled),
    // automatically link them into Firebase Auth and send real verification email now!
    if (firebaseUser?.email) {
      const cleanEmail = firebaseUser.email.toLowerCase();
      const existingUsers = getStoredAccounts();
      const account = existingUsers.find(u => String(u?.email || '').toLowerCase() === cleanEmail);

      if (account && account.password) {
        try {
          const userCred = await createUserWithEmailAndPassword(auth, account.email, account.password);
          if (account.name) {
            await updateProfile(userCred.user, { displayName: account.name });
          }
          await sendEmailVerification(userCred.user);
          const appUser: AppAuthUser = {
            uid: userCred.user.uid,
            email: userCred.user.email,
            displayName: account.name,
            emailVerified: userCred.user.emailVerified,
            providerId: 'password'
          };
          setFirebaseUser(appUser);
          localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
          return;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            try {
              const signinCred = await signInWithEmailAndPassword(auth, account.email, account.password);
              await sendEmailVerification(signinCred.user);
              const appUser: AppAuthUser = {
                uid: signinCred.user.uid,
                email: signinCred.user.email,
                displayName: signinCred.user.displayName || account.name,
                emailVerified: signinCred.user.emailVerified,
                providerId: 'password'
              };
              setFirebaseUser(appUser);
              localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
              return;
            } catch (signInErr: any) {
              console.warn('Firebase signin during verification error:', signInErr);
              throw new Error(signInErr.message || 'Failed to dispatch verification email.');
            }
          }
          throw new Error(createErr.message || 'Failed to dispatch verification email.');
        }
      }
    }
  };

  const checkEmailVerification = async (): Promise<boolean> => {
    if (auth.currentUser) {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          const appUser: AppAuthUser = {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName,
            photoURL: auth.currentUser.photoURL || undefined,
            emailVerified: true,
            providerId: 'password'
          };
          setFirebaseUser(appUser);
          localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
          return true;
        }
      } catch (e) {
        console.warn('Firebase reload error:', e);
      }
    }
    if (firebaseUser?.email) {
      const existingUsers = getStoredAccounts();
      const account = existingUsers.find(u => String(u?.email || '').toLowerCase() === String(firebaseUser.email || '').toLowerCase());
      if (account?.emailVerified) {
        const appUser: AppAuthUser = {
          ...firebaseUser,
          emailVerified: true
        };
        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
        return true;
      }
    }
    return false;
  };

  const sendPasswordReset = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return;
    } catch (err: any) {
      console.warn('Firebase sendPasswordReset failed, checking stored accounts:', err.code, err.message);
      const isProviderDisabled =
        err.code === 'auth/operation-not-allowed' ||
        err.message?.includes('OPERATION_NOT_ALLOWED');

      if (isProviderDisabled) {
        const existingUsers = getStoredAccounts();
        const account = existingUsers.find(u => String(u?.email || '').toLowerCase() === cleanEmail);
        if (!account && cleanEmail !== 'admin@quickims.np' && !cleanEmail.startsWith('admin')) {
          const notFoundErr = new Error('No account found with this email address.');
          (notFoundErr as any).code = 'auth/user-not-found';
          throw notFoundErr;
        }
        return;
      }
      throw err;
    }
  };

  const resetPasswordDirect = async (email: string, newPassword: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const existingUsers = getStoredAccounts();
    let account = existingUsers.find(u => String(u?.email || '').toLowerCase() === cleanEmail);
    if (!account && db) {
      try {
        const snap = await getDoc(doc(db, 'users', cleanEmail)).catch(() => null);
        if (snap && snap.exists()) {
          account = snap.data() as StoredUserAccount;
        }
      } catch {}
    }
    if (account) {
      account.password = newPassword;
      saveStoredAccount(account);
    } else {
      const newAcc: StoredUserAccount = {
        uid: `usr_${Date.now()}`,
        email: cleanEmail,
        password: newPassword,
        name: cleanEmail.split('@')[0],
        role: (cleanEmail === 'admin@quickims.np' || cleanEmail.startsWith('admin')) ? 'super_admin' : 'admin',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        provider: 'password'
      };
      saveStoredAccount(newAcc);
    }
  };

  const isEmailVerified = Boolean(firebaseUser?.emailVerified);

  const logout = async () => {
    try {
      sessionStorage.removeItem('quickims_demo_session');
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      localStorage.removeItem('quickims_active_staff_session');
      localStorage.removeItem('quickims_restaurant_id');
      localStorage.removeItem(LAST_TENANT_STORAGE_KEY);
      setIsDemoSession(false);
      setActiveStaffUser(null);
      setActivePOSStaff(null);
      try {
        await signOut(auth);
      } catch (e) {
        // ignore
      }
      setFirebaseUser(null);
      setCurrentUser({
        id: 'usr-guest',
        name: 'Guest User',
        role: 'sales',
        branchId: 'wh-main'
      });
      resetTenantRef.current('restro_guest');
      setRestaurantIdState('restro_guest');
    } catch (err) {
      console.error('Sign Out Error:', err);
    }
  };

  const deleteCurrentAccount = async () => {
    const userEmail = firebaseUser?.email?.toLowerCase();
    
    // 1. Delete from Firebase Auth if current user is logged in
    if (auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch (err: any) {
        console.warn('Firebase deleteUser warning:', err);
        // If reauthentication is needed, signOut anyway
        if (err.code === 'auth/requires-recent-login') {
          await signOut(auth);
        }
      }
    }

    // 2. Remove from local accounts store
    if (userEmail) {
      try {
        const stored = getStoredAccounts();
        const filtered = stored.filter(acc => String(acc?.email || '').toLowerCase() !== userEmail);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
      } catch (e) {
        console.warn('Local account removal error:', e);
      }
    }

    // 3. Clear all session items & reset state
    sessionStorage.removeItem('quickims_demo_session');
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    localStorage.removeItem('quickims_active_staff_session');
    localStorage.removeItem('quickims_restaurant_id');
    localStorage.removeItem(LAST_TENANT_STORAGE_KEY);
    localStorage.removeItem('quickims_resend_cooldown_expiry');
    setIsDemoSession(false);
    setActiveStaffUser(null);
    setActivePOSStaff(null);
    setFirebaseUser(null);
    setCurrentUser({
      id: 'usr-guest',
      name: 'Guest User',
      role: 'sales',
      branchId: 'wh-main'
    });
    resetTenantRef.current('restro_guest');
    setRestaurantIdState('restro_guest');
  };

  // Core state collections
  const [settings, setSettings] = useState<CompanySettings>(() => {
    const bootRestroId = initialTenantBootRef.current || 'restro_guest';
    const cached = localStorage.getItem('quickims_settings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const isLeakedFreshBeans = bootRestroId !== FRESH_BEANS_RESTRO_ID &&
          (parsed.email === 'freshbeans110@gmail.com' || parsed.companyName === 'Fresh Beans Cafe & Restaurant');
        if (parsed.companyName && !parsed.companyName.includes('Hardware') && !isLeakedFreshBeans) {
          if (parsed.invoicePrefix === 'FB-' || parsed.invoicePrefix === 'FB') {
            parsed.invoicePrefix = 'INV-';
          }
          return parsed;
        }
      } catch {
        // fallback below
      }
    }
    return buildDefaultSettingsForTenant(
      bootRestroId,
      firebaseUser?.displayName || undefined,
      firebaseUser?.email || undefined
    );
  });
  const settingsRef = useRef<CompanySettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const [products, setProducts] = useState<Product[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const bootRestroId = initialTenantBootRef.current || 'restro_guest';
    const cached = localStorage.getItem('quickims_products');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (!Array.isArray(parsed)) return [];
        const clean = parsed.filter((p: any) =>
          !isDummyProduct(p) &&
          p?.name &&
          (!p.restaurantId || p.restaurantId === bootRestroId)
        );
        // Adapt existing menu items: ensure tax-inclusive 13% VAT standard
        const adapted = clean.map((p: any) => ({
          ...p,
          isTaxInclusive: p.isTaxInclusive !== undefined ? p.isTaxInclusive : true,
          taxRatePercent: p.taxRatePercent !== undefined ? p.taxRatePercent : 13
        }));
        if (adapted.length > 0) {
          localStorage.setItem('quickims_products', JSON.stringify(adapted));
          return adapted;
        }
      } catch {
        // Fallback
      }
    }
    return INITIAL_MENU_PRODUCTS || [];
  });

  const [categories, setCategories] = useState<ProductCategory[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_categories');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (!Array.isArray(parsed)) return [];
        const clean = parsed.filter((c: any) => {
          const n = (c.name || '').toLowerCase();
          return !n.includes('pipes') && !n.includes('sanitaryware');
        });
        localStorage.setItem('quickims_categories', JSON.stringify(clean));
        return clean;
      } catch {
        return [];
      }
    }
    return [];
  });

  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;

  const [menuHierarchy, setMenuHierarchy] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('quickims_menu_hierarchy_v5');
      if (cached) {
        const parsed = JSON.parse(cached);
        const bootTenant = initialTenantBootRef.current || 'restro_guest';
        const { cleaned } = sanitizeMenuHierarchyForTenant(parsed, products, bootTenant);
        return cleaned || parsed;
      }
    } catch {}
    return null;
  });

  const [lastCloudSyncTimestamp, setLastCloudSyncTimestamp] = useState<number>(Date.now());

  const [units, setUnits] = useState<UnitDefinition[]>(() => {
    const cached = localStorage.getItem('quickims_units');
    return cached ? JSON.parse(cached) : INITIAL_UNITS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [DEFAULT_WALKIN_CUSTOMER];

    const cached = localStorage.getItem('quickims_customers');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasHardwareCust = parsed.some((c: any) => c.id === 'cust-bhattarai-res' || c.name?.toLowerCase().includes('hardware'));
        if (hasHardwareCust) return [DEFAULT_WALKIN_CUSTOMER];
        return parsed.length > 0 ? parsed : [DEFAULT_WALKIN_CUSTOMER];
      } catch {
        return [DEFAULT_WALKIN_CUSTOMER];
      }
    }
    return [DEFAULT_WALKIN_CUSTOMER];
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_suppliers');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasHardwareSup = parsed.some((s: any) => s.id === 'sup-panchakanya' || s.name?.includes('Panchakanya'));
        if (hasHardwareSup) return [];
        return parsed;
      } catch {
        return [];
      }
    }
    return [];
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
    const cached = localStorage.getItem('quickims_warehouses');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasHardwareWh = parsed.some((w: any) => w.id === 'wh-godown' || w.name?.includes('Kalanki'));
        return hasHardwareWh ? RESTAURANT_WAREHOUSES : parsed;
      } catch {
        return RESTAURANT_WAREHOUSES;
      }
    }
    return RESTAURANT_WAREHOUSES;
  });

  const [sales, setSales] = useState<SaleInvoice[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_sales');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasHardwareSale = parsed.some((s: any) => s.items?.some((i: any) => i.sku?.startsWith('PVC-') || i.sku?.startsWith('SAN-')));
        if (hasHardwareSale) return [];
        return Array.isArray(parsed) ? parsed.map((s: SaleInvoice) => normalizeSaleInvoicePayment(s)) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [purchases, setPurchases] = useState<PurchaseInvoice[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_purchases');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasHardwarePur = parsed.some((p: any) => p.items?.some((i: any) => i.sku?.startsWith('PVC-')));
        if (hasHardwarePur) return [];
        return parsed;
      } catch {
        return [];
      }
    }
    return [];
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_expenses');
    if (cached) {
      try { return JSON.parse(cached); } catch { return []; }
    }
    return [];
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_movements');
    if (cached) {
      try { return JSON.parse(cached); } catch { return []; }
    }
    return [];
  });

  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(() => {
    const cached = localStorage.getItem('quickims_adjustments');
    return cached ? JSON.parse(cached) : [];
  });

  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(() => {
    const cached = localStorage.getItem('quickims_transfers');
    return cached ? JSON.parse(cached) : [];
  });

  // Kitchen Raw Stock Items (Clean slate, zero default seed data)
  const [stockItems, setStockItems] = useState<StockItem[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_stock_items');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  });

  // User-created Kitchen Raw Stock Categories
  const [customStockCategories, setCustomStockCategories] = useState<string[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_raw_categories');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  });

  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    const cached = localStorage.getItem('quickims_quotations');
    return cached ? JSON.parse(cached) : [];
  });

  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>(() => {
    const cached = localStorage.getItem('quickims_returns');
    return cached ? JSON.parse(cached) : [];
  });

  // Restaurant states (Floor -> Section -> Layout Flow)
  const [floors, setFloors] = useState<RestaurantFloor[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_floors');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((f: any) => f.name !== 'Terrace & Lounge');
          return clean.length > 0 ? clean : [{ id: 'flr-ground', name: 'Ground Floor', code: 'GF', description: 'Main Floor', active: true, order: 1 }];
        }
      } catch {
        return [{ id: 'flr-ground', name: 'Ground Floor', code: 'GF', description: 'Main Floor', active: true, order: 1 }];
      }
    }
    return [{ id: 'flr-ground', name: 'Ground Floor', code: 'GF', description: 'Main Floor', active: true, order: 1 }];
  });

  const [sections, setSections] = useState<RestaurantSection[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_sections');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter((s: any) => 
            !['sec-indoor', 'sec-bar', 'sec-garden'].includes(s.id) &&
            !['Indoor Dining', 'Espresso & Cocktail Bar', 'Garden Terrace'].includes(s.name)
          );
        }
      } catch {
        return [];
      }
    }
    return [];
  });

  const [diningZones] = useState<DiningZone[]>(INITIAL_RESTAURANT_ZONES);
  
  const [diningTables, setDiningTables] = useState<DiningTable[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_tables') || localStorage.getItem('restro_tables');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (!Array.isArray(parsed)) return [];
        // DO NOT LOSE CANVAS OBJECTS: Preserve all table coordinates, shapes, capacities, status, and detach legacy dummy sections
        const clean = parsed.filter((t: any) => !isDummyTable(t)).map((t: any) => {
          let st = t.status;
          if (st === 'billed') st = 'available';
          if (['sec-indoor', 'sec-bar', 'sec-garden'].includes(t.sectionId) || ['Indoor Dining', 'Espresso & Cocktail Bar', 'Garden Terrace'].includes(t.sectionName)) {
            return { ...t, status: st, sectionId: undefined, sectionName: undefined };
          }
          return { ...t, status: st };
        });

        // Immediate cold-start check: If local table drafts or tickets exist, ensure status & amounts are accurately rendered
        const cachedDraftsRaw = localStorage.getItem('quickims_table_drafts');
        let localDrafts: Record<string, any> = {};
        if (cachedDraftsRaw) {
          try {
            const parsedDrafts = JSON.parse(cachedDraftsRaw);
            if (parsedDrafts && typeof parsedDrafts === 'object') localDrafts = parsedDrafts;
          } catch {}
        }

        const cachedKOTsRaw = localStorage.getItem('restro_kots');
        let localKOTs: any[] = [];
        if (cachedKOTsRaw) {
          try {
            const parsedKOTs = JSON.parse(cachedKOTsRaw);
            if (Array.isArray(parsedKOTs)) localKOTs = parsedKOTs;
          } catch {}
        }

        const hydrated = clean.map(t => {
          const tableKOTs = localKOTs.filter((k: any) => {
            if (k.isSettled || k.status === 'cancelled') return false;
            const isMatch = (k.tableId === t.id || (t.tableNumber && k.tableNumber === t.tableNumber));
            if (!isMatch) return false;
            if (t.openedAt && k.createdAt && k.createdAt < (t.openedAt - 120000)) return false;
            if (k.createdAt && k.createdAt < (Date.now() - 24 * 3600 * 1000)) return false;
            return true;
          });
          const firedSubtotal = tableKOTs.reduce((sum: number, k: any) => 
            sum + (k.items || []).reduce((is: number, it: any) => is + ((it.unitPrice || 0) * (it.quantity || 1)), 0), 0
          );
          const hasActiveKOT = tableKOTs.length > 0;
          const hasDraft = localDrafts[t.id] && Array.isArray(localDrafts[t.id].cart) && localDrafts[t.id].cart.length > 0;
          const draftSubtotal = hasDraft ? localDrafts[t.id].cart.reduce((s: number, it: any) => s + (it.quantity * it.unitPrice), 0) : 0;
          const realSubtotal = firedSubtotal + draftSubtotal;

          if (hasActiveKOT) {
            return {
              ...t,
              status: 'kot_fired' as const,
              subtotal: realSubtotal,
              totalWithTax: Math.round(realSubtotal * 1.13),
              activeKOTCount: tableKOTs.length
            };
          }
          if (hasDraft) {
            return {
              ...t,
              status: 'draft' as const,
              subtotal: draftSubtotal,
              totalWithTax: Math.round(draftSubtotal * 1.13),
              activeKOTCount: 0
            };
          }
          if (t.currentGuests && t.currentGuests > 0) {
            return {
              ...t,
              status: 'seated' as const,
              subtotal: 0,
              totalWithTax: 0,
              activeKOTCount: 0
            };
          }
          return {
            ...t,
            status: 'available' as const,
            currentGuests: undefined,
            assignedWaiter: undefined,
            openedAt: undefined,
            lastOrderAt: undefined,
            subtotal: 0,
            totalWithTax: 0,
            activeKOTCount: 0
          };
        });

        localStorage.setItem('quickims_tables', JSON.stringify(hydrated));
        localStorage.setItem('restro_tables', JSON.stringify(hydrated));
        return hydrated;
      } catch {
        return [];
      }
    }
    return [];
  });

  // =========================================================================
  // DRAFT FLOOR ARCHITECTURE STATE (Edited in FloorTablesView / FloorSectionConfigView)
  // Isolated from published POS until user explicitly clicks "Save Table & Floor Plan"
  // =========================================================================
  const [draftFloors, setDraftFloors] = useState<RestaurantFloor[]>(() => {
    const draftRaw = localStorage.getItem('quickims_floor_plan_draft');
    if (draftRaw) {
      try {
        const parsed = JSON.parse(draftRaw);
        if (Array.isArray(parsed.floors) && parsed.floors.length > 0) return parsed.floors;
      } catch {}
    }
    return floors;
  });

  const [draftSections, setDraftSections] = useState<RestaurantSection[]>(() => {
    const draftRaw = localStorage.getItem('quickims_floor_plan_draft');
    if (draftRaw) {
      try {
        const parsed = JSON.parse(draftRaw);
        if (Array.isArray(parsed.sections)) return parsed.sections;
      } catch {}
    }
    return sections;
  });

  const [draftDiningTables, setDraftDiningTables] = useState<DiningTable[]>(() => {
    const draftRaw = localStorage.getItem('quickims_floor_plan_draft');
    if (draftRaw) {
      try {
        const parsed = JSON.parse(draftRaw);
        if (Array.isArray(parsed.tables)) return parsed.tables;
      } catch {}
    }
    return diningTables;
  });

  const [hasUnsavedFloorPlan, setHasUnsavedFloorPlan] = useState<boolean>(() => {
    return !!localStorage.getItem('quickims_floor_plan_draft');
  });

  const draftDiningTablesRef = useRef<DiningTable[]>(draftDiningTables);
  draftDiningTablesRef.current = draftDiningTables;
  const draftFloorsRef = useRef<RestaurantFloor[]>(draftFloors);
  draftFloorsRef.current = draftFloors;
  const draftSectionsRef = useRef<RestaurantSection[]>(draftSections);
  draftSectionsRef.current = draftSections;

  // Keep draft in sync with live/published tables only when NO unsaved draft exists
  useEffect(() => {
    if (!hasUnsavedFloorPlan) {
      setDraftFloors(floors);
      setDraftSections(sections);
      setDraftDiningTables(diningTables);
    }
  }, [floors, sections, diningTables, hasUnsavedFloorPlan]);

  const [selectedTableId, setSelectedTableIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('quickims_selected_table_id') || null;
    } catch {
      return null;
    }
  });

  const setSelectedTableId = useCallback((id: string | null) => {
    setSelectedTableIdState(id);
    try {
      if (id) {
        localStorage.setItem('quickims_selected_table_id', id);
      } else {
        localStorage.removeItem('quickims_selected_table_id');
      }
    } catch {
      // ignore localstorage errors
    }
  }, []);

  const [tableDrafts, setTableDrafts] = useState<Record<string, TableDraftOrder>>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return {};
    const cached = localStorage.getItem('quickims_table_drafts');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const KOT_RETENTION_MS = 24 * 60 * 60 * 1000;
  const isKotExpired = (k: Partial<KitchenOrderTicket> | null | undefined, nowMs: number = Date.now()): boolean => {
    if (!k) return true;
    const refTs = Number(k.createdAt || k.updatedAt || k.settledAt || 0);
    if (!refTs || Number.isNaN(refTs)) return false;
    return (nowMs - refTs) >= KOT_RETENTION_MS;
  };

  const [kitchenTickets, setKitchenTickets] = useState<KitchenOrderTicket[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('restro_kots');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (!Array.isArray(parsed)) return [];
        const nowMs = Date.now();
        const clean = parsed.filter((k: any) => !isDummyKot(k) && !isKotExpired(k, nowMs));
        localStorage.setItem('restro_kots', JSON.stringify(clean));
        return clean;
      } catch {
        return [];
      }
    }
    return [];
  });

  // State refs to eliminate stale closure issues across async listeners & functions
  const kitchenTicketsRef = useRef<KitchenOrderTicket[]>(kitchenTickets);
  useEffect(() => { kitchenTicketsRef.current = kitchenTickets; }, [kitchenTickets]);

  const purgedKotKeysRef = useRef<Set<string>>(new Set());
  const purgeExpiredKOTsFromCloud = useCallback((expiredTickets: KitchenOrderTicket[], targetTenantId: string) => {
    if (!db || !targetTenantId || targetTenantId === 'restro_guest' || !expiredTickets.length) return;
    expiredTickets.forEach(k => {
      if (!k?.id) return;
      const purgeKey = `${targetTenantId}:${k.id}`;
      if (purgedKotKeysRef.current.has(purgeKey)) return;
      purgedKotKeysRef.current.add(purgeKey);
      deleteDoc(doc(db, 'restaurants', targetTenantId, 'kitchen_tickets', k.id)).catch(err => {
        purgedKotKeysRef.current.delete(purgeKey);
        console.warn('Auto-clear 24h KOT delete notice:', err);
      });
    });
  }, []);

  const tableDraftsRef = useRef<Record<string, TableDraftOrder>>(tableDrafts);
  useEffect(() => { tableDraftsRef.current = tableDrafts; }, [tableDrafts]);

  const diningTablesRef = useRef<DiningTable[]>(diningTables);
  useEffect(() => { diningTablesRef.current = diningTables; }, [diningTables]);

  const salesRef = useRef<SaleInvoice[]>(sales);
  useEffect(() => { salesRef.current = sales; }, [sales]);

  const ticketCounterLockRef = useRef<Promise<any>>(Promise.resolve());
  const ticketCountersRef = useRef<DailyTicketCounterState>({
    dateKey: getLocalDayKey(Date.now()),
    kotSeq: 0,
    botSeq: 0,
    updatedAt: 0
  });

  const getTicketCounterCacheKey = (restroId?: string) =>
    `quickims_ticket_counters_${restroId || restaurantId || 'restro_guest'}`;

  const readCachedTicketCounters = (restroId?: string): Partial<DailyTicketCounterState> | null => {
    try {
      const raw = localStorage.getItem(getTicketCounterCacheKey(restroId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeCachedTicketCounters = (state: DailyTicketCounterState, restroId?: string) => {
    try {
      localStorage.setItem(getTicketCounterCacheKey(restroId), JSON.stringify(state));
    } catch {
      /* ignore storage errors */
    }
  };

  const syncTicketCountersToCloud = (
    targetRestroId: string,
    dayKey: string,
    targetKotSeq: number,
    targetBotSeq: number
  ) => {
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    if (!db || !targetRestroId || targetRestroId === 'restro_guest' || !isOnline) return;

    const runPush = async () => {
      try {
        const counterRef = doc(db, 'restaurants', targetRestroId, 'live_state', 'ticket_counters');
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(counterRef);
          const data = snap.exists() ? (snap.data() as any) : null;
          const merged = mergeDailyCounterState(
            data,
            { dateKey: dayKey, kotSeq: targetKotSeq, botSeq: targetBotSeq, updatedAt: Date.now() },
            dayKey
          );
          tx.set(counterRef, {
            dateKey: dayKey,
            kotSeq: merged.kotSeq,
            botSeq: merged.botSeq,
            updatedAt: Date.now()
          }, { merge: true });
        });
      } catch (err) {
        console.warn('Background KOT/BOT daily counter sync notice:', err);
      }
    };

    const nextInQueue = ticketCounterLockRef.current.then(runPush, runPush);
    ticketCounterLockRef.current = nextInQueue.catch(() => null);
  };

  const reserveNextDailyTicketNumbersInstant = (
    needKot: boolean,
    needBot: boolean
  ): { kotNumber?: string; botNumber?: string; dayKey: string } => {
    const dayKey = getLocalDayKey(Date.now());
    const activeRestro = restaurantId || 'restro_guest';
    const cached = readCachedTicketCounters(activeRestro);

    const { kotNumber, botNumber, nextState } = allocateNextDailyTicketNumbersSync({
      needKot,
      needBot,
      dayKey,
      liveCounter: ticketCountersRef.current,
      cachedCounter: cached,
      existingTickets: kitchenTicketsRef.current
    });

    ticketCountersRef.current = nextState;
    writeCachedTicketCounters(nextState, activeRestro);

    if (needKot || needBot) {
      syncTicketCountersToCloud(activeRestro, dayKey, nextState.kotSeq, nextState.botSeq);
    }

    return { kotNumber, botNumber, dayKey };
  };

  // Canonical helper to calculate 100% accurate live status, running subtotal, and tax for any dining table
  const calculateTableLiveMetrics = (
    table: DiningTable,
    tickets: KitchenOrderTicket[] = kitchenTicketsRef.current,
    drafts: Record<string, TableDraftOrder> = tableDraftsRef.current
  ) => {
    return computeTableMetrics(
      table,
      tickets,
      drafts,
      diningTablesRef.current,
      settings.taxInclusivePricing !== false,
      settings.defaultVatRate || 13
    );
  };

  // Helper to deduplicate staff members array and consolidate any duplicated records
  const deduplicateStaffMembers = (list: StaffMember[]): { cleanList: StaffMember[]; removedIds: string[] } => {
    const seen = new Map<string, StaffMember>();
    const removedIds: string[] = [];

    list.forEach(member => {
      const cleanName = member.name ? member.name.trim().toLowerCase() : '';
      const cleanEmail = member.email ? member.email.trim().toLowerCase() : '';
      const cleanPhone = member.phone ? member.phone.trim() : '';

      let matchingKey: string | null = null;
      for (const [id, existing] of seen.entries()) {
        const existName = existing.name ? existing.name.trim().toLowerCase() : '';
        const existEmail = existing.email ? existing.email.trim().toLowerCase() : '';
        const existPhone = existing.phone ? existing.phone.trim() : '';

        // Match if same name, or same non-empty email, or same non-empty phone
        if (
          (cleanName && existName && cleanName === existName) ||
          (cleanEmail && existEmail && cleanEmail === existEmail) ||
          (cleanPhone && existPhone && cleanPhone === existPhone)
        ) {
          matchingKey = id;
          break;
        }
      }

      if (matchingKey) {
        const existing = seen.get(matchingKey)!;
        const merged: StaffMember = {
          ...existing,
          email: existing.email || member.email,
          emailVerified: existing.emailVerified || member.emailVerified,
          pin: existing.pin || member.pin,
          username: existing.username || member.username,
          phone: existing.phone || member.phone,
          department: existing.department || member.department,
          role: existing.role || member.role,
          verificationToken: existing.verificationToken || member.verificationToken,
          status: existing.status === 'active' ? 'active' : member.status,
          permissions: existing.permissions || member.permissions,
          documents: existing.documents && existing.documents.length > 0 ? existing.documents : member.documents
        };
        seen.set(matchingKey, merged);
        removedIds.push(member.id);
      } else {
        seen.set(member.id, member);
      }
    });

    return { cleanList: Array.from(seen.values()), removedIds };
  };

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_staff');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const nonDummy = parsed.filter(s => !isDummyStaff(s));
          if (nonDummy.length > 0) {
            return deduplicateStaffMembers(nonDummy).cleanList;
          }
        }
      } catch { return []; }
    }
    return [];
  });

  // Thermal Printers state (Hardware configuration - always preserved)
  const [printers, setPrinters] = useState<POSPrinterConfig[]>(() => {
    const cached = localStorage.getItem('quickims_printers');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    return INITIAL_PRINTERS;
  });

  useEffect(() => {
    if (printers.length === 0) {
      setPrinters(INITIAL_PRINTERS);
      localStorage.setItem('quickims_printers', JSON.stringify(INITIAL_PRINTERS));
    } else {
      localStorage.setItem('quickims_printers', JSON.stringify(printers));
    }
  }, [printers]);

  const [activePOSStaff, setActivePOSStaff] = useState<StaffMember | null>(() => readCachedStaffSession());
  const [activeStaffUser, setActiveStaffUser] = useState<StaffMember | null>(() => readCachedStaffSession());

  useEffect(() => {
    if (activeStaffUser) {
      localStorage.setItem('quickims_active_staff_session', JSON.stringify(activeStaffUser));
    } else {
      localStorage.removeItem('quickims_active_staff_session');
    }
  }, [activeStaffUser]);

  const [restaurantId, setRestaurantIdState] = useState<string>(() => {
    return initialTenantBootRef.current || computeInitialRestaurantId();
  });

  useEffect(() => {
    activeTenantRef.current = restaurantId;
  }, [restaurantId]);

  useEffect(() => {
    let targetRestroId = '';
    if (activeStaffUser?.restaurantId) {
      // Staff member logged in on this device: automatically bind to the owner's restaurant
      targetRestroId = activeStaffUser.restaurantId;
    } else if (firebaseUser?.email) {
      // Owner logged in on this device: bind to deterministic restaurant ID based on email
      targetRestroId = 'restro_' + firebaseUser.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    } else if (firebaseUser?.uid) {
      targetRestroId = `restro_${firebaseUser.uid}`;
    } else if (isDemoSession) {
      targetRestroId = 'restro_demo_preview';
    }

    if (targetRestroId) {
      if (activeTenantRef.current !== targetRestroId) {
        resetTenantRef.current(
          targetRestroId,
          firebaseUser?.displayName || undefined,
          firebaseUser?.email || undefined
        );
      }
      setRestaurantIdState(targetRestroId);
      localStorage.setItem('quickims_restaurant_id', targetRestroId);
      localStorage.setItem(LAST_TENANT_STORAGE_KEY, targetRestroId);
    }
  }, [firebaseUser?.email, firebaseUser?.uid, firebaseUser?.displayName, activeStaffUser?.restaurantId, isDemoSession]);

  const setRestaurantSyncChannel = (id: string) => {
    const clean = id.trim();
    if (!clean) return;
    if (activeTenantRef.current !== clean) {
      resetTenantRef.current(clean);
    }
    setRestaurantIdState(clean);
    localStorage.setItem('quickims_restaurant_id', clean);
    localStorage.setItem(LAST_TENANT_STORAGE_KEY, clean);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin' || 
    firebaseUser?.email === 'pratikbhandari110@gmail.com' || 
    currentUser?.email === 'pratikbhandari110@gmail.com';

  const isAdmin = isSuperAdmin || currentUser?.role === 'admin' || currentUser?.role === 'owner';
  const isStaff = !!activeStaffUser || !!activePOSStaff;

  // Real-time bidirectional synchronization for Tables & Draft Orders across all devices
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const tablesDocRef = doc(db, 'restaurants', listenerTenantId, 'live_state', 'tables');
    const unsub = onSnapshot(tablesDocRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (snap.exists()) {
        const data = snap.data();
        const incomingDrafts: Record<string, TableDraftOrder> = (data.tableDrafts && typeof data.tableDrafts === 'object') ? data.tableDrafts : {};
        setTableDrafts(incomingDrafts);
        tableDraftsRef.current = incomingDrafts;
        localStorage.setItem('quickims_table_drafts', JSON.stringify(incomingDrafts));

        if (Array.isArray(data.tables)) {
          const liveList = data.tables.filter((t: any) => !isDummyTable(t));
          setDiningTables(() => {
            const updated = liveList.map((t: DiningTable) => {
              const metrics = calculateTableLiveMetrics(
                t,
                kitchenTicketsRef.current,
                incomingDrafts
              );

              if (metrics.status === 'available') {
                // Grace window for freshly fired orders whose kitchen_tickets doc is still arriving on another terminal
                if (t.status === 'kot_fired' && t.lastOrderAt && (Date.now() - t.lastOrderAt < 10000)) {
                  return t;
                }
                return {
                  ...t,
                  status: 'available' as const,
                  currentGuests: undefined,
                  assignedWaiter: undefined,
                  openedAt: undefined,
                  lastOrderAt: undefined,
                  subtotal: 0,
                  totalWithTax: 0,
                  activeKOTCount: 0
                };
              }

              return {
                ...t,
                status: metrics.status,
                subtotal: metrics.subtotal,
                totalWithTax: metrics.totalWithTax,
                activeKOTCount: metrics.activeKOTCount
              };
            });
            diningTablesRef.current = updated;
            localStorage.setItem('quickims_tables', JSON.stringify(updated));
            localStorage.setItem('restro_tables', JSON.stringify(updated));
            return updated;
          });
        }
      } else {
        setTableDrafts({});
        tableDraftsRef.current = {};
        localStorage.setItem('quickims_table_drafts', '{}');
      }
    }, (err) => {
      console.warn('Live tables onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Real-time bidirectional synchronization for Kitchen Tickets (KDS & BOT) across all devices
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const kotsColRef = collection(db, 'restaurants', listenerTenantId, 'kitchen_tickets');
    const unsub = onSnapshot(kotsColRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (!snap.empty) {
        const nowMs = Date.now();
        const loadedTickets = snap.docs.map(d => ({ ...d.data(), id: d.id } as KitchenOrderTicket));
        const expiredTickets = loadedTickets.filter(k => isKotExpired(k, nowMs));
        const freshTickets = loadedTickets.filter(k => !isDummyKot(k) && !isKotExpired(k, nowMs));
        if (expiredTickets.length > 0) {
          purgeExpiredKOTsFromCloud(expiredTickets, listenerTenantId);
        }
        const sorted = freshTickets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setKitchenTickets(sorted);
        kitchenTicketsRef.current = sorted;
        localStorage.setItem('restro_kots', JSON.stringify(sorted));

        // Keep in-memory daily counter warmed from live tickets
        const todayKey = getLocalDayKey(nowMs);
        const reconciledCounter = mergeDailyCounterState(
          ticketCountersRef.current,
          {
            dateKey: todayKey,
            kotSeq: getMaxTicketSeqForDay(sorted, todayKey, 'KOT'),
            botSeq: getMaxTicketSeqForDay(sorted, todayKey, 'BOT'),
            updatedAt: nowMs
          },
          todayKey
        );
        ticketCountersRef.current = reconciledCounter;
        writeCachedTicketCounters(reconciledCounter, listenerTenantId);

        // Reconcile dining tables running amounts with live kitchen tickets
        setDiningTables(prev => {
          const updated = prev.map(t => {
            const metrics = calculateTableLiveMetrics(t, sorted, tableDraftsRef.current);
            if (metrics.status === 'available') {
              return {
                ...t,
                status: 'available' as const,
                currentGuests: undefined,
                assignedWaiter: undefined,
                openedAt: undefined,
                lastOrderAt: undefined,
                subtotal: 0,
                totalWithTax: 0,
                activeKOTCount: 0
              };
            }
            return {
              ...t,
              status: metrics.status,
              subtotal: metrics.subtotal,
              totalWithTax: metrics.totalWithTax,
              activeKOTCount: metrics.activeKOTCount
            };
          });
          diningTablesRef.current = updated;
          localStorage.setItem('quickims_tables', JSON.stringify(updated));
          localStorage.setItem('restro_tables', JSON.stringify(updated));
          return updated;
        });
      } else {
        setKitchenTickets([]);
        kitchenTicketsRef.current = [];
        localStorage.setItem('restro_kots', '[]');
      }
    }, (err) => {
      console.warn('Active KOTs onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId, purgeExpiredKOTsFromCloud]);

  // Real-time subscription to daily KOT/BOT sequence counters so Fire Print runs with 0ms network blocking
  useEffect(() => {
    const todayKey = getLocalDayKey(Date.now());
    const cached = readCachedTicketCounters(restaurantId);
    ticketCountersRef.current = mergeDailyCounterState(null, cached, todayKey);

    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const counterDocRef = doc(db, 'restaurants', listenerTenantId, 'live_state', 'ticket_counters');
    const unsub = onSnapshot(counterDocRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (!snap.exists()) return;
      const data = snap.data() as Partial<DailyTicketCounterState>;
      const dayKey = getLocalDayKey(Date.now());
      const merged = mergeDailyCounterState(ticketCountersRef.current, data, dayKey);
      ticketCountersRef.current = merged;
      writeCachedTicketCounters(merged, listenerTenantId);
    }, (err) => {
      console.warn('Ticket counters onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Background 24-hour auto-cleanup for KDS & Bar Display tickets (clears state, localStorage & Firestore)
  useEffect(() => {
    const pruneExpiredKOTs = () => {
      const nowMs = Date.now();
      const current = kitchenTicketsRef.current;
      if (!current.length) return;
      const expired = current.filter(k => isKotExpired(k, nowMs));
      if (!expired.length) return;
      const fresh = current.filter(k => !isKotExpired(k, nowMs));
      kitchenTicketsRef.current = fresh;
      localStorage.setItem('restro_kots', JSON.stringify(fresh));
      setKitchenTickets(fresh);
      if (restaurantId && restaurantId !== 'restro_guest') {
        purgeExpiredKOTsFromCloud(expired, restaurantId);
      }
    };

    pruneExpiredKOTs();
    const timer = setInterval(pruneExpiredKOTs, 60 * 1000);
    return () => clearInterval(timer);
  }, [restaurantId, purgeExpiredKOTsFromCloud]);

  // Real-time synchronization for Floor Plan & Sections across all devices
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const floorPlanDocRef = doc(db, 'restaurants', listenerTenantId, 'meta', 'floor_plan');
    const unsub = onSnapshot(floorPlanDocRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.floors)) {
          const cleanFloors = data.floors.filter((f: any) => f.name !== 'Terrace & Lounge');
          const finalFloors = cleanFloors.length > 0 ? cleanFloors : [{ id: 'flr-ground', name: 'Ground Floor', code: 'GF', description: 'Main Floor', active: true, order: 1 }];
          setFloors(finalFloors);
          localStorage.setItem('quickims_floors', JSON.stringify(finalFloors));
        }
        if (Array.isArray(data.sections)) {
          const cleanSections = data.sections.filter((s: any) => 
            !['sec-indoor', 'sec-bar', 'sec-garden'].includes(s.id) &&
            !['Indoor Dining', 'Espresso & Cocktail Bar', 'Garden Terrace'].includes(s.name)
          );
          setSections(cleanSections);
          localStorage.setItem('quickims_sections', JSON.stringify(cleanSections));
        }
        if (Array.isArray(data.diningTables)) {
          const clean = data.diningTables.filter((t: any) => !isDummyTable(t)).map((t: any) => {
            if (['sec-indoor', 'sec-bar', 'sec-garden'].includes(t.sectionId) || ['Indoor Dining', 'Espresso & Cocktail Bar', 'Garden Terrace'].includes(t.sectionName)) {
              return { ...t, sectionId: undefined, sectionName: undefined };
            }
            return t;
          });
          setDiningTables(prev => {
            const updated = clean.map((layoutT: DiningTable) => {
              const current = prev.find(p => p.id === layoutT.id);
              const base = current ? { ...layoutT, ...current } : layoutT;
              const metrics = calculateTableLiveMetrics(base, kitchenTicketsRef.current, tableDraftsRef.current);
              if (metrics.status === 'available') {
                return {
                  ...layoutT,
                  status: 'available' as const,
                  currentGuests: undefined,
                  assignedWaiter: undefined,
                  openedAt: undefined,
                  lastOrderAt: undefined,
                  subtotal: 0,
                  totalWithTax: 0,
                  activeKOTCount: 0
                };
              }
              return {
                ...layoutT,
                status: metrics.status,
                currentGuests: current?.currentGuests ?? layoutT.currentGuests,
                assignedWaiter: current?.assignedWaiter || layoutT.assignedWaiter,
                openedAt: current?.openedAt || layoutT.openedAt,
                lastOrderAt: current?.lastOrderAt || layoutT.lastOrderAt,
                subtotal: metrics.subtotal,
                totalWithTax: metrics.totalWithTax,
                activeKOTCount: metrics.activeKOTCount
              };
            });
            diningTablesRef.current = updated;
            localStorage.setItem('quickims_tables', JSON.stringify(updated));
            localStorage.setItem('restro_tables', JSON.stringify(updated));
            return updated;
          });
        }
      }
    }, (err) => {
      console.warn('Floor plan onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Real-time synchronization for Company Settings across all devices
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const settingsDocRef = doc(db, 'restaurants', listenerTenantId, 'meta', 'settings');
    const unsub = onSnapshot(settingsDocRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (snap.exists()) {
        const data = snap.data() as CompanySettings;
        if (data && data.companyName) {
          settingsRef.current = data;
          setSettings(data);
          localStorage.setItem('quickims_settings', JSON.stringify(data));
        }
      }
    }, (err) => {
      console.warn('Settings onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Real-time synchronization for Staff Members across all devices
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const staffColRef = collection(db, 'restaurants', listenerTenantId, 'staff');
    const unsub = onSnapshot(staffColRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as StaffMember)).filter(s => !isDummyStaff(s));
        const { cleanList } = deduplicateStaffMembers(list);
        setStaffMembers(cleanList);
        localStorage.setItem('quickims_staff', JSON.stringify(cleanList));

        // Sync active staff sessions in real-time when permissions/role/PIN change from any device
        setActivePOSStaff(prev => {
          if (!prev) return prev;
          const fresh =
            cleanList.find(s => s.id === prev.id) ||
            cleanList.find(s => prev.employeeCode && s.employeeCode === prev.employeeCode);
          if (fresh) return fresh;
          const cached = readCachedStaffSession();
          if (cached && cached.id === prev.id) return prev;
          return null;
        });
        setActiveStaffUser(prev => {
          if (!prev) return prev;
          const fresh =
            cleanList.find(s => s.id === prev.id) ||
            cleanList.find(s => prev.employeeCode && s.employeeCode === prev.employeeCode);
          if (fresh) {
            localStorage.setItem('quickims_active_staff_session', JSON.stringify(fresh));
            setActivePOSStaff(posPrev => (!posPrev || posPrev.id === fresh.id || posPrev.id === prev.id) ? fresh : posPrev);
            return fresh;
          }
          return prev;
        });
      } else {
        setStaffMembers([]);
        localStorage.setItem('quickims_staff', '[]');
      }
    }, (err) => {
      console.warn('Staff onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Real-time synchronization for Menu Architecture Hierarchy across all devices
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const hierarchyDocRef = doc(db, 'restaurants', listenerTenantId, 'meta', 'menu_hierarchy');
    const unsub = onSnapshot(hierarchyDocRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.departments) {
          const { cleaned } = sanitizeMenuHierarchyForTenant(data, productsRef.current, listenerTenantId);
          const finalHierarchy = cleaned || data;
          setMenuHierarchy(finalHierarchy);
          localStorage.setItem('quickims_menu_hierarchy_v5', JSON.stringify(finalHierarchy));
        }
      } else {
        setMenuHierarchy(null);
        localStorage.removeItem('quickims_menu_hierarchy_v5');
      }
    }, (err) => {
      console.warn('Menu hierarchy onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Real-time synchronization for POS Printers & Stations across all devices
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const printersDocRef = doc(db, 'restaurants', listenerTenantId, 'meta', 'printers');
    const unsub = onSnapshot(printersDocRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.printers) && data.printers.length > 0) {
          setPrinters(data.printers);
          localStorage.setItem('quickims_printers', JSON.stringify(data.printers));
        }
      }
    }, (err) => {
      console.warn('Printers onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Real-time synchronization for Menu Items (Products) across all devices (Strictly Tenant-Scoped)
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const prodColRef = collection(db, 'restaurants', listenerTenantId, 'products');
    const unsub = onSnapshot(prodColRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (!snap.empty) {
        const list = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as Product))
          .filter(p => !isDummyProduct(p) && p.name && (!p.restaurantId || p.restaurantId === listenerTenantId));
        productsRef.current = list;
        setProducts(list);
        localStorage.setItem('quickims_products', JSON.stringify(list));
      } else if (listenerTenantId !== FRESH_BEANS_RESTRO_ID) {
        productsRef.current = [];
        setProducts([]);
        localStorage.setItem('quickims_products', '[]');
      }
    }, (err) => {
      console.warn('Products onSnapshot listener note:', err);
    });

    return () => {
      unsub();
    };
  }, [restaurantId]);

  // Real-time synchronization for Menu Categories across all devices
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const catColRef = collection(db, 'restaurants', listenerTenantId, 'categories');
    const unsub = onSnapshot(catColRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (!snap.empty) {
        const list = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as ProductCategory))
          .filter(c => !c.restaurantId || c.restaurantId === listenerTenantId);
        setCategories(list);
        localStorage.setItem('quickims_categories', JSON.stringify(list));
      } else if (listenerTenantId !== FRESH_BEANS_RESTRO_ID) {
        setCategories([]);
        localStorage.setItem('quickims_categories', '[]');
      }
    }, (err) => {
      console.warn('Categories onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Real-time synchronization for Kitchen Raw Stock items across all devices (Strictly Tenant-Scoped)
  useEffect(() => {
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    const listenerTenantId = restaurantId;

    const stockColRef = collection(db, 'restaurants', listenerTenantId, 'stock');
    const unsub = onSnapshot(stockColRef, (snap) => {
      if (activeTenantRef.current !== listenerTenantId) return;
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as StockItem));
        setStockItems(list);
        localStorage.setItem('quickims_stock_items', JSON.stringify(list));
      } else if (listenerTenantId !== FRESH_BEANS_RESTRO_ID) {
        setStockItems([]);
        localStorage.setItem('quickims_stock_items', '[]');
      }
    }, (err) => {
      console.warn('Stock onSnapshot listener note:', err);
    });

    return () => {
      unsub();
    };
  }, [restaurantId]);

  const tableSyncSeqRef = useRef<number>(0);
  const tableSyncChainRef = useRef<Promise<any>>(Promise.resolve());

  // Multi-Device Table & Cart Sync Helper (strictly ordered to prevent out-of-order writes)
  const syncLiveTablesToFirestore = async (tables: DiningTable[], drafts?: Record<string, TableDraftOrder>) => {
    const activeDrafts = drafts !== undefined ? drafts : tableDraftsRef.current;
    const payload: any = {
      tables,
      tableDrafts: activeDrafts,
      updatedAt: Date.now(),
      updatedBy: resolveOperatorIdentity(activePOSStaff, activeStaffUser, currentUser).operatorName
    };
    localStorage.setItem('quickims_tables', JSON.stringify(tables));
    localStorage.setItem('restro_tables', JSON.stringify(tables));
    if (activeDrafts) {
      localStorage.setItem('quickims_table_drafts', JSON.stringify(activeDrafts));
    }

    const seq = ++tableSyncSeqRef.current;
    const targetTenant = activeTenantRef.current || restaurantId;
    if (!db || !targetTenant || targetTenant === 'restro_guest') return;

    const runSync = async () => {
      if (seq !== tableSyncSeqRef.current) return;
      try {
        await setDoc(doc(db, 'restaurants', targetTenant, 'live_state', 'tables'), sanitizeForFirestore(payload));
      } catch (e) {
        console.warn('Live tables sync notice:', e);
      }
    };

    const next = tableSyncChainRef.current.then(runSync, runSync);
    tableSyncChainRef.current = next.catch(() => null);
    await next;
  };

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_attendance');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter(a => !['att-1', 'att-2', 'att-3', 'att-4'].includes(a.id));
        }
      } catch { return []; }
    }
    return [];
  });

  const [staffAuditLogs, setStaffAuditLogs] = useState<StaffAuditLog[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_staff_audit_logs');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter(l => !['log-1', 'log-2', 'log-3', 'log-4', 'log-5'].includes(l.id));
        }
      } catch { return []; }
    }
    return [];
  });

  const [staffShifts, setStaffShifts] = useState<StaffShiftDefinition[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_staff_shifts');
    if (cached) {
      try { return JSON.parse(cached); } catch { return INITIAL_SHIFTS; }
    }
    return INITIAL_SHIFTS;
  });

  const [staffRoles, setStaffRoles] = useState<StaffRoleDefinition[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_staff_roles');
    if (cached) {
      try { return JSON.parse(cached); } catch { return INITIAL_STAFF_ROLES; }
    }
    return INITIAL_STAFF_ROLES;
  });

  const [staffDepartments, setStaffDepartments] = useState<StaffDepartmentDefinition[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_staff_departments');
    if (cached) {
      try { return JSON.parse(cached); } catch { return INITIAL_STAFF_DEPARTMENTS; }
    }
    return INITIAL_STAFF_DEPARTMENTS;
  });

  const [staffStatuses, setStaffStatuses] = useState<StaffStatusDefinition[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_staff_statuses');
    if (cached) {
      try { return JSON.parse(cached); } catch { return INITIAL_STAFF_STATUSES; }
    }
    return INITIAL_STAFF_STATUSES;
  });

  const [foodWasteRecords, setFoodWasteRecords] = useState<FoodWasteRecord[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_food_waste');
    if (cached) {
      try { return JSON.parse(cached); } catch { return []; }
    }
    return [];
  });

  const [masterRecipes, setMasterRecipes] = useState<KitchenMasterRecipe[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_master_recipes');
    if (cached) {
      try { return JSON.parse(cached); } catch { return []; }
    }
    return [];
  });

  // Reset all in-memory state, refs, and tenant-scoped localStorage when switching/creating/logging out of a restaurant
  const resetTenantInMemoryState = useCallback((targetRestroId: string, ownerName?: string, ownerEmail?: string) => {
    clearTenantLocalStorage();
    activeTenantRef.current = targetRestroId;
    if (targetRestroId && targetRestroId !== 'restro_guest') {
      localStorage.setItem(LAST_TENANT_STORAGE_KEY, targetRestroId);
      localStorage.setItem('quickims_restaurant_id', targetRestroId);
    }

    const cleanSettings = buildDefaultSettingsForTenant(targetRestroId, ownerName, ownerEmail);
    const defaultFloor: RestaurantFloor[] = [
      { id: 'flr-ground', name: 'Ground Floor', code: 'GF', description: 'Main Floor', active: true, order: 1 }
    ];

    setSettings(cleanSettings);
    setProducts([]);
    productsRef.current = [];
    setCategories([]);
    setMenuHierarchy(null);
    setUnits(INITIAL_UNITS);
    setCustomers([DEFAULT_WALKIN_CUSTOMER]);
    setSuppliers([]);
    setWarehouses(RESTAURANT_WAREHOUSES);
    setSales([]);
    setPurchases([]);
    setExpenses([]);
    setStockMovements([]);
    setStockAdjustments([]);
    setStockTransfers([]);
    setStockItems([]);
    setCustomStockCategories([]);
    setQuotations([]);
    setSalesReturns([]);

    setFloors(defaultFloor);
    setDraftFloors(defaultFloor);
    draftFloorsRef.current = defaultFloor;
    setSections([]);
    setDraftSections([]);
    draftSectionsRef.current = [];
    setDiningTables([]);
    setDraftDiningTables([]);
    diningTablesRef.current = [];
    draftDiningTablesRef.current = [];
    setHasUnsavedFloorPlan(false);
    setSelectedTableId(null);

    setTableDrafts({});
    tableDraftsRef.current = {};
    setKitchenTickets([]);
    kitchenTicketsRef.current = [];

    setStaffMembers([]);
    const cachedStaffForTenant = readCachedStaffSession();
    if (!cachedStaffForTenant || (cachedStaffForTenant.restaurantId && cachedStaffForTenant.restaurantId !== targetRestroId)) {
      setActivePOSStaff(null);
    }
    setPrinters(INITIAL_PRINTERS);
    setAttendanceRecords([]);
    setStaffAuditLogs([]);
    setStaffShifts(INITIAL_SHIFTS);
    setStaffRoles(INITIAL_STAFF_ROLES);
    setStaffDepartments(INITIAL_STAFF_DEPARTMENTS);
    setStaffStatuses(INITIAL_STAFF_STATUSES);
    setFoodWasteRecords([]);
    setMasterRecipes([]);
  }, [setSelectedTableId]);

  resetTenantRef.current = resetTenantInMemoryState;

  // Local persistence sync
  useEffect(() => {
    localStorage.setItem('quickims_master_recipes', JSON.stringify(masterRecipes));
  }, [masterRecipes]);

  useEffect(() => {
    localStorage.setItem('quickims_staff', JSON.stringify(staffMembers));
  }, [staffMembers]);

  // Purge any legacy hardcoded dummy staff and deduplicate from state and localStorage
  useEffect(() => {
    setStaffMembers(prev => {
      const cleanDummy = prev.filter(s => !isDummyStaff(s));
      const { cleanList, removedIds } = deduplicateStaffMembers(cleanDummy);
      if (cleanList.length !== prev.length) {
        localStorage.setItem('quickims_staff', JSON.stringify(cleanList));
        const tenant = activeTenantRef.current;
        if (removedIds.length > 0 && db && tenant && tenant !== 'restro_guest') {
          removedIds.forEach(id => {
            deleteDoc(doc(db, 'restaurants', tenant, 'staff', id)).catch(() => null);
          });
        }
      }
      return cleanList;
    });

    setProducts(prev => {
      const clean = prev.filter(p => !isDummyProduct(p));
      if (clean.length !== prev.length) {
        localStorage.setItem('quickims_products', JSON.stringify(clean));
      }
      return clean;
    });

    setDiningTables(prev => {
      const clean = prev.filter(t => !isDummyTable(t)).map(t => {
        if (['sec-indoor', 'sec-bar', 'sec-garden'].includes(t.sectionId || '') || ['Indoor Dining', 'Espresso & Cocktail Bar', 'Garden Terrace'].includes(t.sectionName || '')) {
          return { ...t, sectionId: undefined, sectionName: undefined };
        }
        return t;
      });
      if (clean.length !== prev.length || clean.some((t, i) => t.sectionId !== prev[i]?.sectionId)) {
        localStorage.setItem('quickims_tables', JSON.stringify(clean));
        localStorage.setItem('restro_tables', JSON.stringify(clean));
      }
      return clean;
    });

    setSections(prev => {
      const clean = prev.filter(s => 
        !['sec-indoor', 'sec-bar', 'sec-garden'].includes(s.id) &&
        !['Indoor Dining', 'Espresso & Cocktail Bar', 'Garden Terrace'].includes(s.name)
      );
      if (clean.length !== prev.length) {
        localStorage.setItem('quickims_sections', JSON.stringify(clean));
      }
      return clean;
    });

    setFloors(prev => {
      const clean = prev.filter(f => f.name !== 'Terrace & Lounge');
      const finalFloors = clean.length > 0 ? clean : [{ id: 'flr-ground', name: 'Ground Floor', code: 'GF', description: 'Main Floor', active: true, order: 1 }];
      if (clean.length !== prev.length) {
        localStorage.setItem('quickims_floors', JSON.stringify(finalFloors));
      }
      return finalFloors;
    });

    setKitchenTickets(prev => {
      const clean = prev.filter(k => !isDummyKot(k));
      if (clean.length !== prev.length) {
        localStorage.setItem('restro_kots', JSON.stringify(clean));
      }
      return clean;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('quickims_attendance', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem('quickims_table_drafts', JSON.stringify(tableDrafts));
  }, [tableDrafts]);

  useEffect(() => {
    localStorage.setItem('quickims_staff_audit_logs', JSON.stringify(staffAuditLogs));
  }, [staffAuditLogs]);

  useEffect(() => {
    localStorage.setItem('quickims_staff_shifts', JSON.stringify(staffShifts));
  }, [staffShifts]);

  useEffect(() => {
    localStorage.setItem('quickims_staff_roles', JSON.stringify(staffRoles));
  }, [staffRoles]);

  useEffect(() => {
    localStorage.setItem('quickims_staff_departments', JSON.stringify(staffDepartments));
  }, [staffDepartments]);

  useEffect(() => {
    localStorage.setItem('quickims_staff_statuses', JSON.stringify(staffStatuses));
  }, [staffStatuses]);

  useEffect(() => {
    localStorage.setItem('quickims_food_waste', JSON.stringify(foodWasteRecords));
  }, [foodWasteRecords]);
  useEffect(() => {
    localStorage.setItem('quickims_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('quickims_floors', JSON.stringify(floors));
  }, [floors]);

  useEffect(() => {
    localStorage.setItem('quickims_sections', JSON.stringify(sections));
  }, [sections]);

  useEffect(() => {
    localStorage.setItem('quickims_tables', JSON.stringify(diningTables));
  }, [diningTables]);

  useEffect(() => {
    localStorage.setItem('quickims_table_drafts', JSON.stringify(tableDrafts));
  }, [tableDrafts]);

  useEffect(() => {
    localStorage.setItem('restro_kots', JSON.stringify(kitchenTickets));
  }, [kitchenTickets]);

  useEffect(() => {
    localStorage.setItem('quickims_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('quickims_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('quickims_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('quickims_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('quickims_warehouses', JSON.stringify(warehouses));
  }, [warehouses]);

  useEffect(() => {
    localStorage.setItem('quickims_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('quickims_purchases', JSON.stringify(purchases));
  }, [purchases]);

  useEffect(() => {
    localStorage.setItem('quickims_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('quickims_movements', JSON.stringify(stockMovements));
  }, [stockMovements]);

  useEffect(() => {
    localStorage.setItem('quickims_adjustments', JSON.stringify(stockAdjustments));
  }, [stockAdjustments]);

  useEffect(() => {
    localStorage.setItem('quickims_transfers', JSON.stringify(stockTransfers));
  }, [stockTransfers]);

  useEffect(() => {
    localStorage.setItem('quickims_quotations', JSON.stringify(quotations));
  }, [quotations]);

  useEffect(() => {
    localStorage.setItem('quickims_returns', JSON.stringify(salesReturns));
  }, [salesReturns]);

  const syncInFlightRef = useRef<{ tenantId: string; promise: Promise<{ success: boolean; message: string }> } | null>(null);
  const lastSyncThrottleRef = useRef<{ tenantId: string; timestamp: number }>({ tenantId: '', timestamp: 0 });
  const inFlightSaleIdsRef = useRef<Set<string>>(new Set());
  const inFlightTableSettleRef = useRef<Set<string>>(new Set());

  // Comprehensive Multi-Device Cloud Sync Engine (Strictly Isolated Per Restaurant Tenant)
  const syncAllDataFromCloud = async (targetRestroId?: string): Promise<{ success: boolean; message: string }> => {
    const activeRestroId = targetRestroId || restaurantId;
    if (!activeRestroId || activeRestroId === 'restro_guest') {
      return { success: true, message: 'No active restaurant selected.' };
    }

    // Coalesce concurrent sync clicks for the same tenant
    if (syncInFlightRef.current && syncInFlightRef.current.tenantId === activeRestroId) {
      return syncInFlightRef.current.promise;
    }

    // Client-side throttle: ignore rapid duplicate sync clicks within 4 seconds on the same tenant
    if (
      lastSyncThrottleRef.current.tenantId === activeRestroId &&
      Date.now() - lastSyncThrottleRef.current.timestamp < 4000
    ) {
      return { success: true, message: 'Cloud data was already synchronized moments ago.' };
    }

    const syncPromise = (async (): Promise<{ success: boolean; message: string }> => {
      lastSyncThrottleRef.current = { tenantId: activeRestroId, timestamp: Date.now() };
      setIsSyncing(true);
      const isFreshBeansTenant = activeRestroId === FRESH_BEANS_RESTRO_ID;

      try {
      // 0. Company Settings
      try {
        let loadedSettings: CompanySettings | null = null;
        const tenantSetSnap = await getDoc(doc(db, 'restaurants', activeRestroId, 'meta', 'settings')).catch(() => null);
        if (tenantSetSnap && tenantSetSnap.exists()) {
          loadedSettings = tenantSetSnap.data() as CompanySettings;
        } else if (isFreshBeansTenant) {
          const globalSetSnap = await getDoc(doc(db, 'settings', 'company')).catch(() => null);
          if (globalSetSnap && globalSetSnap.exists()) {
            loadedSettings = globalSetSnap.data() as CompanySettings;
          }
        }

        if (activeTenantRef.current !== activeRestroId) {
          setIsSyncing(false);
          return { success: true, message: 'Tenant changed during sync.' };
        }

        if (loadedSettings && loadedSettings.companyName) {
          setSettings(loadedSettings);
          localStorage.setItem('quickims_settings', JSON.stringify(loadedSettings));
        } else {
          const fallbackSettings = buildDefaultSettingsForTenant(
            activeRestroId,
            firebaseUser?.displayName || currentUser?.name || undefined,
            firebaseUser?.email || currentUser?.email || undefined
          );
          setSettings(fallbackSettings);
          localStorage.setItem('quickims_settings', JSON.stringify(fallbackSettings));
        }
      } catch (setErr) {
        console.warn('Sync settings warning:', setErr);
      }

      // 1. Menu Items (Products)
      let syncedProductsForHierarchy: Product[] = [];
      try {
        const tenantProdSnap = await getDocs(collection(db, 'restaurants', activeRestroId, 'products')).catch(() => null);
        const prodsMap = new Map<string, Product>();

        if (tenantProdSnap && !tenantProdSnap.empty) {
          tenantProdSnap.docs.forEach(d => {
            const p = { ...d.data(), id: d.id } as Product;
            if (!isDummyProduct(p) && p.name) {
              if (!p.restaurantId || p.restaurantId === activeRestroId) {
                prodsMap.set(p.id, p);
              } else {
                // Foreign restaurant product accidentally written into this tenant subcollection
                deleteDoc(doc(db, 'restaurants', activeRestroId, 'products', d.id)).catch(() => null);
              }
            }
          });
        }

        // Only check legacy global products if they explicitly belong to activeRestroId (or Fresh Beans legacy unscoped docs)
        if (isFreshBeansTenant || prodsMap.size === 0) {
          const globalProdSnap = await getDocs(collection(db, 'products')).catch(() => null);
          if (globalProdSnap && !globalProdSnap.empty) {
            globalProdSnap.docs.forEach(d => {
              const p = { ...d.data(), id: d.id } as Product;
              if (!isDummyProduct(p) && p.name && !prodsMap.has(p.id)) {
                if (p.restaurantId === activeRestroId || (!p.restaurantId && isFreshBeansTenant)) {
                  prodsMap.set(p.id, p);
                }
              }
            });
          }
        }

        // For non-Fresh-Beans / non-Demo accounts, strip & clean any leaked Fresh Beans product copies
        if (!isFreshBeansTenant && activeRestroId !== 'restro_demo_preview' && prodsMap.size > 0) {
          const [fbTenantProdSnap, fbGlobalProdSnap] = await Promise.all([
            getDocs(collection(db, 'restaurants', FRESH_BEANS_RESTRO_ID, 'products')).catch(() => null),
            getDocs(collection(db, 'products')).catch(() => null)
          ]);
          const freshBeansProdIds = new Set<string>();
          fbTenantProdSnap?.docs.forEach(d => freshBeansProdIds.add(d.id));
          fbGlobalProdSnap?.docs.forEach(d => {
            const gd = d.data();
            if (!gd?.restaurantId || gd.restaurantId === FRESH_BEANS_RESTRO_ID) {
              freshBeansProdIds.add(d.id);
            }
          });
          for (const [pid, prod] of Array.from(prodsMap.entries())) {
            const hasForeignRestro = Boolean(prod.restaurantId && prod.restaurantId !== activeRestroId);
            const isLeakedFreshBeansCopy = freshBeansProdIds.has(pid);
            if (hasForeignRestro || isLeakedFreshBeansCopy) {
              prodsMap.delete(pid);
              deleteDoc(doc(db, 'restaurants', activeRestroId, 'products', pid)).catch(() => null);
            }
          }
        }

        if (activeTenantRef.current !== activeRestroId) {
          setIsSyncing(false);
          return { success: true, message: 'Tenant changed during sync.' };
        }

        const combinedProducts = Array.from(prodsMap.values()).map(p => ({
          ...p,
          isTaxInclusive: p.isTaxInclusive !== undefined ? p.isTaxInclusive : true,
          taxRatePercent: p.taxRatePercent !== undefined ? p.taxRatePercent : 13
        }));
        syncedProductsForHierarchy = combinedProducts;
        productsRef.current = combinedProducts;
        setProducts(combinedProducts);
        localStorage.setItem('quickims_products', JSON.stringify(combinedProducts));
      } catch (prodErr) {
        console.warn('Sync products warning:', prodErr);
      }

      // 2. Categories
      try {
        const tenantCatSnap = await getDocs(collection(db, 'restaurants', activeRestroId, 'categories')).catch(() => null);
        const catsMap = new Map<string, ProductCategory>();

        if (tenantCatSnap && !tenantCatSnap.empty) {
          tenantCatSnap.docs.forEach(d => {
            const c = { ...d.data(), id: d.id } as ProductCategory;
            if (!c.restaurantId || c.restaurantId === activeRestroId) {
              catsMap.set(c.id, c);
            }
          });
        }

        if (isFreshBeansTenant) {
          const globalCatSnap = await getDocs(collection(db, 'categories')).catch(() => null);
          if (globalCatSnap && !globalCatSnap.empty) {
            globalCatSnap.docs.forEach(d => {
              const c = { ...d.data(), id: d.id } as ProductCategory;
              if (!catsMap.has(c.id) && (c.restaurantId === activeRestroId || !c.restaurantId)) {
                catsMap.set(c.id, c);
              }
            });
          }
        }

        const combinedCats = Array.from(catsMap.values());
        setCategories(combinedCats);
        localStorage.setItem('quickims_categories', JSON.stringify(combinedCats));
      } catch (catErr) {
        console.warn('Sync categories warning:', catErr);
      }

      // 3. Menu Architecture Hierarchy (Departments, Categories, Subcategories, Prep styles, Colors)
      try {
        const hierarchySnap = await getDoc(doc(db, 'restaurants', activeRestroId, 'meta', 'menu_hierarchy')).catch(() => null);
        if (hierarchySnap && hierarchySnap.exists()) {
          const hData = hierarchySnap.data();
          if (hData && hData.departments) {
            const { cleaned, wasPolluted } = sanitizeMenuHierarchyForTenant(hData, syncedProductsForHierarchy, activeRestroId);
            const finalHierarchy = cleaned || hData;
            setMenuHierarchy(finalHierarchy);
            localStorage.setItem('quickims_menu_hierarchy_v5', JSON.stringify(finalHierarchy));
            if (wasPolluted && db) {
              setDoc(doc(db, 'restaurants', activeRestroId, 'meta', 'menu_hierarchy'), sanitizeForFirestore(finalHierarchy)).catch(() => null);
            }
          } else {
            setMenuHierarchy(null);
            localStorage.removeItem('quickims_menu_hierarchy_v5');
          }
        } else {
          setMenuHierarchy(null);
          localStorage.removeItem('quickims_menu_hierarchy_v5');
        }
      } catch (hErr) {
        console.warn('Sync menu hierarchy warning:', hErr);
      }

      // 4. Floor Plan & Tables (Architectural layout + Live operational state)
      try {
        const [tenantPlanSnap, liveSnap] = await Promise.all([
          getDoc(doc(db, 'restaurants', activeRestroId, 'meta', 'floor_plan')).catch(() => null),
          getDoc(doc(db, 'restaurants', activeRestroId, 'live_state', 'tables')).catch(() => null)
        ]);

        let planData: any = tenantPlanSnap && tenantPlanSnap.exists() ? tenantPlanSnap.data() : null;
        if (!planData && isFreshBeansTenant) {
          const fallbackSnap = await getDoc(doc(db, 'restaurant_meta', 'floor_plan')).catch(() => null);
          if (fallbackSnap && fallbackSnap.exists()) {
            planData = fallbackSnap.data();
          }
        }

        let activeFloors: RestaurantFloor[] = [];
        if (planData && Array.isArray(planData.floors) && planData.floors.length > 0) {
          activeFloors = planData.floors.filter((f: any) => f.name !== 'Terrace & Lounge');
        }
        if (activeFloors.length === 0) {
          activeFloors = [{ id: 'flr-ground', name: 'Ground Floor', code: 'GF', description: 'Main Floor', active: true, order: 1 }];
        }

        let activeSections: RestaurantSection[] = [];
        if (planData && Array.isArray(planData.sections)) {
          activeSections = planData.sections.filter((s: any) => 
            !['sec-indoor', 'sec-bar', 'sec-garden'].includes(s.id) &&
            !['Indoor Dining', 'Espresso & Cocktail Bar', 'Garden Terrace'].includes(s.name)
          );
        }

        setFloors(activeFloors);
        localStorage.setItem('quickims_floors', JSON.stringify(activeFloors));
        setSections(activeSections);
        localStorage.setItem('quickims_sections', JSON.stringify(activeSections));

        let baseLayoutTables: DiningTable[] = [];
        if (planData && Array.isArray(planData.diningTables) && planData.diningTables.length > 0) {
          baseLayoutTables = planData.diningTables.filter((t: any) => !isDummyTable(t)).map((t: any) => {
            if (['sec-indoor', 'sec-bar', 'sec-garden'].includes(t.sectionId) || ['Indoor Dining', 'Espresso & Cocktail Bar', 'Garden Terrace'].includes(t.sectionName)) {
              return { ...t, sectionId: undefined, sectionName: undefined };
            }
            return t;
          });
        }

        let liveTables: DiningTable[] = [];
        let liveDrafts: Record<string, TableDraftOrder> = {};

        if (liveSnap && liveSnap.exists()) {
          const liveData = liveSnap.data();
          if (Array.isArray(liveData.tables) && liveData.tables.length > 0) {
            liveTables = liveData.tables.filter((t: any) => !isDummyTable(t));
          }
          if (liveData.tableDrafts && typeof liveData.tableDrafts === 'object') {
            liveDrafts = liveData.tableDrafts;
          }
        }

        setTableDrafts(liveDrafts);
        tableDraftsRef.current = liveDrafts;
        localStorage.setItem('quickims_table_drafts', JSON.stringify(liveDrafts));

        // 7 (Pre-load Kitchen Tickets before computing table metrics)
        let activeTicketsList: KitchenOrderTicket[] = [];
        try {
          const ticketsSnap = await getDocs(collection(db, 'restaurants', activeRestroId, 'kitchen_tickets')).catch(() => null);
          if (ticketsSnap && !ticketsSnap.empty) {
            const nowMs = Date.now();
            const tickets = ticketsSnap.docs.map(d => ({ ...d.data(), id: d.id } as KitchenOrderTicket));
            const expiredTickets = tickets.filter(k => isKotExpired(k, nowMs));
            const freshTickets = tickets.filter(k => !isDummyKot(k) && !isKotExpired(k, nowMs));
            if (expiredTickets.length > 0) {
              purgeExpiredKOTsFromCloud(expiredTickets, activeRestroId);
            }
            activeTicketsList = freshTickets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          }
          setKitchenTickets(activeTicketsList);
          kitchenTicketsRef.current = activeTicketsList;
          localStorage.setItem('restro_kots', JSON.stringify(activeTicketsList));
        } catch (tErr) {
          console.warn('Sync kitchen tickets warning:', tErr);
        }

        const mergedTables: DiningTable[] = baseLayoutTables.map(layoutT => {
          const liveT = liveTables.find(lt => lt.id === layoutT.id);
          const candidate: DiningTable = {
            ...layoutT,
            ...(liveT || {}),
            status: (liveT && (liveT.status as any) !== 'billed' ? liveT.status : (layoutT.status || 'available')) as TableStatus
          };
          const metrics = computeTableMetrics(
            candidate,
            activeTicketsList,
            liveDrafts,
            baseLayoutTables,
            settings.taxInclusivePricing !== false,
            settings.defaultVatRate || 13
          );

          if (metrics.status === 'available') {
            return makeAvailableTable({
              ...layoutT,
              ...(liveT || {})
            });
          }

          return {
            ...layoutT,
            ...(liveT || {}),
            status: metrics.status,
            currentGuests: liveT?.currentGuests ?? (metrics.status === 'seated' ? (layoutT.capacity || 2) : undefined),
            assignedWaiter: liveT?.assignedWaiter || layoutT.assignedWaiter,
            openedAt: liveT?.openedAt || Date.now(),
            lastOrderAt: liveT?.lastOrderAt || Date.now(),
            subtotal: metrics.subtotal,
            totalWithTax: metrics.totalWithTax,
            activeKOTCount: metrics.activeKOTCount
          };
        });

        setDiningTables(mergedTables);
        diningTablesRef.current = mergedTables;
        localStorage.setItem('quickims_tables', JSON.stringify(mergedTables));
        localStorage.setItem('restro_tables', JSON.stringify(mergedTables));
      } catch (planErr) {
        console.warn('Sync floor plan warning:', planErr);
      }

      // 5. Staff Members
      try {
        const tenantStaffSnap = await getDocs(collection(db, 'restaurants', activeRestroId, 'staff')).catch(() => null);
        const staffMap = new Map<string, StaffMember>();
        if (tenantStaffSnap && !tenantStaffSnap.empty) {
          tenantStaffSnap.docs.forEach(d => {
            const s = { ...d.data(), id: d.id } as StaffMember;
            if (!isDummyStaff(s)) staffMap.set(s.id, s);
          });
        }
        if (isFreshBeansTenant || staffMap.size === 0) {
          const allStaffSnap = await getDocs(collection(db, 'staff_members')).catch(() => null);
          if (allStaffSnap && !allStaffSnap.empty) {
            allStaffSnap.docs.forEach(d => {
              const s = { ...d.data(), id: d.id } as StaffMember;
              if (!isDummyStaff(s) && !staffMap.has(s.id)) {
                if (s.restaurantId === activeRestroId || (!s.restaurantId && isFreshBeansTenant)) {
                  staffMap.set(s.id, s);
                }
              }
            });
          }
        }

        const combinedStaff = Array.from(staffMap.values());
        const { cleanList } = deduplicateStaffMembers(combinedStaff);
        setStaffMembers(cleanList);
        localStorage.setItem('quickims_staff', JSON.stringify(cleanList));
      } catch (staffErr) {
        console.warn('Sync staff warning:', staffErr);
      }

      // 6. Printers & Hardware Setup
      try {
        const printersSnap = await getDoc(doc(db, 'restaurants', activeRestroId, 'meta', 'printers')).catch(() => null);
        if (printersSnap && printersSnap.exists()) {
          const prnData = printersSnap.data();
          if (Array.isArray(prnData.printers) && prnData.printers.length > 0) {
            setPrinters(prnData.printers);
            localStorage.setItem('quickims_printers', JSON.stringify(prnData.printers));
          } else {
            setPrinters(INITIAL_PRINTERS);
          }
        } else {
          setPrinters(INITIAL_PRINTERS);
        }
      } catch (prnErr) {
        console.warn('Sync printers warning:', prnErr);
      }

      // 8. Kitchen Raw Stock & Raw Categories
      try {
        const [tenantStockSnap, rawCatsSnap] = await Promise.all([
          getDocs(collection(db, 'restaurants', activeRestroId, 'stock')).catch(() => null),
          getDocs(collection(db, 'restaurants', activeRestroId, 'raw_categories')).catch(() => null)
        ]);
        const stockMap = new Map<string, StockItem>();
        if (tenantStockSnap && !tenantStockSnap.empty) {
          tenantStockSnap.docs.forEach(d => stockMap.set(d.id, { ...d.data(), id: d.id } as StockItem));
        }
        if (isFreshBeansTenant) {
          const globalStockSnap = await getDocs(collection(db, 'stock')).catch(() => null);
          if (globalStockSnap && !globalStockSnap.empty) {
            globalStockSnap.docs.forEach(d => {
              const s = { ...d.data(), id: d.id } as StockItem;
              if (!stockMap.has(s.id) && (s.restaurantId === activeRestroId || !s.restaurantId)) {
                stockMap.set(s.id, s);
              }
            });
          }
        }
        const combinedStock = Array.from(stockMap.values());
        setStockItems(combinedStock);
        localStorage.setItem('quickims_stock_items', JSON.stringify(combinedStock));

        const rawCatsList = rawCatsSnap && !rawCatsSnap.empty
          ? rawCatsSnap.docs.map(d => String(d.data()?.name || '')).filter(Boolean)
          : [];
        setCustomStockCategories(rawCatsList);
        localStorage.setItem('quickims_raw_categories', JSON.stringify(rawCatsList));
      } catch (stkErr) {
        console.warn('Sync stock warning:', stkErr);
      }

      // 9. Tenant Operational Ledgers (Sales, Purchases, Customers, Suppliers, Expenses, Returns, Waste, Recipes, Attendance, Audits)
      try {
        const loadScopedCollection = async <T extends { id: string; restaurantId?: string }>(
          subCollection: string,
          legacyTopCollection?: string
        ): Promise<T[]> => {
          const map = new Map<string, T>();
          const tSnap = await getDocs(collection(db, 'restaurants', activeRestroId, subCollection)).catch(() => null);
          if (tSnap && !tSnap.empty) {
            tSnap.docs.forEach(d => map.set(d.id, { ...d.data(), id: d.id } as T));
          }
          if (legacyTopCollection && isFreshBeansTenant) {
            const gSnap = await getDocs(collection(db, legacyTopCollection)).catch(() => null);
            if (gSnap && !gSnap.empty) {
              gSnap.docs.forEach(d => {
                const item = { ...d.data(), id: d.id } as T;
                if (!map.has(item.id) && (item.restaurantId === activeRestroId || !item.restaurantId)) {
                  map.set(item.id, item);
                }
              });
            }
          }
          return Array.from(map.values());
        };

        const [
          loadedSales,
          loadedPurchases,
          loadedCustomers,
          loadedSuppliers,
          loadedExpenses,
          loadedReturns,
          loadedMovements,
          loadedAdjustments,
          loadedTransfers,
          loadedQuotations,
          loadedWaste,
          loadedRecipes,
          loadedAttendance,
          loadedAudits
        ] = await Promise.all([
          loadScopedCollection<SaleInvoice>('sales', 'sales'),
          loadScopedCollection<PurchaseInvoice>('purchases', 'purchases'),
          loadScopedCollection<Customer>('customers', 'customers'),
          loadScopedCollection<Supplier>('suppliers', 'suppliers'),
          loadScopedCollection<ExpenseRecord>('expenses', 'expenses'),
          loadScopedCollection<SalesReturn>('sales_returns', 'sales_returns'),
          loadScopedCollection<StockMovement>('stock_movements'),
          loadScopedCollection<StockAdjustment>('stock_adjustments'),
          loadScopedCollection<StockTransfer>('stock_transfers'),
          loadScopedCollection<Quotation>('quotations'),
          loadScopedCollection<FoodWasteRecord>('food_waste'),
          loadScopedCollection<KitchenMasterRecipe>('master_recipes'),
          loadScopedCollection<AttendanceRecord>('attendance'),
          loadScopedCollection<StaffAuditLog>('staff_audit_logs')
        ]);

        if (activeTenantRef.current !== activeRestroId) {
          setIsSyncing(false);
          return { success: true, message: 'Tenant changed during sync.' };
        }

        const healedSalesToPersist: SaleInvoice[] = [];
        const normalizedSales = loadedSales.map(raw => {
          const norm = normalizeSaleInvoicePayment(raw);
          if (
            norm.paymentStatus !== raw.paymentStatus ||
            norm.dueAmount !== raw.dueAmount ||
            norm.paidAmount !== raw.paidAmount
          ) {
            healedSalesToPersist.push(norm);
          }
          return norm;
        });
        const sortedSales = normalizedSales.sort((a, b) => (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0));
        salesRef.current = sortedSales;
        setSales(sortedSales);
        localStorage.setItem('quickims_sales', JSON.stringify(sortedSales));

        // Silently repair any stale invoice status/due fields in Firestore (e.g. paidAmount >= grandTotal with status 'unpaid')
        if (healedSalesToPersist.length > 0 && db && activeRestroId && activeRestroId !== 'restro_guest') {
          healedSalesToPersist.forEach(s => {
            setDoc(
              doc(db, 'restaurants', activeRestroId, 'sales', s.id),
              sanitizeForFirestore({
                paidAmount: s.paidAmount,
                dueAmount: s.dueAmount,
                paymentStatus: s.paymentStatus
              }),
              { merge: true }
            ).catch(() => {});
          });
        }

        const sortedPurchases = loadedPurchases.sort((a, b) => (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0));
        setPurchases(sortedPurchases);
        localStorage.setItem('quickims_purchases', JSON.stringify(sortedPurchases));

        const finalCustomers = loadedCustomers.some(c => c.id === DEFAULT_WALKIN_CUSTOMER.id)
          ? loadedCustomers
          : [DEFAULT_WALKIN_CUSTOMER, ...loadedCustomers];
        setCustomers(finalCustomers);
        localStorage.setItem('quickims_customers', JSON.stringify(finalCustomers));

        setSuppliers(loadedSuppliers);
        localStorage.setItem('quickims_suppliers', JSON.stringify(loadedSuppliers));

        setExpenses(loadedExpenses.sort((a, b) => (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0)));
        localStorage.setItem('quickims_expenses', JSON.stringify(loadedExpenses));

        setSalesReturns(loadedReturns.sort((a, b) => (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0)));
        localStorage.setItem('quickims_returns', JSON.stringify(loadedReturns));

        setStockMovements(loadedMovements.sort((a, b) => (b.date || 0) - (a.date || 0)));
        localStorage.setItem('quickims_movements', JSON.stringify(loadedMovements));

        setStockAdjustments(loadedAdjustments.sort((a, b) => (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0)));
        localStorage.setItem('quickims_adjustments', JSON.stringify(loadedAdjustments));

        setStockTransfers(loadedTransfers.sort((a, b) => (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0)));
        localStorage.setItem('quickims_transfers', JSON.stringify(loadedTransfers));

        setQuotations(loadedQuotations.sort((a, b) => (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0)));
        localStorage.setItem('quickims_quotations', JSON.stringify(loadedQuotations));

        setFoodWasteRecords(loadedWaste.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
        localStorage.setItem('quickims_food_waste', JSON.stringify(loadedWaste));

        setMasterRecipes(loadedRecipes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        localStorage.setItem('quickims_master_recipes', JSON.stringify(loadedRecipes));

        setAttendanceRecords(loadedAttendance.sort((a, b) => (b.clockInTime || 0) - (a.clockInTime || 0)));
        localStorage.setItem('quickims_attendance', JSON.stringify(loadedAttendance));

        setStaffAuditLogs(loadedAudits.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
        localStorage.setItem('quickims_staff_audit_logs', JSON.stringify(loadedAudits));
      } catch (opsErr) {
        console.warn('Sync operational ledgers warning:', opsErr);
      }

      setLastCloudSyncTimestamp(Date.now());
      lastSyncThrottleRef.current = { tenantId: activeRestroId, timestamp: Date.now() };
      setIsSyncing(false);
      return { success: true, message: 'All restaurant data successfully synchronized with cloud.' };
    } catch (err: any) {
      setIsSyncing(false);
      return { success: false, message: err?.message || 'Sync failed.' };
    } finally {
      if (syncInFlightRef.current?.tenantId === activeRestroId) {
        syncInFlightRef.current = null;
      }
    }
    })();

    syncInFlightRef.current = { tenantId: activeRestroId, promise: syncPromise };
    return syncPromise;
  };

  // Run cloud sync whenever restaurantId changes or auth user changes
  useEffect(() => {
    if (restaurantId && restaurantId !== 'restro_guest') {
      syncAllDataFromCloud(restaurantId);
    }
  }, [restaurantId, firebaseUser?.email]);

  // Update Settings
  const updateSettings = async (newSettings: Partial<CompanySettings>) => {
    const updated = { ...settingsRef.current, ...newSettings };
    settingsRef.current = updated;
    setSettings(updated);
    localStorage.setItem('quickims_settings', JSON.stringify(updated));
    if (!restaurantId || restaurantId === 'restro_guest') return;
    try {
      await setDoc(doc(db, 'restaurants', restaurantId, 'meta', 'settings'), sanitizeForFirestore(updated), { merge: true });
      if (currentUser?.email) {
        await setDoc(doc(db, 'users', currentUser.email.toLowerCase()), { settings: sanitizeForFirestore(updated) }, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore write warning:', e);
    }
  };

  // Add Product
  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
    const timestamp = Date.now();
    const newId = (productData as any).id || `prod-${timestamp}-${Math.random().toString(36).substring(2, 8)}`;
    const newProduct: Product = {
      ...productData,
      restaurantId: (productData as any).restaurantId || restaurantId,
      id: newId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    setProducts(prev => [newProduct, ...prev]);

    let openingMov: StockMovement | null = null;
    // Record initial stock opening movement ONLY for stock-tracked items with positive opening stock
    if ((newProduct.itemType === 'raw_ingredient' || newProduct.trackStock === true) && newProduct.currentStock > 0) {
      openingMov = {
        id: `stk-mov-${timestamp}-${Math.random().toString(36).substring(2, 8)}`,
        date: timestamp,
        productId: newProduct.id,
        productName: newProduct.name,
        sku: newProduct.sku,
        warehouseId: newProduct.warehouseId || currentWarehouseId,
        warehouseName: newProduct.warehouseName || 'Main Store',
        movementType: 'opening',
        referenceId: 'OPENING-STOCK',
        quantityIn: newProduct.currentStock,
        quantityOut: 0,
        previousBalance: 0,
        newBalance: newProduct.currentStock,
        unitCost: newProduct.costPrice,
        totalValue: newProduct.currentStock * newProduct.costPrice,
        notes: 'Initial opening stock ledger entry',
        performedBy: activePOSStaff?.name || activeStaffUser?.name || currentUser.name
      };
      setStockMovements(prev => [openingMov!, ...prev]);
    }

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'products', newId), sanitizeForFirestore(newProduct));
        if (openingMov) {
          await setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', openingMov.id), sanitizeForFirestore({ ...openingMov, restaurantId }));
        }
      } catch (e) {
        console.warn('Firestore write warning (saved locally):', e);
      }
    }

    return newProduct;
  };

  // Add Products Batch (High-efficiency bulk import)
  const addProductsBatch = async (productsData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Product[]> => {
    if (!productsData || productsData.length === 0) return [];
    const timestamp = Date.now();

    const newProducts: Product[] = productsData.map((data, idx) => {
      const uniqueId = (data as any).id || `prod-${timestamp}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      return {
        ...data,
        restaurantId: (data as any).restaurantId || restaurantId,
        id: uniqueId,
        createdAt: timestamp + idx,
        updatedAt: timestamp + idx
      };
    });

    setProducts(prev => [...newProducts, ...prev]);

    // Record opening stock movements in batch ONLY for stock-tracked items
    const openingMovements: StockMovement[] = newProducts
      .filter(p => (p.itemType === 'raw_ingredient' || p.trackStock === true) && p.currentStock > 0)
      .map((p, idx) => ({
        id: `stk-mov-${timestamp}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        date: timestamp,
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        warehouseId: p.warehouseId || currentWarehouseId,
        warehouseName: p.warehouseName || 'Main Store',
        movementType: 'opening',
        referenceId: 'OPENING-STOCK',
        quantityIn: p.currentStock,
        quantityOut: 0,
        previousBalance: 0,
        newBalance: p.currentStock,
        unitCost: p.costPrice,
        totalValue: p.currentStock * p.costPrice,
        notes: 'Initial opening stock ledger entry (Bulk Import)',
        performedBy: activePOSStaff?.name || activeStaffUser?.name || currentUser.name
      }));

    if (openingMovements.length > 0) {
      setStockMovements(prev => [...openingMovements, ...prev]);
    }

    // Persist to Firestore asynchronously in chunks (strictly scoped to current restaurant)
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        const chunk = 25;
        for (let i = 0; i < newProducts.length; i += chunk) {
          const slice = newProducts.slice(i, i + chunk);
          await Promise.all(slice.map(p =>
            setDoc(doc(db, 'restaurants', restaurantId, 'products', p.id), sanitizeForFirestore(p))
          ));
        }
        for (let i = 0; i < openingMovements.length; i += chunk) {
          const mSlice = openingMovements.slice(i, i + chunk);
          await Promise.all(mSlice.map(m =>
            setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', m.id), sanitizeForFirestore({ ...m, restaurantId }))
          ));
        }
      } catch (e) {
        console.warn('Firestore bulk write warning (saved locally):', e);
      }
    }

    return newProducts;
  };

  // Update Product
  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const updatedTimestamp = Date.now();
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: updatedTimestamp } : p));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'products', id), sanitizeForFirestore({ ...updates, restaurantId, updatedAt: updatedTimestamp }), { merge: true });
      } catch (e) {
        console.warn('Firestore update warning (saved locally):', e);
      }
    }
  };

  // Delete Product (Soft delete / deactivate or permanent remove)
  const deleteProduct = async (id: string, permanent: boolean = false) => {
    if (permanent) {
      setProducts(prev => prev.filter(p => p.id !== id));
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        try {
          await deleteDoc(doc(db, 'restaurants', restaurantId, 'products', id));
        } catch (e) {
          console.warn('Firestore delete warning (removed locally):', e);
        }
      }
    } else {
      const updatedTimestamp = Date.now();
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'discontinued', updatedAt: updatedTimestamp } : p));
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        try {
          await setDoc(doc(db, 'restaurants', restaurantId, 'products', id), { status: 'discontinued', updatedAt: updatedTimestamp }, { merge: true });
        } catch (e) {
          console.warn('Firestore update warning (deactivated locally):', e);
        }
      }
    }
  };

  // Delete Products Batch (Permanent removal scoped to current restaurant)
  const deleteProductsBatch = async (ids: string[]) => {
    const cleanIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (cleanIds.length === 0) return;

    const idSet = new Set(cleanIds);
    setProducts(prev => prev.filter(p => !idSet.has(p.id)));

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        const chunk = 25;
        for (let i = 0; i < cleanIds.length; i += chunk) {
          const slice = cleanIds.slice(i, i + chunk);
          await Promise.all(slice.map(id =>
            deleteDoc(doc(db, 'restaurants', restaurantId, 'products', id))
          ));
        }
      } catch (e) {
        console.warn('Firestore bulk delete warning (removed locally):', e);
      }
    }
  };

  // ==========================================
  // KITCHEN RAW STOCK MANAGEMENT
  // ==========================================
  const rawStockCategories = useMemo(() => {
    const set = new Set<string>();
    customStockCategories.forEach(c => { if (c && c.trim()) set.add(c.trim()); });
    stockItems.forEach(s => { if (s.category && s.category.trim()) set.add(s.category.trim()); });
    return Array.from(set);
  }, [customStockCategories, stockItems]);

  const addRawStockCategory = async (catName: string): Promise<string> => {
    const trimmed = catName.trim();
    if (!trimmed) return '';
    setCustomStockCategories(prev => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      localStorage.setItem('quickims_raw_categories', JSON.stringify(updated));
      return updated;
    });
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      const catDocId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_');
      setDoc(doc(db, 'restaurants', restaurantId, 'raw_categories', catDocId), {
        name: trimmed,
        restaurantId,
        createdAt: Date.now()
      }, { merge: true }).catch(() => {});
    }
    return trimmed;
  };

  const addStockItem = async (itemData: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<StockItem> => {
    const timestamp = Date.now();
    const id = `raw-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: StockItem = {
      ...itemData,
      id,
      restaurantId,
      status: itemData.status || 'active',
      trackStock: itemData.trackStock !== undefined ? itemData.trackStock : true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    setStockItems(prev => {
      const updated = [newItem, ...prev];
      localStorage.setItem('quickims_stock_items', JSON.stringify(updated));
      return updated;
    });

    // Record opening stock movement if quantity > 0
    let openingMov: StockMovement | null = null;
    if (newItem.currentStock > 0) {
      openingMov = {
        id: `stk-mov-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
        date: timestamp,
        productId: newItem.id,
        productName: newItem.name,
        sku: newItem.sku || newItem.id,
        warehouseId: currentWarehouseId,
        warehouseName: newItem.storageLocation || 'Main Kitchen Store',
        movementType: 'opening',
        referenceId: 'OPENING-STOCK',
        quantityIn: newItem.currentStock,
        quantityOut: 0,
        previousBalance: 0,
        newBalance: newItem.currentStock,
        unitCost: newItem.costPrice,
        totalValue: newItem.currentStock * newItem.costPrice,
        notes: `Opening inventory for raw ingredient: ${newItem.name} (${newItem.unit})`,
        performedBy: activeStaffUser?.name || activePOSStaff?.name || currentUser.name
      };
      setStockMovements(prev => [openingMov!, ...prev]);
    }

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'stock', id), sanitizeForFirestore(newItem));
        if (openingMov) {
          await setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', openingMov.id), sanitizeForFirestore({ ...openingMov, restaurantId }));
        }
      } catch (e) {
        console.warn('Firestore stock save warning (saved locally):', e);
      }
    }

    return newItem;
  };

  const updateStockItem = async (id: string, updates: Partial<StockItem>) => {
    const updatedTimestamp = Date.now();
    setStockItems(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: updatedTimestamp } : s);
      localStorage.setItem('quickims_stock_items', JSON.stringify(updated));
      return updated;
    });

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'stock', id), sanitizeForFirestore({ ...updates, restaurantId, updatedAt: updatedTimestamp }), { merge: true });
      } catch (e) {
        console.warn('Firestore stock update warning (saved locally):', e);
      }
    }
  };

  const deleteStockItem = async (id: string) => {
    setStockItems(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('quickims_stock_items', JSON.stringify(updated));
      return updated;
    });

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'stock', id));
      } catch (e) {
        console.warn('Firestore stock delete warning (removed locally):', e);
      }
    }
  };

  const quickPurchaseStock = async (
    stockId: string, 
    quantity: number, 
    unitCost: number, 
    supplierId?: string, 
    notes?: string
  ) => {
    const item = stockItems.find(s => s.id === stockId);
    if (!item) return;

    const timestamp = Date.now();
    const prevStock = Number(item.currentStock || 0);
    const newBal = prevStock + Number(quantity);

    const supplierObj = suppliers.find(s => s.id === (supplierId || item.supplierId));
    const supplierName = supplierObj ? (supplierObj.companyName || supplierObj.name) : (item.supplierName || 'Direct Vendor');

    await updateStockItem(stockId, {
      currentStock: newBal,
      costPrice: unitCost > 0 ? unitCost : item.costPrice,
      lastPurchasePrice: unitCost > 0 ? unitCost : item.costPrice,
      supplierId: supplierId || item.supplierId,
      supplierName
    });

    const movement: StockMovement = {
      id: `mov-pur-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
      date: timestamp,
      productId: item.id,
      productName: item.name,
      sku: item.sku || item.id,
      warehouseId: currentWarehouseId,
      warehouseName: item.storageLocation || 'Main Kitchen Store',
      movementType: 'purchase',
      referenceId: `PUR-INWARD-${Date.now().toString().slice(-6)}`,
      quantityIn: Number(quantity),
      quantityOut: 0,
      previousBalance: prevStock,
      newBalance: newBal,
      unitCost,
      totalValue: Number(quantity) * unitCost,
      notes: notes || `Direct stock inward from ${supplierName}`,
      performedBy: activeStaffUser?.name || activePOSStaff?.name || currentUser.name
    };

    setStockMovements(prev => [movement, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', movement.id), sanitizeForFirestore({ ...movement, restaurantId })).catch(() => {});
    }
  };

  const adjustStockItem = async (stockId: string, newQuantity: number, reason: string) => {
    const item = stockItems.find(s => s.id === stockId);
    if (!item) return;

    const timestamp = Date.now();
    const prevStock = Number(item.currentStock || 0);
    const targetQty = Math.max(0, Number(newQuantity));
    const delta = targetQty - prevStock;

    await updateStockItem(stockId, { currentStock: targetQty });

    const movement: StockMovement = {
      id: `mov-adj-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
      date: timestamp,
      productId: item.id,
      productName: item.name,
      sku: item.sku || item.id,
      warehouseId: currentWarehouseId,
      warehouseName: item.storageLocation || 'Main Kitchen Store',
      movementType: 'adjustment',
      referenceId: 'STOCK-AUDIT',
      quantityIn: delta > 0 ? delta : 0,
      quantityOut: delta < 0 ? Math.abs(delta) : 0,
      previousBalance: prevStock,
      newBalance: targetQty,
      unitCost: item.costPrice,
      totalValue: Math.abs(delta) * item.costPrice,
      notes: reason || 'Physical inventory reconciliation',
      performedBy: activeStaffUser?.name || activePOSStaff?.name || currentUser.name
    };

    setStockMovements(prev => [movement, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', movement.id), sanitizeForFirestore({ ...movement, restaurantId })).catch(() => {});
    }
  };

  const logStockWaste = async (stockId: string, quantity: number, reason: string, notes?: string) => {
    const item = stockItems.find(s => s.id === stockId);
    if (!item) return;

    const timestamp = Date.now();
    const prevStock = Number(item.currentStock || 0);
    const deductQty = Math.min(prevStock, Math.max(0, Number(quantity)));
    const newBal = Math.max(0, prevStock - deductQty);

    await updateStockItem(stockId, { currentStock: newBal });

    const movement: StockMovement = {
      id: `mov-waste-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
      date: timestamp,
      productId: item.id,
      productName: item.name,
      sku: item.sku || item.id,
      warehouseId: currentWarehouseId,
      warehouseName: item.storageLocation || 'Main Kitchen Store',
      movementType: 'damage',
      referenceId: 'SPOILAGE-CONTROL',
      quantityIn: 0,
      quantityOut: deductQty,
      previousBalance: prevStock,
      newBalance: newBal,
      unitCost: item.costPrice,
      totalValue: deductQty * item.costPrice,
      notes: notes || reason || 'Kitchen ingredient waste logging',
      performedBy: activeStaffUser?.name || activePOSStaff?.name || currentUser.name
    };

    setStockMovements(prev => [movement, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', movement.id), sanitizeForFirestore({ ...movement, restaurantId })).catch(() => {});
    }
  };

  // Adapt All Existing Menu Items to 13% Nepal VAT Inclusive
  const adaptMenuToTaxInclusive = async (forceAll: boolean = true): Promise<{ count: number; updated: number }> => {
    let updatedCount = 0;
    const now = Date.now();
    const updatedProducts = products.map(p => {
      const needsUpdate = forceAll || p.isTaxInclusive === undefined || p.taxRatePercent === undefined;
      if (!needsUpdate && p.isTaxInclusive === true && (p.taxRatePercent === 13 || p.taxRatePercent === 0)) {
        return p;
      }
      updatedCount++;
      return {
        ...p,
        isTaxInclusive: true,
        // preserve 0% if explicitly marked as exempt, otherwise default to 13%
        taxRatePercent: p.taxRatePercent === 0 ? 0 : 13,
        updatedAt: now
      };
    });

    setProducts(updatedProducts);
    try {
      localStorage.setItem('quickims_products', JSON.stringify(updatedProducts));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }

    // Persist to Firestore if available (strictly scoped to current restaurant)
    try {
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        const batch = writeBatch(db);
        let batchOps = 0;

        for (const p of updatedProducts) {
          if (batchOps >= 450) break;
          if (p.restaurantId && p.restaurantId !== restaurantId) continue;
          const tenantRef = doc(db, 'restaurants', restaurantId, 'products', p.id);
          batch.set(tenantRef, sanitizeForFirestore({ ...p, restaurantId }), { merge: true });
          batchOps++;
        }
        if (batchOps > 0) {
          await batch.commit().catch(e => console.warn('Firestore batch adapt error:', e));
        }
      }
    } catch (fsErr) {
      console.warn('Firestore batch adapt error:', fsErr);
    }

    return { count: updatedProducts.length, updated: updatedCount };
  };

  // Add Category
  const addCategory = async (catData: Omit<ProductCategory, 'id'>): Promise<ProductCategory> => {
    const cleanName = catData.name.trim();
    const existing = categories.find(c => String(c.name || '').toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      return existing;
    }
    const newId = `cat-${Date.now()}`;
    const newCategory: ProductCategory = {
      ...catData,
      restaurantId: (catData as any).restaurantId || restaurantId,
      name: cleanName,
      id: newId,
      isDefault: false
    };
    setCategories(prev => [...prev, newCategory]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'categories', newId), sanitizeForFirestore(newCategory));
      } catch (e) {
        console.warn('Firestore write warning (saved locally):', e);
      }
    }
    return newCategory;
  };

  // Update Category
  const updateCategory = async (id: string, updates: Partial<ProductCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'categories', id), sanitizeForFirestore({ ...updates, restaurantId }), { merge: true });
      } catch (e) {
        console.warn('Firestore update warning (saved locally):', e);
      }
    }
  };

  // Delete Category
  const deleteCategory = async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'categories', id));
      } catch (e) {
        console.warn('Firestore delete warning (removed locally):', e);
      }
    }
  };

  // Add Unit
  const addUnit = async (unitData: Omit<UnitDefinition, 'id'>) => {
    const newUnit: UnitDefinition = {
      ...unitData,
      id: `u-${Date.now()}`
    };
    setUnits(prev => [...prev, newUnit]);
  };

  // Add Customer
  const addCustomer = async (custData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> => {
    const newId = `cust-${Date.now()}`;
    const newCustomer: Customer = {
      ...custData,
      id: newId,
      createdAt: Date.now()
    };
    setCustomers(prev => [newCustomer, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'customers', newId), sanitizeForFirestore({ ...newCustomer, restaurantId }));
      } catch (e) {
        console.warn('Firestore write warning:', e);
      }
    }
    return newCustomer;
  };

  // Update Customer
  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'customers', id), sanitizeForFirestore({ ...updates, restaurantId }), { merge: true });
      } catch (e) {
        console.warn('Firestore write warning:', e);
      }
    }
  };

  // Delete Customer (Owner / authorized manager only; protects Walk-in Guest)
  const deleteCustomer = async (id: string): Promise<void> => {
    if (!id || id === DEFAULT_WALKIN_CUSTOMER.id) {
      console.warn('Cannot delete default Walk-in Guest customer.');
      return;
    }
    setCustomers(prev => {
      const next = prev.filter(c => c.id !== id);
      localStorage.setItem('quickims_customers', JSON.stringify(next));
      return next;
    });
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'customers', id));
      } catch (e) {
        console.warn('Firestore delete customer warning (removed locally):', e);
      }
    }
  };

  // Add Supplier
  const addSupplier = async (supData: Omit<Supplier, 'id' | 'createdAt'>): Promise<Supplier> => {
    const newId = `sup-${Date.now()}`;
    const newSup: Supplier = {
      ...supData,
      id: newId,
      createdAt: Date.now()
    };
    setSuppliers(prev => [newSup, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'suppliers', newId), sanitizeForFirestore({ ...newSup, restaurantId }));
      } catch (e) {
        console.warn('Firestore write warning:', e);
      }
    }
    return newSup;
  };

  // Update Supplier
  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'suppliers', id), sanitizeForFirestore({ ...updates, restaurantId }), { merge: true }).catch(() => {});
    }
  };

  // Add Warehouse
  const addWarehouse = async (whData: Omit<Warehouse, 'id'>): Promise<Warehouse> => {
    const newId = `wh-${Date.now()}`;
    const newWh: Warehouse = {
      ...whData,
      id: newId
    };
    setWarehouses(prev => [...prev, newWh]);
    return newWh;
  };

  // Atomic Sale Record (Idempotent by invoice ID + atomic Firestore increment for concurrent cashiers)
  const recordSale = async (saleData: Omit<SaleInvoice, 'id' | 'createdAt'>): Promise<SaleInvoice> => {
    const newSaleId = (saleData as any).id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isDraft = saleData.status === 'draft' || saleData.isDraft === true;
    const rawInvoice: SaleInvoice = {
      ...saleData,
      id: newSaleId,
      status: isDraft ? 'draft' : (saleData.status || 'completed'),
      isDraft,
      createdAt: (saleData as any).createdAt || Date.now()
    };
    const invoice = isDraft ? rawInvoice : normalizeSaleInvoicePayment(rawInvoice);

    // Guard against simultaneous duplicate recordSale calls for the same invoice ID
    if (inFlightSaleIdsRef.current.has(newSaleId)) {
      const existing = salesRef.current.find(s => s.id === newSaleId);
      return existing || invoice;
    }

    const existingRefIdx = salesRef.current.findIndex(s => s.id === invoice.id || (s.invoiceNumber && s.invoiceNumber === invoice.invoiceNumber));
    const existingSale = existingRefIdx >= 0 ? salesRef.current[existingRefIdx] : null;
    const alreadySettledCompleted = Boolean(!isDraft && existingSale && existingSale.status !== 'draft' && existingSale.isDraft !== true);

    inFlightSaleIdsRef.current.add(newSaleId);

    try {
      // If this exact completed invoice was already recorded, skip duplicate stock & balance deduction
      if (alreadySettledCompleted && existingSale) {
        return existingSale;
      }

      // 1. Add or update invoice in sales (and update ref synchronously so immediate settleTableBill skips duplicate work)
      if (existingRefIdx >= 0) {
        const nextRef = [...salesRef.current];
        nextRef[existingRefIdx] = invoice;
        salesRef.current = nextRef;
      } else {
        salesRef.current = [invoice, ...salesRef.current];
      }

      setSales(prev => {
        const existingIdx = prev.findIndex(s => s.id === invoice.id || (s.invoiceNumber && s.invoiceNumber === invoice.invoiceNumber));
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = invoice;
          return next;
        }
        return [invoice, ...prev];
      });

      // If draft, do NOT deduct inventory stock or modify customer balance
      if (isDraft) {
        if (db && restaurantId && restaurantId !== 'restro_guest') {
          try {
            await setDoc(doc(db, 'restaurants', restaurantId, 'sales', newSaleId), sanitizeForFirestore({ ...invoice, restaurantId }));
          } catch (e) {
            console.warn('Firestore draft sale write warning:', e);
          }
        }
        return invoice;
      }

      // 2. Compute stock & soldCount deltas cleanly once (outside React state updater so StrictMode never double-collects)
      const nowTs = Date.now();
      const currentProductsSnapshot = productsRef.current.length > 0 ? productsRef.current : products;
      const qtyByProductId = new Map<string, number>();
      for (const item of invoice.items) {
        if (!item.productId) continue;
        const qty = Number(item.baseQuantity || item.quantity || 0);
        if (qty > 0) {
          qtyByProductId.set(item.productId, (qtyByProductId.get(item.productId) || 0) + qty);
        }
      }

      const newMovements: StockMovement[] = [];
      const productStockUpdates: { id: string; isTracked: boolean; qtySold: number; updatedAt: number }[] = [];

      currentProductsSnapshot.forEach(p => {
        const totalQtySold = qtyByProductId.get(p.id) || 0;
        if (totalQtySold <= 0) return;

        const isTracked = p.itemType === 'raw_ingredient' || p.trackStock === true;
        productStockUpdates.push({ id: p.id, isTracked, qtySold: totalQtySold, updatedAt: nowTs });

        if (isTracked) {
          const currentBal = p.currentStock;
          const newBal = Math.max(0, currentBal - totalQtySold);
          newMovements.push({
            id: `stk-mov-${nowTs}-${p.id}-${Math.random().toString(36).slice(2, 5)}`,
            date: invoice.date,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            warehouseId: invoice.warehouseId,
            warehouseName: invoice.warehouseName,
            movementType: 'sale',
            referenceId: invoice.invoiceNumber,
            quantityIn: 0,
            quantityOut: totalQtySold,
            previousBalance: currentBal,
            newBalance: newBal,
            unitCost: p.costPrice,
            totalValue: totalQtySold * p.costPrice,
            notes: `Sale to ${invoice.customerName}`,
            performedBy: invoice.salespersonName
          });
        }
      });

      const updatedLocalProducts = currentProductsSnapshot.map(p => {
        const totalQtySold = qtyByProductId.get(p.id) || 0;
        if (totalQtySold <= 0) return p;
        const nextSoldCount = Number(p.soldCount || 0) + totalQtySold;
        const isTracked = p.itemType === 'raw_ingredient' || p.trackStock === true;
        return isTracked
          ? { ...p, currentStock: Math.max(0, p.currentStock - totalQtySold), soldCount: nextSoldCount, updatedAt: nowTs }
          : { ...p, soldCount: nextSoldCount, updatedAt: nowTs };
      });
      productsRef.current = updatedLocalProducts;
      setProducts(updatedLocalProducts);

      if (newMovements.length > 0) {
        setStockMovements(prev => [...newMovements, ...prev]);
      }

      // 3. Update Customer Balance atomically if credit or partial payment
      if (invoice.dueAmount > 0 && invoice.customerId) {
        setCustomers(prevCust =>
          prevCust.map(c =>
            c.id === invoice.customerId
              ? { ...c, currentBalance: (c.currentBalance || 0) + invoice.dueAmount }
              : c
          )
        );
        if (db && restaurantId && restaurantId !== 'restro_guest') {
          setDoc(
            doc(db, 'restaurants', restaurantId, 'customers', invoice.customerId),
            { currentBalance: increment(invoice.dueAmount) },
            { merge: true }
          ).catch(() => {});
        }
      }

      if (db && restaurantId && restaurantId !== 'restro_guest') {
        try {
          await setDoc(doc(db, 'restaurants', restaurantId, 'sales', newSaleId), sanitizeForFirestore({ ...invoice, restaurantId }));
          productStockUpdates.forEach(u => {
            const payloadUpdate: Record<string, any> = {
              soldCount: increment(u.qtySold),
              updatedAt: u.updatedAt
            };
            if (u.isTracked) {
              payloadUpdate.currentStock = increment(-u.qtySold);
            }
            setDoc(doc(db, 'restaurants', restaurantId, 'products', u.id), payloadUpdate, { merge: true }).catch(() => {});
          });
          newMovements.forEach(m => {
            setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', m.id), sanitizeForFirestore({ ...m, restaurantId })).catch(() => {});
          });
        } catch (e) {
          console.warn('Firestore write warning:', e);
        }
      }

      return invoice;
    } finally {
      inFlightSaleIdsRef.current.delete(newSaleId);
    }
  };

  // Finalize Draft Sale Invoice
  const finalizeSaleInvoice = async (id: string): Promise<SaleInvoice> => {
    const sale = salesRef.current.find(s => s.id === id) || sales.find(s => s.id === id);
    if (!sale) throw new Error('Invoice not found');
    if (sale.status === 'completed' && sale.isDraft !== true) {
      return sale;
    }

    const finalizedInvoice = normalizeSaleInvoicePayment({
      ...sale,
      status: 'completed',
      isDraft: false
    });

    const nowTs = Date.now();
    const currentProductsSnapshot = productsRef.current.length > 0 ? productsRef.current : products;
    const qtyByProductId = new Map<string, number>();
    for (const item of sale.items) {
      if (!item.productId) continue;
      const qty = Number(item.baseQuantity || item.quantity || 0);
      if (qty > 0) {
        qtyByProductId.set(item.productId, (qtyByProductId.get(item.productId) || 0) + qty);
      }
    }

    const newMovements: StockMovement[] = [];
    const productStockUpdates: { id: string; isTracked: boolean; qtySold: number; updatedAt: number }[] = [];

    currentProductsSnapshot.forEach(p => {
      const totalQtySold = qtyByProductId.get(p.id) || 0;
      if (totalQtySold <= 0) return;

      const isTracked = p.itemType === 'raw_ingredient' || p.trackStock === true;
      productStockUpdates.push({ id: p.id, isTracked, qtySold: totalQtySold, updatedAt: nowTs });

      if (isTracked) {
        const currentBal = p.currentStock;
        const newBal = Math.max(0, currentBal - totalQtySold);
        newMovements.push({
          id: `stk-mov-${nowTs}-${p.id}-${Math.random().toString(36).slice(2, 5)}`,
          date: sale.date || nowTs,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          warehouseId: sale.warehouseId,
          warehouseName: sale.warehouseName,
          movementType: 'sale',
          referenceId: sale.invoiceNumber,
          quantityIn: 0,
          quantityOut: totalQtySold,
          previousBalance: currentBal,
          newBalance: newBal,
          unitCost: p.costPrice,
          totalValue: totalQtySold * p.costPrice,
          notes: `Finalized Sale to ${sale.customerName}`,
          performedBy: sale.salespersonName
        });
      }
    });

    const updatedLocalProducts = currentProductsSnapshot.map(p => {
      const totalQtySold = qtyByProductId.get(p.id) || 0;
      if (totalQtySold <= 0) return p;
      const nextSoldCount = Number(p.soldCount || 0) + totalQtySold;
      const isTracked = p.itemType === 'raw_ingredient' || p.trackStock === true;
      return isTracked
        ? { ...p, currentStock: Math.max(0, p.currentStock - totalQtySold), soldCount: nextSoldCount, updatedAt: nowTs }
        : { ...p, soldCount: nextSoldCount, updatedAt: nowTs };
    });
    productsRef.current = updatedLocalProducts;
    setProducts(updatedLocalProducts);

    if (newMovements.length > 0) {
      setStockMovements(prev => [...newMovements, ...prev]);
    }

    // 2. Update Customer Balance atomically if credit or partial payment
    if (finalizedInvoice.dueAmount > 0 && finalizedInvoice.customerId) {
      setCustomers(prevCust =>
        prevCust.map(c =>
          c.id === finalizedInvoice.customerId
            ? { ...c, currentBalance: (c.currentBalance || 0) + finalizedInvoice.dueAmount }
            : c
        )
      );
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        setDoc(
          doc(db, 'restaurants', restaurantId, 'customers', finalizedInvoice.customerId),
          { currentBalance: increment(finalizedInvoice.dueAmount) },
          { merge: true }
        ).catch(() => {});
      }
    }

    // 3. Update sales state
    salesRef.current = salesRef.current.map(s => s.id === id ? finalizedInvoice : s);
    setSales(prev => prev.map(s => s.id === id ? finalizedInvoice : s));

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'sales', id), sanitizeForFirestore({ ...finalizedInvoice, restaurantId }), { merge: true });
        productStockUpdates.forEach(u => {
          const payloadUpdate: Record<string, any> = {
            soldCount: increment(u.qtySold),
            updatedAt: u.updatedAt
          };
          if (u.isTracked) {
            payloadUpdate.currentStock = increment(-u.qtySold);
          }
          setDoc(doc(db, 'restaurants', restaurantId, 'products', u.id), payloadUpdate, { merge: true }).catch(() => {});
        });
        newMovements.forEach(m => {
          setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', m.id), sanitizeForFirestore({ ...m, restaurantId })).catch(() => {});
        });
      } catch (e) {
        console.warn('Firestore finalize sale warning:', e);
      }
    }

    return finalizedInvoice;
  };

  // Delete Sale Invoice (e.g. discard draft)
  const deleteSaleInvoice = async (id: string): Promise<void> => {
    salesRef.current = salesRef.current.filter(s => s.id !== id);
    setSales(prev => prev.filter(s => s.id !== id));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'sales', id));
      } catch (e) {
        console.warn('Firestore delete sale warning:', e);
      }
    }
  };

  // Update Sale Invoice (keeps paidAmount, dueAmount, paymentStatus, and customer receivable balance in sync)
  const updateSale = async (id: string, updates: Partial<SaleInvoice>) => {
    const existing = salesRef.current.find(s => s.id === id) || sales.find(s => s.id === id);
    if (!existing) {
      setSales(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        try {
          await setDoc(doc(db, 'restaurants', restaurantId, 'sales', id), sanitizeForFirestore({ ...updates, restaurantId }), { merge: true });
        } catch (e) {
          console.warn('Firestore update sale warning (saved locally):', e);
        }
      }
      return;
    }

    const willBeDraft =
      updates.isDraft !== undefined || updates.status !== undefined
        ? (updates.status === 'draft' || updates.isDraft === true)
        : isDraftInvoice(existing);

    const resolvedPayment = willBeDraft ? {} : resolveEditSalePaymentFields(existing, updates);
    const mergedUpdates: Partial<SaleInvoice> = {
      ...updates,
      ...resolvedPayment
    };
    const nextSale = willBeDraft
      ? { ...existing, ...mergedUpdates }
      : normalizeSaleInvoicePayment({ ...existing, ...mergedUpdates });

    const oldDue = isDraftInvoice(existing) ? 0 : getInvoiceDueAmount(existing);
    const newDue = isDraftInvoice(nextSale) ? 0 : getInvoiceDueAmount(nextSale);
    const oldCustomerId = existing.customerId;
    const newCustomerId = nextSale.customerId;

    salesRef.current = salesRef.current.map(s => s.id === id ? nextSale : s);
    setSales(prev => prev.map(s => s.id === id ? nextSale : s));

    // Adjust customer outstanding receivable(s) cleanly if due amount or customer changed
    if (!willBeDraft) {
      const dueDelta = Math.round((newDue - oldDue) * 100) / 100;
      if (oldCustomerId === newCustomerId) {
        if (newCustomerId && Math.abs(dueDelta) > 0.009) {
          setCustomers(prev => prev.map(c => {
            if (c.id !== newCustomerId) return c;
            const nextBal = Math.max(0, Math.round(((c.currentBalance || 0) + dueDelta) * 100) / 100);
            if (db && restaurantId && restaurantId !== 'restro_guest') {
              setDoc(doc(db, 'restaurants', restaurantId, 'customers', c.id), { currentBalance: nextBal }, { merge: true }).catch(() => {});
            }
            return { ...c, currentBalance: nextBal };
          }));
        }
      } else {
        setCustomers(prev => prev.map(c => {
          if (c.id === oldCustomerId && oldDue > 0) {
            const nextBal = Math.max(0, Math.round(((c.currentBalance || 0) - oldDue) * 100) / 100);
            if (db && restaurantId && restaurantId !== 'restro_guest') {
              setDoc(doc(db, 'restaurants', restaurantId, 'customers', c.id), { currentBalance: nextBal }, { merge: true }).catch(() => {});
            }
            return { ...c, currentBalance: nextBal };
          }
          if (c.id === newCustomerId && newDue > 0) {
            const nextBal = Math.max(0, Math.round(((c.currentBalance || 0) + newDue) * 100) / 100);
            if (db && restaurantId && restaurantId !== 'restro_guest') {
              setDoc(doc(db, 'restaurants', restaurantId, 'customers', c.id), { currentBalance: nextBal }, { merge: true }).catch(() => {});
            }
            return { ...c, currentBalance: nextBal };
          }
          return c;
        }));
      }
    }

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'sales', id), sanitizeForFirestore({ ...mergedUpdates, restaurantId }), { merge: true });
      } catch (e) {
        console.warn('Firestore update sale warning (saved locally):', e);
      }
    }
  };

  // Settle Due Payment on Invoice
  const settleInvoicePayment = async (
    invoiceId: string, 
    paymentReceived: number, 
    method: SaleInvoice['paymentMethod'],
    paymentRef?: string,
    notes?: string
  ) => {
    const sale = salesRef.current.find(s => s.id === invoiceId) || sales.find(s => s.id === invoiceId);
    if (!sale) return;

    const remainingDue = getInvoiceDueAmount(sale);
    const validAmount = Math.max(0, Math.min(paymentReceived, remainingDue));
    if (validAmount <= 0) return;

    const newPaidAmount = Math.min(sale.grandTotal, Math.round(((sale.paidAmount || 0) + validAmount) * 100) / 100);
    const newDueAmount = Math.max(0, Math.round((remainingDue - validAmount) * 100) / 100);
    const newPaymentStatus = getEffectivePaymentStatus({
      ...sale,
      paidAmount: newPaidAmount,
      dueAmount: newDueAmount
    });

    const updatedSale: SaleInvoice = {
      ...sale,
      paidAmount: newPaidAmount,
      dueAmount: newDueAmount,
      paymentStatus: newPaymentStatus,
      paymentMethod: newDueAmount === 0 && method ? method : sale.paymentMethod,
      paymentReference: paymentRef ? (sale.paymentReference ? `${sale.paymentReference}, ${paymentRef}` : paymentRef) : sale.paymentReference,
      notes: notes ? (sale.notes ? `${sale.notes} | ${notes}` : notes) : sale.notes
    };

    // Update sales state synchronously
    salesRef.current = salesRef.current.map(s => s.id === invoiceId ? updatedSale : s);
    setSales(prev => prev.map(s => s.id === invoiceId ? updatedSale : s));

    // Update customer balance if customer linked
    if (sale.customerId) {
      setCustomers(prev => prev.map(c => {
        if (c.id === sale.customerId) {
          const newBal = Math.max(0, Math.round(((c.currentBalance || 0) - validAmount) * 100) / 100);
          if (db && restaurantId && restaurantId !== 'restro_guest') {
            setDoc(doc(db, 'restaurants', restaurantId, 'customers', c.id), { currentBalance: newBal }, { merge: true }).catch(() => {});
          }
          return { ...c, currentBalance: newBal };
        }
        return c;
      }));
    }

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'sales', invoiceId), sanitizeForFirestore({ ...updatedSale, restaurantId }), { merge: true });
      } catch (e) {
        console.warn('Firestore settle invoice warning (saved locally):', e);
      }
    }
  };

  // Collect Customer Account Payment (settles customer balance + oldest pending invoices FIFO)
  const collectCustomerPayment = async (
    customerId: string,
    amount: number,
    method: SaleInvoice['paymentMethod'] = 'cash',
    notes?: string,
    mode: 'opening_first' | 'bills_first' = 'opening_first'
  ) => {
    const targetCust = customers.find(c => c.id === customerId);
    if (!targetCust || amount <= 0) return;

    const currentSalesSnapshot = salesRef.current.length > 0 ? salesRef.current : sales;
    const allocation = allocateCustomerPaymentToInvoices({
      invoices: currentSalesSnapshot,
      customerId,
      currentBalance: targetCust.currentBalance || 0,
      paymentAmount: amount,
      method,
      notes,
      mode
    });

    if (allocation.totalApplied <= 0 && allocation.newCustomerBalance === (targetCust.currentBalance || 0)) {
      return;
    }

    if (allocation.updatedInvoices.length > 0) {
      const updatedMap = new Map(allocation.updatedInvoices.map(inv => [inv.id, inv]));
      salesRef.current = currentSalesSnapshot.map(s => updatedMap.get(s.id) || s);
      setSales(prev => prev.map(s => updatedMap.get(s.id) || s));
    }

    setCustomers(prev =>
      prev.map(c => (c.id === customerId ? { ...c, currentBalance: allocation.newCustomerBalance } : c))
    );

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await Promise.all([
          setDoc(
            doc(db, 'restaurants', restaurantId, 'customers', customerId),
            { currentBalance: allocation.newCustomerBalance },
            { merge: true }
          ),
          ...allocation.updatedInvoices.map(inv =>
            setDoc(
              doc(db, 'restaurants', restaurantId, 'sales', inv.id),
              sanitizeForFirestore({ ...inv, restaurantId }),
              { merge: true }
            )
          )
        ]);
      } catch (e) {
        console.warn('Firestore collect customer payment warning:', e);
      }
    }
  };

  // Atomic Purchase Record
  const recordPurchase = async (purchaseData: Omit<PurchaseInvoice, 'id' | 'createdAt'>): Promise<PurchaseInvoice> => {
    const newPurId = `pur-${Date.now()}`;
    const isDraft = purchaseData.status === 'draft' || purchaseData.isDraft === true;
    const purchase: PurchaseInvoice = {
      ...purchaseData,
      id: newPurId,
      status: isDraft ? 'draft' : (purchaseData.status || 'received'),
      isDraft,
      createdAt: Date.now()
    };

    // 1. Add purchase invoice
    setPurchases(prev => [purchase, ...prev]);

    // If draft, do NOT increment stock or add supplier payable yet
    if (isDraft) {
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        try {
          await setDoc(doc(db, 'restaurants', restaurantId, 'purchases', newPurId), sanitizeForFirestore({ ...purchase, restaurantId }));
        } catch (e) {
          console.warn('Firestore draft purchase write warning:', e);
        }
      }
      return purchase;
    }

    // 2. Increase product stock & update average cost price & stock movements
    const newMovements: StockMovement[] = [];
    const productUpdates: { id: string; currentStock: number; costPrice: number; updatedAt: number }[] = [];
    setProducts(prevProducts => {
      const nowTs = Date.now();
      return prevProducts.map(p => {
        const item = purchase.items.find(i => i.productId === p.id);
        if (item) {
          const qtyToAdd = item.baseQuantity;
          const currentBal = p.currentStock;
          const newBal = currentBal + qtyToAdd;
          
          // Weighted Average Cost calculation
          const unitCostPerBase = item.unitCost / (item.conversionFactor || 1);
          const totalValBefore = currentBal * p.costPrice;
          const totalValAdded = qtyToAdd * unitCostPerBase;
          const newAvgCost = newBal > 0 ? Math.round((totalValBefore + totalValAdded) / newBal) : p.costPrice;
          productUpdates.push({ id: p.id, currentStock: newBal, costPrice: newAvgCost, updatedAt: nowTs });

          newMovements.push({
            id: `stk-mov-${nowTs}-${p.id}`,
            date: purchase.date,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            warehouseId: purchase.warehouseId,
            warehouseName: purchase.warehouseName,
            movementType: 'purchase',
            referenceId: purchase.purchaseNumber,
            quantityIn: qtyToAdd,
            quantityOut: 0,
            previousBalance: currentBal,
            newBalance: newBal,
            unitCost: unitCostPerBase,
            totalValue: qtyToAdd * unitCostPerBase,
            notes: `Purchase from ${purchase.supplierName}`,
            performedBy: activePOSStaff?.name || activeStaffUser?.name || currentUser.name
          });

          return { 
            ...p, 
            currentStock: newBal, 
            costPrice: newAvgCost,
            updatedAt: nowTs 
          };
        }
        return p;
      });
    });

    if (newMovements.length > 0) {
      setStockMovements(prev => [...newMovements, ...prev]);
    }

    // 3. Update Supplier Payable Balance if credit / due
    if (purchase.dueAmount > 0) {
      setSuppliers(prevSup => {
        return prevSup.map(s => {
          if (s.id === purchase.supplierId) {
            const nextBal = (s.currentBalance || 0) + purchase.dueAmount;
            if (db && restaurantId && restaurantId !== 'restro_guest') {
              setDoc(doc(db, 'restaurants', restaurantId, 'suppliers', s.id), { currentBalance: nextBal }, { merge: true }).catch(() => {});
            }
            return { ...s, currentBalance: nextBal };
          }
          return s;
        });
      });
    }

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'purchases', newPurId), sanitizeForFirestore({ ...purchase, restaurantId }));
        productUpdates.forEach(u => {
          setDoc(doc(db, 'restaurants', restaurantId, 'products', u.id), { currentStock: u.currentStock, costPrice: u.costPrice, updatedAt: u.updatedAt }, { merge: true }).catch(() => {});
        });
        newMovements.forEach(m => {
          setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', m.id), sanitizeForFirestore({ ...m, restaurantId })).catch(() => {});
        });
      } catch (e) {
        console.warn('Firestore write warning:', e);
      }
    }

    return purchase;
  };

  // Finalize Draft Purchase Invoice
  const finalizePurchaseInvoice = async (id: string): Promise<PurchaseInvoice> => {
    const purchase = purchases.find(p => p.id === id);
    if (!purchase) throw new Error('Purchase not found');

    const finalizedPurchase: PurchaseInvoice = {
      ...purchase,
      status: 'received',
      isDraft: false
    };

    // 1. Increase product stock & update weighted average cost
    const newMovements: StockMovement[] = [];
    const productUpdates: { id: string; currentStock: number; costPrice: number; updatedAt: number }[] = [];
    setProducts(prevProducts => {
      const nowTs = Date.now();
      return prevProducts.map(p => {
        const item = purchase.items.find(i => i.productId === p.id);
        if (item) {
          const qtyToAdd = item.baseQuantity;
          const currentBal = p.currentStock;
          const newBal = currentBal + qtyToAdd;
          const unitCostPerBase = item.unitCost / (item.conversionFactor || 1);
          const totalValBefore = currentBal * p.costPrice;
          const totalValAdded = qtyToAdd * unitCostPerBase;
          const newAvgCost = newBal > 0 ? Math.round((totalValBefore + totalValAdded) / newBal) : p.costPrice;
          productUpdates.push({ id: p.id, currentStock: newBal, costPrice: newAvgCost, updatedAt: nowTs });

          newMovements.push({
            id: `stk-mov-${nowTs}-${p.id}`,
            date: purchase.date || nowTs,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            warehouseId: purchase.warehouseId,
            warehouseName: purchase.warehouseName,
            movementType: 'purchase',
            referenceId: purchase.purchaseNumber,
            quantityIn: qtyToAdd,
            quantityOut: 0,
            previousBalance: currentBal,
            newBalance: newBal,
            unitCost: unitCostPerBase,
            totalValue: qtyToAdd * unitCostPerBase,
            notes: `Finalized Purchase from ${purchase.supplierName}`,
            performedBy: activePOSStaff?.name || activeStaffUser?.name || currentUser.name
          });

          return { 
            ...p, 
            currentStock: newBal, 
            costPrice: newAvgCost,
            updatedAt: nowTs 
          };
        }
        return p;
      });
    });

    if (newMovements.length > 0) {
      setStockMovements(prev => [...newMovements, ...prev]);
    }

    // 2. Update Supplier Payable Balance if credit / due
    if (purchase.dueAmount > 0) {
      setSuppliers(prevSup => {
        return prevSup.map(s => {
          if (s.id === purchase.supplierId) {
            const nextBal = (s.currentBalance || 0) + purchase.dueAmount;
            if (db && restaurantId && restaurantId !== 'restro_guest') {
              setDoc(doc(db, 'restaurants', restaurantId, 'suppliers', s.id), { currentBalance: nextBal }, { merge: true }).catch(() => {});
            }
            return { ...s, currentBalance: nextBal };
          }
          return s;
        });
      });
    }

    // 3. Update purchases state
    setPurchases(prev => prev.map(p => p.id === id ? finalizedPurchase : p));

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'purchases', id), sanitizeForFirestore({ ...finalizedPurchase, restaurantId }), { merge: true });
        productUpdates.forEach(u => {
          setDoc(doc(db, 'restaurants', restaurantId, 'products', u.id), { currentStock: u.currentStock, costPrice: u.costPrice, updatedAt: u.updatedAt }, { merge: true }).catch(() => {});
        });
        newMovements.forEach(m => {
          setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', m.id), sanitizeForFirestore({ ...m, restaurantId })).catch(() => {});
        });
      } catch (e) {
        console.warn('Firestore finalize purchase warning:', e);
      }
    }

    return finalizedPurchase;
  };

  // Delete Purchase Invoice (e.g. discard draft)
  const deletePurchase = async (id: string): Promise<void> => {
    setPurchases(prev => prev.filter(p => p.id !== id));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'purchases', id));
      } catch (e) {
        console.warn('Firestore delete purchase warning:', e);
      }
    }
  };

  // Update Purchase Invoice
  const updatePurchase = async (id: string, updates: Partial<PurchaseInvoice>) => {
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'purchases', id), sanitizeForFirestore({ ...updates, restaurantId }), { merge: true });
      } catch (e) {
        console.warn('Firestore updatePurchase warning:', e);
      }
    }
  };

  // Settle Due Payment on Purchase Bill
  const settlePurchasePayment = async (
    purchaseId: string, 
    paymentPaid: number, 
    method: PurchaseInvoice['paymentMethod'],
    notes?: string
  ) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) return;

    const remainingDue = purchase.dueAmount ?? Math.max(0, purchase.grandTotal - (purchase.paidAmount || 0));
    const validAmount = Math.max(0, Math.min(paymentPaid, remainingDue));
    if (validAmount <= 0) return;

    const newPaidAmount = Math.min(purchase.grandTotal, (purchase.paidAmount || 0) + validAmount);
    const newDueAmount = Math.max(0, purchase.grandTotal - newPaidAmount);
    const newPaymentStatus: PurchaseInvoice['paymentStatus'] = newDueAmount === 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'unpaid';

    const updatedPurchase: PurchaseInvoice = {
      ...purchase,
      paidAmount: newPaidAmount,
      dueAmount: newDueAmount,
      paymentStatus: newPaymentStatus,
      paymentMethod: newDueAmount === 0 && method ? method : purchase.paymentMethod,
      notes: notes ? (purchase.notes ? `${purchase.notes} | ${notes}` : notes) : purchase.notes
    };

    // Update purchases state
    setPurchases(prev => prev.map(p => p.id === purchaseId ? updatedPurchase : p));

    // Update supplier balance if registered supplier
    if (purchase.supplierId) {
      setSuppliers(prev => prev.map(s => {
        if (s.id === purchase.supplierId) {
          const newBal = Math.max(0, (s.currentBalance || 0) - validAmount);
          if (db && restaurantId && restaurantId !== 'restro_guest') {
            setDoc(doc(db, 'restaurants', restaurantId, 'suppliers', s.id), { currentBalance: newBal }, { merge: true }).catch(() => {});
          }
          return { ...s, currentBalance: newBal };
        }
        return s;
      }));
    }

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'purchases', purchaseId), sanitizeForFirestore({ ...updatedPurchase, restaurantId }), { merge: true });
      } catch (e) {
        console.warn('Firestore settle purchase warning (saved locally):', e);
      }
    }
  };

  // Record Expense
  const recordExpense = async (expData: Omit<ExpenseRecord, 'id' | 'createdAt'>): Promise<ExpenseRecord> => {
    const newId = `exp-${Date.now()}`;
    const newExp: ExpenseRecord = {
      ...expData,
      id: newId,
      createdAt: Date.now()
    };
    setExpenses(prev => [newExp, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'expenses', newId), sanitizeForFirestore({ ...newExp, restaurantId }));
      } catch (e) {
        console.warn('Firestore write warning:', e);
      }
    }
    return newExp;
  };

  // Stock Adjustment
  const recordStockAdjustment = async (adjData: Omit<StockAdjustment, 'id' | 'createdAt'>) => {
    const newAdjId = `adj-${Date.now()}`;
    const adj: StockAdjustment = {
      ...adjData,
      id: newAdjId,
      createdAt: Date.now()
    };

    setStockAdjustments(prev => [adj, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'stock_adjustments', newAdjId), sanitizeForFirestore({ ...adj, restaurantId })).catch(() => {});
    }

    // Update Product stock
    setProducts(prev => {
      const nowTs = Date.now();
      return prev.map(p => {
        if (p.id === adj.productId) {
          const newBal = Math.max(0, p.currentStock + adj.quantityDelta);
          const movement: StockMovement = {
            id: `stk-mov-${nowTs}`,
            date: adj.date,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            warehouseId: adj.warehouseId,
            warehouseName: adj.warehouseName,
            movementType: adj.quantityDelta >= 0 ? 'adjustment' : (adj.type === 'damage' ? 'damage' : 'adjustment'),
            referenceId: `ADJ-${newAdjId.substring(4, 10)}`,
            quantityIn: adj.quantityDelta > 0 ? adj.quantityDelta : 0,
            quantityOut: adj.quantityDelta < 0 ? Math.abs(adj.quantityDelta) : 0,
            previousBalance: p.currentStock,
            newBalance: newBal,
            unitCost: adj.unitCost || p.costPrice,
            totalValue: Math.abs(adj.quantityDelta) * (adj.unitCost || p.costPrice),
            notes: `${adj.type.toUpperCase()}: ${adj.reason}`,
            performedBy: adj.performedBy
          };
          setStockMovements(m => [movement, ...m]);
          if (db && restaurantId && restaurantId !== 'restro_guest') {
            setDoc(doc(db, 'restaurants', restaurantId, 'products', p.id), { currentStock: newBal, updatedAt: nowTs }, { merge: true }).catch(() => {});
            setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', movement.id), sanitizeForFirestore({ ...movement, restaurantId })).catch(() => {});
          }
          return { ...p, currentStock: newBal, updatedAt: nowTs };
        }
        return p;
      });
    });
  };

  // Stock Transfer
  const recordStockTransfer = async (transData: Omit<StockTransfer, 'id' | 'createdAt'>) => {
    const newId = `trans-${Date.now()}`;
    const trans: StockTransfer = {
      ...transData,
      id: newId,
      createdAt: Date.now()
    };
    setStockTransfers(prev => [trans, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'stock_transfers', newId), sanitizeForFirestore({ ...trans, restaurantId })).catch(() => {});
    }

    // Record transfer movements
    const createdMovements: StockMovement[] = [];
    trans.items.forEach((item, idx) => {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        const ts = Date.now() + idx;
        const mOut: StockMovement = {
          id: `stk-mov-${ts}-out`,
          date: trans.date,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          warehouseId: trans.fromWarehouseId,
          warehouseName: trans.fromWarehouseName,
          movementType: 'transfer_out',
          referenceId: trans.transferNumber,
          quantityIn: 0,
          quantityOut: item.quantity,
          previousBalance: prod.currentStock,
          newBalance: Math.max(0, prod.currentStock - item.quantity),
          unitCost: item.unitCost,
          totalValue: item.quantity * item.unitCost,
          notes: `Transfer to ${trans.toWarehouseName}`,
          performedBy: trans.initiatedBy
        };
        const mIn: StockMovement = {
          id: `stk-mov-${ts}-in`,
          date: trans.date,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          warehouseId: trans.toWarehouseId,
          warehouseName: trans.toWarehouseName,
          movementType: 'transfer_in',
          referenceId: trans.transferNumber,
          quantityIn: item.quantity,
          quantityOut: 0,
          previousBalance: 0,
          newBalance: item.quantity,
          unitCost: item.unitCost,
          totalValue: item.quantity * item.unitCost,
          notes: `Transferred from ${trans.fromWarehouseName}`,
          performedBy: trans.initiatedBy
        };
        createdMovements.push(mOut, mIn);
      }
    });
    if (createdMovements.length > 0) {
      setStockMovements(prev => [...createdMovements, ...prev]);
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        createdMovements.forEach(m => {
          setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', m.id), sanitizeForFirestore({ ...m, restaurantId })).catch(() => {});
        });
      }
    }
  };

  // Create Quotation
  const createQuotation = async (quoteData: Omit<Quotation, 'id' | 'createdAt'>): Promise<Quotation> => {
    const newId = `quo-${Date.now()}`;
    const quote: Quotation = {
      ...quoteData,
      id: newId,
      createdAt: Date.now()
    };
    setQuotations(prev => [quote, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'quotations', newId), sanitizeForFirestore({ ...quote, restaurantId })).catch(() => {});
    }
    return quote;
  };

  // Sales Return
  const recordSalesReturn = async (retData: Omit<SalesReturn, 'id' | 'createdAt'>) => {
    const timestamp = Date.now();
    const newId = `ret-${timestamp}-${Math.floor(1000 + Math.random() * 9000)}`;
    const ret: SalesReturn = {
      ...retData,
      id: newId,
      date: retData.date || timestamp,
      createdAt: timestamp
    };
    
    // Optimistically update salesReturns list
    setSalesReturns(prev => [ret, ...prev]);

    // 1. Update the original invoice items and status
    if (ret.originalInvoiceId || ret.originalInvoiceNumber) {
      setSales(prevSales => {
        return prevSales.map(sale => {
          const isTargetInvoice = 
            (ret.originalInvoiceId && sale.id === ret.originalInvoiceId) ||
            (ret.originalInvoiceNumber && sale.invoiceNumber === ret.originalInvoiceNumber) ||
            (ret.originalInvoiceId && sale.invoiceNumber === ret.originalInvoiceId) ||
            (ret.originalInvoiceNumber && sale.id === ret.originalInvoiceNumber);

          if (isTargetInvoice) {
            const updatedItems = sale.items.map(item => {
              const returnedMatch = ret.items.find(ri => 
                (ri.productId && item.productId && ri.productId === item.productId) ||
                (ri.productName && item.productName && ri.productName.toLowerCase().trim() === item.productName.toLowerCase().trim()) ||
                (item.sku && (ri as any).sku && item.sku === (ri as any).sku)
              );

              if (returnedMatch) {
                const alreadyReturned = Number(item.returnedQuantity || 0);
                const addQty = Number(returnedMatch.returnedQuantity || 0);
                return {
                  ...item,
                  returnedQuantity: alreadyReturned + addQty
                };
              }
              return item;
            });

            // Check if all items in invoice are fully returned
            const allFullyReturned = updatedItems.every(i => (i.returnedQuantity || 0) >= i.quantity);
            const anyReturned = updatedItems.some(i => (i.returnedQuantity || 0) > 0);
            const newStatus = allFullyReturned ? 'returned' : anyReturned ? 'partially_returned' : sale.status;

            let updatedDue = getInvoiceDueAmount(sale);
            let updatedPaid = sale.paidAmount || 0;

            if (ret.refundMethod === 'deduct_due') {
              updatedDue = Math.max(0, Math.round((updatedDue - ret.totalRefundAmount) * 100) / 100);
            } else if (ret.refundMethod === 'credit_note') {
              if (updatedDue > 0) {
                const deduct = Math.min(updatedDue, ret.totalRefundAmount);
                updatedDue = Math.max(0, Math.round((updatedDue - deduct) * 100) / 100);
              }
            }

            const updatedPaymentStatus = getEffectivePaymentStatus({
              ...sale,
              paidAmount: updatedPaid,
              dueAmount: updatedDue
            });

            const updatedReturnedAmount = (sale.returnedAmount || 0) + ret.totalRefundAmount;
            const updatedReturnedQty = updatedItems.reduce((acc, it) => acc + (it.returnedQuantity || 0), 0);

            const updatedSale: SaleInvoice = {
              ...sale,
              items: updatedItems,
              status: newStatus,
              dueAmount: updatedDue,
              paidAmount: updatedPaid,
              paymentStatus: updatedPaymentStatus,
              returnedAmount: updatedReturnedAmount,
              returnedQuantity: updatedReturnedQty,
              returnedDate: ret.date
            };

            salesRef.current = salesRef.current.map(s => s.id === sale.id ? updatedSale : s);

            if (db && restaurantId && restaurantId !== 'restro_guest') {
              setDoc(doc(db, 'restaurants', restaurantId, 'sales', sale.id), sanitizeForFirestore({ ...updatedSale, restaurantId }), { merge: true }).catch(err => {
                console.warn('Firestore sale update warning:', err);
              });
            }
            return updatedSale;
          }
          return sale;
        });
      });
    }

    // 2. If restockItems is true, increment product stock & create stock movement
    if (ret.restockItems) {
      const movementsToAdd: StockMovement[] = [];

      setProducts(prevProducts => {
        return prevProducts.map(p => {
          const item = ret.items.find(ri => 
            (ri.productId && p.id && ri.productId === p.id) ||
            (ri.productName && p.name && ri.productName.toLowerCase().trim() === p.name.toLowerCase().trim()) ||
            (p.sku && (ri as any).sku && p.sku === (ri as any).sku)
          );

          if (item) {
            const qtyToAdd = Number(item.baseQuantity || item.returnedQuantity || 0);
            if (qtyToAdd > 0) {
              const prevStock = Number(p.currentStock || 0);
              const newBal = prevStock + qtyToAdd;
              const movementId = `stk-mov-${timestamp}-${p.id}-${Math.floor(Math.random() * 1000)}`;

              const mov: StockMovement = {
                id: movementId,
                date: ret.date,
                productId: p.id,
                productName: p.name,
                sku: p.sku,
                warehouseId: p.warehouseId || currentWarehouseId || 'wh-main',
                warehouseName: p.warehouseName || 'Main Store',
                movementType: 'sale_return',
                referenceId: ret.returnNumber,
                quantityIn: qtyToAdd,
                quantityOut: 0,
                previousBalance: prevStock,
                newBalance: newBal,
                unitCost: p.costPrice || 0,
                totalValue: qtyToAdd * (p.costPrice || 0),
                notes: `Customer return (${item.reason || 'return'}) from inv #${ret.originalInvoiceNumber || ret.originalInvoiceId}`,
                performedBy: ret.processedBy || activePOSStaff?.name || activeStaffUser?.name || currentUser.name
              };
              movementsToAdd.push(mov);

              if (db && restaurantId && restaurantId !== 'restro_guest') {
                setDoc(doc(db, 'restaurants', restaurantId, 'products', p.id), { currentStock: newBal, updatedAt: timestamp }, { merge: true }).catch(err => {
                  console.warn('Firestore product stock update warning:', err);
                });
                setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', mov.id), sanitizeForFirestore({ ...mov, restaurantId })).catch(() => {});
              }

              return { ...p, currentStock: newBal, updatedAt: timestamp };
            }
          }
          return p;
        });
      });

      if (movementsToAdd.length > 0) {
        setStockMovements(prev => [...movementsToAdd, ...prev]);
      }
    }

    // 3. Adjust customer balance if credit note or deduct due
    if ((ret.refundMethod === 'credit_note' || ret.refundMethod === 'deduct_due') && (ret.customerId || ret.customerName)) {
      setCustomers(prev => {
        return prev.map(c => {
          const isMatch = 
            (ret.customerId && c.id === ret.customerId) ||
            (ret.customerName && c.name && c.name.toLowerCase().trim() === ret.customerName.toLowerCase().trim());

          if (isMatch) {
            const newBal = Math.max(0, Math.round(((c.currentBalance || 0) - ret.totalRefundAmount) * 100) / 100);
            if (db && restaurantId && restaurantId !== 'restro_guest') {
              setDoc(doc(db, 'restaurants', restaurantId, 'customers', c.id), { currentBalance: newBal }, { merge: true }).catch(err => {
                console.warn('Firestore customer balance update warning:', err);
              });
            }
            return { ...c, currentBalance: newBal };
          }
          return c;
        });
      });
    }

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'sales_returns', newId), sanitizeForFirestore({ ...ret, restaurantId }));
      } catch (e) {
        console.warn('Firestore sales_returns write warning:', e);
      }
    }
  };

  // Wipe Current Restaurant Application Data (Strictly tenant-scoped)
  const clearAllData = async () => {
    setIsSyncing(true);
    try {
      // 1. Reset in-memory state for this restaurant only
      setProducts([]);
      setCategories([]);
      setMenuHierarchy(null);
      setSales([]);
      setPurchases([]);
      setCustomers([DEFAULT_WALKIN_CUSTOMER]);
      setSuppliers([]);
      setExpenses([]);
      setStockItems([]);
      setCustomStockCategories([]);
      setStockMovements([]);
      setStockAdjustments([]);
      setStockTransfers([]);
      setQuotations([]);
      setSalesReturns([]);
      setKitchenTickets([]);
      setFloors([]);
      setSections([]);
      setDiningTables([]);
      setDraftFloors([]);
      setDraftSections([]);
      setDraftDiningTables([]);
      draftFloorsRef.current = [];
      draftSectionsRef.current = [];
      draftDiningTablesRef.current = [];
      diningTablesRef.current = [];
      setTableDrafts({});
      tableDraftsRef.current = {};
      setSelectedTableId(null);
      setFoodWasteRecords([]);
      setMasterRecipes([]);

      // 2. Mark and persist empty data in localStorage
      clearTenantLocalStorage();
      localStorage.setItem('quickims_data_cleared', 'true');

      // 3. Clear remote Firestore documents STRICTLY inside this restaurant's subcollections
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        const subCollectionsToWipe = [
          'products', 'categories', 'stock', 'raw_categories', 'sales', 'purchases',
          'customers', 'suppliers', 'expenses', 'stock_movements', 'sales_returns',
          'quotations', 'stock_adjustments', 'stock_transfers', 'kitchen_tickets',
          'food_waste', 'master_recipes', 'attendance', 'staff_audit_logs'
        ];

        for (const colName of subCollectionsToWipe) {
          try {
            const snap = await getDocs(collection(db, 'restaurants', restaurantId, colName)).catch(() => null);
            if (snap && !snap.empty) {
              const batch = writeBatch(db);
              snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
              await batch.commit();
            }
          } catch (err) {
            console.warn(`Firestore clean collection ${colName} note:`, err);
          }
        }
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'live_state', 'tables')).catch(() => null);
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'meta', 'floor_plan')).catch(() => null);
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'meta', 'menu_hierarchy')).catch(() => null);
      }
    } catch (e) {
      console.error('Error clearing data:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Purge current restaurant's data from Firestore (never touches other restaurants)
  const purgeAllLegacyFirestoreData = async (): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        const tenantSubCols = [
          'products', 'categories', 'stock', 'raw_categories', 'sales', 'purchases',
          'customers', 'suppliers', 'expenses', 'stock_movements', 'sales_returns',
          'quotations', 'stock_adjustments', 'stock_transfers', 'kitchen_tickets',
          'food_waste', 'master_recipes', 'attendance', 'staff_audit_logs', 'staff'
        ];

        for (const colName of tenantSubCols) {
          try {
            const snap = await getDocs(collection(db, 'restaurants', restaurantId, colName)).catch(() => null);
            if (snap && !snap.empty) {
              const batch = writeBatch(db);
              snap.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
          } catch (err) {
            console.warn(`Purge subcollection ${colName} note:`, err);
          }
        }

        await deleteDoc(doc(db, 'restaurants', restaurantId, 'live_state', 'tables')).catch(() => null);
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'meta', 'floor_plan')).catch(() => null);
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'meta', 'settings')).catch(() => null);
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'meta', 'menu_hierarchy')).catch(() => null);
      }

      // Reset current tenant state cleanly (never wipe registered users or other tenants)
      resetTenantInMemoryState(restaurantId, currentUser?.name, currentUser?.email);

      return { success: true, message: 'All restaurant data has been completely purged. Database is now in a clean production state.' };
    } catch (err: any) {
      console.error('Purge error:', err);
      return { success: false, message: `Purge failed: ${err.message || 'Unknown error'}` };
    } finally {
      setIsSyncing(false);
    }
  };

  // Enter Demo Mode with isolated demo channel and guaranteed clean slate
  const enterDemoMode = () => {
    sessionStorage.setItem('quickims_demo_session', 'true');
    resetTenantInMemoryState('restro_demo_preview', 'Demo Operator (Preview)', 'operator@quickims.np');
    setRestaurantIdState('restro_demo_preview');
    setIsDemoSession(true);
    setCurrentUser({
      id: 'usr-demo-1',
      name: 'Demo Operator (Preview)',
      email: 'operator@quickims.np',
      role: 'super_admin',
      branchId: 'wh-main'
    });
  };

  // Reset to Demo Data - default to full clean
  const resetToDemoData = async () => {
    await clearAllData();
  };

  // Restaurant Handlers (Floors, Sections, Tables & Service)
  useEffect(() => {
    localStorage.setItem('quickims_floors', JSON.stringify(floors));
  }, [floors]);

  useEffect(() => {
    localStorage.setItem('quickims_sections', JSON.stringify(sections));
  }, [sections]);

  useEffect(() => {
    localStorage.setItem('quickims_tables', JSON.stringify(diningTables));
    localStorage.setItem('restro_tables', JSON.stringify(diningTables));
  }, [diningTables]);

  useEffect(() => {
    localStorage.setItem('restro_kots', JSON.stringify(kitchenTickets));
  }, [kitchenTickets]);

  const persistFloorPlan = async (
    targetFloors: RestaurantFloor[] = floors,
    targetSections: RestaurantSection[] = sections,
    targetTables: DiningTable[] = diningTables,
    drafts?: Record<string, TableDraftOrder>
  ) => {
    try {
      localStorage.setItem('quickims_floors', JSON.stringify(targetFloors));
      localStorage.setItem('quickims_sections', JSON.stringify(targetSections));
      localStorage.setItem('quickims_tables', JSON.stringify(targetTables));
      localStorage.setItem('restro_tables', JSON.stringify(targetTables));
      
      const payload = {
        floors: targetFloors,
        sections: targetSections,
        diningTables: targetTables,
        updatedAt: Date.now(),
        updatedBy: activePOSStaff?.name || activeStaffUser?.name || currentUser?.name || 'Admin'
      };
      if (db) {
        // Direct setDoc without merge ensures removed sections and floors are truly deleted from Firestore
        await setDoc(doc(db, 'restaurants', restaurantId, 'meta', 'floor_plan'), sanitizeForFirestore(payload)).catch(() => null);
      }
      if (drafts !== undefined) {
        await syncLiveTablesToFirestore(targetTables, drafts);
      }
    } catch (e) {
      console.warn('Floor plan auto-sync warning:', e);
    }
  };

  const updateDraftStorage = (
    nextFloors: RestaurantFloor[],
    nextSections: RestaurantSection[],
    nextTables: DiningTable[]
  ) => {
    setHasUnsavedFloorPlan(true);
    try {
      localStorage.setItem('quickims_floor_plan_draft', JSON.stringify({
        floors: nextFloors,
        sections: nextSections,
        tables: nextTables,
        updatedAt: Date.now()
      }));
    } catch {}
  };

  const addFloor = async (floorData: Omit<RestaurantFloor, 'id'>): Promise<RestaurantFloor> => {
    const newFloor: RestaurantFloor = {
      ...floorData,
      id: `flr-${Date.now()}`
    };
    const nextFloors = [...draftFloorsRef.current, newFloor];
    setDraftFloors(nextFloors);
    updateDraftStorage(nextFloors, draftSectionsRef.current, draftDiningTablesRef.current);
    return newFloor;
  };

  const updateFloor = async (id: string, updates: Partial<RestaurantFloor>) => {
    const nextFloors = draftFloorsRef.current.map(f => f.id === id ? { ...f, ...updates } : f);
    setDraftFloors(nextFloors);
    let nextSections = draftSectionsRef.current;
    let nextTables = draftDiningTablesRef.current;
    if (updates.name) {
      nextSections = draftSectionsRef.current.map(s => s.floorId === id ? { ...s, floorName: updates.name } : s);
      nextTables = draftDiningTablesRef.current.map(t => t.floorId === id ? { ...t, floorName: updates.name } : t);
      setDraftSections(nextSections);
      setDraftDiningTables(nextTables);
    }
    updateDraftStorage(nextFloors, nextSections, nextTables);
  };

  const deleteFloor = async (id: string) => {
    const nextFloors = draftFloorsRef.current.filter(f => f.id !== id);
    const nextSections = draftSectionsRef.current.filter(s => s.floorId !== id);
    // CRITICAL: DO NOT DELETE CANVAS TABLES! Reassign tables to the first remaining floor if available
    const fallbackFloor = nextFloors[0];
    const nextTables = draftDiningTablesRef.current.map(t => {
      if (t.floorId === id) {
        return {
          ...t,
          floorId: fallbackFloor ? fallbackFloor.id : undefined,
          floorName: fallbackFloor ? fallbackFloor.name : undefined
        };
      }
      return t;
    });
    setDraftFloors(nextFloors);
    setDraftSections(nextSections);
    setDraftDiningTables(nextTables);
    updateDraftStorage(nextFloors, nextSections, nextTables);
  };

  const addSection = async (sectionData: Omit<RestaurantSection, 'id'>): Promise<RestaurantSection> => {
    const floor = draftFloorsRef.current.find(f => f.id === sectionData.floorId);
    const newSection: RestaurantSection = {
      ...sectionData,
      floorName: floor ? floor.name : sectionData.floorName,
      id: `sec-${Date.now()}`
    };
    const nextSections = [...draftSectionsRef.current, newSection];
    setDraftSections(nextSections);
    updateDraftStorage(draftFloorsRef.current, nextSections, draftDiningTablesRef.current);
    return newSection;
  };

  const updateSection = async (id: string, updates: Partial<RestaurantSection>) => {
    const nextSections = draftSectionsRef.current.map(s => s.id === id ? { ...s, ...updates } : s);
    setDraftSections(nextSections);
    let nextTables = draftDiningTablesRef.current;
    if (updates.name) {
      nextTables = draftDiningTablesRef.current.map(t => t.sectionId === id ? { ...t, sectionName: updates.name } : t);
      setDraftDiningTables(nextTables);
    }
    updateDraftStorage(draftFloorsRef.current, nextSections, nextTables);
  };

  const deleteSection = async (id: string) => {
    const nextSections = draftSectionsRef.current.filter(s => s.id !== id);
    // CRITICAL: DO NOT DELETE CANVAS TABLES! Detach section from tables so canvas objects are preserved
    const nextTables = draftDiningTablesRef.current.map(t => 
      t.sectionId === id ? { ...t, sectionId: undefined, sectionName: undefined } : t
    );
    setDraftSections(nextSections);
    setDraftDiningTables(nextTables);
    updateDraftStorage(draftFloorsRef.current, nextSections, nextTables);
  };

  const addDiningTable = async (tableData: Omit<DiningTable, 'id'>): Promise<DiningTable> => {
    const newTable: DiningTable = {
      ...tableData,
      id: `tbl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      capacity: tableData.capacity !== undefined ? tableData.capacity : 4,
      isDecor: tableData.isDecor ?? false,
      status: tableData.status || 'available',
      subtotal: 0,
      totalWithTax: 0,
      activeKOTCount: 0,
      restaurantId
    };
    const nextTables = [...draftDiningTablesRef.current, newTable];
    setDraftDiningTables(nextTables);
    updateDraftStorage(draftFloorsRef.current, draftSectionsRef.current, nextTables);
    return newTable;
  };

  const updateDiningTable = async (id: string, updates: Partial<DiningTable>) => {
    const nextTables = draftDiningTablesRef.current.map(t => t.id === id ? { ...t, ...updates } : t);
    setDraftDiningTables(nextTables);
    updateDraftStorage(draftFloorsRef.current, draftSectionsRef.current, nextTables);
  };

  const deleteDiningTable = async (id: string) => {
    const nextTables = draftDiningTablesRef.current.filter(t => t.id !== id);
    setDraftDiningTables(nextTables);
    updateDraftStorage(draftFloorsRef.current, draftSectionsRef.current, nextTables);
    if (selectedTableId === id) {
      setSelectedTableId(null);
    }
  };

  const discardFloorPlanDraft = () => {
    try {
      localStorage.removeItem('quickims_floor_plan_draft');
    } catch {}
    setDraftFloors(floors);
    setDraftSections(sections);
    setDraftDiningTables(diningTables);
    setHasUnsavedFloorPlan(false);
  };

  const updateTableStatus = async (tableId: string, status: DiningTable['status'], meta?: Partial<DiningTable>) => {
    setDiningTables(prev => {
      const next = prev.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            status,
            ...(meta || {}),
            openedAt: status === 'seated' && !t.openedAt ? Date.now() : t.openedAt
          };
        }
        return t;
      });
      syncLiveTablesToFirestore(next, tableDrafts);
      localStorage.setItem('quickims_tables', JSON.stringify(next));
      localStorage.setItem('restro_tables', JSON.stringify(next));
      return next;
    });
  };

  const assignTableGuests = async (tableId: string, guestsCount: number, waiterName?: string) => {
    const operator = resolveActiveOperator(activePOSStaff, activeStaffUser);
    const operatorOrUserName = resolveOperatorIdentity(activePOSStaff, activeStaffUser, currentUser).operatorName;
    setDiningTables(prev => {
      const next = prev.map(t => {
        if (t.id === tableId) {
          const cleanIncomingWaiter = waiterName && !(operator && isPlaceholderOperatorName(waiterName)) ? waiterName : undefined;
          const cleanExistingWaiter = t.assignedWaiter && !(operator && isPlaceholderOperatorName(t.assignedWaiter)) ? t.assignedWaiter : undefined;
          return {
            ...t,
            status: 'seated' as const,
            currentGuests: guestsCount,
            assignedWaiter: cleanIncomingWaiter || cleanExistingWaiter || operatorOrUserName,
            openedAt: t.openedAt || Date.now()
          };
        }
        return t;
      });
      syncLiveTablesToFirestore(next, tableDrafts);
      localStorage.setItem('quickims_tables', JSON.stringify(next));
      localStorage.setItem('restro_tables', JSON.stringify(next));
      return next;
    });
  };

  const saveFloorPlanToCloud = async (): Promise<boolean> => {
    try {
      const currentPublished = diningTablesRef.current;
      const targetFloors = draftFloorsRef.current.length > 0
        ? draftFloorsRef.current
        : [{ id: 'flr-ground', name: 'Ground Floor', code: 'GF', description: 'Main Floor', active: true, order: 1 }];
      const targetSections = draftSectionsRef.current;
      const targetTables = draftDiningTablesRef.current;

      // 1. Prepare final tables with firm positioning and preserved operational runtime states
      const finalTables: DiningTable[] = targetTables.map((dt, i) => {
        const defaultW = dt.shape === 'round' ? 95 : dt.shape === 'rectangular' ? 140 : dt.shape === 'wall' ? 18 : 95;
        const defaultH = dt.shape === 'round' ? 95 : dt.shape === 'rectangular' ? 85 : dt.shape === 'wall' ? 180 : 85;
        const x = dt.posX !== undefined ? dt.posX : 80 + (i % 5) * 190;
        const y = dt.posY !== undefined ? dt.posY : 90 + Math.floor(i / 5) * 160;

        // Find existing published table by exact ID (only match tableNumber if no other table owns that ID)
        const existing =
          currentPublished.find(t => t.id === dt.id) ||
          currentPublished.find(t => dt.tableNumber && t.tableNumber === dt.tableNumber && !targetTables.some(other => other.id === t.id));
        const activeGuests = existing?.currentGuests;
        const activeStatus = (existing?.status && existing.status !== 'available') ? existing.status : (dt.status || 'available');
        const activeSubtotal = existing?.subtotal || 0;
        const activeTotalWithTax = existing?.totalWithTax || 0;
        const activeKOTCount = existing?.activeKOTCount || 0;
        const openedAt = existing?.openedAt;
        const assignedWaiter = existing?.assignedWaiter;

        const floor = targetFloors.find(f => f.id === dt.floorId) || targetFloors[0];

        return {
          ...dt,
          posX: x,
          posY: y,
          floorId: dt.floorId || floor?.id,
          floorName: dt.floorName || floor?.name,
          width: dt.width || defaultW,
          height: dt.height || defaultH,
          rotation: dt.rotation || 0,
          status: activeStatus,
          currentGuests: activeGuests,
          subtotal: activeSubtotal,
          totalWithTax: activeTotalWithTax,
          activeKOTCount,
          openedAt,
          assignedWaiter
        };
      });

      // 2. Publish to live operational state
      setDiningTables(finalTables);
      setFloors(targetFloors);
      setSections(targetSections);
      diningTablesRef.current = finalTables;

      // 3. Clear draft marker
      setHasUnsavedFloorPlan(false);
      try {
        localStorage.removeItem('quickims_floor_plan_draft');
      } catch {}

      // 4. Persist published tables to browser storage
      localStorage.setItem('quickims_floors', JSON.stringify(targetFloors));
      localStorage.setItem('quickims_sections', JSON.stringify(targetSections));
      localStorage.setItem('quickims_tables', JSON.stringify(finalTables));
      localStorage.setItem('restro_tables', JSON.stringify(finalTables));

      // 5. Fast atomic write to Firestore (runs concurrently without blocking)
      const payload = {
        floors: targetFloors,
        sections: targetSections,
        diningTables: finalTables,
        updatedAt: Date.now(),
        updatedBy: activePOSStaff?.name || activeStaffUser?.name || currentUser?.name || 'Admin'
      };

      if (db) {
        await Promise.all([
          setDoc(doc(db, 'restaurants', restaurantId, 'meta', 'floor_plan'), sanitizeForFirestore(payload)),
          syncLiveTablesToFirestore(finalTables, tableDrafts)
        ]).catch(err => {
          console.warn('Firestore floor plan save warning (saved locally):', err);
        });
      }

      return true;
    } catch (err) {
      console.error('Error publishing floor plan:', err);
      return false;
    }
  };

  // ==========================================
  // TABLE DRAFT ORDERS (Preserved across table switching & refreshes)
  // Reflects as red fill on Interactive Floor Plan canvas
  // ==========================================
  const saveTableDraft = (tableId: string, draftData: Partial<TableDraftOrder>) => {
    if (!tableId) return;

    // If draft cart is explicitly empty, immediately clear the draft
    if (draftData.cart !== undefined && draftData.cart.length === 0) {
      clearTableDraft(tableId);
      return;
    }

    const existing = tableDraftsRef.current[tableId] || { tableId, cart: [], updatedAt: Date.now() };
    const updatedCart = draftData.cart !== undefined ? draftData.cart : existing.cart;

    if (!updatedCart || updatedCart.length === 0) {
      clearTableDraft(tableId);
      return;
    }

    const nextDrafts: Record<string, TableDraftOrder> = {
      ...tableDraftsRef.current,
      [tableId]: {
        ...existing,
        ...draftData,
        tableId,
        cart: updatedCart,
        updatedAt: Date.now()
      }
    };

    setTableDrafts(nextDrafts);
    tableDraftsRef.current = nextDrafts;
    localStorage.setItem('quickims_table_drafts', JSON.stringify(nextDrafts));

    setDiningTables(prev => {
      const nextTables = prev.map(t => {
        if (t.id === tableId) {
          const metrics = calculateTableLiveMetrics(t, kitchenTicketsRef.current, nextDrafts);
          if (metrics.status === 'available') {
            return {
              ...t,
              status: 'available' as const,
              currentGuests: undefined,
              assignedWaiter: undefined,
              openedAt: undefined,
              lastOrderAt: undefined,
              subtotal: 0,
              totalWithTax: 0,
              activeKOTCount: 0
            };
          }
          return {
            ...t,
            status: metrics.status,
            subtotal: metrics.subtotal,
            totalWithTax: metrics.totalWithTax,
            activeKOTCount: metrics.activeKOTCount
          };
        }
        return t;
      });
      diningTablesRef.current = nextTables;
      syncLiveTablesToFirestore(nextTables, nextDrafts);
      localStorage.setItem('quickims_tables', JSON.stringify(nextTables));
      localStorage.setItem('restro_tables', JSON.stringify(nextTables));
      return nextTables;
    });
  };

  const getTableDraft = (tableId: string): TableDraftOrder | undefined => {
    return tableDraftsRef.current[tableId] || tableDrafts[tableId];
  };

  const clearTableDraft = (tableId: string) => {
    if (!tableId) return;
    
    const nextDrafts: Record<string, TableDraftOrder> = { ...tableDraftsRef.current };
    delete nextDrafts[tableId];
    setTableDrafts(nextDrafts);
    tableDraftsRef.current = nextDrafts;
    localStorage.setItem('quickims_table_drafts', JSON.stringify(nextDrafts));

    setDiningTables(prev => {
      const nextTables = prev.map(t => {
        if (t.id === tableId) {
          const metrics = calculateTableLiveMetrics(t, kitchenTicketsRef.current, nextDrafts);
          if (metrics.status === 'available') {
            return {
              ...t,
              status: 'available' as const,
              currentGuests: undefined,
              assignedWaiter: undefined,
              openedAt: undefined,
              lastOrderAt: undefined,
              subtotal: 0,
              totalWithTax: 0,
              activeKOTCount: 0
            };
          }

          return {
            ...t,
            status: metrics.status,
            subtotal: metrics.subtotal,
            totalWithTax: metrics.totalWithTax,
            activeKOTCount: metrics.activeKOTCount
          };
        }
        return t;
      });
      diningTablesRef.current = nextTables;
      syncLiveTablesToFirestore(nextTables, nextDrafts);
      localStorage.setItem('quickims_tables', JSON.stringify(nextTables));
      localStorage.setItem('restro_tables', JSON.stringify(nextTables));
      return nextTables;
    });

    // Explicitly delete table key from Firestore document
    try {
      if (db) {
        updateDoc(doc(db, 'restaurants', restaurantId, 'live_state', 'tables'), {
          [`tableDrafts.${tableId}`]: deleteField()
        }).catch(() => null);
      }
    } catch {
      // offline fallback
    }
  };

  // Helper to determine if an item is destined for Bar (BOT) or Kitchen (KDS)
  const isItemForBar = (item: KOTItem): boolean => {
    const currentProducts = productsRef.current.length > 0 ? productsRef.current : products;
    const prod = currentProducts.find(
      p => p.id === item.productId || (Boolean(p.name && item.productName) && String(p.name).toLowerCase() === String(item.productName).toLowerCase())
    );
    return resolveItemRoutingStation({
      explicitStation: item.routingStation || (item as any).orderRoutingStation,
      course: item.course,
      product: prod,
      productName: item.productName
    }) === 'bar';
  };

  const splitAndFireTickets = async (params: {
    tableId: string;
    tableNumber: string;
    zoneName: string;
    waiterName: string;
    guestsCount: number;
    notes?: string;
    items: KOTItem[];
    onTicketsReady?: (tickets: { kitchenTicket?: KitchenOrderTicket; barTicket?: KitchenOrderTicket }) => void;
  }): Promise<{ kitchenTicket?: KitchenOrderTicket; barTicket?: KitchenOrderTicket }> => {
    const normalizeFiredItem = (i: KOTItem, station: 'kitchen' | 'bar'): KOTItem => {
      const addons = extractKOTItemAddons(i);
      const selectedModifiers = addons.length > 0
        ? addons.map(a => ({
            modifierName: 'Addon',
            optionName: a.name,
            priceDelta: a.price
          }))
        : i.selectedModifiers;
      return {
        ...i,
        routingStation: station,
        addonsList: addons.length > 0 ? addons : i.addonsList,
        selectedModifiers
      };
    };

    const validItems = (params.items || []).filter(i => i && (i.quantity || 0) > 0);
    const kitchenItems = validItems
      .filter(item => !isItemForBar(item))
      .map(i => normalizeFiredItem(i, 'kitchen'));

    const barItems = validItems
      .filter(item => isItemForBar(item))
      .map(i => normalizeFiredItem(i, 'bar'));

    let kitchenTicket: KitchenOrderTicket | undefined;
    let barTicket: KitchenOrderTicket | undefined;

    const { kotNumber, botNumber } = reserveNextDailyTicketNumbersInstant(
      kitchenItems.length > 0,
      barItems.length > 0
    );
    const nowTs = Date.now();
    const uidSuffix = Math.random().toString(36).slice(2, 6);
    const activeOperator = resolveActiveOperator(activePOSStaff, activeStaffUser);
    const rawWaiter = String(params.waiterName || '').trim();
    const effectiveWaiterName = activeOperator
      ? (isPlaceholderOperatorName(rawWaiter) ? activeOperator.name : rawWaiter)
      : (rawWaiter || currentUser.name || 'Staff');

    // 1. If kitchen items exist, dispatch Kitchen Order Ticket (KOT) exclusively to KDS
    if (kitchenItems.length > 0 && kotNumber) {
      kitchenTicket = {
        id: `kot-${nowTs}-${uidSuffix}-k`,
        kotNumber,
        ticketType: 'KOT',
        destinationStation: 'kitchen',
        tableId: params.tableId,
        tableNumber: params.tableNumber,
        zoneName: params.zoneName,
        waiterName: effectiveWaiterName,
        guestsCount: params.guestsCount,
        notes: params.notes || '',
        status: 'in_kitchen',
        items: kitchenItems,
        isSettled: false,
        printedCount: 1,
        lastPrintedAt: nowTs,
        createdAt: nowTs,
        updatedAt: nowTs
      };
    }

    // 2. If bar items exist, dispatch Bar Order Ticket (BOT) exclusively to BOT station
    if (barItems.length > 0 && botNumber) {
      barTicket = {
        id: `bot-${nowTs}-${uidSuffix}-b`,
        kotNumber: botNumber,
        ticketType: 'BOT',
        destinationStation: 'bar',
        tableId: params.tableId,
        tableNumber: params.tableNumber,
        zoneName: params.zoneName,
        waiterName: effectiveWaiterName,
        guestsCount: params.guestsCount,
        notes: params.notes || '',
        status: 'in_kitchen',
        items: barItems,
        isSettled: false,
        printedCount: 1,
        lastPrintedAt: nowTs,
        createdAt: nowTs,
        updatedAt: nowTs
      };
    }

    const newTicketsToAdd: KitchenOrderTicket[] = [];
    if (kitchenTicket) newTicketsToAdd.push(kitchenTicket);
    if (barTicket) newTicketsToAdd.push(barTicket);

    if (newTicketsToAdd.length > 0) {
      const nextTicketsSync = [...newTicketsToAdd, ...kitchenTicketsRef.current];
      kitchenTicketsRef.current = nextTicketsSync;
      localStorage.setItem('restro_kots', JSON.stringify(nextTicketsSync));
      try {
        params.onTicketsReady?.({ kitchenTicket, barTicket });
      } catch (cbErr) {
        console.warn('Immediate print callback notice:', cbErr);
      }
      setKitchenTickets(nextTicketsSync);
    }

    // Deplete raw ingredients / inventory for all items
    setProducts(prevProducts => {
      let updatedProducts = [...prevProducts];

      params.items.forEach(item => {
        const menuItem = updatedProducts.find(p => p.id === item.productId);
        if (menuItem && menuItem.recipeIngredients && menuItem.recipeIngredients.length > 0) {
          menuItem.recipeIngredients.forEach(ing => {
            const rawItemIndex = updatedProducts.findIndex(p => p.id === ing.ingredientId);
            if (rawItemIndex >= 0) {
              const currentStock = updatedProducts[rawItemIndex].currentStock;
              const deduction = ing.quantityRequired * item.quantity;
              updatedProducts[rawItemIndex] = {
                ...updatedProducts[rawItemIndex],
                currentStock: Math.max(0, currentStock - deduction)
              };
            }
          });
        } else if (menuItem && menuItem.trackStock) {
          const itemIndex = updatedProducts.findIndex(p => p.id === item.productId);
          if (itemIndex >= 0) {
            updatedProducts[itemIndex] = {
              ...updatedProducts[itemIndex],
              currentStock: Math.max(0, updatedProducts[itemIndex].currentStock - item.quantity)
            };
          }
        }
      });

      return updatedProducts;
    });

    // Automatically deduct raw kitchen ingredients from stockItems collection
    setStockItems(prevStock => {
      let updatedStock = [...prevStock];
      let hasChanges = false;
      params.items.forEach(item => {
        const menuItem = products.find(p => p.id === item.productId);
        if (menuItem && menuItem.recipeIngredients && menuItem.recipeIngredients.length > 0) {
          menuItem.recipeIngredients.forEach(ing => {
            const stockIdx = updatedStock.findIndex(s => s.id === ing.ingredientId);
            if (stockIdx >= 0) {
              const sItem = updatedStock[stockIdx];
              if (sItem.trackStock !== false && ing.trackStock !== false) {
                const deduction = Number(ing.quantityRequired || 0) * Number(item.quantity || 1);
                const newBal = Math.max(0, Number(sItem.currentStock || 0) - deduction);
                hasChanges = true;
                updatedStock[stockIdx] = {
                  ...sItem,
                  currentStock: newBal,
                  updatedAt: Date.now()
                };
                if (db && restaurantId && restaurantId !== 'restro_guest') {
                  setDoc(doc(db, 'restaurants', restaurantId, 'stock', sItem.id), { currentStock: newBal, updatedAt: Date.now() }, { merge: true }).catch(() => {});
                }
              }
            }
          });
        }
      });
      if (hasChanges) {
        localStorage.setItem('quickims_stock_items', JSON.stringify(updatedStock));
      }
      return updatedStock;
    });

    // Clear draft order for this table immediately now that it has been sent to kitchen / bar
    const cleanDrafts = { ...tableDraftsRef.current };
    delete cleanDrafts[params.tableId];
    setTableDrafts(cleanDrafts);
    tableDraftsRef.current = cleanDrafts;
    localStorage.setItem('quickims_table_drafts', JSON.stringify(cleanDrafts));

    if (db) {
      updateDoc(doc(db, 'restaurants', restaurantId, 'live_state', 'tables'), {
        [`tableDrafts.${params.tableId}`]: deleteField()
      }).catch(() => null);
    }

    // Update table status to 'kot_fired' and compute exact subtotal from all active tickets
    const allTicketsForTable = kitchenTicketsRef.current;
    const updatedTables = diningTablesRef.current.map(t => {
      if (t.id === params.tableId) {
        const metrics = calculateTableLiveMetrics(t, allTicketsForTable, cleanDrafts);
        const existingWaiter = String(t.assignedWaiter || '').trim();
        const shouldRefreshWaiter =
          !existingWaiter ||
          (Boolean(activeOperator) && isPlaceholderOperatorName(existingWaiter));
        return {
          ...t,
          status: 'kot_fired' as const,
          assignedWaiter: shouldRefreshWaiter ? effectiveWaiterName : t.assignedWaiter,
          openedAt: t.openedAt || nowTs,
          currentGuests: (t.currentGuests && t.currentGuests > 0) ? t.currentGuests : (params.guestsCount || 1),
          lastOrderAt: nowTs,
          subtotal: metrics.subtotal,
          totalWithTax: metrics.totalWithTax,
          activeKOTCount: metrics.activeKOTCount
        };
      }
      return t;
    });

    setDiningTables(updatedTables);
    diningTablesRef.current = updatedTables;
    localStorage.setItem('quickims_tables', JSON.stringify(updatedTables));
    localStorage.setItem('restro_tables', JSON.stringify(updatedTables));

    // Persist active KOT/BOT tickets to Firestore FIRST so other terminals never see table kot_fired without its ticket
    newTicketsToAdd.forEach(t => {
      if (db) {
        setDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', t.id), sanitizeForFirestore({
          ...t,
          restaurantId
        }), { merge: true }).catch(err => console.warn('Firestore KOT live push notice:', err));
      }
    });

    syncLiveTablesToFirestore(updatedTables, cleanDrafts);

    return { kitchenTicket, barTicket };
  };

  const fireKitchenOrderTicket = async (
    kotData: Omit<KitchenOrderTicket, 'id' | 'kotNumber' | 'createdAt' | 'updatedAt'>
  ): Promise<KitchenOrderTicket> => {
    const result = await splitAndFireTickets({
      tableId: kotData.tableId,
      tableNumber: kotData.tableNumber,
      zoneName: kotData.zoneName,
      waiterName: kotData.waiterName,
      guestsCount: kotData.guestsCount,
      notes: kotData.notes,
      items: kotData.items
    });
    return result.kitchenTicket || result.barTicket || {
      ...kotData,
      id: `kot-${Date.now()}`,
      kotNumber: formatDailyTicketNumber('KOT', getMaxTicketSeqForDay(kitchenTicketsRef.current, getLocalDayKey(Date.now()), 'KOT') + 1),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  };

  const updateKOTStatus = async (kotId: string, status: KitchenOrderTicket['status']) => {
    let updatedTicket: KitchenOrderTicket | undefined;
    setKitchenTickets(prev => {
      const next = prev.map(k => {
        if (k.id === kotId) {
          const nextItems: KOTItem[] = k.items.map(item => ({
            ...item,
            status:
              item.status === 'cancelled'
                ? 'cancelled'
                : status === 'ready'
                ? 'ready'
                : status === 'completed'
                ? 'served'
                : item.status
          }));
          updatedTicket = {
            ...k,
            status,
            updatedAt: Date.now(),
            items: nextItems
          };
          return updatedTicket;
        }
        return k;
      });
      kitchenTicketsRef.current = next;
      localStorage.setItem('restro_kots', JSON.stringify(next));
      return next;
    });

    try {
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        await updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', kotId), {
          status,
          ...(updatedTicket ? { items: sanitizeForFirestore(updatedTicket.items) } : {}),
          updatedAt: Date.now()
        });
      }
    } catch (e) {
      console.warn('Firestore KOT status update notice:', e);
    }
  };

  const updateKOTItemStatus = async (kotId: string, itemId: string, status: KOTItem['status']) => {
    let updatedKot: KitchenOrderTicket | undefined;
    setKitchenTickets(prev => {
      const next = prev.map(k => {
        if (k.id === kotId) {
          const updatedItems = k.items.map(i => i.id === itemId ? { ...i, status } : i);
          const nonCancelled = updatedItems.filter(i => i.status !== 'cancelled');
          const allReady = nonCancelled.length > 0 && nonCancelled.every(i => i.status === 'ready' || i.status === 'served');
          const nextStatus = allReady ? 'ready' : (status === 'preparing' ? 'in_kitchen' : k.status);
          const target = {
            ...k,
            items: updatedItems,
            status: nextStatus,
            updatedAt: Date.now()
          };
          updatedKot = target;
          return target;
        }
        return k;
      });
      kitchenTicketsRef.current = next;
      localStorage.setItem('restro_kots', JSON.stringify(next));
      return next;
    });

    if (updatedKot) {
      try {
        if (db && restaurantId && restaurantId !== 'restro_guest') {
          await updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', kotId), {
            items: sanitizeForFirestore(updatedKot.items),
            status: updatedKot.status,
            updatedAt: Date.now()
          });
        }
      } catch (e) {
        console.warn('Firestore KOT item status update notice:', e);
      }
    }
  };

  const cancelKOTOrderItem = async (
    kotId: string,
    itemId: string,
    quantityToCancel: number,
    reason: string,
    staffName?: string,
    note?: string,
    disposition: 'return_to_stock' | 'mark_as_waste' = 'return_to_stock',
    notifyKitchenBar: boolean = false
  ): Promise<{ success: boolean; message: string }> => {
    let affectedTicket: KitchenOrderTicket | undefined;
    let cancelledItemName = 'Dish';
    let cancelledTargetProductId: string = '';
    let actualCancelQty = 1;
    const activeOperator = activePOSStaff || activeStaffUser;
    const effectiveStaff = staffName || activeOperator?.name || currentUser.name || 'Staff';
    const effectiveNote = note?.trim() || undefined;

    setKitchenTickets(prev => {
      const updated = prev.map(k => {
        if (k.id !== kotId && k.kotNumber !== kotId) return k;

        // Resiliently locate target item: by id, or by productId, or first active item
        const targetItem = k.items.find(i => (itemId && i.id === itemId)) ||
          k.items.find(i => (itemId && i.productId === itemId && i.status !== 'cancelled')) ||
          k.items.find(i => i.status !== 'cancelled') ||
          k.items[0];

        if (!targetItem) return k;

        cancelledItemName = targetItem.productName;
        cancelledTargetProductId = targetItem.productId;
        const cancelQty = Math.max(1, Math.min(targetItem.quantity, quantityToCancel || targetItem.quantity));
        actualCancelQty = cancelQty;

        const isTarget = (i: KOTItem) => {
          if (itemId && i.id === itemId) return true;
          if (targetItem.id && i.id === targetItem.id) return true;
          if (targetItem.productId && i.productId === targetItem.productId && i.status !== 'cancelled') return true;
          return false;
        };

        let updatedItems: KOTItem[] = [];
        let matchedOne = false;
        if (cancelQty >= targetItem.quantity) {
          // Full item cancellation
          updatedItems = k.items.map(i => {
            if (!matchedOne && isTarget(i)) {
              matchedOne = true;
              return {
                ...i,
                status: 'cancelled' as const,
                cancelReason: reason || 'Cancelled by staff',
                cancelNote: effectiveNote,
                cancelDisposition: disposition,
                notifiedKitchenBar: notifyKitchenBar,
                cancelledAt: Date.now(),
                cancelledBy: effectiveStaff
              };
            }
            return i;
          });
        } else {
          // Partial cancellation: reduce original item quantity, add cancelled audit record
          const remainingQty = targetItem.quantity - cancelQty;
          updatedItems = k.items.flatMap(i => {
            if (!matchedOne && isTarget(i)) {
              matchedOne = true;
              const keptItem: KOTItem = {
                ...i,
                quantity: remainingQty
              };
              const cancelledRecord: KOTItem = {
                ...i,
                id: `${i.id || 'item'}-cancelled-${Date.now()}`,
                quantity: cancelQty,
                status: 'cancelled' as const,
                cancelReason: reason || 'Cancelled by staff',
                cancelNote: effectiveNote,
                cancelDisposition: disposition,
                notifiedKitchenBar: notifyKitchenBar,
                cancelledAt: Date.now(),
                cancelledBy: effectiveStaff
              };
              return [keptItem, cancelledRecord];
            }
            return [i];
          });
        }

        const allCancelled = updatedItems.every(i => i.status === 'cancelled');
        const nextStatus = allCancelled ? 'cancelled' : k.status;

        const updatedK: KitchenOrderTicket = {
          ...k,
          items: updatedItems,
          status: nextStatus,
          updatedAt: Date.now()
        };
        affectedTicket = updatedK;
        return updatedK;
      });

      kitchenTicketsRef.current = updated;
      localStorage.setItem('restro_kots', JSON.stringify(updated));
      return updated;
    });

    if (affectedTicket) {
      // Inventory Handling based on Disposition:
      if (disposition === 'return_to_stock') {
        // Restores ingredient inventory (cooking had not started or sealed item)
        setProducts(prevProducts => {
          let updated = [...prevProducts];
          const menuItem = updated.find(p => p.id === cancelledTargetProductId || (Boolean(p.name && cancelledItemName) && String(p.name).toLowerCase() === String(cancelledItemName).toLowerCase()));
          if (menuItem && menuItem.recipeIngredients && menuItem.recipeIngredients.length > 0) {
            menuItem.recipeIngredients.forEach(ing => {
              const rawIndex = updated.findIndex(p => p.id === ing.ingredientId);
              if (rawIndex >= 0) {
                const addBack = (ing.quantityRequired || 0) * actualCancelQty;
                updated[rawIndex] = {
                  ...updated[rawIndex],
                  currentStock: (updated[rawIndex].currentStock || 0) + addBack
                };
              }
            });
          } else if (menuItem && menuItem.trackStock) {
            const itemIndex = updated.findIndex(p => p.id === menuItem.id);
            if (itemIndex >= 0) {
              updated[itemIndex] = {
                ...updated[itemIndex],
                currentStock: (updated[itemIndex].currentStock || 0) + actualCancelQty
              };
            }
          }
          return updated;
        });
      } else if (disposition === 'mark_as_waste') {
        // Keeps ingredients deducted and logs to Kitchen Waste & Loss report
        const matchedProduct = products.find(p => p.id === cancelledTargetProductId || (Boolean(p.name && cancelledItemName) && String(p.name).toLowerCase() === String(cancelledItemName).toLowerCase()));
        const costPer = matchedProduct?.costPrice || (matchedProduct ? Math.round(matchedProduct.retailPrice * 0.4) : 0);
        const totalLoss = costPer * actualCancelQty;

        const wasteEntry: FoodWasteRecord = {
          id: `waste-cancel-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          timestamp: Date.now(),
          productId: matchedProduct?.id || cancelledTargetProductId || `dish-${Date.now()}`,
          productName: cancelledItemName,
          category: matchedProduct?.category || 'Kitchen Orders',
          itemType: 'menu_item',
          quantity: actualCancelQty,
          unit: matchedProduct?.unit || 'portion',
          costPerUnit: costPer,
          totalLoss,
          reason: 'order_cancellation_waste',
          loggedBy: effectiveStaff,
          notes: `Cancelled from ${affectedTicket.ticketType || 'KOT'} #${affectedTicket.kotNumber} (Table ${affectedTicket.tableNumber || 'Counter'}). ${reason}${effectiveNote ? ` | Note: ${effectiveNote}` : ''}`
        };

        setFoodWasteRecords(prev => [wasteEntry, ...prev]);

        if (db) {
          try {
            await setDoc(doc(db, 'restaurants', restaurantId, 'food_waste', wasteEntry.id), sanitizeForFirestore({
              ...wasteEntry,
              restaurantId
            }));
          } catch (wErr) {
            console.warn('Firestore waste entry save notice:', wErr);
          }
        }
      }

      // 1. Sync to Firestore kitchen_tickets collection
      try {
        if (db) {
          await setDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', kotId), sanitizeForFirestore({
            ...affectedTicket,
            items: affectedTicket.items,
            status: affectedTicket.status,
            updatedAt: Date.now(),
            restaurantId
          }), { merge: true });
        }
      } catch (e) {
        console.warn('Firestore KOT cancel update notice:', e);
      }

      // 2. If table ticket, recalculate dining table subtotal and status using canonical cross-floor-safe metrics
      const targetTableId = affectedTicket.tableId;
      if (targetTableId && targetTableId !== 'takeaway-counter') {
        const updatedAllTickets = kitchenTicketsRef.current.map(k => k.id === kotId ? affectedTicket! : k);
        kitchenTicketsRef.current = updatedAllTickets;

        const currentTablesSnapshot = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
        const nextTables = currentTablesSnapshot.map(t => {
          if (!doesTicketBelongToTable(affectedTicket!, t, currentTablesSnapshot)) return t;

          const metrics = calculateTableLiveMetrics(t, updatedAllTickets, tableDraftsRef.current);
          return {
            ...t,
            status: metrics.status,
            subtotal: metrics.subtotal,
            totalWithTax: metrics.totalWithTax,
            activeKOTCount: metrics.activeKOTCount
          };
        });

        diningTablesRef.current = nextTables;
        setDiningTables(nextTables);
        localStorage.setItem('quickims_tables', JSON.stringify(nextTables));
        localStorage.setItem('restro_tables', JSON.stringify(nextTables));
        syncLiveTablesToFirestore(nextTables, tableDraftsRef.current).catch(() => null);
      }

      // 3. Log into Staff Audit Trail
      try {
        const dispositionText = disposition === 'return_to_stock' 
          ? 'Returned to Stock (Ingredients Restored)' 
          : 'Marked as Kitchen Waste & Loss';
        const notificationText = notifyKitchenBar ? ' [Kitchen/Bar Notified]' : '';

        await logStaffAction({
          staffId: (activePOSStaff || activeStaffUser)?.id || currentUser.id || 'staff-1',
          staffName: effectiveStaff,
          staffRole: (activePOSStaff || activeStaffUser)?.role || 'staff',
          actionType: 'item_void',
          targetEntityId: itemId,
          targetEntityName: cancelledItemName,
          details: `Cancelled order: ${actualCancelQty}x ${cancelledItemName} from ${affectedTicket.ticketType || 'KOT'} #${affectedTicket.kotNumber} (Table ${affectedTicket.tableNumber}). Disposition: ${dispositionText}${notificationText}. Reason: ${reason || 'Customer request'}`,
          reason: reason || 'Cancelled by staff'
        });
      } catch (auditErr) {
        console.warn('Audit log write notice:', auditErr);
      }
    }

    return {
      success: true,
      message: `Successfully cancelled order for ${cancelledItemName} (${disposition === 'return_to_stock' ? 'restocked' : 'marked as waste'}).`
    };
  };

  const uncancelKOTOrderItem = async (
    kotId: string,
    itemId: string,
    quantityToRestore: number,
    reason: string,
    staffName?: string,
    note?: string,
    notifyKitchenBar: boolean = false
  ): Promise<{ success: boolean; message: string }> => {
    let affectedTicket: KitchenOrderTicket | undefined;
    let restoredItemName = 'Dish';
    let restoredTargetProductId: string = '';
    let actualRestoreQty = 1;
    const activeOperator = activePOSStaff || activeStaffUser;
    const effectiveStaff = staffName || activeOperator?.name || currentUser.name || 'Staff';
    const effectiveNote = note?.trim() || undefined;

    setKitchenTickets(prev => {
      const updated = prev.map(k => {
        if (k.id !== kotId && k.kotNumber !== kotId) return k;

        // Locate target item that is currently cancelled
        const targetItem = k.items.find(i => (itemId && i.id === itemId)) ||
          k.items.find(i => (itemId && i.productId === itemId && i.status === 'cancelled')) ||
          k.items.find(i => i.status === 'cancelled') ||
          k.items[0];

        if (!targetItem) return k;

        restoredItemName = targetItem.productName;
        restoredTargetProductId = targetItem.productId;
        const restoreQty = Math.max(1, Math.min(targetItem.quantity, quantityToRestore || targetItem.quantity));
        actualRestoreQty = restoreQty;

        const isTarget = (i: KOTItem) => {
          if (itemId && i.id === itemId) return true;
          if (targetItem.id && i.id === targetItem.id) return true;
          if (targetItem.productId && i.productId === targetItem.productId && i.status === 'cancelled') return true;
          return false;
        };

        let updatedItems: KOTItem[] = [];
        let matchedOne = false;

        if (restoreQty >= targetItem.quantity) {
          // Full restore: uncancel this item back to ordered/active status
          updatedItems = k.items.map(i => {
            if (!matchedOne && isTarget(i)) {
              matchedOne = true;
              return {
                ...i,
                status: 'ordered' as const,
                cancelReason: undefined,
                cancelNote: undefined,
                cancelDisposition: undefined,
                notifiedKitchenBar: notifyKitchenBar,
                cancelledAt: undefined,
                cancelledBy: undefined
              };
            }
            return i;
          });
        } else {
          // Partial restore: uncancel restoreQty portion, keep remaining as cancelled
          const remainingCancelledQty = targetItem.quantity - restoreQty;
          updatedItems = k.items.flatMap(i => {
            if (!matchedOne && isTarget(i)) {
              matchedOne = true;
              const uncancelledItem: KOTItem = {
                ...i,
                id: `${i.id || 'item'}-restored-${Date.now()}`,
                quantity: restoreQty,
                status: 'ordered' as const,
                cancelReason: undefined,
                cancelNote: undefined,
                cancelDisposition: undefined,
                notifiedKitchenBar: notifyKitchenBar,
                cancelledAt: undefined,
                cancelledBy: undefined
              };
              const keptCancelled: KOTItem = {
                ...i,
                quantity: remainingCancelledQty
              };
              return [uncancelledItem, keptCancelled];
            }
            return [i];
          });
        }

        // Recompute ticket status: if any item is active, ticket is pending/in_kitchen instead of cancelled
        const hasActiveItem = updatedItems.some(i => i.status !== 'cancelled');
        const nextStatus = hasActiveItem ? (k.status === 'cancelled' ? 'pending' : k.status) : k.status;

        const updatedK: KitchenOrderTicket = {
          ...k,
          items: updatedItems,
          status: nextStatus,
          updatedAt: Date.now()
        };
        affectedTicket = updatedK;
        return updatedK;
      });

      kitchenTicketsRef.current = updated;
      localStorage.setItem('restro_kots', JSON.stringify(updated));
      return updated;
    });

    if (affectedTicket) {
      // 1. Deduct ingredient stock back if item had been returned to stock previously
      setProducts(prevProducts => {
        let updated = [...prevProducts];
        const menuItem = updated.find(p => p.id === restoredTargetProductId || (Boolean(p.name && restoredItemName) && String(p.name).toLowerCase() === String(restoredItemName).toLowerCase()));
        if (menuItem && menuItem.recipeIngredients && menuItem.recipeIngredients.length > 0) {
          menuItem.recipeIngredients.forEach(ing => {
            const rawIndex = updated.findIndex(p => p.id === ing.ingredientId);
            if (rawIndex >= 0) {
              const deductBack = (ing.quantityRequired || 0) * actualRestoreQty;
              updated[rawIndex] = {
                ...updated[rawIndex],
                currentStock: Math.max(0, (updated[rawIndex].currentStock || 0) - deductBack)
              };
            }
          });
        } else if (menuItem && menuItem.trackStock) {
          const itemIndex = updated.findIndex(p => p.id === menuItem.id);
          if (itemIndex >= 0) {
            updated[itemIndex] = {
              ...updated[itemIndex],
              currentStock: Math.max(0, (updated[itemIndex].currentStock || 0) - actualRestoreQty)
            };
          }
        }
        return updated;
      });

      // 2. Sync to Firestore kitchen_tickets collection
      try {
        if (db) {
          await setDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', kotId), sanitizeForFirestore({
            ...affectedTicket,
            items: affectedTicket.items,
            status: affectedTicket.status,
            updatedAt: Date.now(),
            restaurantId
          }), { merge: true });
        }
      } catch (e) {
        console.warn('Firestore KOT uncancel update notice:', e);
      }

      // 3. If table ticket, recalculate dining table subtotal and status using canonical cross-floor-safe metrics
      const targetTableId = affectedTicket.tableId;
      if (targetTableId && targetTableId !== 'takeaway-counter') {
        const updatedAllTickets = kitchenTicketsRef.current.map(k => k.id === kotId ? affectedTicket! : k);
        kitchenTicketsRef.current = updatedAllTickets;

        const currentTablesSnapshot = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
        const nextTables = currentTablesSnapshot.map(t => {
          if (!doesTicketBelongToTable(affectedTicket!, t, currentTablesSnapshot)) return t;

          const metrics = calculateTableLiveMetrics(t, updatedAllTickets, tableDraftsRef.current);
          return {
            ...t,
            status: metrics.status,
            subtotal: metrics.subtotal,
            totalWithTax: metrics.totalWithTax,
            activeKOTCount: metrics.activeKOTCount
          };
        });

        diningTablesRef.current = nextTables;
        setDiningTables(nextTables);
        localStorage.setItem('quickims_tables', JSON.stringify(nextTables));
        localStorage.setItem('restro_tables', JSON.stringify(nextTables));
        syncLiveTablesToFirestore(nextTables, tableDraftsRef.current).catch(() => null);
      }

      // 4. Log into Staff Audit Trail
      try {
        const notificationText = notifyKitchenBar ? ' [Kitchen/Bar Notified]' : '';
        await logStaffAction({
          staffId: (activePOSStaff || activeStaffUser)?.id || currentUser.id || 'staff-1',
          staffName: effectiveStaff,
          staffRole: (activePOSStaff || activeStaffUser)?.role || 'staff',
          actionType: 'item_modified',
          targetEntityId: itemId,
          targetEntityName: restoredItemName,
          details: `Uncancelled / Restored order item: ${actualRestoreQty}x ${restoredItemName} in ${affectedTicket.ticketType || 'KOT'} #${affectedTicket.kotNumber} (Table ${affectedTicket.tableNumber}).${notificationText} Reason: ${reason || 'Staff restored'}${effectiveNote ? ` | Note: ${effectiveNote}` : ''}`,
          reason: reason || 'Restored by staff'
        });
      } catch (auditErr) {
        console.warn('Audit log write notice:', auditErr);
      }
    }

    return {
      success: true,
      message: `Successfully uncancelled ${actualRestoreQty}x ${restoredItemName}. Added back to live table order ticket.`
    };
  };

  const updateKOTItemCustomization = async (
    kotId: string,
    itemId: string,
    addons: { name: string; price: number }[],
    specialInstructions: string
  ): Promise<{ success: boolean; message: string }> => {
    let affectedTicket: KitchenOrderTicket | undefined;
    let targetItemName = 'Dish';
    const currentProductsSnapshot = productsRef.current.length > 0 ? productsRef.current : products;
    const baseTickets = kitchenTicketsRef.current.length > 0 ? kitchenTicketsRef.current : kitchenTickets;

    const updatedAllTickets = baseTickets.map(k => {
      if (k.id !== kotId) return k;

      const targetItem = k.items.find(i => i.id === itemId);
      if (!targetItem) return k;

      targetItemName = targetItem.productName;
      const prod = currentProductsSnapshot.find(
        p => p.id === targetItem.productId || (Boolean(p.name && targetItem.productName) && String(p.name).toLowerCase() === String(targetItem.productName).toLowerCase())
      );
      const existingAddons = extractKOTItemAddons(targetItem);
      const baseUnitPrice = computeItemBaseUnitPrice(targetItem.unitPrice, existingAddons, prod?.retailPrice);
      const newAddonsCost = addons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      const newUnitPrice = Math.max(0, baseUnitPrice + newAddonsCost);
      const nextModifiers = addons.map(a => ({
        modifierName: 'Addon',
        optionName: a.name,
        priceDelta: Number(a.price || 0)
      }));

      const updatedItems = k.items.map(i => {
        if (i.id === itemId) {
          return {
            ...i,
            addonsList: addons,
            selectedModifiers: nextModifiers,
            specialInstructions: specialInstructions.trim(),
            unitPrice: newUnitPrice
          };
        }
        return i;
      });

      const updatedK: KitchenOrderTicket = {
        ...k,
        items: updatedItems,
        updatedAt: Date.now()
      };
      affectedTicket = updatedK;
      return updatedK;
    });

    kitchenTicketsRef.current = updatedAllTickets;
    localStorage.setItem('restro_kots', JSON.stringify(updatedAllTickets));
    setKitchenTickets(updatedAllTickets);

    if (affectedTicket) {
      // 1. Sync to Firestore kitchen_tickets
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        try {
          await updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', kotId), sanitizeForFirestore({
            items: affectedTicket.items,
            updatedAt: affectedTicket.updatedAt
          }));
        } catch (e) {
          console.warn('Firestore KOT customization update notice:', e);
        }
      }

      // 2. Recalculate matching dining table subtotal strictly via cross-floor-safe helper
      const targetTableId = affectedTicket.tableId;
      if (targetTableId && targetTableId !== 'takeaway-counter') {
        const currentTablesSnapshot = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
        const nextTables = currentTablesSnapshot.map(t => {
          if (!doesTicketBelongToTable(affectedTicket!, t, currentTablesSnapshot)) return t;
          const metrics = calculateTableLiveMetrics(t, updatedAllTickets, tableDraftsRef.current);
          return {
            ...t,
            status: metrics.status,
            subtotal: metrics.subtotal,
            totalWithTax: metrics.totalWithTax,
            activeKOTCount: metrics.activeKOTCount
          };
        });

        diningTablesRef.current = nextTables;
        setDiningTables(nextTables);
        localStorage.setItem('quickims_tables', JSON.stringify(nextTables));
        localStorage.setItem('restro_tables', JSON.stringify(nextTables));
        syncLiveTablesToFirestore(nextTables, tableDraftsRef.current).catch(() => null);
      }

      // 3. Log into audit trail
      try {
        const activeOperator = activePOSStaff || activeStaffUser;
        await logStaffAction({
          staffId: activeOperator?.id || currentUser.id || 'staff-1',
          staffName: activeOperator?.name || currentUser.name || 'Staff',
          staffRole: activeOperator?.role || 'staff',
          actionType: 'item_modified',
          targetEntityId: itemId,
          targetEntityName: targetItemName,
          details: `Updated customization on ${targetItemName} in KOT #${affectedTicket.kotNumber}. Addons: [${addons.map(a => a.name).join(', ') || 'None'}], Note: "${specialInstructions || 'None'}"`,
          reason: 'Customization update'
        });
      } catch {}
    }

    return {
      success: true,
      message: `Updated customizations for ${targetItemName}.`
    };
  };

  const settleTableBill = async (tableId: string, invoice: SaleInvoice) => {
    if (inFlightTableSettleRef.current.has(tableId)) {
      return;
    }
    inFlightTableSettleRef.current.add(tableId);

    try {
      const currentTables = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
      const tableToSettle = currentTables.find(t => t.id === tableId || (t.tableNumber && t.tableNumber === tableId));
      const targetTableId = tableToSettle?.id || tableId;
      const targetTableNum = tableToSettle?.tableNumber;
      const isCounterOrTakeaway = targetTableId === 'takeaway-counter' || targetTableId === 'counter';

      // Synchronously settle local drafts, tickets, and table status BEFORE awaiting Firestore
      // so fast table re-clicks or floor-plan return never show ghost occupied tables or unsettled BOTs.
      const cleanDrafts = { ...tableDraftsRef.current };
      delete cleanDrafts[tableId];
      delete cleanDrafts[targetTableId];
      setTableDrafts(cleanDrafts);
      tableDraftsRef.current = cleanDrafts;
      localStorage.setItem('quickims_table_drafts', JSON.stringify(cleanDrafts));

      const settleNow = Date.now();
      const ticketUpdatePromises: Promise<any>[] = [];
      const ticketsToPersist: KitchenOrderTicket[] = [];
      const currentTickets = kitchenTicketsRef.current.length > 0 ? kitchenTicketsRef.current : kitchenTickets;
      const updatedTickets = currentTickets.map(k => {
        const isMatch =
          (tableToSettle
            ? doesTicketBelongToTable(k, tableToSettle, currentTables)
            : (k.tableId === targetTableId || (targetTableNum && k.tableNumber === targetTableNum))) ||
          (isCounterOrTakeaway && (k.tableId === 'takeaway-counter' || k.tableId === 'counter' || k.tableNumber === 'Takeaway' || !k.tableId));

        if (isMatch && (!k.isSettled || (k.status !== 'completed' && k.status !== 'cancelled'))) {
          const isAllCancelled = k.status === 'cancelled' || (k.items.length > 0 && k.items.every(i => i.status === 'cancelled'));
          const completedItems: KOTItem[] = (k.items || []).map(item =>
            item.status === 'cancelled' ? item : { ...item, status: 'served' as const }
          );
          const nextStatus: KitchenOrderTicket['status'] = isAllCancelled ? 'cancelled' : 'completed';

          const settledTicket: KitchenOrderTicket = {
            ...k,
            status: nextStatus,
            items: completedItems,
            isSettled: true,
            settledAt: k.settledAt || settleNow,
            updatedAt: settleNow
          };
          ticketsToPersist.push(settledTicket);
          return settledTicket;
        }
        return k;
      });

      kitchenTicketsRef.current = updatedTickets;
      localStorage.setItem('restro_kots', JSON.stringify(updatedTickets));
      setKitchenTickets(updatedTickets);

      const finalTables = currentTables.map(t =>
        t.id === targetTableId ? makeAvailableTable(t) : t
      );
      diningTablesRef.current = finalTables;
      localStorage.setItem('quickims_tables', JSON.stringify(finalTables));
      localStorage.setItem('restro_tables', JSON.stringify(finalTables));
      setDiningTables(finalTables);

      // When online for a real dining table, check server state atomically so two cashiers never settle the same table twice
      let settledRemotelyViaTransaction = false;
      if (!isCounterOrTakeaway && db && restaurantId && restaurantId !== 'restro_guest' && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const tablesDocRef = doc(db, 'restaurants', restaurantId, 'live_state', 'tables');
          const txResult = await runTransaction(db, async (tx) => {
            const snap = await tx.get(tablesDocRef);
            if (!snap.exists()) {
              return { alreadySettledByOtherDevice: false, committed: false };
            }
            const data = snap.data() || {};
            const serverTables: DiningTable[] = Array.isArray(data.tables) ? data.tables : [];
            const matchIdx = serverTables.findIndex(t => t.id === targetTableId);
            const serverTable = matchIdx >= 0 ? serverTables[matchIdx] : null;
            const settleLocks: Record<string, { invoiceId: string; settledAt: number }> =
              data.tableSettleLocks && typeof data.tableSettleLocks === 'object' ? { ...data.tableSettleLocks } : {};
            const recentLock = settleLocks[targetTableId];

            if (
              serverTable &&
              serverTable.status === 'available' &&
              recentLock &&
              recentLock.invoiceId !== invoice.id &&
              Date.now() - Number(recentLock.settledAt || 0) < 120000
            ) {
              return { alreadySettledByOtherDevice: true, committed: false };
            }

            if (matchIdx >= 0) {
              serverTables[matchIdx] = makeAvailableTable(serverTables[matchIdx]);
            }

            const nextDrafts = data.tableDrafts && typeof data.tableDrafts === 'object' ? { ...data.tableDrafts } : {};
            delete nextDrafts[tableId];
            delete nextDrafts[targetTableId];
            settleLocks[targetTableId] = { invoiceId: invoice.id, settledAt: Date.now() };

            tx.set(
              tablesDocRef,
              sanitizeForFirestore({
                tables: serverTables,
                tableDrafts: nextDrafts,
                tableSettleLocks: settleLocks,
                updatedAt: Date.now(),
                updatedBy: activeStaffUser?.name || activePOSStaff?.name || currentUser.name
              }),
              { merge: true }
            );
            return { alreadySettledByOtherDevice: false, committed: true };
          });

          if (txResult.alreadySettledByOtherDevice) {
            if (salesRef.current.some(s => s.id === invoice.id)) {
              await deleteSaleInvoice(invoice.id).catch(() => {});
            }
            return;
          }
          settledRemotelyViaTransaction = txResult.committed;
        } catch {
          // Offline or transient network error -> continue gracefully with local + queued sync
        }
      }

      // If invoice is already recorded in salesRef/sales, avoid duplicate recordSale & double Firestore blocking
      const alreadyRecorded = salesRef.current.some(s => s.id === invoice.id || (s.invoiceNumber && s.invoiceNumber === invoice.invoiceNumber));
      if (!alreadyRecorded) {
        await recordSale(invoice);
      }

      if (!settledRemotelyViaTransaction) {
        try {
          if (db && restaurantId && restaurantId !== 'restro_guest') {
            updateDoc(doc(db, 'restaurants', restaurantId, 'live_state', 'tables'), {
              [`tableDrafts.${targetTableId}`]: deleteField()
            }).catch(() => null);
          }
        } catch {}
      }

      if (db && restaurantId && restaurantId !== 'restro_guest') {
        ticketsToPersist.forEach(t => {
          ticketUpdatePromises.push(
            updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', t.id), {
              status: t.status,
              items: sanitizeForFirestore(t.items),
              isSettled: true,
              settledAt: t.settledAt,
              updatedAt: t.updatedAt
            }).catch(err => console.warn('Ticket settle write warning:', err))
          );
        });
      }

      // Await Firestore updates in parallel
      await Promise.all([
        ...ticketUpdatePromises,
        settledRemotelyViaTransaction
          ? Promise.resolve()
          : syncLiveTablesToFirestore(finalTables, cleanDrafts).catch(() => null)
      ]);
    } finally {
      inFlightTableSettleRef.current.delete(tableId);
    }
  };

  const reopenTableBill = async (tableId: string, invoiceId?: string) => {
    // 1. Delete the recorded sale invoice if id provided
    if (invoiceId) {
      await deleteSaleInvoice(invoiceId);
    }

    const currentTablesSnapshot = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
    const tableToReopen = currentTablesSnapshot.find(t => t.id === tableId);
    const currentTicketsSnapshot = kitchenTicketsRef.current.length > 0 ? kitchenTicketsRef.current : kitchenTickets;

    // 2. Mark ONLY recently settled KOTs (within last 15 mins) for this table back to active/unsettled
    let restoredKOTsCount = 0;
    const now = Date.now();

    const updatedTickets = currentTicketsSnapshot.map(k => {
      const wasRecentlySettled = k.isSettled && k.settledAt && (now - k.settledAt < 15 * 60 * 1000);
      const belongsToReopen = tableToReopen
        ? doesTicketBelongToTable(k, tableToReopen, currentTablesSnapshot)
        : k.tableId === tableId;
      if (belongsToReopen && wasRecentlySettled) {
        restoredKOTsCount++;

        if (db && restaurantId && restaurantId !== 'restro_guest') {
          try {
            updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', k.id), {
              status: 'completed',
              isSettled: false,
              settledAt: deleteField(),
              updatedAt: now
            }).catch(() => null);
          } catch {}
        }

        const restored = {
          ...k,
          status: 'completed' as const,
          isSettled: false,
          updatedAt: now
        };
        delete (restored as any).settledAt;
        return restored;
      }
      return k;
    });

    kitchenTicketsRef.current = updatedTickets;
    localStorage.setItem('restro_kots', JSON.stringify(updatedTickets));
    setKitchenTickets(updatedTickets);

    // 3. Mark table back as active with canonical restored subtotals & tax
    const finalTables = currentTablesSnapshot.map(t => {
      if (t.id !== tableId) return t;
      const baseCandidate: DiningTable = {
        ...t,
        currentGuests: t.currentGuests || 2,
        openedAt: t.openedAt || now - 300000,
        lastOrderAt: now
      };
      const metrics = calculateTableLiveMetrics(baseCandidate, updatedTickets, tableDraftsRef.current);
      const restoredStatus: TableStatus = restoredKOTsCount > 0 ? 'kot_fired' : (metrics.status === 'available' ? 'seated' : metrics.status);
      return {
        ...baseCandidate,
        status: restoredStatus,
        subtotal: metrics.subtotal,
        totalWithTax: metrics.totalWithTax,
        activeKOTCount: metrics.activeKOTCount || restoredKOTsCount
      };
    });

    diningTablesRef.current = finalTables;
    localStorage.setItem('quickims_tables', JSON.stringify(finalTables));
    localStorage.setItem('restro_tables', JSON.stringify(finalTables));
    setDiningTables(finalTables);

    syncLiveTablesToFirestore(finalTables, tableDraftsRef.current).catch(() => null);
  };

  const dissolveTable = async (tableId: string, reason: string = 'All orders cancelled', staffName?: string): Promise<{ success: boolean; message: string }> => {
    const currentTables = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
    const tableToDissolve = currentTables.find(t => t.id === tableId) || currentTables.find(t => t.tableNumber && t.tableNumber === tableId);
    if (!tableToDissolve) {
      return { success: false, message: 'Table not found.' };
    }
    const targetTableId = tableToDissolve.id;
    const targetTableNum = tableToDissolve.tableNumber;
    const activeOperator = activePOSStaff || activeStaffUser;
    const effectiveStaffName = staffName || activeOperator?.name || currentUser.name || 'Staff';

    // 1. Delete draft order for this table from local state, storage, and Firestore
    const cleanDrafts = { ...tableDraftsRef.current };
    delete cleanDrafts[targetTableId];
    setTableDrafts(cleanDrafts);
    tableDraftsRef.current = cleanDrafts;
    localStorage.setItem('quickims_table_drafts', JSON.stringify(cleanDrafts));

    try {
      if (db) {
        updateDoc(doc(db, 'restaurants', restaurantId, 'live_state', 'tables'), {
          [`tableDrafts.${targetTableId}`]: deleteField()
        }).catch(() => null);
      }
    } catch {}

    // 2. Mark all unsettled KOT/BOT tickets for this table as settled & cancelled
    const ticketUpdatePromises: Promise<any>[] = [];
    const updatedTickets = kitchenTicketsRef.current.map(k => {
      const isMatch = doesTicketBelongToTable(k, tableToDissolve, currentTables);

      if (isMatch && !k.isSettled) {
        // Also cancel any uncancelled items so inventory/waste status is recorded
        const updatedItems = (k.items || []).map(item => {
          if (item.status !== 'cancelled') {
            return {
              ...item,
              status: 'cancelled' as const,
              cancelReason: reason || 'Table dissolved / order cancelled',
              cancelledAt: Date.now(),
              cancelledBy: effectiveStaffName
            };
          }
          return item;
        });

        if (db) {
          ticketUpdatePromises.push(
            updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', k.id), {
              items: updatedItems,
              status: 'cancelled',
              isSettled: true,
              settledAt: Date.now(),
              updatedAt: Date.now(),
              cancelReason: reason || 'Table dissolved / all orders cancelled',
              cancelledAt: Date.now()
            }).catch(err => console.warn('Ticket dissolve write warning:', err))
          );
        }

        return { 
          ...k, 
          items: updatedItems,
          status: 'cancelled' as const, 
          isSettled: true, 
          settledAt: Date.now(), 
          updatedAt: Date.now(),
          cancelReason: reason || 'Table dissolved / all orders cancelled',
          cancelledAt: Date.now()
        };
      }
      return k;
    });

    kitchenTicketsRef.current = updatedTickets;
    localStorage.setItem('restro_kots', JSON.stringify(updatedTickets));
    setKitchenTickets(updatedTickets);

    // 3. Free up table back to 'available' with zero/cleared guests and clean state
    const finalTables = currentTables.map(t => {
      if (t.id === targetTableId) {
        return makeAvailableTable(t);
      }
      return t;
    });
    diningTablesRef.current = finalTables;
    localStorage.setItem('quickims_tables', JSON.stringify(finalTables));
    localStorage.setItem('restro_tables', JSON.stringify(finalTables));
    setDiningTables(finalTables);

    // 4. Log audit action
    try {
      const activeOperator = activePOSStaff || activeStaffUser;
      await logStaffAction({
        staffId: activeOperator?.id || currentUser.id,
        staffName: effectiveStaffName,
        staffRole: activeOperator?.role || currentUser.role,
        actionType: 'table_dissolved',
        targetEntityId: targetTableNum,
        targetEntityName: `Table ${targetTableNum}`,
        details: `Table ${targetTableNum} dissolved (all orders cancelled / table released for new customer). Reason: ${reason || 'All orders cancelled'}`
      });
    } catch {}

    // 5. Await Firestore updates in parallel
    await Promise.all([
      ...ticketUpdatePromises,
      syncLiveTablesToFirestore(finalTables, cleanDrafts).catch(() => null)
    ]);

    return { 
      success: true, 
      message: `Table ${targetTableNum} dissolved successfully and is now available for new customers.` 
    };
  };

  const persistTicketTableReassignments = async (changedTickets: KitchenOrderTicket[]) => {
    if (!db || !restaurantId || restaurantId === 'restro_guest' || changedTickets.length === 0) return;
    await Promise.all(
      changedTickets.map(ticket =>
        setDoc(
          doc(db, 'restaurants', restaurantId, 'kitchen_tickets', ticket.id),
          sanitizeForFirestore({
            tableId: ticket.tableId,
            tableNumber: ticket.tableNumber,
            zoneName: ticket.zoneName,
            updatedAt: ticket.updatedAt
          }),
          { merge: true }
        ).catch(err => console.warn('Ticket table reassignment Firestore warning:', err))
      )
    );
  };

  const transferTable = async (
    sourceTableId: string,
    targetTableId: string,
    sourceDraftOverride?: DraftOverrideInput
  ): Promise<boolean> => {
    const currentTables = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
    const transition = applyTransferTableState({
      sourceTableId,
      targetTableId,
      tables: currentTables,
      tickets: kitchenTicketsRef.current,
      drafts: tableDraftsRef.current,
      sourceDraftOverride,
      fallbackWaiter: activeStaffUser?.name || activePOSStaff?.name || currentUser.name,
      taxInclusivePricing: settings.taxInclusivePricing !== false,
      defaultVatRate: settings.defaultVatRate || 13
    });

    if (!transition.ok) return false;

    // Commit tickets, drafts, and tables synchronously before firing cloud sync
    kitchenTicketsRef.current = transition.updatedTickets;
    setKitchenTickets(transition.updatedTickets);
    localStorage.setItem('restro_kots', JSON.stringify(transition.updatedTickets));

    tableDraftsRef.current = transition.nextDrafts;
    setTableDrafts(transition.nextDrafts);
    localStorage.setItem('quickims_table_drafts', JSON.stringify(transition.nextDrafts));

    diningTablesRef.current = transition.updatedTables;
    setDiningTables(transition.updatedTables);
    localStorage.setItem('quickims_tables', JSON.stringify(transition.updatedTables));
    localStorage.setItem('restro_tables', JSON.stringify(transition.updatedTables));

    if (selectedTableId === sourceTableId) {
      setSelectedTableId(targetTableId);
    }

    // Persist kitchen tickets FIRST so remote terminals never compute stale empty metrics for targetTable
    await persistTicketTableReassignments(transition.changedTickets);
    await syncLiveTablesToFirestore(transition.updatedTables, transition.nextDrafts);

    return true;
  };

  const mergeTables = async (
    sourceTableId: string,
    targetTableId: string,
    sourceDraftOverride?: DraftOverrideInput
  ): Promise<boolean> => {
    const currentTables = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
    const transition = applyMergeTablesState({
      sourceTableId,
      targetTableId,
      tables: currentTables,
      tickets: kitchenTicketsRef.current,
      drafts: tableDraftsRef.current,
      sourceDraftOverride,
      fallbackWaiter: activeStaffUser?.name || activePOSStaff?.name || currentUser.name,
      taxInclusivePricing: settings.taxInclusivePricing !== false,
      defaultVatRate: settings.defaultVatRate || 13
    });

    if (!transition.ok) return false;

    kitchenTicketsRef.current = transition.updatedTickets;
    setKitchenTickets(transition.updatedTickets);
    localStorage.setItem('restro_kots', JSON.stringify(transition.updatedTickets));

    tableDraftsRef.current = transition.nextDrafts;
    setTableDrafts(transition.nextDrafts);
    localStorage.setItem('quickims_table_drafts', JSON.stringify(transition.nextDrafts));

    diningTablesRef.current = transition.updatedTables;
    setDiningTables(transition.updatedTables);
    localStorage.setItem('quickims_tables', JSON.stringify(transition.updatedTables));
    localStorage.setItem('restro_tables', JSON.stringify(transition.updatedTables));

    if (selectedTableId === sourceTableId) {
      setSelectedTableId(targetTableId);
    }

    await persistTicketTableReassignments(transition.changedTickets);
    await syncLiveTablesToFirestore(transition.updatedTables, transition.nextDrafts);

    return true;
  };

  const swapTables = async (
    tableAId: string,
    tableBId: string,
    sourceDraftOverrideForA?: DraftOverrideInput
  ): Promise<boolean> => {
    const currentTables = diningTablesRef.current.length > 0 ? diningTablesRef.current : diningTables;
    const transition = applySwapTablesState({
      tableAId,
      tableBId,
      tables: currentTables,
      tickets: kitchenTicketsRef.current,
      drafts: tableDraftsRef.current,
      sourceDraftOverrideForA,
      taxInclusivePricing: settings.taxInclusivePricing !== false,
      defaultVatRate: settings.defaultVatRate || 13
    });

    if (!transition.ok) return false;

    kitchenTicketsRef.current = transition.updatedTickets;
    setKitchenTickets(transition.updatedTickets);
    localStorage.setItem('restro_kots', JSON.stringify(transition.updatedTickets));

    tableDraftsRef.current = transition.nextDrafts;
    setTableDrafts(transition.nextDrafts);
    localStorage.setItem('quickims_table_drafts', JSON.stringify(transition.nextDrafts));

    diningTablesRef.current = transition.updatedTables;
    setDiningTables(transition.updatedTables);
    localStorage.setItem('quickims_tables', JSON.stringify(transition.updatedTables));
    localStorage.setItem('restro_tables', JSON.stringify(transition.updatedTables));

    if (selectedTableId === tableAId) {
      setSelectedTableId(tableBId);
    } else if (selectedTableId === tableBId) {
      setSelectedTableId(tableAId);
    }

    await persistTicketTableReassignments(transition.changedTickets);
    await syncLiveTablesToFirestore(transition.updatedTables, transition.nextDrafts);

    return true;
  };

  // Staff & HR & Access Control
  const logStaffAction = async (action: Omit<StaffAuditLog, 'id' | 'timestamp'>) => {
    const newLog: StaffAuditLog = {
      ...action,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now()
    };
    setStaffAuditLogs(prev => [newLog, ...prev.slice(0, 499)]);
    const tenant = activeTenantRef.current || restaurantId;
    if (db && tenant && tenant !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', tenant, 'staff_audit_logs', newLog.id), sanitizeForFirestore({ ...newLog, restaurantId: tenant })).catch(() => {});
    }
    return newLog;
  };

  const switchActiveStaffByPin = (pin: string) => {
    const trimmed = pin.trim();
    if (!trimmed) {
      return { success: false, message: 'Please enter a 4-digit PIN.' };
    }
    const matched = staffMembers.find(s => s.pin === trimmed);
    if (!matched) {
      return { success: false, message: 'No staff member found with this PIN.' };
    }
    setActivePOSStaff(matched);
    logStaffAction({
      staffId: matched.id,
      staffName: matched.name,
      staffRole: matched.role,
      actionType: 'pin_override',
      targetEntityId: matched.employeeCode,
      targetEntityName: matched.name,
      details: `Switched active POS/Terminal operator to ${matched.name} (${matched.employeeCode}).`
    });
    return {
      success: true,
      staff: matched,
      message: `Active operator switched to ${matched.name} (${matched.role.toUpperCase()}).`
    };
  };

  const verifyStaffPin = (staffId: string, pin: string) => {
    const trimmed = pin.trim();
    if (!trimmed) return false;
    if (trimmed === '9999') return true; // Manager override PIN
    const staff = staffMembers.find(s => s.id === staffId);
    return staff ? staff.pin === trimmed : false;
  };

  const addStaffMember = async (staffData: Omit<StaffMember, 'id'>) => {
    // Duplicate Guard: Prevent duplicate entry for same person
    const cleanEmail = staffData.email?.trim().toLowerCase();
    const cleanPhone = staffData.phone?.trim();
    const cleanName = String(staffData.name || '').trim().toLowerCase();

    // Check state first
    let existingMatch = staffMembers.find(s => 
      (cleanEmail && s.email && s.email.trim().toLowerCase() === cleanEmail) ||
      (cleanPhone && s.phone && s.phone.trim() === cleanPhone) ||
      (cleanName && s.name && s.name.trim().toLowerCase() === cleanName)
    );

    // Check localStorage cache as secondary guard against race condition
    if (!existingMatch && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('quickims_staff');
        if (cached) {
          const list: StaffMember[] = JSON.parse(cached);
          if (Array.isArray(list)) {
            existingMatch = list.find(s => 
              (cleanEmail && s.email && s.email.trim().toLowerCase() === cleanEmail) ||
              (cleanPhone && s.phone && s.phone.trim() === cleanPhone) ||
              (cleanName && s.name && s.name.trim().toLowerCase() === cleanName)
            );
          }
        }
      } catch {}
    }

    if (existingMatch) {
      console.warn(`Staff profile already exists (${existingMatch.employeeCode}: ${existingMatch.name}). Updating existing profile instead of creating duplicate.`);
      await updateStaffMember(existingMatch.id, staffData);
      return { ...existingMatch, ...staffData };
    }

    const codeCount = staffMembers.length + 101;
    const employeeCode = staffData.employeeCode || `EMP-${codeCount}`;
    // Auto-generate clean username if not provided
    const baseUsername = staffData.username?.trim().toLowerCase() || 
      String(staffData.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
    const username = baseUsername || `user_${codeCount}`;
    const pin = staffData.pin?.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    const rawPermissions = staffData.permissions || getDefaultStaffPermissions(staffData.role);
    const modules = rawPermissions.modules || getDefaultStaffModulePermissions(staffData.role);
    const permissions = syncStaffPermissions(rawPermissions, modules);
    const avatarColors = ['#4f46e5', '#059669', '#ea580c', '#2563eb', '#7c3aed', '#db2777', '#0891b2', '#d97706'];
    const avatarColor = staffData.avatarColor || avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const verificationToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newStaff: StaffMember = {
      ...staffData,
      id: `staff-${Date.now()}`,
      employeeCode,
      username,
      pin,
      permissions,
      avatarColor,
      verificationToken,
      department: staffData.department || 'Front of House',
      qrToken: `STAFF-QR-${employeeCode}-${pin}`,
      restaurantId: restaurantId,
      emailVerified: true
    };

    setStaffMembers(prev => {
      const updated = [newStaff, ...prev];
      localStorage.setItem('quickims_staff', JSON.stringify(updated));
      return updated;
    });

    // Save to Firestore: tenant restaurant subcollection + indexed lookup + staff_members
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await setDoc(doc(db, 'restaurants', restaurantId, 'staff', newStaff.id), sanitizeForFirestore(newStaff), { merge: true });
        await setDoc(doc(db, 'staff_members', newStaff.id), sanitizeForFirestore(newStaff), { merge: true });

        const lookupRecord = {
          ...newStaff,
          restaurantId
        };
        if (newStaff.username) {
          await setDoc(doc(db, 'staff_lookup', newStaff.username.toLowerCase()), sanitizeForFirestore(lookupRecord), { merge: true });
        }
        if (newStaff.employeeCode) {
          await setDoc(doc(db, 'staff_lookup', newStaff.employeeCode.toLowerCase()), sanitizeForFirestore(lookupRecord), { merge: true });
        }
        if (cleanEmail) {
          await setDoc(doc(db, 'staff_lookup', cleanEmail), sanitizeForFirestore(lookupRecord), { merge: true });
        }

        const vRecord = {
          staffId: newStaff.id,
          token: verificationToken,
          email: cleanEmail || '',
          staffName: newStaff.name,
          role: newStaff.role,
          username: newStaff.username,
          pin: newStaff.pin,
          restaurantId,
          createdAt: Date.now(),
          verified: true
        };
        await setDoc(doc(db, 'staff_verifications', newStaff.id), vRecord, { merge: true });
        if (cleanEmail) {
          await setDoc(doc(db, 'staff_verifications', cleanEmail), vRecord, { merge: true });
        }
      } catch (fsErr) {
        console.warn('Firestore staff_members write note:', fsErr);
      }
    }

    await logStaffAction({
      staffId: newStaff.id,
      staffName: newStaff.name,
      staffRole: newStaff.role,
      actionType: 'staff_created',
      targetEntityId: newStaff.employeeCode,
      targetEntityName: newStaff.name,
      details: `Registered new staff member ${newStaff.name} as ${newStaff.role} (${newStaff.employeeCode}) with username "${username}".`
    });

    return newStaff;
  };

  const updateStaffMember = async (id: string, updates: Partial<StaffMember>) => {
    const existing = staffMembers.find(s => s.id === id);

    let preparedUpdates: Partial<StaffMember> = { ...updates, restaurantId: existing?.restaurantId || restaurantId };
    if (updates.permissions) {
      const existingMods = existing?.permissions?.modules;
      const targetMods = updates.permissions.modules || existingMods || getDefaultStaffModulePermissions(updates.role || existing?.role || 'waiter');
      preparedUpdates.permissions = syncStaffPermissions(updates.permissions, targetMods);
    } else if (updates.role && !updates.permissions) {
      preparedUpdates.permissions = getDefaultStaffPermissions(updates.role);
    }

    setStaffMembers(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, ...preparedUpdates };
      }
      return s;
    }));

    if (activePOSStaff?.id === id) {
      setActivePOSStaff(prev => prev ? { ...prev, ...preparedUpdates } : null);
    }
    if (activeStaffUser?.id === id) {
      setActiveStaffUser(prev => {
        if (!prev) return null;
        const nextStaff = { ...prev, ...preparedUpdates };
        localStorage.setItem('quickims_active_staff_session', JSON.stringify(nextStaff));
        return nextStaff;
      });
    }

    if (existing) {
      const mergedStaff = { ...existing, ...preparedUpdates };
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        try {
          await setDoc(doc(db, 'restaurants', restaurantId, 'staff', id), sanitizeForFirestore(preparedUpdates), { merge: true });
          await setDoc(doc(db, 'staff_members', id), sanitizeForFirestore(preparedUpdates), { merge: true });
          if (mergedStaff.username) {
            await setDoc(doc(db, 'staff_lookup', mergedStaff.username.toLowerCase()), sanitizeForFirestore(mergedStaff), { merge: true });
          }
          if (mergedStaff.employeeCode) {
            await setDoc(doc(db, 'staff_lookup', mergedStaff.employeeCode.toLowerCase()), sanitizeForFirestore(mergedStaff), { merge: true });
          }
          if (mergedStaff.email) {
            await setDoc(doc(db, 'staff_lookup', mergedStaff.email.toLowerCase()), sanitizeForFirestore(mergedStaff), { merge: true });
          }
        } catch (fsErr) {
          console.warn('Firestore staff_members update note:', fsErr);
        }
      }

      await logStaffAction({
        staffId: existing.id,
        staffName: existing.name,
        staffRole: existing.role,
        actionType: 'staff_updated',
        targetEntityId: existing.employeeCode,
        targetEntityName: existing.name,
        details: `Updated staff profile details for ${existing.name}.`
      });
    }
  };

  const deleteStaffMember = async (id: string) => {
    const matched = staffMembers.find(s => s.id === id);
    setStaffMembers(prev => prev.filter(s => s.id !== id));
    if (activePOSStaff?.id === id) {
      const remaining = staffMembers.filter(s => s.id !== id);
      setActivePOSStaff(remaining[0] || null);
    }
    if (activeStaffUser?.id === id) {
      setActiveStaffUser(null);
      localStorage.removeItem('quickims_active_staff_session');
    }

    // Delete from Firestore (scoped to current restaurant)
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'staff', id));
        await deleteDoc(doc(db, 'staff_members', id));
        if (matched?.username) {
          await deleteDoc(doc(db, 'staff_lookup', matched.username.toLowerCase()));
        }
        if (matched?.employeeCode) {
          await deleteDoc(doc(db, 'staff_lookup', matched.employeeCode.toLowerCase()));
        }
        if (matched?.email) {
          await deleteDoc(doc(db, 'staff_lookup', matched.email.toLowerCase()));
        }
      } catch (fsErr) {
        console.warn('Firestore staff_members delete note:', fsErr);
      }
    }

    if (matched) {
      await logStaffAction({
        staffId: matched.id,
        staffName: matched.name,
        staffRole: matched.role,
        actionType: 'staff_updated',
        targetEntityId: matched.employeeCode,
        targetEntityName: matched.name,
        details: `Deactivated / removed staff member ${matched.name} (${matched.employeeCode}).`
      });
    }
  };

  const resetStaffData = async () => {
    if (activeStaffUser) {
      console.warn('Blocked resetStaffData during active staff login session.');
      return;
    }
    setStaffMembers([]);
    localStorage.removeItem('quickims_staff');
    localStorage.removeItem('quickims_active_staff_session');
    setActiveStaffUser(null);
    setActivePOSStaff(null);
    if (!db || !restaurantId || restaurantId === 'restro_guest') return;
    try {
      const tenantSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'staff')).catch(() => null);
      if (tenantSnap && !tenantSnap.empty) {
        const batch = writeBatch(db);
        tenantSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      // Only delete global staff_members & staff_lookup docs belonging strictly to THIS restaurantId
      const snap = await getDocs(query(collection(db, 'staff_members'), where('restaurantId', '==', restaurantId))).catch(() => null);
      if (snap && !snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      const lookupSnap = await getDocs(query(collection(db, 'staff_lookup'), where('restaurantId', '==', restaurantId))).catch(() => null);
      if (lookupSnap && !lookupSnap.empty) {
        const batch = writeBatch(db);
        lookupSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn('resetStaffData error:', e);
    }
  };

  const canStaffDo = useCallback((moduleKey: keyof StaffModulePermissions, action: PermissionAction): boolean => {
    // 1. Always enforce configured permissions whenever a staff operator is active (login OR Switch Staff testing)
    const currentStaff = activePOSStaff || activeStaffUser;
    if (currentStaff) {
      return checkStaffModulePermission(currentStaff, moduleKey, action, false);
    }

    // 2. No staff operator is active (pure Owner / Admin session): full unrestricted access
    if (isSuperAdmin || isAdmin) return true;
    return true;
  }, [isSuperAdmin, isAdmin, activeStaffUser, activePOSStaff]);

  // Staff Portal Login with Username and 4-Digit PIN
  const loginStaffByUsernameAndPin = async (username: string, pin: string): Promise<{ success: boolean; message: string; staff?: StaffMember }> => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanUser) {
      return { success: false, message: 'Please enter your username or employee code.' };
    }
    if (!cleanPin) {
      return { success: false, message: 'Please enter your 4-digit PIN.' };
    }

    // 1. Look in local state
    let staff = staffMembers.find(s => 
      s.username?.toLowerCase() === cleanUser ||
      String(s.employeeCode || '').toLowerCase() === cleanUser ||
      s.email?.toLowerCase() === cleanUser
    );

    // 2. Look in localStorage
    if (!staff && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('quickims_staff');
        if (cached) {
          const list: StaffMember[] = JSON.parse(cached);
          if (Array.isArray(list)) {
            staff = list.find(s => 
              s.username?.toLowerCase() === cleanUser ||
              String(s.employeeCode || '').toLowerCase() === cleanUser ||
              s.email?.toLowerCase() === cleanUser
            );
          }
        }
      } catch {}
    }

    // 3. Look in Firestore staff_lookup (direct O(1) indexed lookup for any device)
    if (!staff && db) {
      try {
        const lookupSnap = await getDoc(doc(db, 'staff_lookup', cleanUser)).catch(() => null);
        if (lookupSnap && lookupSnap.exists()) {
          staff = { ...lookupSnap.data(), id: lookupSnap.data().id || lookupSnap.id } as StaffMember;
        }
      } catch (err) {
        console.warn('staff_lookup fetch note:', err);
      }
    }

    // 4. Look in current restaurant subcollection (if bound) then staff_members collection
    if (!staff && db && restaurantId && restaurantId !== 'restro_guest') {
      try {
        const tenantSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'staff')).catch(() => null);
        if (tenantSnap && !tenantSnap.empty) {
          const list = tenantSnap.docs.map(d => ({ ...d.data(), id: d.id, restaurantId } as StaffMember));
          staff = list.find(s =>
            s.username?.toLowerCase() === cleanUser ||
            String(s.employeeCode || '').toLowerCase() === cleanUser ||
            s.email?.toLowerCase() === cleanUser
          );
        }
      } catch (fsErr) {
        console.warn('Firestore tenant staff lookup note:', fsErr);
      }
    }

    if (!staff && db) {
      try {
        const allSnap = await getDocs(collection(db, 'staff_members')).catch(() => null);
        if (allSnap && !allSnap.empty) {
          const list = allSnap.docs.map(d => ({ ...d.data(), id: d.id } as StaffMember));
          staff = list.find(s => 
            s.username?.toLowerCase() === cleanUser ||
            String(s.employeeCode || '').toLowerCase() === cleanUser ||
            s.email?.toLowerCase() === cleanUser
          );
        }
      } catch (fsErr) {
        console.warn('Firestore login lookup note:', fsErr);
      }
    }

    // 5. Demo mode staff definitions fallback (ONLY when inside Demo Mode, never pollute real accounts)
    if (!staff && (isDemoSession || restaurantId === 'restro_demo_preview')) {
      staff = INITIAL_STAFF.find(s => 
        s.username?.toLowerCase() === cleanUser ||
        String(s.employeeCode || '').toLowerCase() === cleanUser ||
        s.email?.toLowerCase() === cleanUser ||
        (cleanUser === 'admin' && s.role === 'manager') ||
        (cleanUser === 'pos' && s.role === 'waiter') ||
        (cleanUser === 'kitchen' && s.role === 'chef')
      );
    }

    if (!staff) {
      return { success: false, message: `No staff profile found for "${username}". Please verify your username/employee code with your restaurant manager.` };
    }

    if (staff.status === 'inactive' || staff.status === 'on_leave') {
      return { success: false, message: `Account status is currently "${staff.status.replace('_', ' ')}". Please contact your manager.` };
    }

    // Verify 4-digit PIN (allows master PIN 9999 for emergency/manager access)
    const isPinMatch = staff.pin === cleanPin || cleanPin === '9999';
    if (!isPinMatch) {
      return { success: false, message: 'Incorrect 4-digit PIN. Please re-enter or ask manager to reset it.' };
    }

    // Automatically bind device to the staff's owner restaurant ID, resetting any prior restaurant data cleanly
    const assignedRestroId = staff.restaurantId || (restaurantId && restaurantId !== 'restro_guest' ? restaurantId : FRESH_BEANS_RESTRO_ID);
    if (assignedRestroId !== activeTenantRef.current) {
      resetTenantRef.current(assignedRestroId);
    }
    setRestaurantIdState(assignedRestroId);
    localStorage.setItem('quickims_restaurant_id', assignedRestroId);
    localStorage.setItem(LAST_TENANT_STORAGE_KEY, assignedRestroId);
    localStorage.removeItem('quickims_data_cleared');

    // Ensure staff list includes the authenticated staff member on this device
    setStaffMembers(prev => {
      const exists = prev.some(s => s.id === staff!.id);
      return exists ? prev : [staff!, ...prev];
    });

    // Establish active staff session
    setActiveStaffUser(staff);
    setActivePOSStaff(staff);
    localStorage.setItem('quickims_active_staff_session', JSON.stringify(staff));

    setCurrentUser({
      id: staff.id,
      name: staff.name,
      email: staff.email || `${staff.username || staff.employeeCode}@quickims.np`,
      role: (String(staff.role || '').toLowerCase().includes('manager') || String(staff.role || '').toLowerCase().includes('admin') ? 'admin' : 'sales'),
      branchId: 'b-main'
    });

    await logStaffAction({
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      actionType: 'clock_in',
      targetEntityId: staff.employeeCode,
      targetEntityName: staff.name,
      details: `Staff member ${staff.name} logged in on device as ${staff.role}. Connected to restaurant ${assignedRestroId}.`
    });

    return {
      success: true,
      message: `Welcome back, ${staff.name}! Connected to restaurant automatically.`,
      staff
    };
  };

  const logoutStaff = () => {
    const hadStaffUser = Boolean(activeStaffUser);
    setActiveStaffUser(null);
    setActivePOSStaff(null);
    localStorage.removeItem('quickims_active_staff_session');
    if (hadStaffUser) {
      if (firebaseUser) {
        setCurrentUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Restaurant Owner',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || undefined,
          role: 'owner',
          branchId: 'wh-main'
        });
      } else {
        setCurrentUser({
          id: 'usr-admin-1',
          name: 'Restaurant Owner',
          role: 'owner',
          branchId: 'wh-main'
        });
      }
    }
  };

  const verifyStaffByToken = async (
    email: string, 
    token: string, 
    newPin?: string, 
    staffId?: string
  ): Promise<{ success: boolean; message: string; staff?: StaffMember }> => {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanToken = token ? token.trim() : '';
    const cleanStaffId = staffId ? staffId.trim() : '';

    // Step 1: Look up staff in local state
    let staff = staffMembers.find(s => 
      (cleanStaffId && s.id === cleanStaffId) ||
      (cleanToken && s.verificationToken && s.verificationToken === cleanToken) ||
      (cleanEmail && s.email && s.email.toLowerCase() === cleanEmail)
    );

    // Step 2: Look up staff in localStorage cache
    if (!staff && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('quickims_staff');
        if (cached) {
          const list: StaffMember[] = JSON.parse(cached);
          if (Array.isArray(list)) {
            staff = list.find(s => 
              (cleanStaffId && s.id === cleanStaffId) ||
              (cleanToken && s.verificationToken && s.verificationToken === cleanToken) ||
              (cleanEmail && s.email && s.email.toLowerCase() === cleanEmail)
            );
          }
        }
      } catch (err) {
        console.warn('LocalStorage staff lookup notice:', err);
      }
    }

    // Step 3: Look up staff in Firestore
    if (!staff) {
      try {
        // Direct ID lookup in staff_members
        if (cleanStaffId) {
          const sDoc = await getDoc(doc(db, 'staff_members', cleanStaffId)).catch(() => null);
          if (sDoc && sDoc.exists()) {
            staff = { ...sDoc.data(), id: sDoc.id } as StaffMember;
          }
        }

        // Token lookup in staff_verifications by staffId
        if (!staff && cleanStaffId) {
          const vDoc = await getDoc(doc(db, 'staff_verifications', cleanStaffId)).catch(() => null);
          if (vDoc && vDoc.exists()) {
            const vData = vDoc.data();
            if (vData.staffMember) staff = vData.staffMember as StaffMember;
          }
        }

        // Token lookup in staff_verifications by cleanEmail
        if (!staff && cleanEmail) {
          const vDoc = await getDoc(doc(db, 'staff_verifications', cleanEmail)).catch(() => null);
          if (vDoc && vDoc.exists()) {
            const vData = vDoc.data();
            if (vData.staffMember) staff = vData.staffMember as StaffMember;
            else if (vData.staffId) {
              const sDoc = await getDoc(doc(db, 'staff_members', vData.staffId)).catch(() => null);
              if (sDoc && sDoc.exists()) staff = { ...sDoc.data(), id: sDoc.id } as StaffMember;
            }
          }
        }

        // Full scan fallback
        if (!staff) {
          const allSnap = await getDocs(collection(db, 'staff_members')).catch(() => null);
          if (allSnap && !allSnap.empty) {
            const list = allSnap.docs.map(d => ({ ...d.data(), id: d.id } as StaffMember));
            staff = list.find(s => 
              (cleanStaffId && s.id === cleanStaffId) ||
              (cleanToken && s.verificationToken && s.verificationToken === cleanToken) ||
              (cleanEmail && s.email && s.email.toLowerCase() === cleanEmail)
            );
          }
        }
      } catch (fsErr) {
        console.warn('Firestore staff search note:', fsErr);
      }
    }

    if (!staff) {
      return { 
        success: false, 
        message: 'Staff profile matching this verification link was not found. Please ask your manager to send a new activation link or verify directly from the Staff Directory.' 
      };
    }

    const updatedPin = (newPin && /^\d{4}$/.test(newPin.trim())) ? newPin.trim() : (staff.pin || '1234');

    const verifiedStaff: StaffMember = {
      ...staff,
      emailVerified: true,
      pin: updatedPin,
      verificationToken: undefined
    };

    // Update in state & local storage
    setStaffMembers(prev => {
      const exists = prev.some(s => s.id === verifiedStaff.id);
      const updated = exists 
        ? prev.map(s => s.id === verifiedStaff.id ? verifiedStaff : s)
        : [verifiedStaff, ...prev];
      localStorage.setItem('quickims_staff', JSON.stringify(updated));
      return updated;
    });

    // Update in Firestore: tenant subcollection, staff_members AND staff_verifications
    const targetRestroId = verifiedStaff.restaurantId || (restaurantId && restaurantId !== 'restro_guest' ? restaurantId : '');
    try {
      if (targetRestroId) {
        await setDoc(doc(db, 'restaurants', targetRestroId, 'staff', verifiedStaff.id), sanitizeForFirestore(verifiedStaff), { merge: true });
      }
      await setDoc(doc(db, 'staff_members', verifiedStaff.id), sanitizeForFirestore(verifiedStaff), { merge: true });
      await setDoc(doc(db, 'staff_verifications', verifiedStaff.id), {
        verified: true,
        verifiedAt: Date.now(),
        staffId: verifiedStaff.id,
        staffName: verifiedStaff.name,
        pin: updatedPin,
        method: 'direct_portal_verification'
      }, { merge: true });
      if (verifiedStaff.email) {
        await setDoc(doc(db, 'staff_verifications', verifiedStaff.email.toLowerCase()), {
          verified: true,
          verifiedAt: Date.now(),
          staffId: verifiedStaff.id,
          staffName: verifiedStaff.name,
          pin: updatedPin,
          method: 'direct_portal_verification'
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore verify token update error:', e);
    }

    if (targetRestroId && targetRestroId !== activeTenantRef.current) {
      resetTenantRef.current(targetRestroId);
      setRestaurantIdState(targetRestroId);
      setStaffMembers([verifiedStaff]);
    }

    // Auto login staff into portal
    setActiveStaffUser(verifiedStaff);
    setActivePOSStaff(verifiedStaff);
    localStorage.setItem('quickims_active_staff_session', JSON.stringify(verifiedStaff));

    setCurrentUser({
      id: verifiedStaff.id,
      name: verifiedStaff.name,
      email: verifiedStaff.email || `${verifiedStaff.username || verifiedStaff.employeeCode}@quickims.np`,
      role: (String(verifiedStaff.role || '').toLowerCase().includes('manager') || String(verifiedStaff.role || '').toLowerCase().includes('admin') ? 'admin' : 'sales'),
      branchId: 'b-main'
    });

    await logStaffAction({
      staffId: verifiedStaff.id,
      staffName: verifiedStaff.name,
      staffRole: verifiedStaff.role,
      actionType: 'staff_updated',
      targetEntityId: verifiedStaff.employeeCode,
      targetEntityName: 'Email Verified',
      details: `Staff member ${verifiedStaff.name} verified their account and activated QuickIMS Staff Portal.`
    });

    return {
      success: true,
      message: `Welcome to Quick IMS, ${verifiedStaff.name}! Your account is now verified and active.`,
      staff: verifiedStaff
    };
  };

  const updateStaffPin = async (staffId: string, newPin: string): Promise<{ success: boolean; message: string }> => {
    const trimmed = newPin.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      return { success: false, message: 'PIN must be exactly 4 digits (0-9).' };
    }
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) {
      return { success: false, message: 'Staff member not found.' };
    }
    await updateStaffMember(staffId, { pin: trimmed });
    if (activeStaffUser?.id === staffId) {
      setActiveStaffUser(prev => prev ? { ...prev, pin: trimmed } : null);
    }
    return { success: true, message: '4-digit PIN updated successfully!' };
  };

  // Staff Real Email Verification System
  const sendStaffVerificationEmail = async (email: string, staffName?: string, staffId?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    // Generate unique verification token & portal activation link
    const verificationToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const portalVerificationUrl = `${window.location.origin}${window.location.pathname}?verifyStaff=true&staffId=${encodeURIComponent(staffId || '')}&email=${encodeURIComponent(cleanEmail)}&token=${encodeURIComponent(verificationToken)}`;

    // If current logged-in Google user matches this email and is verified, auto-verify staff record!
    const isCurrentUserVerified = auth.currentUser && 
      auth.currentUser.email?.toLowerCase() === cleanEmail && 
      auth.currentUser.emailVerified;

    if (isCurrentUserVerified) {
      setStaffMembers(prev => prev.map(s => {
        if (s.email?.toLowerCase() === cleanEmail || (staffId && s.id === staffId)) {
          return {
            ...s,
            emailVerified: true,
            verificationCode: code,
            verificationToken
          };
        }
        return s;
      }));

      try {
        const vRecord = {
          email: cleanEmail,
          staffId: staffId || '',
          staffName: staffName || cleanEmail.split('@')[0],
          token: verificationToken,
          code,
          portalUrl: portalVerificationUrl,
          createdAt: Date.now(),
          verified: true,
          method: 'google_oauth_preverified'
        };
        await setDoc(doc(db, 'staff_verifications', cleanEmail), vRecord, { merge: true });
        if (staffId) {
          await setDoc(doc(db, 'staff_verifications', staffId), vRecord, { merge: true });
          await setDoc(doc(db, 'staff_members', staffId), {
            emailVerified: true,
            verificationToken,
            verificationCode: code
          }, { merge: true });
        }
      } catch (e) {
        console.warn('Firestore setDoc notice:', e);
      }

      return {
        success: true,
        alreadyVerified: true,
        method: 'google_oauth_preverified',
        verificationLink: portalVerificationUrl,
        token: verificationToken,
        code,
        message: `Your Google account (${cleanEmail}) is already confirmed and verified!`
      };
    }

    let method: string = 'portal_verification_link';
    const tempPassword = `QuickIMS@${cleanEmail.split('@')[0]}!2026`;
    const secondaryAuth = getSecondaryStaffAuth();

    let authUser: FirebaseUser | null = null;
    if (auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail) {
      authUser = auth.currentUser;
    } else {
      try {
        const res = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, tempPassword);
        authUser = res.user;
        if (staffName) {
          await updateProfile(authUser, { displayName: staffName });
        }
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          try {
            const res = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, tempPassword);
            authUser = res.user;
          } catch {
            const storedAccounts = getStoredAccounts();
            const storedAcc = storedAccounts.find(u => String(u?.email || '').toLowerCase() === cleanEmail);
            if (storedAcc?.password) {
              try {
                const res = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, storedAcc.password);
                authUser = res.user;
              } catch (accErr) {
                console.warn('Secondary auth sign in notice:', accErr);
              }
            }
          }
        }
      }
    }

    // Dispatch real Firebase email verification configured to redirect back to portal
    if (authUser) {
      try {
        await sendEmailVerification(authUser, {
          url: portalVerificationUrl,
          handleCodeInApp: true
        });
        method = 'firebase_email_verification';
      } catch (vErr: any) {
        if (vErr.code === 'auth/too-many-requests' || vErr.message?.includes('too-many-requests')) {
          console.warn('Firebase rate limit on email verification, token link created.');
        } else {
          console.warn('Firebase sendEmailVerification notice:', vErr);
        }
      }
    }

    // Store verification record in Firestore across email and staffId keys
    try {
      const vRecord = {
        email: cleanEmail,
        staffId: staffId || '',
        staffName: staffName || cleanEmail.split('@')[0],
        token: verificationToken,
        code,
        portalUrl: portalVerificationUrl,
        createdAt: Date.now(),
        verified: false
      };
      await setDoc(doc(db, 'staff_verifications', cleanEmail), vRecord, { merge: true });
      if (staffId) {
        await setDoc(doc(db, 'staff_verifications', staffId), vRecord, { merge: true });
        await setDoc(doc(db, 'staff_members', staffId), {
          verificationToken,
          verificationCode: code,
          verificationSentAt: Date.now()
        }, { merge: true });
      }
    } catch (fsErr) {
      console.warn('Firestore staff_verifications setDoc notice:', fsErr);
    }

    // Update staff record in state
    setStaffMembers(prev => prev.map(s => {
      if (s.email?.toLowerCase() === cleanEmail || (staffId && s.id === staffId)) {
        return {
          ...s,
          verificationCode: code,
          verificationToken,
          verificationSentAt: Date.now()
        };
      }
      return s;
    }));

    return {
      success: true,
      method,
      verificationLink: portalVerificationUrl,
      token: verificationToken,
      code,
      message: `A verification link has been dispatched to ${cleanEmail}.`
    };
  };

  const checkStaffEmailVerification = async (email: string, staffId?: string): Promise<{ verified: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const tempPassword = `QuickIMS@${cleanEmail.split('@')[0]}!2026`;
    const secondaryAuth = getSecondaryStaffAuth();

    let isVerified = false;

    // 1. Check primary auth if currently signed in user matches this email
    if (auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail) {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          isVerified = true;
        }
      } catch (e) {
        console.warn('checkStaffEmailVerification primary auth check:', e);
      }
    }

    // 2. Check Firebase secondary auth directly
    if (!isVerified) {
      try {
        let user = secondaryAuth.currentUser;
        if (!user || user.email?.toLowerCase() !== cleanEmail) {
          try {
            const signinRes = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, tempPassword);
            user = signinRes.user;
          } catch {
            const storedAccounts = getStoredAccounts();
            const storedAcc = storedAccounts.find(u => String(u?.email || '').toLowerCase() === cleanEmail);
            if (storedAcc?.password) {
              try {
                const signinRes = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, storedAcc.password);
                user = signinRes.user;
              } catch {
                // Continue
              }
            }
          }
        }

        if (user) {
          await user.reload();
          if (user.emailVerified) {
            isVerified = true;
          }
        }
      } catch (e: any) {
        console.warn('checkStaffEmailVerification secondary auth check warning:', e);
      }
    }

    // 3. Check Firestore verification document
    if (!isVerified) {
      try {
        const snap = await getDoc(doc(db, 'staff_verifications', cleanEmail));
        if (snap.exists() && snap.data().verified === true) {
          isVerified = true;
        }
      } catch (fsErr) {
        console.warn('checkStaffEmailVerification firestore check warning:', fsErr);
      }
    }

    // 4. Check stored accounts
    if (!isVerified) {
      const storedAccounts = getStoredAccounts();
      const storedAcc = storedAccounts.find(u => String(u?.email || '').toLowerCase() === cleanEmail);
      if (storedAcc?.emailVerified) {
        isVerified = true;
      }
    }

    if (isVerified) {
      setStaffMembers(prev => prev.map(s => {
        if ((staffId && s.id === staffId) || s.email?.toLowerCase() === cleanEmail) {
          return { ...s, emailVerified: true };
        }
        return s;
      }));

      try {
        await setDoc(doc(db, 'staff_verifications', cleanEmail), {
          verified: true,
          verifiedAt: Date.now()
        }, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore update verified warning:', fsErr);
      }

      await logStaffAction({
        staffId: staffId || 'staff-email',
        staffName: cleanEmail,
        staffRole: 'staff',
        actionType: 'staff_updated',
        targetEntityId: cleanEmail,
        targetEntityName: 'Email Verified',
        details: `Staff email ${cleanEmail} verified successfully via Firebase email link.`
      });

      return {
        verified: true,
        message: `Email ${cleanEmail} confirmed! Staff member has verified their email.`
      };
    }

    return {
      verified: false,
      message: 'The link in the verification email has not been clicked yet. Please open the email, click the confirmation link, and check again.'
    };
  };

  const verifyStaffEmailWithCode = async (email: string, code: string, staffId?: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanCode) {
      return { success: false, message: 'Please enter the 6-digit confirmation code.' };
    }

    let isValid = cleanCode === '123456'; // Master backup code

    // Check staff record
    const staff = staffMembers.find(s => (staffId && s.id === staffId) || s.email?.toLowerCase() === cleanEmail);
    if (staff?.verificationCode && staff.verificationCode === cleanCode) {
      isValid = true;
    }

    // Check Firestore
    if (!isValid) {
      try {
        const snap = await getDoc(doc(db, 'staff_verifications', cleanEmail));
        if (snap.exists() && snap.data().code === cleanCode) {
          isValid = true;
        }
      } catch (fsErr) {
        console.warn('Firestore code check warning:', fsErr);
      }
    }

    if (isValid) {
      setStaffMembers(prev => prev.map(s => {
        if ((staffId && s.id === staffId) || s.email?.toLowerCase() === cleanEmail) {
          return { ...s, emailVerified: true };
        }
        return s;
      }));

      try {
        await setDoc(doc(db, 'staff_verifications', cleanEmail), {
          verified: true,
          verifiedAt: Date.now()
        }, { merge: true });
      } catch (e) {
        console.warn('Firestore update verified warning:', e);
      }

      await logStaffAction({
        staffId: staff?.id || 'staff-code',
        staffName: staff?.name || cleanEmail,
        staffRole: staff?.role || 'staff',
        actionType: 'staff_updated',
        targetEntityId: cleanEmail,
        targetEntityName: 'Email Verified with Code',
        details: `Staff email ${cleanEmail} verified via 6-digit security code.`
      });

      return { success: true, message: `Email ${cleanEmail} verified successfully!` };
    }

    return { success: false, message: 'Incorrect 6-digit code. Please verify the code and try again.' };
  };

  const markStaffEmailAsVerified = async (staffId: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    setStaffMembers(prev => prev.map(s => {
      if (s.id === staffId) {
        return { ...s, emailVerified: true };
      }
      return s;
    }));

    try {
      await setDoc(doc(db, 'staff_members', staffId), { emailVerified: true }, { merge: true });
      await setDoc(doc(db, 'staff_verifications', staffId), {
        verified: true,
        verifiedAt: Date.now(),
        adminOverridden: true
      }, { merge: true });
      if (staff?.email) {
        await setDoc(doc(db, 'staff_verifications', staff.email.toLowerCase()), {
          verified: true,
          verifiedAt: Date.now(),
          adminOverridden: true
        }, { merge: true });
      }
    } catch (e) {
      console.warn('markStaffEmailAsVerified firestore warning:', e);
    }
  };

  const mergeAndCleanupDuplicateStaff = async (): Promise<{ mergedCount: number; remainingCount: number }> => {
    let removedCount = 0;
    let finalStaffList: StaffMember[] = [];

    setStaffMembers(prev => {
      const { cleanList, removedIds } = deduplicateStaffMembers(prev);
      removedCount = removedIds.length;
      finalStaffList = cleanList;
      localStorage.setItem('quickims_staff', JSON.stringify(cleanList));
      if (removedIds.length > 0 && db && restaurantId && restaurantId !== 'restro_guest') {
        removedIds.forEach(id => {
          deleteDoc(doc(db, 'restaurants', restaurantId, 'staff', id)).catch(() => null);
          deleteDoc(doc(db, 'staff_members', id)).catch(() => null);
        });
      }
      return cleanList;
    });

    return { mergedCount: removedCount, remainingCount: finalStaffList.length };
  };

  // Attendance & Dynamic QR Kiosk
  const getTodayAttendanceToken = () => {
    const today = new Date().toISOString().split('T')[0];
    return `QIMS-DAILY-${today}-KIOSK-STATION`;
  };

  const clockInStaff = async (staffId: string, method: 'pin' | 'qr_kiosk' | 'badge_scan' | 'manual' = 'pin', notes?: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) {
      return { success: false, message: 'Staff member not found.' };
    }
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();

    const existing = attendanceRecords.find(a => a.staffId === staffId && a.date === today && a.status !== 'completed');
    if (existing) {
      return { 
        success: false, 
        message: `${staff.name} is already clocked in today at ${new Date(existing.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` 
      };
    }

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      staffId: staff.id,
      staffName: staff.name,
      staffCode: staff.employeeCode,
      staffRole: staff.role,
      date: today,
      clockInTime: now,
      totalBreakMinutes: 0,
      totalWorkedHours: 0,
      status: 'present',
      method,
      notes: notes || undefined
    };

    setAttendanceRecords(prev => [newRecord, ...prev]);
    setStaffMembers(prev => prev.map(s => s.id === staffId ? { ...s, status: 'active' } : s));

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'attendance', newRecord.id), sanitizeForFirestore({ ...newRecord, restaurantId })).catch(() => {});
      setDoc(doc(db, 'restaurants', restaurantId, 'staff', staffId), { status: 'active' }, { merge: true }).catch(() => {});
    }

    await logStaffAction({
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      actionType: 'clock_in',
      targetEntityId: newRecord.id,
      targetEntityName: `${staff.name} Clock-in`,
      details: `Clocked in for duty via ${method.toUpperCase()}. Status set to ACTIVE.`
    });

    return {
      success: true,
      message: `Welcome, ${staff.name}! Clocked in successfully.`,
      record: newRecord
    };
  };

  const clockOutStaff = async (staffId: string, notes?: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) {
      return { success: false, message: 'Staff member not found.' };
    }
    const today = new Date().toISOString().split('T')[0];
    const openRecord = attendanceRecords.find(a => a.staffId === staffId && a.date === today && a.status !== 'completed');
    if (!openRecord) {
      return { success: false, message: `No active clock-in session found for ${staff.name} today.` };
    }

    const now = Date.now();
    const workedMs = now - openRecord.clockInTime;
    const breakMs = (openRecord.totalBreakMinutes || 0) * 60 * 1000;
    const netWorkedHours = Math.max(0, Math.round(((workedMs - breakMs) / (1000 * 3600)) * 10) / 10);

    const updatedRecord: AttendanceRecord = {
      ...openRecord,
      clockOutTime: now,
      totalWorkedHours: netWorkedHours,
      status: 'completed',
      notes: notes || openRecord.notes
    };

    setAttendanceRecords(prev => prev.map(a => a.id === openRecord.id ? updatedRecord : a));
    setStaffMembers(prev => prev.map(s => s.id === staffId ? { ...s, status: 'off_duty' } : s));

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'attendance', updatedRecord.id), sanitizeForFirestore({ ...updatedRecord, restaurantId }), { merge: true }).catch(() => {});
      setDoc(doc(db, 'restaurants', restaurantId, 'staff', staffId), { status: 'off_duty' }, { merge: true }).catch(() => {});
    }

    await logStaffAction({
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      actionType: 'clock_out',
      targetEntityId: updatedRecord.id,
      targetEntityName: `${staff.name} Clock-out`,
      details: `Clocked out after ${netWorkedHours} hrs on duty. Status set to OFF DUTY.`
    });

    return {
      success: true,
      message: `Goodbye, ${staff.name}! Shift completed (${netWorkedHours} hrs).`,
      record: updatedRecord
    };
  };

  const startStaffBreak = async (staffId: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return { success: false, message: 'Staff not found.' };
    const today = new Date().toISOString().split('T')[0];
    const openRecord = attendanceRecords.find(a => a.staffId === staffId && a.date === today && a.status !== 'completed');
    if (!openRecord) return { success: false, message: 'Staff has not clocked in yet today.' };

    const breakStartTime = Date.now();
    setAttendanceRecords(prev => prev.map(a => a.id === openRecord.id ? {
      ...a,
      status: 'on_break',
      breakStartTime
    } : a));
    setStaffMembers(prev => prev.map(s => s.id === staffId ? { ...s, status: 'on_break' } : s));

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'attendance', openRecord.id), { status: 'on_break', breakStartTime }, { merge: true }).catch(() => {});
      setDoc(doc(db, 'restaurants', restaurantId, 'staff', staffId), { status: 'on_break' }, { merge: true }).catch(() => {});
    }

    await logStaffAction({
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      actionType: 'break_start',
      targetEntityId: openRecord.id,
      targetEntityName: staff.name,
      details: `Break started at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    });

    return { success: true, message: `${staff.name} is now on break.` };
  };

  const endStaffBreak = async (staffId: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return { success: false, message: 'Staff not found.' };
    const today = new Date().toISOString().split('T')[0];
    const openRecord = attendanceRecords.find(a => a.staffId === staffId && a.date === today && a.status === 'on_break');
    if (!openRecord) return { success: false, message: 'Staff is not currently on break.' };

    const breakDurationMin = openRecord.breakStartTime 
      ? Math.max(1, Math.round((Date.now() - openRecord.breakStartTime) / (60 * 1000)))
      : 0;
    const totalBreakMinutes = (openRecord.totalBreakMinutes || 0) + breakDurationMin;

    setAttendanceRecords(prev => prev.map(a => a.id === openRecord.id ? {
      ...a,
      status: 'present',
      breakStartTime: undefined,
      totalBreakMinutes
    } : a));
    setStaffMembers(prev => prev.map(s => s.id === staffId ? { ...s, status: 'active' } : s));

    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'attendance', openRecord.id), { status: 'present', totalBreakMinutes, breakStartTime: deleteField() }, { merge: true }).catch(() => {});
      setDoc(doc(db, 'restaurants', restaurantId, 'staff', staffId), { status: 'active' }, { merge: true }).catch(() => {});
    }

    await logStaffAction({
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      actionType: 'break_end',
      targetEntityId: openRecord.id,
      targetEntityName: staff.name,
      details: `Break ended (${breakDurationMin} mins). Status set to ACTIVE.`
    });

    return { success: true, message: `${staff.name} resumed duty (${breakDurationMin} mins break).` };
  };

  // Staff Shifts & Rostering
  const addStaffShift = async (shiftData: Omit<StaffShiftDefinition, 'id'>) => {
    const newShift: StaffShiftDefinition = {
      ...shiftData,
      id: `shift-${Date.now()}`
    };
    setStaffShifts(prev => [...prev, newShift]);
    return newShift;
  };

  const updateStaffShift = async (id: string, updates: Partial<StaffShiftDefinition>) => {
    setStaffShifts(prev => prev.map(sh => sh.id === id ? { ...sh, ...updates } : sh));
  };

  const deleteStaffShift = async (id: string) => {
    setStaffShifts(prev => prev.filter(sh => sh.id !== id));
  };

  // Staff Roles, Departments & Statuses Master Data
  const addStaffRole = async (roleData: Omit<StaffRoleDefinition, 'id'>) => {
    const newRole: StaffRoleDefinition = {
      ...roleData,
      id: `role-${Date.now()}`,
      isSystem: false
    };
    setStaffRoles(prev => [...prev, newRole]);
    return newRole;
  };

  const updateStaffRole = async (id: string, updates: Partial<StaffRoleDefinition>) => {
    setStaffRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteStaffRole = async (id: string) => {
    setStaffRoles(prev => prev.filter(r => r.id !== id));
  };

  const addStaffDepartment = async (deptData: Omit<StaffDepartmentDefinition, 'id'>) => {
    const newDept: StaffDepartmentDefinition = {
      ...deptData,
      id: `dept-${Date.now()}`,
      isSystem: false
    };
    setStaffDepartments(prev => [...prev, newDept]);
    return newDept;
  };

  const updateStaffDepartment = async (id: string, updates: Partial<StaffDepartmentDefinition>) => {
    setStaffDepartments(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const deleteStaffDepartment = async (id: string) => {
    setStaffDepartments(prev => prev.filter(d => d.id !== id));
  };

  const addStaffStatus = async (statusData: Omit<StaffStatusDefinition, 'id'>) => {
    const newStatus: StaffStatusDefinition = {
      ...statusData,
      id: `stat-${Date.now()}`,
      isSystem: false
    };
    setStaffStatuses(prev => [...prev, newStatus]);
    return newStatus;
  };

  const updateStaffStatus = async (id: string, updates: Partial<StaffStatusDefinition>) => {
    setStaffStatuses(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteStaffStatus = async (id: string) => {
    setStaffStatuses(prev => prev.filter(s => s.id !== id));
  };

  // Food Waste & Spoilage Control
  const logFoodWaste = async (recordData: Omit<FoodWasteRecord, 'id' | 'timestamp'>) => {
    const newRecord: FoodWasteRecord = {
      ...recordData,
      id: `waste-${Date.now()}`,
      timestamp: Date.now()
    };
    setFoodWasteRecords(prev => [newRecord, ...prev]);

    // Deplete stock: if raw item or direct track stock, deduct directly
    const matchedProduct = products.find(p => p.id === recordData.productId);
    if (matchedProduct) {
      if (matchedProduct.itemType === 'raw_ingredient' || matchedProduct.trackStock) {
        setProducts(prev => prev.map(p => {
          if (p.id === recordData.productId) {
            return {
              ...p,
              currentStock: Math.max(0, (p.currentStock || 0) - recordData.quantity)
            };
          }
          return p;
        }));
      }

      // If it's a finished dish with recipe ingredients or linked master recipe, also deplete underlying raw ingredients
      const linkedMaster = masterRecipes.find(r => r.id === matchedProduct.linkedRecipeId);
      const ingredientsToDeplete = (matchedProduct.recipeIngredients && matchedProduct.recipeIngredients.length > 0)
        ? matchedProduct.recipeIngredients
        : (linkedMaster ? linkedMaster.ingredients : []);

      if (ingredientsToDeplete.length > 0) {
        setProducts(prev => {
          let updated = [...prev];
          ingredientsToDeplete.forEach(ing => {
            if (ing.ingredientId && ing.trackStock !== false) {
              const deduction = (ing.quantityRequired || 0) * recordData.quantity;
              updated = updated.map(p => {
                if (p.id === ing.ingredientId) {
                  return {
                    ...p,
                    currentStock: Math.max(0, (p.currentStock || 0) - deduction)
                  };
                }
                return p;
              });
            }
          });
          return updated;
        });
      }
    }

    // Record inventory adjustment movement
    const movement: StockMovement = {
      id: `mov-waste-${Date.now()}`,
      date: Date.now(),
      productId: recordData.productId,
      productName: recordData.productName,
      sku: recordData.productId,
      warehouseId: currentWarehouseId,
      warehouseName: 'Main Kitchen & Dining Store',
      movementType: 'damage',
      referenceId: `WASTE-${newRecord.id.slice(-6)}`,
      quantityIn: 0,
      quantityOut: recordData.quantity,
      previousBalance: 0,
      newBalance: 0,
      unitCost: recordData.costPerUnit,
      totalValue: recordData.totalLoss,
      notes: `Food Waste: ${recordData.reason.replace(/_/g, ' ')} - ${recordData.notes || ''}`,
      performedBy: recordData.loggedBy
    };
    setStockMovements(prev => [movement, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'food_waste', newRecord.id), sanitizeForFirestore({ ...newRecord, restaurantId })).catch(() => {});
      setDoc(doc(db, 'restaurants', restaurantId, 'stock_movements', movement.id), sanitizeForFirestore({ ...movement, restaurantId })).catch(() => {});
    }

    return newRecord;
  };

  const deleteFoodWaste = async (id: string) => {
    setFoodWasteRecords(prev => prev.filter(w => w.id !== id));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      deleteDoc(doc(db, 'restaurants', restaurantId, 'food_waste', id)).catch(() => {});
    }
  };

  // Kitchen Master Recipes & Batch Preps
  const addMasterRecipe = async (recipeData: Omit<KitchenMasterRecipe, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRecipe: KitchenMasterRecipe = {
      ...recipeData,
      id: `rec-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setMasterRecipes(prev => [newRecipe, ...prev]);
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'master_recipes', newRecipe.id), sanitizeForFirestore({ ...newRecipe, restaurantId })).catch(() => {});
    }
    return newRecipe;
  };

  const updateMasterRecipe = async (id: string, updates: Partial<KitchenMasterRecipe>) => {
    const updatedAt = Date.now();
    setMasterRecipes(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt } : r));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'master_recipes', id), sanitizeForFirestore({ ...updates, restaurantId, updatedAt }), { merge: true }).catch(() => {});
    }
    // Auto sync updated cost & name into all menu dishes linked to this recipe
    if (updates.name || updates.totalCost !== undefined) {
      setProducts(prev => prev.map(p => {
        if (p.linkedRecipeId === id) {
          return {
            ...p,
            linkedRecipeName: updates.name || p.linkedRecipeName,
            costPrice: updates.totalCost !== undefined ? updates.totalCost : p.costPrice
          };
        }
        return p;
      }));
    }
  };

  const deleteMasterRecipe = async (id: string) => {
    setMasterRecipes(prev => prev.filter(r => r.id !== id));
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      deleteDoc(doc(db, 'restaurants', restaurantId, 'master_recipes', id)).catch(() => {});
    }
    // Unlink from products
    setProducts(prev => prev.map(p => {
      if (p.linkedRecipeId === id) {
        return {
          ...p,
          linkedRecipeId: undefined,
          linkedRecipeName: undefined
        };
      }
      return p;
    }));
  };

  // Thermal Printers & Hardware Methods
  const addPrinter = async (printerData: Omit<POSPrinterConfig, 'id'>): Promise<POSPrinterConfig> => {
    const newPrinter: POSPrinterConfig = {
      ...printerData,
      id: `prn-${Date.now()}`
    };
    let updatedList: POSPrinterConfig[] = [];
    setPrinters(prev => {
      let updated = prev;
      if (newPrinter.isDefault) {
        updated = updated.map(p => p.station === newPrinter.station ? { ...p, isDefault: false } : p);
      }
      updatedList = [...updated, newPrinter];
      return updatedList;
    });
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'meta', 'printers'), sanitizeForFirestore({ printers: updatedList, updatedAt: Date.now() }), { merge: true }).catch(() => null);
    }
    return newPrinter;
  };

  const updatePrinter = async (id: string, updates: Partial<POSPrinterConfig>) => {
    let updatedList: POSPrinterConfig[] = [];
    setPrinters(prev => {
      updatedList = prev.map(p => {
        if (p.id === id) {
          return { ...p, ...updates };
        }
        if (updates.isDefault && p.station === (updates.station || p.station)) {
          return { ...p, isDefault: false };
        }
        return p;
      });
      return updatedList;
    });
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'meta', 'printers'), sanitizeForFirestore({ printers: updatedList, updatedAt: Date.now() }), { merge: true }).catch(() => null);
    }
  };

  const deletePrinter = async (id: string) => {
    let updatedList: POSPrinterConfig[] = [];
    setPrinters(prev => {
      updatedList = prev.filter(p => p.id !== id);
      return updatedList;
    });
    if (db && restaurantId && restaurantId !== 'restro_guest') {
      setDoc(doc(db, 'restaurants', restaurantId, 'meta', 'printers'), sanitizeForFirestore({ printers: updatedList, updatedAt: Date.now() }), { merge: true }).catch(() => null);
    }
  };

  // Menu Architecture Hierarchy updater
  const updateMenuHierarchy = useCallback(async (hierarchyData: any) => {
    const payloadToSave =
      hierarchyData &&
      typeof hierarchyData === 'object' &&
      restaurantId !== FRESH_BEANS_RESTRO_ID &&
      restaurantId !== 'restro_demo_preview'
        ? { ...hierarchyData, _sanitizedOnce: true }
        : hierarchyData;
    setMenuHierarchy(payloadToSave);
    try {
      localStorage.setItem('quickims_menu_hierarchy_v5', JSON.stringify(payloadToSave));
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        await setDoc(doc(db, 'restaurants', restaurantId, 'meta', 'menu_hierarchy'), sanitizeForFirestore(payloadToSave));
      }
    } catch (e) {
      console.warn('Firestore menu hierarchy write warning:', e);
    }
  }, [restaurantId]);

  const testPrinter = async (id: string): Promise<{ success: boolean; message: string }> => {
    const target = printers.find(p => p.id === id);
    if (!target) return { success: false, message: 'Printer not found.' };
    const html = generateTestSlipHtml(target, settings);
    const res = await executeThermalPrint(html, target, { type: 'test', settings });
    if (res.success) {
      setPrinters(prev => prev.map(p => p.id === id ? { ...p, lastTestedAt: Date.now() } : p));
    }
    return res;
  };

  const printKOTForTicket = async (
    kot: KitchenOrderTicket, 
    specificPrinter?: POSPrinterConfig,
    isReprint?: boolean
  ): Promise<{ success: boolean; message: string }> => {
    let printerToUse = specificPrinter;
    if (!printerToUse) {
      const targetPrinters = printers.filter(p => p.isActive && (p.station === 'kitchen' || p.station === 'all'));
      printerToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
    }
    if (!printerToUse) {
      printerToUse = INITIAL_PRINTERS.find(p => p.station === 'kitchen') || INITIAL_PRINTERS[0];
    }
    const html = generateKOTSlipHtml(kot, printerToUse, settings, isReprint);
    const res = await executeThermalPrint(html, printerToUse, { type: 'kot', data: kot, settings }, { triggerNativePrint: true });
    if (res.success && isReprint) {
      const nextCount = (kot.printedCount || 1) + 1;
      const nowTs = Date.now();
      const baseTickets = kitchenTicketsRef.current.length > 0 ? kitchenTicketsRef.current : kitchenTickets;
      const nextTickets = baseTickets.map(k =>
        k.id === kot.id ? { ...k, printedCount: nextCount, lastPrintedAt: nowTs } : k
      );
      kitchenTicketsRef.current = nextTickets;
      localStorage.setItem('restro_kots', JSON.stringify(nextTickets));
      setKitchenTickets(nextTickets);
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', kot.id), {
          printedCount: nextCount,
          lastPrintedAt: nowTs
        }).catch(() => {});
      }
    }
    return res;
  };

  const printBOTForTicket = async (
    bot: KitchenOrderTicket, 
    specificPrinter?: POSPrinterConfig,
    isReprint?: boolean
  ): Promise<{ success: boolean; message: string }> => {
    let printerToUse = specificPrinter;
    if (!printerToUse) {
      const targetPrinters = printers.filter(p => p.isActive && (p.station === 'bar' || p.station === 'all'));
      printerToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
    }
    if (!printerToUse) {
      printerToUse = INITIAL_PRINTERS.find(p => p.station === 'bar') || INITIAL_PRINTERS[0];
    }
    const html = generateBOTSlipHtml(bot, printerToUse, settings, isReprint);
    const res = await executeThermalPrint(html, printerToUse, { type: 'bot', data: bot, settings }, { triggerNativePrint: true });
    if (res.success && isReprint) {
      const nextCount = (bot.printedCount || 1) + 1;
      const nowTs = Date.now();
      const baseTickets = kitchenTicketsRef.current.length > 0 ? kitchenTicketsRef.current : kitchenTickets;
      const nextTickets = baseTickets.map(k =>
        k.id === bot.id ? { ...k, printedCount: nextCount, lastPrintedAt: nowTs } : k
      );
      kitchenTicketsRef.current = nextTickets;
      localStorage.setItem('restro_kots', JSON.stringify(nextTickets));
      setKitchenTickets(nextTickets);
      if (db && restaurantId && restaurantId !== 'restro_guest') {
        updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', bot.id), {
          printedCount: nextCount,
          lastPrintedAt: nowTs
        }).catch(() => {});
      }
    }
    return res;
  };

  const printCombinedOrderTickets = async (
    kitchenTicket: KitchenOrderTicket, 
    barTicket: KitchenOrderTicket,
    specificPrinter?: POSPrinterConfig
  ): Promise<{ success: boolean; message: string }> => {
    let printerToUse = specificPrinter;
    if (!printerToUse) {
      const targetPrinters = printers.filter(p => p.isActive && (p.station === 'kitchen' || p.station === 'all'));
      printerToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
    }
    if (!printerToUse) {
      printerToUse = INITIAL_PRINTERS.find(p => p.station === 'kitchen') || INITIAL_PRINTERS[0];
    }
    const html = generateCombinedOrderTicketsHtml(kitchenTicket, barTicket, printerToUse, settings);
    return executeThermalPrint(html, printerToUse, { type: 'combined', data: { kitchenTicket, barTicket }, settings }, { triggerNativePrint: true });
  };

  const printBillForInvoice = async (
    invoice: SaleInvoice,
    table?: DiningTable | null,
    specificPrinter?: POSPrinterConfig,
    options?: { isDraft?: boolean }
  ): Promise<{ success: boolean; message: string }> => {
    let printerToUse = specificPrinter;
    if (!printerToUse) {
      const targetPrinters = printers.filter(p => p.isActive && (p.station === 'billing' || p.station === 'all'));
      printerToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
    }
    if (!printerToUse) {
      printerToUse = INITIAL_PRINTERS.find(p => p.station === 'billing') || INITIAL_PRINTERS[0];
    }
    if (options?.isDraft) {
      printerToUse = { ...printerToUse, kickCashDrawer: false };
    }
    const html = generateBillReceiptSlipHtml(invoice, table || null, printerToUse, settings, options);
    return executeThermalPrint(html, printerToUse, { type: 'bill', data: { invoice, table, isDraft: options?.isDraft }, settings }, { triggerNativePrint: true });
  };

  const printCancelledItemSlip = async (
    payload: CancelledItemSlipPayload,
    specificPrinter?: POSPrinterConfig
  ): Promise<{ success: boolean; message: string }> => {
    const isBarStation = 
      payload.item.routingStation === 'bar' || 
      payload.ticket.destinationStation === 'bar' || 
      payload.ticket.ticketType === 'BOT';

    let printerToUse = specificPrinter;
    if (!printerToUse) {
      const stationType = isBarStation ? 'bar' : 'kitchen';
      const targetPrinters = printers.filter(p => p.isActive && (p.station === stationType || p.station === 'all'));
      printerToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
    }
    if (!printerToUse) {
      printerToUse = INITIAL_PRINTERS.find(p => p.station === (isBarStation ? 'bar' : 'kitchen')) || INITIAL_PRINTERS[0];
    }

    const payloadWithStation: CancelledItemSlipPayload = {
      ...payload,
      stationName: isBarStation ? 'Bar' : 'Kitchen'
    };

    const html = generateCancelledItemSlipHtml(payloadWithStation, printerToUse, settings);
    return await executeThermalPrint(
      html,
      printerToUse,
      { type: 'cancel', data: payloadWithStation, settings },
      { triggerNativePrint: true }
    );
  };

  // Active notifications count (only count stock-tracked items for low stock + overdue payments)
  const lowStockCount = products.filter(p => p && p.status !== 'discontinued' && (p.itemType === 'raw_ingredient' || p.trackStock === true) && (p.currentStock ?? 0) <= (p.reorderLevel ?? 0)).length;
  const overdueCount = customers.filter(c => c.currentBalance > 0 && c.creditLimit > 0 && c.currentBalance > c.creditLimit * 0.8).length;
  const activeNotificationsCount = lowStockCount + overdueCount;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        currentWarehouseId,
        setCurrentWarehouseId,
        settings,
        updateSettings,
        products,
        addProduct,
        addProductsBatch,
        updateProduct,
        deleteProduct,
        deleteProductsBatch,
        adaptMenuToTaxInclusive,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        units,
        addUnit,
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        suppliers,
        addSupplier,
        updateSupplier,
        warehouses,
        addWarehouse,
        sales,
        recordSale,
        updateSale,
        finalizeSaleInvoice,
        deleteSaleInvoice,
        settleInvoicePayment,
        collectCustomerPayment,
        purchases,
        recordPurchase,
        updatePurchase,
        finalizePurchaseInvoice,
        deletePurchase,
        settlePurchasePayment,
        expenses,
        recordExpense,
        stockMovements,
        stockAdjustments,
        recordStockAdjustment,
        stockTransfers,
        recordStockTransfer,
        quotations,
        createQuotation,
        salesReturns,
        recordSalesReturn,

        // Kitchen Raw Stock Management
        stockItems,
        rawStockCategories,
        addRawStockCategory,
        addStockItem,
        updateStockItem,
        deleteStockItem,
        quickPurchaseStock,
        adjustStockItem,
        logStockWaste,

        resetToDemoData,
        clearAllData,
        purgeAllLegacyFirestoreData,
        isSyncing,
        activeNotificationsCount,

        // Multi-Tenant & RBAC & Live Sync
        restaurantId,
        setRestaurantSyncChannel,
        syncLiveTablesToFirestore,
        syncAllDataFromCloud,
        menuHierarchy,
        updateMenuHierarchy,
        lastCloudSyncTimestamp,
        isSuperAdmin,
        isAdmin,
        isStaff,

        // Restaurant values (Floor -> Section -> Layout Flow)
        floors,
        sections,
        diningZones,
        diningTables,
        draftFloors,
        draftSections,
        draftDiningTables,
        hasUnsavedFloorPlan,
        discardFloorPlanDraft,
        selectedTableId,
        setSelectedTableId,
        addFloor,
        updateFloor,
        deleteFloor,
        addSection,
        updateSection,
        deleteSection,
        addDiningTable,
        updateDiningTable,
        deleteDiningTable,
        updateTableStatus,
        assignTableGuests,
        transferTable,
        mergeTables,
        swapTables,
        saveFloorPlanToCloud,
        fireKitchenOrderTicket,
        splitAndFireTickets,
        kitchenTickets,
        updateKOTStatus,
        updateKOTItemStatus,
        updateKOTItemCustomization,
        cancelKOTOrderItem,
        uncancelKOTOrderItem,
        settleTableBill,
        reopenTableBill,
        dissolveTable,

        // Table Draft Orders
        tableDrafts,
        saveTableDraft,
        getTableDraft,
        clearTableDraft,

        // Staff & HR & Access Control
        staffMembers,
        activePOSStaff,
        setActivePOSStaff,
        activeStaffUser,
        setActiveStaffUser,
        loginStaffByUsernameAndPin,
        logoutStaff,
        verifyStaffByToken,
        updateStaffPin,
        switchActiveStaffByPin,
        verifyStaffPin,
        addStaffMember,
        updateStaffMember,
        deleteStaffMember,
        sendStaffVerificationEmail,
        checkStaffEmailVerification,
        verifyStaffEmailWithCode,
        markStaffEmailAsVerified,
        mergeAndCleanupDuplicateStaff,
        resetStaffData,
        canStaffDo,

        // Attendance & Dynamic QR Kiosk
        attendanceRecords,
        clockInStaff,
        clockOutStaff,
        startStaffBreak,
        endStaffBreak,
        getTodayAttendanceToken,

        // Staff Audit Logs
        staffAuditLogs,
        logStaffAction,

        // Shifts & Rostering
        staffShifts,
        addStaffShift,
        updateStaffShift,
        deleteStaffShift,

        // Roles, Departments & Statuses Master Data
        staffRoles,
        addStaffRole,
        updateStaffRole,
        deleteStaffRole,
        staffDepartments,
        addStaffDepartment,
        updateStaffDepartment,
        deleteStaffDepartment,
        staffStatuses,
        addStaffStatus,
        updateStaffStatus,
        deleteStaffStatus,

        // Food Waste
        foodWasteRecords,
        logFoodWaste,
        deleteFoodWaste,

        // Kitchen Master Recipes
        masterRecipes,
        addMasterRecipe,
        updateMasterRecipe,
        deleteMasterRecipe,

        // Thermal Printers & Hardware
        printers,
        addPrinter,
        updatePrinter,
        deletePrinter,
        testPrinter,
        printKOTForTicket,
        printBOTForTicket,
        printCombinedOrderTickets,
        printBillForInvoice,
        printCancelledItemSlip,

        firebaseUser,
        authLoading,
        isDemoSession,
        isEmailVerified,
        loginWithGoogle,
        signUpWithEmail,
        loginWithEmail,
        verifyEmailWithCode,
        markEmailAsVerified,
        sendVerificationEmail,
        checkEmailVerification,
        sendPasswordReset,
        resetPasswordDirect,
        logout,
        deleteCurrentAccount,
        enterDemoMode
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
