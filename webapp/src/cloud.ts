import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';

import { firebaseConfig } from './firebase-config';
import { SLOTS, sortSlots, type AppSettings, type DoseRecord } from './models';
import { recordKey } from './models';
import { loadPhotoBlob } from './photos';

/**
 * 設定と記録を Firestore / Storage に置く。
 * 文書の形は functions/src/index.ts の日次メールが読む形と揃えている。
 */
export class CloudSync {
  private db: Firestore | null = null;
  private storage: FirebaseStorage | null = null;
  private uid: string | null = null;
  private initPromise: Promise<void> | null = null;

  get isAvailable(): boolean {
    return this.db !== null && this.uid !== null;
  }

  async initialize(): Promise<void> {
    if (this.isAvailable) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initializeInner().finally(() => {
      if (!this.isAvailable) this.initPromise = null;
    });
    return this.initPromise;
  }

  async pushSettings(settings: AppSettings): Promise<void> {
    const db = this.db;
    const uid = this.uid;
    if (!db || !uid) return;

    const household = doc(db, 'households', uid);
    const existing = await getDoc(household);
    const data: {
      recipientEmails: string[];
      slots: string[];
      patientName: string;
      timezone: string;
      updatedAt: ReturnType<typeof serverTimestamp>;
      createdAt?: ReturnType<typeof serverTimestamp>;
    } = {
      recipientEmails: settings.recipientEmails.slice(0, 2),
      slots: sortSlots(settings.slots),
      patientName: settings.patientName,
      timezone: 'Asia/Tokyo',
      updatedAt: serverTimestamp(),
    };
    if (!existing.exists()) data.createdAt = serverTimestamp();
    await setDoc(household, data, { merge: true });
  }

  async pushRecord(record: DoseRecord): Promise<DoseRecord> {
    const db = this.db;
    const uid = this.uid;
    if (!db || !uid) return record;

    const key = recordKey(record);
    let photoUrl = record.photoUrl;
    if (!photoUrl && record.photoKey) {
      const blob = await loadPhotoBlob(record.photoKey);
      if (blob) photoUrl = await this.uploadPhoto(key, blob);
    }

    const recordRef = doc(db, 'households', uid, 'records', key);
    const existing = await getDoc(recordRef);
    const data: {
      date: string;
      slot: DoseRecord['slot'];
      slotLabel: string;
      taken: boolean;
      photoUrl: string | null;
      photoStoragePath: string | null;
      recordedAt: Timestamp;
      updatedAt: ReturnType<typeof serverTimestamp>;
      reportedAt?: null;
    } = {
      date: record.date,
      slot: record.slot,
      slotLabel: SLOTS[record.slot].label,
      taken: record.taken,
      photoUrl: photoUrl ?? null,
      photoStoragePath: photoUrl ? this.photoPath(key) : null,
      recordedAt: Timestamp.fromDate(new Date(record.recordedAt)),
      updatedAt: serverTimestamp(),
    };
    // 再送時に reportedAt を null で塗り潰すと二重送信になるため初回だけ書く。
    if (!existing.exists()) data.reportedAt = null;
    await setDoc(recordRef, data, { merge: true });

    return {
      ...record,
      photoUrl: photoUrl ?? null,
      syncedAt: new Date().toISOString(),
    };
  }

  async deleteRecord(key: string): Promise<void> {
    const db = this.db;
    const uid = this.uid;
    if (!db || !uid) return;
    await deleteDoc(doc(db, 'households', uid, 'records', key));
    try {
      await deleteObject(ref(this.storage!, this.photoPath(key)));
    } catch {
      // 写真が無い記録では 404 になるので無視する。
    }
  }

  private photoPath(key: string): string {
    return `households/${this.uid}/photos/${key}.jpg`;
  }

  private async uploadPhoto(key: string, blob: Blob): Promise<string> {
    const storageRef = ref(this.storage!, this.photoPath(key));
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
  }

  private async initializeInner(): Promise<void> {
    try {
      const app = firebaseApp();
      const auth = getAuth(app);
      const user = (await currentUser(auth)) ?? (await signInAnonymously(auth)).user;
      this.uid = user?.uid ?? null;
      this.db = getFirestore(app);
      this.storage = getStorage(app);
      if (!this.uid) {
        this.db = null;
        this.storage = null;
      }
    } catch (error) {
      this.db = null;
      this.storage = null;
      this.uid = null;
      console.warn('CloudSync 無効（このブラウザ内の保存だけで動作します）', error);
    }
  }
}

function firebaseApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

function currentUser(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}
