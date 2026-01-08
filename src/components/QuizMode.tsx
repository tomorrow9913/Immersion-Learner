import { useEffect, useState } from 'react';
import type { Word } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

type QuizDirection = 'EN_TO_KO' | 'KO_TO_EN';

const QuizMode = () => {
    const [words, setWords] = useState<Word[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<{ word: Word, options: string[], question: string, correctAnswer: string } | null>(null);
    const [score, setScore] = useState(0);
    const [total, setTotal] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [quizDirection, setQuizDirection] = useState<QuizDirection>('EN_TO_KO');
    const [isQuizComplete, setIsQuizComplete] = useState(false);
    const [questionCount, setQuestionCount] = useState(-1);
    const [isQuizSetup, setIsQuizSetup] = useState(true);

    useEffect(() => {
        chrome.storage.local.get(['words'], (result) => {
          const allWords = (result.words as Word[]) || [];
          setWords(allWords);
          setTotal(0); // Reset total when starting new quiz
          setIsQuizComplete(false); // Reset quiz completion
          generateQuestion(allWords, 0);
        });
    }, [quizDirection]);

    const generateQuestion = (wordList: Word[], currentTotal?: number) => {
        if (wordList.length < 4) return; // Need at least 4 words
        
        // Check if quiz should end
const effectiveQuestionCount = questionCount === -1 ? wordList.length : questionCount;
        const totalToCheck = currentTotal !== undefined ? currentTotal : total;
        if (totalToCheck >= effectiveQuestionCount) {
            setIsQuizComplete(true);
            return;
        }
        
        const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
        
        let question: string;
        let correct: string;
        let distractors: string[];
        
        if (quizDirection === 'EN_TO_KO') {
            question = randomWord.original;
            correct = randomWord.translated;
            distractors = wordList.filter(w => w.id !== randomWord.id).sort(() => Math.random() - 0.5).slice(0, 3).map(w => w.translated);
        } else {
            question = randomWord.translated;
            correct = randomWord.original;
            distractors = wordList.filter(w => w.id !== randomWord.id).sort(() => Math.random() - 0.5).slice(0, 3).map(w => w.original);
        }
        
        const options = [...distractors, correct].sort(() => Math.random() - 0.5);
        
        setCurrentQuestion({ word: randomWord, options, question, correctAnswer: correct });
        setSelectedOption(null);
    };

    const updateWordMemoryLevel = (wordId: string, isCorrect: boolean) => {
        chrome.storage.local.get(['words'], (result) => {
            const allWords = (result.words as Word[]) || [];
            const wordIndex = allWords.findIndex(w => w.id === wordId);
            
            if (wordIndex !== -1) {
                if (isCorrect) {
                    allWords[wordIndex].stage = Math.min(allWords[wordIndex].stage + 1, 3);
                    allWords[wordIndex].nextReviewDate = Date.now() + (Math.pow(2, allWords[wordIndex].stage) * 24 * 60 * 60 * 1000);
                } else {
                    allWords[wordIndex].stage = Math.max(allWords[wordIndex].stage - 1, 0);
                    allWords[wordIndex].nextReviewDate = Date.now() + (15 * 60 * 1000);
                }
                
                chrome.storage.local.set({ words: allWords });
            }
        });
    };

    const handleAnswer = (option: string) => {
        if (selectedOption) return; // Already answered
        setSelectedOption(option);
        
        const isCorrect = option === currentQuestion?.correctAnswer;
        if (isCorrect) {
            setScore(prev => prev + 1);
        }
        
        if (currentQuestion) {
            updateWordMemoryLevel(currentQuestion.word.id, isCorrect);
        }
        
        setTimeout(() => {
            const currentTotal = total + 1;
            setTotal(prev => prev + 1);
            generateQuestion(words, currentTotal);
        }, 1500);
    };

    if (isQuizSetup) {
        return (
            <div className="flex flex-col items-center justify-center py-10">
                <Card className="max-w-md mx-auto bg-white">
                    <CardContent className="p-10 text-center">
                        <Trophy className="h-16 w-16 mx-auto text-blue-500 mb-6" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">퀴즈 설정</h2>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="text-lg font-medium text-gray-700 mb-3 block">
                                    문제 수 선택
                                </label>
                                <div className="flex items-center justify-center gap-4">
                                    <Button
                                        onClick={() => setQuestionCount(-1)}
                                        variant={questionCount === -1 ? 'default' : 'outline'}
                                        className="min-w-[100px]"
                                    >
                                        전체 ({words.length}개)
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={() => setQuestionCount(Math.max(5, questionCount - 10))}
                                            variant="outline"
                                            size="sm"
                                            disabled={questionCount === -1}
                                        >
                                            -10
                                        </Button>
                                        <div className="min-w-[80px] text-center font-bold text-lg">
                                            {questionCount === -1 ? '전체' : questionCount}
                                        </div>
                                        <Button
                                            onClick={() => setQuestionCount(Math.min(words.length, questionCount + 10))}
                                            variant="outline"
                                            size="sm"
                                            disabled={questionCount === -1}
                                        >
                                            +10
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => {
                                        setQuestionCount(10);
                                    }}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    10개
                                </Button>
                                <Button
                                    onClick={() => {
                                        setQuestionCount(20);
                                    }}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    20개
                                </Button>
                                <Button
                                    onClick={() => {
                                        setQuestionCount(30);
                                    }}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    30개
                                </Button>
                            </div>
                            
                            <Button
                                onClick={() => {
                                    setIsQuizSetup(false);
                                    setScore(0);
                                    setTotal(0);
                                    setIsQuizComplete(false);
                                    generateQuestion(words, 0);
                                }}
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
                                size="lg"
                            >
                                퀴즈 시작! 🚀
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (words.length < 4) {
         return (
           <Card className="max-w-md mx-auto mt-10 bg-white">
             <CardContent className="p-10 text-center">
               <Trophy className="h-12 w-12 mx-auto text-gray-300 mb-4" />
               <p className="text-gray-500">Need at least 4 saved words to start a quiz!</p>
             </CardContent>
           </Card>
         );
    }

    if (isQuizComplete) {
        return (
            <div className="flex flex-col items-center justify-center py-10">
                <Card className="max-w-md mx-auto bg-white">
                    <CardContent className="p-10 text-center">
                        <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-6" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">퀴즈 완료!</h2>
                        <p className="text-lg text-gray-600 mb-2">
                            점수: <span className="font-bold text-blue-600">{score}</span> / {total}
                        </p>
                        <p className="text-lg text-gray-600 mb-4">
                            정확도: <span className="font-bold text-green-600">{Math.round((score / total) * 100)}%</span>
                        </p>
                        <p className="text-sm text-blue-600 mb-6">
                            정답인 단어들의 메모리 레벨이 올라갔습니다! 🎯
                        </p>
                        <div className="space-y-3">
                            <Button 
                                onClick={() => {
                                    setIsQuizSetup(true);
                                    setIsQuizComplete(false);
                                }}
                                className="w-full"
                            >
                                다시 설정하기
                            </Button>
                            <Button 
                                onClick={() => {
                                    chrome.storage.local.get(['words'], (result) => {
                                        const allWords = (result.words as Word[]) || [];
                                        setWords(allWords.sort(() => Math.random() - 0.5));
                                        setScore(0);
                                        setTotal(0);
                                        setIsQuizComplete(false);
                                        setIsQuizSetup(true);
                                    });
                                }}
                                variant="outline"
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
                            >
                                🔄 새로운 퀴즈 시작
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!currentQuestion) return null;

    return (
        <div className="flex flex-col items-center justify-center max-w-md mx-auto py-10">
            <div className="mb-6 w-full">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">문제 {total + 1}/{questionCount === -1 ? words.length : questionCount}</span>
                        <span className="text-sm text-gray-500">Score: {score}/{total}</span>
                        <span className="text-sm text-gray-500">{Math.round((score / (total || 1)) * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setQuizDirection('EN_TO_KO')}
                            variant={quizDirection === 'EN_TO_KO' ? 'default' : 'outline'}
                            size="sm"
                        >
                            EN→KO
                        </Button>
                        <Button
                            onClick={() => setQuizDirection('KO_TO_EN')}
                            variant={quizDirection === 'KO_TO_EN' ? 'default' : 'outline'}
                            size="sm"
                        >
                            KO→EN
                        </Button>
                    </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(score / (total || 1)) * 100}%` }}></div>
                </div>
                {currentQuestion && (
                    <div className="flex justify-center mb-4">
                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1 shadow-md border">
                            <span className="text-xs font-medium">Level:</span>
                            <div className="flex gap-1">
                                {[1, 2, 3].map((level) => (
                                    <div
                                        key={level}
                                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                            level <= currentQuestion.word.stage
                                                ? 'bg-blue-500 shadow-lg shadow-blue-300'
                                                : 'bg-gray-200'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Card className="w-full mb-8 bg-white">
                <CardContent className="p-8 text-center">
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">
                        {quizDirection === 'EN_TO_KO' ? 'What is the meaning of?' : 'What is the English word for?'}
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800 break-words">{currentQuestion.question}</h2>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 w-full">
                {currentQuestion.options.map((option, idx) => {
                    let btnClass = "bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-500 hover:text-blue-600";
                    if (selectedOption) {
                        if (option === currentQuestion.correctAnswer) {
                            btnClass = "bg-green-100 border-2 border-green-500 text-green-700";
                        } else if (option === selectedOption) {
                            btnClass = "bg-red-100 border-2 border-red-500 text-red-700";
                        } else {
                            btnClass = "bg-gray-50 border-gray-100 text-gray-400 opacity-50";
                        }
                    }

                    return (
                        <Button
                            key={idx}
                            onClick={() => handleAnswer(option)}
                            className={`p-4 rounded-lg font-bold text-lg transition-all h-auto whitespace-normal ${btnClass}`}
                            disabled={!!selectedOption}
                            variant="outline"
                        >
                            {option}
                        </Button>
                    );
                })}
            </div>
        </div>
    );
};

export default QuizMode;
