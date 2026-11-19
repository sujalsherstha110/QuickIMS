import { KitchenOrderTicket } from '../types';

export interface DailyTicketCounterState {
  dateKey: string;
  kotSeq: number;
  botSeq: number;
  updatedAt?: number;
}

export const getLocalDayKey = (ts: number = Date.now()): string => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDailyTicketNumber = (type: 'KOT' | 'BOT', seq: number): string => {
  const safeSeq = Math.max(1, Math.floor(Number(seq) || 1));
  return `${type}-${String(safeSeq).padStart(4, '0')}`;
};

export const getMaxTicketSeqForDay = (
  tickets: KitchenOrderTicket[],
  dayKey: string,
  type: 'KOT' | 'BOT'
): number => {
  let maxSeq = 0;
  const prefix = `${type}-`;
  (tickets || []).forEach(t => {
    if (!t || !t.kotNumber) return;
    const ticketTs = Number(t.createdAt || t.updatedAt || 0);
    if (!ticketTs || getLocalDayKey(ticketTs) !== dayKey) return;
    const isTargetType =
      t.ticketType === type ||
      t.destinationStation === (type === 'BOT' ? 'bar' : 'kitchen') ||
      String(t.kotNumber).toUpperCase().startsWith(prefix);
    if (!isTargetType) return;
    const match = String(t.kotNumber).match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });
  return maxSeq;
};

/**
 * Monotonically merges an incoming daily counter snapshot with local state for a target dayKey.
 * Any counter belonging to an earlier calendar day resets cleanly to 0 for the new day.
 */
export const mergeDailyCounterState = (
  current: Partial<DailyTicketCounterState> | null | undefined,
  incoming: Partial<DailyTicketCounterState> | null | undefined,
  dayKey: string
): DailyTicketCounterState => {
  const currentSameDay = current?.dateKey === dayKey;
  const incomingSameDay = incoming?.dateKey === dayKey;

  const curKot = currentSameDay ? Math.max(0, Number(current?.kotSeq || 0)) : 0;
  const curBot = currentSameDay ? Math.max(0, Number(current?.botSeq || 0)) : 0;
  const incKot = incomingSameDay ? Math.max(0, Number(incoming?.kotSeq || 0)) : 0;
  const incBot = incomingSameDay ? Math.max(0, Number(incoming?.botSeq || 0)) : 0;

  return {
    dateKey: dayKey,
    kotSeq: Math.max(curKot, incKot),
    botSeq: Math.max(curBot, incBot),
    updatedAt: Math.max(
      Number(current?.updatedAt || 0),
      Number(incoming?.updatedAt || 0),
      Date.now()
    )
  };
};

/**
 * Synchronously reserves the next daily KOT and/or BOT sequence numbers using the
 * warmest in-memory, cached, and active-ticket sequence values (0ms network blocking).
 */
export const allocateNextDailyTicketNumbersSync = (params: {
  needKot: boolean;
  needBot: boolean;
  dayKey: string;
  liveCounter?: Partial<DailyTicketCounterState> | null;
  cachedCounter?: Partial<DailyTicketCounterState> | null;
  existingTickets?: KitchenOrderTicket[];
}): {
  kotNumber?: string;
  botNumber?: string;
  nextState: DailyTicketCounterState;
} => {
  const { needKot, needBot, dayKey, liveCounter, cachedCounter, existingTickets = [] } = params;

  const maxExistingKot = getMaxTicketSeqForDay(existingTickets, dayKey, 'KOT');
  const maxExistingBot = getMaxTicketSeqForDay(existingTickets, dayKey, 'BOT');

  const merged = mergeDailyCounterState(liveCounter, cachedCounter, dayKey);
  const kotBase = Math.max(merged.kotSeq, maxExistingKot);
  const botBase = Math.max(merged.botSeq, maxExistingBot);

  const nextKotSeq = needKot ? kotBase + 1 : kotBase;
  const nextBotSeq = needBot ? botBase + 1 : botBase;

  return {
    kotNumber: needKot ? formatDailyTicketNumber('KOT', nextKotSeq) : undefined,
    botNumber: needBot ? formatDailyTicketNumber('BOT', nextBotSeq) : undefined,
    nextState: {
      dateKey: dayKey,
      kotSeq: nextKotSeq,
      botSeq: nextBotSeq,
      updatedAt: Date.now()
    }
  };
};
