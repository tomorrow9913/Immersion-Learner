import { translateText, getDictionaryData } from '@/services/ApiService';
import { MESSAGE_TYPES } from '@/config/constants';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-wordbook',
    title: '단어장에 추가',
    contexts: ['selection']
  });
});

let isSaving = false;
const saveQueue: (() => Promise<void>)[] = [];

async function processSaveQueue() {
  if (isSaving || saveQueue.length === 0) {
    return;
  }
  isSaving = true;
  const saveOperation = saveQueue.shift();
  try {
    await saveOperation?.();
  } catch (error) {
    console.error('Save operation failed:', error);
  } finally {
    isSaving = false;
    processSaveQueue();
  }
}

function enqueueSave(original: string, translated: string) {
  saveQueue.push(() => saveToWordbook(original, translated));
  processSaveQueue();
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'add-to-wordbook') {
    const selectedText = info.selectionText?.trim();
    if (!selectedText) return;

    try {
      const translatedText = await translateText(selectedText);
      if (translatedText.trim().length > 0) {
        enqueueSave(selectedText, translatedText);
      }
    } catch (err) {
      console.error('단어장 추가 중 번역 오류:', err);
    }
  }
});

async function saveToWordbook(original: string, translated: string) {
  const { words = [] }: { words: any[] } = await chrome.storage.local.get('words');
  if (words.some((w: any) => w.original === original)) {
    console.log('단어가 이미 존재합니다:', original);
    return;
  }

  const dictionaryData = await getDictionaryData(original);
  const newWord = {
    id: Date.now().toString(),
    original,
    translated,
    phonetic: dictionaryData?.phonetic,
    audioUrl: dictionaryData?.audioUrl,
    meanings: dictionaryData?.meanings || [translated],
    examples: dictionaryData?.examples,
    createdAt: Date.now(),
    nextReviewDate: Date.now(),
    stage: 0
  };

  const { words: currentWords = [] }: { words: any[] } = await chrome.storage.local.get('words');
  if (currentWords.some((w: any) => w.original === original)) {
    console.log('단어가 이미 존재합니다 (재확인):', original);
    return;
  }

  await chrome.storage.local.set({ words: [...currentWords, newWord] });
  console.log('단어 저장 성공:', original);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handleMessage = async () => {
    try {
      if (message.type === MESSAGE_TYPES.GET_TRANSLATION_AND_DETAILS) {
        const { text, targetLang = 'ko' } = message;
        const translatedText = await translateText(text, targetLang);
        const dictionaryData = await getDictionaryData(text);
        sendResponse({ success: true, translatedText, dictionaryData });
      } else if (message.type === MESSAGE_TYPES.SAVE_WORD) {
        const { original, translated } = message;
        enqueueSave(original, translated);
        sendResponse({ success: true });
      } else if (message.type === MESSAGE_TYPES.TRANSLATE_SENTENCE) {
        const { text, targetLang = 'ko' } = message;
        const translatedText = await translateText(text, targetLang);
        sendResponse({ success: true, translatedText });
      }
    } catch (error) {
      console.error('메시지 처리 중 오류 발생:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' });
    }
  };

  handleMessage();
  return true; // 비동기 응답을 위해 true 반환
});