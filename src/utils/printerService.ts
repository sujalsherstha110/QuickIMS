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
      .no-print {
        display: none !important;
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
    .no-print {
      margin-bottom: 12px;
      padding: 10px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      text-align: center;
    }
    .no-print button {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 7px 16px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }
    .no-print button:hover {
      background: #1d4ed8;
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
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              try {
                window.focus();
                window.print();
              } catch (e) {
                console.warn('Auto print trigger notice:', e);
              }
            }, 300);
          });
        </script>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print Slip Now</button>
          <div style="font-size: 11px; color: #1e40af; margin-top: 4px;">
            Kitchen KOT (${printer.paperWidth}) • Ready to Print
          </div>
        </div>

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
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              try {
                window.focus();
                window.print();
              } catch (e) {
                console.warn('Auto print trigger notice:', e);
              }
            }, 300);
          });
        </script>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print Slip Now</button>
          <div style="font-size: 11px; color: #1e40af; margin-top: 4px;">
            Bar BOT (${printer.paperWidth}) • Ready to Print
          </div>
        </div>

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
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              try {
                window.focus();
                window.print();
              } catch (e) {
                console.warn('Auto print trigger notice:', e);
              }
            }, 300);
          });
        </script>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print Tax Invoice Now</button>
          <div style="font-size: 11px; color: #1e40af; margin-top: 4px;">
            Cashier Receipt (${printer.paperWidth}) • Ready to Print
          </div>
        </div>

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
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              try {
                window.focus();
                window.print();
              } catch (e) {
                console.warn('Auto print trigger notice:', e);
              }
            }, 300);
          });
        </script>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print Test Slip Now</button>
          <div style="font-size: 11px; color: #1e40af; margin-top: 4px;">
            Hardware Alignment Test (${printer.paperWidth}) • Ready to Print
          </div>
        </div>

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
 * Helper to concatenate Uint8Array chunks
 */
const concatUint8Arrays = (...arrays: Uint8Array[]): Uint8Array => {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
};

/**
 * Generate ESC/POS Binary Commands for Kitchen Order Ticket (KOT)
 */
