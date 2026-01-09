import { useState, useEffect, useCallback, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { SentenceTranslation } from '@/types/translation';
import { pdfTextProcessor, type Coordinate } from '@/utils/pdfTextProcessor';

interface UseHighlightingProps {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
  translations: SentenceTranslation[];
  scale: number;
  onSentenceHover?: (sentenceId: string | null) => void;
}

export const useHighlighting = ({
  pdf,
  currentPage,
  translations,
  scale,
  onSentenceHover
}: UseHighlightingProps) => {
  const [highlightedSentenceId, setHighlightedSentenceId] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<{
    sentences: any[];
    scale: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pageContainerRef = useRef<HTMLElement | null>(null);

  const processPageData = useCallback(async () => {
    if (!pdf || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await pdfTextProcessor.processPageWithCoordinates(
        pdf,
        currentPage,
        translations,
        scale
      );

      setProcessedData({
        sentences: result.sentences,
        scale
      });
    } catch (error) {
      console.error('Error processing page data:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [pdf, currentPage, translations, scale, isProcessing]);

  useEffect(() => {
    processPageData();
  }, [processPageData]);

  const handlePdfMouseMove = useCallback((event: Event) => {
    const mouseEvent = event as MouseEvent;
    if (!pageContainerRef.current || !processedData) return;

    const containerRect = pageContainerRef.current.getBoundingClientRect();
    const x = mouseEvent.clientX - containerRect.left;
    const y = mouseEvent.clientY - containerRect.top;

    const hoveredSentence = processedData.sentences.find(sentence => {
      return sentence.coordinates.some((coord: any) => {
        const scaledX = coord.x * scale;
        const scaledY = coord.y * scale;
        const scaledWidth = coord.width * scale;
        const scaledHeight = coord.height * scale;

        return x >= scaledX && x <= scaledX + scaledWidth &&
               y >= scaledY && y <= scaledY + scaledHeight;
      });
    });

    const hoveredId = hoveredSentence?.id || null;
    
    if (hoveredId !== highlightedSentenceId) {
      setHighlightedSentenceId(hoveredId);
      onSentenceHover?.(hoveredId);
    }
  }, [processedData, highlightedSentenceId, onSentenceHover, scale]);

  const handlePdfMouseLeave = useCallback(() => {
    if (highlightedSentenceId !== null) {
      setHighlightedSentenceId(null);
      onSentenceHover?.(null);
    }
  }, [highlightedSentenceId, onSentenceHover]);

  const handleTranslationHover = useCallback((sentenceId: string | null) => {
    setHighlightedSentenceId(sentenceId);
    onSentenceHover?.(sentenceId);
  }, [onSentenceHover]);

  const getCoordinateHighlights = useCallback((sentenceId: string): any[] => {
    if (!processedData) return [];

    const sentence = processedData.sentences.find(s => s.id === sentenceId);
    if (!sentence) return [];

      return sentence.coordinates.map((coord: Coordinate) => {
        const scaledX = coord.x * scale;
        const scaledY = coord.y * scale;
        const scaledWidth = coord.width * scale;
        const scaledHeight = coord.height * scale;

        return {
          position: 'absolute',
          left: `${scaledX}px`,
          top: `${scaledY}px`,
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
          backgroundColor: sentenceId === highlightedSentenceId 
            ? 'rgba(59, 130, 246, 0.3)' 
            : 'rgba(59, 130, 246, 0.1)',
          border: sentenceId === highlightedSentenceId 
            ? '2px solid rgb(59, 130, 246)' 
            : '1px solid rgb(59, 130, 246)',
          borderRadius: '2px',
          pointerEvents: 'none',
          zIndex: sentenceId === highlightedSentenceId ? 15 : 10,
          transition: 'all 0.2s ease'
        };
      });
  }, [processedData, highlightedSentenceId, scale]);

  useEffect(() => {
    const pageElement = document.querySelector(`.react-pdf__Page[data-page-number="${currentPage}"]`);
    if (pageElement) {
      pageContainerRef.current = pageElement as HTMLElement;
      
      pageElement.addEventListener('mousemove', handlePdfMouseMove as EventListener);
      pageElement.addEventListener('mouseleave', handlePdfMouseLeave as EventListener);

      return () => {
        pageElement.removeEventListener('mousemove', handlePdfMouseMove as EventListener);
        pageElement.removeEventListener('mouseleave', handlePdfMouseLeave as EventListener);
      };
    }
  }, [currentPage, handlePdfMouseMove, handlePdfMouseLeave]);

  return {
    highlightedSentenceId,
    sentencePositions: processedData?.sentences || [],
    isProcessing,
    handleTranslationHover,
    getCoordinateHighlights
  };
};