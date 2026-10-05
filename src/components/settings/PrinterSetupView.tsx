import React, { useState } from 'react';
import { 
  Printer, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle, 
  Wifi, Bluetooth, Usb, Laptop, Check, X, 
  RefreshCw, ChefHat, Wine, Receipt, Eye, Sparkles, 
  SlidersHorizontal, Download, FileText, ArrowRight, RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { INITIAL_PRINTERS } from '../../data/restaurantInitialData';
import { 
  POSPrinterConfig, 
  PrinterConnectionType, 
  PrinterStationType, 
  PrinterPaperWidth,
  KitchenOrderTicket,
  SaleInvoice
} from '../../types';
import { 
  requestBluetoothPrinterDevice, 
  requestUsbPrinterDevice,
  generateKOTSlipHtml,
  generateBOTSlipHtml,
  generateBillReceiptSlipHtml,
  generateTestSlipHtml,
  executeThermalPrint
} from '../../utils/printerService';
import { formatNPR } from '../../utils/nepalFormatters';

export const PrinterSetupView: React.FC = () => {
  const { 
    printers, addPrinter, updatePrinter, deletePrinter, testPrinter, 
    settings, diningTables 
  } = useApp();

  const [stationFilter, setStationFilter] = useState<'all' | 'billing' | 'kitchen' | 'bar'>('all');
  const [activeModal, setActiveModal] = useState<{ mode: 'create' | 'edit'; printer?: POSPrinterConfig } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewSlipType, setPreviewSlipType] = useState<'kot' | 'bot' | 'bill' | 'test'>('kot');
  const [previewPaperWidth, setPreviewPaperWidth] = useState<PrinterPaperWidth>('80mm');

  // Form State
  const [formName, setFormName] = useState('');
  const [formStation, setFormStation] = useState<PrinterStationType>('billing');
  const [formConnectionType, setFormConnectionType] = useState<PrinterConnectionType>('universal');
  const [formIpAddress, setFormIpAddress] = useState('192.168.1.200');
  const [formPort, setFormPort] = useState(9100);
  const [formBluetoothName, setFormBluetoothName] = useState('');
  const [formUsbName, setFormUsbName] = useState('');
  const [formPaperWidth, setFormPaperWidth] = useState<PrinterPaperWidth>('80mm');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formAutoKOT, setFormAutoKOT] = useState(false);
  const [formAutoBOT, setFormAutoBOT] = useState(false);
  const [formAutoBill, setFormAutoBill] = useState(true);
  const [formCopies, setFormCopies] = useState(1);
  const [formHeaderCustom, setFormHeaderCustom] = useState('');
  const [formFooterCustom, setFormFooterCustom] = useState('');
  const [formShowQrCode, setFormShowQrCode] = useState(true);
  const [formKickDrawer, setFormKickDrawer] = useState(true);

  const openCreateModal = (defaultStation: PrinterStationType = 'billing') => {
    setFormName(
      defaultStation === 'kitchen' 
        ? 'Kitchen Line KOT Thermal Printer' 
        : defaultStation === 'bar' 
        ? 'Bar Dispense BOT Thermal Printer' 
        : 'Cashier Thermal Printer'
    );
    setFormStation(defaultStation);
    setFormConnectionType('universal');
    setFormIpAddress('192.168.1.200');
    setFormPort(9100);
    setFormBluetoothName('');
    setFormUsbName('');
    setFormPaperWidth('80mm');
    setFormIsDefault(true);
    setFormIsActive(true);
    setFormAutoKOT(defaultStation === 'kitchen');
    setFormAutoBOT(defaultStation === 'bar');
    setFormAutoBill(defaultStation === 'billing');
    setFormCopies(1);
    setFormHeaderCustom(
      defaultStation === 'kitchen' 
        ? '*** KITCHEN ORDER TICKET (KOT) ***' 
        : defaultStation === 'bar' 
        ? '*** BAR ORDER TICKET (BOT) ***' 
        : 'TAX INVOICE'
    );
    setFormFooterCustom(
      defaultStation === 'kitchen' 
        ? 'Dispatch dishes immediately upon preparation' 
        : defaultStation === 'bar' 
        ? 'Dispense chilled to table server' 
        : 'Thank you for dining with us! Visit again.'
    );
    setFormShowQrCode(defaultStation === 'billing');
    setFormKickDrawer(defaultStation === 'billing');
    setActiveModal({ mode: 'create' });
  };

  const openEditModal = (printer: POSPrinterConfig) => {
    setFormName(printer.name);
    setFormStation(printer.station);
    setFormConnectionType(printer.connectionType);
    setFormIpAddress(printer.ipAddress || '192.168.1.200');
    setFormPort(printer.port || 9100);
    setFormBluetoothName(printer.bluetoothDeviceName || '');
    setFormUsbName(printer.usbVendorId || '');
    setFormPaperWidth(printer.paperWidth);
    setFormIsDefault(printer.isDefault);
    setFormIsActive(printer.isActive);
    setFormAutoKOT(printer.autoPrintKOT);
    setFormAutoBOT(printer.autoPrintBOT);
    setFormAutoBill(printer.autoPrintBill);
    setFormCopies(printer.copiesCount || 1);
    setFormHeaderCustom(printer.headerCustomText || '');
    setFormFooterCustom(printer.footerCustomText || '');
    setFormShowQrCode(printer.showQrCode ?? true);
    setFormKickDrawer(printer.kickCashDrawer ?? true);
    setActiveModal({ mode: 'edit', printer });
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setToastNotice({ type: 'error', message: 'Printer name is required.' });
      return;
    }

    const payload: Omit<POSPrinterConfig, 'id'> = {
      name: formName.trim(),
      station: formStation,
      connectionType: formConnectionType,
      ipAddress: formConnectionType === 'network' ? formIpAddress : undefined,
      port: formConnectionType === 'network' ? formPort : undefined,
      bluetoothDeviceName: formConnectionType === 'bluetooth' ? formBluetoothName : undefined,
      usbVendorId: formConnectionType === 'usb' ? formUsbName : undefined,
      paperWidth: formPaperWidth,
      isDefault: formIsDefault,
      isActive: formIsActive,
      autoPrintKOT: formAutoKOT,
      autoPrintBOT: formAutoBOT,
      autoPrintBill: formAutoBill,
      copiesCount: formCopies,
      headerCustomText: formHeaderCustom.trim() || undefined,
      footerCustomText: formFooterCustom.trim() || undefined,
      showQrCode: formShowQrCode,
      kickCashDrawer: formKickDrawer
    };

    if (activeModal?.mode === 'create') {
      const created = await addPrinter(payload);
      setToastNotice({ type: 'success', message: `Added "${created.name}" successfully!` });
    } else if (activeModal?.mode === 'edit' && activeModal.printer) {
      await updatePrinter(activeModal.printer.id, payload);
      setToastNotice({ type: 'success', message: `Updated "${payload.name}" configuration!` });
    }

    setActiveModal(null);
  };

  const handleRunTest = async (printerId: string) => {
    setTestingId(printerId);
    const result = await testPrinter(printerId);
    setTestingId(null);
    setToastNotice({
      type: result.success ? 'success' : 'error',
      message: result.message
    });
  };

  const handleRestoreDefaults = async () => {
    for (const pr of INITIAL_PRINTERS) {
      const existing = printers.find(p => p.station === pr.station);
      if (!existing) {
        await addPrinter(pr);
      }
    }
    setToastNotice({
      type: 'success',
      message: 'Verified standard production printers (Cashier, Kitchen KOT, Bar BOT)!'
    });
  };

  const handleResetToDefaults = async () => {
    if (confirm('Reset all printer configurations to standard factory POS defaults (Kitchen KOT 80mm, Bar BOT 80mm, Cashier 80mm)?')) {
      for (const pr of printers) {
        await deletePrinter(pr.id);
      }
      for (const pr of INITIAL_PRINTERS) {
        await addPrinter(pr);
      }
      setToastNotice({
        type: 'success',
        message: 'Reset all printers to factory standard POS configuration!'
      });
    }
  };

  const handleTestBluetoothPairing = async () => {
    const res = await requestBluetoothPrinterDevice();
    if (res.success && res.deviceName) {
      setFormBluetoothName(res.deviceName);
      setToastNotice({ type: 'success', message: `Paired Bluetooth device: ${res.deviceName}` });
    } else if (res.error) {
      setToastNotice({ type: 'error', message: res.error });
    }
  };

  const handleTestUsbPairing = async () => {
    const res = await requestUsbPrinterDevice();
    if (res.success && res.deviceName) {
      setFormUsbName(res.deviceName);
      setToastNotice({ type: 'success', message: `Connected USB printer: ${res.deviceName}` });
    } else if (res.error) {
      setToastNotice({ type: 'error', message: res.error });
    }
  };

  // Mock sample data for live simulator preview
  const sampleKOT: KitchenOrderTicket = {
    id: 'sample-kot-1',
    kotNumber: 'KOT-0082',
    ticketType: 'KOT',
    destinationStation: 'kitchen',
    tableId: 'tbl-m1',
    tableNumber: 'M-01',
    zoneName: 'Main Dining Hall',
    waiterName: 'Floor Server 1',
    guestsCount: 4,
    status: 'in_kitchen',
    notes: 'Please expedite starter dishes first!',
    createdAt: Date.now() - 360000,
    updatedAt: Date.now() - 360000,
    items: [
      {
        id: 'ki-sample-1',
        productId: 'prod-starter-1',
        productName: 'Chef Special Appetizer',
        quantity: 2,
        unitPrice: 280,
        course: 'appetizer',
        specialInstructions: 'Extra spicy herb dressing',
        selectedModifiers: [{ modifierName: 'Sauce', optionName: 'House Dip', priceDelta: 0 }],
        status: 'preparing',
        firedAt: Date.now() - 360000
      },
      {
        id: 'ki-sample-2',
        productId: 'prod-main-1',
        productName: 'House Special Main Course',
        quantity: 1,
        unitPrice: 450,
        course: 'main',
        specialInstructions: 'Well done, chef style garnish',
        status: 'preparing',
        firedAt: Date.now() - 360000
      }
    ]
  };

  const sampleBOT: KitchenOrderTicket = {
    id: 'sample-bot-1',
    kotNumber: 'BOT-0014',
    ticketType: 'BOT',
    destinationStation: 'bar',
    tableId: 'tbl-m1',
    tableNumber: 'M-01',
    zoneName: 'Main Dining Hall',
    waiterName: 'Floor Server 1',
    guestsCount: 4,
    status: 'in_kitchen',
    notes: 'Serve with chilled beer glasses',
    createdAt: Date.now() - 360000,
    updatedAt: Date.now() - 360000,
    items: [
      {
        id: 'bi-sample-1',
        productId: 'prod-beer',
        productName: 'Gorkha Strong Craft Beer 650ml',
        quantity: 2,
        unitPrice: 480,
        course: 'beverage',
        specialInstructions: 'Chilled bottle with lime wedge',
        status: 'preparing',
        firedAt: Date.now() - 360000
      },
      {
        id: 'bi-sample-2',
        productId: 'prod-mojito',
        productName: 'Classic Virgin Mojito Mint',
        quantity: 1,
        unitPrice: 250,
        course: 'beverage',
        specialInstructions: 'Less ice, fresh mint',
        status: 'preparing',
        firedAt: Date.now() - 360000
      }
    ]
  };

  const sampleInvoice: SaleInvoice = {
    id: 'sample-inv-1',
    invoiceNumber: 'INV-2082-0492',
    date: Date.now(),
    fiscalYear: '2082/83',
    customerId: 'cust-walkin',
    customerName: 'Walk-in Table Guest',
    customerType: 'retail',
    customerPanVat: '302918274',
    salespersonId: 'staff-1',
    salespersonName: 'Billing Cashier',
    warehouseId: 'wh-main',
    warehouseName: 'Main Restaurant Store',
    createdAt: Date.now(),
    subtotal: 1820,
    discountAmount: 100,
    taxableAmount: 1720,
    taxAmount: 223.6,
    nonTaxableAmount: 0,
    grandTotal: 1944,
    totalCost: 650,
    grossProfit: 1070.4,
    paymentMethod: 'cash',
    paidAmount: 2000,
    dueAmount: 0,
    paymentStatus: 'paid',
    status: 'completed',
    items: [
      {
        productId: 'p1',
        productName: 'Chef Special Appetizer',
        sku: 'APP-01',
        selectedUnit: 'Portion',
        conversionFactor: 1,
        quantity: 2,
        baseQuantity: 2,
        unitPrice: 280,
        costPrice: 90,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 72.8,
        lineTotal: 560
      },
      {
        productId: 'p2',
        productName: 'Gorkha Strong Craft Beer 650ml',
        sku: 'BEER-G',
        selectedUnit: 'Bottle',
        conversionFactor: 1,
        quantity: 2,
        baseQuantity: 2,
        unitPrice: 480,
        costPrice: 260,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 124.8,
        lineTotal: 960
      },
      {
        productId: 'p3',
        productName: 'Classic Virgin Mojito Mint',
        sku: 'MOCK-MOJ',
        selectedUnit: 'Glass',
        conversionFactor: 1,
        quantity: 1,
        baseQuantity: 1,
        unitPrice: 220,
        costPrice: 65,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 13,
        taxAmount: 28.6,
        lineTotal: 220
      }
    ]
  };

  const filteredPrinters = printers.filter(p => {
    if (stationFilter === 'all') return true;
    return p.station === stationFilter || p.station === 'all';
  });

  const billingPrinter = printers.find(p => (p.station === 'billing' || p.station === 'all') && p.isActive);
  const kitchenPrinter = printers.find(p => (p.station === 'kitchen' || p.station === 'all') && p.isActive);
  const barPrinter = printers.find(p => (p.station === 'bar' || p.station === 'all') && p.isActive);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
      
      {/* Toast Notice */}
      {toastNotice && (
        <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold border shadow-md animate-in slide-in-from-top-2 ${
          toastNotice.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {toastNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Printer Setup &amp; Hardware Management</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure Kitchen KOT, Bar BOT, and Cashier Thermal Printers (80mm / 58mm) with auto-print dispatch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRestoreDefaults}
            icon={<CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
          >
            Verify Defaults
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetToDefaults}
            icon={<RotateCcw className="w-3.5 h-3.5 text-rose-500" />}
          >
            Reset Factory Config
          </Button>

          <Button
            variant="primary-arrow"
            size="sm"
            onClick={() => openCreateModal('billing')}
            icon={<Plus className="w-4 h-4" />}
          >
            Add New Printer
          </Button>
        </div>
      </div>

      {/* POS HARDWARE PRINTING GUIDE CARD */}
      <div className="p-4 rounded-3xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Universal POS Thermal Printing (80mm &amp; 58mm Rolls)</span>
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                Plug &amp; Play
              </span>
            </h4>
            <p className="text-slate-600 dark:text-slate-400 text-3xs leading-relaxed">
              When orders are fired in POS, KOTs are instantly dispatched to Kitchen and BOTs to Bar. You can also print directly to any installed Epson, Star, Xprinter, Sunmi, or Bixolon thermal printer via the browser or WebUSB. Slips open with a 1-click print window outside iframe sandboxes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-3xs font-mono font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
            Chrome Kiosk: --kiosk-printing
          </span>
        </div>
      </div>

      {/* THREE CORE STATIONS QUICK ROUTE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Cashier Billing Station */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-900/60 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Cashier &amp; Billing
                </h3>
                <p className="text-3xs text-slate-400">Customer Tax Invoices</p>
              </div>
            </div>
            <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {billingPrinter ? 'Active' : 'Not Set'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
            <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
              {billingPrinter?.name || 'No printer assigned to billing'}
            </p>
            <p className="text-3xs text-slate-500 mt-0.5">
              Roll: <strong>{billingPrinter?.paperWidth || '80mm'}</strong> • Interface: <strong>{billingPrinter?.connectionType.toUpperCase() || 'UNIVERSAL'}</strong>
            </p>
          </div>

          <div className="flex items-center justify-between text-3xs font-bold pt-1">
            <span className="text-slate-500">Auto-Print on Settle:</span>
            <span className={billingPrinter?.autoPrintBill ? 'text-emerald-600' : 'text-slate-400'}>
              {billingPrinter?.autoPrintBill ? 'Enabled ✓' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* 2. Kitchen KDS / KOT Line */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-900/60 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <ChefHat className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Kitchen KOT Line
                </h3>
                <p className="text-3xs text-slate-400">Food Preparation Slips</p>
              </div>
            </div>
            <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {kitchenPrinter ? 'Active' : 'Not Set'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
            <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
              {kitchenPrinter?.name || 'No printer assigned to kitchen'}
            </p>
            <p className="text-3xs text-slate-500 mt-0.5">
              Roll: <strong>{kitchenPrinter?.paperWidth || '80mm'}</strong> • Interface: <strong>{kitchenPrinter?.connectionType.toUpperCase() || 'UNIVERSAL'}</strong>
            </p>
          </div>

          <div className="flex items-center justify-between text-3xs font-bold pt-1">
            <span className="text-slate-500">Auto-Print on Fire:</span>
            <span className={kitchenPrinter?.autoPrintKOT ? 'text-amber-600' : 'text-slate-400'}>
              {kitchenPrinter?.autoPrintKOT ? 'Enabled (Instant KOT) ✓' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* 3. Bar Dispense BOT Station */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-900/60 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <Wine className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Bar BOT Station
                </h3>
                <p className="text-3xs text-slate-400">Drink &amp; Cocktail Slips</p>
              </div>
            </div>
            <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {barPrinter ? 'Active' : 'Not Set'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
            <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
              {barPrinter?.name || 'No printer assigned to bar'}
            </p>
            <p className="text-3xs text-slate-500 mt-0.5">
              Roll: <strong>{barPrinter?.paperWidth || '80mm'}</strong> • Interface: <strong>{barPrinter?.connectionType.toUpperCase() || 'UNIVERSAL'}</strong>
            </p>
          </div>

          <div className="flex items-center justify-between text-3xs font-bold pt-1">
            <span className="text-slate-500">Auto-Print on Fire:</span>
            <span className={barPrinter?.autoPrintBOT ? 'text-blue-600' : 'text-slate-400'}>
              {barPrinter?.autoPrintBOT ? 'Enabled (Instant BOT) ✓' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: PRINTER CONFIGS & REAL-TIME THERMAL SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: CONFIGURED PRINTERS LIST (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Station Filter Pills */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
              {(['all', 'billing', 'kitchen', 'bar'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStationFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-full capitalize transition-all cursor-pointer font-bold ${
                    stationFilter === tab
                      ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab === 'all' ? 'All Stations' : tab === 'billing' ? 'Billing' : tab === 'kitchen' ? 'Kitchen (KOT)' : 'Bar (BOT)'}
                </button>
              ))}
            </div>

            <span className="text-3xs font-mono text-slate-400 pl-2">
              {filteredPrinters.length} configured
            </span>
          </div>

          {/* Printers List */}
          <div className="space-y-3">
            {filteredPrinters.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
                <Printer className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No printers found in this station category</p>
                <button
                  type="button"
                  onClick={() => openCreateModal(stationFilter === 'all' ? 'billing' : stationFilter)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Add Printer
                </button>
              </div>
            ) : (
              filteredPrinters.map(printer => (
                <div
                  key={printer.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-800 transition-all space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        {printer.connectionType === 'network' ? (
                          <Wifi className="w-5 h-5" />
                        ) : printer.connectionType === 'bluetooth' ? (
                          <Bluetooth className="w-5 h-5" />
                        ) : printer.connectionType === 'usb' ? (
                          <Usb className="w-5 h-5" />
                        ) : (
                          <Laptop className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                            {printer.name}
                          </h4>
                          {printer.isDefault && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-3xs font-extrabold uppercase border border-blue-200 dark:border-blue-800">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-3xs text-slate-400 font-mono mt-0.5">
                          ID: {printer.id} • Last Tested: {printer.lastTestedAt ? `${Math.floor((Date.now() - printer.lastTestedAt) / 60000)}m ago` : 'Never'}
                        </p>
                      </div>
                    </div>

                    {/* Active Status Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${printer.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      <span className="text-3xs font-extrabold text-slate-600 dark:text-slate-300 uppercase">
                        {printer.isActive ? 'Online / Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Badges Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap text-3xs font-bold">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase font-mono">
                      {printer.station === 'kitchen' ? 'Kitchen KOT' : printer.station === 'bar' ? 'Bar BOT' : printer.station === 'billing' ? 'Billing Receipt' : 'All Stations'}
                    </span>

                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                      Roll: {printer.paperWidth}
                    </span>

                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase font-mono">
                      {printer.connectionType === 'network' ? `IP ${printer.ipAddress}:${printer.port}` : printer.connectionType === 'bluetooth' ? `BT: ${printer.bluetoothDeviceName || 'Wireless'}` : printer.connectionType === 'usb' ? `USB Direct` : 'Universal Driver'}
                    </span>

                    {printer.autoPrintKOT && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        ⚡ Auto-KOT
                      </span>
                    )}

                    {printer.autoPrintBOT && (
                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        ⚡ Auto-BOT
                      </span>
                    )}

                    {printer.autoPrintBill && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        ⚡ Auto-Bill
                      </span>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary-arrow"
                        size="sm"
                        disabled={testingId === printer.id}
                        onClick={() => handleRunTest(printer.id)}
                        icon={testingId === printer.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                      >
                        {testingId === printer.id ? 'Testing...' : 'Run Test Print'}
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(printer)}
                        icon={<Edit2 className="w-3.5 h-3.5 text-slate-500" />}
                      >
                        Configure
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updatePrinter(printer.id, { isActive: !printer.isActive })}
                        className={`text-2xs font-bold underline cursor-pointer ${printer.isActive ? 'text-slate-400 hover:text-slate-600' : 'text-emerald-600 font-extrabold'}`}
                      >
                        {printer.isActive ? 'Disable' : 'Enable'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove printer "${printer.name}"?`)) {
                            deletePrinter(printer.id);
                            setToastNotice({ type: 'success', message: `Removed printer "${printer.name}"` });
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        title="Delete Printer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: REALISTIC THERMAL PAPER SIMULATOR (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>Thermal Receipt Simulator</span>
            </h3>
            
            {/* Paper Width Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-3xs font-bold">
              <button
                type="button"
                onClick={() => setPreviewPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  previewPaperWidth === '80mm'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                80mm (3")
              </button>
              <button
                type="button"
                onClick={() => setPreviewPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  previewPaperWidth === '58mm'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                58mm (2")
              </button>
            </div>
          </div>

          {/* Slip Type Selector */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-2xs font-bold">
            <button
              type="button"
              onClick={() => setPreviewSlipType('kot')}
              className={`py-1.5 px-1 text-center rounded-xl transition-all cursor-pointer ${
                previewSlipType === 'kot'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Kitchen KOT
            </button>
            <button
              type="button"
              onClick={() => setPreviewSlipType('bot')}
              className={`py-1.5 px-1 text-center rounded-xl transition-all cursor-pointer ${
                previewSlipType === 'bot'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Bar BOT
            </button>
            <button
              type="button"
              onClick={() => setPreviewSlipType('bill')}
              className={`py-1.5 px-1 text-center rounded-xl transition-all cursor-pointer ${
                previewSlipType === 'bill'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tax Bill
            </button>
            <button
              type="button"
              onClick={() => setPreviewSlipType('test')}
              className={`py-1.5 px-1 text-center rounded-xl transition-all cursor-pointer ${
                previewSlipType === 'test'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Test Slip
            </button>
          </div>

          {/* Realistic Thermal Paper Roll Rendering Container */}
          <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-3xl flex justify-center items-center overflow-x-auto min-h-[460px]">
            <div 
              className={`bg-white text-black p-4 shadow-xl border-x border-slate-300 font-mono text-[10px] sm:text-xs leading-tight transition-all duration-300 relative select-none ${
                previewPaperWidth === '58mm' ? 'w-[230px]' : 'w-[310px]'
              }`}
              style={{
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
                borderTop: '3px dashed #bbb',
                borderBottom: '3px dashed #bbb'
              }}
            >
              {/* Slip Top Tear Effect */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white" />

              {previewSlipType === 'kot' && (
                <div className="space-y-1.5">
                  <div className="text-center font-bold text-xs uppercase tracking-wider">
                    *** KITCHEN ORDER TICKET ***
                  </div>
                  <div className="text-center my-1.5">
                    <span className="inline-block border-2 border-black font-black text-sm px-2 py-0.5">
                      TABLE: M-01
                    </span>
                  </div>
                  <div className="text-center text-3xs font-bold text-slate-700">
                    Main Dining Hall • Guests: 4
                  </div>
                  <div className="border-t border-dashed border-black my-1" />
                  <div className="flex justify-between text-3xs">
                    <span>KOT #: <strong>KOT-0082</strong></span>
                    <span>Server: <strong>Floor Server</strong></span>
                  </div>
                  <div className="flex justify-between text-3xs">
                    <span>Station: <strong>KITCHEN (KDS)</strong></span>
                    <span>12:45 PM</span>
                  </div>
                  <div className="border-t-2 border-black my-1" />
                  
                  <div className="font-bold flex justify-between text-3xs">
                    <span>QTY &amp; DISH</span>
                    <span>STATUS</span>
                  </div>
                  <div className="border-t border-dashed border-black my-1" />

                  <div className="space-y-2 text-2xs">
                    <div>
                      <div className="font-bold">2× Chef Special Appetizer</div>
                      <div className="text-[9px] pl-3 italic">+ House Dip</div>
                      <div className="text-[9px] pl-3 font-bold">⚠️ Extra spicy herb dressing</div>
                    </div>
                    <div>
                      <div className="font-bold">1× House Special Main Course</div>
                      <div className="text-[9px] pl-3 italic">Well done, chef style garnish</div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-black my-1" />
                  <div className="text-3xs font-bold">
                    NOTE: Please expedite starter dishes first!
                  </div>
                  <div className="border-t-2 border-black my-1.5" />
                  <div className="text-center text-[9px] font-bold">
                    DISPATCH DISHES IMMEDIATELY
                  </div>
                  <div className="text-center text-[8px] text-slate-500 pt-1">
                    - - - - - - - TEAR HERE - - - - - - -
                  </div>
                </div>
              )}

              {previewSlipType === 'bot' && (
                <div className="space-y-1.5">
                  <div className="text-center font-bold text-xs uppercase tracking-wider">
                    *** BAR ORDER TICKET (BOT) ***
                  </div>
                  <div className="text-center my-1.5">
                    <span className="inline-block border-2 border-black font-black text-sm px-2 py-0.5">
                      TABLE: M-01
                    </span>
                  </div>
                  <div className="text-center text-3xs font-bold text-slate-700">
                    Main Dining Hall • Guests: 4
                  </div>
                  <div className="border-t border-dashed border-black my-1" />
                  <div className="flex justify-between text-3xs">
                    <span>BOT #: <strong>BOT-0014</strong></span>
                    <span>Server: <strong>Floor Server</strong></span>
                  </div>
                  <div className="flex justify-between text-3xs">
                    <span>Station: <strong>BAR DISPENSE</strong></span>
                    <span>12:45 PM</span>
                  </div>
                  <div className="border-t-2 border-black my-1" />
                  
                  <div className="font-bold text-3xs">
                    BEVERAGE &amp; DISPENSE ITEMS
                  </div>
                  <div className="border-t border-dashed border-black my-1" />

                  <div className="space-y-2 text-2xs">
                    <div>
                      <div className="font-bold">2× Gorkha Strong Craft Beer 650ml</div>
                      <div className="text-[9px] pl-3 italic">Chilled bottle with lime wedge</div>
                    </div>
                    <div>
                      <div className="font-bold">1× Classic Virgin Mojito Mint</div>
                      <div className="text-[9px] pl-3 italic">Less ice, fresh mint</div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-black my-1" />
                  <div className="text-3xs font-bold">
                    BAR NOTE: Serve with chilled beer glasses
                  </div>
                  <div className="border-t-2 border-black my-1.5" />
                  <div className="text-center text-[9px] font-bold">
                    DISPENSE CHILLED TO RUNNER
                  </div>
                  <div className="text-center text-[8px] text-slate-500 pt-1">
                    - - - - - - - TEAR HERE - - - - - - -
                  </div>
                </div>
              )}

              {previewSlipType === 'bill' && (
                <div className="space-y-1.5">
                  <div className="text-center">
                    <div className="font-black text-xs uppercase">{settings.companyName || 'QuickIMS Restaurant'}</div>
                    <div className="text-[9px]">{settings.address.street}, {settings.address.municipality}</div>
                    <div className="text-[9px]">PAN/VAT: <strong>{settings.panNumber}</strong></div>
                    <div className="font-bold text-2xs mt-1">TAX INVOICE</div>
                  </div>
                  
                  <div className="border-t border-dashed border-black my-1" />
                  <div className="flex justify-between text-3xs">
                    <span>Inv: <strong>INV-2082-0492</strong></span>
                    <span>Table: <strong>M-01</strong></span>
                  </div>
                  <div className="flex justify-between text-3xs">
                    <span>Date: 2026-03-24</span>
                    <span>Cashier: Counter Cashier</span>
                  </div>
                  <div className="border-t-2 border-black my-1" />

                  <div className="space-y-1 text-3xs">
                    <div className="flex justify-between font-bold">
                       <span>2× Chef Special Appetizer</span>
                      <span>Rs. 560</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>2× Gorkha Strong Beer</span>
                      <span>Rs. 960</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>1× Virgin Mojito</span>
                      <span>Rs. 220</span>
                    </div>
                  </div>

                  <div className="border-t-2 border-black my-1.5" />
                  <div className="flex justify-between text-3xs">
                    <span>Subtotal:</span>
                    <span>Rs. 1,820</span>
                  </div>
                  <div className="flex justify-between text-3xs">
                    <span>Discount:</span>
                    <span>-Rs. 100</span>
                  </div>
                  <div className="flex justify-between text-3xs">
                    <span>Taxable:</span>
                    <span>Rs. 1,720</span>
                  </div>
                  <div className="flex justify-between text-3xs">
                    <span>VAT (13%):</span>
                    <span>Rs. 224</span>
                  </div>

                  <div className="border-t border-dashed border-black my-1" />
                  <div className="flex justify-between font-black text-xs">
                    <span>TOTAL:</span>
                    <span>Rs. 1,944</span>
                  </div>
                  <div className="border-t border-dashed border-black my-1" />

                  <div className="flex justify-between text-3xs">
                    <span>Payment: CASH</span>
                    <span>Tendered: Rs. 2,000</span>
                  </div>
                  <div className="flex justify-between text-3xs font-bold">
                    <span>Change Due:</span>
                    <span>Rs. 56</span>
                  </div>

                  <div className="border border-black p-1 text-center text-[8px] font-bold my-1.5">
                    SCAN TO PAY (FONEPAY / IRD)
                  </div>

                  <div className="text-center text-[9px] font-bold">
                    Thank you for dining with us! Visit again.
                  </div>
                  <div className="text-center text-[8px] text-slate-500 pt-1">
                    - - - - - - - THANK YOU - - - - - - -
                  </div>
                </div>
              )}

              {previewSlipType === 'test' && (
                <div className="space-y-1.5 text-center">
                  <div className="font-bold text-xs uppercase">*** PRINTER TEST SLIP ***</div>
                  <div className="font-bold text-2xs">Universal Thermal Driver</div>
                  <div className="text-[9px]">Width: {previewPaperWidth} • Interface: UNIVERSAL</div>
                  <div className="border-t border-dashed border-black my-1" />
                  <div className="text-left text-3xs">Status: ONLINE (Hardware Ready)</div>
                  <div className="text-left text-3xs">Character Alignment Test:</div>
                  <div className="text-3xs tracking-tighter">1234567890ABCDEFGHIJKLMN</div>
                  <div className="text-3xs tracking-tighter">abcdefghijklmnopqrstuvwx</div>
                  <div className="border-t-2 border-black my-1" />
                  <div className="font-bold text-[9px]">✓ HARDWARE ALIGNMENT OK</div>
                  <div className="text-[8px] text-slate-500 pt-1">
                    - - - - - - - CUT MARKER - - - - - - -
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Print Current Simulator Sample Button */}
          <Button
            variant="primary-arrow"
            size="md"
            fullWidth
            onClick={async () => {
              const activeP = (previewSlipType === 'kot' ? kitchenPrinter : previewSlipType === 'bot' ? barPrinter : billingPrinter) || printers[0];
              if (!activeP) return;

              let html = '';
              let label = 'Test Slip';
              let slipStation: 'kitchen' | 'bar' | 'billing' | 'test' = 'test';
              let slipNumber = 'TEST';

              if (previewSlipType === 'kot') {
                html = generateKOTSlipHtml(sampleKOT, { ...activeP, paperWidth: previewPaperWidth }, settings);
                label = `Kitchen KOT (${sampleKOT.kotNumber})`;
                slipStation = 'kitchen';
                slipNumber = sampleKOT.kotNumber;
              } else if (previewSlipType === 'bot') {
                html = generateBOTSlipHtml(sampleBOT, { ...activeP, paperWidth: previewPaperWidth }, settings);
                label = `Bar BOT (${sampleBOT.kotNumber})`;
                slipStation = 'bar';
                slipNumber = sampleBOT.kotNumber;
              } else if (previewSlipType === 'bill') {
                html = generateBillReceiptSlipHtml(sampleInvoice, diningTables[0] || null, { ...activeP, paperWidth: previewPaperWidth }, settings);
                label = `Tax Invoice (${sampleInvoice.invoiceNumber})`;
                slipStation = 'billing';
                slipNumber = sampleInvoice.invoiceNumber;
              } else {
                html = generateTestSlipHtml({ ...activeP, paperWidth: previewPaperWidth }, settings);
                label = 'Hardware Alignment Test Slip';
              }

              const res = await executeThermalPrint(html, activeP, undefined, { triggerNativePrint: true });
              setToastNotice({
                type: res.success ? 'success' : 'error',
                message: res.message
              });
            }}
            icon={<Printer className="w-4 h-4" />}
          >
            <span>Print Simulator Slip ({previewPaperWidth})</span>
          </Button>
        </div>
      </div>

      {/* MODAL: ADD / EDIT PRINTER CONFIGURATION */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {activeModal.mode === 'create' ? 'Add Thermal Printer' : 'Configure Printer'}
                  </h3>
                  <p className="text-3xs text-slate-400">Configure connection interface, paper size and routing station</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePrinter} className="space-y-4 text-xs">
              
              {/* Printer Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Printer Friendly Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Hot Kitchen KOT Line, Bar Dispense, Main Billing"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:outline-blue-500"
                />
              </div>

              {/* Station Assignment */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Target Station Assignment
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'billing', label: 'Cashier / Bill', icon: Receipt },
                    { id: 'kitchen', label: 'Kitchen KOT', icon: ChefHat },
                    { id: 'bar', label: 'Bar BOT', icon: Wine },
                    { id: 'all', label: 'All-in-One', icon: Sparkles },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setFormStation(s.id as PrinterStationType);
                        if (s.id === 'kitchen') {
                          setFormAutoKOT(true);
                          setFormAutoBOT(false);
                          setFormAutoBill(false);
                        } else if (s.id === 'bar') {
                          setFormAutoKOT(false);
                          setFormAutoBOT(true);
                          setFormAutoBill(false);
                        } else if (s.id === 'billing') {
                          setFormAutoKOT(false);
                          setFormAutoBOT(false);
                          setFormAutoBill(true);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        formStation === s.id
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <s.icon className="w-4 h-4" />
                      <span className="text-3xs">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Connection Interface */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Connection Interface
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'universal', label: 'Universal (OS Driver)', icon: Laptop },
                    { id: 'network', label: 'Network (LAN / IP)', icon: Wifi },
                    { id: 'usb', label: 'USB Direct', icon: Usb },
                    { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth },
                  ].map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormConnectionType(c.id as PrinterConnectionType)}
                      className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        formConnectionType === c.id
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <c.icon className="w-4 h-4" />
                      <span className="text-3xs">{c.label}</span>
                    </button>
                  ))}
                </div>

                {/* Specific Interface Configuration Subfields */}
                {formConnectionType === 'network' && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 mt-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <label className="text-3xs font-bold text-slate-500">Ethernet / Wi-Fi IP Address</label>
                        <input
                          type="text"
                          value={formIpAddress}
                          onChange={(e) => setFormIpAddress(e.target.value)}
                          placeholder="192.168.1.200"
                          className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-3xs font-bold text-slate-500">Port (Default 9100)</label>
                        <input
                          type="number"
                          value={formPort}
                          onChange={(e) => setFormPort(parseInt(e.target.value, 10) || 9100)}
                          className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formConnectionType === 'bluetooth' && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-3xs font-bold text-slate-500">Bluetooth Device Name</label>
                        <p className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formBluetoothName || 'Not paired yet'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestBluetoothPairing}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-xl text-3xs font-bold border border-blue-200 cursor-pointer"
                      >
                        Pair Bluetooth POS
                      </button>
                    </div>
                  </div>
                )}

                {formConnectionType === 'usb' && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-3xs font-bold text-slate-500">USB Connected Device</label>
                        <p className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formUsbName || 'Generic USB Thermal Driver'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestUsbPairing}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-xl text-3xs font-bold border border-blue-200 cursor-pointer"
                      >
                        Select USB Device
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Paper Width & Copies */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Thermal Paper Width
                  </label>
                  <select
                    value={formPaperWidth}
                    onChange={(e) => setFormPaperWidth(e.target.value as PrinterPaperWidth)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value="80mm">80mm (Standard 3-Inch Roll)</option>
                    <option value="58mm">58mm (Compact 2-Inch Roll)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Number of Copies
                  </label>
                  <select
                    value={formCopies}
                    onChange={(e) => setFormCopies(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value={1}>1 Copy (Standard)</option>
                    <option value={2}>2 Copies (Merchant + Customer)</option>
                  </select>
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <p className="text-3xs font-black uppercase tracking-wider text-slate-400">
                  Instant Auto-Printing Automation
                </p>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Auto-print KOT when Food is Fired
                  </span>
                  <input
                    type="checkbox"
                    checked={formAutoKOT}
                    onChange={(e) => setFormAutoKOT(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Auto-print BOT when Drinks are Fired
                  </span>
                  <input
                    type="checkbox"
                    checked={formAutoBOT}
                    onChange={(e) => setFormAutoBOT(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Auto-print Tax Receipt on Bill Settlement
                  </span>
                  <input
                    type="checkbox"
                    checked={formAutoBill}
                    onChange={(e) => setFormAutoBill(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Trigger Cash Drawer Kick Signal
                  </span>
                  <input
                    type="checkbox"
                    checked={formKickDrawer}
                    onChange={(e) => setFormKickDrawer(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              {/* Status and Default Flag */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Printer is Active / Online</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-blue-600">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Primary for {formStation}</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary-arrow"
                  size="md"
                  type="submit"
                >
                  {activeModal.mode === 'create' ? 'Add Thermal Printer' : 'Save Printer Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
