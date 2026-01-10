/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { PDFRect, ParsedPageData, ParsedSentence } from '../types';

// --- Interfaces ---

interface TextItemWithStyle extends TextItem {
  fontName: string;
  // `transform` is [scaleX, skewY, skewX, scaleY, x, y]
}

interface ProcessedLine {
  text: string;
  rect: PDFRect;
  y: number;
}

interface AssemblerOptions {
  noiseCharsThreshold: number;
  yTolerance: number;
  sentenceEndings: string[];
}

// --- Main Class ---

export class PDFTextAssembler {
  private readonly options: AssemblerOptions;

  constructor(options: Partial<AssemblerOptions> = {}) {
    this.options = {
      noiseCharsThreshold: 10,
      yTolerance: 5,
      sentenceEndings: ['.', '!', '?', '。', '！', '？'],
      ...options,
    };
  }

  /**
   * Main method to process a page's text content.
   * @param page - The PDFPageProxy object from PDF.js.
   * @param pageNumber - The 1-based index of the page.
   * @returns A ParsedPageData object containing structured sentences.
   */
  public async processPage(page: any, pageNumber: number): Promise<ParsedPageData> {
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    if (!textContent.items || textContent.items.length === 0) {
      return { pageNumber, sentences: [] };
    }

    const items = textContent.items as TextItemWithStyle[];

    // 1. Sort items into visual reading order
    const sortedItems = this.sortItems(items);

    // 2. Merge items into lines
    const lines = this.mergeItemsIntoLines(sortedItems, viewport.height);

    // 3. Filter out noise (headers, footers, page numbers)
    const filteredLines = this.filterNoiseLines(lines);

    // 4. Assemble lines into sentences
    const sentences = this.assembleLinesIntoSentences(filteredLines);

    return { pageNumber, sentences };
  }

  /**
   * Sorts TextItem objects by their visual position (top-to-bottom, left-to-right).
   */
  private sortItems(items: TextItemWithStyle[]): TextItemWithStyle[] {
    return [...items].sort((a, b) => {
      const yA = a.transform[5];
      const yB = b.transform[5];
      const xA = a.transform[4];
      const xB = b.transform[4];

      // Use a tolerance for Y-coordinate comparison
      if (Math.abs(yA - yB) > this.options.yTolerance) {
        return yB - yA; // Higher Y value (lower on page) comes first
      }
      return xA - xB; // Left-to-right
    });
  }

  /**
   * Merges sorted TextItem objects into lines, creating a bounding box for each.
   */
  private mergeItemsIntoLines(
    items: TextItemWithStyle[],
    pageHeight: number,
  ): ProcessedLine[] {
    const lines: ProcessedLine[] = [];
    if (items.length === 0) return lines;

    let currentLineItems: TextItemWithStyle[] = [items[0]];

    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];

      // Check if items are on the same line (Y-coordinate is similar)
      if (Math.abs(curr.transform[5] - prev.transform[5]) < this.options.yTolerance) {
        currentLineItems.push(curr);
      } else {
        // New line detected, process the previous one
        if (currentLineItems.length > 0) {
          lines.push(this.createLine(currentLineItems, pageHeight));
        }
        currentLineItems = [curr];
      }
    }
    // Process the last line
    if (currentLineItems.length > 0) {
      lines.push(this.createLine(currentLineItems, pageHeight));
    }
    return lines;
  }

  /**
   * Creates a ProcessedLine object from a set of TextItems.
   */
  private createLine(items: TextItemWithStyle[], pageHeight: number): ProcessedLine {
    const text = items.map((item) => item.str).join(' ');
    const firstItem = items[0];
    const lastItem = items[items.length - 1];

    const x = firstItem.transform[4];
    const y = pageHeight - firstItem.transform[5] - firstItem.height; // Convert to top-down coordinates
    const width = lastItem.transform[4] + lastItem.width - x;
    const height = Math.max(...items.map((item) => item.height));

    const rect: PDFRect = { x, y, width, height };

    return { text, rect, y: rect.y };
  }

  /**
   * Filters out lines that are likely headers, footers, or page numbers.
   */
  private filterNoiseLines(lines: ProcessedLine[]): ProcessedLine[] {
    if (lines.length < 3) return lines;

    const contentHeight = lines[lines.length - 1].y - lines[0].y;
    const headerThreshold = lines[0].y + contentHeight * 0.1;
    const footerThreshold = lines[lines.length - 1].y - contentHeight * 0.1;

    return lines.filter((line) => {
      // Basic heuristic: filter lines that are short and in the top/bottom 10% of the page
      const isShort = line.text.trim().length < this.options.noiseCharsThreshold;
      const isHeader = line.y < headerThreshold && isShort;
      const isFooter = line.y > footerThreshold && isShort;

      // Filter out lines that look like a page number
      if (/^\d+\s*$/.test(line.text.trim())) {
        return false;
      }

      return !isHeader && !isFooter;
    });
  }

  /**
   * Assembles processed lines into sentences based on punctuation.
   */
  private assembleLinesIntoSentences(lines: ProcessedLine[]): ParsedSentence[] {
    const sentences: ParsedSentence[] = [];
    let sentenceId = 0;
    let currentText = '';
    let currentRects: PDFRect[] = [];

    const flushSentence = () => {
      const cleanedText = this.cleanText(currentText);
      if (cleanedText) {
        sentences.push({
          id: sentenceId++,
          sourceText: cleanedText,
          rects: [...currentRects],
        });
      }
      currentText = '';
      currentRects = [];
    };

    for (const line of lines) {
      if (!line.text.trim()) continue;

      // Add space between lines, handling hyphenation
      if (currentText && !currentText.endsWith('-')) {
        currentText += ' ';
      }
      if (currentText.endsWith('-')) {
        currentText = currentText.slice(0, -1);
      }

      currentText += line.text;
      currentRects.push(line.rect);

      const lastChar = line.text.trim().slice(-1);
      if (this.options.sentenceEndings.includes(lastChar)) {
        flushSentence();
      }
    }

    // Flush any remaining text
    if (currentText.trim()) {
      flushSentence();
    }

    return sentences;
  }

  /**
   * Cleans up final sentence text.
   */
  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}