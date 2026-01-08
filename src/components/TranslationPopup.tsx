import { useEffect, useState, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Volume2, Loader2, Check, BookOpen, RefreshCw } from 'lucide-react';

interface WordDetails {
  phonetic?: string;
  audioUrl?: string;
  meanings: string[];
}

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
}

const TranslationPopup = forwardRef<HTMLDivElement, TranslationPopupProps>(({
  selectedText,
  translation,
  isTranslating,
  isSaved,
  wordDetails,
  showTranslation,
  onAddToWordbook,
  onReloadPage, // Destructure the new prop
  position
}, ref) => {
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    if (isSaved && !showCheckmark) {
      setShowCheckmark(true);
      const timer = setTimeout(() => setShowCheckmark(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isSaved]);

  if (!selectedText || !showTranslation) return null;

  const isContextInvalidated = translation === 'Extension context invalidated. Please refresh the page.';

  return (
    <div
      ref={ref}
      id="translate-popup"
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        zIndex: 9999,
      }}
      className="font-sans text-sm"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Card className="w-80 shadow-xl border-gray-200 bg-white">
        <CardContent className="p-4 flex flex-col gap-3">
          {isContextInvalidated ? (
            <div className="text-red-500 text-center">
              <p className="mb-2">확장 프로그램 컨텍스트가 무효화되었습니다.</p>
              <Button onClick={() => { console.log('Reload button clicked!'); onReloadPage?.(); }} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                페이지 새로고침
              </Button>
            </div>
          ) : onReloadPage ? (
            <div className="flex justify-end mt-2">
              <Button onClick={onReloadPage} className="text-blue-600 hover:text-blue-800 text-sm">
                <RefreshCw className="h-3 w-3 mr-1" />
                페이지 새로고침
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-gray-900 break-words font-bold text-lg">{selectedText}</div>
                
                {wordDetails?.phonetic && (
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
                )}
              </div>
              
              <div className="border-t border-gray-100"></div>
              
              <div className="text-gray-900 font-medium">
                {isTranslating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-blue-500">번역 중...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-blue-600">{translation}</div>
                    {wordDetails?.meanings && wordDetails.meanings.length > 1 && (
                      <div className="text-xs text-gray-500 mt-2">
                        {wordDetails.meanings.slice(0, 2).map((meaning: string, index: number) => (
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

              {!isTranslating && translation && (
                <div className="relative">
                  <Button 
                    onClick={onAddToWordbook}
                    disabled={isSaved}
                    variant={isSaved ? "outline" : "default"}
                    className={`text-sm font-bold transition-all duration-300 w-full ${
                      isSaved 
                        ? 'text-green-600 border-green-200 hover:bg-green-50' 
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Saved
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-4 w-4 mr-2" />
                        Add to Wordbook
                      </>
                    )}
                  </Button>
                  
                  {/* Checkmark Animation */}
                  {showCheckmark && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-6 w-6 text-white animate-ping" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default TranslationPopup;