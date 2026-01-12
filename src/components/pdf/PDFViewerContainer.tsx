import React from 'react';
import { Document, Page } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDF_CONFIG } from '@/config/constants';
import HighlightingLayer from './HighlightingLayer';
import type { HydratedSentence } from '@/types';

interface PDFViewerContainerProps {
    file: File | string | Blob | null;
    pageNumber: number;
    onDocumentLoadSuccess: (pdf: PDFDocumentProxy) => void;
    onDocumentLoadError: (error: Error) => void;
    sentences: HydratedSentence[];
    hoveredIndex: number | null;
    onSentenceHover: (id: number | null) => void;
    highlightRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

const PDFViewerContainer: React.FC<PDFViewerContainerProps> = ({
    file,
    pageNumber,
    onDocumentLoadSuccess,
    onDocumentLoadError,
    sentences,
    hoveredIndex,
    onSentenceHover,
    highlightRefs
}) => {
    return (
        <div className="bg-white shadow-lg border border-gray-200 rounded-lg flex justify-center p-4">
            <div className="flex flex-col items-center relative">
                <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    className="flex flex-col items-center"
                    loading={<div className="text-gray-500 animate-pulse">Loading PDF...</div>}
                    error={<div className="text-red-500">Failed to load PDF.</div>}
                >
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false} // We are rendering our own layer
                        renderAnnotationLayer={false}
                        scale={PDF_CONFIG.SCALE}
                        className="max-w-full"
                    >
                        <HighlightingLayer
                            sentences={sentences}
                            hoveredIndex={hoveredIndex}
                            onSentenceHover={onSentenceHover}
                            scale={PDF_CONFIG.SCALE}
                            highlightRefs={highlightRefs}
                        />
                    </Page>
                </Document>
            </div>
        </div>
    );
};

export default PDFViewerContainer;
