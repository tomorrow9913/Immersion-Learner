import type { TextStyle } from './pdfTextAssembler';
import type { SentenceTranslation } from '@/types/translation';

interface SentencePosition {
  id: string;
  text: string;
  rects: DOMRect[];
  pageNumber: number;
  scale: number;
  styles: TextStyle[];
}

interface CoordinateMappingOptions {
  pageScale: number;
  pageOffset: { x: number; y: number };
  containerElement: HTMLElement;
}

export type { SentencePosition };

export class PDFCoordinateMapper {
  private options: CoordinateMappingOptions;
  private sentenceCounter: number = 1;

  constructor(options: CoordinateMappingOptions) {
    this.options = options;
  }

  extractSentencePositions(
    fragments: TextFragment[], 
    pageNumber: number
  ): SentencePosition[] {
    const sentences: SentencePosition[] = [];
    let currentSentence: string = '';
    let currentSentenceFragments: TextFragment[] = [];

    for (const fragment of fragments) {
      if (!fragment.position || !fragment.text.trim()) continue;

      currentSentenceFragments.push(fragment);
      currentSentence += fragment.text;

      if (this.isSentenceEnd(fragment.text)) {
        const sentenceId = `p${pageNumber}_s${this.sentenceCounter++}`;
        
        const sentenceRects = currentSentenceFragments.map(frag => 
          this.transformPDFToScreenCoordinates(frag.position!)
        );

        const styles = currentSentenceFragments.map(frag => frag.style);
        
        sentences.push({
          id: sentenceId,
          text: this.cleanupSentence(currentSentence),
          rects: sentenceRects,
          pageNumber,
          scale: this.options.pageScale,
          styles
        });

        currentSentence = '';
        currentSentenceFragments = [];
      }
    }

    if (currentSentence.trim()) {
      const sentenceId = `p${pageNumber}_s${this.sentenceCounter++}`;
      const sentenceRects = currentSentenceFragments.map(frag => 
        this.transformPDFToScreenCoordinates(frag.position!)
      );

      const styles = currentSentenceFragments.map(frag => frag.style);

      sentences.push({
        id: sentenceId,
        text: this.cleanupSentence(currentSentence),
        rects: sentenceRects,
        pageNumber,
        scale: this.options.pageScale,
        styles
      });
    }

    return sentences;
  }

  transformPDFToScreenCoordinates(
    pdfPosition: { x: number; y: number; width: number; height: number }
  ): DOMRect {
    const scaledX = pdfPosition.x * this.options.pageScale;
    const scaledY = pdfPosition.y * this.options.pageScale;
    const scaledWidth = pdfPosition.width * this.options.pageScale;
    const scaledHeight = pdfPosition.height * this.options.pageScale;

    const screenX = this.options.pageOffset.x + scaledX;
    const screenY = this.options.pageOffset.y + scaledY;

    return {
      left: screenX,
      top: screenY,
      width: scaledWidth,
      height: scaledHeight,
      right: screenX + scaledWidth,
      bottom: screenY + scaledHeight,
      x: screenX,
      y: screenY
    } as DOMRect;
  }

  transformScreenToPDFCoordinates(screenRect: DOMRect): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const containerRect = this.options.containerElement.getBoundingClientRect();
    
    const relativeX = screenRect.left - containerRect.left - this.options.pageOffset.x;
    const relativeY = screenRect.top - containerRect.top - this.options.pageOffset.y;
    
    const pdfX = relativeX / this.options.pageScale;
    const pdfY = relativeY / this.options.pageScale;
    const pdfWidth = screenRect.width / this.options.pageScale;
    const pdfHeight = screenRect.height / this.options.pageScale;

