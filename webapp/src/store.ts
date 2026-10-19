import {
  defaultSettings,
  parseRecord,
  parseSettings,
  type AppSettings,
  type DoseRecord,
} from './models';

const SETTINGS_KEY = 'okusuri.settings';
const RECORDS_KEY = 'okusuri.records';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return parseSettings(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export function persistSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadRecords(): DoseRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const record = parseRecord(item);
      return record ? [record] : [];
    });
  } catch {
    return [];
  }
}

export function persistRecords(records: readonly DoseRecord[]): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}
