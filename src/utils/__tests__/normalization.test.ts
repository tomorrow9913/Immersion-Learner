import { describe, it, expect } from 'vitest';
import { PDFTextProcessor } from '../pdfTextProcessor';
import type { TextFragment } from '../pdfTextAssembler';

// A helper to create a TextFragment with default values
const createFragment = (text: string): TextFragment => ({
  text,
  style: {
    color: '',
    isBold: false,
    isItalic: false,
    fontSize: 10,
    fontFamily: 'sans-serif',
  },
  position: { x: 0, y: 0, width: 0, height: 0 },
});

describe('PDFTextProcessor Normalization Matching', () => {
  const processor = PDFTextProcessor.getInstance();

  it('should match a sentence split by a hyphen and newline', () => {
    const fragments = [
      createFragment('busi-'),
      createFragment('ness'),
    ];
    const sentence = 'Business';
    // @ts-ignore
    const result = processor.findFragmentsForSentenceOptimized(sentence, fragments);
    expect(result.length).toBe(2);
    expect(result.map(f => f.text).join('')).toBe('busi-ness');
  });

  it('should match a sentence with multiple spaces between words', () => {
    const fragments = [
      createFragment('Hello'),
      createFragment('   '),
      createFragment('World'),
    ];
    const sentence = 'Hello World';
    // @ts-ignore
    const result = processor.findFragmentsForSentenceOptimized(sentence, fragments);
    expect(result.length).toBe(3);
    expect(result.map(f => f.text).join('')).toBe('Hello   World');
  });

  it('should match sentence with mixed spacing and hyphens', () => {
    const fragments = [
        createFragment('This is a sen-'),
        createFragment('tence with'),
        createFragment(' many   spaces.'),
    ];
    const sentence = 'This is a sentence with many spaces.';
    // @ts-ignore
    const result = processor.findFragmentsForSentenceOptimized(sentence, fragments);
    expect(result.length).toBe(3);
  });

  it('should not match if fragments are in wrong order', () => {
    const fragments = [
        createFragment('World'),
        createFragment('Hello'),
    ];
    const sentence = 'Hello World';
    // @ts-ignore
    const result = processor.findFragmentsForSentenceOptimized(sentence, fragments);
    expect(result.length).toBe(0);
  });
  
  it('should match a sentence that is a substring of the combined fragments', () => {
    const fragments = [
        createFragment('Some leading text. '),
        createFragment('The actual sentence starts here.'),
        createFragment(' Some trailing text.'),
    ];
    const sentence = 'The actual sentence starts here.';
    // @ts-ignore
    const result = processor.findFragmentsForSentenceOptimized(sentence, fragments);
    expect(result.length).toBe(1);
    expect(result[0].text).toBe('The actual sentence starts here.');
  });
  
  it('should handle complex case with multiple matches and pick the first correct one', () => {
    const fragments = [
      createFragment('First sentence. '),
      createFragment('Second sen-'),
      createFragment('tence. '),
      createFragment('Another second sentence.'),
    ];
    const sentence = 'Second sentence.';
    // @ts-ignore
    const result = processor.findFragmentsForSentenceOptimized(sentence, fragments);
    expect(result.length).toBe(2);
    expect(result.map(r => r.text).join('')).toBe('Second sen-tence. ');
  });

  it('should return an empty array if no match is found', () => {
    const fragments = [
      createFragment('This is'),
      createFragment('a test.'),
    ];
    const sentence = 'A different sentence.';
    // @ts-ignore
    const result = processor.findFragmentsForSentenceOptimized(sentence, fragments);
    expect(result.length).toBe(0);
  });

});
