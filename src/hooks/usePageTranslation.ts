import { useState, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { MESSAGE_TYPES } from '@/config/constants';

interface PageData {
  text: string;
  translation?: string;
  extractedAt: number;
}

interface UsePageTranslationProps {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
}

export const usePageTranslation = ({ pdf, currentPage }: UsePageTranslationProps) => {
  const [cache, setCache] = useState<Map<number, PageData>>(new Map());
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPageAndTranslate = useCallback(async (pageNumber: number): Promise<PageData | undefined> => {
    if (!pdf || cache.has(pageNumber)) {
      return cache.get(pageNumber);
    }

    setIsTranslating(true);
    setError(null);

    try {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ')
        .trim();

      if (!pageText) {
        const pageData: PageData = { text: '', extractedAt: Date.now() };
        setCache(prev => new Map(prev).set(pageNumber, pageData));
        return pageData;
      }

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_TRANSLATION_AND_DETAILS,
        text: pageText,
      });

      if (response?.success) {
        const pageData: PageData = {
          text: pageText,
          translation: response.translatedText,
          extractedAt: Date.now(),
        };
        setCache(prev => new Map(prev).set(pageNumber, pageData));
        return pageData;
      } else {
        throw new Error(response?.error || `페이지 ${pageNumber} 번역에 실패했습니다.`);
      }
    } catch (err) {
      console.error(`페이지 ${pageNumber} 로딩 또는 번역 실패:`, err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      const errorData: PageData = { text: '', extractedAt: Date.now() };
      setCache(prev => new Map(prev).set(pageNumber, errorData));
      return errorData;
    } finally {
      setIsTranslating(false);
    }
  }, [pdf, cache]);

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
    const currentPageData = cache.get(currentPage);
    if (currentPageData?.translation) {
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