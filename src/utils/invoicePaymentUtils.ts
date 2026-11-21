import { SaleInvoice } from '../types';

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Returns true if the invoice is still a proforma / unfinalized draft
 * (drafts do not affect inventory stock or customer receivable balance).
 */
export const isDraftInvoice = (
  invoice: Pick<SaleInvoice, 'status' | 'isDraft'> | null | undefined
): boolean => {
  if (!invoice) return false;
  return invoice.status === 'draft' || invoice.isDraft === true;
};

/**
 * Computes the true remaining due amount for a sale invoice.
 * Ensures an invoice whose paidAmount >= grandTotal (or returnedAmount/deduct_due
 * reduced due to 0) NEVER reports a positive dueAmount, and never exceeds
 * (grandTotal - paidAmount).
 */
export const getInvoiceDueAmount = (
  invoice:
    | Pick<SaleInvoice, 'grandTotal' | 'paidAmount' | 'dueAmount' | 'returnedAmount' | 'status' | 'isDraft'>
    | null
    | undefined
): number => {
  if (!invoice) return 0;

  const grandTotal = Math.max(0, round2(Number(invoice.grandTotal || 0)));
  const paidAmount = Math.max(0, round2(Number(invoice.paidAmount || 0)));
  const maxRemainingAfterPaid = Math.max(0, round2(grandTotal - paidAmount));

  if (maxRemainingAfterPaid <= 0.01) {
    return 0;
  }

  if (
    invoice.dueAmount !== undefined &&
    invoice.dueAmount !== null &&
    Number.isFinite(Number(invoice.dueAmount))
  ) {
    const storedDue = Math.max(0, round2(Number(invoice.dueAmount)));
    const clampedDue = Math.min(maxRemainingAfterPaid, storedDue);
    return clampedDue <= 0.01 ? 0 : clampedDue;
  }

  return maxRemainingAfterPaid <= 0.01 ? 0 : maxRemainingAfterPaid;
};

/**
 * Derives the authoritative paymentStatus from the invoice's financial numbers.
 * - If due <= 0 (for finalized invoices), status is ALWAYS 'paid'.
 * - If due > 0 and paidAmount > 0, status is 'partial' (unless explicitly 'overdue').
 * - If due > 0 and paidAmount === 0, status is 'overdue' (if stored) or 'unpaid'.
 */
export const getEffectivePaymentStatus = (
  invoice:
    | Pick<
        SaleInvoice,
        'grandTotal' | 'paidAmount' | 'dueAmount' | 'paymentStatus' | 'returnedAmount' | 'status' | 'isDraft'
      >
    | null
    | undefined
): SaleInvoice['paymentStatus'] => {
  if (!invoice) return 'unpaid';
  if (isDraftInvoice(invoice)) {
    return invoice.paymentStatus || 'unpaid';
  }

  const due = getInvoiceDueAmount(invoice);
  if (due <= 0) {
    return 'paid';
  }

  const paid = Math.max(0, round2(Number(invoice.paidAmount || 0)));
  if (invoice.paymentStatus === 'overdue') {
    return 'overdue';
  }
  if (paid > 0) {
    return 'partial';
  }
  return 'unpaid';
};

/**
 * Returns a normalized copy of a finalized SaleInvoice where paidAmount,
 * dueAmount, and paymentStatus are guaranteed to be mutually consistent.
 * Draft invoices are returned unchanged.
 */
export const normalizeSaleInvoicePayment = (invoice: SaleInvoice): SaleInvoice => {
  if (isDraftInvoice(invoice)) {
    return invoice;
  }

  const grandTotal = Math.max(0, round2(Number(invoice.grandTotal || 0)));
  const dueAmount = getInvoiceDueAmount(invoice);
  const rawPaid =
    invoice.paidAmount !== undefined &&
    invoice.paidAmount !== null &&
    Number.isFinite(Number(invoice.paidAmount))
      ? Number(invoice.paidAmount)
      : Math.max(0, grandTotal - dueAmount);
  const paidAmount = Math.max(0, Math.min(grandTotal, round2(rawPaid)));
  const paymentStatus = getEffectivePaymentStatus({
    ...invoice,
    grandTotal,
    paidAmount,
    dueAmount
  });

  if (
    invoice.paidAmount === paidAmount &&
    invoice.dueAmount === dueAmount &&
    invoice.paymentStatus === paymentStatus
  ) {
    return invoice;
  }

  return {
    ...invoice,
    paidAmount,
    dueAmount,
    paymentStatus
  };
};

/**
 * Resolves consistent payment fields (paidAmount, dueAmount, paymentStatus) when
 * editing an existing invoice's metadata, paidAmount, dueAmount, or paymentStatus.
 */
