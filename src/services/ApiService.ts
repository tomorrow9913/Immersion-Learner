import { fetchWithRetry } from '@/utils/retry';

export async function translateText(text: string, targetLang = 'ko') {
  if (!text || text.trim().length === 0) {
    throw new Error('Empty text provided');
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

    const data = await response.json();
    
    if (data && data[0] && Array.isArray(data[0])) {
      const translatedText = data[0].map((item: any) => item[0]).join('');
      if (translatedText.trim().length === 0) {
        throw new Error('Empty translation result');
      }
      return translatedText;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Retriable error')) {
        throw new Error('일시적인 번역 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
    throw new Error('Translation failed');
  }
}

export async function getDictionaryData(word: string) {
  try {
    const response = await fetchWithRetry(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      const firstEntry = data[0];
      const phonetic = firstEntry.phonetic || firstEntry.phonetics?.find((p: any) => p.text)?.text;
      const audioUrl = firstEntry.phonetics?.find((p: any) => p.audio)?.audio;
      
      const meanings: string[] = [];
      firstEntry.meanings?.forEach((meaning: any) => {
        meaning.definitions?.forEach((def: any) => {
          if (def.definition) {
            meanings.push(def.definition);
          }
        });
      });
      
      const examples: string[] = [];
      firstEntry.meanings?.forEach((meaning: any) => {
        meaning.definitions?.forEach((def: any) => {
          if (def.example) {
            examples.push(def.example);
          }
        });
      });
      
      return {
        phonetic,
        audioUrl,
        meanings: meanings.slice(0, 5),
        examples: examples.slice(0, 3)
      };
    }
  } catch (error) {
    console.error('Dictionary API error:', error);
  }
  return null;
}