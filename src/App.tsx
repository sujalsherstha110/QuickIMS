import React, { useState, Component } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { StaffPortalActivationModal } from './components/auth/StaffPortalActivationModal';
import { Loader2 } from 'lucide-react';

// Direct imports for reliable, instant navigation across all views without dynamic chunk load errors
import { DashboardView } from './components/dashboard/DashboardView';
import POSView from './components/pos/POSView';
import { ProductsView } from './components/products/ProductsView';
import { InventoryView } from './components/inventory/InventoryView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { CustomersView } from './components/customers/CustomersView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { AccountingView } from './components/accounting/AccountingView';
import { InvoiceReportView } from './components/reports/InvoiceReportView';
import { BillReportView } from './components/reports/BillReportView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { PrinterSetupView } from './components/settings/PrinterSetupView';
import { AuthView } from './components/auth/AuthView';
import { EmailVerificationView } from './components/auth/EmailVerificationView';
import { FloorTablesView } from './components/pos/FloorTablesView';
import { KitchenKDSView } from './components/pos/KitchenKDSView';
import { BarBOTView } from './components/pos/BarBOTView';
import { StaffView } from './components/manage/StaffView';
import { RecipesView } from './components/kitchen/RecipesView';
import { FoodWasteView } from './components/kitchen/FoodWasteView';
import { FoodCostAnalysisView } from './components/reports/FoodCostAnalysisView';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
  onReset?: () => void;
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

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoDashboard = () => {
    try {
      localStorage.setItem('quickims_active_tab', 'dashboard');
    } catch {}
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleResetCache = () => {
    try {
      localStorage.removeItem('quickims_active_tab');
      localStorage.removeItem('restro_selected_table_id');
      localStorage.removeItem('restro_table_drafts');
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-2xl shadow-sm">
            ⚠️
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              View Encountered an Issue
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
              {this.state.error?.message || 'An unexpected error occurred while loading this view.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={this.handleGoDashboard}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Go to Dashboard
            </button>
            <button
              type="button"
              onClick={this.handleResetCache}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-200 dark:border-rose-900/40"
            >
              Reset Session Cache
            </button>
          </div>
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
  const { activeStaffUser, setSelectedTableId } = useApp();
  const [activeTab, setActiveTab] = useState<string>(() => {
    // 1. Check if user was already in a tab during their active session
    const savedTab = localStorage.getItem('quickims_active_tab');
    if (savedTab) {
      if (savedTab === 'floor-config') return 'tables';
      return savedTab;
    }

    // 2. Otherwise determine initial view by active staff operator role
    if (activeStaffUser) {
      const role = String(activeStaffUser.role || '').toLowerCase();
      if (role.includes('chef') || role.includes('cook') || role.includes('kitchen')) return 'kds';
      if (role.includes('bar') || role.includes('bartender')) return 'bot';
      if (role.includes('waiter') || role.includes('server') || role.includes('cashier')) return 'pos';
    }
    return 'dashboard';
  });

  const prevStaffIdRef = React.useRef<string | undefined>(activeStaffUser?.id);
  React.useEffect(() => {
    // Only switch tab if the staff identity ACTUALLY changed (e.g. login or switch operator)
    if (activeStaffUser && activeStaffUser.id !== prevStaffIdRef.current) {
      prevStaffIdRef.current = activeStaffUser.id;
      const role = String(activeStaffUser.role || '').toLowerCase();
      let targetTab = 'dashboard';
      if (role.includes('chef') || role.includes('cook') || role.includes('kitchen')) {
        targetTab = 'kds';
      } else if (role.includes('bar') || role.includes('bartender')) {
        targetTab = 'bot';
      } else if (role.includes('waiter') || role.includes('server') || role.includes('cashier')) {
        targetTab = 'pos';
      }
      setActiveTab(targetTab);
      localStorage.setItem('quickims_active_tab', targetTab);
    } else if (!activeStaffUser) {
      prevStaffIdRef.current = undefined;
    }
  }, [activeStaffUser?.id]);

  const handleSelectTab = React.useCallback((tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('quickims_active_tab', tab);
  }, []);
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
      setCurrentTab={handleSelectTab}
      activeTab={activeTab} 
      setActiveTab={handleSelectTab}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
      onOpenQuickSale={() => handleSelectTab('pos')}
    >
      <ViewErrorBoundary key={activeTab} resetKey={activeTab} onReset={() => handleSelectTab('dashboard')}>
        {activeTab === 'dashboard' && <DashboardView onNavigate={(tab) => handleSelectTab(tab)} />}
        {activeTab === 'pos' && <POSView />}
        {activeTab === 'kds' && <KitchenKDSView />}
        {activeTab === 'bot' && <BarBOTView />}

        {/* Manage */}
        {activeTab === 'products' && <ProductsView />}
        {(activeTab === 'tables' || activeTab === 'floor-config') && (
          <FloorTablesView
            onOpenTableOrder={(tableId) => {
              setSelectedTableId(tableId);
              handleSelectTab('pos');
            }}
          />
        )}
        {activeTab === 'staff' && <StaffView />}

        {/* Kitchen & Stock */}
        {activeTab === 'recipes' && <RecipesView />}
        {activeTab === 'inventory' && <InventoryView onNavigate={(tab) => handleSelectTab(tab)} />}
        {(activeTab === 'waste' || activeTab === 'food-cost') && <FoodWasteView />}

        {/* Invoices & Parties */}
        {activeTab === 'invoice-reports' && <InvoiceReportView />}
        {activeTab === 'purchases' && <PurchasesView />}
        {activeTab === 'customers' && <CustomersView />}
        {activeTab === 'suppliers' && <SuppliersView />}
        {activeTab === 'bill-reports' && <BillReportView />}

        {/* Reports & Analysis */}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'vat-reports' && <ReportsView />}

        {/* Finance & Setup */}
        {activeTab === 'accounting' && <AccountingView />}
        {activeTab === 'printers' && <PrinterSetupView />}
        {activeTab === 'settings' && <SettingsView />}
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
        <AuthView />
      ) : firebaseUser && !firebaseUser.emailVerified && !isDemoSession && !activeStaffUser ? (
        <EmailVerificationView />
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

