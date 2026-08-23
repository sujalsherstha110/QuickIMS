import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, Building, ShieldCheck, 
  Receipt, Save, CheckCircle2, User, Database, RefreshCw,
  Warehouse as WarehouseIcon, FileText, Download, Phone, MapPin, Tag
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CompanySettings } from '../../types';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, warehouses, currentUser, resetToDemoData } = useApp();

  const [form, setForm] = useState<CompanySettings>({
    ...settings,
    address: { ...settings.address }
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'tax' | 'roles' | 'warehouses' | 'system'>('profile');

  const demoStaffMembers = [
    { id: 'usr-1', name: 'Sujal Shrestha', email: 'sujal@himalayanhardware.com.np', role: 'Super Admin', contact: '+977-9851098765', status: 'Active' },
    { id: 'usr-2', name: 'Prakash Maharjan', email: 'prakash.sales@himalayanhardware.com.np', role: 'Sales Counter', contact: '+977-9841334455', status: 'Active' },
    { id: 'usr-3', name: 'Bikram Thapa', email: 'bikram.stock@himalayanhardware.com.np', role: 'Storekeeper (Godown)', contact: '+977-9841234567', status: 'Active' },
    { id: 'usr-4', name: 'Binod Sharma', email: 'binod.accounts@himalayanhardware.com.np', role: 'Accountant', contact: '+977-9801122334', status: 'Active' },
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
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-lg">
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
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
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
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>VAT & Invoicing</span>
        </button>

        <button
          onClick={() => setActiveSubTab('roles')}
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'roles'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
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
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
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
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
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
              <Building className="w-4 h-4 text-indigo-600" />
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
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
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
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Current Fiscal Year (आर्थिक वर्ष)</label>
                <input
                  type="text"
                  value={form.fiscalYear}
                  onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

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
            </div>
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
              <span className="text-3xs text-indigo-600 font-mono font-bold bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                Active Session: {currentUser.name} ({currentUser.role})
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {demoStaffMembers.map(u => (
                <div key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
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
                      <span className="text-3xs px-1.5 py-0.2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/80 dark:text-indigo-300 font-bold rounded">
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

        {/* SUBTAB 5: SYSTEM & DATA BACKUP */}
        {activeSubTab === 'system' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Database className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                System Backup & Data Operations
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-600" /> Export System Backup
                </h4>
                <p className="text-3xs text-slate-500">
                  Export complete business configuration and tax profile as a portable JSON file.
                </p>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-2xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download JSON Backup
                </button>
              </div>

              <div className="p-4 border border-rose-200 dark:border-rose-900/60 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 space-y-2">
                <h4 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Reset Sample Dataset
                </h4>
                <p className="text-3xs text-rose-600 dark:text-rose-400">
                  Restore all sample inventory, customers, sales invoices, and ledger records to the clean initial demo state.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset all demo records back to initial hardware inventory dataset?')) {
                      resetToDemoData();
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-2xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Restore Fresh Sample Data
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
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-2 shadow-xs transition-all text-xs"
          >
            <Save className="w-4 h-4" /> Save Business Configuration
          </button>
        </div>

      </form>
    </div>
  );
};

