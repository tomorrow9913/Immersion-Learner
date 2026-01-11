import type { SentenceTranslation } from '@/types/translation';
import { KeyedMutex } from './mutex';
import { Logger } from './logger';

const DB_NAME = 'TranslationCache';
const DB_VERSION = 4;
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
  private mutex = new KeyedMutex();

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

  async getPageTranslation(docId: string, pageNumber: number): Promise<PageTranslationCache | null> {
    if (!docId) {
      Logger.warn('[TranslationCache] docId가 없어 조회를 건너뜁니다.');
      return null;
    }
    if (!this.db) await this.init();

    return this.mutex.runExclusive(`${docId}_${pageNumber}`, () => new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get([docId, pageNumber]);

      request.onerror = () => {
        Logger.warn('[TranslationCache] 조회 실패:', request.error);
        reject(request.error);
      };
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
    }));
  }

  async storeSentences(docId: string, sentences: SentenceTranslation[]): Promise<void> {
    if (!docId) {
      Logger.warn('[TranslationCache] docId가 없어 저장을 건너뜁니다.');
      return;
    }
    if (sentences.length === 0) return;
    const pageNumber = sentences[0].pageNumber;

    return this.mutex.runExclusive(`${docId}_${pageNumber}`, async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const getRequest = store.get([docId, pageNumber]);

        getRequest.onerror = () => {
          Logger.warn('[TranslationCache] 조회 실패:', getRequest.error);
          reject(getRequest.error);
        };
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
          putRequest.onerror = () => {
            Logger.warn('[TranslationCache] 저장 실패:', putRequest.error);
            reject(putRequest.error);
          };
          putRequest.onsuccess = () => {
            Logger.debug(`[TranslationCache] 저장 성공: ${docId} (Page ${pageNumber})`);
            resolve();
          };
        };
      });
    });
  }

  async storeSentence(docId: string, sentence: SentenceTranslation): Promise<void> {
    if (!docId) {
      Logger.warn('[TranslationCache] docId가 없어 단일 문장 저장을 건너뜁니다.');
      return;
    }
    return this.mutex.runExclusive(`${docId}_${sentence.pageNumber}`, async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const readRequest = store.get([docId, sentence.pageNumber]);

        readRequest.onerror = () => {
          Logger.warn('[TranslationCache] 조회 실패 (Single):', readRequest.error);
          reject(readRequest.error);
        };

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

          writeRequest.onerror = () => {
            Logger.warn('[TranslationCache] 문장 저장 실패:', writeRequest.error);
            reject(writeRequest.error);
          };
          writeRequest.onsuccess = () => {
            Logger.debug(`[TranslationCache] 문장 저장 성공: ${docId}, p${sentence.pageNumber}, s${sentence.sentenceIndex}`);
            resolve();
          };
        };
      });
    });
  }

  async deletePageTranslation(docId: string, pageNumber: number): Promise<void> {
    if (!docId) {
      Logger.warn('[TranslationCache] docId가 없어 삭제를 건너뜁니다.');
      return;
    }
    return this.mutex.runExclusive(`${docId}_${pageNumber}`, async () => {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete([docId, pageNumber]);
        request.onerror = () => {
          Logger.warn('[TranslationCache] 삭제 실패:', request.error);
          reject(request.error);
        };
        request.onsuccess = () => {
          Logger.debug(`[TranslationCache] 삭제 성공: ${docId} (Page ${pageNumber})`);
          resolve();
        };
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
