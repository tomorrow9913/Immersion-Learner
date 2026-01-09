import { PDFCoordinateMapper, extractSentencePositions, findSentencePosition } from '../pdfCoordinateMapper';
import type { TextFragment } from '../pdfTextAssembler';

describe('PDFCoordinateMapper', () => {
  let mockContainer: HTMLElement;
  let mapper: PDFCoordinateMapper;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    Object.defineProperty(mockContainer, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 50, width: 800, height: 600 })
    });

    mapper = new PDFCoordinateMapper({
      pageScale: 1.5,
      pageOffset: { x: 10, y: 20 },
      containerElement: mockContainer
    });
  });

  describe('sentence position extraction', () => {
    it('should generate unique sentence IDs', () => {
      const fragments: TextFragment[] = [
        { 
          text: 'First sentence.', 
          position: { x: 10, y: 10, width: 100, height: 15 },
          style: { color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }
        },
        { 
          text: 'Second sentence.', 
          position: { x: 10, y: 30, width: 120, height: 15 },
          style: { color: '#333333', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }
        }
      ];

      const positions = mapper.extractSentencePositions(fragments, 1);
      
      expect(positions).toHaveLength(2);
      expect(positions[0].id).toBe('p1_s1');
      expect(positions[1].id).toBe('p1_s2');
    });

    it('should track multiple rects for multi-line sentences', () => {
      const fragments: TextFragment[] = [
        { 
          text: 'Multi-', 
          position: { x: 10, y: 10, width: 50, height: 15 },
          style: { color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }
        },
        { 
          text: 'line', 
          position: { x: 60, y: 30, width: 40, height: 15 },
          style: { color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }
        },
        { 
          text: 'sentence.', 
          position: { x: 10, y: 50, width: 80, height: 15 },
          style: { color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }
        }
      ];

      const positions = mapper.extractSentencePositions(fragments, 1);
      
      expect(positions[0].rects).toHaveLength(3);
      expect(positions[0].text).toBe('Multi-line sentence.');
    });

    it('should handle hyphenated words correctly', () => {
      const fragments: TextFragment[] = [
        { 
          text: 'conn-', 
          position: { x: 10, y: 10, width: 60, height: 15 },
          style: { color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }
        },
        { 
          text: 'ection', 
          position: { x: 70, y: 30, width: 50, height: 15 },
          style: { color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }
        }
      ];

      const positions = mapper.extractSentencePositions(fragments, 1);
      
      expect(positions[0].text).toBe('connection');
    });
  });

  describe('coordinate transformation', () => {
    it('should transform PDF coordinates to screen coordinates', () => {
      const pdfPosition = { x: 100, y: 200, width: 50, height: 15 };
      const screenRect = mapper.transformPDFToScreenCoordinates(pdfPosition);

      expect(screenRect.left).toBe(100 + 100 * 1.5);
      expect(screenRect.top).toBe(50 + 20 + 200 * 1.5);
      expect(screenRect.width).toBe(50 * 1.5);
      expect(screenRect.height).toBe(15 * 1.5);
    });

    it('should transform screen coordinates back to PDF coordinates', () => {
      const createMockRect = (left: number, top: number, width: number, height: number) => ({
        left, top, width, height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top
      } as DOMRect);

      const screenRect = createMockRect(250, 370, 75, 22.5);
      const pdfCoords = mapper.transformScreenToPDFCoordinates(screenRect);

      expect(pdfCoords.x).toBeCloseTo(100);
      expect(pdfCoords.y).toBeCloseTo(200);
      expect(pdfCoords.width).toBeCloseTo(50);
      expect(pdfCoords.height).toBeCloseTo(15);
    });
  });

  describe('sentence search', () => {
    it('should find sentence by ID', () => {
      const createMockRect = (left: number, top: number, width: number, height: number) => ({
        left, top, width, height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top
      } as DOMRect);

      const sentences = [
        { 
          id: 'p1_s1', 
          text: 'First', 
          rects: [createMockRect(100, 100, 50, 15)], 
          pageNumber: 1, 
          scale: 1.5,
          styles: [{ color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }]
        },
        { 
          id: 'p1_s2', 
          text: 'Second', 
          rects: [createMockRect(200, 200, 50, 15)], 
          pageNumber: 1, 
          scale: 1.5,
          styles: [{ color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }]
        }
      ];

      const found = mapper.findSentenceById('p1_s2', sentences);
      
      expect(found).not.toBeNull();
      expect(found?.text).toBe('Second');
      
      const notFound = mapper.findSentenceById('p1_s3', sentences);
      expect(notFound).toBeNull();
    });

    it('should find sentences by screen point', () => {
      const createMockRect = (left: number, top: number, width: number, height: number) => ({
        left, top, width, height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top
      } as DOMRect);

      const sentences = [
        { 
          id: 'p1_s1', 
          text: 'First', 
          rects: [createMockRect(100, 100, 50, 15)], 
          pageNumber: 1, 
          scale: 1.5,
          styles: [{ color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }]
        },
        { 
          id: 'p1_s2', 
          text: 'Second', 
          rects: [createMockRect(200, 200, 50, 15)], 
          pageNumber: 1, 
          scale: 1.5,
          styles: [{ color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }]
        }
      ];

      const foundSentences = mapper.findSentencesByScreenPoint(
        { x: 110, y: 105 }, 
        sentences
      );
      
      expect(foundSentences).toHaveLength(1);
      expect(foundSentences[0].id).toBe('p1_s1');
    });
  });

  describe('bounding box calculation', () => {
    it('should calculate correct bounding box for multi-rect sentence', () => {
      const createMockRect = (left: number, top: number, width: number, height: number) => ({
        left, top, width, height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top
      } as DOMRect);

      const sentence = {
        id: 'p1_s1',
        text: 'Multi-line',
        rects: [
          createMockRect(100, 100, 50, 15),
          createMockRect(200, 130, 60, 15),
          createMockRect(150, 160, 40, 15)
        ],
        pageNumber: 1,
        scale: 1.5,
        styles: [{ color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }]
      };

      const boundingRect = mapper.getBoundingRect(sentence);

      expect(boundingRect.left).toBe(100);
      expect(boundingRect.top).toBe(100);
      expect(boundingRect.width).toBe(160);
      expect(boundingRect.height).toBe(75);
    });
  });

  describe('highlight layer creation', () => {
    it('should create highlight elements for sentences', () => {
      const createMockRect = (left: number, top: number, width: number, height: number) => ({
        left, top, width, height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top
      } as DOMRect);

      const sentences = [
        { 
          id: 'p1_s1', 
          text: 'Test', 
          rects: [createMockRect(100, 100, 50, 15)], 
          pageNumber: 1, 
          scale: 1.5,
          styles: [{ color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }]
        }
      ];

      const highlightLayer = mapper.createHighlightLayer(sentences);

      expect(highlightLayer.className).toBe('pdf-highlight-layer');
      expect(highlightLayer.querySelector('#p1_s1')).not.toBeNull();
    });
  });
});

describe('convenience functions', () => {
  it('should extract positions using convenience function', () => {
    const fragments: TextFragment[] = [
      { 
        text: 'Test sentence.', 
        position: { x: 10, y: 10, width: 100, height: 15 },
        style: { color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }
      }
    ];

    const positions = extractSentencePositions(fragments, 1, {
      pageScale: 1,
      pageOffset: { x: 0, y: 0 },
      containerElement: document.body
    });

    expect(positions).toHaveLength(1);
    expect(positions[0].id).toBe('p1_s1');
  });

  it('should find position using convenience function', () => {
    const createMockRect = (left: number, top: number, width: number, height: number) => ({
        left, top, width, height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top
      } as DOMRect);

    const sentences = [
      { 
        id: 'p1_s1', 
        text: 'Test', 
        rects: [createMockRect(0, 0, 50, 15)], 
        pageNumber: 1, 
        scale: 1,
        styles: [{ color: '#000000', isBold: false, isItalic: false, fontSize: 12, fontFamily: 'Arial' }]
      }
    ];

    const found = findSentencePosition('p1_s1', sentences);
    expect(found?.text).toBe('Test');
  });
});