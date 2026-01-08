// Create context menu for PDF viewer
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
    
    // Translate the selected text first
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(selectedText)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        if (data && data[0] && Array.isArray(data[0])) {
          const translatedText = data[0].map((item: any) => item[0]).join('');
          if (translatedText.trim().length > 0) {
            // Save to wordbook
            saveToWordbook(selectedText, translatedText);
          }
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.error('Translation error:', err);
      });
  }
});

async function getDictionaryData(word: string) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
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
    
    if (!text || text.trim().length === 0) {
      sendResponse({ success: false, error: 'Empty text provided' });
      return true;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        if (data && data[0] && Array.isArray(data[0])) {
            const translatedText = data[0].map((item: any) => item[0]).join('');
            if (translatedText.trim().length === 0) {
              sendResponse({ success: false, error: 'Empty translation result' });
            } else {
              sendResponse({ success: true, translatedText });
            }
        } else {
            console.error('Invalid API response:', data);
            sendResponse({ success: false, error: 'Invalid response format' });
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.error('Translation API error:', err);
        
        let errorMessage = 'Translation failed';
        if (err.name === 'AbortError') {
          errorMessage = 'Request timeout';
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        sendResponse({ success: false, error: errorMessage });
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
