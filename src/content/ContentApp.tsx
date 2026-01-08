import { useEffect, useState } from 'react';
import TranslationPopup from '@/components/TranslationPopup';

const ContentApp = () => {
  const [selectedText, setSelectedText] = useState('');
  const [translation, setTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [wordDetails, setWordDetails] = useState<any>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    let debounceTimer: number;

    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === 'immersion-learner-root') return;
      
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(async () => {
        const selection = window.getSelection();
        
        if (!selection || selection.toString().trim().length === 0) {
          setSelectedText('');
          setTranslation('');
          setIsLoading(false);
          setIsSaved(false);
          setWordDetails(null);
          setShowTranslation(false);
          return;
        }
  
        const text = selection.toString().trim();
        if (text === selectedText && showTranslation) {
          return; 
        }

        setSelectedText(text);
        setTranslation('');
        setIsLoading(true);
        setIsSaved(false);
        setWordDetails(null);
        setShowTranslation(false);

        try {
          // Check if extension context is valid
          if (!chrome.runtime?.id) {
            console.error('Extension context invalidated');
            setTranslation('Extension context invalidated. Please refresh the page.');
            setIsLoading(false);
            return;
          }

          const response = await chrome.runtime.sendMessage({
            type: 'TRANSLATE_REQUEST',
            text: text
          });
          
          setIsLoading(false);
          
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            setTranslation('Translation service unavailable. Please try again.');
            return;
          }
          
          if (!response) {
            console.error('No response received');
            setTranslation('No response from translation service.');
            return;
          }
          
          if (response.success && response.translatedText) {
            setTranslation(response.translatedText);
            setShowTranslation(true);
            
            try {
              const dictResponse = await chrome.runtime.sendMessage({
                type: 'GET_WORD_DETAILS',
                text: text
              });
              if (dictResponse && dictResponse.success) {
                setWordDetails(dictResponse.data);
              }
            } catch (err) {
              console.error('Error getting word details:', err);
            }
          } else if (response.error) {
            console.error('Translation API error:', response.error);
            setTranslation('Translation failed: ' + response.error);
          } else {
            console.error('Invalid response format:', response);
            setTranslation('Translation failed: Invalid response');
          }
        } catch (error) {
          console.error('Error sending translation request:', error);
          setIsLoading(false);
          setTranslation('Failed to send translation request.');
        }
      }, 200);
    };

    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [selectedText, showTranslation]);

  const handleAddToWordbook = () => {
    chrome.runtime.sendMessage({
      type: 'SAVE_WORD',
      original: selectedText,
      translated: translation
    }, (res) => {
      if (res?.success) {
        setIsSaved(true);
        setTimeout(() => {
          setShowTranslation(false);
          setSelectedText('');
          setTranslation('');
          setWordDetails(null);
          window.getSelection()?.removeAllRanges();
        }, 1500);
      }
    });
  };

  return (
    <TranslationPopup
      selectedText={selectedText}
      translation={translation}
      isTranslating={isLoading}
      isSaved={isSaved}
      wordDetails={wordDetails}
      showTranslation={showTranslation}
      onAddToWordbook={handleAddToWordbook}
    />
  );
};

export default ContentApp;