export const generateKOTEscPosBytes = (
  kot: KitchenOrderTicket,
  printer: POSPrinterConfig,
  _settings?: CompanySettings
): Uint8Array => {
  const is58 = printer.paperWidth === '58mm';
  const lineWidth = is58 ? 32 : 48;
  const dateStr = formatDate(kot.createdAt);
  const timeStr = new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const add = (str: string) => chunks.push(enc.encode(str));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  // Init
  addBytes(0x1b, 0x40);

  // Center header
  addBytes(0x1b, 0x61, 0x01);
  addBytes(0x1b, 0x45, 0x01);
  add(`${printer.headerCustomText || '*** KITCHEN ORDER TICKET (KOT) ***'}\n`);
  addBytes(0x1d, 0x21, 0x11); // Double size
  add(`TABLE: ${kot.tableNumber}\n`);
  addBytes(0x1d, 0x21, 0x00); // Normal size
  addBytes(0x1b, 0x45, 0x00);
  add(`${kot.zoneName || 'Main Dining'} | Guests: ${kot.guestsCount || 2}\n`);
  add('-'.repeat(lineWidth) + '\n');

  // Left aligned details
  addBytes(0x1b, 0x61, 0x00);
  add(`KOT #: ${kot.kotNumber}  Server: ${kot.waiterName}\n`);
  add(`Time: ${dateStr} ${timeStr}\n`);
  add('='.repeat(lineWidth) + '\n');
  add('QTY  ITEM DESCRIPTION\n');
  add('-'.repeat(lineWidth) + '\n');

  // Items
  for (const item of kot.items) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${item.quantity}x  ${item.productName}\n`);
    addBytes(0x1b, 0x45, 0x00);
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      add(`    + ${item.selectedModifiers.map(m => m.optionName).join(', ')}\n`);
    }
    if (item.specialInstructions) {
      add(`    * Note: ${item.specialInstructions}\n`);
    }
  }

  if (kot.notes) {
    add('-'.repeat(lineWidth) + '\n');
    add(`KITCHEN NOTE: ${kot.notes}\n`);
  }

  add('='.repeat(lineWidth) + '\n');
  addBytes(0x1b, 0x61, 0x01);
  add(`${printer.footerCustomText || 'Dispatch dishes immediately upon prep'}\n`);
  add('\n\n\n\n');
  addBytes(0x1d, 0x56, 0x00); // Cut paper

  return concatUint8Arrays(...chunks);
};

/**
 * Generate ESC/POS Binary Commands for Bar Order Ticket (BOT)
 */
export const generateBOTEscPosBytes = (
  bot: KitchenOrderTicket,
  printer: POSPrinterConfig,
  _settings?: CompanySettings
): Uint8Array => {
  const is58 = printer.paperWidth === '58mm';
  const lineWidth = is58 ? 32 : 48;
  const dateStr = formatDate(bot.createdAt);
  const timeStr = new Date(bot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const add = (str: string) => chunks.push(enc.encode(str));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  addBytes(0x1b, 0x40);
  addBytes(0x1b, 0x61, 0x01);
  addBytes(0x1b, 0x45, 0x01);
  add(`${printer.headerCustomText || '*** BAR ORDER TICKET (BOT) ***'}\n`);
  addBytes(0x1d, 0x21, 0x11);
  add(`TABLE: ${bot.tableNumber}\n`);
  addBytes(0x1d, 0x21, 0x00);
  addBytes(0x1b, 0x45, 0x00);
  add(`${bot.zoneName || 'Bar Area'} | Guests: ${bot.guestsCount || 2}\n`);
  add('-'.repeat(lineWidth) + '\n');

  addBytes(0x1b, 0x61, 0x00);
  add(`BOT #: ${bot.kotNumber}  Bartender: ${bot.waiterName}\n`);
  add(`Time: ${dateStr} ${timeStr}\n`);
  add('='.repeat(lineWidth) + '\n');
  add('QTY  DRINK / BEVERAGE ITEM\n');
  add('-'.repeat(lineWidth) + '\n');

  for (const item of bot.items) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${item.quantity}x  ${item.productName}\n`);
    addBytes(0x1b, 0x45, 0x00);
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      add(`    + ${item.selectedModifiers.map(m => m.optionName).join(', ')}\n`);
    }
  }

  add('='.repeat(lineWidth) + '\n');
  addBytes(0x1b, 0x61, 0x01);
  add(`${printer.footerCustomText || 'Serve chilled immediately'}\n`);
  add('\n\n\n\n');
  addBytes(0x1d, 0x56, 0x00);

  return concatUint8Arrays(...chunks);
};

/**
 * Generate ESC/POS Binary Commands for Bill Receipt
 */
export const generateBillEscPosBytes = (
  invoice: SaleInvoice,
  table: DiningTable | null,
  printer: POSPrinterConfig,
  settings?: CompanySettings
): Uint8Array => {
  const is58 = printer.paperWidth === '58mm';
  const lineWidth = is58 ? 32 : 48;
  const dateStr = formatDate(invoice.date);
  const timeStr = new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const add = (str: string) => chunks.push(enc.encode(str));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  addBytes(0x1b, 0x40);
  addBytes(0x1b, 0x61, 0x01);
  addBytes(0x1b, 0x45, 0x01);
  add(`${settings?.companyName || 'QuickIMS Restaurant'}\n`);
  addBytes(0x1b, 0x45, 0x00);
  if (settings?.address?.street) add(`${settings.address.street}, ${settings.address.municipality || ''}\n`);
  if (settings?.panNumber) add(`PAN/VAT: ${settings.panNumber}\n`);
  add(`${printer.headerCustomText || 'TAX INVOICE'}\n`);
  add('-'.repeat(lineWidth) + '\n');

  addBytes(0x1b, 0x61, 0x00);
  add(`Inv #: ${invoice.invoiceNumber}  Table: ${table ? table.tableNumber : 'Walk-in'}\n`);
  add(`Date: ${dateStr} ${timeStr}\n`);
  if (invoice.customerName && invoice.customerName !== 'Walk-in Customer') {
    add(`Customer: ${invoice.customerName}\n`);
  }
  add('='.repeat(lineWidth) + '\n');

  for (const item of invoice.items) {
    add(`${item.quantity}x ${item.productName.slice(0, lineWidth - 12).padEnd(lineWidth - 12)} Rs.${(item.lineTotal || 0).toFixed(0).padStart(6)}\n`);
  }

  add('-'.repeat(lineWidth) + '\n');
  add(`Subtotal: ${formatNPR(invoice.subtotal).padStart(lineWidth - 10)}\n`);
  if (invoice.discountAmount > 0) {
    add(`Discount: -${formatNPR(invoice.discountAmount).padStart(lineWidth - 11)}\n`);
  }
  add(`VAT (13%): ${formatNPR(invoice.taxAmount).padStart(lineWidth - 11)}\n`);
  add('='.repeat(lineWidth) + '\n');
  addBytes(0x1b, 0x45, 0x01);
  add(`GRAND TOTAL: ${formatNPR(invoice.grandTotal).padStart(lineWidth - 13)}\n`);
  addBytes(0x1b, 0x45, 0x00);
  add(`Payment: ${invoice.paymentMethod.toUpperCase()} (Tendered: ${formatNPR(invoice.paidAmount)})\n`);

  addBytes(0x1b, 0x61, 0x01);
  add(`\n${printer.footerCustomText || settings?.invoiceFooterMessage || 'Thank you for dining with us!'}\n`);
  add('\n\n\n\n');
  addBytes(0x1d, 0x56, 0x00);

  return concatUint8Arrays(...chunks);
};

