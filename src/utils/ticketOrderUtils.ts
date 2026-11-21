import {
  DiningTable,
  KOTItem,
  KitchenOrderTicket,
  Product,
  SaleInvoice,
  SaleItem
} from '../types';
import { doesTicketBelongToTable } from './tableOperations';

export type RoutingStation = 'kitchen' | 'bar';

export interface AddonEntry {
  name: string;
  price: number;
}

/**
 * Resolves Kitchen vs Bar routing consistently across cart additions,
 * fired KOT/BOT splitting, and live ticket billing.
 */
export const resolveItemRoutingStation = (params: {
  explicitStation?: string;
  ticketStation?: string;
  ticketType?: string;
  kotNumber?: string;
  course?: string;
  product?: Pick<Product, 'orderRoutingStation' | 'department' | 'itemType' | 'category'> | null;
  productName?: string;
}): RoutingStation => {
  const {
    explicitStation,
    ticketStation,
    ticketType,
    kotNumber,
    course,
    product,
    productName
  } = params;

  if (explicitStation === 'bar') return 'bar';
  if (explicitStation === 'kitchen') return 'kitchen';
  if (ticketStation === 'bar' || ticketType === 'BOT' || kotNumber?.startsWith('BOT')) return 'bar';
  if (ticketStation === 'kitchen' || ticketType === 'KOT' || kotNumber?.startsWith('KOT')) return 'kitchen';
  if (course === 'beverage') return 'bar';
  if (product?.orderRoutingStation === 'bar') return 'bar';
  if (product?.orderRoutingStation === 'kitchen') return 'kitchen';
  if (product?.department === 'Drink' || product?.itemType === 'beverage') return 'bar';

  const cat = String(product?.category || '');
  if (cat && /drink|alcohol|bar|cold|hot|beverage|cocktail|liquor|wine|beer/i.test(cat)) {
    return 'bar';
  }

  const name = String(productName || '');
  if (
    name &&
    /beer|juice|tea|coffee|americano|espresso|doppio|latte|cappuccino|macchiato|mocha|cortado|frappe|matcha|lassi|lemonade|mojito|whiskey|wine|vodka|soda|shake|smoothie|press|v-60|v60|cocktail|mocktail|gin|rum|tequila|drink|coke|pepsi|sprite|fanta|mineral water/i.test(
      name
    )
  ) {
    return 'bar';
  }

  return 'kitchen';
};

/**
 * Extracts normalized add-ons list from either addonsList or selectedModifiers on a KOT/cart item.
 */
export const extractKOTItemAddons = (
  item?: {
    addonsList?: AddonEntry[];
    selectedModifiers?: { modifierName?: string; optionName: string; priceDelta: number }[];
  } | null
): AddonEntry[] => {
  if (!item) return [];
  if (Array.isArray(item.addonsList) && item.addonsList.length > 0) {
    return item.addonsList.map(a => ({ name: a.name, price: Number(a.price || 0) }));
  }
  if (Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0) {
    return item.selectedModifiers.map(m => ({
      name: m.optionName,
      price: Number(m.priceDelta || 0)
    }));
  }
  return [];
};

/**
 * Computes base unit price without add-on prices so editing add-ons never double-counts.
 */
export const computeItemBaseUnitPrice = (
  currentUnitPrice: number,
  existingAddons: AddonEntry[],
  catalogUnitPrice?: number
): number => {
  const existingAddonsTotal = (existingAddons || []).reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  if (typeof currentUnitPrice === 'number' && currentUnitPrice > 0) {
    return Math.max(0, currentUnitPrice - existingAddonsTotal);
  }
  return Math.max(0, Number(catalogUnitPrice || 0));
};

export const deduplicateTickets = (tickets: KitchenOrderTicket[]): KitchenOrderTicket[] => {
  const map = new Map<string, KitchenOrderTicket>();
  (tickets || []).forEach(ticket => {
    if (ticket && ticket.id && !map.has(ticket.id)) {
      map.set(ticket.id, ticket);
    }
  });
  return Array.from(map.values());
};

/**
 * Returns deduplicated, unsettled KOT/BOT tickets belonging strictly to the active table or takeaway session.
 */
