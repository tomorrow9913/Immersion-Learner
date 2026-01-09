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
  private locks: Map<number, PageLock> = new Map();
  private pendingOperations: Map<number, Promise<void>> = new Map();

  private async acquirePageLock(pageNumber: number): Promise<boolean> {
    const existingLock = this.locks.get(pageNumber);
    
    if (existingLock && existingLock.pending) {
      const isExpired = Date.now() - existingLock.timestamp > 5000;
      if (isExpired) {
        this.locks.delete(pageNumber);
      } else {
        return false;
      }
    }

    const newLock: PageLock = {
      version: (existingLock?.version || 0) + 1,
      pending: true,
      timestamp: Date.now()
    };

    this.locks.set(pageNumber, newLock);
    return true;
  }

  private releasePageLock(pageNumber: number, newVersion: number): void {
    const lock = this.locks.get(pageNumber);
    if (lock && lock.version === newVersion - 1) {
      this.locks.set(pageNumber, {
        ...lock,
        pending: false,
        version: newVersion
      });
    }
    
    this.pendingOperations.delete(pageNumber);
  }

  async storePageTranslation(pageNumber: number, sentences: any[]): Promise<void> {
    const lockAcquired = await this.acquirePageLock(pageNumber);
    if (!lockAcquired) {
      const lockRelease = await this.waitForLockRelease(pageNumber);
      return lockRelease;
    }

    const operation = this.performAtomicStore(pageNumber, sentences);
    this.pendingOperations.set(pageNumber, operation);

    try {
      await operation;
    } finally {
      const lock = this.locks.get(pageNumber);
      if (lock) {
        this.releasePageLock(pageNumber, lock.version + 1);
      }
    }
  }

  private async performAtomicStore(pageNumber: number, sentences: any[]): Promise<void> {
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
          const getRequest = store.get(pageNumber);
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
              const updateRequest = store.put(newCache);
              updateRequest.onerror = () => {
                reject(new Error('Failed to update cache'));
              };
              updateRequest.onsuccess = () => {
                resolve();
              };
            } else {
              const addRequest = store.add(newCache);
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

  private async waitForLockRelease(pageNumber: number): Promise<void> {
    return new Promise((resolve) => {
      const checkLock = () => {
        const lock = this.locks.get(pageNumber);
        if (!lock || !lock.pending) {
          resolve();
        } else {
          setTimeout(checkLock, 50);
        }
      };
      
      checkLock();
    });
  }

  async getPageTranslation(pageNumber: number): Promise<PageTranslationCache | null> {
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
        
        const getRequest = store.get(pageNumber);
        getRequest.onsuccess = () => {
          resolve(getRequest.result);
        };
      };
    });
  }

  clearCache(): Promise<void> {
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

  getCacheStats(): { totalPages: number; lockedPages: number } {
    return {
      totalPages: this.locks.size,
      lockedPages: Array.from(this.locks.values()).filter(lock => lock.pending).length
    };
  }
}

export const atomicTranslationCache = new AtomicTranslationCache();