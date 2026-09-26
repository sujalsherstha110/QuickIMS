import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Shield, Phone, Mail, Award, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';
import { StaffMember } from '../../types';
import { formatNPR } from '../../utils/nepalFormatters';

interface StaffBadgeModalProps {
  staff: StaffMember;
  isOpen: boolean;
  onClose: () => void;
}

export const StaffBadgeModal: React.FC<StaffBadgeModalProps> = ({ staff, isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !staff) return;
    const token = staff.qrToken || `STAFF-QR-${staff.employeeCode}-${staff.pin}`;
    QRCode.toDataURL(token, {
      width: 220,
      margin: 1,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Error generating QR', err));
  }, [isOpen, staff]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const roleLabel = staff.role.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Digital Staff ID Badge</h3>
              <p className="text-xs text-slate-500">Quick terminal scan & attendance pass</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badge Card Display (Print-ready styling) */}
        <div className="p-6 flex flex-col items-center">
          <div className="w-full max-w-[340px] bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-indigo-500/30">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-indigo-400/10 blur-xl pointer-events-none" />

            {/* Restaurant Logo Header */}
            <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white text-indigo-700 font-extrabold flex items-center justify-center text-sm shadow-md">
                  Q
                </div>
                <div>
                  <h4 className="font-extrabold text-sm tracking-wide">QUICK IMS</h4>
                  <p className="text-[10px] text-indigo-200 font-medium tracking-wider uppercase">Restro & Hospitality</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur-md font-semibold tracking-wider">
                {staff.employeeCode}
              </span>
            </div>

            {/* Profile Avatar and Name */}
            <div className="flex flex-col items-center text-center">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg border-2 border-white/40 mb-3 text-white"
                style={{ backgroundColor: staff.avatarColor || '#4f46e5' }}
              >
                {staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>

              <h2 className="text-xl font-black tracking-tight text-white">{staff.name}</h2>
              <div className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md">
                <Shield className="w-3.5 h-3.5 text-indigo-200" />
                <span>{roleLabel}</span>
              </div>
              <p className="text-xs text-indigo-200/90 mt-1 font-medium">{staff.department || 'Hospitality Floor'}</p>
            </div>

            {/* QR Code Container */}
            <div className="mt-5 bg-white p-3 rounded-2xl flex flex-col items-center shadow-inner">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Staff QR Pass" className="w-36 h-36 rounded-xl" />
              ) : (
                <div className="w-36 h-36 flex items-center justify-center text-slate-400 text-xs font-mono">
                  Generating QR...
                </div>
              )}
              <span className="text-[10px] font-mono text-slate-600 mt-1.5 font-bold tracking-widest">
                SCAN AT KIOSK TERMINAL
              </span>
            </div>

            {/* Bottom details */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-100/80">
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-indigo-300">Quick PIN</span>
                <span className="font-mono font-bold tracking-widest text-white">••••</span>
              </div>
              <div className="text-right">
                <span className="block text-[9px] uppercase tracking-wider text-indigo-300">Joined</span>
                <span className="font-medium text-white">{staff.joinedDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            PIN: <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">{staff.pin}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Pass
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
