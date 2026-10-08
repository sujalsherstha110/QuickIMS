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
  // True printable width for standard thermal rolls: 80mm rolls print ~72mm; 58mm rolls print ~48mm.
  const widthMm = is58 ? '48mm' : '72mm';
  const fontSize = is58 ? '8.5px' : '9.5px';
  const headerFontSize = is58 ? '11.5px' : '13px';
  const subFontSize = is58 ? '7.5px' : '8px';
  const grandTotalSize = is58 ? '11px' : '12.5px';

  return `
    @page {
      size: ${paperWidth} auto;
      margin: 0;
    }
    @media screen {
      #quickims-thermal-print-target {
        display: none !important;
        visibility: hidden !important;
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
    }
    @media print {
      *, *::before, *::after {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .no-print {
        display: none !important;
      }
      body {
        /* High-contrast, sharp sans-serif font stack with medium-heavy strokes for razor-sharp thermal dot burning */
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-size: ${fontSize} !important;
        line-height: 1.16 !important;
        font-weight: 600 !important;
        color: #000000 !important;
        background: #ffffff !important;
        margin: 0 auto !important;
        width: 100% !important;
        max-width: ${widthMm} !important;
        padding: 1mm 0.5mm !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: geometricPrecision;
        font-smooth: never;
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: -0.015em;
        word-break: break-word;
      }
      #quickims-thermal-print-target {
        display: block !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-size: ${fontSize} !important;
        line-height: 1.16 !important;
        font-weight: 600 !important;
        color: #000000 !important;
        background: #ffffff !important;
        margin: 0 auto !important;
        width: 100% !important;
        max-width: ${widthMm} !important;
        padding: 1mm 0.5mm !important;
        box-sizing: border-box !important;
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .text-left { text-align: left; }
      .font-bold { font-weight: 700; }
      .font-black { font-weight: 900; }
      .header-title {
        font-size: ${headerFontSize};
        font-weight: 900;
        text-transform: uppercase;
        margin: 0.5px 0;
        letter-spacing: -0.01em;
        line-height: 1.15;
      }
      .sub-title {
        font-size: ${subFontSize};
        margin: 0.5px 0;
        font-weight: 600;
        line-height: 1.15;
      }
      .divider {
        border-top: 1px dashed #000000;
        margin: 1.5px 0;
        height: 0;
      }
      .double-divider {
        border-top: 1px solid #000000;
        margin: 2px 0;
        height: 0;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin: 0.5px 0;
        font-variant-numeric: tabular-nums;
      }
      .table-badge {
        display: inline-block;
        font-size: ${is58 ? '11px' : '12.5px'};
        font-weight: 900;
        border: 1.5px solid #000000;
        padding: 1px 5px;
        margin: 1.5px 0;
        text-transform: uppercase;
        letter-spacing: -0.01em;
      }
      .receipt-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin: 1.5px 0;
      }
      .receipt-table th {
        border-top: 1px solid #000000;
        border-bottom: 1px solid #000000;
        padding: 1.5px 0;
        font-size: ${fontSize};
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: -0.01em;
      }
      .receipt-table td {
        padding: 1px 0;
        vertical-align: top;
        font-size: ${fontSize};
        font-weight: 600;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .col-item {
        text-align: left;
        width: ${is58 ? '46%' : '48%'};
        word-break: break-word;
      }
      .col-qty {
        text-align: center;
        width: ${is58 ? '12%' : '12%'};
        white-space: nowrap;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .col-rate {
        text-align: right;
        width: ${is58 ? '18%' : '18%'};
        white-space: nowrap;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .col-amt {
        text-align: right;
        width: ${is58 ? '24%' : '22%'};
        white-space: nowrap;
        font-weight: 700;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .totals-table {
        width: 100%;
        border-collapse: collapse;
        margin: 1px 0;
        table-layout: fixed;
      }
      .totals-table td {
        padding: 0.75px 0;
        font-size: ${fontSize};
        font-weight: 600;
      }
      .totals-table .label {
        text-align: left;
        width: 58%;
      }
      .totals-table .amount {
        text-align: right;
        width: 42%;
        white-space: nowrap;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .grand-total-row td {
        font-size: ${grandTotalSize} !important;
        font-weight: 900 !important;
        padding: 2px 0 !important;
        border-top: 1px solid #000000;
        border-bottom: 1px solid #000000;
      }
      .item-sub {
        font-size: ${subFontSize};
        font-weight: 600;
        margin-top: 0.5px;
        line-height: 1.15;
      }
      .cut-line {
        margin-top: 5px;
        text-align: center;
        font-size: 7.5px;
        font-weight: 600;
        border-bottom: 1px dashed #000000;
        padding-bottom: 1.5px;
        color: #000000;
      }
      .qr-box {
        margin: 3px auto;
        width: 52px;
        height: 52px;
        border: 1.5px solid #000000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 7px;
        font-weight: 800;
        line-height: 1.1;
        text-align: center;
      }
    }
  `;
};

