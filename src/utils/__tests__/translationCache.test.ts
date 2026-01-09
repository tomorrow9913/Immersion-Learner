import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translationCache } from '@/utils/translationCache';
import type { SentenceTranslation } from '@/types/translation';

const mockIndexedDB = {
  open: vi.fn(),
  databases: vi.fn(),
  deleteDatabase: vi.fn(),
  cmp: vi.fn()
};

globalThis.indexedDB = mockIndexedDB;

describe('TranslationCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    const mockRequest = {
      onerror: null as any,
      onsuccess: null as any,
      onupgradeneeded: null as any,
      result: {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn(),
            index: vi.fn(() => ({
              openCursor: vi.fn()
            }))
          }))
        }))
      }
    };

    mockIndexedDB.open.mockReturnValue(mockRequest);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await translationCache.clear();
  });

  describe('storePageTranslation', () => {
    it('should store page translation data', async () => {
      const sentences: SentenceTranslation[] = [
        {
          id: '1-0-1',
          originalText: 'Hello world',
          translatedText: '안녕하세요 세계',
          pageNumber: 1,
          sentenceIndex: 0,
          createdAt: Date.now(),
          expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
          status: 'completed'
        }
      ];

      await translationCache.storePageTranslation(1, sentences);
      const cached = await translationCache.getPageTranslation(1);

      expect(cached).toBeTruthy();
      expect(cached?.pageNumber).toBe(1);
      expect(cached?.sentences).toHaveLength(1);
      expect(cached?.sentences[0].originalText).toBe('Hello world');
    });
  });

  describe('getPageTranslation', () => {
    it('should return null for non-existent page', async () => {
      const cached = await translationCache.getPageTranslation(999);
      expect(cached).toBeNull();
    });

    it('should return null for expired cache', async () => {
      const sentences: SentenceTranslation[] = [
        {
          id: '1-0-1',
          originalText: 'Test',
          pageNumber: 1,
          sentenceIndex: 0,
          createdAt: Date.now() - 1000,
          expiresAt: Date.now() - 500,
          status: 'completed'
        }
      ];

      await translationCache.storePageTranslation(1, sentences);
      
      vi.advanceTimersByTime(1000);
      
      const cached = await translationCache.getPageTranslation(1);
      expect(cached).toBeNull();
    });
  });

  describe('storeSentence', () => {
    it('should store individual sentence', async () => {
      const sentence: SentenceTranslation = {
        id: '1-0-1',
        originalText: 'Hello',
        translatedText: '안녕',
        pageNumber: 1,
        sentenceIndex: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
        status: 'completed'
      };

      await translationCache.storeSentence(sentence);
      const cached = await translationCache.getPageTranslation(1);

      expect(cached).toBeTruthy();
      expect(cached?.sentences).toHaveLength(1);
      expect(cached?.sentences[0].originalText).toBe('Hello');
    });

    it('should add sentence to existing page', async () => {
      const firstSentence: SentenceTranslation = {
        id: '1-0-1',
        originalText: 'Hello',
        pageNumber: 1,
        sentenceIndex: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
        status: 'completed'
      };

      const secondSentence: SentenceTranslation = {
        id: '1-0-2',
        originalText: 'World',
        translatedText: '세계',
        pageNumber: 1,
        sentenceIndex: 1,
        createdAt: Date.now(),
        expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
        status: 'completed'
      };

      await translationCache.storeSentence(firstSentence);
      await translationCache.storeSentence(secondSentence);
      
      const cached = await translationCache.getPageTranslation(1);
      expect(cached?.sentences).toHaveLength(2);
      expect(cached?.sentences[0].originalText).toBe('Hello');
      expect(cached?.sentences[1].originalText).toBe('World');
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired cache entries', async () => {
      const expiredSentences: SentenceTranslation[] = [
        {
          id: '1-0-1',
          originalText: 'Expired',
          pageNumber: 1,
          sentenceIndex: 0,
          createdAt: Date.now() - 5000,
          expiresAt: Date.now() - 1000,
          status: 'completed'
        }
      ];

      const validSentences: SentenceTranslation[] = [
        {
          id: '2-0-1',
          originalText: 'Valid',
          translatedText: '유효',
          pageNumber: 2,
          sentenceIndex: 0,
          createdAt: Date.now(),
          expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
          status: 'completed'
        }
      ];

      await translationCache.storePageTranslation(1, expiredSentences);
      await translationCache.storePageTranslation(2, validSentences);
      
      vi.advanceTimersByTime(2000);
      
      await translationCache.cleanupExpired();
      
      const expiredCache = await translationCache.getPageTranslation(1);
      const validCache = await translationCache.getPageTranslation(2);
      
      expect(expiredCache).toBeNull();
      expect(validCache).toBeTruthy();
      expect(validCache?.sentences[0].originalText).toBe('Valid');
    });
  });
});