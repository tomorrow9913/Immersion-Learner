import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_PANEL_WIDTH = 20; // 20%
const MAX_PANEL_WIDTH = 80; // 80%

export const usePDFResize = (containerRef: React.RefObject<HTMLElement | null>) => {
    const [pdfPanelWidth, setPdfPanelWidth] = useState(50); // in percentage
    const [isDragging, setIsDragging] = useState(false);
    const [isTranslationCollapsed, setIsTranslationCollapsed] = useState(false);
    const dragStartRef = useRef<{ clientX: number; initialPdfPanelWidth: number } | null>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            clientX: e.clientX,
            initialPdfPanelWidth: pdfPanelWidth,
        };
    }, [pdfPanelWidth]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        dragStartRef.current = null;
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragStartRef.current || !containerRef.current) return;

        const deltaX = e.clientX - dragStartRef.current.clientX;
        const containerWidth = containerRef.current.offsetWidth;

        if (containerWidth === 0) return;

        const newPdfPanelWidth = dragStartRef.current.initialPdfPanelWidth + (deltaX / containerWidth) * 100;

        if (newPdfPanelWidth > MIN_PANEL_WIDTH && newPdfPanelWidth < MAX_PANEL_WIDTH) {
            setPdfPanelWidth(newPdfPanelWidth);
        }
    }, [isDragging, containerRef]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const toggleTranslationPanel = useCallback(() => {
        setIsTranslationCollapsed((prev) => !prev);
    }, []);

    return {
        pdfPanelWidth,
        isTranslationCollapsed,
        isDragging,
        handleMouseDown,
        toggleTranslationPanel
    };
};
