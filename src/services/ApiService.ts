import { fetchWithRetry } from '@/utils/retry';

type GoogleTranslateResponse = Array<Array<[string, string, ...any[]]>>;

interface DictionaryEntry {
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings?: Array<{
    definitions?: Array<{
      definition?: string;
      example?: string;
    }>;
  }>;
}

interface DictionaryResult {
  phonetic?: string;
  audioUrl?: string;
  meanings: string[];
  examples: string[];
}

function isGoogleTranslateResponse(data: any): data is GoogleTranslateResponse {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    Array.isArray(data[0]) &&
    data[0].length > 0 &&
    typeof data[0][0] === 'string'
  );
}

function isDictionaryData(data: any): data is DictionaryEntry[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof data[0] === 'object' &&
    data[0] !== null
  );
}

export async function translateText(text: string, targetLang = 'ko'): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error('번역할 텍스트가 비어있습니다.');
  }

  try {
    const response = await fetchWithRetry(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    const rawData = await response.text();
    const data = JSON.parse(rawData);
    
    if (isGoogleTranslateResponse(data)) {
      const translatedText = data[0].map((item: any) => item[0]).join('');
      if (translatedText.trim().length === 0) {
        throw new Error('번역 결과가 비어있습니다.');
      }
      return translatedText;
    }
    
    throw new Error('잘못된 응답 형식입니다.');
  } catch (error) {
    console.error('번역 API 처리 중 오류 발생:', error);
    if (error instanceof Error && error.message.includes('Retriable error')) {
      throw new Error('일시적인 번역 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
    throw new Error('번역에 실패했습니다. 네트워크 연결을 확인하거나 나중에 다시 시도해주세요.');
  }
}

export async function getDictionaryData(word: string): Promise<DictionaryResult | null> {
  if (!word || word.trim().length === 0) {
    return null;
  }
  
  try {
    const response = await fetchWithRetry(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    
    if (!response.ok) {
      return null;
    }
    
    const rawData = await response.text();
    if (!rawData) {
      return null;
    }
    
    const data = JSON.parse(rawData);
    
    if (isDictionaryData(data) && data.length > 0) {
      const firstEntry = data[0];
      const phonetic = firstEntry.phonetic || firstEntry.phonetics?.find((p) => p.text)?.text;
      const audioUrl = firstEntry.phonetics?.find((p) => p.audio)?.audio;
      
      const meanings = firstEntry.meanings?.flatMap((meaning) => 
        meaning.definitions?.map((def) => def.definition).filter((def): def is string => Boolean(def)) || []
      ) || [];
      
      const examples = firstEntry.meanings?.flatMap((meaning) => 
        meaning.definitions?.map((def) => def.example).filter((example): example is string => Boolean(example)) || []
      ) || [];
      
      return {
        phonetic,
        audioUrl,
        meanings: meanings.slice(0, 5),
        examples: examples.slice(0, 3)
      };
    }
  } catch (error) {
    console.error('사전 API 처리 중 오류 발생:', error);
  }
  return null;
}