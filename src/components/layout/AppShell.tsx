import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Truck, Boxes, Receipt, 
  Users, Building2, BarChart3, Settings, ChevronDown, 
  Menu, X, Sun, Moon, Search, Plus, Bell, RefreshCw, FileText,
  FileSpreadsheet, Warehouse as WarehouseIcon, Wifi, WifiOff,
  Download, CheckCircle2, ChevronRight, Layers, ArrowUpRight, LogOut,
  Mail, UtensilsCrossed, ChefHat, Wine, BookOpen, AlertTriangle, PieChart,
  Printer, Radio, Copy, Check, Shield, LayoutGrid
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toNepaliBSDate } from '../../utils/nepalFormatters';
import { usePWA } from '../../utils/usePWA';

interface LayoutProps {
  currentTab?: string;
  setCurrentTab?: (tab: string) => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  children: React.ReactNode;
  darkMode?: boolean;
  setDarkMode?: (val: boolean) => void;
  onOpenQuickSale?: () => void;
}

export const AppShell: React.FC<LayoutProps> = ({
  currentTab,
  setCurrentTab,
  activeTab,
  setActiveTab,
  children,
  darkMode = true,
  setDarkMode,
  onOpenQuickSale
}) => {
  const selectedTab = currentTab || activeTab || 'dashboard';
  const handleTabChange = (tab: string) => {
    if (setCurrentTab) setCurrentTab(tab);
    if (setActiveTab) setActiveTab(tab);
  };

  const { 
    currentUser, setCurrentUser, settings, warehouses, 
    currentWarehouseId, setCurrentWarehouseId, activeNotificationsCount,
    syncAllDataFromCloud, products, kitchenTickets, logout, firebaseUser, isDemoSession,
    activeStaffUser, setActiveStaffUser, logoutStaff,
    staffMembers, activePOSStaff, switchActiveStaffByPin, resetStaffData,
    isSuperAdmin, isAdmin, isStaff, purgeAllLegacyFirestoreData,
    restaurantId, setRestaurantSyncChannel, diningTables,
    stockItems, canStaffDo
  } = useApp();

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [customSyncInput, setCustomSyncInput] = useState('');
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const currentStaff = activeStaffUser || activePOSStaff;
  const permissions = currentStaff?.permissions;

  const { isOnline, isInstallable, promptInstall } = usePWA();
  const [showReconnectedNotice, setShowReconnectedNotice] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    if (prevOnlineRef.current === false && isOnline === true) {
      setShowReconnectedNotice(true);
      const timer = setTimeout(() => setShowReconnectedNotice(false), 3500);
      return () => clearTimeout(timer);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  const handleRefreshApp = async () => {
    if (isRefreshingApp) return;
    setIsRefreshingApp(true);
    setRefreshNotice(null);

    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        promise.catch(() => null),
        new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
      ]);

    try {
      // 1. Pull latest restaurant catalog, tables, tickets & settings from cloud when online
      if (isOnline && syncAllDataFromCloud) {
        await withTimeout(syncAllDataFromCloud(restaurantId), 3000);
      }

      // 2. Trigger live PWA / Service Worker update check & clear stale runtime caches when online
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && isOnline) {
        try {
          const regs = await withTimeout(navigator.serviceWorker.getRegistrations(), 1500);
          if (regs && regs.length > 0) {
            await withTimeout(
              Promise.all(regs.map(reg => reg.update().catch(() => undefined))),
              1500
            );
          }
        } catch {
          /* ignore */
        }
      }

      if (typeof window !== 'undefined' && 'caches' in window && isOnline) {
        try {
          const cacheKeys = await withTimeout(window.caches.keys(), 1000);
          if (cacheKeys && cacheKeys.length > 0) {
            await withTimeout(
              Promise.all(cacheKeys.map(key => window.caches.delete(key))),
              1000
            );
          }
        } catch {
          /* ignore */
        }
      }

      // 3. Desktop Electron: trigger native .exe update check + cache-bypassing reload
      const desktop = typeof window !== 'undefined' ? window.quickimsDesktop : undefined;
      if (desktop?.isElectron) {
        if (desktop.refreshApp) {
          const res = await desktop.refreshApp();
          if (res?.installingUpdate) {
            return;
          }
          setTimeout(() => setIsRefreshingApp(false), 1500);
          return;
        }

        // Backward-compatible path for already-installed desktop .exe builds
        if (desktop.checkForUpdates && isOnline) {
          const updateRes = await withTimeout(desktop.checkForUpdates(), 2500);
          if (updateRes?.status === 'downloaded' && desktop.installUpdate) {
            await desktop.installUpdate();
            return;
          }
        }

        window.location.reload();
        return;
      }

      // 4. Web / PWA browser: reload cleanly if online, otherwise keep offline session intact
      if (isOnline) {
        window.location.reload();
        return;
      }

      setRefreshNotice('Offline — synced local data. Connect to internet to load live app updates.');
      setTimeout(() => setRefreshNotice(null), 3500);
    } catch {
      if (isOnline || window.quickimsDesktop?.isElectron) {
        window.location.reload();
        return;
      }
    } finally {
      setIsRefreshingApp(false);
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('quickims_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('quickims_sidebar_collapsed', String(next));
      return next;
    });
  };

  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showDesktopStaffDropdown, setShowDesktopStaffDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard shortcut '/' for search & F2 for POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && selectedTab !== 'pos') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !target?.isContentEditable) {
          e.preventDefault();
          setShowSearchModal(true);
        }
      }
      if (e.key === 'F2') {
        e.preventDefault();
        handleTabChange('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTab]);

  // Live counts for Kitchen KDS, Bar BOT, and Low Stock Raw Ingredients
  const activeKDSCount = (kitchenTickets || []).filter(k => k.status === 'in_kitchen' || k.status === 'pending').length;
  const activeBOTCount = (kitchenTickets || []).filter(k => {
    if (k.status === 'completed' || k.status === 'cancelled') return false;
    return (k.items || []).some(i => {
      const lower = String(i.productName || '').toLowerCase();
      return i.course === 'beverage' || lower.includes('beer') || lower.includes('drink') || 
             lower.includes('cocktail') || lower.includes('tea') || lower.includes('coffee') || 
             lower.includes('wine') || lower.includes('mocktail') || lower.includes('juice');
    });
  }).length;
  const lowStockCount = (stockItems && stockItems.length > 0)
    ? stockItems.filter(s => Number(s.currentStock || 0) <= Number(s.minReorderLevel || 0)).length
    : products.filter(p => p.trackStock && p.currentStock <= p.reorderLevel).length;

  // Logical Nav Groups - Structured into 6 Sections:
  // 1. Core (Dashboard, POS, KDS, BOT)
  // 2. Manage (Menu, Table & Floor Plan, Staff)
  // 3. Kitchen & Stock (Recipes & Ingredients, Stock, Food Waste / Control)
  // 4. Invoices & Parties (Sales, Purchase, Customer, Supplier)
  // 5. Reports & Analysis (Sales & Revenue, Tax & VAT, Food Cost & Wastage)
  // 6. Finance & Setup (Cash Register & Shifts, Settings)
  const navSections = [
    {
      groupTitle: 'Core',
      isCore: true,
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null, tooltip: 'Live Floor & Revenue Analytics' },
        { id: 'pos', label: 'POS', icon: ShoppingCart, badge: null, tooltip: 'Point of Sale & Table Ordering' },
        { id: 'kds', label: 'KDS', icon: ChefHat, badge: activeKDSCount > 0 ? activeKDSCount : null, badgeColor: 'rose', tooltip: 'Kitchen Display System (KOT)' },
        { id: 'bot', label: 'BOT', icon: Wine, badge: activeBOTCount > 0 ? activeBOTCount : null, badgeColor: 'amber', tooltip: 'Bar Order Ticket (Drinks & Dispense)' },
      ]
    },
    {
      groupTitle: 'Manage',
      isCore: false,
      items: [
        { id: 'products', label: 'Menu', icon: Boxes, badge: null, tooltip: 'Menu Items, Dishes & Pricing' },
        { id: 'tables', label: 'Table & Floor Plan', icon: Layers, badge: null, tooltip: 'Dining Sections & Table Status' },
        { id: 'staff', label: 'Staff', icon: Users, badge: null, tooltip: 'FOH & BOH Team, Shifts & Tables' },
      ]
    },
    {
      groupTitle: 'Kitchen & Stock',
      isCore: false,
      items: [
        { id: 'recipes', label: 'Recipes & Ingredient', icon: BookOpen, badge: null, tooltip: 'Bill of Materials & Dish Costing' },
        { id: 'inventory', label: 'Stock', icon: WarehouseIcon, badge: lowStockCount > 0 ? lowStockCount : null, badgeColor: 'rose', tooltip: 'Pantry Stock & Reorder Levels' },
        { id: 'waste', label: 'Food Control', icon: AlertTriangle, badge: null, tooltip: 'Kitchen Spoilage, COGS & Food Cost Variance' },
      ]
    },
    {
      groupTitle: 'Invoices & Parties',
      isCore: false,
      items: [
        { id: 'invoice-reports', label: 'Sales', icon: FileText, badge: null, tooltip: 'Guest Sales Invoices & Receipts' },
        { id: 'purchases', label: 'Purchase', icon: Truck, badge: null, tooltip: 'Vendor Purchases & Material Bills' },
        { id: 'customers', label: 'Customer', icon: Users, badge: null, tooltip: 'Guest CRM, Balances & Loyalty' },
        { id: 'suppliers', label: 'Supplier', icon: Building2, badge: null, tooltip: 'Food Vendors & Payables' },
      ]
    },
    {
      groupTitle: 'Reports & Analysis',
      isCore: false,
      items: [
        { id: 'reports', label: 'Sales & Revenue', icon: BarChart3, badge: null, tooltip: 'Sales Book & Revenue Reports' },
        { id: 'vat-reports', label: 'Tax & VAT (13%)', icon: Receipt, badge: null, tooltip: 'IRD VAT Annexure & Tax Returns' },
      ]
    },
    {
      groupTitle: 'Finance & Setup',
      isCore: false,
      items: [
        { id: 'accounting', label: 'Cash Register & Shifts', icon: Receipt, badge: null, tooltip: 'Opening & Closing Shifts, Petty Cash' },
        { id: 'printers', label: 'Printer Setup', icon: Printer, badge: null, tooltip: 'Thermal KOT, BOT & Bill Printers' },
        { id: 'settings', label: 'Settings', icon: Settings, badge: null, tooltip: 'Restaurant Profile & Business Config' },
      ]
    }
  ];

  const isTabAllowedForStaff = (tabId: string): boolean => {
    // 1. Super Admin (Developer) has unconditional full access to all system tabs
    if (isSuperAdmin) return true;

    // 2. Restaurant Owner / Admin has full venue access when no restricted staff PIN operator is logged in
    if (!activeStaffUser && !activePOSStaff) return true;

    // 3. Staff Operator restricted by granular module permissions
    switch (tabId) {
      case 'dashboard':
        return canStaffDo('reportsAnalytics', 'read') || canStaffDo('posOrders', 'read') || canStaffDo('kitchenBar', 'read') || canStaffDo('invoicesBilling', 'read');
      case 'pos':
        return canStaffDo('posOrders', 'read') || canStaffDo('posOrders', 'write');
      case 'tables':
        return canStaffDo('tableFloor', 'read') || canStaffDo('posOrders', 'read');
      case 'kds':
      case 'bot':
        return canStaffDo('kitchenBar', 'read');
      case 'products':
        return canStaffDo('menuCatalog', 'read');
      case 'recipes':
      case 'inventory':
        return canStaffDo('inventoryStock', 'read');
      case 'waste':
      case 'food-cost':
        return canStaffDo('foodControl', 'read') || canStaffDo('inventoryStock', 'read');
      case 'invoice-reports':
      case 'bill-reports':
        return canStaffDo('invoicesBilling', 'read');
      case 'purchases':
        return canStaffDo('purchasesSuppliers', 'read');
      case 'suppliers':
        return canStaffDo('purchasesSuppliers', 'read');
      case 'customers':
        return canStaffDo('customers', 'read');
      case 'reports':
        return canStaffDo('reportsAnalytics', 'read');
      case 'vat-reports':
        return canStaffDo('vatTaxReports', 'read');
      case 'accounting':
        return canStaffDo('cashRegister', 'read');
      case 'staff':
        return canStaffDo('staffShifts', 'read');
      case 'printers':
        return canStaffDo('settingsPrinters', 'read');
      case 'settings':
        return canStaffDo('settingsPrinters', 'read');
      default:
        return false;
    }
  };

  const visibleNavSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => isTabAllowedForStaff(item.id))
  })).filter(section => section.items.length > 0);

  // Auto redirect only if a dedicated restricted staff operator is active and current tab is strictly disallowed
  useEffect(() => {
    // When no staff session is restricting access or user is admin/owner, don't auto-redirect
    if (!currentStaff || !permissions) return;
    if (isSuperAdmin || isAdmin) return;

    if (!isTabAllowedForStaff(selectedTab)) {
      const firstAllowed = visibleNavSections[0]?.items[0]?.id;
      if (firstAllowed && firstAllowed !== selectedTab) {
        handleTabChange(firstAllowed);
      }
    }
  }, [currentStaff?.id, selectedTab, isSuperAdmin, isAdmin]);

  const handleSelectNav = (tabId: string) => {
    handleTabChange(tabId);
    setMobileMenuOpen(false);
  };

  const allItems = visibleNavSections.flatMap(s => s.items);
  const activeNavLabel = allItems.find(n => n.id === selectedTab)?.label || 'Overview';

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased ${darkMode ? 'dark' : ''}`}>
      
      {/* Offline Alert Strip - Full-width top alert across whole screen (never inside flex-row) */}
      {!isOnline && (
        <div className="w-full bg-amber-500 text-slate-950 text-xs font-semibold px-4 py-1.5 flex items-center justify-between shadow-xs shrink-0 z-50 border-b border-amber-600/30">
          <div className="flex items-center gap-2 mx-auto">
            <WifiOff className="w-4 h-4 shrink-0 text-slate-950" />
            <span className="font-bold tracking-tight">Offline Mode</span>
            <span className="hidden sm:inline font-normal text-slate-900">
              — Operating on local storage. Invoices, table orders, and stock updates are cached and will automatically sync when reconnected.
            </span>
            <span className="sm:hidden font-normal text-slate-900">
              — Operating offline (cached)
            </span>
          </div>
        </div>
      )}

      {/* Reconnected Confirmation Toast */}
      {showReconnectedNotice && (
        <div className="w-full bg-emerald-600 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 shadow-xs shrink-0 z-50 transition-all">
          <Check className="w-3.5 h-3.5 text-white" />
          <span>Connection restored — Changes synced with cloud.</span>
        </div>
      )}

      {/* Refresh Status Toast (when offline browser skips hard reload) */}
      {refreshNotice && (
        <div className="w-full bg-blue-600 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 shadow-xs shrink-0 z-50 transition-all">
          <RefreshCw className="w-3.5 h-3.5 text-white" />
          <span>{refreshNotice}</span>
        </div>
      )}

      {/* Main Responsive Body Layout (Sidebar + Content Row) */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">

      {/* MOBILE TOP BAR */}
      <header className="md:hidden flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 -ml-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs flex items-center justify-center">
            🍽️
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
              Quick IMS
            </span>
            <span className="text-3xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-200/50 dark:border-slate-700/50">
              {activeNavLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSearchModal(true)}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            title="Search products, invoices, customers"
            aria-label="Search"
          >
            <Search className="w-4.5 h-4.5" />
          </button>

          {/* Mobile Theme Toggle */}
          <button
            onClick={() => setDarkMode && setDarkMode(!darkMode)}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-slate-600" />}
          </button>

          {/* Mobile Refresh & Update Button */}
          <button
            type="button"
            onClick={handleRefreshApp}
            disabled={isRefreshingApp}
            title="Refresh App & Check for Updates"
            aria-label="Refresh App & Check for Updates"
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingApp ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
          </button>

          {/* Mobile Staff Operator Badge */}
          <button
            type="button"
            onClick={() => setShowDesktopStaffDropdown(prev => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-3xs font-bold cursor-pointer"
            title="Switch Staff Operator (Permissions Grant Testing)"
          >
            <span 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: currentStaff?.avatarColor || '#2563eb' }} 
            />
            <span className="truncate max-w-[70px] text-slate-800 dark:text-slate-200">{currentStaff?.name.split(' ')[0] || 'Staff'}</span>
          </button>
          
          <span 
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-amber-500'}`} 
            title={isOnline ? 'System Online' : 'Offline Mode'}
          />
        </div>
      </header>

      {/* DESKTOP SIDEBAR - Hamburger Toggleable: Full (w-60) or Collapsed (w-16) */}
      <aside className={`hidden md:flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-60'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 h-screen z-30 transition-all duration-200 ease-in-out`}>
        
        {/* Brand & Warehouse Select */}
        {sidebarCollapsed ? (
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              title="Quick IMS (Click to expand sidebar)"
            >
              🍽️
            </button>
          </div>
        ) : (
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm flex items-center justify-center shrink-0">
                  🍽️
                </div>
                <div className="truncate">
                  <h1 className="font-bold text-xs tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <span>Restro IMS</span>
                  </h1>
                  <p className="text-3xs text-slate-500 truncate" title="Dining & Kitchen Management">
                    Floor & Kitchen
                  </p>
                </div>
              </div>
              
              <span 
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                title={isOnline ? 'Connected' : 'Offline'}
              />
            </div>

            {/* Clean Warehouse Switcher */}
            <select
              value={currentWarehouseId}
              onChange={(e) => setCurrentWarehouseId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 outline-hidden focus:border-blue-500"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clean Categorized Navigation */}
        <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-2 space-y-3' : 'p-3 space-y-4'} text-xs`}>
          {visibleNavSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {sidebarCollapsed ? (
                idx > 0 && <div className="border-t border-slate-100 dark:border-slate-800/80 my-2" />
              ) : (
                <div className="flex items-center justify-between px-2.5 py-1">
                  <span className="text-3xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {section.groupTitle}
                  </span>
                  {section.isCore && (
                    <span className="text-3xs font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      LIVE
                    </span>
                  )}
                </div>
              )}
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = selectedTab === item.id;
                
                if (sidebarCollapsed) {
                  return (
                    <div key={item.id} className="relative group flex justify-center">
                      <button
                        onClick={() => handleSelectNav(item.id)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer relative ${
                          isActive
                            ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                        aria-label={item.label}
                      >
                        <Icon className="w-4.5 h-4.5" />
                        {item.badge !== null && item.badge !== undefined && (
                          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-3xs font-bold flex items-center justify-center text-white ring-2 ring-white dark:ring-slate-900 ${
                            item.badgeColor === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                      {/* Floating Tooltip */}
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold rounded-lg whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex items-center gap-1.5">
                        <span>{item.label}</span>
                        {item.badge !== null && item.badge !== undefined && (
                          <span className={`px-1.5 py-0.2 rounded text-3xs font-mono font-bold text-white ${
                            item.badgeColor === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== null && item.badge !== undefined && (
                      <span className={`text-3xs font-bold px-1.5 py-0.5 rounded-full font-mono ${
                        item.badgeColor === 'amber'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                          : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className={`${sidebarCollapsed ? 'p-2 flex justify-center' : 'p-3'} border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 relative`}>
          {sidebarCollapsed ? (
            <div>
              <button
                onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:ring-2 hover:ring-blue-500/50 transition-all cursor-pointer"
                title={activeStaffUser ? `Staff: ${activeStaffUser.name}` : `User: ${currentUser.name}`}
              >
                {activeStaffUser ? (
                  <div 
                    className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: activeStaffUser.avatarColor || '#2563eb' }}
                  >
                    {activeStaffUser.name.charAt(0).toUpperCase()}
                  </div>
                ) : currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.name} 
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-blue-500/30" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {showRoleSwitcher && (
                <div className="absolute bottom-2 left-full ml-3 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2.5 z-50 text-xs divide-y divide-slate-100 dark:divide-slate-700/60 space-y-2">
                  <div className="space-y-2">
                    <div>
                      <div className="px-2 py-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-3xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                            Active Operator
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {currentStaff?.name || currentUser.name}
                        </p>
                        <p className="text-3xs text-slate-500 truncate">
                          {currentStaff ? `${currentStaff.role} • PIN: ${currentStaff.pin}` : (currentUser.email || 'Admin')}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <p className="text-3xs font-black text-slate-400 dark:text-slate-500 uppercase px-2 pb-1.5">
                        Switch Staff (Test Permissions):
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {staffMembers.map(staff => (
                          <button
                            key={staff.id}
                            onClick={() => {
                              switchActiveStaffByPin(staff.pin);
                              setShowRoleSwitcher(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                              currentStaff?.id === staff.id
                                ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span 
                                className="w-2 h-2 rounded-full shrink-0" 
                                style={{ backgroundColor: staff.avatarColor || '#2563eb' }} 
                              />
                              <span className="truncate">{staff.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                              {staff.pin}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                      <button
                        onClick={async () => {
                          await resetStaffData();
                          setShowRoleSwitcher(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                        title="Reset all staff members to default testing credentials"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset Staff Data</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowRoleSwitcher(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors font-medium cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                className="w-full flex items-center justify-between p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {activeStaffUser ? (
                    <div 
                      className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: activeStaffUser.avatarColor || '#2563eb' }}
                    >
                      {activeStaffUser.name.charAt(0).toUpperCase()}
                    </div>
                  ) : currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.name} 
                      className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-blue-500/30" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-2xs font-semibold flex items-center justify-center shrink-0">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {activeStaffUser ? activeStaffUser.name : currentUser.name}
                    </p>
                    <p className="text-3xs text-slate-500 truncate">
                      {activeStaffUser 
                        ? `Staff • ${activeStaffUser.role}` 
                        : (currentUser.email || currentUser.role.replace('_', ' '))}
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </button>

              {showRoleSwitcher && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2.5 z-50 text-xs divide-y divide-slate-100 dark:divide-slate-700/60 space-y-2">
                  <div>
                    <div className="px-1.5 py-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-3xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {isSuperAdmin ? '⚡ Super Admin (Developer)' : currentStaff ? 'Staff PIN Session' : 'Owner Session'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {currentStaff ? currentStaff.name : (currentUser.name || 'Admin')}
                      </p>
                      <p className="text-3xs text-slate-500 truncate mt-0.5">
                        {isSuperAdmin ? 'System Developer • All Access' : currentStaff ? `${currentStaff.role} • PIN: ${currentStaff.pin}` : 'Business Owner • Full Access'}
                      </p>

                      {currentStaff && (
                        <button
                          onClick={() => {
                            logoutStaff();
                            setShowRoleSwitcher(false);
                          }}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 px-2 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                        >
                          <span>👑 Switch to Owner Mode (Full Access)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <p className="text-3xs font-black text-slate-400 dark:text-slate-500 uppercase px-2 pb-1.5">
                      Switch Staff (Test Permissions):
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {staffMembers.map(staff => (
                        <button
                          key={staff.id}
                          onClick={() => {
                            switchActiveStaffByPin(staff.pin);
                            setShowRoleSwitcher(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                            currentStaff?.id === staff.id
                              ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span 
                              className="w-2 h-2 rounded-full shrink-0" 
                              style={{ backgroundColor: staff.avatarColor || '#2563eb' }} 
                            />
                            <span className="truncate">{staff.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                            {staff.pin}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                    <button
                      onClick={async () => {
                        await resetStaffData();
                        setShowRoleSwitcher(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                      title="Reset all staff members to default testing credentials"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset Staff Data</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowRoleSwitcher(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors font-medium cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/40 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative w-64 bg-white dark:bg-slate-900 h-full flex flex-col shadow-xl z-10">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Quick IMS</h2>
                <p className="text-2xs text-slate-500">{settings.companyName}</p>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <select
                value={currentWarehouseId}
                onChange={(e) => setCurrentWarehouseId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {visibleNavSections.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between px-2 text-3xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <span>{sec.groupTitle}</span>
                    {sec.isCore && (
                      <span className="text-3xs font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        LIVE
                      </span>
                    )}
                  </div>
                  {sec.items.map(item => {
                    const Icon = item.icon;
                    const isActive = selectedTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectNav(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                        </div>

                        {item.badge !== null && item.badge !== undefined && (
                          <span className={`text-3xs font-bold px-1.5 py-0.5 rounded-full font-mono ${
                            item.badgeColor === 'amber'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* User Profile & Sign Out in Mobile Drawer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
              <div className="flex items-center gap-2">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.name} 
                    className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-blue-500/30" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center shrink-0">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="truncate flex-1">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{currentUser.name}</p>
                  <p className="text-3xs text-slate-500 truncate">{currentUser.email || currentUser.role.replace('_', ' ')}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-2xs text-slate-500">{toNepaliBSDate(new Date())}</span>
              <button
                onClick={() => setDarkMode && setDarkMode(!darkMode)}
                className="p-1.5 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-5 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            {/* Hamburger Sidebar Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="p-1.5 -ml-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              title={sidebarCollapsed ? "Expand Sidebar (Hamburger Menu)" : "Collapse Sidebar (Hamburger Menu)"}
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

            <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {activeNavLabel}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Online / Offline Connection Badge */}
            <button
              type="button"
              onClick={() => {
                setCustomSyncInput(restaurantId);
                setShowSyncModal(true);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                isOnline
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'border-amber-300 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300'
              }`}
              title={isOnline ? 'Internet connected — click for multi-device sync settings' : 'No internet connection — working offline on local cache'}
            >
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span className="text-[11px] font-bold tracking-tight">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </button>

            {/* Staff Operator Pill & Quick Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDesktopStaffDropdown(prev => !prev)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                  currentStaff
                    ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                    : 'bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 border-blue-200/80 dark:border-blue-800/60'
                }`}
                title={currentStaff ? `Staff Operator: ${currentStaff.name}` : `Owner: ${currentUser.name} (Full Access)`}
              >
                <div 
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0"
                  style={{ backgroundColor: currentStaff ? (currentStaff.avatarColor || '#2563eb') : '#2563eb' }}
                >
                  {currentStaff ? (currentStaff.name.slice(0, 1) || 'S') : '👑'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                    {currentStaff ? currentStaff.name.split(' ')[0] : (currentUser.name?.split(' ')[0] || 'Owner')}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize block leading-none font-medium">
                    {currentStaff ? `${currentStaff.role.replace(/_/g, ' ')} • PIN: ${currentStaff.pin}` : 'Owner • Full Access'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showDesktopStaffDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-68 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2.5 z-50 text-xs space-y-2">
                  <div className="px-1.5 py-1">
                    {currentStaff ? (
                      <>
                        <span className="text-3xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          Active Operator (Staff PIN View):
                        </span>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {currentStaff.name}
                        </p>
                        <p className="text-3xs text-slate-500">
                          {currentStaff.role} • PIN: {currentStaff.pin}
                        </p>
                        <button
                          onClick={() => {
                            logoutStaff();
                            setShowDesktopStaffDropdown(false);
                          }}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <span>👑 Return to Owner Mode (Full Access)</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 mb-0.5 text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-3xs font-black uppercase tracking-wider">Owner Session Active</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {currentUser.name}
                        </p>
                        <p className="text-3xs text-slate-500">
                          {currentUser.email || 'Owner Account'} • Full Unrestricted Access
                        </p>
                      </>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <p className="text-3xs font-black text-slate-400 dark:text-slate-500 uppercase px-1 pb-1">
                      Switch Staff Operator:
                    </p>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {staffMembers.map(staff => (
                        <button
                          key={staff.id}
                          onClick={() => {
                            switchActiveStaffByPin(staff.pin);
                            setShowDesktopStaffDropdown(false);
                          }}
                          className={`w-full text-left p-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                            currentStaff?.id === staff.id
                              ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span 
                                className="w-2 h-2 rounded-full shrink-0" 
                                style={{ backgroundColor: staff.avatarColor || '#2563eb' }} 
                              />
                              <span className="font-bold truncate">{staff.name}</span>
                            </div>
                            <span className="text-3xs text-slate-400 block truncate ml-3.5">
                              {staff.role}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                            {staff.pin}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      onClick={async () => {
                        await resetStaffData();
                        setShowDesktopStaffDropdown(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                      title="Reset staff data back to clean defaults"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset Staff Data (Defaults)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => setDarkMode && setDarkMode(!darkMode)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Inventory Alerts */}
            {activeNotificationsCount > 0 && (!activeStaffUser || activeStaffUser.permissions?.canAccessInventory) && (
              <button 
                onClick={() => handleSelectNav('inventory')}
                className="flex items-center gap-1 px-2 py-1 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 rounded-md text-xs font-medium"
                title="Inventory Alerts"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{activeNotificationsCount} alerts</span>
              </button>
            )}

            {/* Refresh App & Check for Updates (All Users: Live + Desktop) */}
            <button
              type="button"
              onClick={handleRefreshApp}
              disabled={isRefreshingApp}
              title="Refresh App & Check for Updates"
              aria-label="Refresh App & Check for Updates"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApp ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            </button>

            {/* Header Sign Out Action */}
            <button
              onClick={logout}
              title="Sign Out of Quick IMS"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Primary Content View */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'pos', label: 'POS', icon: ShoppingCart },
          { id: 'kds', label: 'KDS', icon: ChefHat, badge: activeKDSCount },
          { id: 'bot', label: 'BOT', icon: Wine, badge: activeBOTCount },
          { id: 'more', label: 'More', icon: Menu, isMenu: true }
        ]
        .filter(tab => tab.isMenu || isTabAllowedForStaff(tab.id))
        .map(tab => {
          const Icon = tab.icon;
          const isActive = selectedTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.isMenu) {
                  setMobileMenuOpen(true);
                } else {
                  handleSelectNav(tab.id);
                }
              }}
              className={`flex flex-col items-center justify-center px-2 py-0.5 rounded-md transition-colors ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400 font-bold' 
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full text-3xs font-bold w-3.5 h-3.5 flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-3xs mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Search Modal */}
      {showSearchModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-start justify-center pt-16 px-3"
          onClick={() => setShowSearchModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 ml-1" />
              <input
                autoFocus
                type="text"
                placeholder="Search products, SKU, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-100 outline-hidden font-medium placeholder:text-slate-400"
              />
              <button 
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 max-h-80 overflow-y-auto space-y-1 text-xs">
              {searchQuery ? (
                <>
                  {products
                    .filter(p => {
                      const q = String(searchQuery || '').toLowerCase();
                      return String(p.name || '').toLowerCase().includes(q) || 
                             String(p.sku || '').toLowerCase().includes(q) || 
                             String(p.barcode || '').includes(searchQuery);
                    })
                    .slice(0, 6)
                    .map(p => (
                      <div 
                        key={p.id}
                        onClick={() => {
                          handleSelectNav('products');
                          setShowSearchModal(false);
                        }}
                        className="p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                          <p className="text-2xs text-slate-500 font-mono">
                            SKU: {p.sku} • Stock: {p.currentStock} {p.baseUnit}
                          </p>
                        </div>
                        <span className="font-medium text-blue-600 dark:text-blue-400">Rs. {p.retailPrice}</span>
                      </div>
                    ))}
                </>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Type any product name or SKU to search.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Device Live Sync Channel Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Multi-Device Live Sync Channel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every device (waiter smartphone, ordering tablet, cashier POS, and kitchen KDS display) using this Sync Channel receives instant bi-directional updates for table orders, draft carts, and tickets.
            </p>

            {/* Current Sync Channel Box */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-black uppercase text-slate-400 tracking-wider">Current Sync Channel</span>
                <span className="text-3xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {restaurantId}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(restaurantId);
                    setCopiedSyncCode(true);
                    setTimeout(() => setCopiedSyncCode(false), 2500);
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                >
                  {copiedSyncCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Code
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Switch / Pair Device to Different Restaurant */}
            <div className="space-y-2 pt-1">
              <label className="text-2xs font-bold text-slate-700 dark:text-slate-300 block">
                Pair this device to another restaurant or terminal:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Paste Restaurant Sync Code..."
                  value={customSyncInput}
                  onChange={(e) => setCustomSyncInput(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customSyncInput.trim()) {
                      setRestaurantSyncChannel(customSyncInput.trim());
                      setShowSyncModal(false);
                    }
                  }}
                  disabled={!customSyncInput.trim() || customSyncInput.trim() === restaurantId}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>

            {/* Live Metrics */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-3xs text-slate-400 uppercase font-black block">Live Tables</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{diningTables.length} Active</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-3xs text-slate-400 uppercase font-black block">Active KOT/BOT</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{activeKDSCount + activeBOTCount} In Queue</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
};
