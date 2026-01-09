# Translation Cache Race Condition Fixes

## Problem Summary
The current translation cache system has critical race conditions in `src/utils/translationCache.ts`:

1. **Read-Modify-Write Race**: Multiple operations reading and modifying the same page cache simultaneously
2. **Store Sentence vs Store Page Race**: Concurrent calls can overwrite each other
3. **Cache Invalidation Race**: Page cache cleared while sentences are being processed
4. **Non-Atomic Transactions**: Multiple IndexedDB operations not atomic

## Solution Architecture

### 1. Version Tracking
- Add `version: number` field to `PageTranslationCache` interface
- Increment version on each modification
- Use for optimistic locking

### 2. Per-Page Operation Queuing
- Implement `pageOperations: Map<number, Promise<any>>` for per-page locking
- Serialize operations on same page while allowing concurrent operations on different pages

### 3. Atomic Read-Modify-Write
- Create `updatePageTranslationAtomically()` method
- Combine read, modify, and write in single IndexedDB transaction
- Eliminates race condition window

### 4. Batch Operations
- Add `storeSentences()` for atomic batch operations
- Prevents multiple individual sentence updates from racing

## Implementation Files

### 1. `src/types/translation.ts`
- Add `version: number` to `PageTranslationCache`

### 2. `src/utils/translationCache.ts`
- Add per-page operation queue
- Implement atomic update methods
- Refactor `storeSentence()` to use atomic operations
- Add `storeSentences()` for batch operations
- Add migration handling for existing cache entries

### 3. `src/hooks/useSentenceTranslation.ts`
- Remove redundant `storePageTranslation()` call
- Use atomic `storeSentences()` for bulk operations
- Add debug function for cache health monitoring

## Key Benefits

1. **Thread Safety**: Eliminates all identified race conditions
2. **Performance**: Concurrent operations on different pages, serialized only when needed
3. **Backward Compatibility**: Existing interfaces preserved
4. **Data Integrity**: Version tracking prevents corruption
5. **Migration Safe**: Handles existing cache entries gracefully

## Migration Strategy

1. Database version incremented from 1 to 2
2. Existing entries automatically migrated on access
3. Version field added to old entries during migration
4. No data loss during upgrade