/**
 * Generate ESC/POS Binary Commands for Printer Test
 */
export const generateTestEscPosBytes = (
  printer: POSPrinterConfig,
  _settings?: CompanySettings
): Uint8Array => {
  const is58 = printer.paperWidth === '58mm';
  const lineWidth = is58 ? 32 : 48;
  const now = new Date();

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const add = (str: string) => chunks.push(enc.encode(str));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  addBytes(0x1b, 0x40);
  addBytes(0x1b, 0x61, 0x01);
  addBytes(0x1b, 0x45, 0x01);
  add('*** PRINTER HARDWARE TEST ***\n');
  add(`${printer.name}\n`);
  addBytes(0x1b, 0x45, 0x00);
  add(`Width: ${printer.paperWidth} | Station: ${printer.station.toUpperCase()}\n`);
  add(`Interface: ${printer.connectionType.toUpperCase()}\n`);
  add('-'.repeat(lineWidth) + '\n');
  add(`Date: ${formatDate(now.getTime())} ${now.toLocaleTimeString()}\n`);
  add('='.repeat(lineWidth) + '\n');
  add('0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ\n');
  add('✓ TEST PRINT SUCCESSFUL!\n');
  add('\n\n\n\n');
  addBytes(0x1d, 0x56, 0x00);

  return concatUint8Arrays(...chunks);
};

/**
 * Send raw binary commands directly via WebUSB
 */
export const printViaWebUsb = async (
  printer: POSPrinterConfig,
  data: Uint8Array
): Promise<{ success: boolean; message: string }> => {
  const nav = navigator as any;
  if (!nav.usb) {
    return { success: false, message: 'WebUSB is not supported in this browser.' };
  }

  try {
    const devices = await nav.usb.getDevices();
    if (!devices || devices.length === 0) {
      return { success: false, message: 'No paired USB printer found. Click "Select USB Device" in Printer Setup first.' };
    }

    let matchedDevice = devices.find((d: any) => 
      (printer.usbVendorId && d.productName && d.productName.toLowerCase().includes(printer.usbVendorId.toLowerCase())) ||
      (printer.usbVendorId && `0x${d.vendorId.toString(16)}`.toLowerCase() === printer.usbVendorId.toLowerCase())
    );

    if (!matchedDevice && devices.length > 0) {
      matchedDevice = devices[0];
    }

    if (!matchedDevice) {
      return { success: false, message: 'USB printer device not accessible.' };
    }

    await matchedDevice.open();
    if (matchedDevice.configuration === null) {
      await matchedDevice.selectConfiguration(1);
    }

    let targetInterface: any = null;
    let targetEndpoint: any = null;

    for (const iface of matchedDevice.configuration.interfaces) {
      for (const alt of iface.alternates) {
        const outEp = alt.endpoints?.find((ep: any) => ep.direction === 'out');
        if (outEp) {
          targetInterface = iface;
          targetEndpoint = outEp;
          break;
        }
      }
      if (targetInterface) break;
    }

    if (!targetInterface || !targetEndpoint) {
      await matchedDevice.close();
      return { success: false, message: 'Could not locate USB OUT endpoint on printer.' };
    }

    await matchedDevice.claimInterface(targetInterface.interfaceNumber);
    await matchedDevice.transferOut(targetEndpoint.endpointNumber, data);
    await matchedDevice.close();

    return { 
      success: true, 
      message: `Thermal print sent directly to ${matchedDevice.productName || 'USB Printer'} via USB!` 
    };
  } catch (err: any) {
    console.warn('WebUSB print direct attempt warning:', err);
    return { 
      success: false, 
      message: `WebUSB direct send: ${err?.message || err}` 
    };
  }
};

/**
 * Create a standalone Blob URL for the given HTML content.
 * Opening this in a new tab bypasses iframe sandbox restrictions and triggers print automatically.
 */
export const createThermalPrintBlobUrl = (htmlContent: string): string => {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
};

/**
 * Print via dedicated hidden iframe with Blob URL
 */
