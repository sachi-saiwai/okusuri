export type SlotId = 'morning' | 'noon' | 'evening';

export interface SlotInfo {
  id: SlotId;
  label: string;
  nominalHour: number;
  icon: string;
}

export const SLOTS: Record<SlotId, SlotInfo> = {
  morning: { id: 'morning', label: '朝', nominalHour: 8, icon: 'wb_twilight' },
  noon: { id: 'noon', label: '昼', nominalHour: 12, icon: 'wb_sunny' },
  evening: { id: 'evening', label: '夜', nominalHour: 19, icon: 'nightlight' },
};

export const SLOT_ORDER: SlotId[] = ['morning', 'noon', 'evening'];

export const MAX_RECIPIENTS = 2;

export interface AppSettings {
  recipientEmails: string[];
  slots: SlotId[];
  patientName: string;
  isCompleted: boolean;
}

export interface DoseRecord {
  date: string;
  slot: SlotId;
  taken: boolean;
  recordedAt: string;
  photoKey: string | null;
  photoUrl: string | null;
  syncedAt: string | null;
}

export function defaultSettings(): AppSettings {
  return {
    recipientEmails: [],
    slots: ['morning', 'evening'],
    patientName: '',
    isCompleted: false,
  };
}

export function isSlotId(value: unknown): value is SlotId {
  return value === 'morning' || value === 'noon' || value === 'evening';
}

export function sortSlots(slots: readonly SlotId[]): SlotId[] {
  return [...new Set(slots)].sort(
    (a, b) => SLOTS[a].nominalHour - SLOTS[b].nominalHour,
  );
}

export function slotsLabel(slots: readonly SlotId[]): string {
  const sorted = sortSlots(slots);
  if (sorted.length === 0) return '未設定';
  return sorted.map((slot) => SLOTS[slot].label).join('・');
}

export function recordKey(record: Pick<DoseRecord, 'date' | 'slot'>): string {
  return `${record.date}#${record.slot}`;
}

export function resultLabel(taken: boolean): string {
  return taken ? '飲んだ' : '飲んでない';
}

export function parseSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return defaultSettings();
  const raw = value as Record<string, unknown>;
  const slots = Array.isArray(raw.slots) ? raw.slots.filter(isSlotId) : [];
  const emails = Array.isArray(raw.recipientEmails)
    ? raw.recipientEmails
        .filter((email): email is string => typeof email === 'string')
        .slice(0, MAX_RECIPIENTS)
    : [];

  return {
    recipientEmails: emails,
    slots: slots.length === 0 ? ['morning', 'evening'] : sortSlots(slots),
    patientName: typeof raw.patientName === 'string' ? raw.patientName : '',
    isCompleted: raw.isCompleted === true,
  };
}

export function parseRecord(value: unknown): DoseRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.date !== 'string' || !isSlotId(raw.slot)) return null;
  if (typeof raw.taken !== 'boolean' || typeof raw.recordedAt !== 'string') return null;

  return {
    date: raw.date,
    slot: raw.slot,
    taken: raw.taken,
    recordedAt: raw.recordedAt,
    photoKey: typeof raw.photoKey === 'string' ? raw.photoKey : null,
    photoUrl: typeof raw.photoUrl === 'string' ? raw.photoUrl : null,
    syncedAt: typeof raw.syncedAt === 'string' ? raw.syncedAt : null,
  };
}
