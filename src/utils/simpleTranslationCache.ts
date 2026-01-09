import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { SentenceTranslation } from '@/types/translation';
import { pdfTextProcessor } from './pdfTextProcessor';

interface PageProcessingResult {
  translations: SentenceTranslation[];
  isProcessing: boolean;
  lastProcessedAt: number;
}

const SimpleTranslationCache = {
  processingPages: new Set<number>(),

  async processPageWithTranslation(
    pdf: PDFDocumentProxy,
    pageNumber: number,
    translations: SentenceTranslation[],
    scale: number
  ): Promise<PageProcessingResult> {
    if (this.processingPages.has(pageNumber)) {
      return {
        translations,
        isProcessing: true,
        lastProcessedAt: Date.now()
      };
    }

    this.processingPages.delete(pageNumber);
    
    try {
      const result = await pdfTextProcessor.processPageWithCoordinates(
        pdf,
        pageNumber,
        translations,
        scale
      );

      const sentenceTranslations: SentenceTranslation[] = result.sentences.map((sentence, index) => ({
        id: sentence.id,
        originalText: sentence.text,
        translatedText: translations[index]?.translatedText,
        pageNumber: result.pageNumber,
        sentenceIndex: sentence.sentenceIndex,
        createdAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        status: 'completed' as const
      }));

      return {
        translations: sentenceTranslations,
        isProcessing: false,
        lastProcessedAt: Date.now()
      };
    } catch (error) {
      console.error(`Page ${pageNumber} processing failed:`, error);
      return {
        translations: [],
        isProcessing: false,
        lastProcessedAt: 0
      };
    }
  },

  async getPageTranslation(_pageNumber: number): Promise<SentenceTranslation[]> {
    return [];
  },

  async storePageTranslation(_pageNumber: number, _sentences: SentenceTranslation[]): Promise<void> {
    return Promise.resolve();
  },

  async storeSentence(sentence: SentenceTranslation): Promise<void> {
    const existingCache = await this.getPageTranslation(sentence.pageNumber);
    
    if (existingCache.length > 0) {
      const existingSentenceIndex = existingCache.findIndex(
        s => s.id === sentence.id
      );
      
      if (existingSentenceIndex >= 0) {
        existingCache[existingSentenceIndex] = sentence;
      } else {
        existingCache.push(sentence);
      }
      
      existingCache.sort((a, b) => a.sentenceIndex - b.sentenceIndex);
      await this.storePageTranslation(sentence.pageNumber, existingCache);
    } else {
      await this.storePageTranslation(sentence.pageNumber, [sentence]);
    }
  },

  async deletePageTranslation(pageNumber: number): Promise<void> {
    this.processingPages.delete(pageNumber);
    return Promise.resolve();
  },

  async clear(): Promise<void> {
    this.processingPages.clear();
    return Promise.resolve();
  },

  getProcessingStatus() {
    return {
      totalPages: this.processingPages.size,
      processingPages: Array.from(this.processingPages),
      lastProcessedAt: 0
    };
  }
};

export const simpleTranslationCache = SimpleTranslationCache;