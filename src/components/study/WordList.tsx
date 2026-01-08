import { useEffect, useState } from 'react';
import type { Word } from '@/types';
import { Trash2, Volume2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const WordList = () => {
  const [words, setWords] = useState<Word[]>([]);

  useEffect(() => {
    const updateWords = () => {
      chrome.storage.local.get(['words'], (result) => {
        setWords((result.words as Word[]) || []);
      });
    };
    updateWords();

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.words) {
        updateWords();
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleDelete = async (id: string) => {
    const { words: currentWords = [] }: { words: Word[] } = await chrome.storage.local.get('words');
    const newWords = currentWords.filter(w => w.id !== id);
    await chrome.storage.local.set({ words: newWords });
  };

  const playAudio = (audioUrl?: string) => {
    if (audioUrl) {
      new Audio(audioUrl).play().catch(console.error);
    }
  };

  if (words.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        저장된 단어가 없습니다. 웹 페이지에서 텍스트를 선택하여 번역하고 저장해보세요!
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>내 단어장 ({words.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {words.map((word, index) => (
            <AccordionItem value={word.id} key={word.id} className={index === words.length - 1 ? 'border-b-0' : ''}>
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-semibold text-gray-900">{word.original}</h3>
                    <p className="text-gray-600 mt-1">{word.translated}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {word.audioUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); playAudio(word.audioUrl); }}
                        className="p-1 h-8 w-8"
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleDelete(word.id); }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-8 w-8"
                      title="단어 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3">
                  {word.phonetic && (
                    <p className="text-sm text-gray-500">[{word.phonetic}]</p>
                  )}
                  {word.meanings && word.meanings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">의미:</h4>
                      <div className="space-y-2 pl-4">
                        {word.meanings.map((meaning, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-gray-500 font-medium text-sm">{index + 1}.</span>
                            <span className="text-gray-700 text-sm">{meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {word.examples && word.examples.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">예문:</h4>
                      <div className="space-y-2">
                        {word.examples.map((example, index) => (
                          <div key={index} className="text-gray-600 italic text-sm bg-gray-50 p-3 rounded-lg border-l-4 border-blue-300">
                            "{example}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default WordList;