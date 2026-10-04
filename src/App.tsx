import React, { useState, Suspense, lazy, Component } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { StaffPortalActivationModal } from './components/auth/StaffPortalActivationModal';
import { Loader2 } from 'lucide-react';

// Resilient dynamic import wrapper with automatic retry and stale-chunk recovery
const safeLazy = <T extends React.ComponentType<any>>(
  factory: () => Promise<any>
): React.LazyExoticComponent<T> => {
  return lazy(async () => {
    try {
      const module = await factory();
      return { default: module.default || module.POSView || module[Object.keys(module)[0]] };
    } catch (error) {
      console.warn('Dynamic module import failed, attempting recovery...', error);
      // Wait 300ms and retry once
      await new Promise(r => setTimeout(r, 300));
      try {
        const retryModule = await factory();
        return { default: retryModule.default || retryModule.POSView || retryModule[Object.keys(retryModule)[0]] };
      } catch (retryErr) {
        // Clear cached chunk and reload if it was a stale deploy or server restart
        if (typeof window !== 'undefined' && !sessionStorage.getItem('quickims_chunk_reloaded')) {
          sessionStorage.setItem('quickims_chunk_reloaded', '1');
          window.location.reload();
        }
        throw retryErr;
      }
    }
  });
};

// Code-split view components for optimal bundle size and instant load performance
const DashboardView = safeLazy(() => import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const POSView = safeLazy(() => import('./components/pos/POSView'));
const ProductsView = safeLazy(() => import('./components/products/ProductsView').then(m => ({ default: m.ProductsView })));
const InventoryView = safeLazy(() => import('./components/inventory/InventoryView').then(m => ({ default: m.InventoryView })));
const PurchasesView = safeLazy(() => import('./components/purchases/PurchasesView').then(m => ({ default: m.PurchasesView })));
const CustomersView = safeLazy(() => import('./components/customers/CustomersView').then(m => ({ default: m.CustomersView })));
const SuppliersView = safeLazy(() => import('./components/suppliers/SuppliersView').then(m => ({ default: m.SuppliersView })));
const AccountingView = safeLazy(() => import('./components/accounting/AccountingView').then(m => ({ default: m.AccountingView })));
const InvoiceReportView = safeLazy(() => import('./components/reports/InvoiceReportView').then(m => ({ default: m.InvoiceReportView })));
const BillReportView = safeLazy(() => import('./components/reports/BillReportView').then(m => ({ default: m.BillReportView })));
const ReportsView = safeLazy(() => import('./components/reports/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = safeLazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const PrinterSetupView = safeLazy(() => import('./components/settings/PrinterSetupView').then(m => ({ default: m.PrinterSetupView })));
const AuthView = safeLazy(() => import('./components/auth/AuthView').then(m => ({ default: m.AuthView })));
const EmailVerificationView = safeLazy(() => import('./components/auth/EmailVerificationView').then(m => ({ default: m.EmailVerificationView })));
const FloorTablesView = safeLazy(() => import('./components/pos/FloorTablesView').then(m => ({ default: m.FloorTablesView })));
const FloorSectionConfigView = safeLazy(() => import('./components/pos/FloorSectionConfigView').then(m => ({ default: m.FloorSectionConfigView })));
const KitchenKDSView = safeLazy(() => import('./components/pos/KitchenKDSView').then(m => ({ default: m.KitchenKDSView })));
const BarBOTView = safeLazy(() => import('./components/pos/BarBOTView').then(m => ({ default: m.BarBOTView })));
const StaffView = safeLazy(() => import('./components/manage/StaffView').then(m => ({ default: m.StaffView })));
const RecipesView = safeLazy(() => import('./components/kitchen/RecipesView').then(m => ({ default: m.RecipesView })));
const FoodWasteView = safeLazy(() => import('./components/kitchen/FoodWasteView').then(m => ({ default: m.FoodWasteView })));
const FoodCostAnalysisView = safeLazy(() => import('./components/reports/FoodCostAnalysisView').then(m => ({ default: m.FoodCostAnalysisView })));

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('View module error caught:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xl">
            ⚠️
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Module Update Required
          </h3>
          <p className="text-xs text-slate-500 max-w-md">
            A new version or update of this module was loaded. Click below to refresh and load the latest screen.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md"
          >
            Reload Module
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ViewLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[360px] p-8 text-slate-400 gap-2">
    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
    <span className="text-2xs font-semibold text-slate-500">Loading module...</span>
  </div>
);

const MainContent: React.FC = () => {
  const { activeStaffUser } = useApp();
  const [activeTab, setActiveTab] = useState(() => {
    if (activeStaffUser) {
      const role = (activeStaffUser.role || '').toLowerCase();
      if (role.includes('chef') || role.includes('cook') || role.includes('kitchen')) return 'kds';
      if (role.includes('bar') || role.includes('bartender')) return 'bot';
      if (role.includes('waiter') || role.includes('server') || role.includes('cashier')) return 'pos';
    }
    return 'dashboard';
  });

  React.useEffect(() => {
    if (activeStaffUser) {
      const role = (activeStaffUser.role || '').toLowerCase();
      if (role.includes('chef') || role.includes('cook') || role.includes('kitchen')) {
        setActiveTab('kds');
      } else if (role.includes('bar') || role.includes('bartender')) {
        setActiveTab('bot');
      } else if (role.includes('waiter') || role.includes('server') || role.includes('cashier')) {
        setActiveTab('pos');
      }
    }
  }, [activeStaffUser?.id]);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('quickims_theme');
    if (saved !== null) {
      return saved === 'dark';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      localStorage.setItem('quickims_theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      localStorage.setItem('quickims_theme', 'light');
    }
  }, [darkMode]);

  return (
    <AppShell 
      currentTab={activeTab}
      setCurrentTab={setActiveTab}
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
      onOpenQuickSale={() => setActiveTab('pos')}
    >
      <ViewErrorBoundary>
        <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'dashboard' && <DashboardView onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'pos' && <POSView />}
          {activeTab === 'kds' && <KitchenKDSView />}
          {activeTab === 'bot' && <BarBOTView />}

          {/* Manage */}
          {activeTab === 'products' && <ProductsView />}
          {activeTab === 'tables' && <FloorTablesView onOpenTableOrder={(tableId) => setActiveTab('pos')} />}
          {activeTab === 'floor-config' && <FloorSectionConfigView onDone={() => setActiveTab('tables')} />}
          {activeTab === 'staff' && <StaffView />}

          {/* Kitchen & Stock */}
          {activeTab === 'recipes' && <RecipesView />}
          {activeTab === 'inventory' && <InventoryView onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'waste' && <FoodWasteView />}

          {/* Invoices & Parties */}
          {activeTab === 'invoice-reports' && <InvoiceReportView />}
          {activeTab === 'purchases' && <PurchasesView />}
          {activeTab === 'customers' && <CustomersView />}
          {activeTab === 'suppliers' && <SuppliersView />}
          {activeTab === 'bill-reports' && <BillReportView />}

          {/* Reports & Analysis */}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'vat-reports' && <ReportsView />}
          {activeTab === 'food-cost' && <FoodCostAnalysisView />}

          {/* Finance & Setup */}
          {activeTab === 'accounting' && <AccountingView />}
          {activeTab === 'printers' && <PrinterSetupView />}
          {activeTab === 'settings' && <SettingsView />}
        </Suspense>
      </ViewErrorBoundary>
    </AppShell>
  );
};

