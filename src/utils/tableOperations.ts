import {
  DiningTable,
  KitchenOrderTicket,
  TableDraftItem,
  TableDraftOrder,
  TableStatus
} from '../types';

export interface TableMetricsResult {
  status: TableStatus;
  subtotal: number;
  totalWithTax: number;
  activeKOTCount: number;
  hasActiveOrder: boolean;
}

export interface DraftOverrideInput {
  cart: TableDraftItem[];
  kitchenSpecialNotes?: string;
  discountType?: 'percent' | 'rs';
  discountInput?: string;
}

export const makeAvailableTable = (table: DiningTable): DiningTable => {
  const freed: DiningTable = {
    ...table,
    status: 'available' as const,
    subtotal: 0,
    totalWithTax: 0,
    activeKOTCount: 0
  };
  delete (freed as any).currentGuests;
  delete (freed as any).assignedWaiter;
  delete (freed as any).assignedInvoiceNumber;
  delete (freed as any).openedAt;
  delete (freed as any).lastOrderAt;
  return freed;
};

/**
 * Matches a KOT/BOT ticket to a specific dining table without cross-floor tableNumber collisions.
 * Only falls back to tableNumber when ticket.tableId is absent or does not belong to another existing table.
 */
export const doesTicketBelongToTable = (
  ticket: KitchenOrderTicket,
  table: DiningTable,
  allTables: DiningTable[]
): boolean => {
  if (!ticket || !table) return false;
  if (ticket.tableId === table.id) return true;
  const belongsToDifferentExistingTable =
    Boolean(ticket.tableId) &&
    ticket.tableId !== table.id &&
    allTables.some(dt => dt.id === ticket.tableId);
  if (belongsToDifferentExistingTable) return false;
  return Boolean(table.tableNumber) && ticket.tableNumber === table.tableNumber;
};

export const computeTableMetrics = (
  table: DiningTable,
  tickets: KitchenOrderTicket[],
  drafts: Record<string, TableDraftOrder>,
  allTables: DiningTable[],
  taxInclusivePricing: boolean = true,
  defaultVatRate: number = 13,
  now: number = Date.now()
): TableMetricsResult => {
  const uniqueTicketsMap = new Map<string, KitchenOrderTicket>();
  (tickets || []).forEach(k => {
    if (k && k.id && !uniqueTicketsMap.has(k.id)) {
      uniqueTicketsMap.set(k.id, k);
    }
  });
  const uniqueTickets = Array.from(uniqueTicketsMap.values());

  const tableKOTs = uniqueTickets.filter(k => {
    if (k.isSettled || k.status === 'cancelled') return false;
    if (!doesTicketBelongToTable(k, table, allTables)) return false;
    if (table.openedAt && k.createdAt && k.createdAt < table.openedAt - 120000) {
      return false;
    }
    if (k.createdAt && k.createdAt < now - 24 * 3600 * 1000) {
      return false;
    }
    return true;
  });

  const firedSubtotal = tableKOTs.reduce(
    (sum, k) =>
      sum +
      (k.items || [])
        .filter(it => it.status !== 'cancelled')
        .reduce((is, it) => is + (it.unitPrice || 0) * (it.quantity || 1), 0),
    0
  );
  const activeKOTCount = tableKOTs.filter(k =>
    (k.items || []).some(it => it.status !== 'cancelled')
  ).length;
  const hasActiveKOT = activeKOTCount > 0;

  const draft = drafts[table.id];
  const hasDraft = Boolean(draft && Array.isArray(draft.cart) && draft.cart.length > 0);
  const draftSubtotal = hasDraft
    ? draft!.cart.reduce((s, it) => s + (it.quantity || 1) * (it.unitPrice || 0), 0)
    : 0;

  const totalSubtotal = hasActiveKOT
    ? firedSubtotal + draftSubtotal
    : hasDraft
    ? draftSubtotal
    : 0;
  const vatMultiplier = (defaultVatRate || 13) / 100;
  const totalWithTax = taxInclusivePricing
    ? totalSubtotal
    : Math.round(totalSubtotal * (1 + vatMultiplier));

  let status: TableStatus = 'available';
  if (hasActiveKOT) {
    status = 'kot_fired';
  } else if (hasDraft) {
    status = 'draft';
  } else if (
    tableKOTs.length > 0 &&
    (hasActiveKOT || (table.currentGuests && table.currentGuests > 0) || table.openedAt)
  ) {
    status = 'seated';
  } else if (table.currentGuests && table.currentGuests > 0) {
    status = 'seated';
  } else {
    status = 'available';
  }

  return {
    status,
    subtotal: totalSubtotal,
    totalWithTax,
    activeKOTCount,
    hasActiveOrder: (hasActiveKOT || hasDraft) && totalSubtotal > 0
  };
};

