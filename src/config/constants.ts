// API 엔드포인트 관리
export const API_ENDPOINTS = {
  GOOGLE_TRANSLATE: 'https://translate.googleapis.com/translate_a/single',
  DICTIONARY_API: 'https://api.dictionaryapi.dev/api/v2/entries/en',
  PDF_WORKER: '/pdf.worker.min.mjs'
} as const;

// UI 설정 상수
export const UI_CONFIG = {
  TRANSLATION_POPUP: {
    WIDTH: 320,
    HEIGHT: 300,
    OFFSET: 10
  },
  SIDEBAR: {
    WIDTH_OPEN: 256,
    WIDTH_CLOSED: 48
  },
  DEBOUNCE_DELAY: 300,
  MOUSE_UP_DELAY: 1500,
  WORD_SAVE_SUCCESS_DURATION: 1500,
  MAX_RECENT_FILES: 5
} as const;

// PDF 뷰어 설정
export const PDF_CONFIG = {
  SCALE: 1.2,
  WORKER_SRC: (() => {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL("pdf.worker.min.mjs");
    }
    if (typeof window !== "undefined" && window.location) {
      return new URL("pdf.worker.min.mjs", window.location.origin).href;
    }
    return "/pdf.worker.min.mjs";
  })()
} as const;

// Chrome 스토리지 키
export const STORAGE_KEYS = {
  RECENT_FILES: 'recentFiles',
  PDF_FILE_DATA: 'pdfFileData'
} as const;

// 메시지 타입 (Chrome 확장프로그램 통신)
export const MESSAGE_TYPES = {
  TRANSLATE_REQUEST: 'TRANSLATE_REQUEST',
  GET_WORD_DETAILS: 'GET_WORD_DETAILS',
  GET_TRANSLATION_AND_DETAILS: 'GET_TRANSLATION_AND_DETAILS',
  SAVE_WORD: 'SAVE_WORD',
  DICTIONARY_DATA: 'DICTIONARY_DATA',
  DICTIONARY_ERROR: 'DICTIONARY_ERROR',
  TRANSLATE_SENTENCE: 'TRANSLATE_SENTENCE'
} as const;

// 탭 상수
export const TABS = {
  FLASHCARD: 'flashcard',
  QUIZ: 'quiz',
  LIST: 'list',
  PDF: 'pdf'
} as const;

// 탭 타입
export type TabType = typeof TABS[keyof typeof TABS];

// 번역 큐 설정
export const QUEUE_CONFIG = {
  MIN_DELAY_MS: 200,
  FOUR_DAYS_MS: 4 * 24 * 60 * 60 * 1000
} as const;

// 네트워크 설정
export const NETWORK_CONFIG = {
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
} as const;

// 에러 메시지
export const ERROR_MESSAGES = {
  EXTENSION_CONTEXT_INVALIDATED: '확장 프로그램이 업데이트되었습니다. 페이지를 새로고침 해주세요.',
  TRANSLATION_SERVICE_UNAVAILABLE: '번역 서비스를 사용할 수 없습니다.',
  TRANSLATION_SERVICE_TEMPORARILY_UNAVAILABLE: '번역 서비스가 일시적으로 제한되었습니다.',
  TRANSLATION_FAILED: '번역에 실패했습니다.',
  SAVE_WORD_FAILED: '단어장 저장에 실패했습니다.'
} as const;
