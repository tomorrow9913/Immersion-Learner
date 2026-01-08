import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTranslation } from './useTranslation';

globalThis.fetch = vi.fn();

describe('useTranslation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.selectedText).toBe('');
    expect(result.current.translation).toBe('');
    expect(result.current.isTranslating).toBe(false);
  });

  it('should update selected text', () => {
    const { result } = renderHook(() => useTranslation());
    act(() => {
      result.current.setSelectedText('hello');
    });
    expect(result.current.selectedText).toBe('hello');
  });

  it('should reset translation state', () => {
    const { result } = renderHook(() => useTranslation());
    act(() => {
      result.current.setSelectedText('hello');
      result.current.resetTranslation();
    });
    expect(result.current.selectedText).toBe('');
  });

  it('should call translateText and update state', async () => {
    const mockResponse = {
      success: true,
      translatedText: '안녕하세요',
      dictionaryData: null,
    };

    global.chrome = {
      runtime: {
        sendMessage: vi.fn((message, callback) => {
          if (callback) {
            callback(mockResponse);
          }
          return Promise.resolve(mockResponse);
        }),
        id: 'test-id',
        lastError: undefined
      },
    } as any;

    const { result } = renderHook(() => useTranslation());
    
    await act(async () => {
      await result.current.translateText('hello');
    });

    expect(result.current.translation).toBe('안녕하세요');
    expect(result.current.isTranslating).toBe(false);
  });
});
