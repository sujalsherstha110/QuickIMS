import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, X, Check, Copy, ChefHat, Wine, Receipt, 
  ExternalLink, Download, FileText, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { Button } from './Button';
import { triggerThermalWindowPrint, createThermalPrintBlobUrl } from '../../utils/printerService';

export interface ThermalSlipItem {
  id: string;
  label: string;
  station: 'kitchen' | 'bar' | 'billing' | 'test';
  html: string;
  ticketNumber?: string;
}

interface ThermalSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ticketNumber?: string;
  htmlContent?: string;
  paperWidth?: '80mm' | '58mm';
  printerName?: string;
  tickets?: ThermalSlipItem[];
  autoPrintNotice?: string;
}

export const ThermalSlipModal: React.FC<ThermalSlipModalProps> = ({
  isOpen,
  onClose,
  title = 'Thermal Slip',
  ticketNumber,
  htmlContent = '',
  paperWidth = '80mm',
  printerName,
  tickets = [],
  autoPrintNotice
}) => {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Determine active HTML and metadata
  const hasMultiple = tickets.length > 0;
  const currentTicket = hasMultiple ? tickets[activeTabIdx] : null;
  const activeHtml = currentTicket ? currentTicket.html : htmlContent;
  const activeTitle = currentTicket ? currentTicket.label : title;
  const activeNumber = currentTicket?.ticketNumber || ticketNumber;

  // Create isolated blob URL for 100% reliable opening in a new clean tab outside iframe sandbox
  const blobUrl = useMemo(() => {
    if (!activeHtml) return '';
    try {
      return createThermalPrintBlobUrl(activeHtml);
    } catch {
      return '';
    }
  }, [activeHtml]);

  useEffect(() => {
    setActiveTabIdx(0);
    setPrintFeedback(null);
  }, [isOpen, tickets]);

  if (!isOpen || (!activeHtml && tickets.length === 0)) return null;

  const handleInPagePrint = async () => {
    setIsPrinting(true);
    setPrintFeedback(null);
    try {
      const success = await triggerThermalWindowPrint(activeHtml);
      if (success) {
        setPrintFeedback('Print dialog requested! If suppressed by browser, click "Open in New Tab ↗" below.');
      } else {
        setPrintFeedback('Direct print restricted by browser container. Please click "Open in New Tab ↗" for guaranteed printout.');
      }
    } catch (err: any) {
      console.warn('Print execution notice:', err);
      setPrintFeedback('Browser print blocked in iframe sandbox. Use "Open in New Tab ↗" button.');
    } finally {
      setTimeout(() => setIsPrinting(false), 600);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([activeHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeNumber || 'thermal-receipt'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Download error:', err);
    }
  };

  const handleCopyText = () => {
    try {
      const tempEl = document.createElement('div');
      tempEl.innerHTML = activeHtml;
      // Remove any script or no-print buttons from extracted text
      tempEl.querySelectorAll('script, .no-print, style').forEach(el => el.remove());
      const text = tempEl.innerText || tempEl.textContent || '';
      navigator.clipboard.writeText(text.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {activeTitle}
                </h3>
                {activeNumber && (
                  <span className="font-mono text-3xs font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {activeNumber}
                  </span>
                )}
              </div>
              <p className="text-3xs text-slate-500 dark:text-slate-400">
                Thermal Print Dispatch ({paperWidth}) • {printerName || 'POS Station'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MULTIPLE TICKET TABS (IF BOTH KITCHEN KOT & BAR BOT FIRED) */}
        {hasMultiple && tickets.length > 1 && (
          <div className="px-5 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
              {tickets.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTabIdx(idx);
                    setPrintFeedback(null);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-2xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTabIdx === idx
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {t.station === 'kitchen' ? (
                    <ChefHat className="w-3 h-3 text-blue-600" />
                  ) : t.station === 'bar' ? (
                    <Wine className="w-3 h-3 text-blue-600" />
                  ) : (
                    <Receipt className="w-3 h-3 text-blue-600" />
                  )}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AUTO-PRINT STATUS NOTICE */}
        {autoPrintNotice && (
          <div className="mx-4 mt-3 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-3xs font-bold flex items-center justify-between gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{autoPrintNotice}</span>
            </div>
            <span className="text-3xs uppercase font-mono px-1.5 py-0.5 rounded bg-blue-200/60 dark:bg-blue-900 text-blue-900 dark:text-blue-100 shrink-0">
              {paperWidth}
            </span>
          </div>
        )}

        {/* FEEDBACK NOTICE */}
        {printFeedback && (
          <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-3xs font-bold flex items-center gap-1.5 shrink-0 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{printFeedback}</span>
          </div>
        )}

        {/* THERMAL PAPER SLIP PREVIEW (SCROLLABLE & FULLY VISIBLE) */}
        <div className="p-4 flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950/60 flex justify-center">
          <div 
            className="w-full max-w-[320px] bg-white text-black p-4 rounded-xl shadow-lg border border-slate-300 font-mono text-[11px] leading-tight select-text"
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
              borderTop: '4px dashed #cbd5e1',
              borderBottom: '4px dashed #cbd5e1'
            }}
          >
            {/* Embedded Slip HTML rendered inside scoped container with responsive height */}
            <iframe
              srcDoc={activeHtml}
              title="Thermal Slip Preview"
              className="w-full border-none"
              style={{
                height: '420px',
                backgroundColor: '#ffffff'
              }}
            />
          </div>
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-2xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy receipt text to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-2xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download thermal slip HTML"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Save</span>
            </button>

            <button
              type="button"
              onClick={handleInPagePrint}
              disabled={isPrinting}
              className="px-3 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-2xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Attempt universal in-page print"
            >
              <Printer className={`w-3.5 h-3.5 text-blue-600 ${isPrinting ? 'animate-spin' : ''}`} />
              <span>Print Direct</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-2xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>

            {/* GUARANTEED 1-CLICK PRINT VIA STANDALONE CLEAN TAB OUTSIDE IFRAME */}
            {blobUrl ? (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all text-center justify-center shrink-0"
                title="Opens the slip in a clean tab outside sandbox where system print dialog triggers immediately"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print to Thermal Printer ↗</span>
              </a>
            ) : (
              <Button
                variant="primary-arrow"
                size="sm"
                onClick={handleInPagePrint}
                disabled={isPrinting}
                icon={<Printer className={`w-3.5 h-3.5 ${isPrinting ? 'animate-spin' : ''}`} />}
              >
                <span>{isPrinting ? 'Dispatching...' : 'Print Slip (Thermal)'}</span>
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
