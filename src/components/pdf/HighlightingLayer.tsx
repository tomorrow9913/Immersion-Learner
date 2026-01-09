import React, { useRef, useState, useEffect, useCallback } from 'react';
import { buildSpatialIndex, findSentenceAtPoint } from '@/utils/textUtils';
import type { SpatialIndex } from '@/utils/textUtils';

interface TextCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HighlightedSentence {
  id: string;
  text: string;
  coordinates: TextCoordinate[];
  pageNumber: number;
  sentenceIndex: number;
}

interface HighlightingLayerProps {
  scale: number;
  pageNumber: number;
  highlightedSentenceId: string | null;
  sentences: HighlightedSentence[];
  onSentenceHover?: (sentenceId: string | null) => void;
  className?: string;
}

const HighlightingLayer: React.FC<HighlightingLayerProps> = ({
  scale,
  pageNumber,
  highlightedSentenceId,
  sentences,
  onSentenceHover,
  className = ''
}) => {
  const [hoveredSentenceId, setHoveredSentenceId] = useState<string | null>(null);
  const [spatialIndex, setSpatialIndex] = useState<SpatialIndex | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const throttledUpdateRef = useRef<number | null>(null);

  const activeSentenceId = highlightedSentenceId; // 부모로부터 받은 상태 우선

  // Convert HighlightedSentence[] to Sentence[] for spatial indexing
  const convertToSpatialSentences = useCallback(() => {
    return sentences.map(sentence => ({
      id: parseInt(sentence.id),
      text: sentence.text,
      rects: sentence.coordinates.map(coord => ({
        x: coord.x,
        y: coord.y,
        width: coord.width,
        height: coord.height
      })),
      yBin: Math.floor((sentence.coordinates[0]?.y || 0) / 50)
    }));
  }, [sentences]);

  // Build spatial index when sentences change
  useEffect(() => {
    if (sentences.length > 0) {
      const spatialSentences = convertToSpatialSentences();
      const index = buildSpatialIndex(spatialSentences);
      setSpatialIndex(index);
    } else {
      setSpatialIndex(null);
    }
  }, [sentences, convertToSpatialSentences]);

  // Throttled mouse move handler
  const throttledHandleMouseMove = useCallback((clientX: number, clientY: number) => {
    if (throttledUpdateRef.current) {
      return;
    }

    throttledUpdateRef.current = requestAnimationFrame(() => {
      throttledUpdateRef.current = null;
      
      if (!layerRef.current || !spatialIndex) return;

      const rect = layerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;

      const sentence = findSentenceAtPoint({ x, y }, spatialIndex);
      const newHoveredId = sentence ? sentence.id.toString() : null;
      
      if (newHoveredId !== hoveredSentenceId) {
        setHoveredSentenceId(newHoveredId);
        onSentenceHover?.(newHoveredId);
      }
    });
  }, [scale, spatialIndex, hoveredSentenceId, onSentenceHover]);

  const handleMouseMove = (e: React.MouseEvent) => {
    throttledHandleMouseMove(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    setHoveredSentenceId(null);
    onSentenceHover?.(null);
  };

  // Cleanup throttling on unmount
  useEffect(() => {
    return () => {
      if (throttledUpdateRef.current) {
        cancelAnimationFrame(throttledUpdateRef.current);
      }
    };
  }, []);

  const renderHighlights = () => {
    const pageSentences = sentences.filter(s => s.pageNumber === pageNumber);

    return pageSentences.map(sentence => {
      const isActive = sentence.id === activeSentenceId;
      const isHovered = sentence.id === hoveredSentenceId;

      return (
        <div
          key={sentence.id}
          className={`absolute transition-all duration-200 pointer-events-none ${
            isActive 
              ? 'bg-yellow-300 bg-opacity-50 border-2 border-yellow-500' 
              : isHovered 
                ? 'bg-yellow-200 bg-opacity-30' 
                : 'opacity-0 hover:opacity-100 hover:bg-yellow-100 hover:bg-opacity-20'
          }`}
          style={{
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            zIndex: isActive ? 20 : (isHovered ? 15 : 10),
          }}
        >
          {sentence.coordinates.map((coord, index) => (
            <div
              key={index}
              className="absolute transition-all duration-200"
              style={{
                left: `${coord.x * scale}px`,
                top: `${coord.y * scale}px`,
                width: `${coord.width * scale}px`,
                height: `${coord.height * scale}px`,
              }}
            />
          ))}
        </div>
      );
    });
  };

  return (
    <div
      ref={layerRef}
      className={`absolute inset-0 z-10 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {renderHighlights()}
    </div>
  );
};

export default HighlightingLayer;