import { useState, useCallback, useRef } from 'react';
import { UI_CONFIG, MESSAGE_TYPES } from '@/config/constants';

interface TranslationState {
  selectedText: string;
  translation: string;
  isTranslating: boolean;
  isSaved: boolean;
  wordDetails: {
    phonetic?: string;
    audioUrl?: string;
    meanings: string[];
  } | null;
  showTranslation: boolean;
}

export const useTranslation = () => {
  const [state, setState] = useState<TranslationState>({
    selectedText: '',
    translation: '',
    isTranslating: false,
    isSaved: false,
    wordDetails: null,
    showTranslation: false
  });

  const updateState = useCallback((updates: Partial<TranslationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const translationCache = useRef<Map<string, string>>(new Map());

  const translateText = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;
    
    const cached = translationCache.current.get(text);
    if (cached) {
      updateState({
        translation: cached,
        showTranslation: true,
        isTranslating: false
      });
      return;
    }

    updateState({
      isTranslating: true,
      translation: '',
      isSaved: false,
      wordDetails: null,
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.TRANSLATE_REQUEST,
        text: text
      });

      if (response?.success && response.translatedText) {
        translationCache.current.set(text, response.translatedText);
        if (translationCache.current.size > 100) {
          const firstKey = translationCache.current.keys().next().value;
          if (firstKey) {
            translationCache.current.delete(firstKey);
          }
        }

        updateState({
          translation: response.translatedText,
          showTranslation: true
        });

        const dictResponse = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.GET_WORD_DETAILS,
          text: text
        });

        if (dictResponse?.success && dictResponse.data) {
          updateState({
            wordDetails: dictResponse.data
          });
        }
      } else {
        updateState({
          translation: response?.error || '번역에 실패했습니다.',
          showTranslation: true
        });
      }
    } catch (error) {
      console.error('Translation error:', error);
      updateState({
        translation: '번역 서비스를 사용할 수 없습니다.',
        showTranslation: true
      });
    } finally {
      updateState({ isTranslating: false });
    }
  }, [updateState]);

  const addToWordbook = useCallback((text: string, translatedText: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SAVE_WORD,
        original: text,
        translated: translatedText
      }, (res) => {
        if (res?.success) {
          setTimeout(() => {
            window.getSelection()?.removeAllRanges();
          }, UI_CONFIG.WORD_SAVE_SUCCESS_DURATION);
        }
      });
    }
  }, []);

  const setSelectedText = useCallback((text: string) => {
    updateState({ selectedText: text });
  }, [updateState]);

  const resetTranslation = useCallback(() => {
    updateState({
      selectedText: '',
      translation: '',
      isTranslating: false,
      isSaved: false,
      wordDetails: null,
      showTranslation: false
    });
  }, [updateState]);

  return {
    selectedText: state.selectedText,
    translation: state.translation,
    isTranslating: state.isTranslating,
    isSaved: state.isSaved,
    wordDetails: state.wordDetails,
    showTranslation: state.showTranslation,
    
    translateText,
    addToWordbook,
    setSelectedText,
    resetTranslation
  };
};