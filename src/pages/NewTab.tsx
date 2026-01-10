import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { TAB_CONFIG } from '@/config/tabConfig';
import { TABS, type TabType } from '@/config/constants';
import { WordList, FlashCardMode, QuizMode } from '@/components/study';
import { PDFReader } from '@/components/pdf';
import { ErrorFallback } from '@/components/common';

const App = () => {
  const [activeTab, setActiveTab] = useState<TabType>(TABS.FLASHCARD);

  const getComponent = (componentName: string) => {
    switch (componentName) {
      case 'FlashCardMode':
        return <FlashCardMode />;
      case 'QuizMode':
        return <QuizMode />;
      case 'WordList':
        return <WordList />;
      case 'PDFReader':
        return <PDFReader />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans relative">

      <header className="bg-white shadow px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h1 className="text-xl font-bold text-gray-800">Immersion Learner</h1>
        </div>
        <nav className="flex gap-2">
            {TAB_CONFIG.map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    {tab.label}
                </button>
            ))}
        </nav>
      </header>
      
      <main className="container mx-auto p-4">
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          resetKeys={[activeTab]}
          onReset={() => console.log(`Resetting tab: ${activeTab}`)}
        >
          {getComponent(TAB_CONFIG.find(tab => tab.id === activeTab)?.componentName || '')}
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default App;
