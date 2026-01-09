import type { SentenceTranslation, PageTranslationCache } from '@/types/translation';

const DB_NAME = 'TranslationCache';
const DB_VERSION = 1;
const STORE_NAME = 'pageTranslations';

class TranslationCacheDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'pageNumber' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  async storePageTranslation(pageNumber: number, sentences: SentenceTranslation[]): Promise<void> {
    if (!this.db) await this.init();

    const cache: PageTranslationCache = {
      pageNumber,
      sentences,
      createdAt: Date.now(),
      expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000)
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.put(cache);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPageTranslation(pageNumber: number): Promise<PageTranslationCache | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.get(pageNumber);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        if (result.expiresAt < Date.now()) {
          this.deletePageTranslation(pageNumber);
          resolve(null);
          return;
        }

        resolve(result);
      };
    });
  }

  async storeSentence(sentence: SentenceTranslation): Promise<void> {
    const existingCache = await this.getPageTranslation(sentence.pageNumber);
    
    if (existingCache) {
      const existingSentenceIndex = existingCache.sentences.findIndex(
        s => s.id === sentence.id
      );
      
      if (existingSentenceIndex >= 0) {
        existingCache.sentences[existingSentenceIndex] = sentence;
      } else {
        existingCache.sentences.push(sentence);
      }
      
      existingCache.sentences.sort((a, b) => a.sentenceIndex - b.sentenceIndex);
      await this.storePageTranslation(sentence.pageNumber, existingCache.sentences);
    } else {
      await this.storePageTranslation(sentence.pageNumber, [sentence]);
    }
  }

  async deletePageTranslation(pageNumber: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.delete(pageNumber);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async cleanupExpired(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiresAt');
      
      const request = index.openCursor(IDBKeyRange.upperBound(Date.now()));
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
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
      
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const translationCache = new TranslationCacheDB();