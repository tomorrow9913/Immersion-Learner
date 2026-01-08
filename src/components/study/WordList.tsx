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
import { Card, CardTitle } from '@/components/ui/card';

const WordList = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [expandedWord, setExpandedWord] = useState<string>('');

  useEffect(() => {
    chrome.storage.local.get(['words'], (result) => {
      setWords((result.words as Word[]) || []);
    });
  }, []);

  const handleDelete = (id: string) => {
    const newWords = words.filter(w => w.id !== id);
    setWords(newWords);
    chrome.storage.local.set({ words: newWords });
  };

  const playAudio = (audioUrl?: string) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(console.error);
    }
  };

  if (words.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        No words saved yet. Select text on any web page to translate and save!
      </div>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      className="space-y-4"
      value={expandedWord}
      onValueChange={setExpandedWord}
    >
      {words.map(word => (
        <Card key={word.id} className="w-full">
          <AccordionItem value={word.id} className="border-none">
            <AccordionTrigger className="hover:no-underline p-6">
              <div className="flex items-start justify-between w-full">
                <div className="flex-1 text-left">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {word.original}
                  </CardTitle>
                  {word.phonetic && (
                    <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                      <span>[{word.phonetic}]</span>
                      {word.audioUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); playAudio(word.audioUrl); }}
                          className="ml-2 p-1 h-6 w-6"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      )}
                    </p>
                  )}
                  <p className="text-gray-600 mt-1">{word.translated}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleDelete(word.id); }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-6 w-6"
                  title="Delete word"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-4">
                {word.meanings.map((meaning, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="text-gray-500 font-medium min-w-[24px] text-sm">{index + 1}.</span>
                    <span className="text-gray-700 text-sm">{meaning}</span>
                  </div>
                ))}
                
                {word.examples && word.examples.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-600 mb-2">Examples:</h4>
                    <div className="space-y-2">
                      {word.examples.map((example, index) => (
                        <div key={index} className="text-gray-600 italic text-sm bg-gray-50 p-3 rounded border-l-4 border-blue-300">
                          "{example}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Card>
      ))}
    </Accordion>
  );
};

export default WordList;