import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Truck, Boxes, Receipt, 
  Users, Building2, BarChart3, Settings, ChevronDown, 
  Menu, X, Sun, Moon, Search, Plus, Bell, RefreshCw, FileText,
  FileSpreadsheet, Warehouse as WarehouseIcon, Wifi, WifiOff,
  Download, CheckCircle2, ChevronRight, Layers, ArrowUpRight
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
    resetToDemoData, products
  } = useApp();

  const { isOnline, isInstallable, promptInstall } = usePWA();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
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

  // Logical Nav Groups
  const navSections = [
    {
      groupTitle: 'Core',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
      ]
    },
    {
      groupTitle: 'Inventory',
      items: [
        { id: 'products', label: 'Products', icon: Boxes },
        { id: 'inventory', label: 'Stock & Godowns', icon: WarehouseIcon },
        { id: 'purchases', label: 'Purchases', icon: Truck },
      ]
    },
    {
      groupTitle: 'Sales & Contacts',
      items: [
        { id: 'invoice-reports', label: 'Invoices', icon: FileText },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'suppliers', label: 'Suppliers', icon: Building2 },
      ]
    },
    {
      groupTitle: 'Finance & Setup',
      items: [
        { id: 'accounting', label: 'Accounting', icon: Receipt },
        { id: 'reports', label: 'Tax & VAT', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  const lowStockCount = products.filter(p => p.currentStock <= p.reorderLevel).length;

  const handleSelectNav = (tabId: string) => {
    handleTabChange(tabId);
    setMobileMenuOpen(false);
  };

  const allItems = navSections.flatMap(s => s.items);
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
      <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            Q
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
          
          <span 
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-amber-500'}`} 
            title={isOnline ? 'System Online' : 'Offline Mode'}
          />
        </div>
      </header>

      {/* DESKTOP SIDEBAR - Clean, professional, uncluttered */}
      <aside className="hidden md:flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 h-screen z-30">
        
        {/* Brand & Warehouse Select */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                Q
              </div>
              <div>
                <h1 className="font-semibold text-xs tracking-tight text-slate-900 dark:text-slate-100">
                  Quick IMS
                </h1>
                <p className="text-2xs text-slate-500 truncate max-w-[130px]" title={settings.companyName}>
                  {settings.companyName}
                </p>
              </div>
            </div>
            
            {/* Status dot */}
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

        {/* Clean Categorized Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-2.5 py-1 text-3xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {section.groupTitle}
              </div>
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = selectedTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.id === 'inventory' && lowStockCount > 0 && (
                      <span className="text-3xs font-medium bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">
                        {lowStockCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative">
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="w-full flex items-center justify-between p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-2xs font-semibold flex items-center justify-center">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{currentUser.name}</p>
                  <p className="text-3xs text-slate-500 capitalize">{currentUser.role.replace('_', ' ')}</p>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            </button>

            {showRoleSwitcher && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg p-1.5 z-50 text-xs">
                <p className="text-3xs font-medium text-slate-400 px-2 py-1">Role Preview:</p>
                {[
                  { role: 'super_admin', name: 'Sujal Shrestha (Owner)' },
                  { role: 'sales', name: 'Prakash Maharjan (Counter)' },
                  { role: 'inventory', name: 'Bikram Thapa (Storekeeper)' },
                  { role: 'accountant', name: 'Binod Sharma (Accountant)' }
                ].map(r => (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentUser({
                        ...currentUser,
                        role: r.role as any,
                        name: r.name
                      });
                      setShowRoleSwitcher(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      currentUser.role === r.role 
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              {navSections.map((sec, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="px-2 text-3xs font-semibold text-slate-400 uppercase tracking-wider">
                    {sec.groupTitle}
                  </div>
                  {sec.items.map(item => {
                    const Icon = item.icon;
                    const isActive = selectedTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectNav(item.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-2xs text-slate-500">{toNepaliBSDate(new Date())}</span>
              <button
                onClick={() => setDarkMode && setDarkMode(!darkMode)}
                className="p-1.5 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
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
        <header className="hidden md:flex items-center justify-between px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
          <div className="flex items-center gap-3">
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
            {activeNotificationsCount > 0 && (
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
            <button
              onClick={() => {
                if (window.confirm('Reset sample records?')) {
                  resetToDemoData();
                }
              }}
              title="Reset Sample Data"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
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
          { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
          { id: 'pos', label: 'POS', icon: ShoppingCart },
          { id: 'inventory', label: 'Stock', icon: WarehouseIcon, badge: lowStockCount },
          { id: 'invoice-reports', label: 'Invoices', icon: FileText },
          { id: 'more', label: 'Menu', icon: Menu, isMenu: true }
        ].map(tab => {
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
