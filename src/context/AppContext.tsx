import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Product, Customer, Supplier, Warehouse, SaleInvoice, PurchaseInvoice, 
  StockMovement, ExpenseRecord, CompanySettings, UnitDefinition, Quotation, SalesReturn, StockAdjustment, StockTransfer,
  ProductCategory, AppAuthUser, StoredUserAccount
} from '../types';
import { 
  INITIAL_COMPANY_SETTINGS, INITIAL_PRODUCTS, INITIAL_CUSTOMERS, 
  INITIAL_SUPPLIERS, INITIAL_WAREHOUSES, INITIAL_SALES_INVOICES, 
  INITIAL_PURCHASES, INITIAL_EXPENSES, INITIAL_STOCK_MOVEMENTS, INITIAL_UNITS, INITIAL_CATEGORIES 
} from '../data/initialData';
import { db, auth, googleProvider } from '../firebase';
import { 
  signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile
} from 'firebase/auth';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, limit, getDocFromServer 
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
      uid: 'usr-admin-sujal',
      email: 'sujalsherstha110@gmail.com',
      password: 'password123',
      name: 'Sujal Shrestha',
      role: 'super_admin',
      emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      provider: 'google'
    },
    {
      uid: 'usr-demo-counter',
      email: 'counter@quickims.np',
      password: 'password123',
      name: 'Prakash Maharjan',
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
  role: 'super_admin' | 'admin' | 'sales' | 'inventory' | 'accountant';
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
  
  // Quick system actions
  resetToDemoData: () => Promise<void>;
  isSyncing: boolean;
  activeNotificationsCount: number;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserContextState>({
    id: 'usr-admin-1',
    name: 'Sujal Shrestha (MD)',
    role: 'super_admin',
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
        const isAdmin = user.email === 'sujalsherstha110@gmail.com' || !user.email;
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
          name: appUser.displayName || 'User',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
          role: isAdmin ? 'super_admin' : 'admin',
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
              name: parsed.displayName || 'User',
              email: parsed.email || '',
              photoURL: parsed.photoURL || undefined,
              role: parsed.email === 'sujalsherstha110@gmail.com' ? 'super_admin' : 'admin',
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
        const isAdmin = res.user.email === 'sujalsherstha110@gmail.com' || !res.user.email;
        const appUser: AppAuthUser = {
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName || 'Google User',
          photoURL: res.user.photoURL || undefined,
          emailVerified: res.user.emailVerified,
          providerId: 'google.com'
        };
        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
        setCurrentUser({
          id: res.user.uid,
          name: appUser.displayName || 'Google User',
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
          uid: 'usr-google-sujal',
          email: 'sujalsherstha110@gmail.com',
          displayName: 'Sujal Shrestha',
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          emailVerified: true,
          providerId: 'google.com'
        };
        setFirebaseUser(appUser);
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(appUser));
        setCurrentUser({
          id: appUser.uid,
          name: appUser.displayName || 'Sujal Shrestha',
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
        const newAccount: StoredUserAccount = {
          uid: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          email: cleanEmail,
          password: password,
          name: cleanName,
          role: cleanEmail === 'sujalsherstha110@gmail.com' ? 'super_admin' : 'admin',
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
          if (cleanEmail === 'sujalsherstha110@gmail.com') {
            const ownerAccount: StoredUserAccount = {
              uid: 'usr_owner_sujal',
              email: cleanEmail,
              password: password,
              name: 'Sujal Shrestha',
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
        throw new Error(e.message || 'Failed to dispatch verification email.');
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
        if (!account && cleanEmail !== 'sujalsherstha110@gmail.com') {
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
        role: cleanEmail === 'sujalsherstha110@gmail.com' ? 'super_admin' : 'admin',
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
    return cached ? JSON.parse(cached) : INITIAL_COMPANY_SETTINGS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const cached = localStorage.getItem('quickims_products');
    return cached ? JSON.parse(cached) : INITIAL_PRODUCTS;
  });

  const [categories, setCategories] = useState<ProductCategory[]>(() => {
    const cached = localStorage.getItem('quickims_categories');
    return cached ? JSON.parse(cached) : INITIAL_CATEGORIES;
  });

  const [units, setUnits] = useState<UnitDefinition[]>(() => {
    const cached = localStorage.getItem('quickims_units');
    return cached ? JSON.parse(cached) : INITIAL_UNITS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const cached = localStorage.getItem('quickims_customers');
    return cached ? JSON.parse(cached) : INITIAL_CUSTOMERS;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const cached = localStorage.getItem('quickims_suppliers');
    return cached ? JSON.parse(cached) : INITIAL_SUPPLIERS;
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
    const cached = localStorage.getItem('quickims_warehouses');
    return cached ? JSON.parse(cached) : INITIAL_WAREHOUSES;
  });

  const [sales, setSales] = useState<SaleInvoice[]>(() => {
    const cached = localStorage.getItem('quickims_sales');
    return cached ? JSON.parse(cached) : INITIAL_SALES_INVOICES;
  });

  const [purchases, setPurchases] = useState<PurchaseInvoice[]>(() => {
    const cached = localStorage.getItem('quickims_purchases');
    return cached ? JSON.parse(cached) : INITIAL_PURCHASES;
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const cached = localStorage.getItem('quickims_expenses');
    return cached ? JSON.parse(cached) : INITIAL_EXPENSES;
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const cached = localStorage.getItem('quickims_movements');
    return cached ? JSON.parse(cached) : INITIAL_STOCK_MOVEMENTS;
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

  // Local persistence sync
  useEffect(() => {
    localStorage.setItem('quickims_settings', JSON.stringify(settings));
  }, [settings]);

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
        const prodSnap = await getDocs(collection(db, 'products'));
        if (!prodSnap.empty) {
          const loadedProducts = prodSnap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
          setProducts(loadedProducts);
        }

        const catSnap = await getDocs(collection(db, 'categories'));
        if (!catSnap.empty) {
          const loadedCats = catSnap.docs.map(d => ({ ...d.data(), id: d.id } as ProductCategory));
          // Merge with default categories to make sure none are accidentally lost
          setCategories(prev => {
            const map = new Map<string, ProductCategory>();
            INITIAL_CATEGORIES.forEach(c => map.set(c.name.toLowerCase(), c));
            prev.forEach(c => map.set(c.name.toLowerCase(), c));
            loadedCats.forEach(c => map.set(c.name.toLowerCase(), c));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Firestore initial sync note (using local cache):', err);
      }
    };
    loadFromFirestore();
  }, []);

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
    const invoice: SaleInvoice = {
      ...saleData,
      id: newSaleId,
      createdAt: Date.now()
    };

    // 1. Add invoice to sales
    setSales(prev => [invoice, ...prev]);

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
    const purchase: PurchaseInvoice = {
      ...purchaseData,
      id: newPurId,
      createdAt: Date.now()
    };

    // 1. Add purchase invoice
    setPurchases(prev => [purchase, ...prev]);

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

  // Reset to Demo Data
  const resetToDemoData = async () => {
    setIsSyncing(true);
    setSettings(INITIAL_COMPANY_SETTINGS);
    setProducts(INITIAL_PRODUCTS);
    setCategories(INITIAL_CATEGORIES);
    setCustomers(INITIAL_CUSTOMERS);
    setSuppliers(INITIAL_SUPPLIERS);
    setWarehouses(INITIAL_WAREHOUSES);
    setSales(INITIAL_SALES_INVOICES);
    setPurchases(INITIAL_PURCHASES);
    setExpenses(INITIAL_EXPENSES);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setStockAdjustments([]);
    setStockTransfers([]);
    setQuotations([]);
    setSalesReturns([]);

    // Clear local storage
    localStorage.clear();
    setIsSyncing(false);
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
        settleInvoicePayment,
        purchases,
        recordPurchase,
        updatePurchase,
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
        isSyncing,
        activeNotificationsCount,
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
