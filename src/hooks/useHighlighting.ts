import { useState, useEffect, useCallback, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { SentenceTranslation } from '@/types/translation';

interface TextFragment {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

interface HighlightedSentence {
  id: string;
  text: string;
  fragments: TextFragment[];
  sentenceIndex: number;
}

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
  const [sentencePositions, setSentencePositions] = useState<HighlightedSentence[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const pageContainerRef = useRef<HTMLElement | null>(null);

  const extractTextFragments = useCallback(async (page: any) => {
    try {
      const textContent = await page.getTextContent();

      return textContent.items
        .filter((item: any) => item.str && item.str.trim())
        .map((item: any) => {
          const transform = item.transform;
          return {
            x: transform[4],
            y: transform[5],
            width: item.width || 0,
            height: item.height || 0,
            text: item.str
          };
        });
    } catch (error) {
      console.error('Error extracting text fragments:', error);
      return [];
    }
  }, []);

  const mapSentencesToFragments = useCallback((
    sentences: SentenceTranslation[],
    fragments: TextFragment[]
  ): HighlightedSentence[] => {
    return sentences.map((sentence, index) => {
      const sentenceWords = sentence.originalText.toLowerCase().split(/\s+/);
      const matchedFragments: TextFragment[] = [];
      let remainingWords = [...sentenceWords];

      fragments.forEach(fragment => {
        const fragmentText = fragment.text.toLowerCase().trim();
        const fragmentWords = fragmentText.split(/\s+/);

        if (fragmentWords.length === 0) return;

        for (let i = 0; i <= remainingWords.length - fragmentWords.length; i++) {
          const window = remainingWords.slice(i, i + fragmentWords.length);
          
          if (fragmentWords.every((word, wordIndex) => {
            const cleanWord = word.replace(/[^\w]/g, '');
            const cleanWindow = window[wordIndex].replace(/[^\w]/g, '');
            return cleanWord && cleanWindow && cleanWord.includes(cleanWindow);
          })) {
            matchedFragments.push(fragment);
            remainingWords.splice(i, fragmentWords.length);
            break;
          }
        }
      });

      return {
        id: sentence.id,
        text: sentence.originalText,
        fragments: matchedFragments,
        sentenceIndex: index
      };
    });
  }, []);

  const processSentenceCoordinates = useCallback(async () => {
    if (!pdf || isProcessing) return;

    setIsProcessing(true);
    try {
      const page = await pdf.getPage(currentPage);
      const fragments = await extractTextFragments(page);
      const mappedSentences = mapSentencesToFragments(translations, fragments);
      setSentencePositions(mappedSentences);
    } catch (error) {
      console.error('Error processing sentence coordinates:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [pdf, currentPage, translations, isProcessing, extractTextFragments, mapSentencesToFragments]);

  useEffect(() => {
    processSentenceCoordinates();
  }, [processSentenceCoordinates]);

  const handlePdfMouseMove = useCallback((event: Event) => {
    const mouseEvent = event as MouseEvent;
    if (!pageContainerRef.current) return;

    const containerRect = pageContainerRef.current.getBoundingClientRect();
    const x = mouseEvent.clientX - containerRect.left;
    const y = mouseEvent.clientY - containerRect.top;

    const hoveredSentence = sentencePositions.find(sentence => {
      return sentence.fragments.some(fragment => {
        const scaledX = fragment.x * scale;
        const scaledY = fragment.y * scale;
        const scaledWidth = fragment.width * scale;
        const scaledHeight = fragment.height * scale;

        return x >= scaledX && x <= scaledX + scaledWidth &&
               y >= scaledY && y <= scaledY + scaledHeight;
      });
    });

    const hoveredId = hoveredSentence?.id || null;
    
    if (hoveredId !== highlightedSentenceId) {
      setHighlightedSentenceId(hoveredId);
      onSentenceHover?.(hoveredId);
    }
  }, [sentencePositions, highlightedSentenceId, onSentenceHover, scale]);

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

  const getCoordinateHighlights = useCallback((sentenceId: string): React.CSSProperties[] => {
    const sentence = sentencePositions.find(s => s.id === sentenceId);
    if (!sentence) return [];

    return sentence.fragments.map(fragment => {
      const scaledX = fragment.x * scale;
      const scaledY = fragment.y * scale;
      const scaledWidth = fragment.width * scale;
      const scaledHeight = fragment.height * scale;

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
  }, [sentencePositions, highlightedSentenceId, scale]);

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
    sentencePositions,
    isProcessing,
    handleTranslationHover,
    getCoordinateHighlights
  };
};