const applyDraftOverride = (
  drafts: Record<string, TableDraftOrder>,
  tableId: string,
  override: DraftOverrideInput | undefined,
  now: number
): Record<string, TableDraftOrder> => {
  const nextDrafts = { ...drafts };
  if (!override) return nextDrafts;

  if (Array.isArray(override.cart) && override.cart.length > 0) {
    const existing = nextDrafts[tableId] || { tableId, cart: [], updatedAt: now };
    nextDrafts[tableId] = {
      ...existing,
      ...override,
      tableId,
      cart: override.cart,
      updatedAt: now
    };
  } else {
    delete nextDrafts[tableId];
  }
  return nextDrafts;
};

const isTicketActiveForTable = (
  k: KitchenOrderTicket,
  table: DiningTable,
  allTables: DiningTable[],
  now: number
): boolean => {
  if (k.isSettled || k.status === 'cancelled') return false;
  if (!doesTicketBelongToTable(k, table, allTables)) return false;
  if (k.createdAt && k.createdAt < now - 24 * 3600 * 1000) return false;
  if (table.openedAt && k.createdAt && k.createdAt < table.openedAt - 120000) return false;
  return true;
};

export interface TableManageTransitionResult {
  ok: boolean;
  updatedTables: DiningTable[];
  updatedTickets: KitchenOrderTicket[];
  changedTickets: KitchenOrderTicket[];
  nextDrafts: Record<string, TableDraftOrder>;
  deletedDraftTableIds: string[];
  targetFloorId?: string;
}

export const applyTransferTableState = (params: {
  sourceTableId: string;
  targetTableId: string;
  tables: DiningTable[];
  tickets: KitchenOrderTicket[];
  drafts: Record<string, TableDraftOrder>;
  sourceDraftOverride?: DraftOverrideInput;
  fallbackWaiter: string;
  taxInclusivePricing?: boolean;
  defaultVatRate?: number;
  now?: number;
}): TableManageTransitionResult => {
  const {
    sourceTableId,
    targetTableId,
    tables,
    tickets,
    drafts,
    sourceDraftOverride,
    fallbackWaiter,
    taxInclusivePricing = true,
    defaultVatRate = 13,
    now = Date.now()
  } = params;

  const emptyResult: TableManageTransitionResult = {
    ok: false,
    updatedTables: tables,
    updatedTickets: tickets,
    changedTickets: [],
    nextDrafts: drafts,
    deletedDraftTableIds: []
  };

  if (!sourceTableId || !targetTableId || sourceTableId === targetTableId) {
    return emptyResult;
  }

  const sourceTable = tables.find(t => t.id === sourceTableId);
  const targetTable = tables.find(t => t.id === targetTableId);
  if (!sourceTable || !targetTable) return emptyResult;

  // 1. Move only active tickets belonging strictly to sourceTable
  const changedTickets: KitchenOrderTicket[] = [];
  const updatedTickets = tickets.map(k => {
    if (isTicketActiveForTable(k, sourceTable, tables, now)) {
      const updated: KitchenOrderTicket = {
        ...k,
        tableId: targetTable.id,
        tableNumber: targetTable.tableNumber,
        zoneName: targetTable.floorName || k.zoneName,
        updatedAt: now
      };
      changedTickets.push(updated);
      return updated;
    }
    return k;
  });

  // 2. Move source draft to targetTable
  const nextDrafts = applyDraftOverride(drafts, sourceTableId, sourceDraftOverride, now);
  const sourceDraft = nextDrafts[sourceTableId];
  if (sourceDraft && Array.isArray(sourceDraft.cart) && sourceDraft.cart.length > 0) {
    nextDrafts[targetTableId] = {
      ...sourceDraft,
      tableId: targetTableId,
      updatedAt: now
    };
  } else {
    delete nextDrafts[targetTableId];
  }
  delete nextDrafts[sourceTableId];

  // 3. Preserve sourceTable's earliest openedAt (never let a stale target openedAt hide moved tickets)
  const earliestMovedTicketAt = changedTickets.reduce(
    (min, t) => (t.createdAt ? Math.min(min, t.createdAt) : min),
    Infinity
  );
  const candidateOpenedAt = Math.min(
    sourceTable.openedAt || Infinity,
    earliestMovedTicketAt
  );
  const transferredOpenedAt = Number.isFinite(candidateOpenedAt) ? candidateOpenedAt : now;

  const targetCandidate: DiningTable = {
    ...targetTable,
    currentGuests: sourceTable.currentGuests || targetTable.currentGuests || 2,
    assignedWaiter: sourceTable.assignedWaiter || targetTable.assignedWaiter || fallbackWaiter,
    assignedInvoiceNumber: sourceTable.assignedInvoiceNumber || targetTable.assignedInvoiceNumber,
    openedAt: transferredOpenedAt,
    lastOrderAt: now
  };

  const targetMetrics = computeTableMetrics(
    targetCandidate,
    updatedTickets,
    nextDrafts,
    tables,
    taxInclusivePricing,
    defaultVatRate,
    now
  );

  const updatedTables = tables.map(t => {
    if (t.id === targetTableId) {
      return {
        ...targetCandidate,
        status: targetMetrics.status === 'available' ? 'seated' : targetMetrics.status,
        subtotal: targetMetrics.subtotal,
        totalWithTax: targetMetrics.totalWithTax,
        activeKOTCount: targetMetrics.activeKOTCount
      };
    }
    if (t.id === sourceTableId) {
      return makeAvailableTable(t);
    }
    return t;
  });

  return {
    ok: true,
    updatedTables,
    updatedTickets,
    changedTickets,
    nextDrafts,
    deletedDraftTableIds: [sourceTableId],
    targetFloorId: targetTable.floorId
  };
};

