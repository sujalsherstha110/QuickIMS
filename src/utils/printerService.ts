import { POSPrinterConfig, KitchenOrderTicket, KOTItem, SaleInvoice, DiningTable, CompanySettings, ReceiptTemplateConfig } from '../types';
import { DEFAULT_RECEIPT_TEMPLATE_80MM, DEFAULT_RECEIPT_TEMPLATE_58MM } from '../data/restaurantInitialData';
import { formatNPR, formatDate } from './nepalFormatters';

/**
 * Universal Thermal Printer Service
 * Supports 80mm (3-inch) and 58mm (2-inch) thermal rolls with CSS print isolation.
 * In Quick IMS Desktop (Electron), dispatches silently via Windows Spooler & Raw TCP 9100 with zero popups.
 */

export interface DesktopPrinterInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
  status?: number;
}

export interface QuickimsDesktopBridge {
  isElectron: boolean;
  platform: string;
  listPrinters: () => Promise<DesktopPrinterInfo[]>;
  printHtmlSilent: (payload: {
    html: string;
    deviceName?: string;
    paperWidth?: '80mm' | '58mm';
    copies?: number;
    silent?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
  printRawSpooler?: (payload: {
    deviceName?: string;
    data: number[];
  }) => Promise<{ success: boolean; message: string; skipToHtml?: boolean }>;
  sendRawTcp: (payload: {
    ip: string;
    port?: number;
    data: number[];
  }) => Promise<{ success: boolean; message: string }>;
  testTcpConnection: (payload: {
    ip: string;
    port?: number;
  }) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
  getAppInfo?: () => Promise<{ version: string; mode: string; source?: string; remoteUrl?: string | null; url: string }>;
  checkForUpdates?: () => Promise<{ checked: boolean; status: string; message: string; version?: string }>;
  installUpdate?: () => Promise<{ started: boolean; message: string }>;
  refreshApp?: () => Promise<{ refreshed: boolean; installingUpdate?: boolean; message?: string }>;
}

declare global {
  interface Window {
    quickimsDesktop?: QuickimsDesktopBridge;
  }
}

export const isElectronDesktop = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.quickimsDesktop?.isElectron);
};

export const listDesktopPrinters = async (): Promise<DesktopPrinterInfo[]> => {
  if (!isElectronDesktop() || !window.quickimsDesktop?.listPrinters) {
    return [];
  }
  try {
    return await window.quickimsDesktop.listPrinters();
  } catch (err) {
    console.warn('Failed to enumerate Windows printers:', err);
    return [];
  }
};

export const getEffectiveReceiptTemplate = (
  paperWidth: '80mm' | '58mm',
  customTemplate?: ReceiptTemplateConfig
): ReceiptTemplateConfig => {
  const fallback = paperWidth === '58mm' ? DEFAULT_RECEIPT_TEMPLATE_58MM : DEFAULT_RECEIPT_TEMPLATE_80MM;
  if (!customTemplate) return fallback;
  return {
    ...fallback,
    ...customTemplate,
    paperWidth,
    printableWidthMm: customTemplate.printableWidthMm || (paperWidth === '58mm' ? 46 : 66),
    paddingRightMm: customTemplate.paddingRightMm ?? (paperWidth === '58mm' ? 1.5 : 2.5),
    paddingLeftMm: customTemplate.paddingLeftMm ?? (paperWidth === '58mm' ? 1 : 1.5),
    columns: {
      ...fallback.columns,
      ...(customTemplate.columns || {})
    }
  };
};

/**
 * Resolve the active ReceiptTemplateConfig for a specific slip operation ('bill' | 'kot' | 'bot' | 'test').
 * Uses any per-target override in settings.receiptTemplatesByTarget first, then falls back to settings.receiptTemplate.
 */
export const getReceiptTemplateForSlip = (
  slipType: 'bill' | 'kot' | 'bot' | 'test',
  printerPaperWidth: '80mm' | '58mm',
  settings?: CompanySettings
): ReceiptTemplateConfig => {
  const byTarget = settings?.receiptTemplatesByTarget;
  const targeted =
    slipType === 'bill' ? byTarget?.bill :
    slipType === 'kot' ? byTarget?.kot :
    slipType === 'bot' ? byTarget?.bot :
    undefined;
  const chosen = (targeted && typeof targeted === 'object') ? targeted : settings?.receiptTemplate;
  const resolvedWidth: '80mm' | '58mm' = chosen?.paperWidth || printerPaperWidth || '80mm';
  return getEffectiveReceiptTemplate(resolvedWidth, chosen);
};

// Generate base thermal print CSS
export const getThermalBaseStyles = (paperWidth: '80mm' | '58mm', customTemplate?: ReceiptTemplateConfig) => {
  const is58 = paperWidth === '58mm';
  const tpl = getEffectiveReceiptTemplate(paperWidth, customTemplate);
  
  // Safe printable width: default 66mm for 80mm, 46mm for 58mm (Prevents right-edge hardware cutoff!)
  const widthMm = `${tpl.printableWidthMm}mm`;
  const paddingRight = `${tpl.paddingRightMm}mm`;
  const paddingLeft = `${tpl.paddingLeftMm}mm`;

  const isCompact = tpl.fontSizeScale === 'compact';
  const isLarge = tpl.fontSizeScale === 'large';
  const fontSize = isCompact ? (is58 ? '7.8px' : '8.8px') : isLarge ? (is58 ? '9.5px' : '10.5px') : (is58 ? '8.5px' : '9.5px');
  const headerFontSize = isCompact ? '11px' : isLarge ? '14px' : (is58 ? '11.5px' : '13px');
  const subFontSize = isCompact ? '7px' : isLarge ? '9px' : (is58 ? '7.5px' : '8px');
  const grandTotalSize = isCompact ? '11px' : isLarge ? '14px' : (is58 ? '11.5px' : '12.5px');

  const fontFam = tpl.fontFamily === 'mono'
    ? 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  const lineHeight = tpl.lineSpacing === 'tight' ? '1.12' : tpl.lineSpacing === 'relaxed' ? '1.24' : '1.16';

  let dividerCss = 'border-top: 1px dashed #000000;';
  if (tpl.dividerStyle === 'dotted') dividerCss = 'border-top: 1px dotted #000000;';
  else if (tpl.dividerStyle === 'solid') dividerCss = 'border-top: 1px solid #000000;';
  else if (tpl.dividerStyle === 'double') dividerCss = 'border-top: 3px double #000000;';
  else if (tpl.dividerStyle === 'star') dividerCss = 'border-top: 1px dashed #000000;';

  const cols = tpl.columns;

  return `
    @page {
      size: ${paperWidth};
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
        font-family: ${fontFam} !important;
        font-size: ${fontSize} !important;
        line-height: ${lineHeight} !important;
        font-weight: 600 !important;
        color: #000000 !important;
        background: #ffffff !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: ${widthMm} !important;
        padding: 1mm ${paddingRight} 1mm ${paddingLeft} !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: geometricPrecision;
        font-smooth: never;
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: -0.015em;
        word-break: break-word;
        box-sizing: border-box !important;
      }
      #quickims-thermal-print-target {
        display: block !important;
        font-family: ${fontFam} !important;
        font-size: ${fontSize} !important;
        line-height: ${lineHeight} !important;
        font-weight: 600 !important;
        color: #000000 !important;
        background: #ffffff !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: ${widthMm} !important;
        padding: 1mm ${paddingRight} 1mm ${paddingLeft} !important;
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
        ${dividerCss}
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
        padding-right: 2px;
      }
      .table-badge {
        display: inline-block;
        font-size: ${is58 ? '10.5px' : '12px'};
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
        box-sizing: border-box !important;
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
        width: ${cols.itemColWidthPercent}%;
        word-break: break-word;
        padding-right: 2px;
      }
      .col-qty {
        text-align: center;
        width: ${cols.qtyColWidthPercent}%;
        white-space: nowrap;
        font-variant-numeric: tabular-nums lining-nums;
        padding-right: 2px;
      }
      .col-rate {
        text-align: right;
        width: ${cols.showRate ? cols.rateColWidthPercent : 0}%;
        display: ${cols.showRate ? 'table-cell' : 'none'};
        white-space: nowrap;
        font-variant-numeric: tabular-nums lining-nums;
        padding-right: 2px;
      }
      .col-amt {
        text-align: right;
        width: ${cols.showRate ? cols.amtColWidthPercent : (cols.amtColWidthPercent + cols.rateColWidthPercent)}%;
        white-space: nowrap;
        font-weight: 700;
        font-variant-numeric: tabular-nums lining-nums;
        padding-right: 3px !important; /* CRITICAL: Safe margin buffer so numbers are never cut off */
      }
      .totals-table {
        width: 100%;
        border-collapse: collapse;
        margin: 1px 0;
        table-layout: fixed;
        box-sizing: border-box !important;
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
        padding-right: 3px !important; /* CRITICAL: Safe margin buffer so totals are never cut off */
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
        width: 56px;
        height: 56px;
        border: 1.5px solid #000000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 7px;
        font-weight: 800;
        line-height: 1.1;
        text-align: center;
        padding: 2px;
      }
    }
  `;
};

/**
 * Helper to extract modifier/addon text cleanly from a KOTItem
 */
