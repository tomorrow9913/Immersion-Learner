

export interface SentenceTranslation {
  id: string;
  originalText: string;
  translatedText?: string;
  pageNumber: number;
  sentenceIndex: number;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'translating' | 'completed' | 'error';
  error?: string;
}

export interface TranslationQueueItem {
  id: string;
  text: string;
  pageNumber: number;
  sentenceIndex: number;
  priority: 'high' | 'normal' | 'low';
  addedAt: number;
  retryCount: number;
}

export interface PageTranslationCache {
  pageNumber: number;
  sentences: SentenceTranslation[];
  pageTranslation?: string;
  createdAt: number;
  expiresAt: number;
}

export interface TranslationQueueStatus {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  currentPageProcessing?: number;
}

export interface TranslationRequest {
  id: string;
  text: string;
  priority: number;
  resolve: (result: SentenceTranslation) => void;
  reject: (error: Error) => void;
}

export interface TranslationWorkerMessage {
  type: 'TRANSLATE_REQUEST' | 'TRANSLATE_RESPONSE' | 'QUEUE_STATUS' | 'CANCEL_REQUEST';
  payload: any;
}