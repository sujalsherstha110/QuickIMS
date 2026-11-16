import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Building, ShieldCheck, 
  Receipt, Save, CheckCircle2, User, Database, RefreshCw,
  Warehouse as WarehouseIcon, FileText, Download, Phone, MapPin, Tag,
  Trash2, ShieldAlert, AlertTriangle, Check, Copy, Radio
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CompanySettings } from '../../types';
import { ReceiptLayoutEditor } from './ReceiptLayoutEditor';

export const SettingsView: React.FC = () => {
  const { 
    settings, updateSettings, warehouses, currentUser, 
    clearAllData, purgeAllLegacyFirestoreData, isSuperAdmin,
    restaurantId, setRestaurantSyncChannel, diningTables, kitchenTickets,
    products, adaptMenuToTaxInclusive
  } = useApp();

  const [form, setForm] = useState<CompanySettings>({
    ...settings,
    address: { ...settings.address }
  });

  useEffect(() => {
    setForm({
      ...settings,
      address: { ...settings.address }
    });
  }, [settings]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showPurgeConfirmModal, setShowPurgeConfirmModal] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [customSyncInput, setCustomSyncInput] = useState('');
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'tax' | 'receipt' | 'roles' | 'warehouses' | 'system'>('profile');
  const [isAdaptingMenuTax, setIsAdaptingMenuTax] = useState(false);
  const [menuTaxFeedback, setMenuTaxFeedback] = useState<string | null>(null);

  const handleAdaptMenuTaxInSettings = async () => {
    setIsAdaptingMenuTax(true);
    try {
      const res = await adaptMenuToTaxInclusive(true);
      setMenuTaxFeedback(`Successfully adapted all ${res.count} menu items to 13% Nepal VAT Inclusive!`);
      setTimeout(() => setMenuTaxFeedback(null), 5000);
    } catch (e: any) {
      setMenuTaxFeedback(`Failed to adapt menu items: ${e?.message || 'Error'}`);
    } finally {
      setIsAdaptingMenuTax(false);
    }
  };

  const demoStaffMembers = [
    { id: 'usr-1', name: 'General Manager', email: 'manager@quickims.np', role: 'General Manager', contact: '+977-9851098765', status: 'Active' },
    { id: 'usr-2', name: 'Floor Captain', email: 'floor@quickims.np', role: 'Floor Captain & Waitstaff', contact: '+977-9841334455', status: 'Active' },
    { id: 'usr-3', name: 'Executive Head Chef', email: 'kitchen@quickims.np', role: 'Executive Head Chef (KDS)', contact: '+977-9841234567', status: 'Active' },
    { id: 'usr-4', name: 'Beverage & Bar Lead', email: 'bar@quickims.np', role: 'Mixologist & Bar Lead', contact: '+977-9801122334', status: 'Active' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(form);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const backupData = {
      settings: form,
      timestamp: new Date().toISOString(),
      app: 'Quick IMS Nepal'
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickims_settings_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-lg">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              Business Settings & System Configuration
            </h1>
            <p className="text-2xs text-slate-500">
              Configure Nepal VAT (IRD) details, invoice branding, multi-warehouse defaults & staff permissions.
            </p>
          </div>
        </div>

        {saveSuccess && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4" /> Settings Saved!
          </span>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'profile'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Business Profile</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tax')}
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'tax'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>VAT & Invoicing</span>
        </button>

        <button
          onClick={() => setActiveSubTab('receipt')}
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'receipt'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 font-bold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-indigo-600" />
          <span>Receipt Layout 🎨</span>
        </button>

        <button
          onClick={() => setActiveSubTab('roles')}
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'roles'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Staff & Roles (RBAC)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('warehouses')}
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'warehouses'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <WarehouseIcon className="w-3.5 h-3.5" />
          <span>Godowns & Branches</span>
        </button>

        <button
          onClick={() => setActiveSubTab('system')}
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'system'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>System & Data</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        
        {/* SUBTAB 1: BUSINESS PROFILE */}
        {activeSubTab === 'profile' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Building className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Tax Registration & Store Profile
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Company / Store Name *</label>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">PAN Number *</label>
                <input
                  type="text"
                  required
                  value={form.panNumber}
                  onChange={(e) => setForm({ ...form, panNumber: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">VAT Registration Number</label>
                <input
                  type="text"
                  value={form.vatNumber || ''}
                  onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Landline Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Official Mobile / Hotline</label>
                <input
                  type="text"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Official Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Website URL</label>
                <input
                  type="text"
                  value={form.website || ''}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Business Tagline / Motto</label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
            </div>

            {/* Address Subgroup */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-2xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                Physical Store & Head Office Address
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-3xs font-semibold text-slate-500 mb-1">Province (प्रदेश)</label>
                  <input
                    type="text"
                    value={form.address.province}
                    onChange={(e) => setForm({ ...form, address: { ...form.address, province: e.target.value } })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-semibold text-slate-500 mb-1">District (जिल्ला)</label>
                  <input
                    type="text"
                    value={form.address.district}
                    onChange={(e) => setForm({ ...form, address: { ...form.address, district: e.target.value } })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-semibold text-slate-500 mb-1">Municipality (नगरपालिका)</label>
                  <input
                    type="text"
                    value={form.address.municipality}
                    onChange={(e) => setForm({ ...form, address: { ...form.address, municipality: e.target.value } })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-semibold text-slate-500 mb-1">Ward No. (वडा नं.)</label>
                  <input
                    type="text"
                    value={form.address.ward}
                    onChange={(e) => setForm({ ...form, address: { ...form.address, ward: e.target.value } })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-3xs font-semibold text-slate-500 mb-1">Street / Chowk / Tole (सडक/टोल)</label>
                  <input
                    type="text"
                    value={form.address.street}
                    onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: VAT & INVOICING */}
        {activeSubTab === 'tax' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Tax, Billing & Invoice Numbering Rules (आन्तरिक राजस्व निर्देशिका)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Standard Nepal VAT Rate (%)</label>
                <input
                  type="number"
                  value={form.defaultVatRate}
                  onChange={(e) => setForm({ ...form, defaultVatRate: parseFloat(e.target.value) || 13 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Menu Pricing Tax Policy</label>
                <select
                  value={form.taxInclusivePricing !== false ? 'inclusive' : 'exclusive'}
                  onChange={(e) => setForm({ ...form, taxInclusivePricing: e.target.value === 'inclusive' })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-medium"
                >
                  <option value="inclusive">Tax-Inclusive (Menu prices include 13% VAT)</option>
                  <option value="exclusive">Tax-Exclusive (Add 13% VAT at checkout)</option>
                </select>
                <p className="mt-1 text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Standard Nepal Restaurant Practice
                </p>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Current Fiscal Year (आर्थिक वर्ष)</label>
                <input
                  type="text"
                  value={form.fiscalYear}
                  onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            {/* Existing Menu Items Adaptation Panel */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Adapt Existing Menu Items to 13% VAT Inclusive</span>
                  </h4>
                  <p className="text-2xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Ensures all {products.length} menu dishes in the database are marked with 13% VAT included in their retail price, preventing double-taxation at POS checkout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAdaptMenuTaxInSettings}
                  disabled={isAdaptingMenuTax}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAdaptingMenuTax ? 'animate-spin' : ''}`} />
                  <span>{isAdaptingMenuTax ? 'Adapting Menu...' : 'Adapt All Existing Dishes Now'}</span>
                </button>
              </div>

              {menuTaxFeedback && (
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  {menuTaxFeedback}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Default Low Stock Reorder Threshold</label>
                <input
                  type="number"
                  value={form.lowStockThresholdDefault}
                  onChange={(e) => setForm({ ...form, lowStockThresholdDefault: parseInt(e.target.value, 10) || 10 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Sales Invoice Prefix</label>
                <input
                  type="text"
                  value={form.invoicePrefix}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Purchase Bill Prefix</label>
                <input
                  type="text"
                  value={form.purchasePrefix}
                  onChange={(e) => setForm({ ...form, purchasePrefix: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Quotation (कोटेशन) Prefix</label>
                <input
                  type="text"
                  value={form.quotePrefix}
                  onChange={(e) => setForm({ ...form, quotePrefix: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Invoice Footer Disclaimer / Warranty Policy</label>
                <input
                  type="text"
                  value={form.invoiceFooterMessage}
                  onChange={(e) => setForm({ ...form, invoiceFooterMessage: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Terms & Conditions on Bill (सर्त तथा नियमहरू)</label>
                <textarea
                  rows={2}
                  value={form.termsAndConditions}
                  onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-sans"
                />
              </div>

              {/* Quick Link Card to Receipt Layout Editor */}
              <div className="sm:col-span-3 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>Thermal Receipt &amp; Printout Layout Editor</span>
                      <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        Zero Cutoff
                      </span>
                    </h4>
                    <p className="text-3xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Calibrate printable line width, right safety padding, fonts, divider line styles, and toggle sections on/off.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('receipt')}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition-all shadow-xs shrink-0 flex items-center gap-1.5"
                >
                  <span>Open Layout Editor 🎨</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB: RECEIPT & PRINTOUT LAYOUT EDITOR */}
        {activeSubTab === 'receipt' && (
          <div className="space-y-4">
            <ReceiptLayoutEditor />
          </div>
        )}

        {/* SUBTAB 3: STAFF & ROLES (RBAC) */}
        {activeSubTab === 'roles' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Staff & User Access Control (भूमिका तथा अधिकार)
                </h3>
              </div>
              <span className="text-3xs text-blue-600 font-mono font-bold bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                Active Session: {currentUser.name} ({currentUser.role})
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {demoStaffMembers.map(u => (
                <div key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{u.name}</span>
                      <div className="flex items-center gap-3 text-3xs text-slate-400 font-mono">
                        <span>{u.email}</span>
                        <span>•</span>
                        <span>{u.contact}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-3xs uppercase font-bold font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {u.role}
                    </span>
                    <span className="text-3xs px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 font-semibold rounded">
                      {u.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 4: GODOWNS & BRANCHES */}
        {activeSubTab === 'warehouses' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <WarehouseIcon className="w-4 h-4 text-sky-500" />
              <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Registered Godowns & Showrooms (गोदाम तथा शाखा)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {warehouses.map(w => (
                <div key={w.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{w.name}</span>
                    {w.isMain && (
                      <span className="text-3xs px-1.5 py-0.2 bg-blue-100 text-blue-700 dark:bg-blue-900/80 dark:text-blue-300 font-bold rounded">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-3xs text-slate-500 font-mono">{w.code}</p>
                  <p className="text-3xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" /> {w.location}
                  </p>
                  <p className="text-3xs text-slate-500">In-charge: {w.managerName} ({w.contact})</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notification Banner */}
        {actionNotice && (
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionNotice.type === 'danger'
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}>
            <div className="flex items-center gap-2">
              {actionNotice.type === 'danger' ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              <span>{actionNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-xs hover:opacity-75 cursor-pointer ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SUBTAB 5: SYSTEM & DATA BACKUP */}
        {activeSubTab === 'system' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Database className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                System Backup & Data Operations
              </h3>
            </div>

            {/* Multi-Device Live Synchronization Channel */}
            <div className="p-4 border border-emerald-300 dark:border-emerald-800/80 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                    Multi-Device Live Sync Channel
                  </h4>
                </div>
                <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  REAL-TIME ACTIVE
                </span>
              </div>
              <p className="text-3xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Connect multiple terminals, waiter smartphones, floor tablets, and kitchen KDS displays to the same restaurant. Any order taken, table seated, draft order modified, or bill settled updates every screen in real-time.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs">
                  <span className="text-3xs font-bold uppercase text-slate-400 shrink-0">Channel ID:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{restaurantId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(restaurantId);
                    setCopiedSyncCode(true);
                    setTimeout(() => setCopiedSyncCode(false), 2500);
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors shadow-2xs"
                >
                  {copiedSyncCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" /> Copied Code!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Sync Channel
                    </>
                  )}
                </button>
              </div>

              {/* Pair Device to Another Sync Channel */}
              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Pair to another restaurant Sync Code..."
                  value={customSyncInput}
                  onChange={(e) => setCustomSyncInput(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customSyncInput.trim()) {
                      setRestaurantSyncChannel(customSyncInput.trim());
                      setActionNotice({
                        message: `Switched device sync channel to "${customSyncInput.trim()}". All tables and orders are now synchronized with this channel.`,
                        type: 'success'
                      });
                      setCustomSyncInput('');
                    }
                  }}
                  disabled={!customSyncInput.trim() || customSyncInput.trim() === restaurantId}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                >
                  Pair Device
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Export JSON */}
              <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-xs">
                  <Download className="w-4 h-4 text-blue-600" /> Export System Backup
                </h4>
                <p className="text-3xs text-slate-500">
                  Export complete business configuration and tax profile as a portable JSON file.
                </p>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-2xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download JSON Backup
                </button>
              </div>

              {/* Card 2: Wipe All Data */}
              <div className="p-4 border border-rose-300 dark:border-rose-900 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 space-y-2">
                <h4 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2 text-xs">
                  <Trash2 className="w-4 h-4 text-rose-600" /> Wipe All Application Data
                </h4>
                <p className="text-3xs text-rose-600 dark:text-rose-400">
                  Permanently remove all menu items, inventory products, guest bills, purchase orders, customers, and active tickets.
                </p>
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(true)}
                  disabled={isWiping}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-2xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {isWiping ? 'Wiping All Data...' : 'Remove All Data'}
                </button>
              </div>

              {/* Card 3: Purge Legacy Data & Database Reset */}
              <div className="p-4 border border-rose-200 dark:border-rose-900/60 rounded-xl bg-rose-50/30 dark:bg-rose-950/20 space-y-2">
                <h4 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2 text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600" /> Purge Cloud Legacy Mock Data
                </h4>
                <p className="text-3xs text-slate-500 dark:text-slate-400">
                  Permanently purge all legacy dummy dishes, mock staff records, and sample collections from Firestore to start with an authentic 100% clean production database.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPurgeConfirmModal(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-2xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Purge All Mock Data From Cloud
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Data Confirmation Modal */}
        {showClearConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Remove All Data?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will completely clear all products, menu items, sales invoices, guest tickets, purchases, customers, and expenses from both your local device and cloud database.
                </p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-2xs text-amber-800 dark:text-amber-300">
                ⚠️ All tables will be set to available with 0 active bills. You can immediately begin entering your genuine business records.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(false)}
                  disabled={isWiping}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isWiping}
                  onClick={async () => {
                    setIsWiping(true);
                    try {
                      await clearAllData();
                      setShowClearConfirmModal(false);
                      setActionNotice({
                        message: 'All records have been completely removed. System is clean and ready.',
                        type: 'success'
                      });
                    } finally {
                      setIsWiping(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isWiping ? 'Erasing Everything...' : 'Yes, Delete All Data'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Purge Cloud Legacy Mock Data Confirmation Modal */}
        {showPurgeConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Purge Cloud Legacy Mock Data?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Permanently wipe all legacy dummy dishes, mock staff records, and sample collections from the Firestore database. The database will be reset to an authentic 100% clean production state.
                </p>
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-2xs text-rose-800 dark:text-rose-300">
                ⚠️ This operation executes batch deletes directly on the cloud Firestore database. It cannot be undone.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurgeConfirmModal(false)}
                  disabled={isPurging}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPurging}
                  onClick={async () => {
                    setIsPurging(true);
                    try {
                      const res = await purgeAllLegacyFirestoreData();
                      setShowPurgeConfirmModal(false);
                      setActionNotice({
                        message: res.message,
                        type: res.success ? 'success' : 'danger'
                      });
                    } finally {
                      setIsPurging(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isPurging ? 'Purging Cloud Collections...' : 'Yes, Purge Cloud Database'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Save Button */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-3xs text-slate-400 font-mono">
            Fiscal Period: {form.fiscalYear} • VAT: {form.defaultVatRate}%
          </span>
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-2 shadow-xs transition-all text-xs"
          >
            <Save className="w-4 h-4" /> Save Business Configuration
          </button>
        </div>

      </form>
    </div>
  );
};

