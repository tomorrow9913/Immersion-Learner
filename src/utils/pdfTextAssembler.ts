/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { PDFRect, ParsedPageData, ParsedSentence } from '../types';

// --- Interfaces ---

interface TextItemWithStyle extends TextItem {
  fontName: string;
  // `transform` is [scaleX, skewY, skewX, scaleY, x, y]
  transform: number[];
}

interface AssemblerOptions {
  yTolerance: number;
}

// --- Main Class ---

export class PDFTextAssembler {
  private readonly options: AssemblerOptions;
  // Regex for sentence splitting: Period/Exclamation/Question, optionally quote, then end of string
  private readonly SENTENCE_SPLIT_REGEX = /[.?!]["']?\s*$/;

  constructor(options: Partial<AssemblerOptions> = {}) {
    this.options = {
      yTolerance: 5,
      ...options,
    };
  }

  public async processPage(page: any, pageNumber: number): Promise<ParsedPageData> {
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    if (!textContent.items || textContent.items.length === 0) {
      return { pageNumber, sentences: [] };
    }

    const items = textContent.items as TextItemWithStyle[];

    // Core Logic: Assemble Page Data
    return this.assemblePageData(items, viewport.height, pageNumber);
  }

  public assemblePageData(items: TextItemWithStyle[], pageHeight: number, pageNumber: number): ParsedPageData {
    // Step 1: Geometric Sorting (Visual Order)
    const sortedItems = this.sortItems(items);

    // Step 2 & 3: Stitching & Segmentation
    const sentences = this.stitchAndSegment(sortedItems, pageHeight);

    return { pageNumber, sentences };
  }

  /**
   * Sorts TextItem objects by their visual position.
   * Logic:
   * 1. Compare Y coordinates. If diff > TOLERANCE, strictly Top-down (taking PDF coord system into account).
   * 2. If Y diff <= TOLERANCE, Left-to-Right.
   */
  private sortItems(items: TextItemWithStyle[]): TextItemWithStyle[] {
    return [...items].sort((a, b) => {
      const yA = a.transform[5];
      const yB = b.transform[5];
      const xA = a.transform[4];
      const xB = b.transform[4];

      // Note: In PDF PDF coordinates (default), (0,0) is bottom-left.
      // Larger Y means higher up on the page.
      // So detailed comparison:
      // If Abs(yA - yB) > Tolerance:
      //   Sort Descending Y (Higher Y -> Top of page -> First in visual order)
      if (Math.abs(yA - yB) > this.options.yTolerance) {
        return yB - yA;
      }

      // If roughly same line, Sort Ascending X (Left -> Right)
      return xA - xB;
    });
  }

  /**
   * Core "Stitching" Algorithm:
   * Iterates through sorted items to build sentences.
    * Line Merge: If Y diff > Tolerance, insert space.
    * Sentence Split: If matches regex, flush.
   */
  private stitchAndSegment(items: TextItemWithStyle[], pageHeight: number): ParsedSentence[] {
    const sentences: ParsedSentence[] = [];
    let sentenceId = 0;

    let currentSentenceText = '';
    let currentRects: PDFRect[] = [];

    // Helper to flush current buffer
    const flushSentence = () => {
      if (currentSentenceText.trim().length > 0) {
        sentences.push({
          id: sentenceId++,
          sourceText: currentSentenceText.trim(),
          rects: [...currentRects],
        });
      }
      currentSentenceText = '';
      currentRects = [];
    };

    for (let i = 0; i < items.length; i++) {
      const curr = items[i];
      const prev = i > 0 ? items[i - 1] : null;

      // 1. Transform Coordinate (PDF -> Viewport Top-Left)
      const rect = this.calculateRect(curr, pageHeight);

      // 2. Line Merge Logic
      if (prev) {
        const prevY = prev.transform[5];
        const currY = curr.transform[5];

        const yDiff = Math.abs(prevY - currY);

        // If Y difference is significant, it's a visual line break.
        if (yDiff > this.options.yTolerance) {
          // Spec: "True라면: currentSentenceText += " ". (줄바꿈을 공백으로 치환)"
          // We check if we need to add space (avoid double spaces)
          if (!currentSentenceText.endsWith(' ') && currentSentenceText.length > 0) {
            currentSentenceText += ' ';
          }
        }
        // Same line check for small X gaps (implicit in PDF str usually, but good for safety)
        else {
          const prevXEnd = prev.transform[4] + prev.width;
          const currX = curr.transform[4];
          // If there is a visible gap and no space, add one.
          if (currX - prevXEnd > 5 && !currentSentenceText.endsWith(' ')) {
            currentSentenceText += ' ';
          }
        }
      }

      // 3. Accumulate
      currentSentenceText += curr.str;
      currentRects.push(rect);

      // 4. Split Check (Regex)
      // Check if the current buffer effectively ends a sentence?
      // The Spec says: "텍스트 버퍼에 쌓인 문자열이 문장 종결 패턴과 일치할 때만 문장 객체를 생성"
      // We check the whole accumulation so far.
      if (this.SENTENCE_SPLIT_REGEX.test(currentSentenceText)) {
        flushSentence();
      }
    }

    // Flush remaining
    flushSentence();

    return sentences;
  }

  /**
   * Converts a PDF TextItem to our standardized PDFRect (Top-Left Origin).
   */
  private calculateRect(item: TextItemWithStyle, pageHeight: number): PDFRect {
    const x = item.transform[4];
    const pdfY = item.transform[5];
    const width = item.width;
    const height = item.height || (item.transform[0] || 10);

    // Convert PDF Y (Bottom-Left) to Top-Left Y
    // y_top = pageHeight - y_bottom - height
    const top = pageHeight - pdfY - height;

    return {
      x,
      y: top,
      width,
      height
    };
  }
}
