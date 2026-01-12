import type {
  TranslationRequest,
  TranslationQueueStatus,
  SentenceTranslation,
} from '@/types/translation';
import { QUEUE_CONFIG, ERROR_MESSAGES } from '@/config/constants';
import { Logger } from './logger';

const { MIN_DELAY_MS, FOUR_DAYS_MS, CONCURRENCY_LIMIT } = QUEUE_CONFIG;

class TranslationQueue {
  private queue: TranslationRequest[] = [];
  private activeTasks = 0;
  private isPaused = false;
  private concurrencyLimit: number = CONCURRENCY_LIMIT;

  async addToQueue(
    text: string,
    pageNumber: number,
    sentenceIndex: number,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): Promise<SentenceTranslation> {
    return new Promise((resolve, reject) => {
      const priorityValue = priority === 'high' ? 3 : priority === 'normal' ? 2 : 1;

      const request: TranslationRequest = {
        id: `${pageNumber}-${sentenceIndex}-${Date.now()}`,
        text,
        pageNumber,
        priority: priorityValue,
        resolve,
        reject,
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
    this.queue.sort((a, b) => {
      const aIsPriority = a.pageNumber === pageNumber;
      const bIsPriority = b.pageNumber === pageNumber;
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return b.priority - a.priority;
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isPaused || this.activeTasks >= this.concurrencyLimit) {
      return;
    }

    while (this.activeTasks < this.concurrencyLimit && this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) continue;

      this.activeTasks++;

      this.executeTranslation(request)
        .catch(error => Logger.error('Unhandled error during translation execution', error))
        .finally(() => {
          this.activeTasks--;
          this.processQueue(); // Check for next item
        });
    }
  }

  private async executeTranslation(request: TranslationRequest): Promise<void> {
    try {
      // Small delay to prevent overwhelming the API endpoint
      await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS));

      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_SENTENCE',
        text: request.text,
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message || ERROR_MESSAGES.TRANSLATION_FAILED_OR_EMPTY);
      }
      
      if (!response?.success || !response?.translatedText?.trim()) {
        throw new Error(response?.error || ERROR_MESSAGES.TRANSLATION_FAILED_OR_EMPTY);
      }

      const result: SentenceTranslation = {
        id: request.id,
        originalText: request.text,
        translatedText: response.translatedText,
        pageNumber: request.pageNumber,
        sentenceIndex: parseInt(request.id.split('-')[1]),
        createdAt: Date.now(),
        expiresAt: Date.now() + FOUR_DAYS_MS,
        status: 'completed',
      };
      request.resolve(result);

    } catch (error) {
      const isCancellation = error instanceof Error && error.message.includes('Cancelled');
      Logger.warn(`Translation failed for request ${request.id}:`, error);

      if (!isCancellation) {
        const errorResult: SentenceTranslation = {
          id: request.id,
          originalText: request.text,
          translatedText: '',
          pageNumber: request.pageNumber,
          sentenceIndex: parseInt(request.id.split('-')[1]),
          createdAt: Date.now(),
          expiresAt: Date.now() + FOUR_DAYS_MS,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        };
        // Resolve with error status instead of rejecting the promise
        // This allows the UI to handle failed translations gracefully
        request.resolve(errorResult);
      } else {
         request.reject(error as Error);
      }
    }
  }
  
  cancelByPage(pageNumber: number): number {
    const initialQueueLength = this.queue.length;

    const requestsToCancel = this.queue.filter(req => req.pageNumber === pageNumber);
    requestsToCancel.forEach(req => {
      req.reject(new Error(`Translation cancelled for page ${pageNumber}`));
    });

    this.queue = this.queue.filter(req => req.pageNumber !== pageNumber);
    
    const cancelledCount = initialQueueLength - this.queue.length;
    if (cancelledCount > 0) {
      Logger.info(`Cancelled ${cancelledCount} pending translations for page ${pageNumber}`);
    }
    return cancelledCount;
  }


  getStatus(): TranslationQueueStatus {
    return {
      total: this.queue.length + this.activeTasks,
      pending: this.queue.length,
      processing: this.activeTasks,
      completed: 0, 
      failed: 0,
    };
  }

  pause(): void {
    this.isPaused = true;
    Logger.info('Translation queue paused.');
  }

  resume(): void {
    this.isPaused = false;
    Logger.info('Translation queue resumed.');
    this.processQueue();
  }

  clear(): void {
    this.queue.forEach(req => req.reject(new Error('Queue cleared')));
    this.queue = [];
    this.activeTasks = 0;
    Logger.info('Translation queue cleared.');
  }
}

export const translationQueue = new TranslationQueue();