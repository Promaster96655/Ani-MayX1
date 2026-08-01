// Local IndexedDB Storage Engine for high-speed offline video caches
// This helps prevent "Uploading: 0%" issues when Firebase Storage is slow, has CORS policies, or is unconfigured.

const DB_NAME = 'AniMayXVideoCache';
const DB_VERSION = 2;
const STORE_NAME = 'videos';

export function openVideoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported or not available in this environment.'));
      }
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        try {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch (e) {
          console.error("IndexedDB upgrade error:", e);
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result);
      };

      request.onerror = (event: any) => {
        reject(event.target.error || new Error('Failed to open IndexedDB'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Saves a file (Blob or File) into browser persistent IndexedDB storage
 */
export async function storeVideoInIndexedDB(key: string, file: Blob | File): Promise<void> {
  try {
    const db = await openVideoDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(file, key);

      request.onsuccess = () => {
        console.log(`Video file successfully cached in browser local IndexedDB under key: ${key}`);
        resolve();
      };

      request.onerror = (event: any) => {
        console.error("IndexedDB write transaction failed:", event.target.error);
        reject(event.target.error);
      };
    });
  } catch (err) {
    console.error("Failed to open IndexedDB to cache video:", err);
    throw err;
  }
}

/**
 * Retrieves a file from local IndexedDB storage
 */
export async function getVideoFromIndexedDB(key: string): Promise<Blob | null> {
  try {
    const db = await openVideoDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = (event: any) => {
        resolve(event.target.result || null);
      };

      request.onerror = (event: any) => {
        console.warn(`IndexedDB read transaction warning for key ${key}:`, event.target.error);
        resolve(null);
      };
    });
  } catch (err) {
    console.warn("Could not open IndexedDB to lookup cached video:", err);
    return null;
  }
}

/**
 * Deletes a stored video from local IndexedDB cache
 */
export async function deleteVideoFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await openVideoDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log(`Successfully cleared local IndexedDB video cache for: ${key}`);
        resolve();
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });
  } catch (err) {
    console.warn("Could not open IndexedDB to delete cached video:", err);
  }
}
