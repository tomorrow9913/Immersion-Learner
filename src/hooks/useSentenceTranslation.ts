import { useState, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { translationQueue } from '@/utils/translationQueue';
import { translationCache } from '@/utils/translationCache';
import type { SentenceTranslation } from '@/types/translation';

interface UseSentenceTranslationProps {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
}

export const useSentenceTranslation = ({ pdf, currentPage }: UseSentenceTranslationProps) => {
  const [translations, setTranslations] = useState<Map<number, SentenceTranslation[]>>(new Map());
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractSentencesFromPage = useCallback(async (pageNumber: number): Promise<string[]> => {
    if (!pdf) return [];

    try {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      
      const fragments = textContent.items.map((item: any) => ({
        text: item.str || '',
        style: {
          color: '#000000',
          isBold: false,
          isItalic: false,
          fontSize: 12,
          fontFamily: 'serif'
        },
        position: item.transform ? {
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0,
          height: item.height || 0
        } : undefined
      }));

      const assembler = new (await import('@/utils/pdfTextAssembler')).PDFTextAssembler();
      const sentences = assembler.assembleSentences(fragments);

      return sentences;
    } catch (err) {
      console.error(`페이지 ${pageNumber} 문장 추출 실패:`, err);
      return [];
    }
  }, [pdf]);

  const translatePageSentences = useCallback(async (pageNumber: number, priority: 'high' | 'normal' | 'low' = 'normal') => {
    if (!pdf) return;

    const cached = await translationCache.getPageTranslation(pageNumber);
    if (cached && cached.sentences.length > 0) {
      setTranslations(prev => new Map(prev).set(pageNumber, cached.sentences));
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const sentences = await extractSentencesFromPage(pageNumber);
      if (sentences.length === 0) {
        setTranslations(prev => new Map(prev).set(pageNumber, []));
        return;
      }

      const translationPromises = sentences.map(async (sentence, index) => {
        const translation = await translationQueue.addToQueue(
          sentence,
          pageNumber,
          index,
          priority
        );

        await translationCache.storeSentence(translation);
        return translation;
      });

      const results = await Promise.all(translationPromises);
      
      setTranslations(prev => new Map(prev).set(pageNumber, results));
      
      await translationCache.storePageTranslation(pageNumber, results);
    } catch (err) {
      console.error(`페이지 ${pageNumber} 번역 실패:`, err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsTranslating(false);
    }
  }, [pdf, extractSentencesFromPage]);

  const prefetchPages = useCallback((basePage: number) => {
    if (!pdf) return;

    const prefetchTargets = [
      { page: basePage + 1, priority: 'normal' as const },
      { page: basePage + 2, priority: 'low' as const }
    ];

    prefetchTargets.forEach(({ page, priority }) => {
      if (page <= pdf.numPages) {
        requestIdleCallback(() => {
          translatePageSentences(page, priority);
        });
      }
    });
  }, [pdf, translatePageSentences]);

  const prioritizeCurrentPage = useCallback((pageNumber: number) => {
    translationQueue.prioritizePage(pageNumber);
    translatePageSentences(pageNumber, 'high');
  }, [translatePageSentences]);

  useEffect(() => {
    if (pdf && currentPage > 0) {
      if (!translations.has(currentPage)) {
        translatePageSentences(currentPage, 'high');
      }
      
      prefetchPages(currentPage);
    }
  }, [pdf, currentPage, translatePageSentences, prefetchPages, translations]);

  useEffect(() => {
    translationCache.cleanupExpired();
  }, []);

  const clearCache = useCallback(() => {
    translationCache.clear();
    setTranslations(new Map());
  }, []);

  return {
    translations,
    currentPageTranslations: translations.get(currentPage) || [],
    isTranslating,
    error,
    translatePageSentences,
    prioritizeCurrentPage,
    clearCache,
  };
};