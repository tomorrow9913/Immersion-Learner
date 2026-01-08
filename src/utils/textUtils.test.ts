import { describe, it, expect } from 'vitest';
import { extractSentences, buildSpatialIndex, findSentenceAtPoint } from './textUtils';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

const mockTextItems: TextItem[] = [
  { str: 'This is the first sentence. ', dir: 'ltr', width: 100, height: 20, transform: [1, 0, 0, 1, 10, 10], fontName: 'g_d0_f1' },
  { str: 'This is the second sentence!', dir: 'ltr', width: 100, height: 20, transform: [1, 0, 0, 1, 10, 40], fontName: 'g_d0_f1' },
];

describe('textUtils', () => {
  describe('extractSentences', () => {
    it('should extract sentences from text items', async () => {
      const sentences = await extractSentences(mockTextItems);
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is the first sentence.');
      expect(sentences[1].text).toBe('This is the second sentence!');
    });
  });

  describe('buildSpatialIndex', () => {
    it('should build a spatial index from sentences', async () => {
      const sentences = await extractSentences(mockTextItems);
      const spatialIndex = buildSpatialIndex(sentences);
      expect(spatialIndex.bins.size).toBe(2);
    });
  });

  describe('findSentenceAtPoint', () => {
    it('should find a sentence at a given point', async () => {
      const sentences = await extractSentences(mockTextItems);
      const spatialIndex = buildSpatialIndex(sentences);
      const point = { x: 15, y: 15 };
      const sentence = findSentenceAtPoint(point, spatialIndex);
      expect(sentence).toEqual(sentences[0]);
    });

    it('should return null if no sentence is found at a given point', async () => {
      const sentences = await extractSentences(mockTextItems);
      const spatialIndex = buildSpatialIndex(sentences);
      const point = { x: 200, y: 200 };
      const sentence = findSentenceAtPoint(point, spatialIndex);
      expect(sentence).toBeNull();
    });
  });
});
