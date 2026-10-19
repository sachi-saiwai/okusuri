const memory = new Map<string, Blob>();
const urls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('okusuri', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('photos')) {
        request.result.createObjectStore('photos');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction('photos', mode);
        const request = run(tx.objectStore('photos'));
        request.onsuccess = () => {
          db.close();
          resolve(request.result);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      }),
  );
}

export function cachedPhotoUrl(key: string | null): string | null {
  if (!key) return null;
  return urls.get(key) ?? null;
}

export async function savePhoto(key: string, blob: Blob): Promise<void> {
  memory.set(key, blob);
  const previous = urls.get(key);
  if (previous) URL.revokeObjectURL(previous);
  urls.set(key, URL.createObjectURL(blob));
  try {
    await withStore('readwrite', (store) => store.put(blob, key));
  } catch (error) {
    console.warn(error);
  }
}

export async function loadPhotoBlob(key: string): Promise<Blob | null> {
  const cached = memory.get(key);
  if (cached) return cached;
  try {
    const blob = await withStore<Blob | undefined>('readonly', (store) => store.get(key));
    if (!blob) return null;
    memory.set(key, blob);
    return blob;
  } catch {
    return null;
  }
}

export async function hydratePhoto(key: string): Promise<string | null> {
  const cached = urls.get(key);
  if (cached) return cached;
  const blob = await loadPhotoBlob(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(key, url);
  return url;
}

export async function deletePhoto(key: string | null): Promise<void> {
  if (!key) return;
  const url = urls.get(key);
  if (url) URL.revokeObjectURL(url);
  urls.delete(key);
  memory.delete(key);
  try {
    await withStore('readwrite', (store) => store.delete(key));
  } catch (error) {
    console.warn(error);
  }
}

export function frameToJpeg(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return Promise.reject(new Error('撮影に失敗しました'));
  return drawToJpeg(width, height, (ctx, w, h) => {
    ctx.drawImage(video, 0, 0, w, h);
  });
}

export async function fileToJpeg(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    return await drawToJpeg(bitmap.width, bitmap.height, (ctx, w, h) => {
      ctx.drawImage(bitmap, 0, 0, w, h);
    });
  } finally {
    bitmap.close();
  }
}

function drawToJpeg(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Promise<Blob> {
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('撮影に失敗しました'));
  draw(ctx, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('撮影に失敗しました'));
      },
      'image/jpeg',
      0.85,
    );
  });
}
