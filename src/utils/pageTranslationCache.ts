import type { SentenceTranslation } from '@/types/translation';

interface PageTranslationCacheType {
  pageNumber: number;
  sentences: SentenceTranslation[];
  pageTranslation?: string;
  createdAt: number;
  expiresAt: number;
  version: number;
}

const PageTranslationCache = {
  async getPageTranslation(pageNumber: number): Promise<PageTranslationCacheType | null> {
    const request = indexedDB.open('TranslationCache', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        
        try {
          const transaction = db.transaction(['pageTranslations'], 'readonly');
          const store = transaction.objectStore('pageTranslations');
          
          transaction.onerror = () => {
            reject(new Error('Transaction failed'));
          };
          
          const request = store.get(pageNumber);
          request.onerror = () => reject(request.error);
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
        } catch (error) {
          reject(error);
        }
      };
    });
  },

  async storePageTranslation(pageNumber: number, sentences: SentenceTranslation[]): Promise<void> {
    const request = indexedDB.open('TranslationCache', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        
        try {
          const transaction = db.transaction(['pageTranslations'], 'readwrite');
          const store = transaction.objectStore('pageTranslations');
          
          transaction.onerror = () => {
            reject(new Error('Transaction failed'));
          };
          
          const cache: PageTranslationCacheType = {
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
        } catch (error) {
          reject(error);
        }
      };
    });
  },

  async storeSentence(sentence: SentenceTranslation): Promise<void> {
    const existingCache = await this.getPageTranslation(sentence.pageNumber);
    
    if (existingCache) {
      const existingSentenceIndex = existingCache.sentences.findIndex(
        (s: SentenceTranslation) => s.id === sentence.id
      );
      
      if (existingSentenceIndex >= 0) {
        existingCache.sentences[existingSentenceIndex] = sentence;
        existingCache.version = (existingCache.version || 0) + 1;
      } else {
        existingCache.sentences.push(sentence);
        existingCache.version = 1;
      }
      
      existingCache.sentences.sort((a: SentenceTranslation, b: SentenceTranslation) => a.sentenceIndex - b.sentenceIndex);
      await this.storePageTranslation(sentence.pageNumber, existingCache.sentences);
    } else {
      await this.storePageTranslation(sentence.pageNumber, [sentence]);
    }
  },

  async deletePageTranslation(pageNumber: number): Promise<void> {
    const request = indexedDB.open('TranslationCache', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        
        try {
          const transaction = db.transaction(['pageTranslations'], 'readwrite');
          const store = transaction.objectStore('pageTranslations');
          
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
        } catch (error) {
          reject(error);
        }
      };
    });
  },

  async cleanupExpired(): Promise<void> {
    const request = indexedDB.open('TranslationCache', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        
        try {
          const transaction = db.transaction(['pageTranslations'], 'readwrite');
          const store = transaction.objectStore('pageTranslations');
          
          transaction.onerror = () => {
            reject(new Error('Transaction failed'));
          };
          
          const index = store.index('expiresAt');
          const request = index.openCursor(IDBKeyRange.upperBound(Date.now()));
          
          request.onerror = () => {
            reject(request.error);
          };
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            
            if (cursor instanceof IDBCursorWithValue) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
        } catch (error) {
          reject(error);
        }
      };
    });
  },

  async clear(): Promise<void> {
    const request = indexedDB.open('TranslationCache', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        
        try {
          const transaction = db.transaction(['pageTranslations'], 'readwrite');
          const store = transaction.objectStore('pageTranslations');
          
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
        } catch (error) {
          reject(error);
        }
      };
    });
  }
};

export const translationCache = PageTranslationCache;
export type { PageTranslationCache };