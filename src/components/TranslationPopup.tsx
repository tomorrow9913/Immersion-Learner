import { useEffect, useState, forwardRef, useLayoutEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Volume2, Check, BookOpen, RefreshCw, X } from 'lucide-react';
import type { WordDetails } from '@/types';

interface TranslationPopupProps {
  selectedText: string;
  translation: string;
  isTranslating: boolean;
  isSaved: boolean;
  wordDetails: WordDetails | null;
  showTranslation: boolean;
  onAddToWordbook: () => void;
  onReloadPage?: () => void;
  position: { top: number, left: number };
  onClose?: () => void;
}

const TranslationPopup = forwardRef<HTMLDivElement, TranslationPopupProps>(({
  selectedText,
  translation,
  isTranslating,
  isSaved,
  wordDetails,
  showTranslation,
  onAddToWordbook,
  onReloadPage,
  position,
  onClose,
}) => {
  const [showCheckmark, setShowCheckmark] = useState(false);
  const internalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSaved && !showCheckmark) {
      setShowCheckmark(true);
      const timer = setTimeout(() => setShowCheckmark(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isSaved, showCheckmark]); // Added showCheckmark to dependencies

  useLayoutEffect(() => {
    const element = internalRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 1. 하단 충돌 감지 (화면 아래로 뚫고 나가는지)
    if (rect.bottom > viewportHeight) {
      const overflow = rect.bottom - viewportHeight;
      element.style.top = `${position.top - overflow - 20}px`; // 20px 여유
    }

    // 2. 우측 충돌 감지
    if (rect.right > viewportWidth) {
      const overflowX = rect.right - viewportWidth;
      element.style.left = `${position.left - overflowX - 20}px`;
    }
  }, [position, translation, wordDetails]);

  if (!selectedText || !showTranslation) return null;

  const isContextInvalidated = translation === 'Extension context invalidated. Please refresh the page.';

  return (
    <div
      ref={internalRef} // ref 연결
      id="translate-popup"
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        zIndex: 9999,
      }}
      className="font-sans text-sm"
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Card className="w-80 shadow-xl border-gray-200 bg-white relative">
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-1 right-1 p-1 h-6 w-6"
          >
            <X className="h-4 w-4 text-gray-500" />
          </Button>
        )}
        <CardContent className="p-4 flex flex-col gap-3">
          {isContextInvalidated ? (
            <div className="text-red-500 text-center">
              <p className="mb-2">확장 프로그램 컨텍스트가 무효화되었습니다.</p>
              <Button onClick={() => onReloadPage?.()} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                페이지 새로고침
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 pr-6">
                <div className="text-gray-900 break-words font-bold text-lg">{selectedText}</div>
                
                {isTranslating ? (
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                ) : (
                  wordDetails?.phonetic && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-sm">[{wordDetails.phonetic}]</span>
                      {wordDetails.audioUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            new Audio(wordDetails.audioUrl).play().catch(console.error); 
                          }}
                          className="p-1 h-6 w-6"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )
                )}
              </div>
              
              <div className="border-t border-gray-100"></div>
              
              <div className="text-gray-900 font-medium">
                {isTranslating ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-blue-600">{translation}</div>
                    {wordDetails?.meanings && wordDetails.meanings.length > 1 && (
                      <div className="text-xs text-gray-500 mt-2">
                        {wordDetails.meanings.slice(0, 2).map((meaning, index) => (
                          <div key={index} className="flex gap-1">
                            <span className="text-gray-400">{index + 1}.</span>
                            <span>{meaning}</span>
                          </div>
                        ))}
                        {wordDetails.meanings.length > 2 && (
                          <div className="text-gray-400 italic">...+{wordDetails.meanings.length - 2} more</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isTranslating ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                translation && (
                  <div className="relative">
                    <Button 
                      onClick={onAddToWordbook}
                      disabled={isSaved}
                      variant={isSaved ? "outline" : "default"}
                      className={`text-sm font-bold transition-all duration-300 w-full ${
                        isSaved 
                          ? 'text-green-600 border-green-200 hover:bg-green-50' 
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      {isSaved ? (
                        <><Check className="h-4 w-4 mr-2" />Saved</>
                      ) : (
                        <><BookOpen className="h-4 w-4 mr-2" />Add to Wordbook</>
                      )}
                    </Button>
                    
                    {showCheckmark && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="h-6 w-6 text-white animate-ping" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default TranslationPopup;
