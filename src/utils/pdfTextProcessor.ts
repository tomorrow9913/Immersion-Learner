import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { SentenceTranslation } from '@/types/translation';
import type { TextFragment } from './pdfTextAssembler';



export interface ProcessedSentence {
  id: string;
  text: string;
  coordinates: Array<ProcessorCoordinate>;
  sentenceIndex: number;
  fragments: TextFragment[];
}

interface ProcessorCoordinate {
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
      const matchedFragments = this.findFragmentsForSentenceOptimized(
        translation.originalText,
        fragments
      );

      return {
        id: translation.id,
        text: translation.originalText,
        coordinates: matchedFragments.map((fragment: TextFragment) => fragment.position!),
        sentenceIndex: translation.sentenceIndex,
        fragments: matchedFragments
      };
    });
  }

  private findFragmentsForSentenceOptimized(
    sentence: string,
    fragments: TextFragment[]
  ): TextFragment[] {
    const normalize = (text: string) => text.replace(/[\s\u00A0\-\u2010-\u2015]/g, '').toLowerCase();
    const targetNormalized = normalize(sentence);

    if (!targetNormalized) return [];

    const fragmentsWithNormalized = fragments.map(f => ({
      original: f,
      normalized: normalize(f.text)
    }));

    for (let i = 0; i < fragmentsWithNormalized.length; i++) {
      let accumulated = '';
      for (let j = i; j < fragmentsWithNormalized.length; j++) {
        accumulated += fragmentsWithNormalized[j].normalized;

        if (targetNormalized.startsWith(accumulated)) {
          if (targetNormalized === accumulated) {
            return fragmentsWithNormalized.slice(i, j + 1).map(f => f.original);
          }
        } else if (accumulated.startsWith(targetNormalized)) {
          return fragmentsWithNormalized.slice(i, j + 1).map(f => f.original);
        } else {
          break;
        }
      }
    }

    return [];
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