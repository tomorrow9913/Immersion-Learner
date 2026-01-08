import { useState, useCallback, useRef, useEffect } from 'react';

interface TextSelectionState {
  selection: { text: string, range: Range | null };
  popupPosition: { top: number, left: number } | null;
  isSelecting: boolean;
}

export const useTextSelection = () => {
  const [state, setState] = useState<TextSelectionState>({
    selection: { text: '', range: null },
    popupPosition: null,
    isSelecting: false
  });

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const DRAG_THRESHOLD = 5;

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setState({
      selection: { text: '', range: null },
      popupPosition: null,
      isSelecting: false
    });
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    isDragging.current = false;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) {
      const dx = Math.abs(e.clientX - dragStartX.current);
      const dy = Math.abs(e.clientY - dragStartY.current);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        isDragging.current = true;
        
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        
        if (text && text.length > 0 && selection) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          const popupPosition = {
            top: rect.bottom + window.scrollY + 10,
            left: rect.left + window.scrollX
          };
          
          setState({
            selection: { text, range },
            popupPosition,
            isSelecting: true
          });
        } else {
          setState(prev => ({ ...prev, popupPosition: null, isSelecting: false }));
        }
      }
    }
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    if (target.closest('#translate-popup') || target.closest('#translate-button')) {
      return;
    }
    
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 0) {
      try {
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        const popupPosition = {
          top: rect.bottom + window.scrollY + 10,
          left: rect.left + window.scrollX
        };
        
        setState({
          selection: { text, range },
          popupPosition,
          isSelecting: true
        });
      } catch (error) {
        console.error('Selection processing failed:', error);
        setState(prev => ({ ...prev, popupPosition: null, isSelecting: false }));
      }
    } else {
      clearSelection();
    }
    
    isDragging.current = false;
  }, [clearSelection]);

  useEffect(() => {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  return {
    ...state,
    clearSelection
  };
};