    return {
      x: pdfX,
      y: pdfY,
      width: pdfWidth,
      height: pdfHeight
    };
  }

  getBoundingRect(sentence: SentencePosition): DOMRect {
    if (sentence.rects.length === 0) {
      return {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0
      } as DOMRect;
    }

    const lefts = sentence.rects.map(rect => rect.left);
    const tops = sentence.rects.map(rect => rect.top);
    const rights = sentence.rects.map(rect => rect.right);
    const bottoms = sentence.rects.map(rect => rect.bottom);

    const left = Math.min(...lefts);
    const top = Math.min(...tops);
    const right = Math.max(...rights);
    const bottom = Math.max(...bottoms);

    return new DOMRect(left, top, right - left, bottom - top);
  }

  findSentenceById(
    sentenceId: string, 
    sentences: SentencePosition[]
  ): SentencePosition | null {
    return sentences.find(sentence => sentence.id === sentenceId) || null;
  }

  findSentencesByScreenPoint(
    screenPoint: { x: number; y: number }, 
    sentences: SentencePosition[]
  ): SentencePosition[] {
    return sentences.filter(sentence => {
      const boundingRect = this.getBoundingRect(sentence);
      return (
        screenPoint.x >= boundingRect.left &&
        screenPoint.x <= boundingRect.right &&
        screenPoint.y >= boundingRect.top &&
        screenPoint.y <= boundingRect.bottom
      );
    });
  }

  createHighlightStyles(sentence: SentencePosition): string {
    const boundingRect = this.getBoundingRect(sentence);
    
    return `
      #${sentence.id} {
        background-color: rgba(59, 130, 246, 0.2);
        border: 1px solid rgb(59, 130, 246);
        border-radius: 2px;
        position: absolute;
        left: ${boundingRect.left}px;
        top: ${boundingRect.top}px;
        width: ${boundingRect.width}px;
        height: ${boundingRect.height}px;
        pointer-events: none;
        z-index: 1000;
      }
    `;
  }

  createHighlightLayer(sentences: SentencePosition[]): HTMLElement {
    const highlightLayer = document.createElement('div');
    highlightLayer.className = 'pdf-highlight-layer';
    highlightLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
    `;

    sentences.forEach(sentence => {
      const highlightElement = document.createElement('div');
      highlightElement.id = sentence.id;
      highlightElement.className = 'sentence-highlight';
      const sentenceStyle = sentence.styles[0] || {} as TextStyle;
      highlightElement.style.cssText = `
        background-color: rgba(59, 130, 246, 0.2);
        border: 1px solid ${sentenceStyle.color || 'rgb(59, 130, 246)'};
        border-radius: 2px;
        position: absolute;
        pointer-events: auto;
        cursor: pointer;
        z-index: 1000;
        color: ${sentenceStyle.color || 'inherit'};
        font-weight: ${sentenceStyle.isBold ? 'bold' : 'normal'};
        font-style: ${sentenceStyle.isItalic ? 'italic' : 'normal'};
        font-size: ${sentenceStyle.fontSize ? `${sentenceStyle.fontSize}px` : 'inherit'};
        font-family: ${sentenceStyle.fontFamily || 'inherit'};
      `;

      if (sentence.rects.length > 1) {
        sentence.rects.forEach((_, index) => {
          const fragmentElement = document.createElement('div');
          const fragmentStyle = sentence.styles[index] || {} as TextStyle;
      fragmentElement.style.cssText = `
            background-color: rgba(59, 130, 246, 0.2);
            border: 1px solid ${fragmentStyle.color || 'rgb(59, 130, 246)'};
            border-radius: 2px;
            color: ${fragmentStyle.color || 'inherit'};
            font-weight: ${fragmentStyle.isBold ? 'bold' : 'normal'};
            font-style: ${fragmentStyle.isItalic ? 'italic' : 'normal'};
            font-size: ${fragmentStyle.fontSize ? `${fragmentStyle.fontSize}px` : 'inherit'};
            font-family: ${fragmentStyle.fontFamily || 'inherit'};
          `;
          highlightElement.appendChild(fragmentElement);
        });
      } else {
        const rect = sentence.rects[0];
        highlightElement.style.left = `${rect.left}px`;
        highlightElement.style.top = `${rect.top}px`;
        highlightElement.style.width = `${rect.width}px`;
        highlightElement.style.height = `${rect.height}px`;
      }

      highlightElement.addEventListener('click', () => {
        this.onSentenceClick(sentence);
      });

      highlightLayer.appendChild(highlightElement);
    });

    return highlightLayer;
  }

  private onSentenceClick(sentence: SentencePosition): void {
    const event = new CustomEvent('sentenceClick', {
      detail: { sentence }
    });
    document.dispatchEvent(event);
  }

  async mapSentencesToCoordinates(
    sentences: SentenceTranslation[],
    textContent: any,
    pageNumber: number,
    scale: number
  ): Promise<SentencePosition[]> {
    const fragments: TextFragment[] = textContent.items.map((item: any) => ({
      text: item.str || '',
      style: {
        color: '#000000',
        isBold: false,
        isItalic: false,
        fontSize: 12,
        fontFamily: 'serif'
      },
      position: item.transform ? {
        x: item.transform[4],
        y: item.transform[5],
        width: item.width || 0,
        height: item.height || 0
      } : undefined
    }));

    const sentencePositions: SentencePosition[] = [];
    
    sentences.forEach((sentence) => {
      const sentenceFragments = this.findFragmentsForSentence(
        sentence.originalText,
        fragments
      );

      if (sentenceFragments.length > 0) {
        const rects = sentenceFragments.map(frag => {
          if (frag.position) {
            return this.transformPDFToScreenCoordinates(frag.position);
          }
          return null;
        }).filter(Boolean) as DOMRect[];

        const styles = sentenceFragments.map(frag => frag.style);

        sentencePositions.push({
          id: sentence.id,
          text: sentence.originalText,
          rects,
          pageNumber,
          scale,
          styles
        });
      }
    });

    return sentencePositions;
  }

  private findFragmentsForSentence(
    sentence: string,
    fragments: TextFragment[]
  ): TextFragment[] {
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    const matchedFragments: TextFragment[] = [];
    let remainingWords = [...sentenceWords];

    fragments.forEach(fragment => {
      const fragmentText = fragment.text.toLowerCase().trim();
      const fragmentWords = fragmentText.split(/\s+/);

      if (fragmentWords.length === 0) return;

      for (let i = 0; i <= remainingWords.length - fragmentWords.length; i++) {
        const window = remainingWords.slice(i, i + fragmentWords.length);
        
        if (this.areWordsSimilar(window, fragmentWords)) {
          matchedFragments.push(fragment);
          remainingWords.splice(i, fragmentWords.length);
          break;
        }
      }
    });

    return matchedFragments;
  }

  private areWordsSimilar(words1: string[], words2: string[]): boolean {
    if (words1.length !== words2.length) return false;
    
    return words1.every((word, index) => {
      return this.isWordSimilar(word, words2[index]);
    });
  }

  private isWordSimilar(word1: string, word2: string): boolean {
    const clean1 = word1.replace(/[^\w]/g, '');
    const clean2 = word2.replace(/[^\w]/g, '');
    
    if (clean1.length === 0 || clean2.length === 0) return false;
    
    if (clean1 === clean2) return true;
    
    if (Math.abs(clean1.length - clean2.length) <= 2) {
      const longer = clean1.length > clean2.length ? clean1 : clean2;
      const shorter = clean1.length > clean2.length ? clean2 : clean1;
      
      return longer.includes(shorter) || shorter.includes(longer);
    }
    
    return false;
  }

  private isSentenceEnd(text: string): boolean {
    const sentenceEndings = ['.', '!', '?', '.', '！', '？'];
    return sentenceEndings.some(ending => text.trim().endsWith(ending));
  }

  private cleanupSentence(text: string): string {
    return text.replace(/\s+/g, ' ').replace(/-\s+/g, '').trim();
  }
}

export function extractSentencePositions(
  fragments: TextFragment[], 
  pageNumber: number,
  options: CoordinateMappingOptions
): SentencePosition[] {
  const mapper = new PDFCoordinateMapper(options);
  return mapper.extractSentencePositions(fragments, pageNumber);
}

export function findSentencePosition(
  sentenceId: string, 
  sentences: SentencePosition[]
): SentencePosition | null {
  const mapper = new PDFCoordinateMapper({
    pageScale: 1,
    pageOffset: { x: 0, y: 0 },
    containerElement: document.body
  });
  return mapper.findSentenceById(sentenceId, sentences);
}

interface TextFragment {
  text: string;
  style: TextStyle;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}