import { useState, useEffect, useCallback, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { translationQueue } from '@/utils/translationQueue';
import { atomicTranslationCache as translationCache } from '@/utils/atomicTranslationCache';
import { pdfTextProcessor } from '@/utils/pdfTextProcessor';
import type { SentenceTranslation } from '@/types/translation';

interface UseSentenceTranslationProps {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
}

export const useSentenceTranslation = ({ pdf, currentPage }: UseSentenceTranslationProps) => {
  const [translations, setTranslations] = useState<Map<number, SentenceTranslation[]>>(new Map());
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // failedPages State가 반드시 있어야 합니다: const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  
  // [수정 1] 중복 요청 방지용 Ref (렌더링 없이 상태 추적)
  const pendingPages = useRef<Set<number>>(new Set());

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
    if (!pdf) return;

    // [Safety Check] 처리 중이거나, 이미 성공했거나, '실패 목록'에 있다면 중단
    if (pendingPages.current.has(pageNumber) || translations.has(pageNumber) || failedPages.has(pageNumber)) {
      return;
    }

    // ... 캐시 확인 로직 ...
    const cached = await translationCache.getPageTranslation(pageNumber);
    if (cached && cached.sentences.length > 0) {
      setTranslations(prev => new Map(prev).set(pageNumber, cached.sentences));
      return;
    }

    pendingPages.current.add(pageNumber);
    // ...
    if (priority === 'high') {
      setIsTranslating(true);
      setError(null);
    }

    try {
      // ... 번역 로직 ...
      const sentences = await extractSentencesFromPage(pageNumber);
      if (sentences.length === 0) {
        return; // 빈 결과는 저장하지 않고 그냥 리턴
      }

      const translationPromises = sentences.map((sentence, index) => 
        translationQueue.addToQueue(
          sentence,
          pageNumber,
          index,
          priority
        )
      );

      const results = await Promise.all(translationPromises);
      
      // 성공 시 저장
      setTranslations(prev => new Map(prev).set(pageNumber, results));
      await translationCache.storePageTranslation(pageNumber, results);
    } catch (err) {
      console.error(`페이지 ${pageNumber} 번역 실패:`, err);
      // [수정] 실패 시 translations 맵에는 아무것도 넣지 않음 (그래야 재시도 가능)
      // 대신 failedPages에 등록하여 무한 루프 방지
      setFailedPages(prev => new Set(prev).add(pageNumber));
      
      if (priority === 'high') setError(err instanceof Error ? err.message : String(err));
    } finally {
      pendingPages.current.delete(pageNumber);
      if (priority === 'high') setIsTranslating(false);
    }
  }, [pdf, extractSentencesFromPage, translations, failedPages]);

  const prefetchPages = useCallback((basePage: number) => {
    if (!pdf) return;

    // [수정 6] 프리페치 시에도 이미 번역된 페이지는 스킵
    const targets = [basePage + 1, basePage + 2];
    targets.forEach(page => {
      if (page <= pdf.numPages && !translations.has(page) && !pendingPages.current.has(page) && !failedPages.has(page)) {
        requestIdleCallback(() => translatePageSentences(page, 'normal'));
      }
    });
  }, [pdf, translatePageSentences, translations, failedPages]);

  // [핵심 수정] 페이지 방문 시 'Retry' 기회를 주는 Effect
  useEffect(() => {
    if (pdf && currentPage > 0) {
      // 1. 만약 현재 페이지가 이전에 실패했던 페이지라면? -> 실패 목록에서 제거 (재시도 기회 부여)
      if (failedPages.has(currentPage)) {
        setFailedPages(prev => {
          const next = new Set(prev);
          next.delete(currentPage);
          return next;
        });
        // State가 변경되면 리렌더링되면서 아래 로직이 다시 실행되므로 여기선 return
        return;
      }

      // 2. 번역 데이터가 없으면 요청 시작
      if (!translations.has(currentPage)) {
        translatePageSentences(currentPage, 'high');
      }

      prefetchPages(currentPage);
    }
  }, [pdf, currentPage, translatePageSentences, prefetchPages, translations, failedPages]);

  // [디버깅] 현재 상태 로깅
  useEffect(() => {
    console.log('🔍 Translation Debug:', {
      currentPage,
      hasTranslation: translations.has(currentPage),
      isFailed: failedPages.has(currentPage),
      isPending: pendingPages.current.has(currentPage),
      translationsCount: translations.size,
      failedPagesCount: failedPages.size,
      pendingCount: pendingPages.current.size,
      currentPageTranslations: translations.get(currentPage)
    });
  }, [currentPage, translations, failedPages]);

  return {
    translations,
    currentPageTranslations: translations.get(currentPage) || [],
    isTranslating,
    error,
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
    }, [])
  };
};