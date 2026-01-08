import { useEffect, useState, useCallback } from 'react';
import TranslationPopup from '@/components/TranslationPopup';
import { MultiStackAlert } from '@/components/common';
import { useMultiAlert } from '@/hooks/useMultiAlert';
import { useTextSelection } from '@/hooks/useTextSelection';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebounce } from '@/hooks/useDebounce';
import alertService from '@/services/AlertService';

const ContentApp = () => {
  const [showReloadButton, setShowReloadButton] = useState(false);

  const { alerts, addAlert, clearAlert } = useMultiAlert();
  const { selection: { text: selectedText }, popupPosition, clearSelection } = useTextSelection();
  
  const debouncedSelectedText = useDebounce(selectedText, 300);

  const {
    selectedText: translatedSelectedText,
    translation,
    isTranslating,
    isSaved,
    wordDetails,
    showTranslation,
    error,
    translateText,
    addToWordbook,
    resetTranslation
  } = useTranslation();

  useEffect(() => {
    alertService.register(addAlert);
  }, [addAlert]);

  useEffect(() => {
    if (error?.type === 'context_invalidated') {
      setShowReloadButton(true);
      addAlert(error.message, 'destructive');
    } else if (error) {
      addAlert(error.message, 'destructive');
    }
  }, [error, addAlert]);

  useEffect(() => {
    if (debouncedSelectedText && popupPosition) {
      translateText(debouncedSelectedText);
    } else {
      resetTranslation();
    }
  }, [debouncedSelectedText, popupPosition, translateText, resetTranslation]);

  const handleAddToWordbook = useCallback(() => {
    addToWordbook(translatedSelectedText, translation);
    setTimeout(() => {
      clearSelection();
    }, 1500);
  }, [translatedSelectedText, translation, addToWordbook, clearSelection]);

  const handlePageReload = useCallback(() => {
    window.location.reload();
  }, []);

  const handleClosePopup = () => {
    resetTranslation();
    clearSelection();
  }

  return (
    <>
      <MultiStackAlert 
        alerts={alerts}
        onClearAlert={clearAlert}
      />
      
      {popupPosition && showTranslation && (
        <TranslationPopup
          position={popupPosition}
          selectedText={translatedSelectedText}
          translation={translation}
          isTranslating={isTranslating}
          isSaved={isSaved}
          wordDetails={wordDetails}
          showTranslation={showTranslation}
          onAddToWordbook={handleAddToWordbook}
          onClose={handleClosePopup}
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