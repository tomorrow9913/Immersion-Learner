import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Volume2, Loader2, Check, BookOpen } from 'lucide-react';

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
}

const TranslationPopup: React.FC<TranslationPopupProps> = ({
  selectedText,
  translation,
  isTranslating,
  isSaved,
  wordDetails,
  showTranslation,
  onAddToWordbook
}) => {
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    if (isSaved && !showCheckmark) {
      setShowCheckmark(true);
      const timer = setTimeout(() => setShowCheckmark(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isSaved]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#translate-popup') && !target.closest('#translate-button')) {
        return;
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  if (!selectedText || !showTranslation) return null;

  const calculatePosition = () => {
    const selection = window.getSelection();
    if (!selection) return { top: 100, left: 100 };
    
    const range = selection.getRangeAt(0);
    if (!range) return { top: 100, left: 100 };
    
    const rect = range.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;
    
    if (top + 300 > viewportHeight + window.scrollY) {
      top = rect.top + window.scrollY - 310;
    }
    
    if (left + 320 > viewportWidth) {
      left = viewportWidth - 330;
    }
    
    if (left < 10) {
      left = 10;
    }
    
    return { top, left };
  };

  const position = calculatePosition();

  return (
    <div
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
        </CardContent>
      </Card>
    </div>
  );
};

export default TranslationPopup;