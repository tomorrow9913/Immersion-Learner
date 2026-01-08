import { useEffect, useState, useCallback, useRef } from 'react';
import TranslationPopup from '@/components/TranslationPopup';
import { MultiStackAlert } from '@/components/common';
import { useMultiAlert } from '@/hooks/useMultiAlert';

const ContentApp = () => {
  const [selectedText, setSelectedText] = useState('');
  const [translation, setTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [wordDetails, setWordDetails] = useState<any>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const DRAG_THRESHOLD = 5;
  const debounceTimerRef = useRef<number | null>(null);

  const { alerts, addAlert, clearAlert } = useMultiAlert();

  const translateText = useCallback(async (text: string) => {
    setIsLoading(true);
    try {
      if (!chrome.runtime?.id) {
        console.error('Extension context invalidated');
        addAlert('확장 프로그램이 업데이트되었습니다. 페이지를 새로고침 해주세요.', 'destructive');
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
        
        const dictResponse = await chrome.runtime.sendMessage({
          type: 'GET_WORD_DETAILS',
          text: text
        });
        
        if (dictResponse?.success) {
          setWordDetails(dictResponse.data);
        }
      } else {
        const errorMessage = response?.error || '번역에 실패했습니다.';
        setTranslation(errorMessage);
        
        if (errorMessage.includes('Extension context') || 
            errorMessage.includes('확장 프로그램이 업데이트되었습니다')) {
          addAlert(errorMessage, 'destructive');
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

  const showTranslationPopup = useCallback((text: string, rect: DOMRect) => {
    const top = rect.bottom + window.scrollY + 10;
    const left = rect.left + window.scrollX;
    
    setPosition({ top, left });
    setSelectedText(text);
    setShowTranslation(true);
    setTranslation('');
    setWordDetails(null);
    setIsSaved(false);
  }, []);

  const hideTranslationPopup = useCallback(() => {
    setShowTranslation(false);
    setSelectedText('');
    setTranslation('');
    setWordDetails(null);
    setIsSaved(false);
    setIsLoading(false);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        const selection = window.getSelection();
        if (selection && selection.isCollapsed) {
          hideTranslationPopup();
        }
      }
      
      isDragging.current = false;
      dragStartX.current = e.clientX;
      dragStartY.current = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) {
        const dx = Math.abs(e.clientX - dragStartX.current);
        const dy = Math.abs(e.clientY - dragStartY.current);
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          isDragging.current = true;
          
          const selection = window.getSelection();
          const text = selection?.toString().trim();
          
          if (text && text.length > 0 && selection) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            showTranslationPopup(text, rect);
          } else {
            hideTranslationPopup();
          }
        }
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [showTranslationPopup, hideTranslationPopup]);

  useEffect(() => {
    if (selectedText && showTranslation) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(async () => {
        await translateText(selectedText);
        debounceTimerRef.current = null;
      }, 200);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [selectedText, showTranslation, translateText]);
  
  const handleAddToWordbook = useCallback(() => {
    chrome.runtime.sendMessage({
      type: 'SAVE_WORD',
      original: selectedText,
      translated: translation
    }, (res) => {
      if (res?.success) {
        setIsSaved(true);
        setTimeout(() => {
          hideTranslationPopup();
          window.getSelection()?.removeAllRanges();
        }, 1500);
      }
    });
  }, [selectedText, translation, hideTranslationPopup]);

  const handleClickOutside = useCallback(() => {
    hideTranslationPopup();
  }, [hideTranslationPopup]);
   
  return (
    <>
      <MultiStackAlert 
        alerts={alerts}
        onClearAlert={clearAlert}
      />
      
      <TranslationPopup
        ref={popupRef}
        position={position}
        selectedText={selectedText}
        translation={translation}
        isTranslating={isLoading}
        isSaved={isSaved}
        wordDetails={wordDetails}
        showTranslation={showTranslation}
        onAddToWordbook={handleAddToWordbook}
        onReloadPage={handleClickOutside}
      />
    </>
  );
};

export default ContentApp;