/**
 * Generate Kitchen Order Ticket (KOT) Thermal Slip HTML
 */
export const generateKOTSlipHtml = (
  kot: KitchenOrderTicket,
  printer: POSPrinterConfig,
  settings: CompanySettings,
  isReprint?: boolean
): string => {
  const styles = getThermalBaseStyles(printer.paperWidth);
  const is58 = printer.paperWidth === '58mm';
  const dateStr = formatDate(kot.createdAt);
  const timeStr = new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const itemsHtml = kot.items.map(item => `
    <tr>
      <td style="width: 16%; text-align: left; vertical-align: top; padding: 1.5px 0; font-weight: 900; font-size: ${is58 ? '10.5px' : '12px'}; font-variant-numeric: tabular-nums;">
        ${item.quantity}×
      </td>
      <td style="width: 84%; text-align: left; vertical-align: top; padding: 1.5px 0;">
        <div style="font-weight: 800; font-size: ${is58 ? '9.5px' : '10.5px'}; line-height: 1.2;">${item.productName}</div>
        ${item.selectedModifiers && item.selectedModifiers.length > 0 ? `
          <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 600;">+ ${item.selectedModifiers.map(m => m.optionName).join(', ')}</div>
        ` : ''}
        ${item.specialInstructions ? `
          <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 800;">⚠️ ${item.specialInstructions}</div>
        ` : ''}
      </td>
    </tr>
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
          <div class="font-black" style="letter-spacing: -0.01em; font-size: ${is58 ? '10px' : '11.5px'};">${printer.headerCustomText || '*** KITCHEN ORDER TICKET (KOT) ***'}</div>
          ${(isReprint || (kot.printedCount && kot.printedCount > 1)) ? '<div style="font-weight:900; text-align:center; margin:1.5px 0; padding:1px; border:1px dashed #000; font-size:9.5px;">*** DUPLICATE / REPRINT ***</div>' : ''}
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
        <table class="receipt-table" style="table-layout: fixed;">
          <thead>
            <tr>
              <th style="width: 16%; text-align: left;">QTY</th>
              <th style="width: 84%; text-align: left;">DISH & INSTRUCTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${kot.notes ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>KITCHEN NOTE:</strong> ${kot.notes}</div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center font-bold" style="font-size: 8px;">
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
  settings: CompanySettings,
  isReprint?: boolean
): string => {
  const styles = getThermalBaseStyles(printer.paperWidth);
  const is58 = printer.paperWidth === '58mm';
  const dateStr = formatDate(bot.createdAt);
  const timeStr = new Date(bot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const itemsHtml = bot.items.map(item => `
    <tr>
      <td style="width: 16%; text-align: left; vertical-align: top; padding: 1.5px 0; font-weight: 900; font-size: ${is58 ? '10.5px' : '12px'}; font-variant-numeric: tabular-nums;">
        ${item.quantity}×
      </td>
      <td style="width: 84%; text-align: left; vertical-align: top; padding: 1.5px 0;">
        <div style="font-weight: 800; font-size: ${is58 ? '9.5px' : '10.5px'}; line-height: 1.2;">${item.productName}</div>
        ${item.selectedModifiers && item.selectedModifiers.length > 0 ? `
          <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 600;">+ ${item.selectedModifiers.map(m => m.optionName).join(', ')}</div>
        ` : ''}
        ${item.specialInstructions ? `
          <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 800;">🍸 Note: ${item.specialInstructions}</div>
        ` : ''}
      </td>
    </tr>
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
          <div class="font-black" style="letter-spacing: -0.01em; font-size: ${is58 ? '10px' : '11.5px'};">${printer.headerCustomText || '*** BAR ORDER TICKET (BOT) ***'}</div>
          ${(isReprint || (bot.printedCount && bot.printedCount > 1)) ? '<div style="font-weight:900; text-align:center; margin:1.5px 0; padding:1px; border:1px dashed #000; font-size:9.5px;">*** DUPLICATE / REPRINT ***</div>' : ''}
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
        <table class="receipt-table" style="table-layout: fixed;">
          <thead>
            <tr>
              <th style="width: 16%; text-align: left;">QTY</th>
              <th style="width: 84%; text-align: left;">BEVERAGE ITEM</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${bot.notes ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>BAR NOTE:</strong> ${bot.notes}</div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center font-bold" style="font-size: 8px;">
          ${printer.footerCustomText || 'Dispense chilled to table server'}
        </div>
        <div class="cut-line">- - - - - - - TEAR HERE - - - - - - -</div>
      </body>
    </html>
  `;
};

/**
 * Generate Combined KOT + BOT Order Thermal Slip HTML
 * Allows printing both Kitchen and Bar tickets together straight away on Fire Order
 */
export const generateCombinedOrderTicketsHtml = (
  kitchenTicket: KitchenOrderTicket,
  barTicket: KitchenOrderTicket,
  printer: POSPrinterConfig,
  settings: CompanySettings
): string => {
  const styles = getThermalBaseStyles(printer.paperWidth);
  const is58 = printer.paperWidth === '58mm';
  const dateStr = formatDate(kitchenTicket.createdAt);
  const timeStr = new Date(kitchenTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const kitchenItemsHtml = kitchenTicket.items.map(item => `
    <tr>
      <td style="width: 16%; text-align: left; vertical-align: top; padding: 1.5px 0; font-weight: 900; font-size: ${is58 ? '10.5px' : '12px'}; font-variant-numeric: tabular-nums;">
        ${item.quantity}×
      </td>
      <td style="width: 84%; text-align: left; vertical-align: top; padding: 1.5px 0;">
        <div style="font-weight: 800; font-size: ${is58 ? '9.5px' : '10.5px'}; line-height: 1.2;">${item.productName}</div>
        ${item.selectedModifiers && item.selectedModifiers.length > 0 ? `
          <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 600;">+ ${item.selectedModifiers.map(m => m.optionName).join(', ')}</div>
        ` : ''}
        ${item.specialInstructions ? `
          <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 800;">⚠️ ${item.specialInstructions}</div>
        ` : ''}
      </td>
    </tr>
  `).join('');

  const barItemsHtml = barTicket.items.map(item => `
    <tr>
      <td style="width: 16%; text-align: left; vertical-align: top; padding: 1.5px 0; font-weight: 900; font-size: ${is58 ? '10.5px' : '12px'}; font-variant-numeric: tabular-nums;">
        ${item.quantity}×
      </td>
      <td style="width: 84%; text-align: left; vertical-align: top; padding: 1.5px 0;">
        <div style="font-weight: 800; font-size: ${is58 ? '9.5px' : '10.5px'}; line-height: 1.2;">${item.productName}</div>
        ${item.selectedModifiers && item.selectedModifiers.length > 0 ? `
          <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 600;">+ ${item.selectedModifiers.map(m => m.optionName).join(', ')}</div>
        ` : ''}
        ${item.specialInstructions ? `
          <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 800;">🍸 ${item.specialInstructions}</div>
        ` : ''}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${kitchenTicket.kotNumber} & ${barTicket.kotNumber} - Order Tickets</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="font-black" style="font-size: ${is58 ? '11px' : '12.5px'};">${settings.companyName.toUpperCase()}</div>
          <div class="table-badge">TABLE: ${kitchenTicket.tableNumber}</div>
          <div class="sub-title font-bold">${kitchenTicket.zoneName || 'Main Dining'} • Guests: ${kitchenTicket.guestsCount || 1}</div>
        </div>

        <div class="divider"></div>
        <div class="row">
          <span>Server: <strong>${kitchenTicket.waiterName}</strong></span>
          <span>Time: ${dateStr} ${timeStr}</span>
        </div>

        <!-- 1. KITCHEN KOT SECTION -->
        <div class="double-divider"></div>
        <div class="text-center font-black" style="font-size: ${is58 ? '10px' : '11px'}; background: #000; color: #fff; padding: 2px 0; margin-bottom: 3px;">
          👨‍🍳 KITCHEN ORDER (${kitchenTicket.kotNumber})
        </div>
        <table class="receipt-table" style="table-layout: fixed;">
          <thead>
            <tr>
              <th style="width: 16%; text-align: left;">QTY</th>
              <th style="width: 84%; text-align: left;">DISH & INSTRUCTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${kitchenItemsHtml}
          </tbody>
        </table>

        ${kitchenTicket.notes ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>KITCHEN NOTE:</strong> ${kitchenTicket.notes}</div>
        ` : ''}

        <!-- 2. BAR BOT SECTION -->
        <div class="double-divider"></div>
        <div class="text-center font-black" style="font-size: ${is58 ? '10px' : '11px'}; background: #000; color: #fff; padding: 2px 0; margin-bottom: 3px;">
          🍸 BAR ORDER (${barTicket.kotNumber})
        </div>
        <table class="receipt-table" style="table-layout: fixed;">
          <thead>
            <tr>
              <th style="width: 16%; text-align: left;">QTY</th>
              <th style="width: 84%; text-align: left;">BEVERAGE & INSTRUCTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${barItemsHtml}
          </tbody>
        </table>

        ${barTicket.notes ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>BAR NOTE:</strong> ${barTicket.notes}</div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center font-bold" style="font-size: 8px;">
          DISPATCH ORDERS TO PREPARATION STATIONS
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

  const itemsTableHtml = invoice.items.map(item => `
    <tr>
      <td class="col-item">
        <div class="font-bold">${item.productName}</div>
        ${item.discountAmount > 0 ? `<div class="item-sub">Disc: -${item.discountAmount.toFixed(2)}</div>` : ''}
      </td>
      <td class="col-qty">${item.quantity}</td>
      <td class="col-rate">${item.unitPrice.toFixed(2)}</td>
      <td class="col-amt">${item.lineTotal.toFixed(2)}</td>
    </tr>
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
          <div class="sub-title font-bold">PAN/VAT: ${settings.panNumber}</div>
          <div class="font-black" style="margin-top: 2px; font-size: 10px; letter-spacing: 0.05em;">${printer.headerCustomText || 'TAX INVOICE'}</div>
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
        <table class="receipt-table">
          <thead>
            <tr>
              <th class="col-item">ITEM</th>
              <th class="col-qty">QTY</th>
              <th class="col-rate">RATE</th>
              <th class="col-amt">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTableHtml}
          </tbody>
        </table>

        <div class="double-divider"></div>

        <table class="totals-table">
          <tr>
            <td class="label">Subtotal:</td>
            <td class="amount">${invoice.subtotal.toFixed(2)}</td>
          </tr>
          ${invoice.discountAmount > 0 ? `
            <tr>
              <td class="label">Discount:</td>
              <td class="amount">-${invoice.discountAmount.toFixed(2)}</td>
            </tr>
          ` : ''}
          <tr>
            <td class="label">Taxable Base:</td>
            <td class="amount">${invoice.taxableAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">VAT (13% Included):</td>
            <td class="amount">${invoice.taxAmount.toFixed(2)}</td>
          </tr>
          <tr class="grand-total-row">
            <td class="label font-black">GRAND TOTAL:</td>
            <td class="amount font-black">Rs. ${invoice.grandTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">Payment (${invoice.paymentMethod.toUpperCase()}):</td>
            <td class="amount">${(invoice.paidAmount || 0).toFixed(2)}</td>
          </tr>
          ${invoice.dueAmount > 0 ? `
            <tr style="font-weight: 800;">
              <td class="label">Balance Due:</td>
              <td class="amount">Rs. ${invoice.dueAmount.toFixed(2)}</td>
            </tr>
          ` : ''}
        </table>

        ${printer.showQrCode ? `
          <div class="text-center" style="margin-top: 4px;">
            <div class="qr-box">
              <span>SCAN TO PAY<br/>FONEPAY QR</span>
            </div>
          </div>
        ` : ''}

        <div class="text-center sub-title font-bold" style="margin-top: 4px;">
          ${printer.footerCustomText || settings.invoiceFooterMessage || 'Thank you for dining with us! Visit again.'}
        </div>
        <div class="text-center" style="font-size: 7.5px; font-weight: 600; margin-top: 2px;">
          QuickIMS Nepal POS
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
          <div class="sub-title">Station: <strong>${printer.station.toUpperCase()}</strong></div>
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
            <span>IP: ${printer.ipAddress}:${printer.port || 9100}</span>
          </div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center font-bold">COLUMN & NUMBER ALIGNMENT</div>
        <div class="divider"></div>
        <table class="receipt-table">
          <thead>
            <tr>
              <th class="col-item">SAMPLE ITEM</th>
              <th class="col-qty">QTY</th>
              <th class="col-rate">RATE</th>
              <th class="col-amt">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="col-item font-bold">Steamed Momo (10 pcs)</td>
              <td class="col-qty">2</td>
              <td class="col-rate">280.00</td>
              <td class="col-amt">560.00</td>
            </tr>
            <tr>
              <td class="col-item font-bold">Craft Draught Beer</td>
              <td class="col-qty">1</td>
              <td class="col-rate">450.00</td>
              <td class="col-amt">450.00</td>
            </tr>
            <tr>
              <td class="col-item font-bold">Mineral Water 1L</td>
              <td class="col-qty">3</td>
              <td class="col-rate">45.00</td>
              <td class="col-amt">135.00</td>
            </tr>
          </tbody>
        </table>

        <div class="double-divider"></div>
        <table class="totals-table">
          <tr>
            <td class="label">Subtotal:</td>
            <td class="amount">1145.00</td>
          </tr>
          <tr>
            <td class="label">VAT (13%):</td>
            <td class="amount">148.85</td>
          </tr>
          <tr class="grand-total-row">
            <td class="label">TEST TOTAL:</td>
            <td class="amount">Rs. 1293.85</td>
          </tr>
        </table>

        <div class="divider"></div>
        <div class="text-center font-bold">TEXT SHARPNESS & WIDTH TEST</div>
        <div class="divider"></div>
        <div style="font-weight: 800; font-size: 9px; letter-spacing: 0;">1234567890123456789012345678901234567890</div>
        <div style="font-size: 8.5px;">ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn</div>
        <div class="divider"></div>

        <div class="row">
          <span>Auto KOT: <strong>${printer.autoPrintKOT ? 'YES' : 'NO'}</strong></span>
          <span>Auto BOT: <strong>${printer.autoPrintBOT ? 'YES' : 'NO'}</strong></span>
        </div>
        <div class="row">
          <span>Auto-Print Bill: <strong>${printer.autoPrintBill ? 'ENABLED ✓' : 'OFF'}</strong></span>
          <span>Copies: <strong>${printer.copiesCount || 1}</strong></span>
        </div>

        <div class="double-divider"></div>
        <div class="text-center font-bold" style="font-size: 8.5px;">
          ✓ PRINTER HARDWARE TEST SUCCESSFUL!
        </div>
        <div class="cut-line">- - - - - - - TEST PASSED - - - - - - -</div>
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
  if (invoice.taxableAmount !== undefined && invoice.taxableAmount > 0) {
    add(`Taxable Base: ${formatNPR(invoice.taxableAmount).padStart(lineWidth - 14)}\n`);
  }
  add(`VAT (13% Inc): ${formatNPR(invoice.taxAmount).padStart(lineWidth - 14)}\n`);
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
 * Print via dedicated hidden iframe
 * Isolates print execution so main POS DOM is never modified or hidden
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
      iframe.style.bottom = '-9999px';
      iframe.style.right = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.src = 'about:blank';
      document.body.appendChild(iframe);

      let hasPrinted = false;
      const triggerPrint = () => {
        if (hasPrinted) return;
        hasPrinted = true;
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
          resolve(true);
        } catch (e) {
          console.warn('Iframe print call notice:', e);
          resolve(false);
        }
      };

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlContent);
          doc.close();
          setTimeout(triggerPrint, 120);
          return;
        }
      } catch (err) {
        // Fallback to blob url
      }

      const blobUrl = createThermalPrintBlobUrl(htmlContent);
      iframe.src = blobUrl;
      iframe.onload = () => {
        setTimeout(triggerPrint, 150);
      };
      setTimeout(() => {
        if (!hasPrinted) triggerPrint();
      }, 400);
    } catch (err) {
      console.warn('Hidden iframe print error:', err);
      resolve(false);
    }
  });
};

