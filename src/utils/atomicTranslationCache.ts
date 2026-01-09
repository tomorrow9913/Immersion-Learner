import type { SentenceTranslation } from '@/types/translation';

interface PageTranslationCache {
  pageNumber: number;
  sentences: SentenceTranslation[];
  pageTranslation?: string;
  createdAt: number;
  expiresAt: number;
  version: number;
}

interface PageLock {
  version: number;
  pending: boolean;
  timestamp: number;
}

class AtomicTranslationCache {
  private locks: Map<string, PageLock> = new Map();
  private pendingOperations: Map<string, Promise<void>> = new Map();

  private getKey(docId: string, pageNumber: number): string {
    return `${docId}_${pageNumber}`;
  }

  private async acquirePageLock(docId: string, pageNumber: number): Promise<boolean> {
    const key = this.getKey(docId, pageNumber);
    const existingLock = this.locks.get(key);
    
    if (existingLock && existingLock.pending) {
      const isExpired = Date.now() - existingLock.timestamp > 5000;
      if (isExpired) {
        this.locks.delete(key);
      } else {
        return false;
      }
    }

    const newLock: PageLock = {
      version: (existingLock?.version || 0) + 1,
      pending: true,
      timestamp: Date.now()
    };

    this.locks.set(key, newLock);
    return true;
  }

  private releasePageLock(docId: string, pageNumber: number, newVersion: number): void {
    const key = this.getKey(docId, pageNumber);
    const lock = this.locks.get(key);
    if (lock && lock.version === newVersion - 1) {
      this.locks.set(key, {
        ...lock,
        pending: false,
        version: newVersion
      });
    }
    
    this.pendingOperations.delete(key);
  }

  async storePageTranslation(docId: string, pageNumber: number, sentences: SentenceTranslation[]): Promise<void> {
    if (!docId) return;
    
    const lockAcquired = await this.acquirePageLock(docId, pageNumber);
    if (!lockAcquired) {
      const lockRelease = await this.waitForLockRelease(docId, pageNumber);
      return lockRelease;
    }

    const operation = this.performAtomicStore(docId, pageNumber, sentences);
    const key = this.getKey(docId, pageNumber);
    this.pendingOperations.set(key, operation);

    try {
      await operation;
    } finally {
      const lock = this.locks.get(key);
      if (lock) {
        this.releasePageLock(docId, pageNumber, lock.version + 1);
      }
    }
  }

