/**
 * IndexedDB Storage Helper for OnTrack
 * Provides persistent binary storage for the WebAssembly SQLite Database (.sqlite file)
 * and structured application data storage with capacity well beyond LocalStorage 5MB limits.
 */

const DB_NAME = 'fire4wd_ontrack_health_idb_v2';
const DB_VERSION = 1;
const STORE_SQLITE_BINARY = 'sqlite_binary_store';
const KEY_SQLITE_CURRENT = 'current_active_database';
const STORE_APP_KV = 'app_key_value_store';

let idbInstance: IDBDatabase | null = null;
let isOpening = false;
let openPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Checks if IndexedDB is supported and accessible in the current browser environment
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Opens or returns the singleton IndexedDB connection
 */
export function getIDBDatabase(): Promise<IDBDatabase | null> {
  if (idbInstance) {
    return Promise.resolve(idbInstance);
  }
  if (openPromise) {
    return openPromise;
  }
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(null);
  }

  openPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_SQLITE_BINARY)) {
          db.createObjectStore(STORE_SQLITE_BINARY);
        }
        if (!db.objectStoreNames.contains(STORE_APP_KV)) {
          db.createObjectStore(STORE_APP_KV);
        }
      };

      request.onsuccess = () => {
        idbInstance = request.result;
        idbInstance.onclose = () => {
          idbInstance = null;
          openPromise = null;
        };
        idbInstance.onversionchange = () => {
          idbInstance?.close();
          idbInstance = null;
          openPromise = null;
        };
        resolve(idbInstance);
      };

      request.onerror = (err) => {
        console.warn('Failed to open IndexedDB:', request.error || err);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open request was blocked');
        resolve(null);
      };
    } catch (err) {
      console.warn('Exception during IndexedDB initialization:', err);
      resolve(null);
    }
  });

  return openPromise;
}

/**
 * Persists the raw SQLite binary data (Uint8Array) directly into IndexedDB.
 * Supports large database files (100MB+) without Base64 encoding overhead or LocalStorage limits.
 */
export async function saveSqliteBinaryToIDB(data: Uint8Array): Promise<boolean> {
  try {
    const db = await getIDBDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SQLITE_BINARY, 'readwrite');
        const store = tx.objectStore(STORE_SQLITE_BINARY);
        
        // Clone safe buffer slice to prevent detachment issues
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        
        const payload = {
          data: buffer,
          savedAt: Date.now(),
          sizeBytes: buffer.byteLength
        };

        const putReq = store.put(payload, KEY_SQLITE_CURRENT);
        
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = (e) => {
          console.warn('IndexedDB put error for SQLite binary:', putReq.error || e);
          resolve(false);
        };
        tx.onerror = () => resolve(false);
      } catch (txErr) {
        console.warn('Error starting transaction for SQLite IDB save:', txErr);
        resolve(false);
      }
    });
  } catch (err) {
    console.warn('Failed to save SQLite binary to IndexedDB:', err);
    return false;
  }
}

/**
 * Loads the raw SQLite binary data (Uint8Array) from IndexedDB.
 * Returns null if no database was previously saved in IndexedDB.
 */
export async function loadSqliteBinaryFromIDB(): Promise<Uint8Array | null> {
  try {
    const db = await getIDBDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SQLITE_BINARY, 'readonly');
        const store = tx.objectStore(STORE_SQLITE_BINARY);
        const getReq = store.get(KEY_SQLITE_CURRENT);

        getReq.onsuccess = () => {
          const res = getReq.result;
          if (!res) {
            resolve(null);
            return;
          }

          if (res instanceof ArrayBuffer) {
            resolve(new Uint8Array(res));
          } else if (res instanceof Uint8Array) {
            resolve(res);
          } else if (res && res.data instanceof ArrayBuffer) {
            resolve(new Uint8Array(res.data));
          } else if (res && res.data instanceof Uint8Array) {
            resolve(res.data);
          } else {
            resolve(null);
          }
        };

        getReq.onerror = (e) => {
          console.warn('IndexedDB get error for SQLite binary:', getReq.error || e);
          resolve(null);
        };
      } catch (txErr) {
        console.warn('Error in IndexedDB read transaction:', txErr);
        resolve(null);
      }
    });
  } catch (err) {
    console.warn('Failed to load SQLite binary from IndexedDB:', err);
    return null;
  }
}

/**
 * Clears the SQLite binary database stored in IndexedDB.
 */
export async function clearSqliteBinaryFromIDB(): Promise<boolean> {
  try {
    const db = await getIDBDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_SQLITE_BINARY, 'readwrite');
        const store = tx.objectStore(STORE_SQLITE_BINARY);
        const delReq = store.delete(KEY_SQLITE_CURRENT);
        delReq.onsuccess = () => resolve(true);
        delReq.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Helper to store generic JSON/Object keys in IndexedDB as additional safeguard
 */
export async function saveKeyValueToIDB(key: string, value: any): Promise<boolean> {
  try {
    const db = await getIDBDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_APP_KV, 'readwrite');
        const store = tx.objectStore(STORE_APP_KV);
        const req = store.put(value, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Helper to retrieve generic JSON/Object keys from IndexedDB
 */
export async function getKeyValueFromIDB<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getIDBDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_APP_KV, 'readonly');
        const store = tx.objectStore(STORE_APP_KV);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}
