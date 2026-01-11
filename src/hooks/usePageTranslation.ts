import { useState, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { MESSAGE_TYPES } from '@/config/constants';
import type { ParsedPageData, HydratedSentence, SentenceTranslation } from '@/types';
import { PDFTextAssembler } from '@/utils/pdfTextAssembler';
import { translationCache } from '@/utils/translationCache';

interface PageData {
  parsedData: ParsedPageData;
  isLoading: boolean;
  error?: string;
  hydratedSentences?: HydratedSentence[]; // Final combined data
}

interface UsePageTranslationProps {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
  docId: string;
}

export const usePageTranslation = ({ pdf, currentPage, docId }: UsePageTranslationProps) => {
  const [cache, setCache] = useState<Map<number, PageData>>(new Map());
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPageAndTranslate = useCallback(
    async (pageNumber: number): Promise<PageData | undefined> => {
      if (!pdf || !docId) {
        return;
      }

      // Check component's in-memory cache first
      if (cache.get(pageNumber)?.hydratedSentences) {
        return cache.get(pageNumber);
      }

      setIsTranslating(true);
      setError(null);

      try {
        const page = await pdf.getPage(pageNumber);

        // 1. Extract Text & Usage of PDFTextAssembler.assemblePageData
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });
        const items = textContent.items as any[]; // Type assertion for assembly

        const assembler = new PDFTextAssembler();
        const parsedData = assembler.assemblePageData(items, viewport.height, pageNumber);

        // Update cache with parsed data first to show highlights immediately
        setCache((prev) =>
          new Map(prev).set(pageNumber, { parsedData, isLoading: true })
        );

        // 2. Check persistent cache (IndexedDB)
        const cachedPage = await translationCache.getPageTranslation(docId, pageNumber);

        if (cachedPage) {
            const translationsMap = new Map(cachedPage.sentences.map(s => [s.sentenceIndex, s.translatedText]));
            const hydratedSentences: HydratedSentence[] = parsedData.sentences.map(
                (sentence) => ({
                    ...sentence,
                    translatedText: translationsMap.get(sentence.id) || null, // sentence.id is the index
                })
            );
            
            const finalData: PageData = {
                parsedData,
                isLoading: false,
                hydratedSentences,
            };
            setCache((prev) => new Map(prev).set(pageNumber, finalData));
            setIsTranslating(false);
            return finalData;
        }

        // 3. If not in cache, request translation
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
          const translatedLines = (response.translatedText || '').split('\n');

          const hydratedSentences: HydratedSentence[] = parsedData.sentences.map(
            (sentence, idx) => ({
              ...sentence,
              translatedText: translatedLines[idx] || sentence.sourceText,
            })
          );
          
          // 4. Store in persistent cache
          const sentencesToCache: SentenceTranslation[] = hydratedSentences.map((hs) => ({
              id: String(hs.id),
              originalText: hs.sourceText,
              translatedText: hs.translatedText || '',
              pageNumber: pageNumber,
              sentenceIndex: hs.id,
              createdAt: Date.now(),
              expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000), // 4 days
              status: 'completed',
          }));
          
          await translationCache.storeSentences(docId, sentencesToCache);

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
    [pdf, docId, cache]
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
    if (pdf && docId && !cache.has(currentPage)) {
      loadPageAndTranslate(currentPage);
    }
  }, [pdf, docId, currentPage, cache, loadPageAndTranslate]);

  useEffect(() => {
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
