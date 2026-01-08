import { useEffect, useState, useCallback, useRef } from 'react';
import TranslationPopup from '@/components/TranslationPopup';
import { MultiStackAlert } from '@/components/common';
import { useMultiAlert } from '@/hooks/useMultiAlert';
import { useTextSelection } from '@/hooks/useTextSelection';

const ContentApp = () => {
  const [translation, setTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [wordDetails, setWordDetails] = useState<any>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showReloadButton, setShowReloadButton] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

    const { alerts, addAlert, clearAlert } = useMultiAlert();
    const { selection: { text: selectedText }, popupPosition, clearSelection } = useTextSelection();
  
    const translateText = useCallback(async (text: string) => {
      setIsLoading(true);
      try {
        if (!chrome.runtime?.id) {
          console.error('Extension context invalidated');
          addAlert('확장 프로그램이 업데이트되었습니다. 페이지를 새로고침 해주세요.', 'destructive');
          setShowReloadButton(true);
          return;
        }
  
        const response = await chrome.runtime.sendMessage({
          type: 'TRANSLATE_REQUEST',
          text: text
        });
  
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          addAlert('번역 서비스를 사용할 수 없습니다. 다시 시도해주세요.', 'destructive');
          return;
        }
  
        if (response?.success && response.translatedText) {
          setTranslation(response.translatedText);
          setShowReloadButton(false);
          
          const dictResponse = await chrome.runtime.sendMessage({
            type: 'GET_WORD_DETAILS',
            text: text
          });
          
          if (dictResponse?.success && dictResponse.data) {
            setWordDetails(dictResponse.data);
          }
        } else {
          const errorMessage = response?.error || '번역에 실패했습니다.';
          setTranslation(errorMessage);
          
          if (errorMessage.includes('Extension context') || 
              errorMessage.includes('확장 프로그램이 업데이트되었습니다')) {
            addAlert(errorMessage, 'destructive');
            setShowReloadButton(true);
          }
        }
      } catch (error) {
        console.error('Error sending translation request:', error);
        const errorMessage = error instanceof Error ? error.message : '번역 요청 실패';
        setTranslation(errorMessage);
        addAlert(errorMessage, 'destructive');
      } finally {
        setIsLoading(false);
      }
    }, [addAlert]);
  
    useEffect(() => {
      if (selectedText && popupPosition && !showTranslation) {
        setShowTranslation(true);
        setTranslation('');
        setWordDetails(null);
        setIsSaved(false);
        setIsLoading(true);
        setShowReloadButton(false);
        
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        debounceTimerRef.current = setTimeout(async () => {
          await translateText(selectedText);
          debounceTimerRef.current = null;
        }, 200);
      } else if (!selectedText && showTranslation) {
        setShowTranslation(false);
        setTranslation('');
        setWordDetails(null);
        setIsSaved(false);
        setIsLoading(false);
        
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      }
  
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, [selectedText, popupPosition, showTranslation, translateText]);
  
    const handleAddToWordbook = useCallback(() => {
      chrome.runtime.sendMessage({
        type: 'SAVE_WORD',
        original: selectedText,
        translated: translation
      }, (res) => {
        if (res?.success) {
          setIsSaved(true);
          setTimeout(() => {
            clearSelection();
            setShowTranslation(false);
          }, 1500);
        }
        });
    }, [selectedText, translation, clearSelection]);
  
    const handlePageReload = useCallback(() => {
      window.location.reload();
    }, []);
  
    return (
      <>
        <MultiStackAlert 
          alerts={alerts}
          onClearAlert={clearAlert}
        />
        
        <TranslationPopup
          ref={popupRef}
          position={popupPosition || { top: 0, left: 0 }}
          selectedText={selectedText}
          translation={translation}
          isTranslating={isLoading}
          isSaved={isSaved}
          wordDetails={wordDetails}
          showTranslation={showTranslation}
          onAddToWordbook={handleAddToWordbook}
        />
        
        {showReloadButton && (
          <div className="fixed top-4 right-4 z-[9999]">
            <button
              onClick={handlePageReload}
              className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 0014.414 0m-8.486 8.486-8.486-8.486" />
              </svg>
              페이지 새로고침
            </button>
          </div>
        )}
      </>
    );
  };
export default ContentApp;