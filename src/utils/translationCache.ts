import type { SentenceTranslation } from '@/types/translation';

const DB_NAME = 'TranslationCache';
const DB_VERSION = 3;
const STORE_NAME = 'pageTranslations';

interface PageTranslationCache {
  docId: string;
  pageNumber: number;
  sentences: SentenceTranslation[];
  pageTranslation?: string;
  createdAt: number;
  expiresAt: number;
  version: number;
}

class TranslationCacheDB {
  private db: IDBDatabase | null = null;
  // [Fix] 페이지별 작업 큐 (Mutex 역할) - Key: `${docId}_${pageNumber}`
  private pageOperations: Map<string, Promise<void>> = new Map();

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Delete old store if exists (Simple migration strategy as requested by user - start fresh)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }

        const store = db.createObjectStore(STORE_NAME, { keyPath: ['docId', 'pageNumber'] });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
    });
  }

  private async performAtomicOperation<T>(
    docId: string,
    pageNumber: number,
    operation: () => Promise<T>
  ): Promise<T> {
    const key = `${docId}_${pageNumber}`;
    const previousOperation = this.pageOperations.get(key) || Promise.resolve();

    const currentOperation = previousOperation.then(() => operation()).catch((err) => {
      console.error(`Atomic operation failed for ${key}`, err);
      throw err;
    });

    const operationCleanupPromise = currentOperation.then(() => { });
    this.pageOperations.set(key, operationCleanupPromise);

    operationCleanupPromise.finally(() => {
      if (this.pageOperations.get(key) === operationCleanupPromise) {
        this.pageOperations.delete(key);
      }
    });

    return currentOperation;
  }

  async getPageTranslation(docId: string, pageNumber: number): Promise<PageTranslationCache | null> {
    if (!docId) return null;
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get([docId, pageNumber]);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as PageTranslationCache | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        if (result.expiresAt < Date.now()) {
          resolve(null);
        } else {
          resolve(result);
        }
      };
    });
  }

  async storeSentences(docId: string, sentences: SentenceTranslation[]): Promise<void> {
    if (!docId || sentences.length === 0) return;
    const pageNumber = sentences[0].pageNumber;

    return this.performAtomicOperation(docId, pageNumber, async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const getRequest = store.get([docId, pageNumber]);

        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => {
          let cache: PageTranslationCache = getRequest.result;

          if (cache) {
            const newSentencesMap = new Map(cache.sentences.map(s => [s.id, s]));
            sentences.forEach(s => newSentencesMap.set(s.id, s));
            cache.sentences = Array.from(newSentencesMap.values())
              .sort((a, b) => a.sentenceIndex - b.sentenceIndex);
            cache.version = (cache.version || 0) + 1;
            cache.expiresAt = Date.now() + (4 * 24 * 60 * 60 * 1000); // Renew expiration
          } else {
            cache = {
              docId,
              pageNumber,
              sentences: sentences.sort((a, b) => a.sentenceIndex - b.sentenceIndex),
              createdAt: Date.now(),
              expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
              version: 1
            };
          }

          const putRequest = store.put(cache);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        };
      });
    });
  }

  async storeSentence(docId: string, sentence: SentenceTranslation): Promise<void> {
    if (!docId) return;
    return this.performAtomicOperation(docId, sentence.pageNumber, async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const readRequest = store.get([docId, sentence.pageNumber]);

        readRequest.onerror = () => reject(readRequest.error);

        readRequest.onsuccess = () => {
          let cache: PageTranslationCache = readRequest.result;

          if (cache) {
            const existingSentenceIndex = cache.sentences.findIndex(
              s => s.id === sentence.id
            );

            if (existingSentenceIndex >= 0) {
              cache.sentences[existingSentenceIndex] = sentence;
            } else {
              cache.sentences.push(sentence);
            }

            cache.sentences.sort((a, b) => a.sentenceIndex - b.sentenceIndex);

            cache.version = (cache.version || 0) + 1;
            cache.expiresAt = Date.now() + (4 * 24 * 60 * 60 * 1000);
          } else {
            cache = {
              docId,
              pageNumber: sentence.pageNumber,
              sentences: [sentence],
              createdAt: Date.now(),
              expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
              version: 1
            };
          }

          const writeRequest = store.put(cache);

          writeRequest.onerror = () => reject(writeRequest.error);
          writeRequest.onsuccess = () => resolve();
        };
      });
    });
  }

  async deletePageTranslation(docId: string, pageNumber: number): Promise<void> {
    if (!docId) return;
    return this.performAtomicOperation(docId, pageNumber, async () => {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete([docId, pageNumber]);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });
  }

  async cleanupExpired(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.onerror = () => {
        reject(new Error('Transaction failed'));
      };

      const index = store.index('expiresAt');
      const request = index.openCursor(IDBKeyRange.upperBound(Date.now()));

      request.onerror = () => {
        reject(new Error('Transaction failed'));
      };
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor instanceof IDBCursorWithValue) {
          const cache = cursor.value as PageTranslationCache;

          if (cache.expiresAt < Date.now()) {
            cursor.delete();
            cursor.continue();
          } else {
            cursor.continue();
          }
        } else {
          resolve();
        }
      };
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.onerror = () => {
        reject(new Error('Transaction failed'));
      };

      const request = store.clear();
      request.onerror = () => {
        reject(new Error('Failed to clear cache'));
      };
      request.onsuccess = () => {
        resolve();
      };
    });
  }
}

export const translationCache = new TranslationCacheDB();