  private async performAtomicStore(docId: string, pageNumber: number, sentences: any[]): Promise<void> {
    const key = this.getKey(docId, pageNumber);
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TranslationCache', 1);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = () => {
        const db = request.result;
        
        try {
          const transaction = db.transaction(['pageTranslations'], 'readwrite');
          const store = transaction.objectStore('pageTranslations');
          
          transaction.onerror = () => {
            reject(new Error('Transaction failed'));
          };
          
          transaction.oncomplete = () => {
            resolve();
          };
          
          // First, get existing cache
          const getRequest = store.get(key);
          getRequest.onerror = () => {
            reject(new Error('Failed to read existing cache'));
          };
          
          getRequest.onsuccess = () => {
            const existingCache = getRequest.result;
            const currentVersion = existingCache?.version || 0;
            
            // Then, store with new version
            const newCache: PageTranslationCache = {
              pageNumber,
              sentences: sentences,
              createdAt: Date.now(),
              expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
              version: currentVersion + 1
            };
            
            if (existingCache) {
              const updateRequest = store.put(newCache, key);
              updateRequest.onerror = () => {
                reject(new Error('Failed to update cache'));
              };
              updateRequest.onsuccess = () => {
                resolve();
              };
            } else {
              const addRequest = store.add(newCache, key);
              addRequest.onerror = () => {
                reject(new Error('Failed to add cache'));
              };
              addRequest.onsuccess = () => {
                resolve();
              };
            }
          };
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  private async waitForLockRelease(docId: string, pageNumber: number): Promise<void> {
    const key = this.getKey(docId, pageNumber);
    
    return new Promise((resolve) => {
      const checkLock = () => {
        const lock = this.locks.get(key);
        if (!lock || !lock.pending) {
          resolve();
        } else {
          setTimeout(checkLock, 50);
        }
      };
      
      checkLock();
    });
  }

  async storeSentence(docId: string, sentence: SentenceTranslation): Promise<void> {
    if (!docId) return;
    
    const existingCache = await this.getPageTranslation(docId, sentence.pageNumber);
    
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
      await this.storePageTranslation(docId, sentence.pageNumber, existingCache.sentences);
    } else {
      await this.storePageTranslation(docId, sentence.pageNumber, [sentence]);
    }
  }

  async getPageTranslation(docId: string, pageNumber: number): Promise<PageTranslationCache | null> {
    if (!docId) return null;
    
    const key = this.getKey(docId, pageNumber);
    const request = indexedDB.open('TranslationCache', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['pageTranslations'], 'readonly');
        const store = transaction.objectStore('pageTranslations');
        
        transaction.onerror = () => {
          reject(new Error('Failed to read cache'));
        };
        
        const getRequest = store.get(key);
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          // 유효기간 (예: 7일) 체크
          const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
          if (result && Date.now() - result.createdAt > SEVEN_DAYS) {
            // 만료된 데이터 삭제
            store.delete(key);
            resolve(null);
          } else {
            resolve(result);
          }
        };
      };
    });
  }

  clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TranslationCache', 1);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['pageTranslations'], 'readwrite');
        const store = transaction.objectStore('pageTranslations');
        
        transaction.onerror = () => {
          reject(new Error('Failed to clear cache'));
        };
        
        transaction.oncomplete = () => {
          this.locks.clear();
          this.pendingOperations.clear();
          resolve();
        };
        
        const clearRequest = store.clear();
        clearRequest.onerror = () => {
          reject(new Error('Failed to clear store'));
        };
      };
    });
  }

  cleanupExpired(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dbRequest = indexedDB.open('TranslationCache', 1);
      
      dbRequest.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      dbRequest.onsuccess = () => {
        const db = dbRequest.result as IDBDatabase;
        const transaction = db.transaction(['pageTranslations'], 'readwrite');
        const store = transaction.objectStore('pageTranslations');
        
        transaction.onerror = () => {
          reject(new Error('Transaction failed'));
        };
        
        try {
          const index = store.index('expiresAt');
          const cursorRequest = index.openCursor(IDBKeyRange.upperBound(Date.now()));
          
          cursorRequest.onsuccess = (event: Event) => {
            const cursor = (event.target as IDBRequest).result;
            
            if (cursor instanceof IDBCursorWithValue) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          
          cursorRequest.onerror = () => {
            reject(new Error('Failed to cleanup expired entries'));
          };
        } catch (error) {
          // Index might not exist, skip cleanup
          resolve();
        }
      };
    });
  }

  // [추가] 특정 문서의 캐시만 지우는 기능 (필요 시)
  async clearDocumentCache(docId: string): Promise<void> {
    if (!docId) return;
    
    const request = indexedDB.open('TranslationCache', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['pageTranslations'], 'readwrite');
        const store = transaction.objectStore('pageTranslations');
        
        transaction.onerror = () => {
          reject(new Error('Failed to clear document cache'));
        };
        
        transaction.oncomplete = () => {
          // 해당 문서의 모든 락도 제거
          const keysToDelete = Array.from(this.locks.keys()).filter(key => key.startsWith(docId + '_'));
          keysToDelete.forEach(key => {
            this.locks.delete(key);
            this.pendingOperations.delete(key);
          });
          resolve();
        };
        
        const getAllRequest = store.getAllKeys();
        getAllRequest.onsuccess = () => {
          const allKeys = getAllRequest.result;
          const keysToDelete = allKeys.filter(key => String(key).startsWith(docId + '_'));
          
          const deletePromises = keysToDelete.map(key => {
            return new Promise<void>((deleteResolve, deleteReject) => {
              const deleteRequest = store.delete(key);
              deleteRequest.onsuccess = () => deleteResolve();
              deleteRequest.onerror = () => deleteReject(new Error(`Failed to delete key: ${key}`));
            });
          });
          
          Promise.all(deletePromises).then(() => {
            resolve();
          }).catch(reject);
        };
      };
    });
  }

  getCacheStats(): { totalPages: number; lockedPages: number } {
    return {
      totalPages: this.locks.size,
      lockedPages: Array.from(this.locks.values()).filter(lock => lock.pending).length
    };
  }
}

export const atomicTranslationCache = new AtomicTranslationCache();