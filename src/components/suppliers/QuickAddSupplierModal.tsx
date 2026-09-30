import React, { useState } from 'react';
import { X, Building2, User, Phone, MapPin, FileText, Plus, AlertTriangle, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Supplier, SupplierContactPerson } from '../../types';

interface QuickAddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierCreated?: (newSupplier: Supplier) => void;
}

export const QuickAddSupplierModal: React.FC<QuickAddSupplierModalProps> = ({
  isOpen,
  onClose,
  onSupplierCreated
}) => {
  const { addSupplier } = useApp();

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [additionalContacts, setAdditionalContacts] = useState<SupplierContactPerson[]>([]);
  const [panVatNumber, setPanVatNumber] = useState('');
  const [panVatType, setPanVatType] = useState<'PAN' | 'VAT'>('PAN');
  const [openingPayable, setOpeningPayable] = useState<number | ''>('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddContact = () => {
    setAdditionalContacts(prev => [...prev, { name: '', phone: '' }]);
  };

  const handleUpdateContact = (index: number, field: keyof SupplierContactPerson, value: string) => {
    setAdditionalContacts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveContact = (index: number) => {
    setAdditionalContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMsg('Please enter the supplier / company name.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Please enter a contact phone number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const randomCode = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const validAdditional = additionalContacts
        .map(c => ({ name: c.name.trim(), phone: c.phone.trim() }))
        .filter(c => c.name || c.phone);

      const allPhones = [
        phone.trim(),
        ...validAdditional.map(c => c.phone).filter(Boolean)
      ];

      const newSupplier = await addSupplier({
        supplierCode: randomCode,
        name: contactName.trim() || companyName.trim(),
        companyName: companyName.trim(),
        phone: allPhones.join(', '),
        additionalPhones: allPhones,
        additionalContacts: validAdditional,
        email: email.trim(),
        panVatNumber: panVatNumber.trim(),
        panVatType: panVatType,
        address: {
          province: 'Bagmati',
          district: address.trim() || 'Kathmandu',
          municipality: address.trim() || 'Kathmandu',
          street: address.trim() || 'Main Bazaar'
        },
        creditLimit: 1000000,
        currentBalance: Number(openingPayable) || 0,
        openingBalance: Number(openingPayable) || 0,
        bankDetails: {
          bankName: '',
          accountName: companyName.trim(),
          accountNumber: '',
          branch: ''
        },
        active: true,
        notes: notes.trim()
      });

      if (onSupplierCreated && newSupplier) {
        onSupplierCreated(newSupplier);
      }

      // Reset form
      setCompanyName('');
      setContactName('');
      setPhone('');
      setAdditionalContacts([]);
      setPanVatNumber('');
      setPanVatType('PAN');
      setOpeningPayable('');
      setAddress('');
      setEmail('');
      setNotes('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save new supplier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 sticky -top-6 bg-white dark:bg-slate-900 z-10 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Add New Supplier (साहु)
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Register a vendor / manufacturer to link with your inventory catalog
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Company / Supplier Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                placeholder="e.g. Panchakanya Group"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Primary Contact Person & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300">
                  Contact Person (साहु)
                </label>
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="text-3xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold hover:underline transition-all cursor-pointer"
                >
                  + Add
                </button>
              </div>
              <div className="relative">
                <User className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Contact Person Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300">
                  Phone / Mobile *
                </label>
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="text-3xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold hover:underline transition-all cursor-pointer"
                >
                  + Add
                </button>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. 9801234567 / 01-4234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden font-mono"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Additional Contacts (Name + Phone together, no role) */}
          {additionalContacts.length > 0 && (
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <User className="w-3 h-3" /> Additional Contacts ({additionalContacts.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="text-3xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  + Add Another
                </button>
              </div>

              <div className="space-y-2">
                {additionalContacts.map((contact, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex-1 relative">
                      <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Contact Person Name"
                        value={contact.name}
                        onChange={(e) => handleUpdateContact(idx, 'name', e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                    <div className="flex-1 relative">
                      <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Phone / Mobile"
                        value={contact.phone}
                        onChange={(e) => handleUpdateContact(idx, 'phone', e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-mono text-slate-900 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md transition-colors cursor-pointer shrink-0"
                      title="Remove Contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1 h-5">
                <label className="text-2xs font-semibold text-slate-700 dark:text-slate-300">
                  {panVatType} Number
                </label>
                {/* Compact, color-consistent toggle switch */}
                <div 
                  className="inline-flex items-center p-0.5 rounded bg-slate-200/80 dark:bg-slate-800 border border-slate-300/70 dark:border-slate-700 h-5"
                  role="group"
                  aria-label="Toggle PAN or VAT"
                >
                  <button
                    type="button"
                    onClick={() => setPanVatType('PAN')}
                    className={`px-1.5 h-4 flex items-center justify-center text-[9px] font-bold rounded-xs transition-all cursor-pointer ${
                      panVatType === 'PAN'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    PAN
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanVatType('VAT')}
                    className={`px-1.5 h-4 flex items-center justify-center text-[9px] font-bold rounded-xs transition-all cursor-pointer ${
                      panVatType === 'VAT'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    VAT
                  </button>
                </div>
              </div>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={`9-digit ${panVatType} (e.g. 300456789)`}
                  value={panVatNumber}
                  onChange={(e) => setPanVatNumber(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center mb-1 h-5">
                <label className="text-2xs font-semibold text-slate-700 dark:text-slate-300">
                  Opening Payable (साहु बाँकी)
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-3xs font-bold text-slate-400 font-mono">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={openingPayable}
                  onChange={(e) => setOpeningPayable(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full pl-8.5 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Address
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. Tripureshwor, Kathmandu"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="e.g. info@supplier.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes / Terms <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 30 days credit"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-hidden"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 sticky -bottom-6 bg-white dark:bg-slate-900 pb-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Add Supplier'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
