import React from 'react';
import type { OutlineItem } from '@/types';
import type { SentenceTranslation } from '@/types/translation';
import ScrollableOutline from './ScrollableOutline';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  outline: OutlineItem[];
  totalPages: number;
  onToggleSidebar: () => void;
  onOutlineItemClick: (dest: any, title: string, pageNumber?: number) => void;
  currentPage: number;
  translations: SentenceTranslation[];
  isTranslating: boolean;
  error?: string | null;
}

interface TranslationTabProps {
  translations: SentenceTranslation[];
  isTranslating: boolean;
  error?: string | null;
}

const TranslationTab: React.FC<TranslationTabProps> = ({ translations, isTranslating, error }) => {
  if (isTranslating && translations.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm text-gray-600">번역 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (translations.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-4">
        번역된 문장이 없습니다
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-h-full overflow-y-auto">
      {translations.map((sentence) => (
        <div key={sentence.id} className="border-b border-gray-100 pb-3 last:border-b-0">
          {sentence.status === 'translating' ? (
            <div className="flex items-center py-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-gray-600">번역 중...</span>
            </div>
          ) : sentence.status === 'error' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-sm text-red-600">번역 실패: {sentence.error}</p>
              <p className="text-sm text-gray-700 mt-1">{sentence.originalText}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-800 leading-relaxed">
                {sentence.originalText}
              </p>
              {sentence.translatedText && (
                <p className="text-sm text-blue-700 leading-relaxed bg-blue-50 p-2 rounded">
                  {sentence.translatedText}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  outline,
  totalPages,
  onToggleSidebar,
  onOutlineItemClick,
  currentPage,
  translations,
  isTranslating,
  error
}) => {
  const [activeTab, setActiveTab] = React.useState<'outline' | 'translation'>('outline');

  const handleOutlineClick = (dest: any, title: string, pageNumber?: number) => {
    onOutlineItemClick(dest, title, pageNumber);
  };

  return (
    <div className={`${isSidebarOpen ? 'w-80' : 'w-12'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        {isSidebarOpen && (
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('outline')}
              className={`px-3 py-1 text-sm font-medium rounded ${
                activeTab === 'outline' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              목차
            </button>
            <button
              onClick={() => setActiveTab('translation')}
              className={`px-3 py-1 text-sm font-medium rounded flex items-center ${
                activeTab === 'translation' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              번역
              {isTranslating && (
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              )}
            </button>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="p-2"
        >
          {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      
      {isSidebarOpen && (
        <div className="flex-1 min-h-0">
          {activeTab === 'outline' ? (
            outline.length > 0 ? (
              <ScrollableOutline
                outline={outline}
                onItemClick={handleOutlineClick}
                totalPages={totalPages}
              />
            ) : (
              <div className="text-gray-500 text-sm text-center py-4">
                목차가 없습니다
              </div>
            )
          ) : (
            <TranslationTab
              translations={translations}
              isTranslating={isTranslating}
              error={error}
            />
          )}
        </div>
      )}
      
      {isSidebarOpen && activeTab === 'translation' && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600 text-center">
            {currentPage} 페이지 • {translations.length}개 문장
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;