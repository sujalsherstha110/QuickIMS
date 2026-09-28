import { POSPrinterConfig, KitchenOrderTicket, SaleInvoice, DiningTable, CompanySettings } from '../types';
import { formatNPR, formatDate } from './nepalFormatters';

/**
 * Universal Thermal Printer Service
 * Supports 80mm (3-inch) and 58mm (2-inch) thermal rolls with CSS print isolation.
 * Works seamlessly with any installed POS printer (Epson, Star, Xprinter, Sunmi, Bixolon, Citizen, etc.)
 */

// Generate base thermal print CSS
const getThermalBaseStyles = (paperWidth: '80mm' | '58mm') => {
  const is58 = paperWidth === '58mm';
  const widthMm = is58 ? '54mm' : '76mm';
  const maxPx = is58 ? '210px' : '300px';
  const fontSize = is58 ? '10px' : '11px';
  const headerFontSize = is58 ? '13px' : '15px';

  return `
    @page {
      size: ${paperWidth} auto;
      margin: 0;
    }
    @media print {
      body {
        margin: 0;
        padding: 4px 6px;
        background: #fff;
        color: #000;
      }
    }
    body {
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: ${fontSize};
      line-height: 1.35;
      color: #000;
      background: #fff;
      margin: 0 auto;
      width: ${widthMm};
      max-width: ${maxPx};
      padding: 4px 6px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .font-black { font-weight: 900; }
    .header-title { font-size: ${headerFontSize}; font-weight: 900; text-transform: uppercase; margin: 2px 0; }
    .sub-title { font-size: ${fontSize}; margin: 1px 0; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .double-divider { border-top: 2px solid #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .table-badge {
      display: inline-block;
      font-size: ${is58 ? '14px' : '16px'};
      font-weight: 900;
      border: 2px solid #000;
      padding: 2px 8px;
      margin: 4px 0;
      text-transform: uppercase;
    }
    .item-row { margin: 3px 0; }
    .item-header { display: flex; justify-content: space-between; font-weight: bold; }
    .item-sub { font-size: 9px; padding-left: 10px; font-style: italic; }
    .cut-line { margin-top: 14px; text-align: center; font-size: 8px; border-bottom: 1px dashed #777; padding-bottom: 4px; }
    .qr-box { margin: 6px auto; width: 64px; height: 64px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; }
  `;
};

/**
 * Generate Kitchen Order Ticket (KOT) Thermal Slip HTML
 */
