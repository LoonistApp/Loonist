/**
 * Local storage for customer Excel template files.
 *
 * Template bytes live in IndexedDB on this machine only (never synced anywhere),
 * keyed by the TemplateItem id kept in Application Options.
 */

const DB_NAME = 'loonist_templates';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Template storage is not available in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const templateFileStore = {
  save: (id: string, bytes: Uint8Array): Promise<IDBValidKey> =>
    run('readwrite', store => store.put(bytes, id)),

  load: async (id: string): Promise<Uint8Array | null> => {
    const value = await run<unknown>('readonly', store => store.get(id));
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return null;
  },

  /** Deletes stored files whose template is no longer in the saved options. */
  prune: async (keepIds: string[]): Promise<void> => {
    const keys = await run<IDBValidKey[]>('readonly', store => store.getAllKeys());
    const keep = new Set(keepIds);
    for (const key of keys) {
      if (typeof key === 'string' && !keep.has(key)) {
        await run('readwrite', store => store.delete(key));
      }
    }
  }
};
