import { useSyncExternalStore } from 'react';

import { CloudSync } from './cloud';
import {
  MAX_RECIPIENTS,
  recordKey,
  sortSlots,
  type AppSettings,
  type DoseRecord,
} from './models';
import { deletePhoto, savePhoto } from './photos';
import { currentOccurrence, formatDateKey, sortRecords } from './schedule';
import { loadRecords, loadSettings, persistRecords, persistSettings } from './store';
import { pushToast } from './toast';

export interface AppSnapshot {
  settings: AppSettings;
  records: DoseRecord[];
  lastSubmitted: DoseRecord | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isCloudEnabled: boolean;
}

interface State {
  settings: AppSettings;
  records: DoseRecord[];
  lastSubmittedKey: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isCloudEnabled: boolean;
}

export class AppController {
  private cloud = new CloudSync();
  private listeners = new Set<() => void>();
  private tail: Promise<void> = Promise.resolve();
  private started = false;
  private loadPromise: Promise<void> | null = null;

  private state: State = {
    settings: loadSettings(),
    records: [],
    lastSubmittedKey: null,
    isLoading: true,
    isSubmitting: false,
    isCloudEnabled: false,
  };

  private snapshot: AppSnapshot = this.build();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AppSnapshot => this.snapshot;

  load(): Promise<void> {
    if (this.started) return this.loadPromise ?? Promise.resolve();
    this.started = true;
    this.loadPromise = this.loadInner();
    return this.loadPromise;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const next: AppSettings = {
      recipientEmails: settings.recipientEmails
        .map((email) => email.trim())
        .filter((email) => email.length > 0)
        .slice(0, MAX_RECIPIENTS),
      slots: sortSlots(settings.slots),
      patientName: settings.patientName.trim(),
      isCompleted: true,
    };
    persistSettings(next);
    this.commit({ settings: next });
    await this.enqueue(async () => {
      await this.cloud.initialize();
      this.commit({ isCloudEnabled: this.cloud.isAvailable });
      if (!this.cloud.isAvailable) return;
      try {
        await this.cloud.pushSettings(next);
      } catch (error) {
        console.warn(error);
        pushToast('このブラウザには保存しました。サーバーへの送信は失敗しました');
      }
    });
  }

  async submit(taken: boolean, photo: Blob | null): Promise<void> {
    if (this.state.isSubmitting) return;
    this.commit({ isSubmitting: true });
    try {
      const now = new Date();
      const occurrence = currentOccurrence(
        this.state.settings.slots,
        this.state.records,
        now,
      );
      const date = formatDateKey(occurrence.date);
      const slot = occurrence.slot;
      let photoKey: string | null = null;
      if (photo) {
        photoKey = recordKey({ date, slot });
        await savePhoto(photoKey, photo);
      }
      const record: DoseRecord = {
        date,
        slot,
        taken,
        recordedAt: now.toISOString(),
        photoKey,
        photoUrl: null,
        syncedAt: null,
      };
      const records = [
        record,
        ...this.state.records.filter((item) => recordKey(item) !== recordKey(record)),
      ];
      persistRecords(records);
      this.commit({
        records,
        lastSubmittedKey: recordKey(record),
        isSubmitting: false,
      });
      void this.enqueue(() => this.pushAndStore(record));
    } catch (error) {
      console.warn(error);
      this.commit({ isSubmitting: false });
      pushToast('記録を保存できませんでした');
      throw error;
    }
  }

  dismissConfirmation(): void {
    this.commit({ lastSubmittedKey: null });
  }

  async undoLastSubmitted(): Promise<void> {
    const record = this.snapshot.lastSubmitted;
    if (!record) return;
    await this.deleteRecord(record);
  }

  async deleteRecord(record: DoseRecord): Promise<void> {
    const key = recordKey(record);
    const records = this.state.records.filter((item) => recordKey(item) !== key);
    persistRecords(records);
    try {
      await deletePhoto(record.photoKey);
    } catch (error) {
      console.warn(error);
    }
    this.commit({
      records,
      lastSubmittedKey: this.state.lastSubmittedKey === key ? null : this.state.lastSubmittedKey,
    });
    void this.enqueue(async () => {
      await this.cloud.initialize();
      this.commit({ isCloudEnabled: this.cloud.isAvailable });
      if (!this.cloud.isAvailable) return;
      try {
        await this.cloud.deleteRecord(key);
      } catch (error) {
        console.warn(error);
      }
    });
  }

  async syncPending(): Promise<void> {
    await this.enqueue(() => this.syncPendingInner());
  }

  private async loadInner(): Promise<void> {
    this.commit({
      settings: loadSettings(),
      records: loadRecords(),
    });
    await this.cloud.initialize();
    this.commit({
      isCloudEnabled: this.cloud.isAvailable,
      isLoading: false,
    });
    await this.syncPending();
  }

  private async pushAndStore(record: DoseRecord): Promise<void> {
    await this.cloud.initialize();
    this.commit({ isCloudEnabled: this.cloud.isAvailable });
    if (!this.cloud.isAvailable) return;
    const key = recordKey(record);
    try {
      const synced = await this.cloud.pushRecord(record);
      if (!this.state.records.some((item) => recordKey(item) === key)) {
        await this.cloud.deleteRecord(key);
        return;
      }
      const records = this.state.records.map((item) =>
        recordKey(item) === key ? synced : item,
      );
      persistRecords(records);
      this.commit({ records });
    } catch (error) {
      console.warn(error);
    }
  }

  private async syncPendingInner(): Promise<void> {
    await this.cloud.initialize();
    this.commit({ isCloudEnabled: this.cloud.isAvailable });
    if (!this.cloud.isAvailable) return;

    const pending = this.state.records.filter((record) => record.syncedAt === null);
    let changed = false;
    for (const record of pending) {
      const key = recordKey(record);
      if (!this.state.records.some((item) => recordKey(item) === key)) continue;
      try {
        const synced = await this.cloud.pushRecord(record);
        if (!this.state.records.some((item) => recordKey(item) === key)) {
          await this.cloud.deleteRecord(key);
          continue;
        }
        this.commit({
          records: this.state.records.map((item) => (recordKey(item) === key ? synced : item)),
        });
        changed = true;
      } catch (error) {
        console.warn(error);
      }
    }
    if (changed) persistRecords(this.state.records);
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.tail.then(task).catch((error) => {
      console.warn(error);
    });
    this.tail = run;
    return run;
  }

  private commit(partial: Partial<State>): void {
    const records = partial.records ? sortRecords(partial.records) : this.state.records;
    this.state = { ...this.state, ...partial, records };
    this.snapshot = this.build();
    this.listeners.forEach((listener) => listener());
  }

  private build(): AppSnapshot {
    const lastSubmitted = this.state.lastSubmittedKey
      ? this.state.records.find((record) => recordKey(record) === this.state.lastSubmittedKey) ??
        null
      : null;
    if (!lastSubmitted) this.state.lastSubmittedKey = null;
    return {
      settings: this.state.settings,
      records: this.state.records,
      lastSubmitted,
      isLoading: this.state.isLoading,
      isSubmitting: this.state.isSubmitting,
      isCloudEnabled: this.state.isCloudEnabled,
    };
  }
}

export const appController = new AppController();

export function useSnapshot(): AppSnapshot {
  return useSyncExternalStore(appController.subscribe, appController.getSnapshot);
}
