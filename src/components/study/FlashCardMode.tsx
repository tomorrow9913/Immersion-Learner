import { useEffect, useState } from 'react';
import type { Word } from '@/types';
import { Button } from '@/components/ui/button';
import { Volume2, ArrowRight, RotateCcw } from 'lucide-react';

const FlashCardMode = () => {
    const [words, setWords] = useState<Word[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    
    
    
    const [isRotating, setIsRotating] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState<'next' | 'prev' | null>(null);

    const getCardData = (position: 'prev' | 'current' | 'next') => {
        if (words.length === 0) return null;
        
        let index;
        switch (position) {
            case 'prev':
                index = currentIndex === 0 ? words.length - 1 : currentIndex - 1;
                break;
            case 'current':
                index = currentIndex;
                break;
            case 'next':
                index = (currentIndex + 1) % words.length;
                break;
        }

        const isCurrentCardAnimatingOut = isAnimatingOut && position === 'current';
        
        return {
            word: words[index],
            index,
            isCenter: position === 'current',
            zIndex: position === 'current' ? 20 : position === 'prev' ? 10 : 5,
            scale: isCurrentCardAnimatingOut ? 1.1 : (position === 'current' ? 1 : 0.9),
            opacity: isCurrentCardAnimatingOut ? 0 : (position === 'current' ? 1 : 0.8),
            translateX: isCurrentCardAnimatingOut 
                ? (isAnimatingOut === 'next' ? 100 : -100)
                : (position === 'current' ? 0 : position === 'prev' ? -40 : 40),
            translateY: isCurrentCardAnimatingOut ? -50 : (position === 'current' ? 0 : 15),
            rotateY: position === 'current' ? 0 : position === 'prev' ? 10 : -10,
            rotateZ: isCurrentCardAnimatingOut ? (isAnimatingOut === 'next' ? 15 : -15) : 0,
        };
    };

    const playAudio = (audioUrl?: string) => {
        if (audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play().catch(console.error);
        }
    };

    useEffect(() => {
        chrome.storage.local.get(['words'], (result) => {
            const allWords = (result.words as Word[]) || [];
            setWords(allWords.sort(() => Math.random() - 0.5));
        });
    }, []);

    const handleNext = () => {
        setFlipped(false);
        setIsAnimatingOut('next');
        setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
            setIsAnimatingOut(null);
        }, 600);
    };

    const handlePrev = () => {
        setFlipped(false);
        setIsAnimatingOut('prev');
        setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex === 0 ? words.length - 1 : prevIndex - 1));
            setIsAnimatingOut(null);
        }, 600);
    };

    const handleCardClick = (position: 'prev' | 'current' | 'next') => {
        if (position === 'current') {
            if (!isRotating) {
                setFlipped(!flipped);
            }
        } else if (!isRotating) {
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
    };

    

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

    

    return (
        <div className="flex flex-col items-center justify-center py-10 px-4 min-h-screen">
            

            <div className="relative w-full max-w-6xl h-80 md:h-96 flex items-center justify-center" style={{ perspective: '1000px' }}>
                {['prev', 'current', 'next'].map((position) => {
                    const cardData = getCardData(position as 'prev' | 'current' | 'next');
                    if (!cardData) return null;
                    
                    const isCurrentCard = cardData.isCenter;
                    
                    return (
                        <div
                            key={position}
                            className={`absolute w-full max-w-md h-80 md:h-96 cursor-pointer ${
                                isCurrentCard && isRotating ? 'pointer-events-none' : isCurrentCard ? 'group' : ''
                            }`}
                            style={{
                                transform: `translateX(${cardData.translateX}%) translateY(${cardData.translateY}px) scale(${cardData.scale}) rotateY(${cardData.rotateY}deg) rotate(${cardData.rotateZ}deg)`,
                                zIndex: cardData.zIndex,
                                opacity: cardData.opacity,
                                transition: 'all 0.6s ease-in-out',
                            }}
                            onClick={() => handleCardClick(position as 'prev' | 'current' | 'next')}
                        >
                            <div 
                                className={`relative w-full h-full transition-all duration-700 ease-in-out transform-gpu ${
                                    ''
                                }`}
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
                    onClick={(e) => { e.stopPropagation(); handlePrev(); }} 
                    className="flex-1"
                >
                    <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                    Prev
                </Button>
                <Button 
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); handleNext(); }} 
                    className="flex-1"
                >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Skip
                </Button>
                <Button 
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); 
                        setCurrentIndex(() => Math.floor(Math.random() * words.length));
                    }}
                    className="flex-1"
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