export const applyMergeTablesState = (params: {
  sourceTableId: string;
  targetTableId: string;
  tables: DiningTable[];
  tickets: KitchenOrderTicket[];
  drafts: Record<string, TableDraftOrder>;
  sourceDraftOverride?: DraftOverrideInput;
  fallbackWaiter: string;
  taxInclusivePricing?: boolean;
  defaultVatRate?: number;
  now?: number;
}): TableManageTransitionResult => {
  const {
    sourceTableId,
    targetTableId,
    tables,
    tickets,
    drafts,
    sourceDraftOverride,
    fallbackWaiter,
    taxInclusivePricing = true,
    defaultVatRate = 13,
    now = Date.now()
  } = params;

  const emptyResult: TableManageTransitionResult = {
    ok: false,
    updatedTables: tables,
    updatedTickets: tickets,
    changedTickets: [],
    nextDrafts: drafts,
    deletedDraftTableIds: []
  };

  if (!sourceTableId || !targetTableId || sourceTableId === targetTableId) {
    return emptyResult;
  }

  const sourceTable = tables.find(t => t.id === sourceTableId);
  const targetTable = tables.find(t => t.id === targetTableId);
  if (!sourceTable || !targetTable) return emptyResult;

  // 1. Reassign active kitchen tickets from source to target
  const changedTickets: KitchenOrderTicket[] = [];
  const updatedTickets = tickets.map(k => {
    if (isTicketActiveForTable(k, sourceTable, tables, now)) {
      const updated: KitchenOrderTicket = {
        ...k,
        tableId: targetTable.id,
        tableNumber: targetTable.tableNumber,
        zoneName: targetTable.floorName || k.zoneName,
        updatedAt: now
      };
      changedTickets.push(updated);
      return updated;
    }
    return k;
  });

  // 2. Combine drafts cleanly
  const nextDrafts = applyDraftOverride(drafts, sourceTableId, sourceDraftOverride, now);
  const sourceDraft = nextDrafts[sourceTableId];
  const targetDraft = nextDrafts[targetTableId];
  if (sourceDraft && Array.isArray(sourceDraft.cart) && sourceDraft.cart.length > 0) {
    if (targetDraft && Array.isArray(targetDraft.cart) && targetDraft.cart.length > 0) {
      nextDrafts[targetTableId] = {
        ...targetDraft,
        cart: [...targetDraft.cart, ...sourceDraft.cart],
        kitchenSpecialNotes: [targetDraft.kitchenSpecialNotes, sourceDraft.kitchenSpecialNotes]
          .filter(Boolean)
          .join(' | '),
        discountType: targetDraft.discountType || sourceDraft.discountType,
        discountInput:
          targetDraft.discountInput && targetDraft.discountInput !== '0'
            ? targetDraft.discountInput
            : sourceDraft.discountInput,
        updatedAt: now
      };
    } else {
      nextDrafts[targetTableId] = {
        ...sourceDraft,
        tableId: targetTableId,
        updatedAt: now
      };
    }
  }
  delete nextDrafts[sourceTableId];

  // 3. Earliest openedAt across BOTH source and target (and all their active tickets)
  //    guarantees neither table's KOTs/BOTs ever get filtered out by the session cutoff
  const targetAndMovedTickets = updatedTickets.filter(
    k => !k.isSettled && k.status !== 'cancelled' && doesTicketBelongToTable(k, targetTable, tables)
  );
  const earliestTicketAt = targetAndMovedTickets.reduce(
    (min, t) => (t.createdAt && t.createdAt >= now - 24 * 3600 * 1000 ? Math.min(min, t.createdAt) : min),
    Infinity
  );
  const candidateOpenedAt = Math.min(
    sourceTable.openedAt || Infinity,
    targetTable.openedAt || Infinity,
    earliestTicketAt
  );
  const mergedOpenedAt = Number.isFinite(candidateOpenedAt) ? candidateOpenedAt : now;

  const targetCandidate: DiningTable = {
    ...targetTable,
    currentGuests: (targetTable.currentGuests || 0) + (sourceTable.currentGuests || 0) || 2,
    assignedWaiter: targetTable.assignedWaiter || sourceTable.assignedWaiter || fallbackWaiter,
    assignedInvoiceNumber: targetTable.assignedInvoiceNumber || sourceTable.assignedInvoiceNumber,
    openedAt: mergedOpenedAt,
    lastOrderAt: now
  };

  const targetMetrics = computeTableMetrics(
    targetCandidate,
    updatedTickets,
    nextDrafts,
    tables,
    taxInclusivePricing,
    defaultVatRate,
    now
  );

  const updatedTables = tables.map(t => {
    if (t.id === targetTableId) {
      return {
        ...targetCandidate,
        status: targetMetrics.status,
        subtotal: targetMetrics.subtotal,
        totalWithTax: targetMetrics.totalWithTax,
        activeKOTCount: targetMetrics.activeKOTCount
      };
    }
    if (t.id === sourceTableId) {
      return makeAvailableTable(t);
    }
    return t;
  });

  return {
    ok: true,
    updatedTables,
    updatedTickets,
    changedTickets,
    nextDrafts,
    deletedDraftTableIds: [sourceTableId],
    targetFloorId: targetTable.floorId
  };
};

