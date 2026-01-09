import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { SentenceTranslation } from '@/types/translation';
import type { TextFragment } from './pdfTextAssembler';

export interface ProcessedSentence {
  id: string;
  text: string;
  coordinates: Array<Coordinate>;
  sentenceIndex: number;
  fragments: TextFragment[];
}

export interface Coordinate {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Coordinate {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageTextProcessing {
  sentences: ProcessedSentence[];
  fragments: TextFragment[];
  pageNumber: number;
  scale: number;
}

export class PDFTextProcessor {
  private static instance: PDFTextProcessor;
  private processingCache: Map<string, PageTextProcessing> = new Map();

  static getInstance(): PDFTextProcessor {
    if (!this.instance) {
      this.instance = new PDFTextProcessor();
    }
    return this.instance;
  }

  async processPageWithCoordinates(
    pdf: PDFDocumentProxy,
    pageNumber: number,
    translations: SentenceTranslation[],
    scale: number
  ): Promise<PageTextProcessing> {
    const cacheKey = `page-${pageNumber}-${scale}`;
    
    if (this.processingCache.has(cacheKey)) {
      return this.processingCache.get(cacheKey)!;
    }

    try {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const fragments: TextFragment[] = textContent.items
        .filter((item: any) => item.str && item.str.trim())
        .map((item: any) => {
          const transform = item.transform;
          return {
            text: item.str,
            style: {
              color: '#000000',
              isBold: false,
              isItalic: false,
              fontSize: 12,
              fontFamily: 'serif'
            },
            position: {
              x: transform[4],
              y: transform[5],
              width: item.width || 0,
              height: item.height || 0
            }
          };
        });

      const sentences = this.extractSentencesFromTranslations(
        translations,
        fragments
      );

      const processing: PageTextProcessing = {
        sentences,
        fragments,
        pageNumber,
        scale
      };

      this.processingCache.set(cacheKey, processing);
      return processing;
    } catch (error) {
      console.error('Error processing page text:', error);
      return {
        sentences: [],
        fragments: [],
        pageNumber,
        scale,
      };
    }
  }

  private extractSentencesFromTranslations(
    translations: SentenceTranslation[],
    fragments: TextFragment[]
  ): ProcessedSentence[] {
    return translations.map((translation) => {
      const matchedFragments = this.findFragmentsForSentence(
        translation.originalText,
        fragments
      );

      return {
        id: translation.id,
        text: translation.originalText,
        coordinates: matchedFragments.map(fragment => fragment.position!),
        sentenceIndex: translation.sentenceIndex,
        fragments: matchedFragments
      };
    });
  }

  private findFragmentsForSentence(
    sentence: string,
    fragments: TextFragment[]
  ): TextFragment[] {
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    const matchedFragments: TextFragment[] = [];
    let remainingWords = [...sentenceWords];
    const usedIndices = new Set<number>();

    fragments.forEach((fragment, index) => {
      if (usedIndices.has(index)) return;

      const fragmentText = fragment.text.toLowerCase().trim();
      const fragmentWords = fragmentText.split(/\s+/);

      if (fragmentWords.length === 0) return;

      for (let i = 0; i <= remainingWords.length - fragmentWords.length; i++) {
        const window = remainingWords.slice(i, i + fragmentWords.length);
        
        if (this.areWordsSimilar(window, fragmentWords)) {
          matchedFragments.push(fragment);
          usedIndices.add(index);
          remainingWords.splice(i, fragmentWords.length);
          break;
        }
      }
    });

    return matchedFragments;
  }

  private areWordsSimilar(words1: string[], words2: string[]): boolean {
    if (words1.length !== words2.length) return false;
    
    return words1.every((word, index) => {
      return this.isWordSimilar(word, words2[index]);
    });
  }

  private isWordSimilar(word1: string, word2: string): boolean {
    const clean1 = word1.replace(/[^\w]/g, '');
    const clean2 = word2.replace(/[^\w]/g, '');
    
    if (clean1.length === 0 || clean2.length === 0) return false;
    
    if (clean1 === clean2) return true;
    
    if (Math.abs(clean1.length - clean2.length) <= 2) {
      const longer = clean1.length > clean2.length ? clean1 : clean2;
      const shorter = clean1.length > clean2.length ? clean2 : clean1;
      
      return longer.includes(shorter) || shorter.includes(longer);
    }
    
    return false;
  }

  getProcessingResult(pageNumber: number, scale: number): PageTextProcessing | null {
    const cacheKey = `page-${pageNumber}-${scale}`;
    return this.processingCache.get(cacheKey) || null;
  }

  clearCache(): void {
    this.processingCache.clear();
  }

  clearCacheForPage(pageNumber: number): void {
    const keysToDelete: string[] = [];
    for (const key of this.processingCache.keys()) {
      if (key.startsWith(`page-${pageNumber}-`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.processingCache.delete(key));
  }
}

export const pdfTextProcessor = PDFTextProcessor.getInstance();