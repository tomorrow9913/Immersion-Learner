import { renderHook, act } from '@testing-library/react';
import { useSentenceHover } from './useSentenceHover';
import type { Sentence } from '@/utils/textUtils';

const mockSentences: Sentence[] = [
  { id: 1, text: 'This is a sentence.', rects: [{ x: 10, y: 10, width: 100, height: 20 }], yBin: 0 },
  { id: 2, text: 'This is another sentence.', rects: [{ x: 10, y: 40, width: 150, height: 20 }], yBin: 0 },
];

describe('useSentenceHover', () => {
  it('should return null for hoveredSentence initially', () => {
    const { result } = renderHook(() => useSentenceHover(mockSentences));
    expect(result.current.hoveredSentence).toBeNull();
  });

  it('should set hoveredSentence when mouse moves over a sentence', () => {
    const { result } = renderHook(() => useSentenceHover(mockSentences));

    act(() => {
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 15,
        clientY: 15,
      });
      result.current.handleMouseMove(mouseMoveEvent);
    });

    expect(result.current.hoveredSentence).toEqual(mockSentences[0]);
  });

  it('should set hoveredSentence to null when mouse moves out of any sentence', () => {
    const { result } = renderHook(() => useSentenceHover(mockSentences));

    act(() => {
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 15,
        clientY: 15,
      });
      result.current.handleMouseMove(mouseMoveEvent);
    });

    expect(result.current.hoveredSentence).toEqual(mockSentences[0]);

    act(() => {
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 200,
      });
      result.current.handleMouseMove(mouseMoveEvent);
    });

    expect(result.current.hoveredSentence).toBeNull();
  });
});
