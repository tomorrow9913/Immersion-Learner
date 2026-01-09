import type { 
  TranslationRequest, 
  TranslationQueueStatus,
  SentenceTranslation 
} from '@/types/translation';

const MIN_DELAY_MS = 200;
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

class TranslationQueue {
  private queue: TranslationRequest[] = [];
  private isProcessing = false;
  private currentTask: TranslationRequest | null = null;

  // FUTURE ENHANCEMENT: For large-scale applications (>1000 items),
  // consider implementing a Binary Heap-based priority queue for O(log n) insertions
  // Current array-based sorting provides O(n log n) which is sufficient for typical use cases

  async addToQueue(
    text: string, 
    pageNumber: number, 
    sentenceIndex: number,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<SentenceTranslation> {
    return new Promise((resolve, reject) => {
      const priorityValue = priority === 'high' ? 3 : priority === 'normal' ? 2 : 1;
      
      const request: TranslationRequest = {
        id: `${pageNumber}-${sentenceIndex}-${Date.now()}`,
        text,
        priority: priorityValue,
        resolve,
        reject
      };

      this.insertByPriority(request);
      this.processQueue();
    });
  }

  private insertByPriority(request: TranslationRequest): void {
    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      if (request.priority > this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, request);
  }

  prioritizePage(pageNumber: number): void {
    this.queue = this.queue.sort((a, b) => {
      const aIsPriority = a.id.startsWith(`${pageNumber}-`);
      const bIsPriority = b.id.startsWith(`${pageNumber}-`);
      
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return b.priority - a.priority;
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      this.currentTask = request;
      
      try {
        const result = await this.translateWithDelay(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error as Error);
      } finally {
        this.currentTask = null;
      }
    }
    
    this.isProcessing = false;
  }

  private async translateWithDelay(request: TranslationRequest): Promise<SentenceTranslation> {
    if (this.currentTask && this.currentTask.id !== request.id) {
      await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS));
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_SENTENCE',
        text: request.text
      });

      if (!response?.success || !response?.translatedText?.trim()) {
        throw new Error(response?.error || '번역 실패 또는 빈 응답');
      }

      const [pageNumberStr, sentenceIndexStr] = request.id.split('-').slice(0, 2);
      const pageNumber = parseInt(pageNumberStr);
      const sentenceIndex = parseInt(sentenceIndexStr);

      return {
        id: request.id,
        originalText: request.text,
        translatedText: response.translatedText,
        pageNumber,
        sentenceIndex,
        createdAt: Date.now(),
        expiresAt: Date.now() + FOUR_DAYS_MS,
        status: 'completed'
      };
    } catch (error) {
      const [pageNumberStr, sentenceIndexStr] = request.id.split('-').slice(0, 2);
      const pageNumber = parseInt(pageNumberStr);
      const sentenceIndex = parseInt(sentenceIndexStr);

      return {
        id: request.id,
        originalText: request.text,
        translatedText: '',
        pageNumber,
        sentenceIndex,
        createdAt: Date.now(),
        expiresAt: Date.now() + FOUR_DAYS_MS,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  getStatus(): TranslationQueueStatus {
    const total = this.queue.length + (this.currentTask ? 1 : 0);
    const processing = this.currentTask ? 1 : 0;
    
    return {
      total,
      pending: this.queue.length,
      processing,
      completed: 0,
      failed: 0
    };
  }

  clear(): void {
    this.queue = [];
    this.isProcessing = false;
    this.currentTask = null;
  }
}

export const translationQueue = new TranslationQueue();