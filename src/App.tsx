import React, { useState, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { StaffPortalActivationModal } from './components/auth/StaffPortalActivationModal';
import { Loader2 } from 'lucide-react';

// Code-split view components for optimal bundle size and instant load performance
const DashboardView = lazy(() => import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const POSView = lazy(() => import('./components/pos/POSView').then(m => ({ default: m.POSView })));
const ProductsView = lazy(() => import('./components/products/ProductsView').then(m => ({ default: m.ProductsView })));
const InventoryView = lazy(() => import('./components/inventory/InventoryView').then(m => ({ default: m.InventoryView })));
const PurchasesView = lazy(() => import('./components/purchases/PurchasesView').then(m => ({ default: m.PurchasesView })));
const CustomersView = lazy(() => import('./components/customers/CustomersView').then(m => ({ default: m.CustomersView })));
const SuppliersView = lazy(() => import('./components/suppliers/SuppliersView').then(m => ({ default: m.SuppliersView })));
const AccountingView = lazy(() => import('./components/accounting/AccountingView').then(m => ({ default: m.AccountingView })));
const InvoiceReportView = lazy(() => import('./components/reports/InvoiceReportView').then(m => ({ default: m.InvoiceReportView })));
const BillReportView = lazy(() => import('./components/reports/BillReportView').then(m => ({ default: m.BillReportView })));
const ReportsView = lazy(() => import('./components/reports/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const PrinterSetupView = lazy(() => import('./components/settings/PrinterSetupView').then(m => ({ default: m.PrinterSetupView })));
const AuthView = lazy(() => import('./components/auth/AuthView').then(m => ({ default: m.AuthView })));
const EmailVerificationView = lazy(() => import('./components/auth/EmailVerificationView').then(m => ({ default: m.EmailVerificationView })));
const FloorTablesView = lazy(() => import('./components/pos/FloorTablesView').then(m => ({ default: m.FloorTablesView })));
const KitchenKDSView = lazy(() => import('./components/pos/KitchenKDSView').then(m => ({ default: m.KitchenKDSView })));
const BarBOTView = lazy(() => import('./components/pos/BarBOTView').then(m => ({ default: m.BarBOTView })));
const StaffView = lazy(() => import('./components/manage/StaffView').then(m => ({ default: m.StaffView })));
const RecipesView = lazy(() => import('./components/kitchen/RecipesView').then(m => ({ default: m.RecipesView })));
const FoodWasteView = lazy(() => import('./components/kitchen/FoodWasteView').then(m => ({ default: m.FoodWasteView })));
const FoodCostAnalysisView = lazy(() => import('./components/reports/FoodCostAnalysisView').then(m => ({ default: m.FoodCostAnalysisView })));

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
      <Suspense fallback={<ViewLoadingFallback />}>
        {activeTab === 'dashboard' && <DashboardView onNavigate={(tab) => setActiveTab(tab)} />}
        {activeTab === 'pos' && <POSView />}
        {activeTab === 'kds' && <KitchenKDSView />}
        {activeTab === 'bot' && <BarBOTView />}

        {/* Manage */}
        {activeTab === 'products' && <ProductsView />}
        {activeTab === 'tables' && <FloorTablesView onOpenTableOrder={(tableId) => setActiveTab('pos')} />}
        {activeTab === 'floor-config' && <FloorTablesView onOpenTableOrder={(tableId) => setActiveTab('pos')} />}
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
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20 animate-pulse">
            Q
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
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