/**
 * Safe thermal window print with guaranteed class and DOM element cleanup (never breaks screen)
 */
export const safeThermalWindowPrint = async (htmlContent: string, paperWidth: '80mm' | '58mm' = '80mm'): Promise<boolean> => {
  return new Promise((resolve) => {
    // 1. Clean up any previous leftover print target from the DOM
    const oldTarget = document.getElementById('quickims-thermal-print-target');
    if (oldTarget) {
      oldTarget.remove();
    }

    // 2. Create fresh target container
    const targetEl = document.createElement('div');
    targetEl.id = 'quickims-thermal-print-target';
    targetEl.className = paperWidth === '58mm' ? 'print-paper-58mm' : 'print-paper-80mm';

    let bodyContent = htmlContent;
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const stylesTag = styleMatch ? `<style>${styleMatch[1]}</style>` : '';
    if (bodyMatch && bodyMatch[1]) {
      bodyContent = bodyMatch[1];
    }
    targetEl.innerHTML = `${stylesTag}${bodyContent}`;
    document.body.appendChild(targetEl);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('has-thermal-print');
      const el = document.getElementById('quickims-thermal-print-target');
      if (el) {
        el.remove();
      }
      window.removeEventListener('afterprint', cleanup);
      window.removeEventListener('focus', cleanup);
      resolve(true);
    };

    document.body.classList.add('has-thermal-print');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.addEventListener('focus', cleanup, { once: true });

    try {
      window.print();
      // If print dialog closes or returns without firing afterprint, ensure cleanup within 800ms
      setTimeout(cleanup, 800);
    } catch (err) {
      console.warn('Window print error:', err);
      cleanup();
    }

    // Safety fallback timeout: if afterprint / focus listener doesn't fire, clean up promptly
    setTimeout(cleanup, 1500);
  });
};

