import type { SentenceTranslation } from '@/types/translation';

const DB_NAME = 'TranslationCache';
const DB_VERSION = 2;
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
  // [Fix] 페이지별 작업 큐 (Mutex 역할)
  private pageOperations: Map<number, Promise<void>> = new Map();

  async init(): Promise<void> {
    if (this.db) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'pageNumber' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        } else {
          const storeRequest = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
          if (db.version === 2) {
            storeRequest.getAll().onsuccess = (e: Event) => {
              const getAllRequest = e.target as IDBRequest;
              const existingRecords = getAllRequest.result as PageTranslationCache[];
              existingRecords.forEach((record) => {
                if (record.version === undefined) {
                  record.version = 0;
                  storeRequest.put(record);
                }
              });
            };
          }
        }
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
    });
  }

    private async performAtomicOperation<T>(
    pageNumber: number, 
    operation: () => Promise<T>
  ): Promise<T> {
    const previousOperation = this.pageOperations.get(pageNumber) || Promise.resolve();
    
    const currentOperation = previousOperation.then(() => operation()).catch((err) => {
        console.error(`Atomic operation failed for page ${pageNumber}`, err);
        throw err;
    });
    
    const operationCleanupPromise = currentOperation.then(() => {});
    this.pageOperations.set(pageNumber, operationCleanupPromise);
    
    operationCleanupPromise.finally(() => {
        if (this.pageOperations.get(pageNumber) === operationCleanupPromise) {
            this.pageOperations.delete(pageNumber);
        }
    });
    
    return currentOperation;
  }

  async getPageTranslation(pageNumber: number): Promise<PageTranslationCache | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(pageNumber);
              
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

    async storeSentences(sentences: SentenceTranslation[]): Promise<void> {
      if (sentences.length === 0) return;
      const pageNumber = sentences[0].pageNumber;
        
        return this.performAtomicOperation(pageNumber, async () => {
          if (!this.db) await this.init();
                    
          return new Promise<void>((resolve, reject) => {
              const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
              const store = transaction.objectStore(STORE_NAME);
                            
              const getRequest = store.get(pageNumber);
                            
              getRequest.onerror = () => reject(getRequest.error);
              getRequest.onsuccess = () => {
                  let cache: PageTranslationCache = getRequest.result;
                                    
                  if (cache) {
                      const newSentencesMap = new Map(cache.sentences.map(s => [s.id, s]));
                      sentences.forEach(s => newSentencesMap.set(s.id, s));
                      cache.sentences = Array.from(newSentencesMap.values())
                          .sort((a, b) => a.sentenceIndex - b.sentenceIndex);
                      cache.version = (cache.version || 0) + 1;
                  } else {
                      cache = {
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

  async storeSentence(sentence: SentenceTranslation): Promise<void> {
    return this.performAtomicOperation(sentence.pageNumber, async () => {
      if (!this.db) await this.init();
        
        return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
          
        const readRequest = store.get(sentence.pageNumber);
          
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

  async deletePageTranslation(pageNumber: number): Promise<void> {
      return this.performAtomicOperation(pageNumber, async () => {
          if (!this.db) await this.init();
          return new Promise((resolve, reject) => {
              const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
              const store = transaction.objectStore(STORE_NAME);
              const request = store.delete(pageNumber);
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