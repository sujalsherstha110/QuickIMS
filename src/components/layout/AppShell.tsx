import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Truck, Boxes, Receipt, 
  Users, Building2, BarChart3, Settings, ChevronDown, 
  Menu, X, Sun, Moon, Search, Plus, Bell, RefreshCw, FileText,
  FileSpreadsheet, Warehouse as WarehouseIcon, Wifi, WifiOff,
  Download, CheckCircle2, ChevronRight, Layers, ArrowUpRight, LogOut,
  Mail, UtensilsCrossed, ChefHat, Wine, BookOpen, AlertTriangle, PieChart,
  Printer
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
    resetToDemoData, products, kitchenTickets, logout, firebaseUser, isDemoSession,
    activeStaffUser, setActiveStaffUser, logoutStaff,
    staffMembers, activePOSStaff, switchActiveStaffByPin, resetStaffData
  } = useApp();

  const currentStaff = activeStaffUser || activePOSStaff;
  const permissions = currentStaff?.permissions;

  const { isOnline, isInstallable, promptInstall } = usePWA();

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
      if (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        handleTabChange('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live counts for Kitchen KDS, Bar BOT, and Low Stock Raw Ingredients
  const activeKDSCount = (kitchenTickets || []).filter(k => k.status === 'in_kitchen' || k.status === 'pending').length;
  const activeBOTCount = (kitchenTickets || []).filter(k => {
    if (k.status === 'completed' || k.status === 'cancelled') return false;
    return k.items.some(i => {
      const lower = (i.productName || '').toLowerCase();
      return i.course === 'beverage' || lower.includes('beer') || lower.includes('drink') || 
             lower.includes('cocktail') || lower.includes('tea') || lower.includes('coffee') || 
             lower.includes('wine') || lower.includes('mocktail') || lower.includes('juice');
    });
  }).length;
  const lowStockCount = products.filter(p => p.trackStock && p.currentStock <= p.reorderLevel).length;

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
        { id: 'waste', label: 'Food Waste / Control', icon: AlertTriangle, badge: null, tooltip: 'Spoilage, Waste Logging & Cost Variance' },
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
        { id: 'food-cost', label: 'Food Cost & Wastage', icon: PieChart, badge: null, tooltip: 'COGS & Kitchen Variance Analysis' },
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
    // Strictly derived from explicit permission grants of operator (NO role bypass!)
    if (!permissions) return false;

    switch (tabId) {
      case 'pos':
      case 'tables':
        return !!permissions.canPunchOrders;
      case 'floor-config':
        return !!permissions.canManageStaff;
      case 'kds':
        return !!permissions.canAccessKDS;
      case 'bot':
        return !!permissions.canAccessBOT;
      case 'products':
      case 'recipes':
      case 'inventory':
      case 'waste':
        return !!permissions.canAccessInventory;
      case 'dashboard':
      case 'reports':
      case 'vat-reports':
      case 'food-cost':
      case 'invoice-reports':
      case 'bill-reports':
      case 'purchases':
        return !!permissions.canViewReports;
      case 'staff':
        return !!permissions.canManageStaff;
      case 'customers':
      case 'suppliers':
        return !!permissions.canViewReports && !!permissions.canManageStaff;
      case 'accounting':
        return !!permissions.canOpenCashDrawer && !!permissions.canViewReports;
      case 'settings':
        return !!permissions.canManageStaff && !!permissions.canViewReports;
      default:
        return false;
    }
  };

  const visibleNavSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => isTabAllowedForStaff(item.id))
  })).filter(section => section.items.length > 0);

  // Auto redirect if current tab is not allowed for staff
  useEffect(() => {
    if (!isTabAllowedForStaff(selectedTab)) {
      const firstAllowed = visibleNavSections[0]?.items[0]?.id;
      if (firstAllowed) {
        handleTabChange(firstAllowed);
      }
    }
  }, [currentStaff, selectedTab, visibleNavSections]);

  const handleSelectNav = (tabId: string) => {
    handleTabChange(tabId);
    setMobileMenuOpen(false);
  };

  const allItems = visibleNavSections.flatMap(s => s.items);
  const activeNavLabel = allItems.find(n => n.id === selectedTab)?.label || 'Overview';

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased ${darkMode ? 'dark' : ''}`}>
      
      {/* Offline Alert Strip */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 sticky top-0 z-50">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Offline Mode — Changes are cached locally and will sync when reconnected.</span>
        </div>
      )}

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

          <div className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            🍽️
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
              Quick IMS
            </span>
            <span className="text-3xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200/50 dark:border-indigo-800/50">
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

          {/* Mobile Staff Operator Badge */}
          <button
            type="button"
            onClick={() => setShowDesktopStaffDropdown(prev => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-3xs font-bold cursor-pointer"
            title="Switch Staff Operator (Permissions Grant Testing)"
          >
            <span 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: currentStaff?.avatarColor || '#4f46e5' }} 
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
              className="w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0 cursor-pointer transition-transform hover:scale-105"
              title="Quick IMS (Click to expand sidebar)"
            >
              🍽️
            </button>
          </div>
        ) : (
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
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
              className="w-full bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 outline-hidden focus:border-indigo-500"
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
                    <span className="text-3xs font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                        aria-label={item.label}
                      >
                        <Icon className="w-5 h-5" />
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
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-all cursor-pointer group ${
                      isActive
                        ? 'bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1 rounded-md transition-colors ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-2xs' 
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs">{item.label}</span>
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
                className="w-10 h-10 rounded-full flex items-center justify-center hover:ring-2 hover:ring-indigo-500/50 transition-all cursor-pointer"
                title={activeStaffUser ? `Staff: ${activeStaffUser.name}` : `User: ${currentUser.name}`}
              >
                {activeStaffUser ? (
                  <div 
                    className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: activeStaffUser.avatarColor || '#4f46e5' }}
                  >
                    {activeStaffUser.name.charAt(0).toUpperCase()}
                  </div>
                ) : currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.name} 
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-indigo-500/30" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center">
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
                          <span className="text-3xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
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
                                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span 
                                className="w-2 h-2 rounded-full shrink-0" 
                                style={{ backgroundColor: staff.avatarColor || '#4f46e5' }} 
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
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
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
                      style={{ backgroundColor: activeStaffUser.avatarColor || '#4f46e5' }}
                    >
                      {activeStaffUser.name.charAt(0).toUpperCase()}
                    </div>
                  ) : currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.name} 
                      className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-indigo-500/30" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-2xs font-semibold flex items-center justify-center shrink-0">
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
                        <span className="text-3xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Active Operator
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {currentStaff?.name || currentUser.name}
                      </p>
                      <p className="text-3xs text-slate-500 truncate mt-0.5">
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
                              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span 
                              className="w-2 h-2 rounded-full shrink-0" 
                              style={{ backgroundColor: staff.avatarColor || '#4f46e5' }} 
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
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
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
                      <span className="text-3xs font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
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
                    className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-indigo-500/30" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center shrink-0">
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
            {/* Global Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search items, invoices (Press /)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchModal(true)}
                className="w-56 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-md pl-7 pr-3 py-1.5 outline-hidden focus:border-indigo-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            {/* Staff Operator Pill & Quick Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDesktopStaffDropdown(prev => !prev)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Switch Staff Operator (Permissions Grant Testing)"
              >
                <div 
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0"
                  style={{ backgroundColor: currentStaff?.avatarColor || '#4f46e5' }}
                >
                  {currentStaff?.name.slice(0, 1) || 'S'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                    {currentStaff?.name.split(' ')[0] || 'Staff'}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize block leading-none font-medium">
                    {currentStaff?.role.replace(/_/g, ' ') || 'Staff'} • PIN: {currentStaff?.pin}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showDesktopStaffDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2.5 z-50 text-xs space-y-2">
                  <div className="px-1.5 py-1">
                    <span className="text-3xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Active Operator (Permission Grant View):
                    </span>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {currentStaff?.name}
                    </p>
                    <p className="text-3xs text-slate-500">
                      {currentStaff?.role} • PIN: {currentStaff?.pin}
                    </p>
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
                              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span 
                                className="w-2 h-2 rounded-full shrink-0" 
                                style={{ backgroundColor: staff.avatarColor || '#4f46e5' }} 
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
                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
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

            {/* Reset Sample Data */}
            {!activeStaffUser && (
              <button
                onClick={() => {
                  if (window.confirm('Reset sample records?')) {
                    resetToDemoData();
                  }
                }}
                title="Reset Sample Data"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

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
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold' 
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
                    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery))
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
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">Rs. {p.retailPrice}</span>
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

    </div>
  );
};