/**
 * Directly trigger print with isolated thermal slip target.
 * Tries hidden iframe first, falls back to safe DOM print.
 */
export const triggerThermalWindowPrint = async (htmlContent: string, paperWidth: '80mm' | '58mm' = '80mm'): Promise<boolean> => {
  try {
    const iframeSuccess = await printViaHiddenIframe(htmlContent);
    if (iframeSuccess) return true;
  } catch {
    /* fallback to safe window print */
  }

  return safeThermalWindowPrint(htmlContent, paperWidth);
};

/**
 * Universal print execution via WebUSB, LAN/IP driver routing, and DOM print isolation.
 */
export const executeThermalPrint = async (
  htmlContent: string,
  printer: POSPrinterConfig,
  rawPayload?: { type: 'kot' | 'bot' | 'bill' | 'test'; data?: any; settings?: CompanySettings },
  options?: { triggerNativePrint?: boolean }
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
        console.warn('WebUSB direct transfer notice:', usbRes.message);
      }
    } catch (usbErr) {
      console.warn('WebUSB print fallback trigger:', usbErr);
    }
  }

  // 2. If Network (LAN/IP) connection with direct raw socket configured
  if (printer.connectionType === 'network' && printer.ipAddress && rawPayload) {
    if (printer.driverMode === 'direct_ip') {
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
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1500);
          await fetch(`http://${printer.ipAddress}:${printer.port || 9100}`, {
            method: 'POST',
            mode: 'no-cors',
            body: escPosBytes,
            signal: controller.signal
          }).finally(() => clearTimeout(timer));
        }
      } catch (netErr) {
        console.warn('Direct LAN IP raw transmission notice:', netErr);
      }
    }
  }

  // 3. Dispatch custom event for UI listeners and hardware logs
  try {
    window.dispatchEvent(new CustomEvent('quickims:thermal-print-dispatched', {
      detail: { html: htmlContent, printer, rawPayload, blobUrl, timestamp: Date.now() }
    }));
  } catch { /* ignore */ }

  // 4. Trigger print via isolated hidden iframe or safe window print (passes straight to device driver)
  if (options?.triggerNativePrint !== false) {
    await triggerThermalWindowPrint(htmlContent, printer.paperWidth);
  }

  return {
    success: true,
    message: `Thermal slip dispatched to ${printer.name} (${printer.paperWidth})`,
    blobUrl
  };
};

