// Update to PageTranslationCache interface - add version field

export interface PageTranslationCache {
  pageNumber: number;
  sentences: SentenceTranslation[];
  pageTranslation?: string;
  createdAt: number;
  expiresAt: number;
  version: number; // Add version tracking for race condition detection
}

