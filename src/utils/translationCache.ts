import type { SentenceTranslation } from '@/types/translation';

const DB_NAME = 'TranslationCache';
const DB_VERSION = 1;
const STORE_NAME = 'pageTranslations';

interface PageTranslationCache {
  pageNumber: number;
  sentences: SentenceTranslation[];
  pageTranslation?: string;
  createdAt: number;
  expiresAt: number;
  version: number;
}

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
    });
  }

  async getPageTranslation(pageNumber: number): Promise<PageTranslationCache | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      transaction.onerror = () => {
        reject(new Error('Transaction failed'));
      };
      
      const request = store.get(pageNumber);
      request.onerror = () => {
        reject(request.error);
      };
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        if (result.expiresAt < Date.now()) {
          this.deletePageTranslation(pageNumber).then(() => {
            resolve(null);
          });
          return;
        }

        resolve(result);
      };
    });
  }

  async storePageTranslation(pageNumber: number, sentences: SentenceTranslation[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      transaction.onerror = () => {
        reject(new Error('Transaction failed'));
      };
      
      const cache: PageTranslationCache = {
        pageNumber,
        sentences,
        createdAt: Date.now(),
        expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
        version: 0
      };

      const request = store.put(cache);
      request.onerror = () => {
        reject(new Error('Failed to update cache'));
      };
      request.onsuccess = () => {
        resolve();
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
        existingCache.version = (existingCache.version || 0) + 1;
      } else {
        existingCache.sentences.push(sentence);
        existingCache.version = 1;
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
      
      transaction.onerror = () => {
        reject(new Error('Transaction failed'));
      };
      
      const request = store.delete(pageNumber);
      request.onerror = () => {
        reject(new Error('Failed to delete cache'));
      };
      request.onsuccess = () => {
        resolve();
      };
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