export const getActiveTicketsForSession = (params: {
  tickets: KitchenOrderTicket[];
  activeDiningTable: DiningTable | null;
  diningTables: DiningTable[];
  isTakeawayMode: boolean;
  now?: number;
}): KitchenOrderTicket[] => {
  const { tickets, activeDiningTable, diningTables, isTakeawayMode, now = Date.now() } = params;
  const currentTableId = activeDiningTable?.id || (isTakeawayMode ? 'takeaway-counter' : null);

  if (!currentTableId && !isTakeawayMode) return [];

  const uniqueTickets = deduplicateTickets(tickets);
  return uniqueTickets.filter(k => {
    if (k.isSettled) return false;
    if (activeDiningTable?.openedAt && k.createdAt && k.createdAt < activeDiningTable.openedAt - 120000) {
      return false;
    }
    if (k.createdAt && k.createdAt < now - 24 * 3600 * 1000) {
      return false;
    }
    if (activeDiningTable) {
      return doesTicketBelongToTable(k, activeDiningTable, diningTables);
    }
    if (isTakeawayMode) {
      return k.tableId === 'takeaway-counter' || k.tableNumber === 'Takeaway' || !k.tableId;
    }
    return false;
  });
};

export interface TicketWithRound {
  ticket: KitchenOrderTicket;
  roundNumber: number;
}

/**
 * Assigns chronological Round 1..N numbers (grouping simultaneous KOT+BOT splits within 10s)
 * and sorts reverse-chronologically for the order ledger display.
 */
export const assignRoundsToTickets = (
  activeTableTickets: KitchenOrderTicket[]
): { renderedTicketsWithRounds: TicketWithRound[]; totalFiredRounds: number } => {
  if (!activeTableTickets || activeTableTickets.length === 0) {
    return { renderedTicketsWithRounds: [], totalFiredRounds: 0 };
  }

  const sortedChronological = [...activeTableTickets].sort((a, b) => a.createdAt - b.createdAt);

  let roundCounter = 1;
  let prevCreatedAt = sortedChronological[0]?.createdAt || 0;

  const withRounds = sortedChronological.map((ticket, idx) => {
    if (idx > 0 && Math.abs(ticket.createdAt - prevCreatedAt) > 10000) {
      roundCounter += 1;
    }
    prevCreatedAt = ticket.createdAt;
    return { ticket, roundNumber: roundCounter };
  });

  const displayList = [...withRounds].sort((a, b) => {
    if (b.roundNumber !== a.roundNumber) {
      return b.roundNumber - a.roundNumber;
    }
    return b.ticket.createdAt - a.ticket.createdAt;
  });

  return {
    renderedTicketsWithRounds: displayList,
    totalFiredRounds: roundCounter
  };
};

export interface BillCalculationResult {
  subtotal: number;
  billDiscountAmount: number;
  totalItemDiscounts: number;
  grossDiscount: number;
  taxableAmount: number;
  taxAmount: number;
  nonTaxableAmount: number;
  grandTotal: number;
  hasInclusive: boolean;
  paidAmountNumber: number;
  isPaidAmountProvided: boolean;
  effectivePaidAmount: number;
  effectiveDueAmount: number;
  changeToReturn: number;
  paymentStatus: SaleInvoice['paymentStatus'];
}

