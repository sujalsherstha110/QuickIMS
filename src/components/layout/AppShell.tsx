import React, { useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Truck, Boxes, Receipt, 
  Users, Building2, BarChart3, Settings, AlertCircle, ChevronDown, 
  Menu, X, Sun, Moon, Search, Plus, Bell, RefreshCw, FileText,
  FileSpreadsheet, DollarSign, ArrowUpRight, ArrowDownRight, Warehouse as WarehouseIcon
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toNepaliBSDate, formatNPR } from '../../utils/nepalFormatters';

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
  const handleQuickSale = () => {
    if (onOpenQuickSale) {
      onOpenQuickSale();
    } else {
      handleTabChange('pos');
    }
  };

  const { 
    currentUser, setCurrentUser, settings, warehouses, 
    currentWarehouseId, setCurrentWarehouseId, activeNotificationsCount,
    resetToDemoData, products
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'POS / New Sale', icon: ShoppingCart, highlight: true },
    { id: 'products', label: 'Products & Catalog', icon: Boxes },
    { id: 'inventory', label: 'Inventory & Stock', icon: WarehouseIcon },
    { id: 'purchases', label: 'Purchases & Entry', icon: Truck },
    { id: 'invoice-reports', label: 'Invoice Report', icon: FileText },
    { id: 'bill-reports', label: 'Bill Report', icon: FileSpreadsheet },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'suppliers', label: 'Suppliers', icon: Building2 },
    { id: 'accounting', label: 'Accounting & Cash', icon: Receipt },
    { id: 'reports', label: 'Tax & VAT Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const lowStockCount = products.filter(p => p.currentStock <= p.reorderLevel).length;

  const handleSelectNav = (tabId: string) => {
    handleTabChange(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased ${darkMode ? 'dark' : ''}`}>
      
      {/* Top Header for Mobile */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              Q
            </div>
            <div>
              <span className="font-bold text-base tracking-tight">Quick IMS</span>
              <span className="text-2xs block text-slate-500 font-mono">Hardware & Sanitary</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickSale}
            className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> POS
          </button>
        </div>
      </header>

      {/* Sidebar Navigation (Desktop + Mobile Drawer) */}
      <aside 
        className={`fixed md:sticky top-0 left-0 bottom-0 z-40 w-64 md:w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-500/20">
              Q
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight text-base flex items-center gap-1.5">
                Quick IMS
                <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 text-3xs font-mono rounded border border-indigo-500/30">v2.4</span>
              </h1>
              <p className="text-2xs text-slate-400 truncate max-w-[130px]" title={settings.companyName}>
                Hardware & Sanitary
              </p>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Branch / Warehouse Switcher */}
        <div className="px-3 pt-3 pb-1">
          <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
            <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              <span>Active Godown / Branch</span>
              <span className="text-emerald-400 font-mono">Live</span>
            </div>
            <select
              value={currentWarehouseId}
              onChange={(e) => setCurrentWarehouseId(e.target.value)}
              className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1.5 outline-hidden focus:border-indigo-500"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Sale CTA Button */}
        <div className="px-3 py-2">
          <button
            onClick={() => handleSelectNav('pos')}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Fast Billing / POS (F2)</span>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {navigationItems.map(item => {
            const Icon = item.icon;
            const isActive = selectedTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'inventory' && lowStockCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-3xs font-bold rounded-full">
                    {lowStockCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Role Card & Nepali Calendar Display */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60">
          <div className="text-2xs text-slate-400 mb-2 flex items-center justify-between font-mono">
            <span>{toNepaliBSDate(new Date())}</span>
            <span className="text-indigo-400 font-bold">{settings.fiscalYear}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left transition-all"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-white truncate">{currentUser.name}</p>
                  <p className="text-3xs text-slate-400 uppercase tracking-wider">{currentUser.role.replace('_', ' ')}</p>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showRoleSwitcher && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 z-50 text-xs">
                <p className="text-3xs font-semibold uppercase text-slate-400 px-2 py-1">Switch Role Demo:</p>
                {[
                  { role: 'super_admin', name: 'Sujal Shrestha (Owner)' },
                  { role: 'sales', name: 'Prakash Maharjan (Sales Counter)' },
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
                    className={`w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-2xs flex items-center justify-between ${
                      currentUser.role === r.role ? 'text-indigo-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <span>{r.name}</span>
                    <span className="text-3xs text-slate-400">({r.role})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Desktop Top Navbar */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-2xs">
          
          {/* Breadcrumb / Section Name */}
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              {navigationItems.find(n => n.id === selectedTab)?.label || 'Quick IMS'}
            </h2>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {settings.companyName}
            </span>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-3">
            {/* Global Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search Invoice #, Product SKU, Customer (Press /)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchModal(true)}
                className="w-72 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg pl-8 pr-3 py-1.5 outline-hidden focus:border-indigo-500 dark:focus:border-indigo-400 text-slate-800 dark:text-slate-200"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            {/* Quick Demo Reset */}
            <button
              onClick={() => {
                if (window.confirm('Reset all demo records back to clean initial dataset?')) {
                  resetToDemoData();
                }
              }}
              title="Reset Sample Data"
              className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => setDarkMode && setDarkMode(!darkMode)}
              className="p-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Notifications Indicator */}
            <div className="relative">
              <button 
                onClick={() => handleSelectNav('inventory')}
                className="p-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 relative"
              >
                <Bell className="w-4 h-4" />
                {activeNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-3xs font-bold flex items-center justify-center">
                    {activeNotificationsCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Active View Container */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Search Modal Overlay if open */}
      {showSearchModal && searchQuery && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-start justify-center pt-20 px-4"
          onClick={() => setShowSearchModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-xl p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Quick Global Search Results</span>
              <button onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-2 max-h-80 overflow-y-auto space-y-1 text-xs">
              <p className="text-2xs font-semibold text-slate-400 uppercase mt-2">Matching Products:</p>
              {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map(p => (
                <div 
                  key={p.id}
                  onClick={() => {
                    handleSelectNav('products');
                    setShowSearchModal(false);
                  }}
                  className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                    <p className="text-2xs text-slate-500 font-mono">SKU: {p.sku} | Stock: {p.currentStock} {p.baseUnit}</p>
                  </div>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatNPR(p.retailPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