export const applySwapTablesState = (params: {
  tableAId: string;
  tableBId: string;
  tables: DiningTable[];
  tickets: KitchenOrderTicket[];
  drafts: Record<string, TableDraftOrder>;
  sourceDraftOverrideForA?: DraftOverrideInput;
  taxInclusivePricing?: boolean;
  defaultVatRate?: number;
  now?: number;
}): TableManageTransitionResult => {
  const {
    tableAId,
    tableBId,
    tables,
    tickets,
    drafts,
    sourceDraftOverrideForA,
    taxInclusivePricing = true,
    defaultVatRate = 13,
    now = Date.now()
  } = params;

  const emptyResult: TableManageTransitionResult = {
    ok: false,
    updatedTables: tables,
    updatedTickets: tickets,
    changedTickets: [],
    nextDrafts: drafts,
    deletedDraftTableIds: []
  };

  if (!tableAId || !tableBId || tableAId === tableBId) {
    return emptyResult;
  }

  const tableA = tables.find(t => t.id === tableAId);
  const tableB = tables.find(t => t.id === tableBId);
  if (!tableA || !tableB) return emptyResult;

  // 1. Identify each table's active tickets independently before modifying
  const fromAIds = new Set<string>();
  const fromBIds = new Set<string>();
  tickets.forEach(k => {
    if (isTicketActiveForTable(k, tableA, tables, now)) {
      fromAIds.add(k.id);
    } else if (isTicketActiveForTable(k, tableB, tables, now)) {
      fromBIds.add(k.id);
    }
  });

  const changedTickets: KitchenOrderTicket[] = [];
  let earliestMovedToBAt = Infinity;
  let earliestMovedToAAt = Infinity;

  const updatedTickets = tickets.map(k => {
    if (fromAIds.has(k.id)) {
      if (k.createdAt) earliestMovedToBAt = Math.min(earliestMovedToBAt, k.createdAt);
      const updated: KitchenOrderTicket = {
        ...k,
        tableId: tableB.id,
        tableNumber: tableB.tableNumber,
        zoneName: tableB.floorName || k.zoneName,
        updatedAt: now
      };
      changedTickets.push(updated);
      return updated;
    }
    if (fromBIds.has(k.id)) {
      if (k.createdAt) earliestMovedToAAt = Math.min(earliestMovedToAAt, k.createdAt);
      const updated: KitchenOrderTicket = {
        ...k,
        tableId: tableA.id,
        tableNumber: tableA.tableNumber,
        zoneName: tableA.floorName || k.zoneName,
        updatedAt: now
      };
      changedTickets.push(updated);
      return updated;
    }
    return k;
  });

  // 2. Swap drafts cleanly
  const nextDrafts = applyDraftOverride(drafts, tableAId, sourceDraftOverrideForA, now);
  const draftA = nextDrafts[tableAId];
  const draftB = nextDrafts[tableBId];
  const deletedDraftTableIds: string[] = [];

  if (draftA && Array.isArray(draftA.cart) && draftA.cart.length > 0) {
    nextDrafts[tableBId] = { ...draftA, tableId: tableBId, updatedAt: now };
  } else {
    delete nextDrafts[tableBId];
    deletedDraftTableIds.push(tableBId);
  }

  if (draftB && Array.isArray(draftB.cart) && draftB.cart.length > 0) {
    nextDrafts[tableAId] = { ...draftB, tableId: tableAId, updatedAt: now };
  } else {
    delete nextDrafts[tableAId];
    deletedDraftTableIds.push(tableAId);
  }

  // 3. Swap openedAt & session metadata FIRST, then compute metrics against swapped openedAt!
  const candidateOpenedAtA = Math.min(tableB.openedAt || Infinity, earliestMovedToAAt);
  const candidateOpenedAtB = Math.min(tableA.openedAt || Infinity, earliestMovedToBAt);

  const candidateA: DiningTable = {
    ...tableA,
    currentGuests: tableB.currentGuests,
    assignedWaiter: tableB.assignedWaiter,
    assignedInvoiceNumber: tableB.assignedInvoiceNumber,
    openedAt: Number.isFinite(candidateOpenedAtA) ? candidateOpenedAtA : undefined,
    lastOrderAt: now
  };
  const candidateB: DiningTable = {
    ...tableB,
    currentGuests: tableA.currentGuests,
    assignedWaiter: tableA.assignedWaiter,
    assignedInvoiceNumber: tableA.assignedInvoiceNumber,
    openedAt: Number.isFinite(candidateOpenedAtB) ? candidateOpenedAtB : undefined,
    lastOrderAt: now
  };

  const metricsA = computeTableMetrics(
    candidateA,
    updatedTickets,
    nextDrafts,
    tables,
    taxInclusivePricing,
    defaultVatRate,
    now
  );
  const metricsB = computeTableMetrics(
    candidateB,
    updatedTickets,
    nextDrafts,
    tables,
    taxInclusivePricing,
    defaultVatRate,
    now
  );

  const updatedTables = tables.map(t => {
    if (t.id === tableAId) {
      if (metricsA.status === 'available') {
        return makeAvailableTable(t);
      }
      return {
        ...candidateA,
        status: metricsA.status,
        subtotal: metricsA.subtotal,
        totalWithTax: metricsA.totalWithTax,
        activeKOTCount: metricsA.activeKOTCount
      };
    }
    if (t.id === tableBId) {
      if (metricsB.status === 'available') {
        return makeAvailableTable(t);
      }
      return {
        ...candidateB,
        status: metricsB.status,
        subtotal: metricsB.subtotal,
        totalWithTax: metricsB.totalWithTax,
        activeKOTCount: metricsB.activeKOTCount
      };
    }
    return t;
  });

  return {
    ok: true,
    updatedTables,
    updatedTickets,
    changedTickets,
    nextDrafts,
    deletedDraftTableIds,
    targetFloorId: tableB.floorId
  };
};
