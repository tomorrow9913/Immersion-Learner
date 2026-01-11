import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { OutlineItem } from '@/types';
import { Logger } from './logger';

type Ref = any;
type PdfJsOutlineDestination = [Ref, { name: string }, ...any[]];

export const processOutlineWithPageNumbers = async (
  outlineItems: any[],
  pdf: PDFDocumentProxy
): Promise<OutlineItem[]> => {
  const processed: OutlineItem[] = [];

  for (const item of outlineItems) {
    let pageNumber: number | undefined = undefined;
    const dest = item.dest as PdfJsOutlineDestination | string;

    try {
      let pageRef: Ref | undefined = undefined;

      if (typeof dest === 'string') {
        const resolvedDest = await pdf.getDestination(dest);
        if (resolvedDest && resolvedDest[0]) {
            pageRef = resolvedDest[0] as Ref;
        }
      } else if (Array.isArray(dest) && dest[0]) {
        pageRef = dest[0];
      }

      if (pageRef) {
        const pageIndex = await pdf.getPageIndex(pageRef);
        pageNumber = pageIndex + 1;
      }
    } catch (e) {
      Logger.warn('Failed to resolve page number for outline item:', item.title, e);
    }
    
    const processedItem: OutlineItem = {
      ...item,
      pageNumber: pageNumber,
    };
    
    if (item.items && item.items.length > 0) {
      processedItem.items = await processOutlineWithPageNumbers(item.items, pdf);
    }
    
    processed.push(processedItem);
  }
  
  return processed;
};

export const extractOutlineDirectly = async (pdf: PDFDocumentProxy): Promise<OutlineItem[]> => {
  try {
    const outline = await pdf.getOutline();
    
    if (outline) {
      return await processOutlineWithPageNumbers(outline, pdf);
    } else {
      return [];
    }
  } catch (error) {
    Logger.warn('Failed to extract outline:', error);
    return [];
  }
};