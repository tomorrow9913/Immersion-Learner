import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import type { Rect, Point } from './coordinateUtils';

export interface Sentence {
  id: number;
  text: string;
  rects: Rect[];
  yBin: number;
}

interface SpatialIndex {
  bins: Map<number, Sentence[]>;
  binHeight: number;
}

const SENTENCE_ENDINGS = /[.!?]+/;
const BIN_HEIGHT = 50;

const isTextItem = (item: TextItem | TextMarkedContent): item is TextItem => {
  return 'str' in item;
};

const mergeTextItems = (textItems: TextItem[]): string[] => {
  const sentences: string[] = [];
  let currentSentence = '';
  
  for (const item of textItems) {
    if (!isTextItem(item)) continue;
    
    const text = item.str.trim();
    if (!text) continue;
    
    currentSentence += (currentSentence ? ' ' : '') + text;
    
    if (SENTENCE_ENDINGS.test(text.slice(-1))) {
      sentences.push(currentSentence.trim());
      currentSentence = '';
    }
  }
  
  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }
  
  return sentences.filter(s => s.length > 0);
};

const calculateSentenceRects = (textItems: TextItem[], startIndex: number, endIndex: number): Rect[] => {
  const relevantItems = textItems.slice(startIndex, endIndex + 1);
  const rects: Rect[] = [];
  
  for (const item of relevantItems) {
    if (!isTextItem(item) || !item.transform) continue;
    
    const transform = item.transform;
    const [scaleX, , , scaleY, x, y] = transform;
    
    const height = item.height * Math.abs(scaleY);
    const width = item.width * Math.abs(scaleX);
    
    rects.push({
      x: x,
      y: y - height,
      width,
      height
    });
  }
  
  return rects;
};

export const extractSentences = async (textItems: (TextItem | TextMarkedContent)[]): Promise<Sentence[]> => {
  const validItems = textItems.filter(isTextItem);
  const sentences = mergeTextItems(validItems);
  
  const result: Sentence[] = [];
  let itemIndex = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const startIndex = itemIndex;
    
    let sentenceLength = 0;
    while (itemIndex < validItems.length && sentenceLength < sentence.length) {
      sentenceLength += validItems[itemIndex].str.length;
      itemIndex++;
    }
    
    const endIndex = Math.max(startIndex, itemIndex - 1);
    const rects = calculateSentenceRects(validItems, startIndex, endIndex);
    const yBin = rects.length > 0 ? Math.floor(rects[0].y / BIN_HEIGHT) : 0;
    
    result.push({
      id: i,
      text: sentence,
      rects,
      yBin
    });
  }
  
  return result;
};

export const buildSpatialIndex = (sentences: Sentence[]): SpatialIndex => {
  const bins = new Map<number, Sentence[]>();
  
  for (const sentence of sentences) {
    if (!bins.has(sentence.yBin)) {
      bins.set(sentence.yBin, []);
    }
    const bin = bins.get(sentence.yBin);
    if (bin) {
      bin.push(sentence);
    }
  }
  
  return {
    bins,
    binHeight: BIN_HEIGHT
  };
};

export const findSentenceAtPoint = (
  point: Point,
  spatialIndex: SpatialIndex
): Sentence | null => {
  const yBin = Math.floor(point.y / spatialIndex.binHeight);
  const binSentences = spatialIndex.bins.get(yBin);
  
  if (!binSentences) {
    const nearbyBins = Array.from(spatialIndex.bins.keys()).filter(
      bin => Math.abs(bin - yBin) <= 1
    );
    
    for (const bin of nearbyBins) {
      const sentences = spatialIndex.bins.get(bin);
      if (sentences) {
        for (const sentence of sentences) {
          for (const rect of sentence.rects) {
            if (point.x >= rect.x && 
                point.x <= rect.x + rect.width &&
                point.y >= rect.y && 
                point.y <= rect.y + rect.height) {
              return sentence;
            }
          }
        }
      }
    }
    
    return null;
  }
  
  for (const sentence of binSentences) {
    for (const rect of sentence.rects) {
      if (point.x >= rect.x && 
          point.x <= rect.x + rect.width &&
          point.y >= rect.y && 
          point.y <= rect.y + rect.height) {
        return sentence;
      }
    }
  }
  
  return null;
};

export type { SpatialIndex };