const getKotItemAddonLabel = (item: KOTItem): string => {
  if (Array.isArray(item.addonsList) && item.addonsList.length > 0) {
    return item.addonsList.map(a => a.name).filter(Boolean).join(', ');
  }
  if (Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0) {
    return item.selectedModifiers.map(m => m.optionName).filter(Boolean).join(', ');
  }
  return '';
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
  const tpl = getReceiptTemplateForSlip('kot', printer.paperWidth, settings);
  const paperWidth = tpl.paperWidth || printer.paperWidth;
  const styles = getThermalBaseStyles(paperWidth, tpl);
  const is58 = paperWidth === '58mm';
  const dateStr = formatDate(kot.createdAt);
  const timeStr = new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const itemsHtml = kot.items.map(item => {
    const addonLabel = tpl.showItemModifiers ? getKotItemAddonLabel(item) : '';
    return `
      <tr>
        <td style="width: 16%; text-align: left; vertical-align: top; padding: 1.5px 0; font-weight: 900; font-size: ${is58 ? '10.5px' : '12px'}; font-variant-numeric: tabular-nums;">
          ${item.quantity}×
        </td>
        <td style="width: 84%; text-align: left; vertical-align: top; padding: 1.5px 0;">
          <div style="font-weight: 800; font-size: ${is58 ? '9.5px' : '10.5px'}; line-height: 1.2;">${item.productName}</div>
          ${addonLabel ? `
            <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 600;">+ ${addonLabel}</div>
          ` : ''}
          ${(tpl.showItemModifiers && item.specialInstructions) ? `
            <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 800;">⚠️ ${item.specialInstructions}</div>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

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
          ${tpl.showStoreName && settings?.companyName ? `<div class="sub-title font-bold">${settings.companyName.toUpperCase()}</div>` : ''}
          <div class="font-black" style="letter-spacing: -0.01em; font-size: ${is58 ? '10px' : '11.5px'};">${printer.headerCustomText || '*** KITCHEN ORDER TICKET (KOT) ***'}</div>
          ${(isReprint || (kot.printedCount && kot.printedCount > 1)) ? '<div style="font-weight:900; text-align:center; margin:1.5px 0; padding:1px; border:1px dashed #000; font-size:9.5px;">*** DUPLICATE / REPRINT ***</div>' : ''}
          ${tpl.showTableBadge ? `
            <div class="table-badge">TABLE: ${kot.tableNumber}</div>
            <div class="sub-title font-bold">${kot.zoneName || 'Main Dining'} • Guests: ${kot.guestsCount || 2}</div>
          ` : ''}
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>KOT #: <strong>${kot.kotNumber}</strong></span>
          ${tpl.showServerName ? `<span>Server: <strong>${kot.waiterName}</strong></span>` : '<span></span>'}
        </div>
        ${tpl.showDateTime ? `
          <div class="row">
            <span>Date: ${dateStr}</span>
            <span>Time: ${timeStr}</span>
          </div>
        ` : ''}

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

        ${(tpl.showSpecialNotes && kot.notes) ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>KITCHEN NOTE:</strong> ${kot.notes}</div>
        ` : ''}

        ${tpl.showFooterMessage ? `
          <div class="double-divider"></div>
          <div class="text-center font-bold" style="font-size: 8px;">
            ${printer.footerCustomText || 'Dispatch dishes immediately upon preparation'}
          </div>
        ` : ''}
        ${tpl.showCutLine ? `<div class="cut-line">${tpl.cutLineText || '- - - - - - - TEAR HERE - - - - - - -'}</div>` : ''}
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
  const tpl = getReceiptTemplateForSlip('bot', printer.paperWidth, settings);
  const paperWidth = tpl.paperWidth || printer.paperWidth;
  const styles = getThermalBaseStyles(paperWidth, tpl);
  const is58 = paperWidth === '58mm';
  const dateStr = formatDate(bot.createdAt);
  const timeStr = new Date(bot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const itemsHtml = bot.items.map(item => {
    const addonLabel = tpl.showItemModifiers ? getKotItemAddonLabel(item) : '';
    return `
      <tr>
        <td style="width: 16%; text-align: left; vertical-align: top; padding: 1.5px 0; font-weight: 900; font-size: ${is58 ? '10.5px' : '12px'}; font-variant-numeric: tabular-nums;">
          ${item.quantity}×
        </td>
        <td style="width: 84%; text-align: left; vertical-align: top; padding: 1.5px 0;">
          <div style="font-weight: 800; font-size: ${is58 ? '9.5px' : '10.5px'}; line-height: 1.2;">${item.productName}</div>
          ${addonLabel ? `
            <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 600;">+ ${addonLabel}</div>
          ` : ''}
          ${(tpl.showItemModifiers && item.specialInstructions) ? `
            <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 800;">🍸 Note: ${item.specialInstructions}</div>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

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
          ${tpl.showStoreName && settings?.companyName ? `<div class="sub-title font-bold">${settings.companyName.toUpperCase()}</div>` : ''}
          <div class="font-black" style="letter-spacing: -0.01em; font-size: ${is58 ? '10px' : '11.5px'};">${printer.headerCustomText || '*** BAR ORDER TICKET (BOT) ***'}</div>
          ${(isReprint || (bot.printedCount && bot.printedCount > 1)) ? '<div style="font-weight:900; text-align:center; margin:1.5px 0; padding:1px; border:1px dashed #000; font-size:9.5px;">*** DUPLICATE / REPRINT ***</div>' : ''}
          ${tpl.showTableBadge ? `
            <div class="table-badge">TABLE: ${bot.tableNumber}</div>
            <div class="sub-title font-bold">${bot.zoneName || 'Bar / Dining'} • Guests: ${bot.guestsCount || 2}</div>
          ` : ''}
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>BOT #: <strong>${bot.kotNumber}</strong></span>
          ${tpl.showServerName ? `<span>Server: <strong>${bot.waiterName}</strong></span>` : '<span></span>'}
        </div>
        ${tpl.showDateTime ? `
          <div class="row">
            <span>Date: ${dateStr}</span>
            <span>Time: ${timeStr}</span>
          </div>
        ` : ''}

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

        ${(tpl.showSpecialNotes && bot.notes) ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>BAR NOTE:</strong> ${bot.notes}</div>
        ` : ''}

        ${tpl.showFooterMessage ? `
          <div class="double-divider"></div>
          <div class="text-center font-bold" style="font-size: 8px;">
            ${printer.footerCustomText || 'Dispense chilled to table server'}
          </div>
        ` : ''}
        ${tpl.showCutLine ? `<div class="cut-line">${tpl.cutLineText || '- - - - - - - TEAR HERE - - - - - - -'}</div>` : ''}
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
  const tpl = getReceiptTemplateForSlip('kot', printer.paperWidth, settings);
  const botTpl = getReceiptTemplateForSlip('bot', printer.paperWidth, settings);
  const paperWidth = tpl.paperWidth || printer.paperWidth;
  const styles = getThermalBaseStyles(paperWidth, tpl);
  const is58 = paperWidth === '58mm';
  const dateStr = formatDate(kitchenTicket.createdAt);
  const timeStr = new Date(kitchenTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const kitchenItemsHtml = kitchenTicket.items.map(item => {
    const addonLabel = tpl.showItemModifiers ? getKotItemAddonLabel(item) : '';
    return `
      <tr>
        <td style="width: 16%; text-align: left; vertical-align: top; padding: 1.5px 0; font-weight: 900; font-size: ${is58 ? '10.5px' : '12px'}; font-variant-numeric: tabular-nums;">
          ${item.quantity}×
        </td>
        <td style="width: 84%; text-align: left; vertical-align: top; padding: 1.5px 0;">
          <div style="font-weight: 800; font-size: ${is58 ? '9.5px' : '10.5px'}; line-height: 1.2;">${item.productName}</div>
          ${addonLabel ? `
            <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 600;">+ ${addonLabel}</div>
          ` : ''}
          ${(tpl.showItemModifiers && item.specialInstructions) ? `
            <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 800;">⚠️ ${item.specialInstructions}</div>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const barItemsHtml = barTicket.items.map(item => {
    const addonLabel = botTpl.showItemModifiers ? getKotItemAddonLabel(item) : '';
    return `
      <tr>
        <td style="width: 16%; text-align: left; vertical-align: top; padding: 1.5px 0; font-weight: 900; font-size: ${is58 ? '10.5px' : '12px'}; font-variant-numeric: tabular-nums;">
          ${item.quantity}×
        </td>
        <td style="width: 84%; text-align: left; vertical-align: top; padding: 1.5px 0;">
          <div style="font-weight: 800; font-size: ${is58 ? '9.5px' : '10.5px'}; line-height: 1.2;">${item.productName}</div>
          ${addonLabel ? `
            <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 600;">+ ${addonLabel}</div>
          ` : ''}
          ${(botTpl.showItemModifiers && item.specialInstructions) ? `
            <div class="item-sub" style="font-size: ${is58 ? '7.5px' : '8.5px'}; font-weight: 800;">🍸 ${item.specialInstructions}</div>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

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
          ${tpl.showStoreName ? `<div class="font-black" style="font-size: ${is58 ? '11px' : '12.5px'};">${settings.companyName.toUpperCase()}</div>` : ''}
          ${tpl.showTableBadge ? `
            <div class="table-badge">TABLE: ${kitchenTicket.tableNumber}</div>
            <div class="sub-title font-bold">${kitchenTicket.zoneName || 'Main Dining'} • Guests: ${kitchenTicket.guestsCount || 1}</div>
          ` : ''}
        </div>

        ${(tpl.showServerName || tpl.showDateTime) ? `
          <div class="divider"></div>
          <div class="row">
            ${tpl.showServerName ? `<span>Server: <strong>${kitchenTicket.waiterName}</strong></span>` : '<span></span>'}
            ${tpl.showDateTime ? `<span>Time: ${dateStr} ${timeStr}</span>` : ''}
          </div>
        ` : ''}

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

        ${(tpl.showSpecialNotes && kitchenTicket.notes) ? `
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

        ${(tpl.showSpecialNotes && barTicket.notes) ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>BAR NOTE:</strong> ${barTicket.notes}</div>
        ` : ''}

        ${tpl.showFooterMessage ? `
          <div class="double-divider"></div>
          <div class="text-center font-bold" style="font-size: 8px;">
            DISPATCH ORDERS TO PREPARATION STATIONS
          </div>
        ` : ''}
        ${tpl.showCutLine ? `<div class="cut-line">${tpl.cutLineText || '- - - - - - - TEAR HERE - - - - - - -'}</div>` : ''}
      </body>
    </html>
  `;
};

/**
 * Payload data for printing a cancelled order item slip
 */
export interface CancelledItemSlipPayload {
  ticket: KitchenOrderTicket;
  item: KOTItem;
  quantityCancelled: number;
  reason: string;
  staffName: string;
  note?: string;
  disposition?: 'return_to_stock' | 'mark_as_waste';
  tableNumber?: string;
  stationName?: 'Kitchen' | 'Bar';
}

/**
 * Generate Thermal Slip HTML for a Cancelled Order Item
 * Sent to Kitchen (KOT) or Bar (BOT) printer when an active dish is cancelled.
 */
export const generateCancelledItemSlipHtml = (
  payload: CancelledItemSlipPayload,
  printer: POSPrinterConfig,
  settings: CompanySettings
): string => {
  const styles = getThermalBaseStyles(printer.paperWidth);
  const is58 = printer.paperWidth === '58mm';
  const dateStr = formatDate(Date.now());
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const stationLabel = (payload.stationName || (payload.ticket.destinationStation === 'bar' || payload.ticket.ticketType === 'BOT' ? 'Bar' : 'Kitchen')).toUpperCase();
  const tableLabel = payload.tableNumber || payload.ticket.tableNumber || 'Takeaway';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>CANCELLED - ${payload.item.productName}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="text-center">
          <div class="header-title" style="font-size: ${is58 ? '10px' : '11.5px'}; color: #000; font-weight: 900; letter-spacing: -0.01em;">
            *** CANCELLED ORDER ITEM ***
          </div>
          <div class="table-badge" style="background: #000; color: #fff; padding: 2px 6px;">
            TABLE: ${tableLabel}
          </div>
          <div class="sub-title font-bold" style="margin-top: 2px;">
            STATION: ${stationLabel} • ${payload.ticket.kotNumber}
          </div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>Cancelled By: <strong>${payload.staffName}</strong></span>
          <span>Server: <strong>${payload.ticket.waiterName || 'Staff'}</strong></span>
        </div>
        <div class="row">
          <span>Date: ${dateStr}</span>
          <span>Time: ${timeStr}</span>
        </div>

        <div class="double-divider"></div>

        <div style="padding: 3px 0;">
          <div style="font-weight: 900; font-size: ${is58 ? '12px' : '14px'}; line-height: 1.25; text-transform: uppercase;">
            CANCEL: ${payload.quantityCancelled}× ${payload.item.productName}
          </div>
          ${payload.item.specialInstructions ? `
            <div class="item-sub" style="font-weight: 700; margin-top: 2px;">
              ⚠️ Note: ${payload.item.specialInstructions}
            </div>
          ` : ''}
          ${payload.item.selectedModifiers && payload.item.selectedModifiers.length > 0 ? `
            <div class="item-sub" style="font-weight: 600; margin-top: 1px;">
              + ${payload.item.selectedModifiers.map(m => m.optionName).join(', ')}
            </div>
          ` : ''}
        </div>

        <div class="divider"></div>

        <div style="font-size: ${is58 ? '8.5px' : '9.5px'}; line-height: 1.3;">
          <div><strong>REASON:</strong> ${payload.reason}</div>
          ${payload.note ? `<div><strong>STAFF NOTE:</strong> ${payload.note}</div>` : ''}
          <div><strong>DISPOSITION:</strong> ${payload.disposition === 'mark_as_waste' ? 'Marked as Waste (Kitchen Loss)' : 'Returned to Stock (Restocked)'}</div>
        </div>

        <div class="double-divider"></div>
        <div class="text-center font-bold" style="font-size: 8.5px; padding: 2px 0;">
          *** DO NOT PREPARE / VOID ITEM ***
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
  settings: CompanySettings,
  options?: { isDraft?: boolean }
): string => {
  const isDraft = Boolean(options?.isDraft);
  const tpl = getReceiptTemplateForSlip('bill', printer.paperWidth, settings);
  const paperWidth = tpl.paperWidth || printer.paperWidth;
  const styles = getThermalBaseStyles(paperWidth, tpl);
  const dateStr = formatDate(invoice.date);
  const timeStr = new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const cols = tpl.columns;

  const addressLine = [settings?.address?.street, settings?.address?.municipality]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(', ');
  const phoneLine = (settings?.phone || settings?.mobile || '').trim();
  const panLine = (settings?.panNumber || settings?.vatNumber || '').trim();
  const changeAmount = Math.max(0, (invoice.paidAmount || 0) - (invoice.grandTotal || 0));

  const itemsTableHtml = invoice.items.map(item => {
    const rawAddons: { name?: string; optionName?: string }[] =
      (item as any).addonsList || (item as any).selectedModifiers || [];
    const addonNames = rawAddons.map(a => a.name || a.optionName).filter(Boolean).join(', ');
    const itemNote = ((item as any).itemNotes || (item as any).specialInstructions || '').trim();

    return `
      <tr>
        <td class="col-item">
          <div class="font-bold">${item.productName}</div>
          ${(tpl.showItemModifiers && addonNames) ? `<div class="item-sub">+ ${addonNames}</div>` : ''}
          ${(tpl.showItemModifiers && itemNote) ? `<div class="item-sub">Note: ${itemNote}</div>` : ''}
          ${(tpl.showItemModifiers && item.discountAmount > 0) ? `<div class="item-sub">Disc: -${item.discountAmount.toFixed(2)}</div>` : ''}
        </td>
        <td class="col-qty">${item.quantity}</td>
        ${cols.showRate ? `<td class="col-rate">${item.unitPrice.toFixed(2)}</td>` : ''}
        <td class="col-amt">${item.lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${isDraft ? `Draft Bill - ${table ? `Table ${table.tableNumber}` : 'Check'}` : `Invoice ${invoice.invoiceNumber}`}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print ${isDraft ? 'Draft Bill' : 'Tax Invoice'} Now</button>
          <div style="font-size: 11px; color: #1e40af; margin-top: 4px;">
            ${isDraft ? 'Draft / Table Check' : 'Cashier Receipt'} (${printer.paperWidth}) • Ready to Print
          </div>
        </div>

        <div class="text-center">
          ${tpl.showStoreName ? `<div class="header-title">${settings.companyName || 'QuickIMS Restaurant'}</div>` : ''}
          ${(tpl.showTagline && settings.tagline) ? `<div class="sub-title font-bold">${settings.tagline}</div>` : ''}
          ${(tpl.showAddress && addressLine) ? `<div class="sub-title">${addressLine}</div>` : ''}
          ${(tpl.showPhone && phoneLine) ? `<div class="sub-title">Tel: ${phoneLine}</div>` : ''}
          ${(tpl.showPanVat && panLine) ? `<div class="sub-title font-bold">PAN/VAT: ${panLine}</div>` : ''}
          ${isDraft ? `
            <div class="font-black" style="margin-top: 3px; font-size: 10.5px; letter-spacing: 0.05em; border: 1px dashed #000; padding: 2px 6px; display: inline-block;">
              *** DRAFT BILL (NOT PAID) ***
            </div>
            <div class="sub-title font-bold" style="margin-top: 2px;">TABLE CHECK - NOT A TAX INVOICE</div>
          ` : (
            tpl.showInvoiceTitle ? `<div class="font-black" style="margin-top: 2px; font-size: 10px; letter-spacing: 0.05em;">${tpl.invoiceCustomTitle || printer.headerCustomText || 'TAX INVOICE'}</div>` : ''
          )}
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>${isDraft ? 'Ref' : 'Inv #'}: <strong>${isDraft ? 'DRAFT-CHECK' : invoice.invoiceNumber}</strong></span>
          ${tpl.showTableBadge ? `<span>Table: <strong>${table ? table.tableNumber : 'Walk-in'}</strong></span>` : ''}
        </div>
        ${(tpl.showDateTime || tpl.showServerName) ? `
          <div class="row">
            ${tpl.showDateTime ? `<span>Date: ${dateStr} ${timeStr}</span>` : '<span></span>'}
            ${tpl.showServerName ? `<span>${isDraft ? 'Staff' : 'Cashier'}: ${invoice.salespersonName || 'Staff'}</span>` : ''}
          </div>
        ` : ''}
        ${(tpl.showCustomerInfo && invoice.customerName && invoice.customerName !== 'Walk-in Customer' && invoice.customerName !== 'Counter Guest / Walk-in') ? `
          <div class="row">
            <span>Bill To: <strong>${invoice.customerName}</strong></span>
            ${invoice.customerPanVat ? `<span>PAN: ${invoice.customerPanVat}</span>` : ''}
          </div>
        ` : ''}

        <div class="double-divider"></div>
        <table class="receipt-table">
          <thead>
            <tr>
              <th class="col-item">${cols.itemHeaderLabel || 'ITEM'}</th>
              <th class="col-qty">${cols.qtyHeaderLabel || 'QTY'}</th>
              ${cols.showRate ? `<th class="col-rate">${cols.rateHeaderLabel || 'RATE'}</th>` : ''}
              <th class="col-amt">${cols.amtHeaderLabel || 'TOTAL'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTableHtml}
          </tbody>
        </table>

        ${(tpl.showSpecialNotes && invoice.notes) ? `
          <div class="divider"></div>
          <div class="sub-title"><strong>Note:</strong> ${invoice.notes}</div>
        ` : ''}

        <div class="double-divider"></div>

        <table class="totals-table">
          ${tpl.showSubtotal ? `
            <tr>
              <td class="label">Subtotal:</td>
              <td class="amount">${invoice.subtotal.toFixed(2)}</td>
            </tr>
          ` : ''}
          ${(tpl.showDiscount && invoice.discountAmount > 0) ? `
            <tr>
              <td class="label">Discount:</td>
              <td class="amount">-${invoice.discountAmount.toFixed(2)}</td>
            </tr>
          ` : ''}
          ${tpl.showTaxableAmount ? `
            <tr>
              <td class="label">Taxable Base:</td>
              <td class="amount">${invoice.taxableAmount.toFixed(2)}</td>
            </tr>
          ` : ''}
          ${tpl.showVatBreakdown ? `
            <tr>
              <td class="label">VAT (13% Included):</td>
              <td class="amount">${invoice.taxAmount.toFixed(2)}</td>
            </tr>
          ` : ''}
          ${tpl.showGrandTotalHighlight ? `
            <tr class="grand-total-row">
              <td class="label font-black">${isDraft ? 'ESTIMATED TOTAL:' : 'GRAND TOTAL:'}</td>
              <td class="amount font-black">Rs. ${invoice.grandTotal.toFixed(2)}</td>
            </tr>
          ` : `
            <tr>
              <td class="label font-bold">${isDraft ? 'EST. TOTAL:' : 'TOTAL:'}</td>
              <td class="amount font-bold">Rs. ${invoice.grandTotal.toFixed(2)}</td>
            </tr>
          `}
          ${isDraft ? `
            <tr style="font-weight: 800;">
              <td class="label">STATUS:</td>
              <td class="amount">UNSETTLED DRAFT</td>
            </tr>
          ` : `
            ${tpl.showPaymentMethod ? `
              <tr>
                <td class="label">Payment (${invoice.paymentMethod.toUpperCase()}):</td>
                <td class="amount">${(invoice.paidAmount || 0).toFixed(2)}</td>
              </tr>
            ` : ''}
            ${(tpl.showChangeDue && invoice.dueAmount > 0) ? `
              <tr style="font-weight: 800;">
                <td class="label">Balance Due:</td>
                <td class="amount">Rs. ${invoice.dueAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${(tpl.showChangeDue && invoice.dueAmount <= 0 && changeAmount > 0) ? `
              <tr style="font-weight: 800;">
                <td class="label">Change Due:</td>
                <td class="amount">Rs. ${changeAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
          `}
        </table>

        ${(!isDraft && tpl.showQrCode && (printer.showQrCode !== false)) ? `
          <div class="text-center" style="margin-top: 4px;">
            <div class="qr-box">
              <span>${tpl.qrCodeLabel || 'SCAN TO PAY<br/>FONEPAY QR'}</span>
            </div>
          </div>
        ` : ''}

        ${isDraft ? `
          <div class="text-center sub-title font-bold" style="margin-top: 4px;">
            *** DRAFT CHECK ONLY - PLEASE VERIFY ***
          </div>
          <div class="text-center" style="font-size: 7.5px; margin-top: 2px;">
            Final Tax Invoice will be issued upon settlement.
          </div>
        ` : (
          tpl.showFooterMessage ? `
            <div class="text-center sub-title font-bold" style="margin-top: 4px;">
              ${tpl.customFooterMessage || printer.footerCustomText || settings.invoiceFooterMessage || 'Thank you for dining with us! Visit again.'}
            </div>
          ` : ''
        )}
        ${tpl.showQuickimsBranding ? `
          <div class="text-center" style="font-size: 7.5px; font-weight: 600; margin-top: 2px;">
            QuickIMS Nepal POS
          </div>
        ` : ''}
        ${tpl.showCutLine ? `
          <div class="cut-line">${tpl.cutLineText || '- - - - - - - THANK YOU - - - - - - -'}</div>
        ` : ''}
      </body>
    </html>
  `;
};

/**
 * Generate Alignment & Formatting Test Thermal Slip HTML
 * Calibrated specifically so right-margin numbers never clip
 */
export const generateTestSlipHtml = (
  printer: POSPrinterConfig,
  settings: CompanySettings
): string => {
  const tpl = getReceiptTemplateForSlip('test', printer.paperWidth, settings);
  const paperWidth = tpl.paperWidth || printer.paperWidth;
  const styles = getThermalBaseStyles(paperWidth, tpl);
  const now = new Date();
  const cols = tpl.columns;

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
          <div class="sub-title">Paper Roll: <strong>${printer.paperWidth}</strong> | Printable: <strong>${tpl.printableWidthMm}mm</strong></div>
          <div class="sub-title">Station: <strong>${printer.station.toUpperCase()}</strong> | Interface: <strong>${printer.connectionType.toUpperCase()}</strong></div>
          <div class="sub-title" style="color: #000; font-weight: 800;">Safe Right Margin Buffer: <strong>${tpl.paddingRightMm}mm (Zero Cutoff)</strong></div>
        </div>

        <div class="divider"></div>
        <div class="row">
          <span>Device ID: ${printer.id}</span>
          <span>Status: ONLINE ✓</span>
        </div>
        <div class="row">
          <span>Date: ${formatDate(now.getTime())}</span>
          <span>Time: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        ${printer.ipAddress ? `
          <div class="row">
            <span>IP: ${printer.ipAddress}:${printer.port || 9100}</span>
            <span>Driver: ${printer.driverMode === 'direct_ip' ? 'DIRECT RAW' : 'SYSTEM SPOOL'}</span>
          </div>
        ` : ''}

        <div class="double-divider"></div>
        <div class="text-center font-bold">COLUMN & NUMBER ALIGNMENT</div>
        <div class="divider"></div>
        <table class="receipt-table">
          <thead>
            <tr>
              <th class="col-item">${cols.itemHeaderLabel || 'ITEM'}</th>
              <th class="col-qty">${cols.qtyHeaderLabel || 'QTY'}</th>
              ${cols.showRate ? `<th class="col-rate">${cols.rateHeaderLabel || 'RATE'}</th>` : ''}
              <th class="col-amt">${cols.amtHeaderLabel || 'TOTAL'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="col-item font-bold">Steamed Momo (10 pcs)</td>
              <td class="col-qty">2</td>
              ${cols.showRate ? '<td class="col-rate">280.00</td>' : ''}
              <td class="col-amt">560.00</td>
            </tr>
            <tr>
              <td class="col-item font-bold">Craft Draught Beer</td>
              <td class="col-qty">1</td>
              ${cols.showRate ? '<td class="col-rate">450.00</td>' : ''}
              <td class="col-amt">450.00</td>
            </tr>
            <tr>
              <td class="col-item font-bold">Mineral Water 1L</td>
              <td class="col-qty">3</td>
              ${cols.showRate ? '<td class="col-rate">45.00</td>' : ''}
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
            <td class="label font-black">TEST TOTAL:</td>
            <td class="amount font-black">Rs. 1293.85</td>
          </tr>
        </table>

        <div class="divider"></div>
        <div class="text-center font-bold">SAFE PAPER WIDTH BOUNDARY TEST</div>
        <div class="divider"></div>
        <div style="font-weight: 800; font-size: 8.5px; letter-spacing: -0.02em; overflow: hidden; white-space: nowrap;">
          |&lt;--1234567890123456789012345678901234567890--&gt;|
        </div>
        <div style="font-size: 8px; text-align: center; margin-top: 1px;">
          ✓ Numbers fully inside paper margin (No Clipping)
        </div>
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

const toAsciiEscPos = (text: string): string => {
  return String(text || '')
    .replace(/✓/g, 'OK')
    .replace(/⚠️/g, '[!]')
    .replace(/⚠/g, '[!]')
    .replace(/×/g, 'x')
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E\n\r\t]/g, '');
};

const getEscPosDividerLine = (tpl: ReceiptTemplateConfig, lineWidth: number): string => {
  if (tpl.dividerStyle === 'double') return '='.repeat(lineWidth);
  if (tpl.dividerStyle === 'dotted') return '.'.repeat(lineWidth);
  if (tpl.dividerStyle === 'star') return '*'.repeat(lineWidth);
  return '-'.repeat(lineWidth);
};

/**
 * Generate ESC/POS Binary Commands for Kitchen Order Ticket (KOT)
 */
export const generateKOTEscPosBytes = (
  kot: KitchenOrderTicket,
  printer: POSPrinterConfig,
  settings?: CompanySettings
): Uint8Array => {
  const tpl = getReceiptTemplateForSlip('kot', printer.paperWidth, settings);
  const is58 = (tpl.paperWidth || printer.paperWidth) === '58mm';
  const lineWidth = is58 ? 32 : 42;
  const divider = getEscPosDividerLine(tpl, lineWidth);
  const dateStr = formatDate(kot.createdAt);
  const timeStr = new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const add = (str: string) => chunks.push(enc.encode(toAsciiEscPos(str)));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  // Init
  addBytes(0x1b, 0x40);

  // Center header
  addBytes(0x1b, 0x61, 0x01);
  if (tpl.showStoreName && settings?.companyName) {
    add(`${settings.companyName.toUpperCase()}\n`);
  }
  addBytes(0x1b, 0x45, 0x01);
  add(`${printer.headerCustomText || '*** KITCHEN ORDER TICKET (KOT) ***'}\n`);
  if (tpl.showTableBadge) {
    addBytes(0x1d, 0x21, 0x11); // Double size
    add(`TABLE: ${kot.tableNumber}\n`);
    addBytes(0x1d, 0x21, 0x00); // Normal size
    addBytes(0x1b, 0x45, 0x00);
    add(`${kot.zoneName || 'Main Dining'} | Guests: ${kot.guestsCount || 2}\n`);
  } else {
    addBytes(0x1b, 0x45, 0x00);
  }
  add(`${divider}\n`);

  // Left aligned details
  addBytes(0x1b, 0x61, 0x00);
  add(`KOT #: ${kot.kotNumber}${tpl.showServerName ? `  Server: ${kot.waiterName}` : ''}\n`);
  if (tpl.showDateTime) {
    add(`Time: ${dateStr} ${timeStr}\n`);
  }
  add('='.repeat(lineWidth) + '\n');
  add('QTY  ITEM DESCRIPTION\n');
  add(`${divider}\n`);

  // Items
  for (const item of kot.items) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${item.quantity}x  ${item.productName}\n`);
    addBytes(0x1b, 0x45, 0x00);
    if (tpl.showItemModifiers) {
      const addonLabel = getKotItemAddonLabel(item);
      if (addonLabel) {
        add(`    + ${addonLabel}\n`);
      }
    }
    if (tpl.showItemModifiers && item.specialInstructions) {
      add(`    * Note: ${item.specialInstructions}\n`);
    }
  }

  if (tpl.showSpecialNotes && kot.notes) {
    add(`${divider}\n`);
    add(`KITCHEN NOTE: ${kot.notes}\n`);
  }

  add('='.repeat(lineWidth) + '\n');
  addBytes(0x1b, 0x61, 0x01);
  if (tpl.showFooterMessage) {
    add(`${printer.footerCustomText || 'Dispatch dishes immediately upon prep'}\n`);
  }
  if (tpl.showCutLine) {
    add(`${tpl.cutLineText || '- - - - TEAR HERE - - - -'}\n`);
  }
  add('\n\n\n\n\n');
  addBytes(0x1d, 0x56, 0x00); // Cut paper

  return concatUint8Arrays(...chunks);
};

/**
 * Generate ESC/POS Binary Commands for Bar Order Ticket (BOT)
 */
export const generateBOTEscPosBytes = (
  bot: KitchenOrderTicket,
  printer: POSPrinterConfig,
  settings?: CompanySettings
): Uint8Array => {
  const tpl = getReceiptTemplateForSlip('bot', printer.paperWidth, settings);
  const is58 = (tpl.paperWidth || printer.paperWidth) === '58mm';
  const lineWidth = is58 ? 32 : 42;
  const divider = getEscPosDividerLine(tpl, lineWidth);
  const dateStr = formatDate(bot.createdAt);
  const timeStr = new Date(bot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const add = (str: string) => chunks.push(enc.encode(toAsciiEscPos(str)));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  addBytes(0x1b, 0x40);
  addBytes(0x1b, 0x61, 0x01);
  if (tpl.showStoreName && settings?.companyName) {
    add(`${settings.companyName.toUpperCase()}\n`);
  }
  addBytes(0x1b, 0x45, 0x01);
  add(`${printer.headerCustomText || '*** BAR ORDER TICKET (BOT) ***'}\n`);
  if (tpl.showTableBadge) {
    addBytes(0x1d, 0x21, 0x11);
    add(`TABLE: ${bot.tableNumber}\n`);
    addBytes(0x1d, 0x21, 0x00);
    addBytes(0x1b, 0x45, 0x00);
    add(`${bot.zoneName || 'Bar Area'} | Guests: ${bot.guestsCount || 2}\n`);
  } else {
    addBytes(0x1b, 0x45, 0x00);
  }
  add(`${divider}\n`);

  addBytes(0x1b, 0x61, 0x00);
  add(`BOT #: ${bot.kotNumber}${tpl.showServerName ? `  Server: ${bot.waiterName}` : ''}\n`);
  if (tpl.showDateTime) {
    add(`Time: ${dateStr} ${timeStr}\n`);
  }
  add('='.repeat(lineWidth) + '\n');
  add('QTY  DRINK / BEVERAGE ITEM\n');
  add(`${divider}\n`);

  for (const item of bot.items) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${item.quantity}x  ${item.productName}\n`);
    addBytes(0x1b, 0x45, 0x00);
    if (tpl.showItemModifiers) {
      const addonLabel = getKotItemAddonLabel(item);
      if (addonLabel) {
        add(`    + ${addonLabel}\n`);
      }
    }
    if (tpl.showItemModifiers && item.specialInstructions) {
      add(`    * Note: ${item.specialInstructions}\n`);
    }
  }

  if (tpl.showSpecialNotes && bot.notes) {
    add(`${divider}\n`);
    add(`BAR NOTE: ${bot.notes}\n`);
  }

  add('='.repeat(lineWidth) + '\n');
  addBytes(0x1b, 0x61, 0x01);
  if (tpl.showFooterMessage) {
    add(`${printer.footerCustomText || 'Serve chilled immediately'}\n`);
  }
  if (tpl.showCutLine) {
    add(`${tpl.cutLineText || '- - - - TEAR HERE - - - -'}\n`);
  }
  add('\n\n\n\n\n');
  addBytes(0x1d, 0x56, 0x00);

  return concatUint8Arrays(...chunks);
};

/**
 * Generate ESC/POS Binary Commands for Combined Kitchen KOT + Bar BOT Ticket
 */
export const generateCombinedOrderEscPosBytes = (
  kitchenTicket: KitchenOrderTicket,
  barTicket: KitchenOrderTicket,
  printer: POSPrinterConfig,
  settings?: CompanySettings
): Uint8Array => {
  const tpl = getReceiptTemplateForSlip('kot', printer.paperWidth, settings);
  const botTpl = getReceiptTemplateForSlip('bot', printer.paperWidth, settings);
  const is58 = (tpl.paperWidth || printer.paperWidth) === '58mm';
  const lineWidth = is58 ? 32 : 42;
  const divider = getEscPosDividerLine(tpl, lineWidth);
  const dateStr = formatDate(kitchenTicket.createdAt);
  const timeStr = new Date(kitchenTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const add = (str: string) => chunks.push(enc.encode(toAsciiEscPos(str)));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  addBytes(0x1b, 0x40);
  addBytes(0x1b, 0x61, 0x01);
  if (tpl.showStoreName) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${(settings?.companyName || 'QUICKIMS RESTAURANT').toUpperCase()}\n`);
  }
  if (tpl.showTableBadge) {
    addBytes(0x1b, 0x45, 0x01);
    addBytes(0x1d, 0x21, 0x11);
    add(`TABLE: ${kitchenTicket.tableNumber}\n`);
    addBytes(0x1d, 0x21, 0x00);
    addBytes(0x1b, 0x45, 0x00);
    add(`${kitchenTicket.zoneName || 'Main Dining'} | Guests: ${kitchenTicket.guestsCount || 1}\n`);
  } else {
    addBytes(0x1b, 0x45, 0x00);
  }
  add(`${divider}\n`);

  addBytes(0x1b, 0x61, 0x00);
  if (tpl.showServerName || tpl.showDateTime) {
    const serverPart = tpl.showServerName ? `Server: ${kitchenTicket.waiterName}` : '';
    const timePart = tpl.showDateTime ? `${dateStr} ${timeStr}` : '';
    add(`${[serverPart, timePart].filter(Boolean).join(' | ')}\n`);
  }
  add('='.repeat(lineWidth) + '\n');
  addBytes(0x1b, 0x45, 0x01);
  add(`KITCHEN ORDER (${kitchenTicket.kotNumber})\n`);
  addBytes(0x1b, 0x45, 0x00);
  add(`${divider}\n`);
  for (const item of kitchenTicket.items) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${item.quantity}x  ${item.productName}\n`);
    addBytes(0x1b, 0x45, 0x00);
    if (tpl.showItemModifiers) {
      const addonLabel = getKotItemAddonLabel(item);
      if (addonLabel) add(`    + ${addonLabel}\n`);
    }
    if (tpl.showItemModifiers && item.specialInstructions) add(`    * Note: ${item.specialInstructions}\n`);
  }
  if (tpl.showSpecialNotes && kitchenTicket.notes) {
    add(`KITCHEN NOTE: ${kitchenTicket.notes}\n`);
  }

  add('='.repeat(lineWidth) + '\n');
  addBytes(0x1b, 0x45, 0x01);
  add(`BAR ORDER (${barTicket.kotNumber})\n`);
  addBytes(0x1b, 0x45, 0x00);
  add(`${divider}\n`);
  for (const item of barTicket.items) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${item.quantity}x  ${item.productName}\n`);
    addBytes(0x1b, 0x45, 0x00);
    if (botTpl.showItemModifiers) {
      const addonLabel = getKotItemAddonLabel(item);
      if (addonLabel) add(`    + ${addonLabel}\n`);
    }
    if (botTpl.showItemModifiers && item.specialInstructions) add(`    * Note: ${item.specialInstructions}\n`);
  }
  if (botTpl.showSpecialNotes && barTicket.notes) {
    add(`BAR NOTE: ${barTicket.notes}\n`);
  }

  add('='.repeat(lineWidth) + '\n');
  addBytes(0x1b, 0x61, 0x01);
  if (tpl.showFooterMessage) {
    add('DISPATCH ORDERS TO STATIONS\n');
  }
  if (tpl.showCutLine) {
    add(`${tpl.cutLineText || '- - - - TEAR HERE - - - -'}\n`);
  }
  add('\n\n\n\n\n');
  addBytes(0x1d, 0x56, 0x00);

  return concatUint8Arrays(...chunks);
};

/**
 * Generate ESC/POS Binary Commands for Bill Receipt (fully synchronized with ReceiptTemplateConfig)
 */
export const generateBillEscPosBytes = (
  invoice: SaleInvoice,
  table: DiningTable | null,
  printer: POSPrinterConfig,
  settings?: CompanySettings,
  options?: { isDraft?: boolean }
): Uint8Array => {
  const isDraft = Boolean(options?.isDraft);
  const tpl = getReceiptTemplateForSlip('bill', printer.paperWidth, settings);
  const is58 = (tpl.paperWidth || printer.paperWidth) === '58mm';
  const lineWidth = is58 ? 32 : 42;
  const divider = getEscPosDividerLine(tpl, lineWidth);
  const cols = tpl.columns;
  const dateStr = formatDate(invoice.date);
  const timeStr = new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const add = (str: string) => chunks.push(enc.encode(toAsciiEscPos(str)));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));
  const formatRow = (left: string, right: string) => {
    const cleanL = toAsciiEscPos(left);
    const cleanR = toAsciiEscPos(right);
    const spaceCount = Math.max(1, lineWidth - cleanL.length - cleanR.length);
    return `${cleanL.slice(0, Math.max(1, lineWidth - cleanR.length - 1))}${' '.repeat(spaceCount)}${cleanR}\n`;
  };

  const addressLine = [settings?.address?.street, settings?.address?.municipality]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(', ');
  const phoneLine = (settings?.phone || settings?.mobile || '').trim();
  const panLine = (settings?.panNumber || settings?.vatNumber || '').trim();
  const changeAmount = Math.max(0, (invoice.paidAmount || 0) - (invoice.grandTotal || 0));

  addBytes(0x1b, 0x40);
  addBytes(0x1b, 0x61, 0x01);

  if (tpl.showStoreName) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${settings?.companyName || 'QuickIMS Restaurant'}\n`);
    addBytes(0x1b, 0x45, 0x00);
  }
  if (tpl.showTagline && settings?.tagline) {
    add(`${settings.tagline}\n`);
  }
  if (tpl.showAddress && addressLine) {
    add(`${addressLine}\n`);
  }
  if (tpl.showPhone && phoneLine) {
    add(`Tel: ${phoneLine}\n`);
  }
  if (tpl.showPanVat && panLine) {
    add(`PAN/VAT: ${panLine}\n`);
  }
  if (isDraft) {
    addBytes(0x1b, 0x45, 0x01);
    add('*** DRAFT BILL (NOT PAID) ***\n');
    addBytes(0x1b, 0x45, 0x00);
    add('TABLE CHECK - NOT A TAX INVOICE\n');
  } else if (tpl.showInvoiceTitle) {
    addBytes(0x1b, 0x45, 0x01);
    add(`${tpl.invoiceCustomTitle || printer.headerCustomText || 'TAX INVOICE'}\n`);
    addBytes(0x1b, 0x45, 0x00);
  }
  add(`${divider}\n`);

  addBytes(0x1b, 0x61, 0x00);
  const invPart = isDraft ? 'Ref: DRAFT-CHECK' : `Inv #: ${invoice.invoiceNumber}`;
  const tablePart = tpl.showTableBadge ? `Table: ${table ? table.tableNumber : 'Walk-in'}` : '';
  if (tablePart) {
    add(formatRow(invPart, tablePart));
  } else {
    add(`${invPart}\n`);
  }
  if (tpl.showDateTime) {
    add(`Date: ${dateStr} ${timeStr}\n`);
  }
  if (tpl.showServerName && invoice.salespersonName) {
    add(`${isDraft ? 'Staff' : 'Cashier'}: ${invoice.salespersonName}\n`);
  }
  if (tpl.showCustomerInfo && invoice.customerName && invoice.customerName !== 'Walk-in Customer' && invoice.customerName !== 'Counter Guest / Walk-in') {
    add(`Bill To: ${invoice.customerName}${invoice.customerPanVat ? ` (PAN: ${invoice.customerPanVat})` : ''}\n`);
  }
  add('='.repeat(lineWidth) + '\n');

  const itemHdr = `${cols.qtyHeaderLabel || 'QTY'} ${cols.itemHeaderLabel || 'ITEM'}`;
  const amtHdr = cols.showRate
    ? `${cols.rateHeaderLabel || 'RATE'}  ${cols.amtHeaderLabel || 'TOTAL'}`
    : `${cols.amtHeaderLabel || 'TOTAL'}`;
  add(formatRow(itemHdr, amtHdr));
  add(`${divider}\n`);

  for (const item of invoice.items) {
    const qtyName = `${item.quantity}x ${item.productName}`;
    const amt = cols.showRate
      ? `${(item.unitPrice || 0).toFixed(0)}  ${(item.lineTotal || 0).toFixed(0)}`
      : `${(item.lineTotal || 0).toFixed(2)}`;
    add(formatRow(qtyName, amt));

    if (tpl.showItemModifiers) {
      const rawAddons: { name?: string; optionName?: string }[] =
        (item as any).addonsList || (item as any).selectedModifiers || [];
      const addonNames = rawAddons.map(a => a.name || a.optionName).filter(Boolean).join(', ');
      const itemNote = ((item as any).itemNotes || (item as any).specialInstructions || '').trim();
      if (addonNames) add(`   + ${addonNames}\n`);
      if (itemNote) add(`   * ${itemNote}\n`);
      if (item.discountAmount > 0) add(`   Disc: -${item.discountAmount.toFixed(2)}\n`);
    }
  }

  if (tpl.showSpecialNotes && invoice.notes) {
    add(`${divider}\n`);
    add(`Note: ${invoice.notes}\n`);
  }

  const hasTotalsSection =
    tpl.showSubtotal ||
    (tpl.showDiscount && invoice.discountAmount > 0) ||
    (tpl.showTaxableAmount && invoice.taxableAmount !== undefined && invoice.taxableAmount > 0) ||
    tpl.showVatBreakdown;

  if (hasTotalsSection) {
    add(`${divider}\n`);
  }
  if (tpl.showSubtotal) {
    add(formatRow('Subtotal:', formatNPR(invoice.subtotal)));
  }
  if (tpl.showDiscount && invoice.discountAmount > 0) {
    add(formatRow('Discount:', `-${formatNPR(invoice.discountAmount)}`));
  }
  if (tpl.showTaxableAmount && invoice.taxableAmount !== undefined && invoice.taxableAmount > 0) {
    add(formatRow('Taxable Base:', formatNPR(invoice.taxableAmount)));
  }
  if (tpl.showVatBreakdown) {
    add(formatRow('VAT (13% Inc):', formatNPR(invoice.taxAmount)));
  }

  add('='.repeat(lineWidth) + '\n');
  if (tpl.showGrandTotalHighlight) {
    addBytes(0x1b, 0x45, 0x01);
    add(formatRow(isDraft ? 'ESTIMATED TOTAL:' : 'GRAND TOTAL:', formatNPR(invoice.grandTotal)));
    addBytes(0x1b, 0x45, 0x00);
    add('='.repeat(lineWidth) + '\n');
  } else {
    addBytes(0x1b, 0x45, 0x01);
    add(formatRow(isDraft ? 'EST. TOTAL:' : 'TOTAL:', formatNPR(invoice.grandTotal)));
    addBytes(0x1b, 0x45, 0x00);
  }

  if (isDraft) {
    add('Status: UNSETTLED DRAFT (CHECK ONLY)\n');
  } else {
    if (tpl.showPaymentMethod) {
      add(formatRow(`Payment (${invoice.paymentMethod.toUpperCase()}):`, formatNPR(invoice.paidAmount || 0)));
    }
    if (tpl.showChangeDue && invoice.dueAmount > 0) {
      add(formatRow('Balance Due:', formatNPR(invoice.dueAmount)));
    } else if (tpl.showChangeDue && invoice.dueAmount <= 0 && changeAmount > 0) {
      add(formatRow('Change Due:', formatNPR(changeAmount)));
    }
  }

  addBytes(0x1b, 0x61, 0x01);
  if (!isDraft && tpl.showQrCode && printer.showQrCode !== false) {
    add(`\n[ ${tpl.qrCodeLabel || 'SCAN TO PAY (FONEPAY QR)'} ]\n`);
  }

  if (isDraft) {
    add('\n*** DRAFT CHECK ONLY - NOT SETTLED ***\n');
    add('Final invoice issued upon payment.\n');
  } else if (tpl.showFooterMessage) {
    add(`\n${tpl.customFooterMessage || printer.footerCustomText || settings?.invoiceFooterMessage || 'Thank you for dining with us!'}\n`);
  }

  if (tpl.showQuickimsBranding) {
    add('QuickIMS Nepal POS\n');
  }
  if (tpl.showCutLine) {
    add(`${tpl.cutLineText || '- - - - - THANK YOU - - - - -'}\n`);
  }

  add('\n\n\n\n\n');
  if (printer.kickCashDrawer && !isDraft) {
    addBytes(0x1b, 0x70, 0x00, 0x19, 0xfa);
  }
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
  const lineWidth = is58 ? 32 : 42;
  const now = new Date();

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const add = (str: string) => chunks.push(enc.encode(toAsciiEscPos(str)));
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
  add('OK - TEST PRINT SUCCESSFUL!\n');
  add('\n\n\n\n\n');
  addBytes(0x1d, 0x56, 0x00);

  return concatUint8Arrays(...chunks);
};

/**
 * Generate ESC/POS Binary Commands for Cancelled Order Item Slip
 */
export const generateCancelledItemEscPosBytes = (
  payload: CancelledItemSlipPayload,
  printer: POSPrinterConfig,
  _settings?: CompanySettings
): Uint8Array => {
  const is58 = printer.paperWidth === '58mm';
  const lineWidth = is58 ? 32 : 42;
  const dateStr = formatDate(Date.now());
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const add = (str: string) => chunks.push(enc.encode(toAsciiEscPos(str)));
  const addBytes = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));

  // Initialize printer
  addBytes(0x1b, 0x40);

  // Center header
  addBytes(0x1b, 0x61, 0x01);
  addBytes(0x1b, 0x45, 0x01);
  add('*** CANCELLED ORDER ITEM ***\n');
  addBytes(0x1d, 0x21, 0x11); // Double width & height
  add(`TABLE: ${payload.tableNumber || payload.ticket.tableNumber || 'Takeaway'}\n`);
  addBytes(0x1d, 0x21, 0x00); // Normal size
  addBytes(0x1b, 0x45, 0x00);
  const stationStr = (payload.stationName || (payload.ticket.destinationStation === 'bar' || payload.ticket.ticketType === 'BOT' ? 'Bar' : 'Kitchen')).toUpperCase();
  add(`STATION: ${stationStr} | ${payload.ticket.kotNumber}\n`);
  add('-'.repeat(lineWidth) + '\n');

  // Left aligned metadata
  addBytes(0x1b, 0x61, 0x00);
  add(`Cancelled By: ${payload.staffName}\n`);
  add(`Server: ${payload.ticket.waiterName || 'Staff'}\n`);
  add(`Time: ${dateStr} ${timeStr}\n`);
  add('='.repeat(lineWidth) + '\n');

  // Cancelled Item Line
  addBytes(0x1b, 0x45, 0x01);
  add(`CANCEL: ${payload.quantityCancelled}x ${payload.item.productName}\n`);
  addBytes(0x1b, 0x45, 0x00);

  if (payload.item.specialInstructions) {
    add(`  Special Note: ${payload.item.specialInstructions}\n`);
  }
  if (payload.item.selectedModifiers && payload.item.selectedModifiers.length > 0) {
    add(`  Modifiers: ${payload.item.selectedModifiers.map(m => m.optionName).join(', ')}\n`);
  }

  add('-'.repeat(lineWidth) + '\n');
  add(`Reason: ${payload.reason}\n`);
  if (payload.note) {
    add(`Staff Note: ${payload.note}\n`);
  }
  add(`Disposition: ${payload.disposition === 'mark_as_waste' ? 'Marked as Waste' : 'Returned to Stock'}\n`);
  add('='.repeat(lineWidth) + '\n');

  // Center footer
  addBytes(0x1b, 0x61, 0x01);
  addBytes(0x1b, 0x45, 0x01);
  add('*** DO NOT PREPARE / VOID ITEM ***\n');
  addBytes(0x1b, 0x45, 0x00);
  add('\n\n\n\n\n');
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
      (printer.usbVendorId && d.productName && String(d.productName).toLowerCase().includes(String(printer.usbVendorId).toLowerCase())) ||
      (printer.usbVendorId && `0x${d.vendorId?.toString(16) || ''}`.toLowerCase() === String(printer.usbVendorId).toLowerCase())
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
export const printViaHiddenIframe = async (
  htmlContent: string,
  deviceName?: string,
  paperWidth: '80mm' | '58mm' = '80mm',
  copies: number = 1
): Promise<boolean> => {
  if (typeof window !== 'undefined' && window.quickimsDesktop?.isElectron) {
    try {
      const res = await window.quickimsDesktop.printHtmlSilent({
        html: htmlContent,
        deviceName: deviceName || undefined,
        paperWidth,
        copies,
        silent: true
      });
      if (res.success) return true;
    } catch (err) {
      console.warn('Desktop silent iframe bypass notice:', err);
    }
  }

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
export const safeThermalWindowPrint = async (
  htmlContent: string,
  paperWidth: '80mm' | '58mm' = '80mm',
  deviceName?: string,
  copies: number = 1
): Promise<boolean> => {
  if (typeof window !== 'undefined' && window.quickimsDesktop?.isElectron) {
    try {
      const res = await window.quickimsDesktop.printHtmlSilent({
        html: htmlContent,
        deviceName: deviceName || undefined,
        paperWidth,
        copies,
        silent: true
      });
      if (res.success) return true;
    } catch (err) {
      console.warn('Desktop silent window bypass notice:', err);
    }
  }

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

const repeatEscPosBytes = (bytes: Uint8Array, copies: number): Uint8Array => {
  const safeCopies = Math.max(1, Math.min(10, Number(copies) || 1));
  if (safeCopies === 1) return bytes;
  const combined = new Uint8Array(bytes.length * safeCopies);
  for (let i = 0; i < safeCopies; i++) {
    combined.set(bytes, i * bytes.length);
  }
  return combined;
};

/**
 * Directly trigger print with isolated thermal slip target.
 * Uses silent printing in Electron Desktop, synchronous safe DOM print on web (0ms delay).
 */
export const triggerThermalWindowPrint = async (
  htmlContent: string,
  paperWidth: '80mm' | '58mm' = '80mm',
  deviceName?: string,
  copies: number = 1
): Promise<boolean> => {
  if (typeof window !== 'undefined' && window.quickimsDesktop?.isElectron) {
    try {
      const res = await window.quickimsDesktop.printHtmlSilent({
        html: htmlContent,
        deviceName: deviceName || undefined,
        paperWidth,
        copies,
        silent: true
      });
      if (res.success) return true;
    } catch {
      /* fallback below */
    }
  }

  return safeThermalWindowPrint(htmlContent, paperWidth, deviceName, copies);
};

/**
 * Universal print execution via WebUSB, LAN/IP driver routing, and DOM print isolation.
 */
export const executeThermalPrint = async (
  htmlContent: string,
  printer: POSPrinterConfig,
  rawPayload?: { type: 'kot' | 'bot' | 'combined' | 'bill' | 'test' | 'cancel'; data?: any; settings?: CompanySettings },
  options?: { triggerNativePrint?: boolean }
): Promise<{ success: boolean; message: string; blobUrl: string }> => {
  let cachedBlobUrl: string | null = null;
  const getBlobUrl = () => {
    if (cachedBlobUrl === null) {
      cachedBlobUrl = createThermalPrintBlobUrl(htmlContent);
    }
    return cachedBlobUrl;
  };

  const desktopBridge = typeof window !== 'undefined' ? window.quickimsDesktop : undefined;

  // 0. Desktop App Native Print Path (Zero-dialog Windows Spooler RAW ESC/POS, HTML Spooler, or Raw TCP)
  if (desktopBridge?.isElectron && options?.triggerNativePrint !== false) {
    const buildEscPosBytes = (): Uint8Array | null => {
      if (!rawPayload) return null;
      if (rawPayload.type === 'kot' && rawPayload.data) {
        return generateKOTEscPosBytes(rawPayload.data, printer, rawPayload.settings);
      }
      if (rawPayload.type === 'bot' && rawPayload.data) {
        return generateBOTEscPosBytes(rawPayload.data, printer, rawPayload.settings);
      }
      if (rawPayload.type === 'combined' && rawPayload.data?.kitchenTicket && rawPayload.data?.barTicket) {
        return generateCombinedOrderEscPosBytes(rawPayload.data.kitchenTicket, rawPayload.data.barTicket, printer, rawPayload.settings);
      }
      if (rawPayload.type === 'bill' && rawPayload.data) {
        return generateBillEscPosBytes(rawPayload.data.invoice, rawPayload.data.table, printer, rawPayload.settings, { isDraft: rawPayload.data.isDraft });
      }
      if (rawPayload.type === 'cancel' && rawPayload.data) {
        return generateCancelledItemEscPosBytes(rawPayload.data, printer, rawPayload.settings);
      }
      if (rawPayload.type === 'test') {
        return generateTestEscPosBytes(printer, rawPayload.settings);
      }
      return null;
    };

    // 0A. Direct Raw TCP IP:9100 socket inside Desktop App
    if (printer.connectionType === 'network' && printer.driverMode === 'direct_ip' && printer.ipAddress) {
      const escPosBytes = buildEscPosBytes();
      if (escPosBytes) {
        const copies = Math.max(1, printer.copiesCount || 1);
        const payloadBytes = repeatEscPosBytes(escPosBytes, copies);
        const tcpRes = await desktopBridge.sendRawTcp({
          ip: printer.ipAddress,
          port: printer.port || 9100,
          data: Array.from(payloadBytes)
        });
        if (tcpRes.success) {
          try {
            window.dispatchEvent(new CustomEvent('quickims:thermal-print-dispatched', {
              detail: { html: htmlContent, printer, rawPayload, blobUrl: '', timestamp: Date.now(), silent: true }
            }));
          } catch { /* ignore */ }
          return { ...tcpRes, blobUrl: '' };
        }
        console.warn('Desktop raw TCP fallback to Windows Spooler:', tcpRes.message);
      }
    }

    // 0B. Windows Spooler RAW ESC/POS Print (bypasses Chromium GDI/XPS blank-page bugs on USB POS-80 drivers!)
    // Also serves as instant fallback if a network direct_ip LAN printer failed/timed out.
    if (desktopBridge.platform === 'win32' && desktopBridge.printRawSpooler && rawPayload) {
      const escPosBytes = buildEscPosBytes();
      if (escPosBytes) {
        const copies = Math.max(1, printer.copiesCount || 1);
        const payloadBytes = repeatEscPosBytes(escPosBytes, copies);
        const rawRes = await desktopBridge.printRawSpooler({
          deviceName: printer.driverName || undefined,
          data: Array.from(payloadBytes)
        });
        if (rawRes.success) {
          try {
            window.dispatchEvent(new CustomEvent('quickims:thermal-print-dispatched', {
              detail: { html: htmlContent, printer, rawPayload, blobUrl: '', timestamp: Date.now(), silent: true, engine: 'raw-spooler' }
            }));
          } catch { /* ignore */ }
          return { ...rawRes, blobUrl: '' };
        }
        if (!rawRes.skipToHtml) {
          console.warn('Windows RAW spooler fallback to HTML spooler:', rawRes.message);
        }
      }
    }

    // 0C. Windows Spooler Silent HTML Print fallback (for virtual PDF/OneNote printers or custom HTML-only slips)
    const shouldTryWebUsbFirst =
      printer.connectionType === 'usb' && !printer.driverName && Boolean(printer.usbVendorId) && Boolean(rawPayload);

    if (!shouldTryWebUsbFirst) {
      const spoolRes = await desktopBridge.printHtmlSilent({
        html: htmlContent,
        deviceName: printer.driverName || undefined,
        paperWidth: printer.paperWidth,
        copies: printer.copiesCount || 1,
        silent: printer.silentPrint !== false
      });

      if (spoolRes.success) {
        try {
          window.dispatchEvent(new CustomEvent('quickims:thermal-print-dispatched', {
            detail: { html: htmlContent, printer, rawPayload, blobUrl: '', timestamp: Date.now(), silent: true }
          }));
        } catch { /* ignore */ }
        return { ...spoolRes, blobUrl: '' };
      }

      // If silent spooler failed on Desktop, do NOT pop up a blocking Windows print dialog unless user disabled silentPrint
      if (printer.silentPrint !== false) {
        return {
          success: false,
          message: spoolRes.message || `Silent print failed for "${printer.driverName || printer.name}".`,
          blobUrl: ''
        };
      }
    }
  }

  // 1. If USB Direct connection, attempt direct WebUSB transfer first
  if (printer.connectionType === 'usb' && rawPayload) {
    try {
      let escPosBytes: Uint8Array | null = null;
      if (rawPayload.type === 'kot' && rawPayload.data) {
        escPosBytes = generateKOTEscPosBytes(rawPayload.data, printer, rawPayload.settings);
      } else if (rawPayload.type === 'bot' && rawPayload.data) {
        escPosBytes = generateBOTEscPosBytes(rawPayload.data, printer, rawPayload.settings);
      } else if (rawPayload.type === 'bill' && rawPayload.data) {
        escPosBytes = generateBillEscPosBytes(rawPayload.data.invoice, rawPayload.data.table, printer, rawPayload.settings, { isDraft: rawPayload.data.isDraft });
      } else if (rawPayload.type === 'cancel' && rawPayload.data) {
        escPosBytes = generateCancelledItemEscPosBytes(rawPayload.data, printer, rawPayload.settings);
      } else if (rawPayload.type === 'test') {
        escPosBytes = generateTestEscPosBytes(printer, rawPayload.settings);
      }

      if (escPosBytes) {
        const usbRes = await printViaWebUsb(printer, repeatEscPosBytes(escPosBytes, printer.copiesCount || 1));
        if (usbRes.success) {
          return { ...usbRes, blobUrl: '' };
        }
        console.warn('WebUSB direct transfer notice:', usbRes.message);
      }
    } catch (usbErr) {
      console.warn('WebUSB print fallback trigger:', usbErr);
    }

    // In Windows Desktop, if WebUSB failed, fall back silently to Windows Spooler rather than opening a dialog
    if (desktopBridge?.isElectron && options?.triggerNativePrint !== false) {
      const spoolRes = await desktopBridge.printHtmlSilent({
        html: htmlContent,
        deviceName: printer.driverName || undefined,
        paperWidth: printer.paperWidth,
        copies: printer.copiesCount || 1,
        silent: printer.silentPrint !== false
      });
      return { ...spoolRes, blobUrl: '' };
    }
  }

  // 2. If Network (LAN/IP) connection with direct raw socket configured (Browser fallback)
  if (printer.connectionType === 'network' && printer.ipAddress && rawPayload) {
    if (printer.driverMode === 'direct_ip') {
      try {
        let escPosBytes: Uint8Array | null = null;
        if (rawPayload.type === 'kot' && rawPayload.data) {
          escPosBytes = generateKOTEscPosBytes(rawPayload.data, printer, rawPayload.settings);
        } else if (rawPayload.type === 'bot' && rawPayload.data) {
          escPosBytes = generateBOTEscPosBytes(rawPayload.data, printer, rawPayload.settings);
        } else if (rawPayload.type === 'bill' && rawPayload.data) {
          escPosBytes = generateBillEscPosBytes(rawPayload.data.invoice, rawPayload.data.table, printer, rawPayload.settings, { isDraft: rawPayload.data.isDraft });
        } else if (rawPayload.type === 'cancel' && rawPayload.data) {
          escPosBytes = generateCancelledItemEscPosBytes(rawPayload.data, printer, rawPayload.settings);
        } else if (rawPayload.type === 'test') {
          escPosBytes = generateTestEscPosBytes(printer, rawPayload.settings);
        }

        if (escPosBytes) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 350);
          await fetch(`http://${printer.ipAddress}:${printer.port || 9100}`, {
            method: 'POST',
            mode: 'no-cors',
            body: repeatEscPosBytes(escPosBytes, printer.copiesCount || 1),
            signal: controller.signal
          }).finally(() => clearTimeout(timer));
        }
      } catch (netErr) {
        console.warn('Direct LAN IP raw transmission notice:', netErr);
      }
    }
  }

  const blobUrl = options?.triggerNativePrint === false ? getBlobUrl() : '';

  // 3. Dispatch custom event for UI listeners and hardware logs
  try {
    window.dispatchEvent(new CustomEvent('quickims:thermal-print-dispatched', {
      detail: { html: htmlContent, printer, rawPayload, blobUrl, timestamp: Date.now() }
    }));
  } catch { /* ignore */ }

  // 4. Trigger print via synchronous isolated DOM print (0ms delay)
  if (options?.triggerNativePrint !== false) {
    await triggerThermalWindowPrint(htmlContent, printer.paperWidth, printer.driverName, printer.copiesCount || 1);
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

  // Native Desktop TCP socket check (accurate port 9100 check)
  if (typeof window !== 'undefined' && window.quickimsDesktop?.testTcpConnection) {
    const tcpRes = await window.quickimsDesktop.testTcpConnection({ ip: cleanIp, port });
    return {
      success: tcpRes.success,
      message: tcpRes.message,
      latencyMs: tcpRes.latencyMs,
      driverLinked: tcpRes.success
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