const AppRouter: React.FC = () => {
  const { firebaseUser, authLoading, isDemoSession, activeStaffUser } = useApp();

  const [activationParams, setActivationParams] = useState<{ email: string; token: string; staffId?: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const isVerify = search.get('verifyStaff') === 'true';
      const email = search.get('email') || '';
      const token = search.get('token') || '';
      const staffId = search.get('staffId') || undefined;
      if (isVerify && (email || token || staffId)) {
        return { email, token, staffId };
      }
    }
    return null;
  });

  return (
    <>
      {activationParams && (
        <StaffPortalActivationModal
          email={activationParams.email}
          token={activationParams.token}
          staffId={activationParams.staffId}
          onClose={() => setActivationParams(null)}
        />
      )}

      {authLoading && !activeStaffUser ? (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 animate-pulse">
            Q
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Verifying authentication...</span>
          </div>
        </div>
      ) : !firebaseUser && !isDemoSession && !activeStaffUser ? (
        <Suspense fallback={<ViewLoadingFallback />}>
          <AuthView />
        </Suspense>
      ) : firebaseUser && !firebaseUser.emailVerified && !isDemoSession && !activeStaffUser ? (
        <Suspense fallback={<ViewLoadingFallback />}>
          <EmailVerificationView />
        </Suspense>
      ) : (
        <MainContent />
      )}
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}

