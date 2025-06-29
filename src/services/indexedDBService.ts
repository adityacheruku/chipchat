
"use client";

import type { UploadItem } from '@/types';

const DB_NAME = 'kuchlu-uploads';
const DB_VERSION = 1;
const STORE_NAME = 'uploadQueue';

let db: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
        reject('IndexedDB is not supported.');
        return;
    }

    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening IndexedDB');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const getStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
  const dbInstance = await getDB();
  const transaction = dbInstance.transaction(STORE_NAME, mode);
  return transaction.objectStore(STORE_NAME);
};

export const indexedDBService = {
  addUploadItem: async (item: UploadItem): Promise<void> => {
    const store = await getStore('readwrite');
    store.add(item);
  },

  updateUploadItem: async (item: UploadItem): Promise<void> => {
    const store = await getStore('readwrite');
    store.put(item);
  },
  
  removeUploadItem: async (id: string): Promise<void> => {
    const store = await getStore('readwrite');
    store.delete(id);
  },
  
  getAllPendingUploads: async (): Promise<UploadItem[]> => {
    return new Promise(async (resolve, reject) => {
        try {
            const store = await getStore('readonly');
            const request = store.getAll();
            request.onsuccess = () => {
                const items = request.result as UploadItem[];
                // Filter for items that were interrupted during processing.
                const pendingItems = items.filter(item => item.status !== 'completed' && item.status !== 'cancelled');
                resolve(pendingItems);
            };
            request.onerror = () => {
                console.error('Error fetching pending uploads:', request.error);
                reject('Could not fetch pending uploads.');
            };
        } catch (error) {
            reject(error);
        }
    });
  },
};