export const printViaHiddenIframe = async (htmlContent: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      let iframe = document.getElementById('quickims-print-iframe') as HTMLIFrameElement | null;
      if (iframe) {
        iframe.remove();
      }
      iframe = document.createElement('iframe');
      iframe.id = 'quickims-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.bottom = '0';
      iframe.style.right = '0';
      iframe.style.width = '100px';
      iframe.style.height = '100px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0.01';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const blobUrl = createThermalPrintBlobUrl(htmlContent);
      iframe.src = blobUrl;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe?.contentWindow?.focus();
            iframe?.contentWindow?.print();
            resolve(true);
          } catch (e) {
            console.warn('Iframe print call notice:', e);
            resolve(false);
          }
        }, 150);
      };
    } catch (err) {
      console.warn('Hidden iframe print error:', err);
      resolve(false);
    }
  });
};

/**
 * Directly trigger print with isolated thermal slip target.
 * Tries hidden iframe first, falls back to DOM injection and window.print.
 */
export const triggerThermalWindowPrint = async (htmlContent: string): Promise<boolean> => {
  try {
    const iframeSuccess = await printViaHiddenIframe(htmlContent);
    if (iframeSuccess) return true;
  } catch {
    /* fallback to main window */
  }

  try {
    let targetEl = document.getElementById('quickims-thermal-print-target');
    if (!targetEl) {
      targetEl = document.createElement('div');
      targetEl.id = 'quickims-thermal-print-target';
      document.body.appendChild(targetEl);
    }
    targetEl.innerHTML = htmlContent;
    window.focus();
    window.print();
    return true;
  } catch (err) {
    console.warn('triggerThermalWindowPrint notice (open in new tab recommended):', err);
    return false;
  }
};

/**
 * Universal print execution via WebUSB, hidden iframe, and DOM print isolation.
 */
export const executeThermalPrint = async (
  htmlContent: string,
  printer: POSPrinterConfig,
  rawPayload?: { type: 'kot' | 'bot' | 'bill' | 'test'; data?: any; settings?: CompanySettings }
): Promise<{ success: boolean; message: string; blobUrl: string }> => {
  const blobUrl = createThermalPrintBlobUrl(htmlContent);

  // 1. If USB Direct connection, attempt direct WebUSB transfer first
  if (printer.connectionType === 'usb' && rawPayload) {
    try {
      let escPosBytes: Uint8Array | null = null;
      if (rawPayload.type === 'kot' && rawPayload.data) {
        escPosBytes = generateKOTEscPosBytes(rawPayload.data, printer, rawPayload.settings);
      } else if (rawPayload.type === 'bot' && rawPayload.data) {
        escPosBytes = generateBOTEscPosBytes(rawPayload.data, printer, rawPayload.settings);
      } else if (rawPayload.type === 'bill' && rawPayload.data) {
        escPosBytes = generateBillEscPosBytes(rawPayload.data.invoice, rawPayload.data.table, printer, rawPayload.settings);
      } else if (rawPayload.type === 'test') {
        escPosBytes = generateTestEscPosBytes(printer, rawPayload.settings);
      }

      if (escPosBytes) {
        const usbRes = await printViaWebUsb(printer, escPosBytes);
        if (usbRes.success) {
          return { ...usbRes, blobUrl };
        }
        console.warn('WebUSB direct transfer not completed, falling back to system thermal dialog:', usbRes.message);
      }
    } catch (usbErr) {
      console.warn('WebUSB print fallback trigger:', usbErr);
    }
  }

  // 2. Prepare thermal print target in main DOM for instant CSS @media print
  let targetEl = document.getElementById('quickims-thermal-print-target');
  if (!targetEl) {
    targetEl = document.createElement('div');
    targetEl.id = 'quickims-thermal-print-target';
    document.body.appendChild(targetEl);
  }
  targetEl.innerHTML = htmlContent;

  // Dispatch custom event for UI listeners and modals
  try {
    window.dispatchEvent(new CustomEvent('quickims:thermal-print-dispatched', {
      detail: { html: htmlContent, printer, rawPayload, blobUrl, timestamp: Date.now() }
    }));
  } catch { /* ignore */ }

  // 3. Attempt direct print via hidden iframe or window.print
  try {
    printViaHiddenIframe(htmlContent).catch(() => null);
  } catch { /* ignore */ }

  return {
    success: true,
    message: `Thermal slip prepared for ${printer.name} (${printer.paperWidth})`,
    blobUrl
  };
};

/**
 * Test Web Bluetooth device connection
 */
export const requestBluetoothPrinterDevice = async (): Promise<{ success: boolean; deviceName?: string; error?: string }> => {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    return {
      success: false,
      error: 'Web Bluetooth is not supported on this browser. Please use Chrome/Edge or Universal System Print.'
    };
  }

  try {
    const device = await nav.bluetooth.requestDevice({
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
  const nav = navigator as any;
  if (!nav.usb) {
    return {
      success: false,
      error: 'WebUSB is not supported on this browser. Please use Chrome/Edge or Universal System Print.'
    };
  }

  try {
    const device = await nav.usb.requestDevice({
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
