import { useState, useCallback, useRef } from 'react';
import type { GoogleTranslationResponse, DictionaryAPIResponse, DictionaryEntry } from '@/types';
import { API_ENDPOINTS, UI_CONFIG, MESSAGE_TYPES } from '@/config/constants';

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

// 메인 훅 - 통합 API 제공
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(
        `${API_ENDPOINTS.GOOGLE_TRANSLATE}?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(text)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as GoogleTranslationResponse;
      
      if (data && data[0] && Array.isArray(data[0])) {
        const translatedText = data[0].map((item) => item[0]).join('');
        if (translatedText.trim().length > 0) {
          translationCache.current.set(text, translatedText);
          if (translationCache.current.size > 100) {
            const firstKey = translationCache.current.keys().next().value;
            if (firstKey) {
              translationCache.current.delete(firstKey);
            }
          }
          
          updateState({
            translation: translatedText,
            showTranslation: true
          });
        } else {
          updateState({
            translation: '번역 결과가 없습니다.',
            showTranslation: true
          });
        }
      } else {
        updateState({
          translation: '번역에 실패했습니다.',
          showTranslation: true
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        updateState({
          translation: '번역 시간이 초과되었습니다.',
          showTranslation: true
        });
      } else {
        console.error('Translation error:', error);
        updateState({
          translation: '번역 서비스를 사용할 수 없습니다.',
          showTranslation: true
        });
      }
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

  const lookupWord = useCallback(async (word: string): Promise<void> => {
    try {
      const dictResponse = await fetch(`${API_ENDPOINTS.DICTIONARY_API}/${encodeURIComponent(word)}`);
      if (dictResponse.ok) {
        const dictData = await dictResponse.json() as DictionaryAPIResponse;
        if (Array.isArray(dictData) && dictData.length > 0) {
          const firstEntry = dictData[0] as DictionaryEntry;
          const phonetic = firstEntry.phonetic || firstEntry.phonetics?.find((p) => p.text)?.text;
          const audioUrl = firstEntry.phonetics?.find((p) => p.audio)?.audio;
          
          const meanings: string[] = [];
          firstEntry.meanings?.forEach((meaning) => {
            meaning.definitions?.forEach((def) => {
              if (def.definition) {
                meanings.push(def.definition);
              }
            });
          });
          
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.DICTIONARY_DATA,
            data: {
              phonetic,
              audioUrl,
              meanings: meanings.slice(0, 3)
            }
          });
        }
      }
    } catch (err) {
      console.error('Dictionary API error:', err);
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.DICTIONARY_ERROR,
        error: err instanceof Error ? err.message : '사전 검색 오류'
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
    // State Getters
    selectedText: state.selectedText,
    translation: state.translation,
    isTranslating: state.isTranslating,
    isSaved: state.isSaved,
    wordDetails: state.wordDetails,
    showTranslation: state.showTranslation,
    
    // Actions
    translateText,
    lookupWord,
    addToWordbook,
    setSelectedText,
    resetTranslation
  };
};
