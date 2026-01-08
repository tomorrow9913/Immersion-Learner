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
            popupPosition: calculatePopupPosition(rect),
          });
        } catch (error) {
          console.error('Failed to process selection:', error);
          clearSelection();
        }
      } 
    }, UI_CONFIG.DEBOUNCE_DELAY);
  }, [clearSelection]);
  
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const popupElement = document.getElementById('translate-popup');
            // 1. 팝업 내부 클릭이면 무시 (유지)
      if (popupElement && popupElement.contains(event.target as Node)) {
        return;
      }
            // 2. [수정 포인트] 선택 영역을 '즉시' 지우지 말고, 새로운 선택이 시작되는지 확인하거나
            // 기존 팝업만 닫도록 처리 (Selection API 호출 최소화)
      setState(prev => ({ ...prev, popupPosition: null })); // 팝업만 일단 닫음
            // 주의: removeAllRanges()를 여기서 호출하면 더블 클릭 시 선택이 풀릴 수 있음
            // 브라우저는 클릭 시 자동으로 선택을 해제하므로 굳이 강제로 호출할 필요가 없을 수 있음
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