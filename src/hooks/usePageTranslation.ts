import { useState, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { MESSAGE_TYPES } from '@/config/constants';
import type { ParsedPageData, HydratedSentence } from '@/types';
import { PDFTextAssembler } from '@/utils/pdfTextAssembler';

interface PageData {
  parsedData: ParsedPageData;
  isLoading: boolean;
  error?: string;
  hydratedSentences?: HydratedSentence[]; // Final combined data
}

interface UsePageTranslationProps {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
}

export const usePageTranslation = ({ pdf, currentPage }: UsePageTranslationProps) => {
  const [cache, setCache] = useState<Map<number, PageData>>(new Map());
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPageAndTranslate = useCallback(
    async (pageNumber: number): Promise<PageData | undefined> => {
      if (!pdf || cache.get(pageNumber)?.hydratedSentences) {
        return cache.get(pageNumber);
      }

      setIsTranslating(true);
      setError(null);

      try {
        const page = await pdf.getPage(pageNumber);

        // 1. Use the new assembler
        const assembler = new PDFTextAssembler();
        const parsedData = await assembler.processPage(page, pageNumber);

        // Update cache with parsed data first
        setCache((prev) =>
          new Map(prev).set(pageNumber, { parsedData, isLoading: true })
        );

        // 2. Prepare Translation Request
        const sourceTexts = parsedData.sentences.map((s) => s.sourceText);
        if (sourceTexts.length === 0) {
          const emptyData: PageData = {
            parsedData,
            isLoading: false,
            hydratedSentences: [],
          };
          setCache((prev) => new Map(prev).set(pageNumber, emptyData));
          return emptyData;
        }

        const response = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.GET_TRANSLATION_AND_DETAILS,
          text: sourceTexts.join('\n'), // API expects a single block of text
        });

        if (response?.success) {
          // 4. Hydration & Safety Guard
          const translatedLines = (response.translatedText || '').split('\n');
          const hydratedSentences: HydratedSentence[] = parsedData.sentences.map(
            (sentence, idx) => ({
              ...sentence,
              translatedText: translatedLines[idx] ?? null, // Fallback to null
            })
          );

          const finalData: PageData = {
            parsedData,
            isLoading: false,
            hydratedSentences,
          };

          setCache((prev) => new Map(prev).set(pageNumber, finalData));
          return finalData;
        } else {
          throw new Error(response?.error || `Page ${pageNumber} translation failed.`);
        }
      } catch (err) {
        console.error(`Page ${pageNumber} error:`, err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        const errorData: PageData = {
          parsedData: { pageNumber, sentences: [] },
          isLoading: false,
          error: message,
        };
        setCache((prev) => new Map(prev).set(pageNumber, errorData));
        return errorData;
      } finally {
        setIsTranslating(false);
      }
    },
    [pdf, cache]
  );

  const prefetchNextPage = useCallback(() => {
    if (!pdf) return;
    const nextPage = currentPage + 1;
    if (nextPage <= pdf.numPages && !cache.has(nextPage)) {
      requestIdleCallback(() => {
        loadPageAndTranslate(nextPage);
      });
    }
  }, [pdf, currentPage, cache, loadPageAndTranslate]);

  useEffect(() => {
    if (pdf && !cache.has(currentPage)) {
      loadPageAndTranslate(currentPage);
    }
  }, [pdf, currentPage, cache, loadPageAndTranslate]);

  useEffect(() => {
    // Check if the current page has been translated to trigger prefetch
    const currentPageData = cache.get(currentPage);
    if (currentPageData && currentPageData.hydratedSentences) {
      prefetchNextPage();
    }
  }, [cache, currentPage, prefetchNextPage]);


  const clearCache = useCallback(() => {
    setCache(new Map());
  }, []);

  return {
    currentPageData: cache.get(currentPage) || null,
    isTranslating,
    error,
    cache,
    loadPageAndTranslate,
    prefetchNextPage,
    clearCache,
  };
};