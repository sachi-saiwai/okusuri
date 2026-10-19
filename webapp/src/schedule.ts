import {
  SLOTS,
  sortSlots,
  type DoseRecord,
  type SlotId,
} from './models';

/** 「8/21 夜」のように、特定の日付と枠の組み合わせ。 */
export interface DoseOccurrence {
  date: Date;
  slot: SlotId;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function occurrenceLabel(occurrence: DoseOccurrence): string {
  return `${occurrence.date.getMonth() + 1}/${occurrence.date.getDate()} ${SLOTS[occurrence.slot].label}`;
}

export function compareOccurrence(a: DoseOccurrence, b: DoseOccurrence): number {
  const byDate = a.date.getTime() - b.date.getTime();
  if (byDate !== 0) return byDate;
  return SLOTS[a.slot].nominalHour - SLOTS[b.slot].nominalHour;
}

/**
 * 最後の報告の次の枠を返す。
 * 例) 最後の報告が前日夜なら今日の朝、最後の報告が今日朝なら今日の夜。
 */
export function nextDose(
  slots: readonly SlotId[],
  now: Date,
  lastReported?: DoseOccurrence,
): DoseOccurrence {
  const ordered = orderedSlots(slots);
  if (!lastReported) return currentOrFirst(ordered, now);
  return after(ordered, lastReported);
}

export function currentOccurrence(
  slots: readonly SlotId[],
  records: readonly DoseRecord[],
  now: Date,
): DoseOccurrence {
  let last: DoseOccurrence | undefined;
  for (const record of records) {
    const occurrence = { date: parseDateKey(record.date), slot: record.slot };
    if (!last || compareOccurrence(occurrence, last) > 0) last = occurrence;
  }
  return nextDose(slots, now, last);
}

/** 翌朝 8 時の送信予定日時。8 時ちょうどは翌日に回す。 */
export function nextReportTime(now: Date): Date {
  const todayAtEight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0,
    0,
  );
  if (now.getTime() < todayAtEight.getTime()) return todayAtEight;
  return new Date(
    todayAtEight.getFullYear(),
    todayAtEight.getMonth(),
    todayAtEight.getDate() + 1,
    8,
    0,
    0,
    0,
  );
}

export function sortRecords(records: readonly DoseRecord[]): DoseRecord[] {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return SLOTS[b.slot].nominalHour - SLOTS[a.slot].nominalHour;
  });
}

function orderedSlots(slots: readonly SlotId[]): SlotId[] {
  const ordered = sortSlots(slots);
  return ordered.length === 0 ? ['morning'] : ordered;
}

function currentOrFirst(ordered: SlotId[], now: Date): DoseOccurrence {
  const due = ordered.filter((slot) => SLOTS[slot].nominalHour <= now.getHours());
  const slot = due.length === 0 ? ordered[0] : due[due.length - 1];
  return { date: startOfDay(now), slot };
}

function after(ordered: SlotId[], previous: DoseOccurrence): DoseOccurrence {
  const laterToday = ordered.filter(
    (slot) => SLOTS[slot].nominalHour > SLOTS[previous.slot].nominalHour,
  );
  if (laterToday.length > 0) {
    return { date: startOfDay(previous.date), slot: laterToday[0] };
  }
  return {
    date: new Date(
      previous.date.getFullYear(),
      previous.date.getMonth(),
      previous.date.getDate() + 1,
    ),
    slot: ordered[0],
  };
}
