import React, { useRef, useState } from 'react';

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
  const layerRef = useRef<HTMLDivElement>(null);

  const activeSentenceId = highlightedSentenceId || hoveredSentenceId;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!layerRef.current) return;

    const rect = layerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hoveredSentence = sentences.find(sentence => {
      return sentence.coordinates.some(coord => {
        const scaledX = coord.x * scale;
        const scaledY = coord.y * scale;
        const scaledWidth = coord.width * scale;
        const scaledHeight = coord.height * scale;

        return x >= scaledX && x <= scaledX + scaledWidth &&
               y >= scaledY && y <= scaledY + scaledHeight;
      });
    });

    const newHoveredId = hoveredSentence?.id || null;
    if (newHoveredId !== hoveredSentenceId) {
      setHoveredSentenceId(newHoveredId);
      onSentenceHover?.(newHoveredId);
    }
  };

  const handleMouseLeave = () => {
    setHoveredSentenceId(null);
    onSentenceHover?.(null);
  };

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