export const calculateBillTotals = (params: {
  items: Pick<
    SaleItem,
    'quantity' | 'unitPrice' | 'lineTotal' | 'discountAmount' | 'taxRatePercent' | 'isTaxInclusive'
  >[];
  discountType: 'percent' | 'rs';
  discountInput: string;
  paidAmountInput: string;
  paymentMethod: SaleInvoice['paymentMethod'];
  taxInclusivePricing?: boolean;
  defaultVatRate?: number;
}): BillCalculationResult => {
  const {
    items,
    discountType,
    discountInput,
    paidAmountInput,
    paymentMethod,
    taxInclusivePricing = true,
    defaultVatRate = 13
  } = params;

  const subtotal = (items || []).reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  const rawDiscount = parseFloat(discountInput);
  const safeDiscountValue = Number.isFinite(rawDiscount) ? Math.max(0, rawDiscount) : 0;

  const billDiscountAmount =
    discountType === 'percent'
      ? (subtotal * Math.min(100, safeDiscountValue)) / 100
      : Math.min(safeDiscountValue, subtotal);

  const totalItemDiscounts = (items || []).reduce(
    (sum, item) => sum + Math.max(0, item.discountAmount || 0),
    0
  );
  const grossDiscount = Math.min(subtotal, billDiscountAmount + totalItemDiscounts);

  let taxableAmount = 0;
  let taxAmount = 0;
  let nonTaxableAmount = 0;
  let grandTotal = 0;
  let hasInclusive = taxInclusivePricing;

  if (items.length > 0 && subtotal > 0) {
    const netTotalAfterDiscount = Math.max(0, subtotal - grossDiscount);
    const discountRatio = subtotal > 0 ? netTotalAfterDiscount / subtotal : 1;

    let computedTaxable = 0;
    let computedTax = 0;
    let computedNonTaxable = 0;
    let addedExclusiveTax = 0;
    let foundInclusive = false;

    items.forEach(item => {
      const netLine = (item.lineTotal || item.quantity * item.unitPrice) * discountRatio;
      const rate = item.taxRatePercent !== undefined ? item.taxRatePercent : defaultVatRate;
      const isInclusive = item.isTaxInclusive !== undefined ? item.isTaxInclusive : taxInclusivePricing;

      if (rate === 0) {
        computedNonTaxable += netLine;
      } else if (isInclusive) {
        foundInclusive = true;
        const base = netLine / (1 + rate / 100);
        const vat = netLine - base;
        computedTaxable += base;
        computedTax += vat;
      } else {
        const vat = (netLine * rate) / 100;
        computedTaxable += netLine;
        computedTax += vat;
        addedExclusiveTax += vat;
      }
    });

    taxableAmount = Math.round(computedTaxable * 100) / 100;
    taxAmount = Math.round(computedTax * 100) / 100;
    nonTaxableAmount = Math.round(computedNonTaxable * 100) / 100;
    grandTotal = Math.round(netTotalAfterDiscount + addedExclusiveTax);
    hasInclusive = foundInclusive;
  }

  const trimmedPaid = String(paidAmountInput || '').trim();
  const isPaidAmountProvided = trimmedPaid !== '';
  const parsedPaid = parseFloat(trimmedPaid);
  const paidAmountNumber = Number.isFinite(parsedPaid) ? Math.max(0, parsedPaid) : 0;

  const effectivePaidAmount = isPaidAmountProvided
    ? Math.min(paidAmountNumber, grandTotal)
    : paymentMethod === 'credit' || paymentMethod === 'split'
    ? 0
    : grandTotal;

  const effectiveDueAmount = isPaidAmountProvided
    ? Math.max(0, grandTotal - paidAmountNumber)
    : paymentMethod === 'credit' || paymentMethod === 'split'
    ? grandTotal
    : 0;

  const changeToReturn =
    isPaidAmountProvided && paidAmountNumber > grandTotal ? paidAmountNumber - grandTotal : 0;

  const paymentStatus: SaleInvoice['paymentStatus'] =
    effectiveDueAmount === 0 ? 'paid' : effectivePaidAmount > 0 ? 'partial' : 'unpaid';

  return {
    subtotal,
    billDiscountAmount,
    totalItemDiscounts,
    grossDiscount,
    taxableAmount,
    taxAmount,
    nonTaxableAmount,
    grandTotal,
    hasInclusive,
    paidAmountNumber,
    isPaidAmountProvided,
    effectivePaidAmount,
    effectiveDueAmount,
    changeToReturn,
    paymentStatus
  };
};

export interface TicketStationCounts {
  firedKitchenCount: number;
  firedBarCount: number;
  draftKitchenCount: number;
  draftBarCount: number;
  totalKitchenCount: number;
  totalBarCount: number;
  firedTotalCount: number;
  draftTotalCount: number;
  billableItemsCount: number;
}

export const getTicketStationCounts = (
  firedItems: Pick<SaleItem, 'quantity' | 'orderRoutingStation'>[],
  cartItems: Pick<SaleItem, 'quantity' | 'orderRoutingStation'>[],
  billableItems: Pick<SaleItem, 'quantity'>[]
): TicketStationCounts => {
  const firedKitchenCount = firedItems
    .filter(i => (i.orderRoutingStation || 'kitchen') === 'kitchen')
    .reduce((s, i) => s + (i.quantity || 0), 0);
  const firedBarCount = firedItems
    .filter(i => i.orderRoutingStation === 'bar')
    .reduce((s, i) => s + (i.quantity || 0), 0);
  const draftKitchenCount = cartItems
    .filter(i => (i.orderRoutingStation || 'kitchen') === 'kitchen')
    .reduce((s, i) => s + (i.quantity || 0), 0);
  const draftBarCount = cartItems
    .filter(i => i.orderRoutingStation === 'bar')
    .reduce((s, i) => s + (i.quantity || 0), 0);

  return {
    firedKitchenCount,
    firedBarCount,
    draftKitchenCount,
    draftBarCount,
    totalKitchenCount: firedKitchenCount + draftKitchenCount,
    totalBarCount: firedBarCount + draftBarCount,
    firedTotalCount: firedKitchenCount + firedBarCount,
    draftTotalCount: draftKitchenCount + draftBarCount,
    billableItemsCount: billableItems.reduce((s, i) => s + (i.quantity || 0), 0)
  };
};
