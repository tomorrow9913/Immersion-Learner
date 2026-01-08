import { translateText, getDictionaryData } from '@/services/ApiService';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-wordbook',
    title: 'Add to Wordbook',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'add-to-wordbook') {
    const selectedText = info.selectionText?.trim();
    
    if (!selectedText) {
      console.log('No text selected');
      return;
    }
    
    translateText(selectedText)
      .then(translatedText => {
        if (translatedText.trim().length > 0) {
          saveToWordbook(selectedText, translatedText);
        }
      })
      .catch(err => {
        console.error('Translation error:', err);
      });
  }
});

async function saveToWordbook(original: string, translated: string) {
  chrome.storage.local.get(['words'], async (result) => {
    const words = (result.words as any[]) || [];
    
    if (words.some((w: any) => w.original === original)) {
      console.log('Word already exists:', original);
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
    
    chrome.storage.local.set({ words: [...words, newWord] }, () => {
      console.log('Word saved successfully:', original);
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRANSLATE_REQUEST') {
    const { text, targetLang = 'ko' } = message;
    
    translateText(text, targetLang)
      .then(translatedText => {
        sendResponse({ success: true, translatedText });
      })
      .catch(err => {
        console.error('Translation API error:', err);
        sendResponse({ success: false, error: err.message });
      });
      
    return true; 
  }

  if (message.type === 'SAVE_WORD') {
     const { original, translated } = message;
     chrome.storage.local.get(['words'], async (result) => {
         const words = (result.words as any[]) || [];
         
         if (words.some((w: any) => w.original === original)) {
             sendResponse({ success: true, message: 'Already exists' });
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
         
         chrome.storage.local.set({ words: [...words, newWord] }, () => {
             sendResponse({ success: true });
         });
     });
     return true;
  }

  if (message.type === 'GET_WORD_DETAILS') {
     const { text } = message;
     
     getDictionaryData(text).then(dictionaryData => {
         if (dictionaryData) {
             sendResponse({ 
                 success: true, 
                 data: dictionaryData 
             });
         } else {
             sendResponse({ 
                 success: false, 
                 error: 'Word details not found' 
             });
         }
     }).catch(err => {
         console.error('Dictionary API error:', err);
         sendResponse({ 
             success: false, 
             error: 'Failed to get word details' 
         });
     });
     
     return true;
  }
});