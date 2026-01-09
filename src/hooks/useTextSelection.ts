import { useState, useCallback, useEffect, useRef } from 'react';
import { UI_CONFIG } from '@/config/constants';

interface TextSelectionState {
  selection: { text: string; range: Range | null };
  popupPosition: { top: number; left: number } | null;
}

const calculatePopupPosition = (selectionRect: DOMRect) => {
  const { 
    TRANSLATION_POPUP: { OFFSET: GAP, HEIGHT: POPUP_HEIGHT, WIDTH: POPUP_WIDTH }, 
  } = UI_CONFIG;

  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY;

  const absoluteTop = selectionRect.top + scrollY;
  const absoluteBottom = selectionRect.bottom + scrollY;

  const spaceBelow = viewportHeight - selectionRect.bottom;
  
  let topPosition;
  if (spaceBelow < POPUP_HEIGHT) {
    topPosition = absoluteTop - POPUP_HEIGHT - GAP;
  } else {
    topPosition = absoluteBottom + GAP;
  }

  const leftPosition = Math.min(
    Math.max(selectionRect.left, 10),
    document.body.clientWidth - POPUP_WIDTH - 10
  );

  return { top: topPosition, left: leftPosition };
};


export const useTextSelection = (onSelectionCleared?: () => void) => {
  const [state, setState] = useState<TextSelectionState>({
    selection: { text: '', range: null },
    popupPosition: null,
  });
  const debounceTimer = useRef<number | null>(null);

  const clearSelection = useCallback(() => {
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
    setState({
      selection: { text: '', range: null },
      popupPosition: null,
    });
    onSelectionCleared?.(); // Call the callback when selection is cleared
  }, [onSelectionCleared]);
  
  const handleMouseUp = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = window.setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      
      const popupElement = document.getElementById('translate-popup');
      if (popupElement && selection?.containsNode(popupElement, true)) {
        return;
      }

      if (selectedText && selectedText.length > 0) {
        try {
          const range = selection!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          

          const processedText = selectedText;
          
          setState({
            selection: { text: processedText, range },
            popupPosition: calculatePopupPosition(rect),
          });
        } catch (error) {
          console.error('Failed to process selection:', error);
          clearSelection();
        }
      } else {
        // If selection is empty, clear the popup state
        setState({
          selection: { text: '', range: null },
          popupPosition: null,
        });
        onSelectionCleared?.(); // Call the callback when selection is implicitly cleared (e.g., clicking away)
      } 
    }, UI_CONFIG.DEBOUNCE_DELAY);
  }, [clearSelection]);
  
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const popupElement = document.getElementById('translate-popup');
      const highlightedElement = event.target as HTMLElement;
      
      if (popupElement && popupElement.contains(event.target as Node)) {
        return;
      }
      
      if (highlightedElement?.closest('.sentence-highlight')) {
        event.preventDefault();
        return;
      }
      
      setState(prev => ({ ...prev, popupPosition: null }));
      onSelectionCleared?.();
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [handleMouseUp, clearSelection]);

  return {
    ...state,
    clearSelection,
  };
};