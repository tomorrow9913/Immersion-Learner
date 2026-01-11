import { useState, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { MESSAGE_TYPES } from '@/config/constants';
import type { ParsedPageData, HydratedSentence } from '@/types';
import type { SentenceTranslation } from '@/types/translation';
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
}

export const usePageTranslation = ({ pdf, currentPage }: UsePageTranslationProps) => {
  const [cache, setCache] = useState<Map<number, PageData>>(new Map());
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPageAndTranslate = useCallback(
    async (pageNumber: number): Promise<PageData | undefined> => {
      // Check in-memory cache first
      if (!pdf || cache.get(pageNumber)?.hydratedSentences) {
        return cache.get(pageNumber);
      }

      setIsTranslating(true);
      setError(null);

      try {
        const page = await pdf.getPage(pageNumber);
        const fingerprint = (pdf as any).fingerprint;

        // 1. Check persistent cache
        let cachedTranslation = null;
        if (fingerprint) {
          cachedTranslation = await translationCache.getPageTranslation(fingerprint, pageNumber);
        }

        // 1. Extract Text & Usage of PDFTextAssembler.assemblePageData
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });
        const items = textContent.items as any[]; // Type assertion for assembly

        const assembler = new PDFTextAssembler();
        const parsedData = assembler.assemblePageData(items, viewport.height, pageNumber);

        // Update cache with parsed data first
        // If we have cached translations, we can merge them immediately, but we might need to map them carefully.
        // Assuming sentences order is consistent or we map by ID if possible.
        // However, `translationCache` stores `SentenceTranslation` which has `id`.
        // `ParsedPageData` has `sentences` which are `ParsedSentence`.

        // If we have persistent cache, we can skip API call.
        if (cachedTranslation && cachedTranslation.sentences.length > 0) {
          const translatedSentencesMap = new Map(cachedTranslation.sentences.map(s => [s.originalText, s.translatedText]));

          const hydratedSentences: HydratedSentence[] = parsedData.sentences.map(s => ({
            ...s,
            translatedText: translatedSentencesMap.get(s.sourceText) || s.sourceText
          }));

          // If cache hit, but some sentences might be missing? 
          // Usually it should match if the fingerprint is same.
          // However to be safe, if we have a significant mismatch we might re-translate, but for now trust cache.
          const finalData: PageData = {
            parsedData,
            isLoading: false,
            hydratedSentences,
          };
          setCache((prev) => new Map(prev).set(pageNumber, finalData));
          setIsTranslating(false);
          return finalData;
        }

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

        // 3. Request Translation
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
              // Use translated text, or fallback to source text if missing (Safety guard)
              translatedText: translatedLines[idx] || sentence.sourceText,
            })
          );

          const finalData: PageData = {
            parsedData,
            isLoading: false,
            hydratedSentences,
          };

          setCache((prev) => new Map(prev).set(pageNumber, finalData));

          // 5. Store in persistent cache
          // Create SentenceTranslation objects
          const sentencesToStore: SentenceTranslation[] = hydratedSentences.map((s, idx) => ({
            id: `${pageNumber}-${idx}`,
            pageNumber,
            sentenceIndex: idx,
            originalText: s.sourceText, // Map sourceText to originalText
            translatedText: s.translatedText || undefined,
            createdAt: Date.now(),
            expiresAt: Date.now() + (4 * 24 * 60 * 60 * 1000),
            status: 'completed'
          }));

          if (fingerprint) {
            await translationCache.storeSentences(fingerprint, sentencesToStore);
          }

          return finalData;
        } else {
          throw new Error(response?.error || `Page ${pageNumber} translation failed.`);
        }
      } catch (err) {
        console.error(`Page ${pageNumber} error:`, err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);

        // Even on error, we might want to show the original sentences? 
        // For now, following standard error handling.
        const errorData: PageData = {
          parsedData: { pageNumber, sentences: [] }, // Or keep partial?
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