import { useState, useEffect, useCallback, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { translationQueue } from '@/utils/translationQueue';
import { translationCache } from '@/utils/translationCache';
import { pdfTextProcessor } from '@/utils/pdfTextProcessor';
import type { SentenceTranslation } from '@/types/translation';

interface UseSentenceTranslationProps {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
  currentPageRef?: React.MutableRefObject<number>;
}

export const useSentenceTranslation = ({ pdf, currentPage, currentPageRef }: UseSentenceTranslationProps) => {
  const [translations, setTranslations] = useState<Map<number, SentenceTranslation[]>>(new Map());
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translationProgress, setTranslationProgress] = useState<{ currentPage: number; processed: number; total: number } | null>(null);
  // failedPages State가 반드시 있어야 합니다: const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());

  const pendingPages = useRef<Set<number>>(new Set());

  const previousPageRef = useRef<number>(0);
  const justRevisitedRef = useRef<boolean>(false);

  const docId = pdf?.fingerprints?.[0] || '';

  useEffect(() => {
    if (docId) {
      setTranslations(new Map());
      setFailedPages(new Set());
      pendingPages.current.clear();
    }
  }, [docId]);

  const extractSentencesFromPage = useCallback(async (pageNumber: number): Promise<string[]> => {
    if (!pdf) return [];

    try {
      const cached = pdfTextProcessor.getProcessingResult(pageNumber, 1.0);
      if (cached) {
        return cached.sentences.map(s => s.text);
      }

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
    if (!pdf || !docId) return;

    // Skip if already processing, already translated, or failed (unless just revisited)
    if (pendingPages.current.has(pageNumber) ||
      translations.has(pageNumber) ||
      (failedPages.has(pageNumber) && !justRevisitedRef.current)) {
      return;
    }

    const cached = await translationCache.getPageTranslation(pageNumber);
    if (cached && cached.sentences.length > 0) {
      setTranslations(prev => new Map(prev).set(pageNumber, cached.sentences));
      return;
    }

    pendingPages.current.add(pageNumber);

    if (priority === 'high') {
      setIsTranslating(true);
      setError(null);
    }

    try {
      const sentences = await extractSentencesFromPage(pageNumber);
      if (sentences.length === 0) {
        setTranslations(prev => new Map(prev).set(pageNumber, []));
        return;
      }

      const BATCH_SIZE = 5;
      const results: SentenceTranslation[] = [];

      setTranslationProgress({
        currentPage: pageNumber,
        processed: 0,
        total: sentences.length
      });

      const isPageContextValid = () => {
        if (!pdf) return false;

        // Use ref to get the latest currentPage value to avoid closure issues
        const latestCurrentPage = currentPageRef?.current || currentPage;
        const isTargetPageStillRelevant = latestCurrentPage === pageNumber ||
          latestCurrentPage === pageNumber - 1 ||
          latestCurrentPage === pageNumber + 1;

        return isTargetPageStillRelevant;
      };

      for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
        if (!isPageContextValid()) {
          setTranslationProgress(null);
          return;
        }

        const batch = sentences.slice(i, i + BATCH_SIZE);
        const batchStartIndex = i;

        const batchPromises = batch.map((sentence, batchIndex) =>
          translationQueue.addToQueue(
            sentence,
            pageNumber,
            batchStartIndex + batchIndex,
            priority
          )
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        const processedCount = Math.min(i + BATCH_SIZE, sentences.length);
        setTranslationProgress({
          currentPage: pageNumber,
          processed: processedCount,
          total: sentences.length
        });

        setTranslations(prev => {
          const newMap = new Map(prev);
          const existingResults = newMap.get(pageNumber) || [];
          const updatedResults = [...existingResults];

          batchResults.forEach((result, batchIndex) => {
            const globalIndex = batchStartIndex + batchIndex;
            updatedResults[globalIndex] = result;
          });

          return newMap.set(pageNumber, updatedResults);
        });

        if (i + BATCH_SIZE < sentences.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      setTranslationProgress(null);

      const validResults = results.filter(r => r.status === 'completed');
      if (validResults.length > 0) {
        setTranslations(prev => new Map(prev).set(pageNumber, validResults));
        await translationCache.storeSentences(validResults);
      }
    } catch (err) {
      console.error(`페이지 ${pageNumber} 번역 실패:`, err);
      setFailedPages(prev => new Set(prev).add(pageNumber));

      if (priority === 'high') setError(err instanceof Error ? err.message : String(err));
    } finally {
      pendingPages.current.delete(pageNumber);
      if (priority === 'high') setIsTranslating(false);
    }
  }, [pdf, docId, extractSentencesFromPage, translations, failedPages, currentPage]);

  const prefetchPages = useCallback((basePage: number) => {
    if (!pdf) return;

    const targets = [basePage + 1, basePage + 2];
    targets.forEach(page => {
      if (page <= pdf.numPages && !translations.has(page) && !pendingPages.current.has(page) && !failedPages.has(page)) {
        requestIdleCallback(() => translatePageSentences(page, 'normal'));
      }
    });
  }, [pdf, translatePageSentences, translations, failedPages]);

  useEffect(() => {
    if (pdf && currentPage > 0) {
      // Allow retry only if page was actually navigated to (not just sitting on it)
      if (failedPages.has(currentPage)) {
        if (justRevisitedRef.current) {
          console.log('🔄 Failed page revisited, unlocking retry for page:', currentPage);
          setFailedPages(prev => {
            const next = new Set(prev);
            next.delete(currentPage);
            return next;
          });
          justRevisitedRef.current = false;
        }
        return;
      }

      // Start translation if not already cached
      if (!translations.has(currentPage)) {
        translatePageSentences(currentPage, 'high');
      }

      // Detect page navigation and mark revisit for retry support
      if (previousPageRef.current !== 0 && previousPageRef.current !== currentPage) {
        if (failedPages.has(previousPageRef.current)) {
          console.log('🔄 Tab away detected, clearing failure for previous page:', previousPageRef.current);
          setFailedPages(prev => {
            const next = new Set(prev);
            next.delete(previousPageRef.current);
            return next;
          });
        }
        justRevisitedRef.current = true;
      }
      previousPageRef.current = currentPage;

      prefetchPages(currentPage);
    }
  }, [pdf, currentPage, translatePageSentences, prefetchPages, translations, failedPages]);

  useEffect(() => { }, [currentPage, translations, failedPages]);

  return {
    translations,
    currentPageTranslations: translations.get(currentPage) || [],
    isTranslating,
    error,
    translationProgress,
    failedPages,
    translatePageSentences,
    retryFailedPage: useCallback((pageNumber: number) => {
      console.log('🔄 Manual retry requested for page:', pageNumber);
      setFailedPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNumber);
        return newSet;
      });
      translatePageSentences(pageNumber, 'high');
    }, [translatePageSentences]),
    clearCache: useCallback(() => {
      translationCache.clear();
      setTranslations(new Map());
      setFailedPages(new Set());
      pendingPages.current.clear();
      setTranslationProgress(null);
    }, [])
  };
};