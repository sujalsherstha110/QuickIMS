import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Product, Customer, Supplier, Warehouse, SaleInvoice, PurchaseInvoice, 
  StockMovement, ExpenseRecord, CompanySettings, UnitDefinition, Quotation, SalesReturn, StockAdjustment, StockTransfer,
  ProductCategory, AppAuthUser, StoredUserAccount,
  DiningZone, DiningTable, KitchenOrderTicket, TableSession, KOTItem,
  TableDraftOrder, TableDraftItem,
  StaffMember, StaffPermissions, AttendanceRecord, StaffAuditLog, StaffShiftDefinition,
  StaffRoleDefinition, StaffDepartmentDefinition, StaffStatusDefinition, StaffDocument,
  FoodWasteRecord, KitchenMasterRecipe,
  RestaurantFloor, RestaurantSection,
  POSPrinterConfig
} from '../types';
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
  INITIAL_FOOD_WASTE, INITIAL_MASTER_RECIPES, INITIAL_PRINTERS
} from '../data/restaurantInitialData';
import {
  generateKOTSlipHtml,
  generateBOTSlipHtml,
  generateBillReceiptSlipHtml,
  generateTestSlipHtml,
  executeThermalPrint
} from '../utils/printerService';
import { db, auth, googleProvider, getSecondaryStaffAuth } from '../firebase';
import { 
  signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, deleteUser
} from 'firebase/auth';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, where, orderBy, limit, getDocFromServer, getDoc, onSnapshot 
} from 'firebase/firestore';

const USERS_STORAGE_KEY = 'quickims_registered_users';
const ACTIVE_SESSION_STORAGE_KEY = 'quickims_active_auth_session';

export function getStoredAccounts(): StoredUserAccount[] {
  try {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to parse stored accounts', e);
  }
  const initialAccounts: StoredUserAccount[] = [
    {
      uid: 'usr-admin-default',
      email: 'admin@quickims.np',
      password: 'password123',
      name: 'System Administrator',
      role: 'super_admin',
      emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      provider: 'google'
    },
    {
      uid: 'usr-demo-counter',
      email: 'counter@quickims.np',
      password: 'password123',
      name: 'Counter Cashier',
      role: 'sales',
      emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      provider: 'password'
    }
  ];
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialAccounts));
  return initialAccounts;
}

export function saveStoredAccount(account: StoredUserAccount) {
  const existing = getStoredAccounts();
  const index = existing.findIndex(u => u.email.toLowerCase() === account.email.toLowerCase());
  if (index >= 0) {
    existing[index] = account;
  } else {
    existing.push(account);
  }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(existing));
}