export const resolveEditSalePaymentFields = (
  currentInvoice: SaleInvoice,
  patch: Partial<SaleInvoice>
): Pick<SaleInvoice, 'paidAmount' | 'dueAmount' | 'paymentStatus'> => {
  const grandTotal = Math.max(0, round2(Number(patch.grandTotal ?? currentInvoice.grandTotal ?? 0)));
  const currentDue = getInvoiceDueAmount(currentInvoice);
  const currentPaid = Math.max(0, Math.min(grandTotal, round2(Number(currentInvoice.paidAmount || 0))));
  // Preserves any previous deduct_due reduction if grandTotal didn't change
  const collectibleTotal =
    patch.grandTotal !== undefined
      ? grandTotal
      : Math.min(grandTotal, round2(currentPaid + currentDue));

  let nextPaid = currentPaid;
  let nextDue = currentDue;

  if (patch.paidAmount !== undefined && Number.isFinite(Number(patch.paidAmount))) {
    nextPaid = Math.max(0, Math.min(collectibleTotal, round2(Number(patch.paidAmount))));
    nextDue = Math.max(0, round2(collectibleTotal - nextPaid));
  } else if (patch.dueAmount !== undefined && Number.isFinite(Number(patch.dueAmount))) {
    nextDue = Math.max(0, Math.min(collectibleTotal, round2(Number(patch.dueAmount))));
    nextPaid = Math.max(0, round2(collectibleTotal - nextDue));
  } else if (patch.paymentStatus !== undefined) {
    if (patch.paymentStatus === 'paid') {
      nextPaid = collectibleTotal;
      nextDue = 0;
    } else if (patch.paymentStatus === 'unpaid' || patch.paymentStatus === 'overdue') {
      nextPaid = 0;
      nextDue = collectibleTotal > 0 ? collectibleTotal : grandTotal;
    } else if (patch.paymentStatus === 'partial') {
      // Keep current partial split if valid; if fully paid or fully unpaid, preserve collectible due
      nextDue = Math.max(0, round2(collectibleTotal - nextPaid));
    }
  } else {
    const normalized = normalizeSaleInvoicePayment({ ...currentInvoice, grandTotal });
    nextPaid = normalized.paidAmount;
    nextDue = normalized.dueAmount;
  }

  if (nextDue <= 0.01) nextDue = 0;

  const nextPaymentStatus = getEffectivePaymentStatus({
    ...currentInvoice,
    ...patch,
    grandTotal,
    paidAmount: nextPaid,
    dueAmount: nextDue,
    paymentStatus: patch.paymentStatus ?? currentInvoice.paymentStatus
  });

  return {
    paidAmount: nextPaid,
    dueAmount: nextDue,
    paymentStatus: nextPaymentStatus
  };
};

export interface CustomerPaymentAllocationResult {
  updatedInvoices: SaleInvoice[];
  appliedToOpening: number;
  appliedToInvoices: number;
  totalApplied: number;
  newCustomerBalance: number;
}

/**
 * Allocates a customer payment across unbilled opening ledger due and/or pending
 * customer invoices (oldest unpaid invoice first - FIFO) so both invoice dues
 * and customer.currentBalance always stay synchronized.
 */
export const allocateCustomerPaymentToInvoices = (params: {
  invoices: SaleInvoice[];
  customerId: string;
  currentBalance: number;
  paymentAmount: number;
  method?: SaleInvoice['paymentMethod'];
  notes?: string;
  mode?: 'opening_first' | 'bills_first';
}): CustomerPaymentAllocationResult => {
  const {
    invoices,
    customerId,
    currentBalance,
    paymentAmount,
    method = 'cash',
    notes = '',
    mode = 'opening_first'
  } = params;

  const customerPending = invoices
    .filter(inv => inv.customerId === customerId && !isDraftInvoice(inv) && getInvoiceDueAmount(inv) > 0)
    .sort((a, b) => (a.date || 0) - (b.date || 0));

  const invoicePendingDue = round2(
    customerPending.reduce((sum, inv) => sum + getInvoiceDueAmount(inv), 0)
  );
  const safeBalance = Math.max(0, round2(currentBalance || 0));
  const openingLedgerDue = Math.max(0, round2(safeBalance - invoicePendingDue));
  const maxCollectible = Math.max(safeBalance, invoicePendingDue);
  const validPayment = Math.max(0, Math.min(round2(paymentAmount), maxCollectible));

  if (validPayment <= 0) {
    return {
      updatedInvoices: [],
      appliedToOpening: 0,
      appliedToInvoices: 0,
      totalApplied: 0,
      newCustomerBalance: safeBalance
    };
  }

  let remaining = validPayment;
  let appliedToOpening = 0;
  let appliedToInvoices = 0;
  const updatedInvoices: SaleInvoice[] = [];

  if (mode === 'opening_first' && openingLedgerDue > 0) {
    appliedToOpening = Math.min(remaining, openingLedgerDue);
    remaining = round2(remaining - appliedToOpening);
  }

  for (const inv of customerPending) {
    if (remaining <= 0.009) break;
    const due = getInvoiceDueAmount(inv);
    if (due <= 0) continue;

    const payForInv = Math.min(remaining, due);
    const nextPaid = Math.min(inv.grandTotal || 0, round2((inv.paidAmount || 0) + payForInv));
    const nextDue = Math.max(0, round2(due - payForInv));
    const nextStatus = getEffectivePaymentStatus({
      ...inv,
      paidAmount: nextPaid,
      dueAmount: nextDue
    });

    const noteLine = notes.trim() ? notes.trim() : 'Settled via customer ledger collection';
    updatedInvoices.push({
      ...inv,
      paidAmount: nextPaid,
      dueAmount: nextDue,
      paymentStatus: nextStatus,
      paymentMethod: nextDue === 0 && method ? method : inv.paymentMethod,
      notes: inv.notes ? `${inv.notes} | ${noteLine}` : noteLine
    });

    appliedToInvoices = round2(appliedToInvoices + payForInv);
    remaining = round2(remaining - payForInv);
  }

  if (mode === 'bills_first' && remaining > 0 && openingLedgerDue > 0) {
    const payOpening = Math.min(remaining, openingLedgerDue);
    appliedToOpening = round2(appliedToOpening + payOpening);
    remaining = round2(remaining - payOpening);
  }

  const totalApplied = round2(appliedToOpening + appliedToInvoices);
  const newCustomerBalance = Math.max(0, round2(safeBalance - validPayment));

  return {
    updatedInvoices,
    appliedToOpening,
    appliedToInvoices,
    totalApplied,
    newCustomerBalance
  };
};
