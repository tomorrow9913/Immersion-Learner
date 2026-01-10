import React, { memo } from 'react';
import type { ParsedSentence } from '@/types';

interface HighlightingLayerProps {
  scale: number;
  sentences: ParsedSentence[]; // Now using the shared type
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
  sentence: ParsedSentence;
  scale: number;
  isHovered: boolean;
  onEnter: (id: number) => void;
  onLeave: () => void;
}) => {
  return (
    <>
      {/* 1. Pre-calculated Overlay (Hitbox) */}
      {sentence.rects.map((rect, i) => (
        <div
          key={`hitbox-${sentence.id}-${i}`}
          style={{
            position: 'absolute',
            left: `${rect.x * scale}px`,
            top: `${rect.y * scale}px`,
            width: `${rect.width * scale}px`,
            height: `${rect.height * scale}px`,
            cursor: 'text',
            zIndex: 10, // Below selection but above PDF
            // pointer-events: auto by default to catch hover.
            // If user wants to select text behind, they might struggle unless we handle that.
            // For now, per Req-4/5, we need it to catch hover.
          }}
          onMouseEnter={() => onEnter(sentence.id)}
          onMouseLeave={onLeave}
        />
      ))}

      {/* 2. Highlight Layer (Visual) */}
      {isHovered && sentence.rects.map((rect, i) => (
        <div
          key={`highlight-${sentence.id}-${i}`}
          className="bg-yellow-300 mix-blend-multiply opacity-50"
          style={{
            position: 'absolute',
            left: `${rect.x * scale}px`,
            top: `${rect.y * scale}px`,
            width: `${rect.width * scale}px`,
            height: `${rect.height * scale}px`,
            pointerEvents: 'none', // Visual only
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
  // Use local state if needed, but props `hoveredIndex` should drive it for bi-directional.
  // Actually, we need to inform parent when WE hover, so parent updates `hoveredIndex`.

  return (
    <div className={`absolute inset-0 z-10 ${className}`}>
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