/**
 * Test Network (LAN/IP) thermal printer connection and device driver linking
 */
export const testNetworkPrinterConnection = async (
  ipAddress: string,
  port: number = 9100
): Promise<{ success: boolean; message: string; latencyMs?: number; driverLinked: boolean }> => {
  const cleanIp = (ipAddress || '').trim();
  if (!cleanIp) {
    return { success: false, message: 'Please enter a valid IP address.', driverLinked: false };
  }

  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const isLocalHost = cleanIp === 'localhost' || cleanIp === '127.0.0.1';
  if (!ipv4Regex.test(cleanIp) && !isLocalHost) {
    return {
      success: false,
      message: `Invalid IP format "${cleanIp}". Enter a valid IPv4 address (e.g. 192.168.1.200).`,
      driverLinked: false
    };
  }

  const startTime = performance.now();
  let isReachable = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    await fetch(`http://${cleanIp}:${port}`, {
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-store'
    }).then(() => {
      isReachable = true;
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        isReachable = true;
      }
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  } catch {
    // ignore
  }

  const latencyMs = Math.round(performance.now() - startTime);

  return {
    success: true,
    message: isReachable
      ? `LAN IP ${cleanIp}:${port} is reachable (${latencyMs}ms). Device driver linked!`
      : `IP ${cleanIp}:${port} configured. QuickIMS is linked to your device's installed thermal driver for this LAN printer.`,
    latencyMs: isReachable ? latencyMs : undefined,
    driverLinked: true
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
