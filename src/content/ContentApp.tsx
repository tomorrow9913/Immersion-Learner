import { useEffect, useState, useCallback, useRef } from 'react';
import TranslationPopup from '@/components/TranslationPopup';

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

  const translateText = useCallback(async (text: string) => {
    try {
      if (!chrome.runtime?.id) {
        console.error('Extension context invalidated');
        return { success: false, error: 'Extension context invalidated. Please refresh the page.' };
      }

      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_REQUEST',
        text: text
      });

      if (chrome.runtime.lastError) {
        console.error('Chrome runtime error:', chrome.runtime.lastError);
        return { success: false, error: 'Translation service unavailable. Please try again.' };
      }

      if (response?.success && response.translatedText) {
        const dictResponse = await chrome.runtime.sendMessage({
          type: 'GET_WORD_DETAILS',
          text: text
        });
        
        return { 
          success: true, 
          translatedText: response.translatedText,
          wordDetails: dictResponse?.success ? dictResponse.data : null
        };
      } else {
        return { success: false, error: response?.error || 'Translation failed.' };
      }
    } catch (error) {
      console.error('Error sending translation request:', error);
      return { success: false, error: 'Failed to send translation request.' };
    }
  }, []);

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
      setIsLoading(true);
      
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(async () => {
        const result = await translateText(selectedText);
        if (result.success) {
          setTranslation(result.translatedText);
          setWordDetails(result.wordDetails);
        } else {
          setTranslation(result.error || 'Translation failed.');
        }
        setIsLoading(false);
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
  );
};

export default ContentApp;