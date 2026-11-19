import React, { useState } from 'react';
import { 
  Printer, X, Copy, Check, ChefHat, Wine, FileText, 
  ExternalLink, Sparkles, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { KitchenOrderTicket } from '../../types';
import { useApp } from '../../context/AppContext';
import { 
  generateKOTSlipHtml, 
  generateBOTSlipHtml, 
  executeThermalPrint,
  safeThermalWindowPrint 
} from '../../utils/printerService';
import { formatDate } from '../../utils/nepalFormatters';

interface ThermalSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  kitchenTicket?: KitchenOrderTicket | null;
  barTicket?: KitchenOrderTicket | null;
  initialStation?: 'kitchen' | 'bar';
}

export const ThermalSlipModal: React.FC<ThermalSlipModalProps> = ({
  isOpen,
  onClose,
  kitchenTicket,
  barTicket,
  initialStation = 'kitchen'
}) => {
  const { settings, printers } = useApp();

  const [activeStation, setActiveStation] = useState<'kitchen' | 'bar'>(() => {
    if (initialStation === 'bar' && barTicket) return 'bar';
    if (kitchenTicket) return 'kitchen';
    return barTicket ? 'bar' : 'kitchen';
  });

  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [isPrinting, setIsPrinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTicket = activeStation === 'kitchen' ? kitchenTicket : barTicket;
  const isKitchen = activeStation === 'kitchen';

  // Target printer configuration
  const targetPrinter = printers.find(p => 
    p.isActive && (p.station === activeStation || p.station === 'all')
  ) || printers[0] || {
    id: `prn-${activeStation}-sim`,
    name: isKitchen ? 'Kitchen Thermal Printer' : 'Bar Thermal Printer',
    station: activeStation,
    connectionType: 'universal' as const,
    paperWidth,
    isDefault: true,
    isActive: true,
    autoPrintKOT: isKitchen,
    autoPrintBOT: !isKitchen,
    autoPrintBill: false,
    copiesCount: 1
  };

  // Generate slip HTML for current ticket
  const slipHtml = currentTicket 
    ? (isKitchen 
        ? generateKOTSlipHtml(currentTicket, { ...targetPrinter, paperWidth }, settings)
        : generateBOTSlipHtml(currentTicket, { ...targetPrinter, paperWidth }, settings))
    : '';

  // Safe Isolated Print Execution (Uses silent Windows/TCP print in Desktop App)
  const handlePrintSlip = async () => {
    if (!currentTicket || !slipHtml) return;
    setIsPrinting(true);
    setStatusNotice('Dispatching to thermal printer...');

    try {
      const configuredPrinter = { ...targetPrinter, paperWidth };
      const res = await executeThermalPrint(
        slipHtml,
        configuredPrinter,
        { type: isKitchen ? 'kot' : 'bot', data: currentTicket, settings },
        { triggerNativePrint: true }
      );
      if (res.success) {
        setStatusNotice(`✓ ${res.message}`);
        setTimeout(() => setStatusNotice(null), 3000);
        return;
      }

      if (typeof window !== 'undefined' && window.quickimsDesktop?.isElectron) {
        setStatusNotice(res.message || 'Could not print slip. Check printer setup.');
        setTimeout(() => setStatusNotice(null), 4000);
        return;
      }

      const winSuccess = await safeThermalWindowPrint(slipHtml, paperWidth, configuredPrinter.driverName, configuredPrinter.copiesCount || 1);
      if (winSuccess) {
        setStatusNotice('✓ Thermal print dispatched');
      } else {
        setStatusNotice(res.message || 'Notice: Print prompt closed');
      }
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      console.warn('Slip printing error:', err);
      setStatusNotice('Failed to print slip. Please check printer settings.');
      setTimeout(() => setStatusNotice(null), 4000);
    } finally {
      setIsPrinting(false);
    }
  };

  // Copy plain text receipt to clipboard
  const handleCopyText = async () => {
    if (!currentTicket) return;
    try {
      const dateStr = formatDate(currentTicket.createdAt);
      const timeStr = new Date(currentTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const lines = [
        `================================`,
        `   ${settings.companyName.toUpperCase()}`,
        `   *** ${isKitchen ? 'KITCHEN ORDER TICKET (KOT)' : 'BAR ORDER TICKET (BOT)'} ***`,
        `================================`,
        `Ticket #: ${currentTicket.kotNumber}`,
        `Table:    Table ${currentTicket.tableNumber} (${currentTicket.zoneName || 'Floor'})`,
        `Server:   ${currentTicket.waiterName}`,
        `Guests:   ${currentTicket.guestsCount} Pax`,
        `Date:     ${dateStr}  ${timeStr}`,
        `--------------------------------`,
        `QTY   ITEM`,
        `--------------------------------`,
        ...currentTicket.items.map(i => {
          const modStr = i.selectedModifiers && i.selectedModifiers.length > 0 
            ? `\n      + ${i.selectedModifiers.map(m => m.optionName).join(', ')}` 
            : '';
          const noteStr = i.specialInstructions ? `\n      * Note: ${i.specialInstructions}` : '';
          return `${String(i.quantity).padEnd(5, ' ')} ${i.productName}${modStr}${noteStr}`;
        }),
        `--------------------------------`,
        currentTicket.notes ? `KITCHEN NOTES: ${currentTicket.notes}\n--------------------------------` : '',
        `STATUS: SENT TO ${isKitchen ? 'KITCHEN KDS' : 'BAR STATION'}`,
        `================================`
      ].filter(Boolean).join('\n');

      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy slip error:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white ${isKitchen ? 'bg-amber-600' : 'bg-blue-600'}`}>
              {isKitchen ? <ChefHat className="w-5 h-5" /> : <Wine className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Thermal {isKitchen ? 'KOT' : 'BOT'} Slip</span>
                {currentTicket && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {currentTicket.kotNumber}
                  </span>
                )}
              </h3>
              <p className="text-3xs text-slate-500">
                Safe thermal receipt printer simulator &amp; direct dispatcher
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Station Switcher (If both Kitchen and Bar tickets exist) */}
        {kitchenTicket && barTicket && (
          <div className="px-4 pt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveStation('kitchen')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                activeStation === 'kitchen'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Kitchen KOT ({kitchenTicket.kotNumber})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStation('bar')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                activeStation === 'bar'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200'
              }`}
            >
              <Wine className="w-3.5 h-3.5" />
              <span>Bar BOT ({barTicket.kotNumber})</span>
            </button>
          </div>
        )}

        {/* Paper Width & Format Controls */}
        <div className="px-4 py-2.5 flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <span className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Paper Roll:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-0.5 rounded-md text-3xs font-bold transition-all cursor-pointer ${
                  paperWidth === '80mm'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                80mm (Standard)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-0.5 rounded-md text-3xs font-bold transition-all cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                58mm (Compact)
              </button>
            </div>
          </div>

          <div className="text-3xs font-mono text-slate-500">
            Printer: <strong className="text-slate-700 dark:text-slate-300">{targetPrinter.name}</strong>
          </div>
        </div>

        {/* Thermal Slip Authentic Paper Container */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950 flex flex-col items-center">
          {statusNotice && (
            <div className="w-full max-w-sm mb-3 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{statusNotice}</span>
            </div>
          )}

          {!currentTicket ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs font-bold">No ticket selected to preview</p>
            </div>
          ) : (
            <div 
              className={`bg-white text-black p-4 rounded-xl shadow-lg border border-slate-300 font-mono text-left transition-all ${
                paperWidth === '58mm' ? 'w-[260px] text-xs' : 'w-[340px] text-sm'
              }`}
              style={{
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                borderTop: '6px dashed #cbd5e1'
              }}
            >
              {/* Receipt Header */}
              <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-black">
                <h4 className="font-black text-sm uppercase tracking-wide">
                  {settings.companyName || 'QUICKIMS RESTAURANT'}
                </h4>
                <div className="text-2xs font-extrabold bg-black text-white px-2 py-0.5 rounded inline-block">
                  *** {isKitchen ? 'KITCHEN ORDER TICKET (KOT)' : 'BAR ORDER TICKET (BOT)'} ***
                </div>
                <div className="text-xs font-black">
                  {currentTicket.kotNumber}
                </div>
              </div>

              {/* Order Meta Info */}
              <div className="py-2.5 space-y-1 text-xs border-b border-dashed border-black/60">
                <div className="flex justify-between font-black text-sm">
                  <span>TABLE: {currentTicket.tableNumber}</span>
                  <span className="font-semibold text-2xs uppercase">[{currentTicket.zoneName || 'Main'}]</span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span>Server: <strong>{currentTicket.waiterName}</strong></span>
                  <span>Guests: <strong>{currentTicket.guestsCount} Pax</strong></span>
                </div>
                <div className="flex justify-between text-2xs text-black/80 font-mono">
                  <span>{formatDate(currentTicket.createdAt)}</span>
                  <span>{new Date(currentTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="py-2.5">
                <div className="flex justify-between text-2xs font-black pb-1.5 border-b border-black">
                  <span className="w-12">QTY</span>
                  <span className="flex-1">ITEM DETAILS</span>
                </div>

                <div className="space-y-2 pt-2">
                  {currentTicket.items.map((item, idx) => (
                    <div key={idx} className="flex items-start text-xs">
                      <div className="w-12 font-black text-sm shrink-0">
                        {item.quantity}×
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold leading-snug">
                          {item.productName}
                        </div>
                        {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                          <div className="text-2xs text-black/80 italic mt-0.5">
                            + {item.selectedModifiers.map(m => m.optionName).join(', ')}
                          </div>
                        )}
                        {item.specialInstructions && (
                          <div className="text-2xs font-bold text-amber-900 bg-amber-50 px-1 py-0.5 rounded mt-0.5 inline-block">
                            * {item.specialInstructions}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions / Notes */}
              {currentTicket.notes && (
                <div className="py-2 border-t border-dashed border-black/80 text-2xs">
                  <strong className="block text-amber-900 font-extrabold uppercase">Order Notes:</strong>
                  <p className="italic">{currentTicket.notes}</p>
                </div>
              )}

              {/* Receipt Footer */}
              <div className="pt-3 border-t-2 border-dashed border-black text-center text-3xs space-y-1 text-black/70">
                <div className="font-bold">
                  *** DISPATCH TO {isKitchen ? 'KITCHEN CHEF' : 'BAR STATION'} ***
                </div>
                <div>Printed via QuickIMS Thermal POS Hub</div>
              </div>

              {/* Paper Jagged Tear Line */}
              <div 
                className="mt-3 pt-2 text-center text-slate-300 font-mono text-3xs select-none"
                style={{ borderBottom: '6px dashed #cbd5e1' }}
              >
                - - - - - - - - - - - - - - - - - - - - - -
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleCopyText}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copy plain receipt text"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Slip'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Done
            </button>

            <button
              type="button"
              onClick={handlePrintSlip}
              disabled={isPrinting || !currentTicket}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                isPrinting
                  ? 'bg-slate-400 cursor-not-allowed'
                  : isKitchen
                  ? 'bg-amber-600 hover:bg-amber-700 active:scale-98'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Printing...' : `Print ${isKitchen ? 'KOT' : 'BOT'} Slip`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
