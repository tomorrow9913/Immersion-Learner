import React, { memo } from 'react';
import type { HydratedSentence } from '@/types';

interface HighlightingLayerProps {
  scale: number;
  sentences: HydratedSentence[];
  hoveredIndex: number | null;
  onSentenceHover: (sentenceId: number | null) => void;
  className?: string;
}

// Optimization: Render each sentence as a memoized component
const HighlightedSentenceItem = memo(({
  sentence,
  scale,
  isHovered,
  onEnter,
  onLeave
}: {
  sentence: HydratedSentence;
  scale: number;
  isHovered: boolean;
  onEnter: (id: number) => void;
  onLeave: () => void;
}) => {
  return (
    <>
      {/* 1. Pre-calculated Overlay (Hitbox) - Always processed for interaction */}
      {sentence.rects.map((rect, i) => (
        <div
          key={`hitbox-${sentence.id}-${i}`}
          style={{
            position: 'absolute',
            left: `${rect.x * scale}px`,
            top: `${rect.y * scale}px`,
            width: `${rect.width * scale}px`,
            height: `${rect.height * scale}px`,
            // pointer-events: auto allows this to catch mouse events
            pointerEvents: 'auto',
            cursor: 'pointer',
            zIndex: 10,
            // Transparent, purely for hit detection
            backgroundColor: 'transparent'
          }}
          onMouseEnter={() => onEnter(sentence.id)}
          onMouseLeave={onLeave}
        />
      ))}

      {/* 2. Highlight Layer (Visual) - Only when hovered */}
      {isHovered && sentence.rects.map((rect, i) => (
        <div
          key={`highlight-${sentence.id}-${i}`}
          className="bg-yellow-400 opacity-40 mix-blend-multiply"
          style={{
            position: 'absolute',
            left: `${rect.x * scale}px`,
            top: `${rect.y * scale}px`,
            width: `${rect.width * scale}px`,
            height: `${rect.height * scale}px`,
            pointerEvents: 'none', // Visual only, let events pass through to hitbox
            zIndex: 9
          }}
        />
      ))}
    </>
  );
});

const HighlightingLayer: React.FC<HighlightingLayerProps> = ({
  scale,
  sentences,
  hoveredIndex,
  onSentenceHover,
  className = ''
}) => {
  return (
    <div className={`absolute inset-0 z-10 pointer-events-none ${className}`}>
      {sentences.map((sentence) => (
        <HighlightedSentenceItem
          key={sentence.id}
          sentence={sentence}
          scale={scale}
          isHovered={hoveredIndex === sentence.id}
          onEnter={onSentenceHover}
          onLeave={() => onSentenceHover(null)}
        />
      ))}
    </div>
  );
};

export default HighlightingLayer;