import { useState, useCallback, useRef } from 'react';
import { UI_CONFIG, MESSAGE_TYPES, ERROR_MESSAGES } from '@/config/constants';
import type { WordDetails } from '@/types';

interface TranslationData {
  translation: string;
  wordDetails: WordDetails | null;
}

interface TranslationError {
  message: string;
  type: 'context_invalidated' | 'default';
}

interface TranslationState extends TranslationData {
  selectedText: string;
  isTranslating: boolean;
  isSaved: boolean;
  showTranslation: boolean;
  error: TranslationError | null;
}

interface SaveWordResponse {
  success: boolean;
  error?: string;
}

export const useTranslation = () => {
  const [state, setState] = useState<TranslationState>({
    selectedText: '',
    translation: '',
    isTranslating: false,
    isSaved: false,
    wordDetails: null,
    showTranslation: false,
    error: null,
  });

  const updateState = useCallback((updates: Partial<TranslationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const translationCache = useRef<Map<string, TranslationData>>(new Map());

  const translateText = useCallback(async (text: string): Promise<void> => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    
    if (translationCache.current.has(trimmedText)) {
      const cachedData = translationCache.current.get(trimmedText);
      if (cachedData) {
        updateState({
          ...cachedData,
          selectedText: trimmedText,
          isTranslating: false,
          isSaved: false,
          showTranslation: true,
          error: null,
        });
        return;
      }
    }

    updateState({
      selectedText: trimmedText,
      isTranslating: true,
      translation: '',
      isSaved: false,
      wordDetails: null,
      showTranslation: true,
      error: null,
    });

    try {
      if (!chrome.runtime?.id) {
        throw new Error(ERROR_MESSAGES.EXTENSION_CONTEXT_INVALIDATED);
      }

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_TRANSLATION_AND_DETAILS,
        text: trimmedText
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message || ERROR_MESSAGES.TRANSLATION_SERVICE_UNAVAILABLE);
      }

      if (response?.success) {
        const { translatedText, dictionaryData } = response;
        const newTranslationData: TranslationData = {
          translation: translatedText,
          wordDetails: dictionaryData,
        };
        
        translationCache.current.set(trimmedText, newTranslationData);
        if (translationCache.current.size > 100) {
          const firstKey = translationCache.current.keys().next().value;
          if (firstKey) {
            translationCache.current.delete(firstKey);
          }
        }

        updateState({
          ...newTranslationData,
          isTranslating: false,
        });
      } else {
        throw new Error(response?.error || ERROR_MESSAGES.TRANSLATION_FAILED);
      }
    } catch (error) {
      console.error('번역 중 오류 발생:', error);
      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.TRANSLATION_SERVICE_UNAVAILABLE;
      const errorType = errorMessage.includes('확장 프로그램') ? 'context_invalidated' : 'default';
      
      updateState({
        translation: errorMessage,
        isTranslating: false,
        error: { message: errorMessage, type: errorType },
      });
    }
  }, [updateState]);

  const resetTranslation = useCallback(() => {
    updateState({
      selectedText: '',
      translation: '',
      isTranslating: false,
      isSaved: false,
      wordDetails: null,
      showTranslation: false,
      error: null,
    });
  }, [updateState]);

  const addToWordbook = useCallback(async (text: string, translatedText: string) => {
    if (!chrome.runtime?.id) {
      console.warn('Chrome runtime ID not available. Cannot save to wordbook.');
      return;
    }

    try {
      const response: SaveWordResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.SAVE_WORD,
          original: text,
          translated: translatedText
        }, (res) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve(res);
        });
      });

      if (response.success) {
        updateState({ isSaved: true });
        setTimeout(() => {
          window.getSelection()?.removeAllRanges();
          resetTranslation();
        }, UI_CONFIG.WORD_SAVE_SUCCESS_DURATION);
      } else {
        throw new Error(response.error || ERROR_MESSAGES.SAVE_WORD_FAILED);
      }
    } catch (error) {
      console.error('단어장 저장 중 오류 발생:', error);
      // Optionally, update state to show error message to user
    }
  }, [updateState, resetTranslation]);
  const setSelectedText = useCallback((text: string) => {
    updateState({ selectedText: text });
  }, [updateState]);

  return {
    ...state,
    translateText,
    addToWordbook,
    setSelectedText,
    resetTranslation
  };
};