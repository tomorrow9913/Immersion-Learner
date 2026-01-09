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

    // [수정 2] 핵심 가드 절: 처리 중이거나 완료된 페이지는 즉시 중단
    if (pendingPages.current.has(pageNumber) || translations.has(pageNumber)) {
      return;
    }

    // 캐시 확인
    const cached = await translationCache.getPageTranslation(pageNumber);
    if (cached && cached.sentences.length > 0) {
      setTranslations(prev => new Map(prev).set(pageNumber, cached.sentences));
      return;
    }

    pendingPages.current.add(pageNumber); // 처리 시작 표시
    if (priority === 'high') {
      setIsTranslating(true);
      setError(null);
    }

    try {
      const sentences = await extractSentencesFromPage(pageNumber);
      if (sentences.length === 0) {
        setTranslations(prev => new Map(prev).set(pageNumber, [])); // 빈 결과라도 저장해서 재시도 방지
        return;
      }

      // [수정 3] storeSentence 제거하여 DB 부하 감소
      const translationPromises = sentences.map((sentence, index) => 
        translationQueue.addToQueue(
          sentence,
          pageNumber,
          index,
          priority
        )
      );

      const results = await Promise.all(translationPromises);
      
      setTranslations(prev => new Map(prev).set(pageNumber, results));

      // [수정 4] 페이지 단위로 한 번만 저장
      await translationCache.storePageTranslation(pageNumber, results);
    } catch (err) {
      console.error(`페이지 ${pageNumber} 번역 실패:`, err);
      const message = err instanceof Error ? err.message : String(err);
      if (priority === 'high') setError(message);

      // [수정 5] 실패 시에도 '빈 배열'을 상태에 넣어 무한 재요청 루프 끊기
      // (사용자가 '재시도' 버튼을 누르기 전까지는 자동 재시도 안 함)
      setTranslations(prev => new Map(prev).set(pageNumber, []));
    } finally {
      pendingPages.current.delete(pageNumber); // 처리 완료 표시 해제
      if (priority === 'high') setIsTranslating(false);
    }
  }, [pdf, extractSentencesFromPage, translations]);

  const prefetchPages = useCallback((basePage: number) => {
    if (!pdf) return;

    // [수정 6] 프리페치 시에도 이미 번역된 페이지는 스킵
    const targets = [basePage + 1, basePage + 2];
    targets.forEach(page => {
      if (page <= pdf.numPages && !translations.has(page) && !pendingPages.current.has(page)) {
        requestIdleCallback(() => translatePageSentences(page, 'normal'));
      }
    });
  }, [pdf, translatePageSentences, translations]);

  useEffect(() => {
    if (pdf && currentPage > 0) {
      // 현재 페이지가 번역되지 않았다면 요청
      if (!translations.has(currentPage)) {
        translatePageSentences(currentPage, 'high');
      }
      prefetchPages(currentPage);
    }
  }, [pdf, currentPage, translatePageSentences, prefetchPages, translations]); // translations 의존성 중요

  return {
    translations,
    currentPageTranslations: translations.get(currentPage) || [],
    isTranslating,
    error,
    translatePageSentences,
    // ... 
    prioritizeCurrentPage: (p: number) => translatePageSentences(p, 'high'), // 단순화
    clearCache: useCallback(() => {
      translationCache.clear();
      setTranslations(new Map());
      pendingPages.current.clear();
    }, [])
  };
};