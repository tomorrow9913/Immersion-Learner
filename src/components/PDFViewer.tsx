import React from 'react';
import { Document, Page } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDF_CONFIG } from '@/config/constants';

interface PDFViewerProps {
  file: File | string | Blob | null;
  pageNumber: number;
  onDocumentLoadSuccess: (pdf: PDFDocumentProxy) => void;
  onDocumentLoadError: (error: Error) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  pageNumber,
  onDocumentLoadSuccess,
  onDocumentLoadError
}) => {
  if (!file) {
    return (
      <div className="max-w-5xl mx-auto bg-white shadow-lg p-4 border border-gray-200 rounded-lg flex justify-center min-h-[600px] relative">
        <div className="text-gray-500 text-center py-20">
          PDF 파일을 선택해주세요
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto bg-white shadow-lg p-4 border border-gray-200 rounded-lg flex justify-center min-h-[600px] relative">
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
          renderTextLayer={true} 
          renderAnnotationLayer={true}
          scale={PDF_CONFIG.SCALE}
        />
      </Document>
    </div>
  );
};

export default PDFViewer;