export const generateKOTSlipHtml = (
  kot: KitchenOrderTicket,
  printer: POSPrinterConfig,
  settings: CompanySettings
): string => {
  const styles = getThermalBaseStyles(printer.paperWidth);
  const dateStr = formatDate(kot.createdAt);
  const timeStr = new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const itemsHtml = kot.items.map(item => `
    <div class="item-row">
      <div class="item-header">
        <span>${item.quantity}× ${item.productName}</span>
      </div>
      ${item.selectedModifiers && item.selectedModifiers.length > 0 ? `
        <div class="item-sub">+ ${item.selectedModifiers.map(m => m.optionName).join(', ')}</div>
      ` : ''}
      ${item.specialInstructions ? `
        <div class="item-sub">⚠️ Note: ${item.specialInstructions}</div>
      ` : ''}
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${kot.kotNumber} - Kitchen KOT</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="font-bold">${printer.headerCustomText || '*** KITCHEN ORDER TICKET (KOT) ***'}</div>
          <div class="table-badge">TABLE: ${kot.tableNumber}</div>
          <div class="sub-title font-bold">${kot.zoneName || 'Main Dining'} • Guests: ${kot.guestsCount || 2}</div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>KOT #: <strong>${kot.kotNumber}</strong></span>
          <span>Server: <strong>${kot.waiterName}</strong></span>
        </div>
        <div class="row">
          <span>Date: ${dateStr}</span>
          <span>Time: ${timeStr}</span>
        </div>

        <div class="double-divider"></div>
        <div class="row font-bold">
          <span>QTY & ITEM DESCRIPTION</span>
          <span>STATUS</span>
        </div>
        <div class="divider"></div>

        ${itemsHtml}

        ${kot.notes ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>KITCHEN NOTE:</strong> ${kot.notes}</div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center font-bold" style="font-size: 9px;">
          ${printer.footerCustomText || 'Dispatch dishes immediately upon preparation'}
        </div>
        <div class="cut-line">- - - - - - - TEAR HERE - - - - - - -</div>
      </body>
    </html>
  `;
};

/**
 * Generate Bar Order Ticket (BOT) Thermal Slip HTML
 */
export const generateBOTSlipHtml = (
  bot: KitchenOrderTicket,
  printer: POSPrinterConfig,
  settings: CompanySettings
): string => {
  const styles = getThermalBaseStyles(printer.paperWidth);
  const dateStr = formatDate(bot.createdAt);
  const timeStr = new Date(bot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const itemsHtml = bot.items.map(item => `
    <div class="item-row">
      <div class="item-header">
        <span>${item.quantity}× ${item.productName}</span>
      </div>
      ${item.selectedModifiers && item.selectedModifiers.length > 0 ? `
        <div class="item-sub">+ ${item.selectedModifiers.map(m => m.optionName).join(', ')}</div>
      ` : ''}
      ${item.specialInstructions ? `
        <div class="item-sub">🍸 Instructions: ${item.specialInstructions}</div>
      ` : ''}
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${bot.kotNumber} - Bar BOT</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="font-bold">${printer.headerCustomText || '*** BAR ORDER TICKET (BOT) ***'}</div>
          <div class="table-badge">TABLE: ${bot.tableNumber}</div>
          <div class="sub-title font-bold">${bot.zoneName || 'Bar / Dining'} • Guests: ${bot.guestsCount || 2}</div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>BOT #: <strong>${bot.kotNumber}</strong></span>
          <span>Server: <strong>${bot.waiterName}</strong></span>
        </div>
        <div class="row">
          <span>Date: ${dateStr}</span>
          <span>Time: ${timeStr}</span>
        </div>

        <div class="double-divider"></div>
        <div class="row font-bold">
          <span>BEVERAGE & DISPENSE ITEMS</span>
        </div>
        <div class="divider"></div>

        ${itemsHtml}

        ${bot.notes ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>BAR NOTE:</strong> ${bot.notes}</div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center font-bold" style="font-size: 9px;">
          ${printer.footerCustomText || 'Dispense chilled to table server'}
        </div>
        <div class="cut-line">- - - - - - - TEAR HERE - - - - - - -</div>
      </body>
    </html>
  `;
};

/**
 * Generate Customer Tax Invoice / Bill Receipt Thermal Slip HTML
 */
export const generateBillReceiptSlipHtml = (
  invoice: SaleInvoice,
  table: DiningTable | null,
  printer: POSPrinterConfig,
  settings: CompanySettings
): string => {
  const styles = getThermalBaseStyles(printer.paperWidth);
  const dateStr = formatDate(invoice.date);
  const timeStr = new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const itemsHtml = invoice.items.map(item => `
    <div class="item-row">
      <div class="item-header">
        <span>${item.productName}</span>
        <span>${formatNPR(item.lineTotal)}</span>
      </div>
      <div class="item-sub">
        ${item.quantity} ${item.selectedUnit || 'pcs'} × ${formatNPR(item.unitPrice)}
        ${item.discountAmount > 0 ? ` (Disc: -${formatNPR(item.discountAmount)})` : ''}
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="header-title">${settings.companyName || 'QuickIMS Restaurant'}</div>
          ${settings.tagline ? `<div class="sub-title font-bold">${settings.tagline}</div>` : ''}
          <div class="sub-title">${settings.address.street}, ${settings.address.municipality}</div>
          <div class="sub-title">Tel: ${settings.phone || settings.mobile}</div>
          <div class="sub-title"><strong>PAN/VAT: ${settings.panNumber}</strong></div>
          <div class="font-bold" style="margin-top: 3px; font-size: 10px;">${printer.headerCustomText || 'TAX INVOICE'}</div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>Inv #: <strong>${invoice.invoiceNumber}</strong></span>
          <span>Table: <strong>${table ? table.tableNumber : 'Walk-in'}</strong></span>
        </div>
        <div class="row">
          <span>Date: ${dateStr} ${timeStr}</span>
          <span>Cashier: ${invoice.salespersonName || 'Staff'}</span>
        </div>
        ${invoice.customerName && invoice.customerName !== 'Walk-in Customer' ? `
          <div class="row">
            <span>Bill To: <strong>${invoice.customerName}</strong></span>
            ${invoice.customerPanVat ? `<span>PAN: ${invoice.customerPanVat}</span>` : ''}
          </div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="row font-bold">
          <span>PARTICULAR</span>
          <span>AMOUNT</span>
        </div>
        <div class="divider"></div>

        ${itemsHtml}

        <div class="double-divider"></div>

        <div class="row">
          <span>Subtotal:</span>
          <span>${formatNPR(invoice.subtotal)}</span>
        </div>
        ${invoice.discountAmount > 0 ? `
          <div class="row">
            <span>Discount:</span>
            <span>-${formatNPR(invoice.discountAmount)}</span>
          </div>
        ` : ''}
        <div class="row">
          <span>Taxable Amount:</span>
          <span>${formatNPR(invoice.taxableAmount)}</span>
        </div>
        <div class="row">
          <span>VAT (13%):</span>
          <span>${formatNPR(invoice.taxAmount)}</span>
        </div>

        <div class="divider"></div>
        <div class="row font-black" style="font-size: 13px;">
          <span>GRAND TOTAL:</span>
          <span>${formatNPR(invoice.grandTotal)}</span>
        </div>
        <div class="divider"></div>

        <div class="row">
          <span>Payment: <strong>${invoice.paymentMethod.toUpperCase()}</strong></span>
          <span>Tendered: ${formatNPR(invoice.paidAmount)}</span>
        </div>
        ${invoice.dueAmount > 0 ? `
          <div class="row font-bold">
            <span>Balance Due:</span>
            <span>${formatNPR(invoice.dueAmount)}</span>
          </div>
        ` : ''}

        ${printer.showQrCode ? `
          <div class="text-center" style="margin-top: 6px;">
            <div class="qr-box">
              <span>SCAN TO PAY<br/>FONEPAY</span>
            </div>
          </div>
        ` : ''}

        <div class="text-center sub-title" style="margin-top: 6px;">
          ${printer.footerCustomText || settings.invoiceFooterMessage || 'Thank you for dining with us! Visit again.'}
        </div>
        <div class="text-center" style="font-size: 8px; color: #444; margin-top: 3px;">
          Powered by QuickIMS Nepal POS
        </div>
        <div class="cut-line">- - - - - - - THANK YOU - - - - - - -</div>
      </body>
    </html>
  `;
};

/**
 * Generate Alignment & Formatting Test Thermal Slip HTML
 */
export const generateTestSlipHtml = (
  printer: POSPrinterConfig,
  settings: CompanySettings
): string => {
  const styles = getThermalBaseStyles(printer.paperWidth);
  const now = new Date();

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Test Print - ${printer.name}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="header-title">*** PRINTER TEST SLIP ***</div>
          <div class="font-bold">${printer.name}</div>
          <div class="sub-title">Paper Width: <strong>${printer.paperWidth}</strong></div>
          <div class="sub-title">Target Station: <strong>${printer.station.toUpperCase()}</strong></div>
          <div class="sub-title">Interface: <strong>${printer.connectionType.toUpperCase()}</strong></div>
        </div>

        <div class="divider"></div>
        <div class="row">
          <span>Device ID: ${printer.id}</span>
          <span>Status: ONLINE</span>
        </div>
        <div class="row">
          <span>Date: ${formatDate(now.getTime())}</span>
          <span>Time: ${now.toLocaleTimeString()}</span>
        </div>
        ${printer.ipAddress ? `
          <div class="row">
            <span>IP Address: ${printer.ipAddress}:${printer.port || 9100}</span>
          </div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center font-bold">CHARACTER ALIGNMENT CHECK</div>
        <div class="divider"></div>
        <div>1234567890123456789012345678901234567890</div>
        <div>ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn</div>
        <div>----------------------------------------</div>
        <div class="text-left">Left-Aligned Sample Text</div>
        <div class="text-center">Center-Aligned Sample Text</div>
        <div class="text-right">Right-Aligned Sample Text</div>

        <div class="divider"></div>
        <div class="text-center font-bold">AUTOMATION DISPATCH FLAGS</div>
        <div class="divider"></div>
        <div class="row">
          <span>Auto-Print KOT (Food):</span>
          <span><strong>${printer.autoPrintKOT ? 'ENABLED ✓' : 'OFF'}</strong></span>
        </div>
        <div class="row">
          <span>Auto-Print BOT (Bar):</span>
          <span><strong>${printer.autoPrintBOT ? 'ENABLED ✓' : 'OFF'}</strong></span>
        </div>
        <div class="row">
          <span>Auto-Print Bill (Cashier):</span>
          <span><strong>${printer.autoPrintBill ? 'ENABLED ✓' : 'OFF'}</strong></span>
        </div>
        <div class="row">
          <span>Copies Count:</span>
          <span><strong>${printer.copiesCount} Copy</strong></span>
        </div>

        <div class="double-divider"></div>
        <div class="text-center font-bold" style="font-size: 10px;">
          ✓ PRINTER HARDWARE TEST SUCCESSFUL!
        </div>
        <div class="cut-line">- - - - - - - CUT MARKER - - - - - - -</div>
      </body>
    </html>
  `;
};

/**
 * Universal print execution via hidden isolated iframe.
 * Prevents main window DOM pollution and renders razor-sharp thermal receipts.
 */
export const executeThermalPrint = (
  htmlContent: string,
  printer: POSPrinterConfig
): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = '0px';
      iframe.style.visibility = 'hidden';
      iframe.setAttribute('title', 'QuickIMS Thermal Print Frame');

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        resolve({ success: false, message: 'Could not access printer iframe document context.' });
        return;
      }

      doc.open();
      doc.write(htmlContent);
      doc.close();

      // Allow thermal fonts and styles to initialize
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);

          resolve({
            success: true,
            message: `Print dispatched successfully to ${printer.name} (${printer.paperWidth}, ${printer.connectionType.toUpperCase()})`
          });
        } catch (printErr: any) {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve({
            success: false,
            message: `Printing error: ${printErr?.message || 'Print dialog could not be invoked.'}`
          });
        }
      }, 250);
    } catch (err: any) {
      resolve({
        success: false,
        message: `Printer execution failure: ${err?.message || 'Unknown error'}`
      });
    }
  });
};

/**
 * Test Web Bluetooth device connection
 */
export const requestBluetoothPrinterDevice = async (): Promise<{ success: boolean; deviceName?: string; error?: string }> => {
  if (!navigator.bluetooth) {
    return {
      success: false,
      error: 'Web Bluetooth is not supported on this browser. Please use Chrome/Edge or Universal System Print.'
    };
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Common printer service UUID
    });

    return {
      success: true,
      deviceName: device.name || 'Bluetooth Thermal POS'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'User cancelled Bluetooth pairing.'
    };
  }
};

/**
 * Test WebUSB printer connection
 */
export const requestUsbPrinterDevice = async (): Promise<{ success: boolean; deviceName?: string; error?: string }> => {
  if (!navigator.usb) {
    return {
      success: false,
      error: 'WebUSB is not supported on this browser. Please use Chrome/Edge or Universal System Print.'
    };
  }

  try {
    const device = await navigator.usb.requestDevice({
      filters: [{ classCode: 7 }] // USB Printer Class
    });

    return {
      success: true,
      deviceName: device.productName || `USB Vendor 0x${device.vendorId.toString(16)}`
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'User cancelled USB selection.'
    };
  }
};
