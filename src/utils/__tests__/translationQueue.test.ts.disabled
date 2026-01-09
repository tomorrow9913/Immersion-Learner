import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translationQueue } from '@/utils/translationQueue';

const mockChrome = {
  runtime: {
    sendMessage: vi.fn()
  }
};

vi.stubGlobal('chrome', mockChrome);

describe('TranslationQueue', () => {
  beforeEach(() => {
    translationQueue.clear();
    vi.clearAllMocks();
    mockChrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      translatedText: '번역된 텍스트'
    });
  });

  afterEach(() => {
    translationQueue.clear();
  });

  describe('addToQueue', () => {
    it('should add translation request to queue', async () => {
      const result = await translationQueue.addToQueue(
        'Hello world',
        1,
        0,
        'normal'
      );

      expect(result).toEqual({
        id: expect.stringContaining('1-0-'),
        originalText: 'Hello world',
        translatedText: '번역된 텍스트',
        pageNumber: 1,
        sentenceIndex: 0,
        createdAt: expect.any(Number),
        expiresAt: expect.any(Number),
        status: 'completed'
      });
    });

    it('should handle high priority requests first', async () => {
      const normalPromise = translationQueue.addToQueue('Normal', 1, 0, 'normal');
      const highPromise = translationQueue.addToQueue('High', 2, 0, 'high');
      const lowPromise = translationQueue.addToQueue('Low', 3, 0, 'low');

      const results = await Promise.all([normalPromise, highPromise, lowPromise]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'completed')).toBe(true);
    });
  });

  describe('prioritizePage', () => {
    it('should prioritize requests from specified page', () => {
      const queue = (translationQueue as any).queue;
      
      queue.push(
        { id: '3-0-1', priority: 2 },
        { id: '1-0-2', priority: 2 },
        { id: '2-0-3', priority: 2 }
      );

      translationQueue.prioritizePage(1);

      expect(queue[0].id).toBe('1-0-2');
      expect(queue[1].id).toBe('3-0-3');
      expect(queue[2].id).toBe('2-0-4');
    });
  });

  describe('getStatus', () => {
    it('should return correct queue status', () => {
      const status = translationQueue.getStatus();
      
      expect(status).toEqual({
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      });
    });
  });

  describe('API delay control', () => {
    it('should respect minimum delay between requests', async () => {
      const startTime = Date.now();
      
      await translationQueue.addToQueue('First', 1, 0, 'normal');
      await translationQueue.addToQueue('Second', 2, 0, 'normal');

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThan(199);
    });
  });
});