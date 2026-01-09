import { fetchWithRetry } from '@/utils/retry';

type GoogleTranslateSentence = [
  string, 
  string, 
  ...unknown[]
];

type GoogleTranslateResponse = [
  GoogleTranslateSentence[],
  ...unknown[]
];


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

function isGoogleTranslateSentence(data: unknown): data is GoogleTranslateSentence {
  return (
    Array.isArray(data) &&
    data.length >= 2 &&
    typeof data[0] === 'string' &&
    typeof data[1] === 'string'
  );
}

function isGoogleTranslateResponse(data: unknown): data is GoogleTranslateResponse {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    Array.isArray(data[0]) &&
    data[0].every((item): item is GoogleTranslateSentence => 
      isGoogleTranslateSentence(item)
    )
  );
}
function isDictionaryEntry(data: unknown): data is DictionaryEntry {
  return (
    typeof data === 'object' &&
    data !== null &&
    (!('phonetic' in data) || typeof data.phonetic === 'string' || data.phonetic === undefined) &&
    (!('phonetics' in data) || Array.isArray(data.phonetics)) &&
    (!('meanings' in data) || Array.isArray(data.meanings))
  );
}

function isDictionaryData(data: unknown): data is DictionaryEntry[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isDictionaryEntry(data[0])
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

    if (rawData.trim().startsWith('<')) {
      console.error('API Error (HTML received):', rawData.substring(0, 100));
      throw new Error('번역 서비스가 일시적으로 제한되었습니다.');
    }

    let data: unknown;
    try {
      data = JSON.parse(rawData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('번역 서비스 응답 파싱에 실패했습니다.');
    }

    // [디버깅] API 응답 형태 상세 로깅
    if (isGoogleTranslateResponse(data)) {
      console.log('Google Translate API Response:', {
        isArray: true,
        length: data.length,
        firstElement: data[0],
        isValidResponse: true
      });
    } else {
      console.log('Google Translate API Response:', {
        isArray: Array.isArray(data),
        isValidResponse: false
      });
    }

    // [수정 3] 파싱 로직 변경
    if (isGoogleTranslateResponse(data)) {
      const translatedText = data[0]
        .map((item) => (Array.isArray(item) ? item[0] : ''))
        .filter(Boolean)
        .join('');

      console.log('Translation result:', {
        originalText: text,
        translatedText,
        isEmpty: !translatedText.trim()
      });

      if (!translatedText.trim()) {
        throw new Error('번역 결과가 비어있습니다.');
      }
      return translatedText;
    }

    console.warn('Unknown format:', data);
    throw new Error('잘못된 응답 형식입니다.');
  } catch (error) {
    console.error('번역 API 처리 중 오류 발생:', error);
    if (error instanceof Error) throw error;
    throw new Error('번역에 실패했습니다.');
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

    let data: unknown;
    try {
      data = JSON.parse(rawData);
    } catch (parseError) {
      console.error('Dictionary API JSON parse error:', parseError);
      return null;
    }

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