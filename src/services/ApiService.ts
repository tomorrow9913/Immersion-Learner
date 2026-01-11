import { fetchWithRetry } from '@/utils/retry';
import { API_ENDPOINTS, ERROR_MESSAGES, NETWORK_CONFIG } from '@/config/constants';
import { Logger } from '@/utils/logger';

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
    throw new Error(ERROR_MESSAGES.EMPTY_TEXT_TO_TRANSLATE);
  }

  try {
    const response = await fetchWithRetry(
      `${API_ENDPOINTS.GOOGLE_TRANSLATE}?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
      {
        headers: {
          'User-Agent': NETWORK_CONFIG.USER_AGENT
        }
      }
    );

    const rawData = await response.text();

    if (rawData.trim().startsWith('<')) {
      Logger.warn('API Error (HTML received):', rawData.substring(0, 100));
      throw new Error(ERROR_MESSAGES.TRANSLATION_SERVICE_TEMPORARILY_UNAVAILABLE);
    }

    let data: unknown;
    try {
      data = JSON.parse(rawData);
    } catch (parseError) {
      Logger.warn('JSON parse error:', parseError);
      throw new Error(ERROR_MESSAGES.TRANSLATION_RESPONSE_PARSE_FAILED);
    }

    // [수정 3] 파싱 로직 변경
    if (isGoogleTranslateResponse(data)) {
      const translatedText = data[0]
        .map((item) => (Array.isArray(item) ? item[0] : ''))
        .filter(Boolean)
        .join('');

      Logger.debug('Translation result:', {
        originalText: text,
        translatedText,
        isEmpty: !translatedText.trim()
      });

      if (!translatedText.trim()) {
        throw new Error(ERROR_MESSAGES.TRANSLATION_EMPTY_RESULT);
      }
      return translatedText;
    }

    Logger.warn('Unknown format:', data);
    throw new Error(ERROR_MESSAGES.INVALID_RESPONSE_FORMAT);
  } catch (error) {
    Logger.warn('번역 API 처리 중 오류 발생:', error);
    if (error instanceof Error) throw error;
    throw new Error(ERROR_MESSAGES.TRANSLATION_FAILED);
  }
}

export async function getDictionaryData(word: string): Promise<DictionaryResult | null> {
  if (!word || word.trim().length === 0) {
    return null;
  }

  try {
    const response = await fetchWithRetry(
      `${API_ENDPOINTS.DICTIONARY_API}/${encodeURIComponent(word)}`
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
      Logger.warn('Dictionary API JSON parse error:', parseError);
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
    Logger.warn('사전 API 처리 중 오류 발생:', error);
  }
  return null;
}