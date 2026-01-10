interface TextStyle {
  color: string;
  isBold: boolean;
  isItalic: boolean;
  fontSize: number;
  fontFamily: string;
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

interface SentenceAssemblyOptions {
  sentenceEndings?: string[];
  enableNoiseFiltering?: boolean;
  pageNumberPattern?: RegExp;
  headerFooterPattern?: RegExp;
}

export class PDFTextAssembler {
  private options: Required<SentenceAssemblyOptions>;

  constructor(options: SentenceAssemblyOptions = {}) {
    this.options = {
      sentenceEndings: ['.', '!', '?', '.', '！', '？'],
      enableNoiseFiltering: options.enableNoiseFiltering ?? true,
      pageNumberPattern: options.pageNumberPattern ?? /^(\d+|\d+\s*\/\s*\d+|(Page|p\.|page)\s*\d+)$/i,
      headerFooterPattern: options.headerFooterPattern ?? /^(.{0,30})\s*(\d+|\d+\s*\/\s*\d+)$|^.{0,30}$/,
    };
  }

  assembleSentences(fragments: TextFragment[]): string[] {
    if (!fragments.length) return [];

    const cleanedText = this.mergeFragments(fragments);
    const filteredText = this.options.enableNoiseFiltering
      ? this.filterNoise(cleanedText)
      : cleanedText;

    return this.splitIntoSentences(filteredText);
  }

  private mergeFragments(fragments: TextFragment[]): string {
    if (!fragments.length) return '';

    let mergedText = '';
    let lastX: number | null = null;
    let lastY: number | null = null;

    for (const fragment of fragments) {
      const currentText = fragment.text.trim();
      if (!currentText) continue;

      if (fragment.position && lastX !== null && lastY !== null) {
        const distance = Math.sqrt(
          Math.pow(fragment.position.x - lastX, 2) +
          Math.pow(fragment.position.y - lastY, 2)
        );

        if (distance > 10) {
          if (mergedText.endsWith('-')) {
            mergedText = mergedText.slice(0, -1) + currentText;
          } else {
            mergedText += ' ' + currentText;
          }
        } else {
          mergedText += currentText;
        }
        lastX = fragment.position.x + fragment.position.width;
        lastY = fragment.position.y;
      } else {
        if (mergedText && !mergedText.endsWith('-')) {
          mergedText += ' ';
        }
        mergedText += currentText;
      }
    }

    return this.cleanupText(mergedText);
  }

  private cleanupText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/-\s+/g, '')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/([,.!?;:])\s+/g, '$1 ')
      .replace(/\s+$/, '')
      .replace(/^\s+/, '');
  }

  private filterNoise(text: string): string {
    const lines = text.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return true;

      if (this.options.pageNumberPattern.test(trimmedLine)) {
        return false;
      }

      if (trimmedLine.length < 10 && this.options.headerFooterPattern.test(trimmedLine)) {
        return false;
      }

      return true;
    });

    return filteredLines.join('\n');
  }

  private splitIntoSentences(text: string): string[] {
    const sentences: string[] = [];
    let currentSentence = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      currentSentence += char;

      if (this.options.sentenceEndings.includes(char)) {
        const trimmedSentence = currentSentence.trim();
        if (trimmedSentence) {
          sentences.push(trimmedSentence);
          currentSentence = '';
        }
      }
    }

    const remaining = currentSentence.trim();
    if (remaining) {
      sentences.push(remaining);
    }

    return sentences.filter(sentence =>
      !this.options.pageNumberPattern.test(sentence)
    );
  }

  static extractTextFragments(element: Element): TextFragment[] {
    const fragments: TextFragment[] = [];
    const spans = element.querySelectorAll('span[role="presentation"]');

    spans.forEach(span => {
      const text = span.textContent || '';
      if (!text.trim()) return;

      const rect = span.getBoundingClientRect();
      const style = window.getComputedStyle(span);

      fragments.push({
        text: text,
        style: {
          color: style.color,
          isBold: style.fontWeight === 'bold' || parseInt(style.fontWeight) > 500,
          isItalic: style.fontStyle === 'italic',
          fontSize: parseFloat(style.fontSize),
          fontFamily: style.fontFamily
        },
        position: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        }
      });
    });

    return fragments;
  }
}

export function assembleSentences(
  fragments: TextFragment[],
  options?: SentenceAssemblyOptions
): string[] {
  const assembler = new PDFTextAssembler(options);
  return assembler.assembleSentences(fragments);
}

export function extractAndAssembleSentences(
  element: Element,
  options?: SentenceAssemblyOptions
): string[] {
  const fragments = PDFTextAssembler.extractTextFragments(element);
  return assembleSentences(fragments, options);
}

export type { TextFragment, TextStyle };