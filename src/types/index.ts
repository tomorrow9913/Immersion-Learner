export interface Word {
  id: string;
  original: string;
  translated: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: string[];
  examples?: string[];
  createdAt: number;
  nextReviewDate: number;
  stage: number;
}

export interface RecentFile {
  id: string;
  name: string;
  dataUrl?: string;
  lastPage: number;
  lastAccessed: number;
  size: number;
  isLargeFile?: boolean;
  fileHash?: string;
}

export interface OutlineItem {
  title: string;
  dest: OutlineDestination | string;
  items?: OutlineItem[];
  pageNumber?: number;
}

export interface OutlineDestination {
  num: number;
  gen?: number;
  string?: string;
}

export interface PDFState {
  file: File | string | Blob | null;
  numPages: number;
  pageNumber: number;
  outline: OutlineItem[];
  isSidebarOpen: boolean;
  isDragOver: boolean;
}

export interface PDFActions {
  setFile: (file: File | string | Blob | null) => void;
  setNumPages: (pages: number) => void;
  setPageNumber: (page: number) => void;
  setOutline: (outline: OutlineItem[]) => void;
  setIsSidebarOpen: (open: boolean) => void;
  setIsDragOver: (drag: boolean) => void;
}

export interface GoogleTranslationResponse {
  0: Array<[string, string, string, string]>;
}

export interface DictionaryEntry {
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings?: Array<{
    definitions?: Array<{
      definition?: string;
    }>;
  }>;
}

export interface DictionaryAPIResponse extends Array<DictionaryEntry> {}

export interface WordDetails {
  phonetic?: string;
  audioUrl?: string;
  meanings: string[];
  examples?: string[];
}

export interface PDFRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedSentence {
  id: number; // Unique Index (0, 1, 2...)
  sourceText: string; // "Hello world." (for translation request)
  rects: PDFRect[]; // Coordinates for highlighting (supports multi-line)
}

export interface HydratedSentence extends ParsedSentence {
  translatedText: string | null; // Null before translation, filled after
}

export interface ParsedPageData {
  pageNumber: number;
  sentences: ParsedSentence[];
}

export * from './alert';
export * from './translation';
