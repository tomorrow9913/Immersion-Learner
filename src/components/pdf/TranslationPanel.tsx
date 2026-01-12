import React, { useRef } from 'react';
import { PanelRight } from 'lucide-react';
import type { HydratedSentence } from '@/types';

interface TranslationPanelProps {
    isTranslating: boolean;
    error: string | null;
    sentences: HydratedSentence[];
    hoveredIndex: number | null;
    onTranslatedSentenceHover: (id: number | null) => void;
    toggleTranslationPanel: () => void;
    translationContainerRef: React.RefObject<HTMLDivElement | null>;
}

const TranslationPanel: React.FC<TranslationPanelProps> = ({
    isTranslating,
    error,
    sentences,
    hoveredIndex,
    onTranslatedSentenceHover,
    toggleTranslationPanel,
    translationContainerRef
}) => {
    const sentenceRefs = useRef<(HTMLDivElement | null)[]>([]);

    const handleSentenceHover = (id: number | null) => {
        onTranslatedSentenceHover(id);
        if (id !== null && sentenceRefs.current[id]) {
            sentenceRefs.current[id]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    };

    return (
        <div className="min-w-0 flex flex-col h-full">
            <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-gray-800 text-sm">번역</h3>
                <div className="flex items-center space-x-2">
                    {isTranslating && (
                        <div className="flex items-center text-xs text-blue-600">
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                            번역 중...
                        </div>
                    )}
                    <div className="text-xs text-gray-600">
                        {sentences.length} 문장
                    </div>
                    <button
                        onClick={toggleTranslationPanel}
                        className="p-1 rounded hover:bg-gray-200"
                        title="번역 패널 닫기"
                    >
                        <PanelRight size={16} />
                    </button>
                </div>
            </div>
            <div ref={translationContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {isTranslating && sentences.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="flex flex-col items-center text-gray-500">
                            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                            <p className="text-sm">페이지 번역 중...</p>
                        </div>
                    </div>
                ) : sentences.length === 0 && !error ? (
                    <div className="text-gray-500 text-sm text-center py-8">
                        번역된 문장이 없습니다
                    </div>
                ) : (
                    sentences.map((sentence) => (
                        <div
                            key={sentence.id}
                            ref={(el) => {
                                if (sentence && sentence.id !== undefined) {
                                    sentenceRefs.current[sentence.id] = el;
                                }
                            }}
                            className={`border-b border-gray-100 pb-3 last:border-b-0 transition-colors ${hoveredIndex === sentence.id ? 'bg-blue-50 outline outline-1 outline-blue-900 rounded-md' : ''}`}
                            onMouseEnter={() => handleSentenceHover(sentence.id)}
                            onMouseLeave={() => handleSentenceHover(null)}
                        >
                            <div className="space-y-2">
                                <p className="text-sm text-gray-800 leading-relaxed">
                                    {sentence.sourceText}
                                </p>
                                {sentence.translatedText ? (
                                    <p className="text-sm text-blue-700 leading-relaxed bg-blue-50 p-2 rounded">
                                        {sentence.translatedText}
                                    </p>
                                ) : (
                                    <div className="flex items-center py-2">
                                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                        <span className="text-sm text-gray-600">번역 중...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TranslationPanel;
