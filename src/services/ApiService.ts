import { fetchWithRetry } from '@/utils/retry';
import { API_ENDPOINTS, ERROR_MESSAGES, NETWORK_CONFIG } from '@/config/constants';
import { Logger } from '@/utils/logger';

// Type definitions for Google Translate API response
type GoogleTranslateSentence = [string, string, ...unknown[]];
type GoogleTranslateResponse = [GoogleTranslateSentence[], ...unknown[]];

// Type definitions for Dictionary API response
interface DictionaryEntry {
    phonetic?: string;
    phonetics?: Array<{ text?: string; audio?: string }>;
    meanings?: Array<{ definitions?: Array<{ definition?: string; example?: string }> }>;
}
interface DictionaryResult {
    phonetic?: string;
    audioUrl?: string;
    meanings: string[];
    examples: string[];
}

// --- Type Guards ---

function isGoogleTranslateSentence(data: unknown): data is GoogleTranslateSentence {
    return Array.isArray(data) && data.length >= 2 && typeof data[0] === 'string' && typeof data[1] === 'string';
}

function isGoogleTranslateResponse(data: unknown): data is GoogleTranslateResponse {
    return Array.isArray(data) && data.length > 0 && Array.isArray(data[0]);
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
    return Array.isArray(data) && data.length > 0 && isDictionaryEntry(data[0]);
}

// --- Parsers ---

/**
 * Parses the raw response from the Google Translate API.
 * This function implements a more robust parsing strategy to avoid crashes
 * if the unofficial API's response structure changes.
 * @param data - The raw data from the API, expected to be a JSON-parsable string.
 * @returns The translated text as a single string.
 * @throws {Error} If parsing fails or the data format is invalid.
 */
function parseGoogleTranslateResponse(data: unknown): string {
    if (!isGoogleTranslateResponse(data)) {
        Logger.warn('Invalid top-level structure in translation response:', data);
        throw new Error(ERROR_MESSAGES.INVALID_RESPONSE_FORMAT);
    }

    const sentences = data[0];
    if (!Array.isArray(sentences)) {
        Logger.warn('Expected an array of sentences, but got:', sentences);
        throw new Error(ERROR_MESSAGES.INVALID_RESPONSE_FORMAT);
    }

    try {
        const translatedText = sentences
            .map((item, index) => {
                if (!isGoogleTranslateSentence(item)) {
                    Logger.warn(`Invalid sentence structure at index ${index}:`, item);
                    return ''; // Skip invalid items
                }
                return item[0];
            })
            .filter(Boolean)
            .join('');

        if (!translatedText.trim()) {
            Logger.warn('Parsing resulted in an empty string.', { originalData: data });
            throw new Error(ERROR_MESSAGES.TRANSLATION_EMPTY_RESULT);
        }

        return translatedText;
    } catch (e) {
        Logger.error('An unexpected error occurred during parsing: ' + (e instanceof Error ? e.message : String(e)) + ' Original Data: ' + JSON.stringify(data));
        throw new Error(ERROR_MESSAGES.TRANSLATION_RESPONSE_PARSE_FAILED);
    }
}


// --- API Service Functions ---

export async function translateText(text: string, targetLang = 'ko'): Promise<string> {
    if (!text || text.trim().length === 0) {
        throw new Error(ERROR_MESSAGES.EMPTY_TEXT_TO_TRANSLATE);
    }

    try {
        const response = await fetchWithRetry(
            `${API_ENDPOINTS.GOOGLE_TRANSLATE}?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
            { headers: { 'User-Agent': NETWORK_CONFIG.USER_AGENT } }
        );

        const rawData = await response.text();

        // Handle non-JSON responses (e.g., HTML error pages from Google)
        if (rawData.trim().startsWith('<')) {
            Logger.warn('API returned HTML, not JSON:', rawData.substring(0, 200));
            throw new Error(ERROR_MESSAGES.TRANSLATION_SERVICE_TEMPORARILY_UNAVAILABLE);
        }

        let data: unknown;
        try {
            data = JSON.parse(rawData);
        } catch (parseError) {
            Logger.error('Failed to parse JSON from translation API: ' + (parseError instanceof Error ? parseError.message : String(parseError)) + ' Raw Data: ' + rawData);
            throw new Error(ERROR_MESSAGES.TRANSLATION_RESPONSE_PARSE_FAILED);
        }

        const translatedText = parseGoogleTranslateResponse(data);

        Logger.debug('Translation successful:', {
            originalText: text,
            translatedText,
        });

        return translatedText;

    } catch (error) {
        Logger.warn('Error during translation API call:', error);
        if (error instanceof Error) throw error; // Re-throw known errors
        throw new Error(ERROR_MESSAGES.TRANSLATION_FAILED); // General fallback
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