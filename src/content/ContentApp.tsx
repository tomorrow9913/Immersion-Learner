import { useEffect, useState, useCallback, useRef } from 'react';
import TranslationPopup from '@/components/TranslationPopup';
import { MultiStackAlert } from '@/components/common';
import { useMultiAlert } from '@/hooks/useMultiAlert';
import { useTextSelection } from '@/hooks/useTextSelection';
import { MESSAGE_TYPES } from '@/config/constants';

interface TranslationData {
  translation: string;
  wordDetails: any;
}

import alertService from '@/services/AlertService';

const ContentApp = () => {
  const [translation, setTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [wordDetails, setWordDetails] = useState<any>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showReloadButton, setShowReloadButton] = useState(false);
  
  const popupRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const translationCache = useRef<Map<string, TranslationData>>(new Map());

  const { alerts, addAlert, clearAlert } = useMultiAlert();
  const { selection: { text: selectedText }, popupPosition, clearSelection } = useTextSelection();

  useEffect(() => {
    alertService.register(addAlert);
  }, [addAlert]);

  const translateText = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    if (translationCache.current.has(trimmedText)) {
      const cached = translationCache.current.get(trimmedText)!;
      setTranslation(cached.translation);
      setWordDetails(cached.wordDetails);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setShowReloadButton(false);

    try {
      if (!chrome.runtime?.id) {
        throw new Error('확장 프로그램이 업데이트되었습니다. 페이지를 새로고침 해주세요.');
      }

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_TRANSLATION_AND_DETAILS,
        text: trimmedText
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message || '번역 서비스를 사용할 수 없습니다.');
      }

      if (response?.success) {
        const { translatedText, dictionaryData } = response;
        translationCache.current.set(trimmedText, { translation: translatedText, wordDetails: dictionaryData });
        setTranslation(translatedText);
        setWordDetails(dictionaryData);
      } else {
        throw new Error(response?.error || '번역에 실패했습니다.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '번역 요청 실패';
      if (errorMessage.includes('확장 프로그램')) {
        setShowReloadButton(true);
      }
      setTranslation(errorMessage);
      addAlert(errorMessage, 'destructive');
    } finally {
      setIsLoading(false);
    }
  }, [addAlert]);

  useEffect(() => {
    if (selectedText && popupPosition) {
      setShowTranslation(true);
      setTranslation('');
      setWordDetails(null);
      setIsSaved(false);
      
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = window.setTimeout(() => {
        translateText(selectedText);
      }, 300);

    } else {
      setShowTranslation(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [selectedText, popupPosition, translateText]);

  const handleAddToWordbook = useCallback(() => {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SAVE_WORD,
        original: selectedText,
        translated: translation
      }, (res) => {
        if (res?.success) {
          setIsSaved(true);
          setTimeout(() => {
            setShowTranslation(false);
            clearSelection();
          }, 1500);
        }
      });
    }
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
      
      {popupPosition && (
        <TranslationPopup
          ref={popupRef}
          position={popupPosition}
          selectedText={selectedText}
          translation={translation}
          isTranslating={isLoading}
          isSaved={isSaved}
          wordDetails={wordDetails}
          showTranslation={showTranslation}
          onAddToWordbook={handleAddToWordbook}
          onClose={() => setShowTranslation(false)}
        />
      )}
      
      {showReloadButton && (
        <div className="fixed top-4 right-4 z-[9999]">
          <button
            onClick={handlePageReload}
            className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9.5M20 20v-5h-.582m-15.356-2A8.001 8.001 0 009.418 24m8.486-8.486L20 20" /></svg>
            페이지 새로고침
          </button>
        </div>
      )}
    </>
  );
};

export default ContentApp;