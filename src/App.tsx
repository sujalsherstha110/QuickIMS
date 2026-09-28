import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { POSView } from './components/pos/POSView';
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
import { FloorSectionConfigView } from './components/pos/FloorSectionConfigView';
import { KitchenKDSView } from './components/pos/KitchenKDSView';
import { BarBOTView } from './components/pos/BarBOTView';
import { StaffView } from './components/manage/StaffView';
import { RecipesView } from './components/kitchen/RecipesView';
import { FoodWasteView } from './components/kitchen/FoodWasteView';
import { FoodCostAnalysisView } from './components/reports/FoodCostAnalysisView';
import { StaffPortalActivationModal } from './components/auth/StaffPortalActivationModal';
import { Loader2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
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

