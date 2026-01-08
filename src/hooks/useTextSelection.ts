import { useState, useCallback, useEffect, useRef } from 'react';
import { UI_CONFIG } from '@/config/constants';

interface TextSelectionState {
  selection: { text: string; range: Range | null };
  popupPosition: { top: number; left: number } | null;
}

export const useTextSelection = () => {
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
  }, []);

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
          
          setState({
            selection: { text: selectedText, range },
            popupPosition: {
              top: rect.bottom + window.scrollY + UI_CONFIG.TRANSLATION_POPUP.OFFSET,
              left: rect.left + window.scrollX,
            },
          });
        } catch (error) {
          console.error('오류 처리 중 선택 실패:', error);
          clearSelection();
        }
      } else {
        // If there's no selected text, but a popup is open, we might want to let the popup handle its own closure.
        // For now, we'll clear it if the selection is empty.
        const activeElement = document.activeElement;
        const isPopupFocused = activeElement && activeElement.closest('#translate-popup');
        if (!isPopupFocused) {
          clearSelection();
        }
      }
    }, UI_CONFIG.DEBOUNCE_DELAY);
  }, [clearSelection]);
  
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [handleMouseUp]);

  return {
    ...state,
    clearSelection,
  };
};