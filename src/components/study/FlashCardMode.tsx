import { useEffect, useState, useCallback } from 'react';
import type { Word } from '@/types';
import { Button } from '@/components/ui/button';
import { Volume2, ArrowRight, RotateCcw } from 'lucide-react';
import { Logger } from '@/utils/logger';

const FlashCardMode = () => {
    const [words, setWords] = useState<Word[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [isRotating, setIsRotating] = useState(false); // Re-introduce isRotating
    
    const getCardData = (position: 'prev' | 'current' | 'next') => {
        if (words.length === 0) return null;
        
        let index;
        let translateX_val;
        let scale_val;
        let opacity_val;
        let zIndex_val;
        let rotateY_val;
        let rotateZ_val = 0; // New: for extra rotation

        switch (position) {
            case 'prev':
                index = currentIndex === 0 ? words.length - 1 : currentIndex - 1;
                translateX_val = -50;
                scale_val = 0.8;
                opacity_val = 0.6;
                zIndex_val = 10;
                rotateY_val = 20; // Increased rotation
                rotateZ_val = 5; // Slight tilt
                break;
            case 'current':
                index = currentIndex;
                translateX_val = 0;
                scale_val = 1;
                opacity_val = 1;
                zIndex_val = 20;
                rotateY_val = 0;
                break;
            case 'next':
                index = (currentIndex + 1) % words.length;
                translateX_val = 50;
                scale_val = 0.8;
                opacity_val = 0.6;
                zIndex_val = 5;
                rotateY_val = -20; // Increased rotation
                rotateZ_val = -5; // Slight tilt
                break;
        }
        
        return {
            word: words[index],
            index,
            isCenter: position === 'current',
            zIndex: zIndex_val,
            scale: scale_val,
            opacity: opacity_val,
            translateX: translateX_val,
            translateY: 0, 
            rotateY: rotateY_val,
            rotateZ: rotateZ_val, // Return rotateZ
        };
    };

    const playAudio = useCallback((audioUrl?: string) => {
        if (audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play().catch(Logger.warn);
        }
    }, []);

    useEffect(() => {
        chrome.storage.local.get(['words'], (result) => {
            const allWords = (result.words as Word[]) || [];
            setWords(allWords.sort(() => Math.random() - 0.5));
        });
    }, []);

    const handleNext = useCallback(() => {
        setFlipped(false);
        setIsRotating(true); // Set to true at start
        setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
            setIsRotating(false); // Set to false after animation
        }, 600); // Animation duration
    }, [words.length]);

    const handlePrev = useCallback(() => {
        setFlipped(false);
        setIsRotating(true); // Set to true at start
        setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex === 0 ? words.length - 1 : prevIndex - 1));
            setIsRotating(false); // Set to false after animation
        }, 600); // Animation duration
    }, [words.length]);

    const handleCardClick = useCallback((position: 'prev' | 'current' | 'next') => {
        if (position === 'current') {
            if (!isRotating) { // Only allow flip if not rotating
                setFlipped(!flipped);
            }
        } else if (!isRotating) { // Only allow navigation if not rotating
            setFlipped(false);
            setIsRotating(true);
            setTimeout(() => {
                if (position === 'prev') {
                    setCurrentIndex((prevIndex) => (prevIndex === 0 ? words.length - 1 : prevIndex - 1));
                } else {
                    setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
                }
                setIsRotating(false);
            }, 600);
        }
    }, [isRotating, words.length]);

    const handleShuffle = useCallback(() => {
        setFlipped(false);
        setIsRotating(true); // Set to true at start
        setTimeout(() => {
            setCurrentIndex(Math.floor(Math.random() * words.length));
            setIsRotating(false); // Set to false after animation
        }, 600); // Animation duration
    }, [words.length]);


    if (words.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-10">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <div className="text-2xl">📚</div>
                    </div>
                    <p className="text-gray-500 text-lg">No words saved yet. Go browse and save some words!</p>
                </div>
            </div>
        );
    }

    // No currentWord needed here since we are mapping over prev, current, next
    // The previous currentWord was: const currentWord = words[currentIndex]; 

    return (
        <div className="flex flex-col items-center justify-center py-10 px-4 min-h-screen">
            <div className="relative w-full max-w-6xl h-80 md:h-96 flex items-center justify-center" style={{ perspective: '1000px' }}>
                {['prev', 'current', 'next'].map((position) => {
                    const cardData = getCardData(position as 'prev' | 'current' | 'next');
                    if (!cardData || !cardData.word) return null; // Ensure word data exists
                    
                    const isCurrentCard = cardData.isCenter;
                    
                    return (
                        <div
                            key={cardData.word.id || position} // Use word.id for key if available, otherwise position
                            className={`absolute w-full max-w-md h-full cursor-pointer transition-all duration-600 ease-in-out ${
                                isCurrentCard && isRotating ? 'pointer-events-none' : isCurrentCard ? 'group' : ''
                            }`}
                            style={{
                                transform: `translateX(${cardData.translateX}%) translateY(${cardData.translateY}px) scale(${cardData.scale}) rotateY(${cardData.rotateY}deg) rotateZ(${cardData.rotateZ}deg)`,
                                zIndex: cardData.zIndex,
                                opacity: cardData.opacity,
                            }}
                            onClick={() => handleCardClick(position as 'prev' | 'current' | 'next')}
                        >
                            <div 
                                className={`relative w-full h-full transition-all duration-700 ease-in-out transform-gpu`}
                                style={{ 
                                    transformStyle: 'preserve-3d', 
                                    transform: isCurrentCard
                                            ? (flipped ? 'rotateY(180deg)' : 'rotateY(0deg)')
                                            : 'rotateY(0deg)'
                                }}
                            >
                                {/* Front of card */}
                                <div 
                                    className={`absolute w-full h-full bg-white rounded-xl flex items-center justify-center flex-col p-6 border-2 transition-all duration-300 ${
                                        (flipped && isCurrentCard) ? 'border-gray-200 opacity-0' : 
                                        isCurrentCard ? 'border-blue-500 shadow-xl' : 'border-gray-300 shadow-lg'
                                    }`}
                                    style={{ 
                                        backfaceVisibility: 'hidden',
                                        transform: 'rotateY(0deg)'
                                    }}
                                >
                                    <div className="text-sm text-gray-400 uppercase tracking-widest mb-3 font-bold">
                                        {isCurrentCard ? 'MEMORY CARD' : 'PREVIEW'}
                                    </div>
                                    <div className={`break-words w-full text-center ${
                                        isCurrentCard ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'
                                    } font-bold text-gray-800`}>{cardData.word.original}</div>
                                    {cardData.word.phonetic && (
                                        <div className="flex items-center gap-3 mt-3 text-gray-600">
                                            <span className="text-lg text-gray-500">[{cardData.word.phonetic}]</span>
                                            {cardData.word.audioUrl && isCurrentCard && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => { e.stopPropagation(); playAudio(cardData.word.audioUrl); }}
                                                    className="p-2 h-8 w-8 bg-blue-50 hover:bg-blue-100"
                                                >
                                                    <Volume2 className="h-5 w-5 text-blue-600" />
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                </div>
                                
                                {isCurrentCard && (
                                    <div 
                                        className={`absolute w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-col p-6 text-white transition-all duration-300 ${
                                            !flipped ? 'border-gray-200 opacity-0' : 'border-blue-500 shadow-xl'
                                        }`}
                                        style={{ 
                                            backfaceVisibility: 'hidden',
                                            transform: 'rotateY(180deg)'
                                        }}
                                    >
                                        <div className="text-sm text-blue-100 uppercase tracking-widest mb-3 font-bold">MEMORIZING</div>
                                        <div className="text-lg md:text-xl font-bold mb-4 break-words w-full text-center">{cardData.word.translated}</div>
                                        
                                        {cardData.word.meanings && cardData.word.meanings.length > 0 && (
                                            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 max-h-24 overflow-y-auto">
                                                <div className="text-xs text-blue-100 mb-2 font-medium">Additional meanings:</div>
                                                <div className="space-y-1">
                                                    {cardData.word.meanings.slice(0, 2).map((meaning, index) => (
                                                        <div key={index} className="text-sm text-white flex items-start gap-2">
                                                            <span className="text-blue-200 min-w-[20px]">{index + 1}.</span>
                                                            <span>{meaning}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex gap-4 w-full max-w-lg">
                <Button 
                    variant="outline"
                    onClick={handlePrev} 
                    className="flex-1"
                    disabled={isRotating} // Disable during rotation
                >
                    <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                    Prev
                </Button>
                <Button 
                    variant="outline"
                    onClick={handleNext} 
                    className="flex-1"
                    disabled={isRotating} // Disable during rotation
                >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Skip
                </Button>
                <Button 
                    variant="secondary"
                    onClick={handleShuffle}
                    className="flex-1"
                    disabled={isRotating} // Disable during rotation
                >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Shuffle
                </Button>
            </div>
            
            {/* Progress */}
            <div className="mt-4 text-center">
                <div className="text-gray-500 text-sm">
                    Card {currentIndex + 1} of {words.length}
                </div>
            </div>
        </div>
    );
};

export default FlashCardMode;