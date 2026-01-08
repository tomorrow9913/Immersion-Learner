import { TABS, type TabType } from '@/config/constants';

export interface TabConfig {
  id: TabType;
  label: string;
  componentName: 'FlashCardMode' | 'QuizMode' | 'WordList' | 'PDFReader';
}

export const TAB_CONFIG: TabConfig[] = [
  {
    id: TABS.FLASHCARD,
    label: 'Memorize',
    componentName: 'FlashCardMode'
  },
  {
    id: TABS.QUIZ,
    label: 'Quiz',
    componentName: 'QuizMode'
  },
  {
    id: TABS.LIST,
    label: 'List',
    componentName: 'WordList'
  },
  {
    id: TABS.PDF,
    label: 'PDF Reader',
    componentName: 'PDFReader'
  }
];