import { useState, useEffect } from 'react';
import { findSentenceAtPoint, buildSpatialIndex } from '@/utils/textUtils';
import type { Sentence, SpatialIndex } from '@/utils/textUtils';

export const useSentenceHover = (sentences: Sentence[]) => {
  const [hoveredSentence, setHoveredSentence] = useState<Sentence | null>(null);
  const [spatialIndex, setSpatialIndex] = useState<SpatialIndex | null>(null);

  useEffect(() => {
    if (sentences.length > 0) {
      const index = buildSpatialIndex(sentences);
      setSpatialIndex(index);
    }
  }, [sentences]);

  const handleMouseMove = (event: MouseEvent) => {
    if (!spatialIndex) return;

    const point = { x: event.clientX, y: event.clientY };
    const sentence = findSentenceAtPoint(point, spatialIndex);
    setHoveredSentence(sentence);
  };

  return { hoveredSentence, handleMouseMove };
};