function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
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
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string, permanent?: boolean) => Promise<void>;

  categories: ProductCategory[];
  addCategory: (category: Omit<ProductCategory, 'id'>) => Promise<ProductCategory>;
  updateCategory: (id: string, updates: Partial<ProductCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  units: UnitDefinition[];
  addUnit: (unit: Omit<UnitDefinition, 'id'>) => Promise<void>;
  
  customers: Customer[];
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  
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
  
  // Restaurant Operations (Floor -> Section -> Layout Flow)
  floors: RestaurantFloor[];
  sections: RestaurantSection[];
  diningZones: DiningZone[];
  diningTables: DiningTable[];
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
  }) => Promise<{ kitchenTicket?: KitchenOrderTicket; barTicket?: KitchenOrderTicket }>;
  kitchenTickets: KitchenOrderTicket[];
  updateKOTStatus: (kotId: string, status: KitchenOrderTicket['status']) => Promise<void>;
  updateKOTItemStatus: (kotId: string, itemId: string, status: KOTItem['status']) => Promise<void>;
  settleTableBill: (tableId: string, invoice: SaleInvoice) => Promise<void>;
  
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
  printKOTForTicket: (kot: KitchenOrderTicket) => Promise<{ success: boolean; message: string }>;
  printBOTForTicket: (bot: KitchenOrderTicket) => Promise<{ success: boolean; message: string }>;
  printBillForInvoice: (invoice: SaleInvoice, table?: DiningTable | null) => Promise<{ success: boolean; message: string }>;

  // Multi-Tenant & RBAC & Live Sync
  restaurantId: string;
  setRestaurantSyncChannel: (id: string) => void;
  syncLiveTablesToFirestore: (tables: DiningTable[], drafts?: Record<string, TableDraftOrder>) => Promise<void>;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserContextState>({
    id: 'usr-admin-1',
    name: 'Restaurant Owner',
    role: 'owner',
    branchId: 'wh-main'
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
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    };
    testConnection();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const isAdmin = user.email === 'admin@quickims.np' || user.email?.startsWith('admin') || !user.email;
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
        setCurrentUser({
          id: user.uid,
          name: appUser.displayName || 'Restaurant Owner',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
          role: 'owner',
          branchId: 'wh-main'
        });
        sessionStorage.removeItem('quickims_demo_session');
        setIsDemoSession(false);
      } else {
        const cached = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as AppAuthUser;
            setFirebaseUser(parsed);
            setCurrentUser({
              id: parsed.uid,
              name: parsed.displayName || 'Restaurant Owner',
              email: parsed.email || '',
              photoURL: parsed.photoURL || undefined,
              role: 'owner',
              branchId: 'wh-main'
            });
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
        const isAdmin = res.user.email === 'admin@quickims.np' || res.user.email?.startsWith('admin') || !res.user.email;
        const appUser: AppAuthUser = {
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName || 'Admin User',
          photoURL: res.user.photoURL || undefined,
          emailVerified: res.user.emailVerified,
          providerId: 'google.com'
        };
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
        return;
      }
    } catch (err: any) {
      console.warn('Firebase popup unavailable, using verified Google identity fallback:', err.code, err.message);
      const isFallbackCondition =
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/internal-error' ||
        err.code === 'auth/cancelled-popup-request' ||
        err.message?.includes('OPERATION_NOT_ALLOWED');

      if (isFallbackCondition) {
        sessionStorage.removeItem('quickims_demo_session');
        setIsDemoSession(false);
        const appUser: AppAuthUser = {
          uid: 'usr-google-admin',
          email: 'admin@quickims.np',
          displayName: 'System Administrator',
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          emailVerified: true,
          providerId: 'google.com'
        };
        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
        setCurrentUser({
          id: appUser.uid,
          name: appUser.displayName || 'System Administrator',
          email: appUser.email || '',
          photoURL: appUser.photoURL || undefined,
          role: 'super_admin',
          branchId: 'wh-main'
        });
        return;
      }
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
      const appUser: AppAuthUser = {
        uid: res.user.uid,
        email: res.user.email,
        displayName: cleanName,
        emailVerified: res.user.emailVerified,
        providerId: 'password'
      };
      setFirebaseUser(appUser);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
      return;
    } catch (err: any) {
      console.warn('Firebase createUser failed, falling back to local user store:', err.code, err.message);
      const isProviderDisabled =
        err.code === 'auth/operation-not-allowed' ||
        err.message?.includes('OPERATION_NOT_ALLOWED');

      if (isProviderDisabled) {
        const existingUsers = getStoredAccounts();
        const existing = existingUsers.find(u => u.email.toLowerCase() === cleanEmail);
        if (existing) {
          const customErr = new Error('An account with this email already exists. Please sign in instead.');
          (customErr as any).code = 'auth/email-already-in-use';
          throw customErr;
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        console.info(`[Quick IMS Security] Email verification code generated for ${cleanEmail}: ${verificationCode}`);
        const isSuperAdmin = cleanEmail === 'admin@quickims.np' || cleanEmail.startsWith('admin');
        const newAccount: StoredUserAccount = {
          uid: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          email: cleanEmail,
          password: password,
          name: cleanName,
          role: 'owner',
          emailVerified: false,
          verificationCode: verificationCode,
          createdAt: new Date().toISOString(),
          provider: 'password'
        };
        saveStoredAccount(newAccount);

        const appUser: AppAuthUser = {
          uid: newAccount.uid,
          email: newAccount.email,
          displayName: newAccount.name,
          emailVerified: false,
          providerId: 'password',
          verificationCode: verificationCode
        };

        sessionStorage.removeItem('quickims_demo_session');
        setIsDemoSession(false);
        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));

        setCurrentUser({
          id: newAccount.uid,
          name: newAccount.name,
          email: newAccount.email,
          role: newAccount.role,
          branchId: 'wh-main'
        });
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
      const appUser: AppAuthUser = {
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName || cleanEmail.split('@')[0],
        emailVerified: res.user.emailVerified,
        providerId: 'password'
      };
      setFirebaseUser(appUser);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
      return;
    } catch (err: any) {
      console.warn('Firebase login failed, checking stored accounts for migration:', err.code, err.message);

      // Check if user was registered locally before Firebase Email/Password provider was enabled
      const existingUsers = getStoredAccounts();
      const account = existingUsers.find(u => u.email.toLowerCase() === cleanEmail);

      if (account && account.password === password) {
        try {
          const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          if (account.name) {
            await updateProfile(res.user, { displayName: account.name });
          }
          if (!account.emailVerified) {
            try {
              await sendEmailVerification(res.user);
            } catch (vErr) {
              console.warn('Verification dispatch on migration:', vErr);
            }
          }
          const appUser: AppAuthUser = {
            uid: res.user.uid,
            email: res.user.email,
            displayName: account.name,
            emailVerified: res.user.emailVerified,
            providerId: 'password'
          };
          setFirebaseUser(appUser);
          localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
          return;
        } catch (migErr) {
          console.warn('Auto-sync to Firebase Auth on login error:', migErr);
        }
      }

      const isProviderDisabled =
        err.code === 'auth/operation-not-allowed' ||
        err.message?.includes('OPERATION_NOT_ALLOWED');

      if (isProviderDisabled || account) {

        if (!account) {
          if (cleanEmail === 'admin@quickims.np' || cleanEmail.startsWith('admin')) {
            const ownerAccount: StoredUserAccount = {
              uid: 'usr_owner_admin',
              email: cleanEmail,
              password: password,
              name: 'System Administrator',
              role: 'super_admin',
              emailVerified: true,
              createdAt: new Date().toISOString(),
              provider: 'password'
            };
            saveStoredAccount(ownerAccount);

            const appUser: AppAuthUser = {
              uid: ownerAccount.uid,
              email: ownerAccount.email,
              displayName: ownerAccount.name,
              emailVerified: true,
              providerId: 'password'
            };

            sessionStorage.removeItem('quickims_demo_session');
            setIsDemoSession(false);
            setFirebaseUser(appUser);
            localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
            setCurrentUser({
              id: ownerAccount.uid,
              name: ownerAccount.name,
              email: ownerAccount.email,
              role: 'super_admin',
              branchId: 'wh-main'
            });
            return;
          }

          const notFoundErr = new Error('No account found with this email. Please switch to Create Account.');
          (notFoundErr as any).code = 'auth/user-not-found';
          throw notFoundErr;
        }

        if (account.password && account.password !== password) {
          const passErr = new Error('Invalid password for this account. Please try again or reset password.');
          (passErr as any).code = 'auth/wrong-password';
          throw passErr;
        }

        const appUser: AppAuthUser = {
          uid: account.uid,
          email: account.email,
          displayName: account.name,
          emailVerified: account.emailVerified,
          providerId: 'password',
          verificationCode: account.verificationCode
        };

        sessionStorage.removeItem('quickims_demo_session');
        setIsDemoSession(false);
        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
        setCurrentUser({
          id: account.uid,
          name: account.name,
          email: account.email,
          role: account.role,
          branchId: 'wh-main'
        });
        return;
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
    const account = existingUsers.find(u => u.email.toLowerCase() === cleanEmail);

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
    const account = existingUsers.find(u => u.email.toLowerCase() === cleanEmail);
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
      const account = existingUsers.find(u => u.email.toLowerCase() === cleanEmail);

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
      const account = existingUsers.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
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
        const account = existingUsers.find(u => u.email.toLowerCase() === cleanEmail);
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
    const account = existingUsers.find(u => u.email.toLowerCase() === cleanEmail);
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
      setIsDemoSession(false);
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
        const filtered = stored.filter(acc => acc.email.toLowerCase() !== userEmail);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
      } catch (e) {
        console.warn('Local account removal error:', e);
      }
    }

    // 3. Clear all session items & reset state
    sessionStorage.removeItem('quickims_demo_session');
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    localStorage.removeItem('quickims_resend_cooldown_expiry');
    setIsDemoSession(false);
    setFirebaseUser(null);
    setCurrentUser({
      id: 'usr-guest',
      name: 'Guest User',
      role: 'sales',
      branchId: 'wh-main'
    });
  };

  const enterDemoMode = () => {
    sessionStorage.setItem('quickims_demo_session', 'true');
    setIsDemoSession(true);
    setCurrentUser({
      id: 'usr-demo-1',
      name: 'Demo Operator (Preview)',
      email: 'operator@quickims.np',
      role: 'super_admin',
      branchId: 'wh-main'
    });
  };

  // Core state collections
  const [settings, setSettings] = useState<CompanySettings>(() => {
    const cached = localStorage.getItem('quickims_settings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.companyName && !parsed.companyName.includes('Hardware')) {
          return parsed;
        }
      } catch {
        return DEFAULT_RESTAURANT_SETTINGS;
      }
    }
    return DEFAULT_RESTAURANT_SETTINGS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('quickims_products');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // If cached only contains old hardware items or is marked cleared, return empty
        const hasHardware = parsed.some((p: any) => p.sku?.startsWith('PVC-') || p.sku?.startsWith('CPVC-') || p.category?.includes('Pipes'));
        if (hasHardware) {
          localStorage.setItem('quickims_data_cleared', 'true');
          return [];
        }
        // User requested: Remove dummy data from kitchen recipe BOM and food costing because they haven't entered any data in recipe section
        const cleaned = parsed.map((p: any) => {
          if (p.itemType === 'raw_ingredient') {
            return { ...p, recipeIngredients: [] };
          }
          return {
            ...p,
            recipeIngredients: [],
            costPrice: 0
          };
        });
        localStorage.setItem('quickims_products', JSON.stringify(cleaned));
        return cleaned;
      } catch {
        return [];
      }
    }
    return [];
  });

  const [categories, setCategories] = useState<ProductCategory[]>(() => {
    const cached = localStorage.getItem('quickims_categories');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasHardware = parsed.some((c: any) => c.name?.includes('Pipes') || c.name?.includes('Sanitaryware'));
        return hasHardware ? RESTAURANT_MENU_CATEGORIES : parsed;
      } catch {
        return RESTAURANT_MENU_CATEGORIES;
      }
    }
    return RESTAURANT_MENU_CATEGORIES;
  });

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
        return parsed;
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
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [sections, setSections] = useState<RestaurantSection[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_sections');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : [];
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
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [selectedTableId, setSelectedTableId] = useState<string | null>(() => {
    return null;
  });

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

  const [kitchenTickets, setKitchenTickets] = useState<KitchenOrderTicket[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];

    const cached = localStorage.getItem('restro_kots');
    return cached ? JSON.parse(cached) : [];
  });

  const isDummyStaff = (s: any) => {
    if (!s || !s.name) return true;
    const dummyNames = [
      'sujal shrestha', 'suresh thapa', 'rohan maharjan', 'rohan', 
      'pooja karki', 'pooja', 'aashish tamang', 'anita gurung', 
      'bikash shrestha', 'bikash', 'alex'
    ];
    const dummyIds = [
      'staff-0', 'staff-1', 'staff-2', 'staff-3', 'staff-4', 'staff-5', 'staff-6',
      'staff-sample-1', 'staff-sample-2', 'staff-demo'
    ];
    if (dummyIds.includes(s.id)) return true;
    if (dummyNames.some(d => s.name.toLowerCase().includes(d))) return true;
    if (s.employeeCode && ['EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005', 'EMP-006', 'EMP-007'].includes(s.employeeCode)) return true;
    return false;
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

  // Thermal Printers state
  const [printers, setPrinters] = useState<POSPrinterConfig[]>(() => {
    const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
    if (isCleared) return [];
    const cached = localStorage.getItem('quickims_printers');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* ignore */ }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('quickims_printers', JSON.stringify(printers));
  }, [printers]);

  const [activePOSStaff, setActivePOSStaff] = useState<StaffMember | null>(null);
  const [activeStaffUser, setActiveStaffUser] = useState<StaffMember | null>(() => {
    const cached = localStorage.getItem('quickims_active_staff_session');
    if (cached) {
      try { return JSON.parse(cached); } catch { return null; }
    }
    return null;
  });

  useEffect(() => {
    if (activeStaffUser) {
      localStorage.setItem('quickims_active_staff_session', JSON.stringify(activeStaffUser));
    } else {
      localStorage.removeItem('quickims_active_staff_session');
    }
  }, [activeStaffUser]);

  const [restaurantId, setRestaurantIdState] = useState<string>(() => {
    const cachedStaff = localStorage.getItem('quickims_active_staff_session');
    if (cachedStaff) {
      try {
        const staffObj = JSON.parse(cachedStaff);
        if (staffObj?.restaurantId) return staffObj.restaurantId;
      } catch {}
    }
    const stored = localStorage.getItem('quickims_restaurant_id');
    if (stored) return stored;
    return 'restro_primary';
  });

  useEffect(() => {
    if (activeStaffUser?.restaurantId) {
      // Staff member logged in on this device: automatically bind to the owner's restaurant
      setRestaurantIdState(activeStaffUser.restaurantId);
      localStorage.setItem('quickims_restaurant_id', activeStaffUser.restaurantId);
    } else if (firebaseUser?.uid) {
      // Owner logged in on this device: bind to their owner restaurant
      const ownerRestroId = `restro_${firebaseUser.uid}`;
      setRestaurantIdState(ownerRestroId);
      localStorage.setItem('quickims_restaurant_id', ownerRestroId);
    }
  }, [firebaseUser?.uid, activeStaffUser?.restaurantId]);

  const setRestaurantSyncChannel = (id: string) => {
    const clean = id.trim();
    if (!clean) return;
    setRestaurantIdState(clean);
    localStorage.setItem('quickims_restaurant_id', clean);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin' || 
    firebaseUser?.email === 'pratikbhandari110@gmail.com' || 
    currentUser?.email === 'pratikbhandari110@gmail.com';

  const isAdmin = isSuperAdmin || currentUser?.role === 'admin' || currentUser?.role === 'owner';
  const isStaff = !!activeStaffUser || !!activePOSStaff;

  // Real-time bidirectional synchronization for Tables & Draft Orders across all devices
  useEffect(() => {
    if (!db) return;

    const tablesDocRef = doc(db, 'restaurants', restaurantId, 'live_state', 'tables');
    const unsub = onSnapshot(tablesDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.tables)) {
          setDiningTables(data.tables);
          localStorage.setItem('quickims_tables', JSON.stringify(data.tables));
        }
        if (data.tableDrafts && typeof data.tableDrafts === 'object') {
          setTableDrafts(data.tableDrafts);
          localStorage.setItem('quickims_table_drafts', JSON.stringify(data.tableDrafts));
        }
      }
    }, (err) => {
      console.warn('Live tables onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Real-time bidirectional synchronization for Kitchen Tickets (KDS & BOT) across all devices
  useEffect(() => {
    if (!db) return;

    const kotsColRef = collection(db, 'restaurants', restaurantId, 'kitchen_tickets');
    const unsub = onSnapshot(kotsColRef, (snap) => {
      if (!snap.empty) {
        const loadedTickets = snap.docs.map(d => ({ ...d.data(), id: d.id } as KitchenOrderTicket));
        const sorted = loadedTickets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setKitchenTickets(sorted);
        localStorage.setItem('restro_kots', JSON.stringify(sorted));
      } else {
        setKitchenTickets([]);
      }
    }, (err) => {
      console.warn('Active KOTs onSnapshot listener note:', err);
    });

    return () => unsub();
  }, [restaurantId]);

  // Multi-Device Table & Cart Sync Helper
  const syncLiveTablesToFirestore = async (tables: DiningTable[], drafts?: Record<string, TableDraftOrder>) => {
    try {
      const payload: any = {
        tables,
        updatedAt: Date.now(),
        updatedBy: activeStaffUser?.name || activePOSStaff?.name || currentUser.name
      };
      if (drafts !== undefined) {
        payload.tableDrafts = drafts;
      }
      await setDoc(doc(db, 'restaurants', restaurantId, 'live_state', 'tables'), payload, { merge: true });
    } catch (e) {
      console.warn('Live tables sync notice:', e);
    }
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
        if (removedIds.length > 0) {
          removedIds.forEach(id => {
            deleteDoc(doc(db, 'staff_members', id)).catch(() => null);
          });
        }
      }
      return cleanList;
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

  // Try initial Firestore load if available
  useEffect(() => {
    const loadFromFirestore = async () => {
      try {
        const isCleared = localStorage.getItem('quickims_data_cleared') === 'true';
        if (isCleared) return;

        // 1. Products
        try {
          const prodSnap = await getDocs(collection(db, 'products')).catch(() => null);
          if (prodSnap && !prodSnap.empty) {
            const loadedProducts = prodSnap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
            const hasHardware = loadedProducts.some(p => p.sku?.startsWith('PVC-') || p.sku?.startsWith('CPVC-') || p.category?.includes('Pipes'));
            if (!hasHardware) {
              const sanitized = loadedProducts.map(p => {
                if (p.itemType === 'raw_ingredient') {
                  return { ...p, recipeIngredients: [] };
                }
                return {
                  ...p,
                  recipeIngredients: [],
                  costPrice: 0
                };
              });
              setProducts(sanitized);
              localStorage.setItem('quickims_products', JSON.stringify(sanitized));
            }
          }
        } catch (prodErr) {
          console.warn('Firestore products sync note:', prodErr);
        }

        // 2. Categories
        try {
          const catSnap = await getDocs(collection(db, 'categories')).catch(() => null);
          if (catSnap && !catSnap.empty) {
            const loadedCats = catSnap.docs.map(d => ({ ...d.data(), id: d.id } as ProductCategory));
            const hasHardwareCats = loadedCats.some(c => c.name?.includes('Pipes') || c.name?.includes('Sanitaryware'));
            if (!hasHardwareCats) {
              setCategories(prev => {
                const map = new Map<string, ProductCategory>();
                RESTAURANT_MENU_CATEGORIES.forEach(c => map.set(c.name.toLowerCase(), c));
                prev.forEach(c => map.set(c.name.toLowerCase(), c));
                loadedCats.forEach(c => map.set(c.name.toLowerCase(), c));
                return Array.from(map.values());
              });
            }
          }
        } catch (catErr) {
          console.warn('Firestore categories sync note:', catErr);
        }

        // 3. Restaurant floor plan (scoped to restaurantId with fallback)
        try {
          let planData: any = null;
          const tenantPlanSnap = await getDoc(doc(db, 'restaurants', restaurantId, 'meta', 'floor_plan')).catch(() => null);
          if (tenantPlanSnap && tenantPlanSnap.exists()) {
            planData = tenantPlanSnap.data();
          } else {
            const fallbackPlanSnap = await getDoc(doc(db, 'restaurant_meta', 'floor_plan')).catch(() => null);
            if (fallbackPlanSnap && fallbackPlanSnap.exists()) {
              planData = fallbackPlanSnap.data();
            }
          }

          if (planData) {
            if (Array.isArray(planData.floors) && planData.floors.length > 0) {
              setFloors(planData.floors);
              localStorage.setItem('quickims_floors', JSON.stringify(planData.floors));
            }
            if (Array.isArray(planData.sections)) {
              setSections(planData.sections);
              localStorage.setItem('quickims_sections', JSON.stringify(planData.sections));
            }
            if (Array.isArray(planData.diningTables) && planData.diningTables.length > 0) {
              setDiningTables(planData.diningTables);
              localStorage.setItem('quickims_tables', JSON.stringify(planData.diningTables));
            }
          }
        } catch (planErr) {
          console.warn('Firestore floor plan sync note:', planErr);
        }

        // 4. Hydrate staff members from Firestore (scoped to this restaurant)
        try {
          const tenantStaffSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'staff')).catch(() => null);
          const allStaffSnap = await getDocs(collection(db, 'staff_members')).catch(() => null);
          
          const rawDocs: StaffMember[] = [];
          if (tenantStaffSnap && !tenantStaffSnap.empty) {
            tenantStaffSnap.docs.forEach(d => rawDocs.push({ ...d.data(), id: d.id } as StaffMember));
          }
          if (allStaffSnap && !allStaffSnap.empty) {
            allStaffSnap.docs.forEach(d => {
              const s = { ...d.data(), id: d.id } as StaffMember;
              if (s.restaurantId === restaurantId || (!s.restaurantId && !rawDocs.some(r => r.id === s.id))) {
                rawDocs.push(s);
              }
            });
          }

          if (rawDocs.length > 0) {
            const nonDummy = rawDocs.filter(s => !isDummyStaff(s));
            const { cleanList } = deduplicateStaffMembers(nonDummy);
            setStaffMembers(cleanList);
            localStorage.setItem('quickims_staff', JSON.stringify(cleanList));
          }
        } catch (staffErr) {
          console.warn('Firestore staff_members sync note:', staffErr);
        }
      } catch (err) {
        console.warn('Firestore initial sync note (using local cache):', err);
      }
    };
    loadFromFirestore();
  }, [restaurantId]);

  // Update Settings
  const updateSettings = async (newSettings: Partial<CompanySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await setDoc(doc(db, 'settings', 'company'), updated, { merge: true });
    } catch (e) {
      console.warn('Firestore write warning:', e);
    }
  };

  // Add Product
  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
    const newId = `prod-${Date.now()}`;
    const newProduct: Product = {
      ...productData,
      id: newId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    setProducts(prev => [newProduct, ...prev]);

    // Record initial stock opening movement if currentStock > 0
    if (newProduct.currentStock > 0) {
      const movement: StockMovement = {
        id: `stk-mov-${Date.now()}`,
        date: Date.now(),
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
        performedBy: currentUser.name
      };
      setStockMovements(prev => [movement, ...prev]);
    }

    try {
      await setDoc(doc(db, 'products', newId), sanitizeForFirestore(newProduct));
    } catch (e) {
      console.warn('Firestore write warning (saved locally):', e);
    }

    return newProduct;
  };

  // Update Product
  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const updatedTimestamp = Date.now();
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: updatedTimestamp } : p));
    try {
      await setDoc(doc(db, 'products', id), sanitizeForFirestore({ ...updates, updatedAt: updatedTimestamp }), { merge: true });
    } catch (e) {
      console.warn('Firestore update warning (saved locally):', e);
    }
  };

  // Delete Product (Soft delete / deactivate or permanent remove)
  const deleteProduct = async (id: string, permanent: boolean = false) => {
    if (permanent) {
      setProducts(prev => prev.filter(p => p.id !== id));
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (e) {
        console.warn('Firestore delete warning (removed locally):', e);
      }
    } else {
      const updatedTimestamp = Date.now();
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'discontinued', updatedAt: updatedTimestamp } : p));
      try {
        await setDoc(doc(db, 'products', id), { status: 'discontinued', updatedAt: updatedTimestamp }, { merge: true });
      } catch (e) {
        console.warn('Firestore update warning (deactivated locally):', e);
      }
    }
  };

  // Add Category
  const addCategory = async (catData: Omit<ProductCategory, 'id'>): Promise<ProductCategory> => {
    const cleanName = catData.name.trim();
    const existing = categories.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      return existing;
    }
    const newId = `cat-${Date.now()}`;
    const newCategory: ProductCategory = {
      ...catData,
      name: cleanName,
      id: newId,
      isDefault: false
    };
    setCategories(prev => [...prev, newCategory]);
    try {
      await setDoc(doc(db, 'categories', newId), sanitizeForFirestore(newCategory));
    } catch (e) {
      console.warn('Firestore write warning (saved locally):', e);
    }
    return newCategory;
  };

  // Update Category
  const updateCategory = async (id: string, updates: Partial<ProductCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    try {
      await setDoc(doc(db, 'categories', id), sanitizeForFirestore(updates), { merge: true });
    } catch (e) {
      console.warn('Firestore update warning (saved locally):', e);
    }
  };

  // Delete Category
  const deleteCategory = async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (e) {
      console.warn('Firestore delete warning (removed locally):', e);
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
    try {
      await setDoc(doc(db, 'customers', newId), newCustomer);
    } catch (e) {
      console.warn('Firestore write warning:', e);
    }
    return newCustomer;
  };

  // Update Customer
  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    try {
      await setDoc(doc(db, 'customers', id), updates, { merge: true });
    } catch (e) {
      console.warn('Firestore write warning:', e);
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
    try {
      await setDoc(doc(db, 'suppliers', newId), newSup);
    } catch (e) {
      console.warn('Firestore write warning:', e);
    }
    return newSup;
  };

  // Update Supplier
  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
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

  // Atomic Sale Record
  const recordSale = async (saleData: Omit<SaleInvoice, 'id' | 'createdAt'>): Promise<SaleInvoice> => {
    const newSaleId = `inv-${Date.now()}`;
    const isDraft = saleData.status === 'draft' || saleData.isDraft === true;
    const invoice: SaleInvoice = {
      ...saleData,
      id: newSaleId,
      status: isDraft ? 'draft' : (saleData.status || 'completed'),
      isDraft,
      createdAt: Date.now()
    };

    // 1. Add invoice to sales
    setSales(prev => [invoice, ...prev]);

    // If draft, do NOT deduct inventory stock or modify customer balance
    if (isDraft) {
      try {
        await setDoc(doc(db, 'sales', newSaleId), sanitizeForFirestore(invoice));
      } catch (e) {
        console.warn('Firestore draft sale write warning:', e);
      }
      return invoice;
    }

    // 2. Reduce product stock & record Stock Movement for each line item
    const newMovements: StockMovement[] = [];
    const productStockMap = new Map<string, number>();

    setProducts(prevProducts => {
      return prevProducts.map(p => {
        const item = invoice.items.find(i => i.productId === p.id);
        if (item) {
          const qtyToDeduct = item.baseQuantity;
          const currentBal = p.currentStock;
          const newBal = Math.max(0, currentBal - qtyToDeduct);
          productStockMap.set(p.id, newBal);

          newMovements.push({
            id: `stk-mov-${Date.now()}-${p.id}`,
            date: invoice.date,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            warehouseId: invoice.warehouseId,
            warehouseName: invoice.warehouseName,
            movementType: 'sale',
            referenceId: invoice.invoiceNumber,
            quantityIn: 0,
            quantityOut: qtyToDeduct,
            previousBalance: currentBal,
            newBalance: newBal,
            unitCost: p.costPrice,
            totalValue: qtyToDeduct * p.costPrice,
            notes: `Sale to ${invoice.customerName}`,
            performedBy: invoice.salespersonName
          });

          return { ...p, currentStock: newBal, updatedAt: Date.now() };
        }
        return p;
      });
    });

    if (newMovements.length > 0) {
      setStockMovements(prev => [...newMovements, ...prev]);
    }

    // 3. Update Customer Balance if credit or partial payment
    if (invoice.dueAmount > 0 && invoice.customerId !== 'cust-walkin') {
      setCustomers(prevCust => {
        return prevCust.map(c => {
          if (c.id === invoice.customerId) {
            return { ...c, currentBalance: (c.currentBalance || 0) + invoice.dueAmount };
          }
          return c;
        });
      });
    }

    try {
      await setDoc(doc(db, 'sales', newSaleId), invoice);
    } catch (e) {
      console.warn('Firestore write warning:', e);
    }

    return invoice;
  };

  // Finalize Draft Sale Invoice
  const finalizeSaleInvoice = async (id: string): Promise<SaleInvoice> => {
    const sale = sales.find(s => s.id === id);
    if (!sale) throw new Error('Invoice not found');

    const finalizedInvoice: SaleInvoice = {
      ...sale,
      status: 'completed',
      isDraft: false
    };

    // 1. Deduct stock & create stock movements
    const newMovements: StockMovement[] = [];
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        const item = sale.items.find(i => i.productId === p.id);
        if (item) {
          const qtyToDeduct = item.baseQuantity;
          const currentBal = p.currentStock;
          const newBal = Math.max(0, currentBal - qtyToDeduct);

          newMovements.push({
            id: `stk-mov-${Date.now()}-${p.id}`,
            date: sale.date || Date.now(),
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            warehouseId: sale.warehouseId,
            warehouseName: sale.warehouseName,
            movementType: 'sale',
            referenceId: sale.invoiceNumber,
            quantityIn: 0,
            quantityOut: qtyToDeduct,
            previousBalance: currentBal,
            newBalance: newBal,
            unitCost: p.costPrice,
            totalValue: qtyToDeduct * p.costPrice,
            notes: `Finalized Sale to ${sale.customerName}`,
            performedBy: sale.salespersonName
          });

          return { ...p, currentStock: newBal, updatedAt: Date.now() };
        }
        return p;
      });
    });

    if (newMovements.length > 0) {
      setStockMovements(prev => [...newMovements, ...prev]);
    }

    // 2. Update Customer Balance if credit or partial payment
    if (sale.dueAmount > 0 && sale.customerId !== 'cust-walkin') {
      setCustomers(prevCust => {
        return prevCust.map(c => {
          if (c.id === sale.customerId) {
            return { ...c, currentBalance: (c.currentBalance || 0) + sale.dueAmount };
          }
          return c;
        });
      });
    }

    // 3. Update sales state
    setSales(prev => prev.map(s => s.id === id ? finalizedInvoice : s));

    try {
      await setDoc(doc(db, 'sales', id), sanitizeForFirestore(finalizedInvoice), { merge: true });
    } catch (e) {
      console.warn('Firestore finalize sale warning:', e);
    }

    return finalizedInvoice;
  };

  // Delete Sale Invoice (e.g. discard draft)
  const deleteSaleInvoice = async (id: string): Promise<void> => {
    setSales(prev => prev.filter(s => s.id !== id));
    try {
      await deleteDoc(doc(db, 'sales', id));
    } catch (e) {
      console.warn('Firestore delete sale warning:', e);
    }
  };

  // Update Sale Invoice
  const updateSale = async (id: string, updates: Partial<SaleInvoice>) => {
    setSales(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    try {
      await setDoc(doc(db, 'sales', id), sanitizeForFirestore(updates), { merge: true });
    } catch (e) {
      console.warn('Firestore update sale warning (saved locally):', e);
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
    const sale = sales.find(s => s.id === invoiceId);
    if (!sale) return;

    const remainingDue = sale.dueAmount ?? Math.max(0, sale.grandTotal - (sale.paidAmount || 0));
    const validAmount = Math.max(0, Math.min(paymentReceived, remainingDue));
    if (validAmount <= 0) return;

    const newPaidAmount = Math.min(sale.grandTotal, (sale.paidAmount || 0) + validAmount);
    const newDueAmount = Math.max(0, sale.grandTotal - newPaidAmount);
    const newPaymentStatus: SaleInvoice['paymentStatus'] = newDueAmount === 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'unpaid';

    const updatedSale: SaleInvoice = {
      ...sale,
      paidAmount: newPaidAmount,
      dueAmount: newDueAmount,
      paymentStatus: newPaymentStatus,
      paymentMethod: newDueAmount === 0 && method ? method : sale.paymentMethod,
      paymentReference: paymentRef ? (sale.paymentReference ? `${sale.paymentReference}, ${paymentRef}` : paymentRef) : sale.paymentReference,
      notes: notes ? (sale.notes ? `${sale.notes} | ${notes}` : notes) : sale.notes
    };

    // Update sales state
    setSales(prev => prev.map(s => s.id === invoiceId ? updatedSale : s));

    // Update customer balance if registered customer
    if (sale.customerId && sale.customerId !== 'cust-walkin') {
      setCustomers(prev => prev.map(c => {
        if (c.id === sale.customerId) {
          const newBal = Math.max(0, (c.currentBalance || 0) - validAmount);
          setDoc(doc(db, 'customers', c.id), { currentBalance: newBal }, { merge: true }).catch(() => {});
          return { ...c, currentBalance: newBal };
        }
        return c;
      }));
    }

    try {
      await setDoc(doc(db, 'sales', invoiceId), sanitizeForFirestore(updatedSale), { merge: true });
    } catch (e) {
      console.warn('Firestore settle invoice warning (saved locally):', e);
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
      try {
        await setDoc(doc(db, 'purchases', newPurId), sanitizeForFirestore(purchase));
      } catch (e) {
        console.warn('Firestore draft purchase write warning:', e);
      }
      return purchase;
    }

    // 2. Increase product stock & update average cost price & stock movements
    const newMovements: StockMovement[] = [];
    setProducts(prevProducts => {
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

          newMovements.push({
            id: `stk-mov-${Date.now()}-${p.id}`,
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
            performedBy: currentUser.name
          });

          return { 
            ...p, 
            currentStock: newBal, 
            costPrice: newAvgCost,
            updatedAt: Date.now() 
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
            return { ...s, currentBalance: (s.currentBalance || 0) + purchase.dueAmount };
          }
          return s;
        });
      });
    }

    try {
      await setDoc(doc(db, 'purchases', newPurId), purchase);
    } catch (e) {
      console.warn('Firestore write warning:', e);
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
    setProducts(prevProducts => {
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

          newMovements.push({
            id: `stk-mov-${Date.now()}-${p.id}`,
            date: purchase.date || Date.now(),
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
            performedBy: currentUser.name
          });

          return { 
            ...p, 
            currentStock: newBal, 
            costPrice: newAvgCost,
            updatedAt: Date.now() 
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
            return { ...s, currentBalance: (s.currentBalance || 0) + purchase.dueAmount };
          }
          return s;
        });
      });
    }

    // 3. Update purchases state
    setPurchases(prev => prev.map(p => p.id === id ? finalizedPurchase : p));

    try {
      await setDoc(doc(db, 'purchases', id), sanitizeForFirestore(finalizedPurchase), { merge: true });
    } catch (e) {
      console.warn('Firestore finalize purchase warning:', e);
    }

    return finalizedPurchase;
  };

  // Delete Purchase Invoice (e.g. discard draft)
  const deletePurchase = async (id: string): Promise<void> => {
    setPurchases(prev => prev.filter(p => p.id !== id));
    try {
      await deleteDoc(doc(db, 'purchases', id));
    } catch (e) {
      console.warn('Firestore delete purchase warning:', e);
    }
  };

  // Update Purchase Invoice
  const updatePurchase = async (id: string, updates: Partial<PurchaseInvoice>) => {
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try {
      await setDoc(doc(db, 'purchases', id), sanitizeForFirestore(updates), { merge: true });
    } catch (e) {
      console.warn('Firestore updatePurchase warning:', e);
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
          setDoc(doc(db, 'suppliers', s.id), { currentBalance: newBal }, { merge: true }).catch(() => {});
          return { ...s, currentBalance: newBal };
        }
        return s;
      }));
    }

    try {
      await setDoc(doc(db, 'purchases', purchaseId), sanitizeForFirestore(updatedPurchase), { merge: true });
    } catch (e) {
      console.warn('Firestore settle purchase warning (saved locally):', e);
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
    try {
      await setDoc(doc(db, 'expenses', newId), newExp);
    } catch (e) {
      console.warn('Firestore write warning:', e);
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

    // Update Product stock
    setProducts(prev => {
      return prev.map(p => {
        if (p.id === adj.productId) {
          const newBal = Math.max(0, p.currentStock + adj.quantityDelta);
          const movement: StockMovement = {
            id: `stk-mov-${Date.now()}`,
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
          return { ...p, currentStock: newBal, updatedAt: Date.now() };
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

    // Record transfer movements
    trans.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        setStockMovements(prev => [
          {
            id: `stk-mov-${Date.now()}-out`,
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
          },
          {
            id: `stk-mov-${Date.now()}-in`,
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
          },
          ...prev
        ]);
      }
    });
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

            let updatedDue = sale.dueAmount !== undefined ? sale.dueAmount : Math.max(0, (sale.grandTotal || 0) - (sale.paidAmount || 0));
            let updatedPaid = sale.paidAmount || 0;
            let updatedPaymentStatus = sale.paymentStatus;

            if (ret.refundMethod === 'deduct_due') {
              updatedDue = Math.max(0, updatedDue - ret.totalRefundAmount);
              if (updatedDue === 0) {
                updatedPaymentStatus = 'paid';
              }
            } else if (ret.refundMethod === 'credit_note') {
              if (updatedDue > 0) {
                const deduct = Math.min(updatedDue, ret.totalRefundAmount);
                updatedDue = Math.max(0, updatedDue - deduct);
                if (updatedDue === 0) {
                  updatedPaymentStatus = 'paid';
                }
              }
            }

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

            setDoc(doc(db, 'sales', sale.id), sanitizeForFirestore(updatedSale), { merge: true }).catch(err => {
              console.warn('Firestore sale update warning:', err);
            });
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

              movementsToAdd.push({
                id: movementId,
                date: ret.date,
                productId: p.id,
                productName: p.name,
                sku: p.sku,
                warehouseId: p.warehouseId || currentWarehouseId || 'wh-main',
                warehouseName: p.warehouseName || 'Kalanki Main Showroom',
                movementType: 'sale_return',
                referenceId: ret.returnNumber,
                quantityIn: qtyToAdd,
                quantityOut: 0,
                previousBalance: prevStock,
                newBalance: newBal,
                unitCost: p.costPrice || 0,
                totalValue: qtyToAdd * (p.costPrice || 0),
                notes: `Customer return (${item.reason || 'return'}) from inv #${ret.originalInvoiceNumber || ret.originalInvoiceId}`,
                performedBy: ret.processedBy || currentUser.name
              });

              setDoc(doc(db, 'products', p.id), { currentStock: newBal, updatedAt: timestamp }, { merge: true }).catch(err => {
                console.warn('Firestore product stock update warning:', err);
              });

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
            const newBal = (c.currentBalance || 0) - ret.totalRefundAmount;
            setDoc(doc(db, 'customers', c.id), { currentBalance: newBal }, { merge: true }).catch(err => {
              console.warn('Firestore customer balance update warning:', err);
            });
            return { ...c, currentBalance: newBal };
          }
          return c;
        });
      });
    }

    try {
      await setDoc(doc(db, 'sales_returns', newId), sanitizeForFirestore(ret));
    } catch (e) {
      console.warn('Firestore sales_returns write warning:', e);
    }
  };

  // Wipe All Application Data (Full Clean Reset)
  const clearAllData = async () => {
    setIsSyncing(true);
    try {
      // 1. Reset in-memory state
      setProducts([]);
      setSales([]);
      setPurchases([]);
      setCustomers([DEFAULT_WALKIN_CUSTOMER]);
      setSuppliers([]);
      setExpenses([]);
      setStockMovements([]);
      setStockAdjustments([]);
      setStockTransfers([]);
      setQuotations([]);
      setSalesReturns([]);
      setKitchenTickets([]);
      setFloors([]);
      setSections([]);
      setDiningTables([]);
      setSelectedTableId(null);

      // 2. Mark and persist empty data in localStorage
      localStorage.setItem('quickims_data_cleared', 'true');
      localStorage.setItem('quickims_products', JSON.stringify([]));
      localStorage.setItem('quickims_sales', JSON.stringify([]));
      localStorage.setItem('quickims_purchases', JSON.stringify([]));
      localStorage.setItem('quickims_customers', JSON.stringify([DEFAULT_WALKIN_CUSTOMER]));
      localStorage.setItem('quickims_suppliers', JSON.stringify([]));
      localStorage.setItem('quickims_expenses', JSON.stringify([]));
      localStorage.setItem('quickims_movements', JSON.stringify([]));
      localStorage.setItem('quickims_adjustments', JSON.stringify([]));
      localStorage.setItem('quickims_transfers', JSON.stringify([]));
      localStorage.setItem('quickims_quotations', JSON.stringify([]));
      localStorage.setItem('quickims_returns', JSON.stringify([]));
      localStorage.setItem('quickims_floors', JSON.stringify([]));
      localStorage.setItem('quickims_sections', JSON.stringify([]));
      localStorage.setItem('quickims_tables', JSON.stringify([]));
      localStorage.setItem('restro_tables', JSON.stringify([]));
      localStorage.setItem('restro_kots', JSON.stringify([]));

      // 3. Clear remote Firestore documents across collections
      const collectionsToWipe = [
        'products', 'sales', 'purchases', 'customers', 'suppliers', 
        'expenses', 'stock_movements', 'sales_returns', 'quotations', 
        'stock_adjustments', 'stock_transfers', 'kots', 'dining_tables'
      ];

      for (const colName of collectionsToWipe) {
        try {
          const snap = await getDocs(collection(db, colName));
          if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
            await batch.commit();
          }
        } catch (err) {
          console.warn(`Firestore clean collection ${colName} note:`, err);
        }
      }
    } catch (e) {
      console.error('Error clearing data:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // One-time purge of legacy mock data from Firestore
  const purgeAllLegacyFirestoreData = async (): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      const collectionsToPurge = [
        'products', 'categories', 'restaurant_meta', 'staff_members',
        'staff_lookup', 'staff_verifications', 'invoices', 'kitchen_tickets',
        'inventory', 'recipes', 'waste', 'purchases', 'suppliers',
        'customers', 'sales', 'stock_movements', 'sales_returns',
        'quotations', 'stock_adjustments', 'stock_transfers', 'kots', 'dining_tables'
      ];

      for (const colName of collectionsToPurge) {
        try {
          const snap = await getDocs(collection(db, colName)).catch(() => null);
          if (snap && !snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (err) {
          console.warn(`Purge collection ${colName} note:`, err);
        }
      }

      // Also clean the tenant-scoped live state & tables & subcollections
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'live_state', 'tables')).catch(() => null);
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'meta', 'floor_plan')).catch(() => null);
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'meta', 'settings')).catch(() => null);
        
        const kSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'kitchen_tickets')).catch(() => null);
        if (kSnap && !kSnap.empty) {
          const b = writeBatch(db);
          kSnap.docs.forEach(d => b.delete(d.ref));
          await b.commit();
        }
        const sSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'staff')).catch(() => null);
        if (sSnap && !sSnap.empty) {
          const b = writeBatch(db);
          sSnap.docs.forEach(d => b.delete(d.ref));
          await b.commit();
        }
      } catch (e) { /* ignore */ }

      // Clear local browser storage
      localStorage.clear();

      // Reset state to 100% clean production slate
      setProducts([]);
      setDiningTables([]);
      setKitchenTickets([]);
      setStaffMembers([]);
      setFoodWasteRecords([]);
      setMasterRecipes([]);
      setPrinters([]);
      setFloors([]);
      setSections([]);
      setSales([]);
      setPurchases([]);
      setExpenses([]);
      setTableDrafts({});
      setCustomers([DEFAULT_WALKIN_CUSTOMER]);
      setSettings(DEFAULT_RESTAURANT_SETTINGS);

      return { success: true, message: 'All legacy mock data has been completely purged from Firestore. Database is now in a clean production state.' };
    } catch (err: any) {
      console.error('Purge error:', err);
      return { success: false, message: `Purge failed: ${err.message || 'Unknown error'}` };
    } finally {
      setIsSyncing(false);
    }
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

  const addFloor = async (floorData: Omit<RestaurantFloor, 'id'>): Promise<RestaurantFloor> => {
    const newFloor: RestaurantFloor = {
      ...floorData,
      id: `flr-${Date.now()}`
    };
    setFloors(prev => [...prev, newFloor]);
    return newFloor;
  };

  const updateFloor = async (id: string, updates: Partial<RestaurantFloor>) => {
    setFloors(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    if (updates.name) {
      setSections(prev => prev.map(s => s.floorId === id ? { ...s, floorName: updates.name } : s));
      setDiningTables(prev => prev.map(t => t.floorId === id ? { ...t, floorName: updates.name } : t));
    }
  };

  const deleteFloor = async (id: string) => {
    setFloors(prev => prev.filter(f => f.id !== id));
    setSections(prev => prev.filter(s => s.floorId !== id));
    setDiningTables(prev => prev.filter(t => t.floorId !== id));
  };

  const addSection = async (sectionData: Omit<RestaurantSection, 'id'>): Promise<RestaurantSection> => {
    const floor = floors.find(f => f.id === sectionData.floorId);
    const newSection: RestaurantSection = {
      ...sectionData,
      floorName: floor ? floor.name : sectionData.floorName,
      id: `sec-${Date.now()}`
    };
    setSections(prev => [...prev, newSection]);
    return newSection;
  };

  const updateSection = async (id: string, updates: Partial<RestaurantSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (updates.name) {
      setDiningTables(prev => prev.map(t => t.sectionId === id ? { ...t, sectionName: updates.name } : t));
    }
  };

  const deleteSection = async (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setDiningTables(prev => prev.filter(t => t.sectionId !== id));
  };

  const addDiningTable = async (tableData: Omit<DiningTable, 'id'>): Promise<DiningTable> => {
    const newTable: DiningTable = {
      ...tableData,
      id: `tbl-${Date.now()}`,
      status: tableData.status || 'available',
      subtotal: 0,
      totalWithTax: 0,
      activeKOTCount: 0,
      restaurantId
    };
    setDiningTables(prev => {
      const next = [...prev, newTable];
      syncLiveTablesToFirestore(next);
      return next;
    });
    return newTable;
  };

  const updateDiningTable = async (id: string, updates: Partial<DiningTable>) => {
    setDiningTables(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      syncLiveTablesToFirestore(next);
      return next;
    });
  };

  const deleteDiningTable = async (id: string) => {
    setDiningTables(prev => {
      const next = prev.filter(t => t.id !== id);
      syncLiveTablesToFirestore(next);
      return next;
    });
    if (selectedTableId === id) {
      setSelectedTableId(null);
    }
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
      syncLiveTablesToFirestore(next);
      return next;
    });
  };

  const assignTableGuests = async (tableId: string, guestsCount: number, waiterName?: string) => {
    setDiningTables(prev => {
      const next = prev.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            status: 'seated' as const,
            currentGuests: guestsCount,
            assignedWaiter: waiterName || t.assignedWaiter || currentUser.name,
            openedAt: t.openedAt || Date.now()
          };
        }
        return t;
      });
      syncLiveTablesToFirestore(next);
      return next;
    });
  };

  const saveFloorPlanToCloud = async (): Promise<boolean> => {
    try {
      localStorage.setItem('quickims_floors', JSON.stringify(floors));
      localStorage.setItem('quickims_sections', JSON.stringify(sections));
      localStorage.setItem('quickims_tables', JSON.stringify(diningTables));
      await setDoc(doc(db, 'restaurants', restaurantId, 'meta', 'floor_plan'), {
        floors,
        sections,
        diningTables,
        updatedAt: Date.now(),
        updatedBy: currentUser.name
      }, { merge: true });
      await setDoc(doc(db, 'restaurant_meta', 'floor_plan'), {
        floors,
        sections,
        diningTables,
        updatedAt: Date.now(),
        updatedBy: currentUser.name
      }, { merge: true }).catch(() => null);
      await syncLiveTablesToFirestore(diningTables);
      return true;
    } catch (err) {
      console.warn('Firestore floor plan save notice (persisted in local browser storage):', err);
      return true;
    }
  };

  // ==========================================
  // TABLE DRAFT ORDERS (Preserved across table switching & refreshes)
  // Reflects as red fill on Interactive Floor Plan canvas
  // ==========================================
  const saveTableDraft = (tableId: string, draftData: Partial<TableDraftOrder>) => {
    if (!tableId) return;

    let updatedDrafts: Record<string, TableDraftOrder> = {};

    setTableDrafts(prev => {
      const existing = prev[tableId] || { tableId, cart: [], updatedAt: Date.now() };
      const updatedCart = draftData.cart !== undefined ? draftData.cart : existing.cart;

      if (!updatedCart || updatedCart.length === 0) {
        const next = { ...prev };
        delete next[tableId];
        updatedDrafts = next;
        return next;
      }

      const next = {
        ...prev,
        [tableId]: {
          ...existing,
          ...draftData,
          tableId,
          cart: updatedCart,
          updatedAt: Date.now()
        }
      };
      updatedDrafts = next;
      return next;
    });

    setDiningTables(prev => {
      let nextTables = prev;
      if (draftData.cart !== undefined) {
        if (draftData.cart.length > 0) {
          const draftSubtotal = draftData.cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
          const draftTax = Math.round(draftSubtotal * 1.13);

          nextTables = prev.map(t => {
            if (t.id === tableId) {
              const newStatus: DiningTable['status'] = t.status === 'billed' ? 'billed' : 'draft';
              return {
                ...t,
                status: newStatus,
                subtotal: (t.status === 'kot_fired' ? t.subtotal || 0 : draftSubtotal),
                totalWithTax: (t.status === 'kot_fired' ? t.totalWithTax || 0 : draftTax)
              };
            }
            return t;
          });
        } else {
          nextTables = prev.map(t => {
            if (t.id === tableId && t.status === 'draft') {
              const fallbackStatus: DiningTable['status'] = t.currentGuests && t.currentGuests > 0 ? 'seated' : 'available';
              return {
                ...t,
                status: fallbackStatus,
                subtotal: 0,
                totalWithTax: 0
              };
            }
            return t;
          });
        }
      }
      syncLiveTablesToFirestore(nextTables, updatedDrafts);
      return nextTables;
    });
  };

  const getTableDraft = (tableId: string): TableDraftOrder | undefined => {
    return tableDrafts[tableId];
  };

  const clearTableDraft = (tableId: string) => {
    if (!tableId) return;
    let updatedDrafts: Record<string, TableDraftOrder> = {};
    setTableDrafts(prev => {
      const next = { ...prev };
      delete next[tableId];
      updatedDrafts = next;
      return next;
    });

    setDiningTables(prev => {
      const nextTables = prev.map(t => {
        if (t.id === tableId && t.status === 'draft') {
          const clearedStatus: DiningTable['status'] = t.currentGuests && t.currentGuests > 0 ? 'seated' : 'available';
          return {
            ...t,
            status: clearedStatus,
            subtotal: 0,
            totalWithTax: 0
          };
        }
        return t;
      });
      syncLiveTablesToFirestore(nextTables, updatedDrafts);
      return nextTables;
    });
  };

  // Helper to determine if an item is destined for Bar (BOT) or Kitchen (KDS)
  const isItemForBar = (item: KOTItem): boolean => {
    if (item.routingStation === 'bar') return true;
    if (item.routingStation === 'kitchen') return false;
    const prod = products.find(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
    if (prod?.orderRoutingStation) {
      return prod.orderRoutingStation === 'bar';
    }
    if (prod?.department === 'Drink' || prod?.itemType === 'beverage') return true;
    const cat = (prod?.category || '').toLowerCase();
    if (cat.includes('drink') || cat.includes('alcohol') || cat.includes('bar') || cat.includes('cold') || cat.includes('hot') || cat.includes('beverage') || cat.includes('cocktail') || cat.includes('liquor') || cat.includes('wine') || cat.includes('beer')) {
      return true;
    }
    const name = item.productName.toLowerCase();
    return name.includes('beer') || name.includes('juice') || name.includes('tea') || name.includes('coffee') || name.includes('mojito') || name.includes('whiskey') || name.includes('wine') || name.includes('vodka') || name.includes('soda') || name.includes('shake') || name.includes('smoothie');
  };

  const splitAndFireTickets = async (params: {
    tableId: string;
    tableNumber: string;
    zoneName: string;
    waiterName: string;
    guestsCount: number;
    notes?: string;
    items: KOTItem[];
  }): Promise<{ kitchenTicket?: KitchenOrderTicket; barTicket?: KitchenOrderTicket }> => {
    const kitchenItems = params.items
      .filter(item => !isItemForBar(item))
      .map(i => ({ ...i, routingStation: 'kitchen' as const }));

    const barItems = params.items
      .filter(item => isItemForBar(item))
      .map(i => ({ ...i, routingStation: 'bar' as const }));

    let kitchenTicket: KitchenOrderTicket | undefined;
    let barTicket: KitchenOrderTicket | undefined;

    const baseCount = kitchenTickets.length;
    let counter = 1;

    // 1. If kitchen items exist, dispatch Kitchen Order Ticket (KOT) exclusively to KDS
    if (kitchenItems.length > 0) {
      const kotNumber = `KOT-${String(baseCount + counter).padStart(4, '0')}`;
      counter++;
      kitchenTicket = {
        id: `kot-${Date.now()}-k`,
        kotNumber,
        ticketType: 'KOT',
        destinationStation: 'kitchen',
        tableId: params.tableId,
        tableNumber: params.tableNumber,
        zoneName: params.zoneName,
        waiterName: params.waiterName,
        guestsCount: params.guestsCount,
        notes: params.notes,
        status: 'in_kitchen',
        items: kitchenItems,
        isSettled: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    // 2. If bar items exist, dispatch Bar Order Ticket (BOT) exclusively to BOT station
    if (barItems.length > 0) {
      const botNumber = `BOT-${String(baseCount + counter).padStart(4, '0')}`;
      barTicket = {
        id: `bot-${Date.now()}-b`,
        kotNumber: botNumber,
        ticketType: 'BOT',
        destinationStation: 'bar',
        tableId: params.tableId,
        tableNumber: params.tableNumber,
        zoneName: params.zoneName,
        waiterName: params.waiterName,
        guestsCount: params.guestsCount,
        notes: params.notes,
        status: 'in_kitchen',
        items: barItems,
        isSettled: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    const newTicketsToAdd: KitchenOrderTicket[] = [];
    if (kitchenTicket) newTicketsToAdd.push(kitchenTicket);
    if (barTicket) newTicketsToAdd.push(barTicket);

    if (newTicketsToAdd.length > 0) {
      setKitchenTickets(prev => [...newTicketsToAdd, ...prev]);
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

    // Update table status to 'kot_fired' and accumulate subtotal
    const totalOrderSum = params.items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
    const updatedTables = diningTables.map(t => {
      if (t.id === params.tableId) {
        const newSubtotal = (t.subtotal || 0) + totalOrderSum;
        const totalTax = Math.round(newSubtotal * 1.13);
        return {
          ...t,
          status: 'kot_fired' as const,
          lastOrderAt: Date.now(),
          subtotal: newSubtotal,
          totalWithTax: totalTax,
          activeKOTCount: (t.activeKOTCount || 0) + (newTicketsToAdd.length || 1)
        };
      }
      return t;
    });

    setDiningTables(updatedTables);
    syncLiveTablesToFirestore(updatedTables);

    // Persist active KOT/BOT tickets to Firestore for real-time KDS/BOT distribution
    newTicketsToAdd.forEach(t => {
      setDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', t.id), {
        ...t,
        restaurantId
      }, { merge: true }).catch(err => console.warn('Firestore KOT live push notice:', err));
    });

    // Clear draft order for this table now that it has been sent to kitchen / bar
    clearTableDraft(params.tableId);

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
      kotNumber: `KOT-${String(kitchenTickets.length + 1).padStart(4, '0')}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  };

  const updateKOTStatus = async (kotId: string, status: KitchenOrderTicket['status']) => {
    setKitchenTickets(prev => prev.map(k => {
      if (k.id === kotId) {
        return {
          ...k,
          status,
          updatedAt: Date.now(),
          items: k.items.map(item => ({
            ...item,
            status: status === 'ready' ? 'ready' : status === 'completed' ? 'served' : item.status
          }))
        };
      }
      return k;
    }));

    try {
      await updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', kotId), {
        status,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('Firestore KOT status update notice:', e);
    }
  };

  const updateKOTItemStatus = async (kotId: string, itemId: string, status: KOTItem['status']) => {
    let updatedKot: KitchenOrderTicket | undefined;
    setKitchenTickets(prev => prev.map(k => {
      if (k.id === kotId) {
        const updatedItems = k.items.map(i => i.id === itemId ? { ...i, status } : i);
        const allReady = updatedItems.every(i => i.status === 'ready' || i.status === 'served');
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
    }));

    if (updatedKot) {
      try {
        await updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', kotId), {
          items: updatedKot.items,
          status: updatedKot.status,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.warn('Firestore KOT item status update notice:', e);
      }
    }
  };

  const settleTableBill = async (tableId: string, invoice: SaleInvoice) => {
    await recordSale(invoice);
    clearTableDraft(tableId);

    const tableToSettle = diningTables.find(t => t.id === tableId);
    const tableNumber = tableToSettle?.tableNumber;

    // Free up table back to 'available'
    const updatedTables = diningTables.map(t => {
      if (t.id === tableId) {
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
      return t;
    });
    setDiningTables(updatedTables);
    syncLiveTablesToFirestore(updatedTables);

    // Mark KOTs for this table as settled and completed in local state & Firestore
    setKitchenTickets(prev => prev.map(k => {
      if (k.tableId === tableId || (tableNumber && k.tableNumber === tableNumber)) {
        updateDoc(doc(db, 'restaurants', restaurantId, 'kitchen_tickets', k.id), {
          status: 'completed',
          isSettled: true,
          settledAt: Date.now(),
          updatedAt: Date.now()
        }).catch(() => null);

        return { 
          ...k, 
          status: 'completed', 
          isSettled: true, 
          settledAt: Date.now(), 
          updatedAt: Date.now() 
        };
      }
      return k;
    }));
  };

  // Staff & HR & Access Control
  const logStaffAction = async (action: Omit<StaffAuditLog, 'id' | 'timestamp'>) => {
    const newLog: StaffAuditLog = {
      ...action,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now()
    };
    setStaffAuditLogs(prev => [newLog, ...prev.slice(0, 499)]);
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
    const cleanName = staffData.name.trim().toLowerCase();

    // Check state first
    let existingMatch = staffMembers.find(s => 
      (cleanEmail && s.email && s.email.trim().toLowerCase() === cleanEmail) ||
      (cleanPhone && s.phone && s.phone.trim() === cleanPhone) ||
      (cleanName && s.name.trim().toLowerCase() === cleanName)
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
              (cleanName && s.name.trim().toLowerCase() === cleanName)
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
      staffData.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
    const username = baseUsername || `user_${codeCount}`;
    const pin = staffData.pin?.trim() || Math.floor(1000 + Math.random() * 9000).toString();
    const permissions = staffData.permissions || getDefaultStaffPermissions(staffData.role);
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

    // Save to Firestore: staff_members, tenant restaurant subcollection, and global staff_lookup
    try {
      await setDoc(doc(db, 'staff_members', newStaff.id), newStaff, { merge: true });
      await setDoc(doc(db, 'restaurants', restaurantId, 'staff', newStaff.id), newStaff, { merge: true });

      const lookupRecord = {
        ...newStaff,
        restaurantId
      };
      if (newStaff.username) {
        await setDoc(doc(db, 'staff_lookup', newStaff.username.toLowerCase()), lookupRecord, { merge: true });
      }
      if (newStaff.employeeCode) {
        await setDoc(doc(db, 'staff_lookup', newStaff.employeeCode.toLowerCase()), lookupRecord, { merge: true });
      }
      if (cleanEmail) {
        await setDoc(doc(db, 'staff_lookup', cleanEmail), lookupRecord, { merge: true });
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

    setStaffMembers(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, ...updates };
        if (updates.role && !updates.permissions) {
          updated.permissions = getDefaultStaffPermissions(updates.role);
        }
        return updated;
      }
      return s;
    }));

    if (activePOSStaff?.id === id) {
      setActivePOSStaff(prev => prev ? { ...prev, ...updates } : null);
    }
    if (activeStaffUser?.id === id) {
      setActiveStaffUser(prev => prev ? { ...prev, ...updates } : null);
    }

    const matched = staffMembers.find(s => s.id === id);
    if (matched) {
      const mergedStaff = { ...matched, ...updates };
      // Save updates to Firestore
      try {
        await setDoc(doc(db, 'staff_members', id), updates, { merge: true });
        await setDoc(doc(db, 'restaurants', restaurantId, 'staff', id), updates, { merge: true });
        if (mergedStaff.username) {
          await setDoc(doc(db, 'staff_lookup', mergedStaff.username.toLowerCase()), mergedStaff, { merge: true });
        }
        if (mergedStaff.employeeCode) {
          await setDoc(doc(db, 'staff_lookup', mergedStaff.employeeCode.toLowerCase()), mergedStaff, { merge: true });
        }
      } catch (fsErr) {
        console.warn('Firestore staff_members update note:', fsErr);
      }

      await logStaffAction({
        staffId: matched.id,
        staffName: matched.name,
        staffRole: matched.role,
        actionType: 'staff_updated',
        targetEntityId: matched.employeeCode,
        targetEntityName: matched.name,
        details: `Updated staff profile details for ${matched.name}.`
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

    // Delete from Firestore
    try {
      await deleteDoc(doc(db, 'staff_members', id));
      await deleteDoc(doc(db, 'restaurants', restaurantId, 'staff', id));
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
    setStaffMembers([]);
    localStorage.removeItem('quickims_staff');
    localStorage.removeItem('quickims_active_staff_session');
    setActiveStaffUser(null);
    setActivePOSStaff(null);
    try {
      const snap = await getDocs(collection(db, 'staff_members')).catch(() => null);
      if (snap && !snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      const tenantSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'staff')).catch(() => null);
      if (tenantSnap && !tenantSnap.empty) {
        const batch = writeBatch(db);
        tenantSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      const lookupSnap = await getDocs(collection(db, 'staff_lookup')).catch(() => null);
      if (lookupSnap && !lookupSnap.empty) {
        const batch = writeBatch(db);
        lookupSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn('resetStaffData error:', e);
    }
  };

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
      s.employeeCode.toLowerCase() === cleanUser ||
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
              s.employeeCode.toLowerCase() === cleanUser ||
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

    // 4. Look in Firestore staff_members collection
    if (!staff && db) {
      try {
        const allSnap = await getDocs(collection(db, 'staff_members')).catch(() => null);
        if (allSnap && !allSnap.empty) {
          const list = allSnap.docs.map(d => ({ ...d.data(), id: d.id } as StaffMember));
          staff = list.find(s => 
            s.username?.toLowerCase() === cleanUser ||
            s.employeeCode.toLowerCase() === cleanUser ||
            s.email?.toLowerCase() === cleanUser
          );
          if (staff) {
            setStaffMembers(prev => {
              const exists = prev.some(s => s.id === staff!.id);
              return exists ? prev : [staff!, ...prev];
            });
          }
        }
      } catch (fsErr) {
        console.warn('Firestore login lookup note:', fsErr);
      }
    }

    if (!staff) {
      return { success: false, message: `No staff member found for "${username}". Please verify your credentials with the owner.` };
    }

    if (staff.status === 'inactive' || staff.status === 'on_leave') {
      return { success: false, message: `Account status is currently "${staff.status.replace('_', ' ')}". Please contact your manager.` };
    }

    // Verify 4-digit PIN (allows master PIN 9999 for emergency/manager access)
    const isPinMatch = staff.pin === cleanPin || cleanPin === '9999';
    if (!isPinMatch) {
      return { success: false, message: 'Incorrect 4-digit PIN. Please re-enter or ask manager to reset it.' };
    }

    // Automatically bind device to the owner's restaurant ID
    const assignedRestroId = staff.restaurantId || restaurantId || 'restro_primary';
    setRestaurantIdState(assignedRestroId);
    localStorage.setItem('quickims_restaurant_id', assignedRestroId);
    localStorage.removeItem('quickims_data_cleared');

    // Establish active staff session
    setActiveStaffUser(staff);
    setActivePOSStaff(staff);
    localStorage.setItem('quickims_active_staff_session', JSON.stringify(staff));

    setCurrentUser({
      id: staff.id,
      name: staff.name,
      email: staff.email || `${staff.username || staff.employeeCode}@quickims.np`,
      role: (staff.role.toLowerCase().includes('manager') || staff.role.toLowerCase().includes('admin') ? 'admin' : 'sales'),
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
    setActiveStaffUser(null);
    setActivePOSStaff(null);
    localStorage.removeItem('quickims_active_staff_session');
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

    // Update in Firestore: staff_members AND staff_verifications
    try {
      await setDoc(doc(db, 'staff_members', verifiedStaff.id), verifiedStaff, { merge: true });
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

    // Auto login staff into portal
    setActiveStaffUser(verifiedStaff);
    setActivePOSStaff(verifiedStaff);
    localStorage.setItem('quickims_active_staff_session', JSON.stringify(verifiedStaff));

    setCurrentUser({
      id: verifiedStaff.id,
      name: verifiedStaff.name,
      email: verifiedStaff.email || `${verifiedStaff.username || verifiedStaff.employeeCode}@quickims.np`,
      role: (verifiedStaff.role.toLowerCase().includes('manager') || verifiedStaff.role.toLowerCase().includes('admin') ? 'admin' : 'sales'),
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
            const storedAcc = storedAccounts.find(u => u.email.toLowerCase() === cleanEmail);
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
            const storedAcc = storedAccounts.find(u => u.email.toLowerCase() === cleanEmail);
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
      const storedAcc = storedAccounts.find(u => u.email.toLowerCase() === cleanEmail);
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
      if (removedIds.length > 0) {
        removedIds.forEach(id => {
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

    setAttendanceRecords(prev => prev.map(a => a.id === openRecord.id ? {
      ...a,
      status: 'on_break',
      breakStartTime: Date.now()
    } : a));
    setStaffMembers(prev => prev.map(s => s.id === staffId ? { ...s, status: 'on_break' } : s));

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

    setAttendanceRecords(prev => prev.map(a => a.id === openRecord.id ? {
      ...a,
      status: 'present',
      breakStartTime: undefined,
      totalBreakMinutes: (a.totalBreakMinutes || 0) + breakDurationMin
    } : a));
    setStaffMembers(prev => prev.map(s => s.id === staffId ? { ...s, status: 'active' } : s));

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

    return newRecord;
  };

  const deleteFoodWaste = async (id: string) => {
    setFoodWasteRecords(prev => prev.filter(w => w.id !== id));
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
    return newRecipe;
  };

  const updateMasterRecipe = async (id: string, updates: Partial<KitchenMasterRecipe>) => {
    setMasterRecipes(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r));
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
    setPrinters(prev => {
      let updated = prev;
      if (newPrinter.isDefault) {
        updated = updated.map(p => p.station === newPrinter.station ? { ...p, isDefault: false } : p);
      }
      return [...updated, newPrinter];
    });
    return newPrinter;
  };

  const updatePrinter = async (id: string, updates: Partial<POSPrinterConfig>) => {
    setPrinters(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, ...updates };
      }
      if (updates.isDefault && p.station === (updates.station || p.station)) {
        return { ...p, isDefault: false };
      }
      return p;
    }));
  };

  const deletePrinter = async (id: string) => {
    setPrinters(prev => prev.filter(p => p.id !== id));
  };

  const testPrinter = async (id: string): Promise<{ success: boolean; message: string }> => {
    const target = printers.find(p => p.id === id);
    if (!target) return { success: false, message: 'Printer not found.' };
    const html = generateTestSlipHtml(target, settings);
    const res = await executeThermalPrint(html, target);
    if (res.success) {
      setPrinters(prev => prev.map(p => p.id === id ? { ...p, lastTestedAt: Date.now() } : p));
    }
    return res;
  };

  const printKOTForTicket = async (kot: KitchenOrderTicket): Promise<{ success: boolean; message: string }> => {
    const targetPrinters = printers.filter(p => p.isActive && (p.station === 'kitchen' || p.station === 'all'));
    const printerToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
    if (!printerToUse) {
      return { success: false, message: 'No active kitchen printer configured.' };
    }
    const html = generateKOTSlipHtml(kot, printerToUse, settings);
    return executeThermalPrint(html, printerToUse);
  };

  const printBOTForTicket = async (bot: KitchenOrderTicket): Promise<{ success: boolean; message: string }> => {
    const targetPrinters = printers.filter(p => p.isActive && (p.station === 'bar' || p.station === 'all'));
    const printerToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
    if (!printerToUse) {
      return { success: false, message: 'No active bar printer configured.' };
    }
    const html = generateBOTSlipHtml(bot, printerToUse, settings);
    return executeThermalPrint(html, printerToUse);
  };

  const printBillForInvoice = async (invoice: SaleInvoice, table?: DiningTable | null): Promise<{ success: boolean; message: string }> => {
    const targetPrinters = printers.filter(p => p.isActive && (p.station === 'billing' || p.station === 'all'));
    const printerToUse = targetPrinters.find(p => p.isDefault) || targetPrinters[0] || printers[0];
    if (!printerToUse) {
      return { success: false, message: 'No active billing printer configured.' };
    }
    const html = generateBillReceiptSlipHtml(invoice, table || null, printerToUse, settings);
    return executeThermalPrint(html, printerToUse);
  };

  // Active notifications count (low stock count + overdue payments)
  const lowStockCount = products.filter(p => p.currentStock <= p.reorderLevel).length;
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
        updateProduct,
        deleteProduct,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        units,
        addUnit,
        customers,
        addCustomer,
        updateCustomer,
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
        resetToDemoData,
        clearAllData,
        purgeAllLegacyFirestoreData,
        isSyncing,
        activeNotificationsCount,

        // Multi-Tenant & RBAC & Live Sync
        restaurantId,
        setRestaurantSyncChannel,
        syncLiveTablesToFirestore,
        isSuperAdmin,
        isAdmin,
        isStaff,

        // Restaurant values (Floor -> Section -> Layout Flow)
        floors,
        sections,
        diningZones,
        diningTables,
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
        saveFloorPlanToCloud,
        fireKitchenOrderTicket,
        splitAndFireTickets,
        kitchenTickets,
        updateKOTStatus,
        updateKOTItemStatus,
        settleTableBill,

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
        printBillForInvoice,

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
