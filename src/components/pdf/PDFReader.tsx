import { useState, useEffect, useRef } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { PDF_CONFIG } from '@/config/constants';

import { useTranslation } from '@/hooks/useTranslation';
import { useTextSelection } from '@/hooks/useTextSelection';
import { useMultiAlert } from '@/hooks/useMultiAlert';
import { usePDFStorage } from '@/hooks/usePDFStorage';
import { usePageTranslation } from '@/hooks/usePageTranslation';
import { extractOutlineDirectly } from '@/utils/outlineUtils';

import type { OutlineItem, OutlineDestination, RecentFile, HydratedSentence } from '@/types';
import { Sidebar, PDFControls } from './';
import HighlightingLayer from './HighlightingLayer';
import { FileDropArea, MultiStackAlert } from '@/components/common';
import { TranslationPopup } from '../';

import alertService from '@/services/AlertService';

pdfjs.GlobalWorkerOptions.workerSrc = PDF_CONFIG.WORKER_SRC;

const PDFReader = () => {

    const [file, setFile] = useState<File | string | Blob | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDragOver, setIsDragOver] = useState(false);

    const {
        translation,
        isTranslating: isTranslatingSelection,
        isSaved,
        wordDetails,
        showTranslation,
        translateText,
        addToWordbook,
        resetTranslation
    } = useTranslation();

    const {
        selection: textSelection,
        popupPosition,
        clearSelection
    } = useTextSelection(resetTranslation);

    const {
        alerts,
        addAlert,
        clearAlert
    } = useMultiAlert();

    useEffect(() => {
        alertService.register(addAlert);
    }, [addAlert]);

    const {
        recentFiles,
        loadRecentFiles,
        saveRecentFile,
        removeRecentFile,
        openRecentFile,
        updateLastPage,
        formatFileSize,
        formatDate
    } = usePDFStorage();

    const {
        currentPageData,
        isTranslating,
        error,
        loadPageAndTranslate,
    } = usePageTranslation({
        pdf: pdfDocument,
        currentPage: pageNumber,
        docId: pdfDocument?.fingerprints[0] || '',
    });

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const pdfUrl = urlParams.get('pdf');

        if (pdfUrl) {
            console.log('PDF URL parameter detected:', pdfUrl);
        }

        loadRecentFiles();
    }, [loadRecentFiles]);



    useEffect(() => {
        if (textSelection.text) {
            translateText(textSelection.text).catch((error: Error) => {
                if (error.message?.includes('Extension context invalidated') ||
                    error.message?.includes('확장 프로그램이 업데이트되었습니다')) {
                    addAlert('확장 프로그램이 업데이트되었습니다. 페이지를 새로고침 해주세요.', 'destructive');
                } else {
                    addAlert(error.message || '번역 오류가 발생했습니다.', 'destructive');
                }
            });
        }
    }, [textSelection.text, translateText, addAlert]);

    const handleDocumentLoadSuccess = (pdf: PDFDocumentProxy) => {
        setNumPages(pdf.numPages);
        setPdfDocument(pdf);
        extractOutlineDirectly(pdf).then(setOutline);
    };
    const handlePageChange = (newPage: number) => {
        if (!isNaN(newPage) && newPage >= 1 && newPage <= numPages) {
            setPageNumber(newPage);
            updateLastPage(file, newPage);
        }
    };

    const onDocumentLoadError = (error: Error) => {
        console.error('PDF loading error:', error);
        addAlert(`PDF 로딩 실패: ${error.message}\n파일이 손상되지 않았는지 확인해주세요.`, 'destructive');
    };

    const handleOutlineClick = async (dest: OutlineDestination | string, _title: string, pageNumber?: number) => {
        let targetPage: number | undefined;

        if (pageNumber) {
            targetPage = pageNumber;
        } else if (dest && typeof dest === 'object' && 'num' in dest && dest.num !== undefined) {
            targetPage = dest.num + 1;
        } else if (typeof dest === 'string') {
            if (pdfDocument) {
                try {
                    const namedDest = await pdfDocument.getDestination(dest);
                    if (namedDest) {
                        const page = await pdfDocument.getPageIndex(namedDest[0]);
                        targetPage = page + 1;
                    } else {
                        console.warn(`Named destination "${dest}" not found.`);
                    }
                } catch (error) {
                    console.error('Error resolving named destination:', error);
                }
            } else {
                console.warn('PDF document not loaded, cannot resolve named destination.');
            }
        }

        if (targetPage !== undefined) {
            setPageNumber(targetPage);
            updateLastPage(file, targetPage);
        } else {
            console.warn('Could not determine target page for outline item.');
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files[0] && files[0].type === 'application/pdf') {
            const selectedFile = files[0];
            setFile(selectedFile);
            saveRecentFile(selectedFile, 1);

            setPageNumber(1);
            resetTranslation();
            clearSelection();
            setOutline([]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files[0]) {
            const selectedFile = files[0];
            setFile(selectedFile);
            saveRecentFile(selectedFile, 1);

            setPageNumber(1);
            resetTranslation();
            clearSelection();
            setOutline([]);
        }
    };

    const handleOpenRecentFile = async (recentFile: RecentFile) => {
        const fileData = await openRecentFile(recentFile);
        if (fileData) {
            setFile(fileData);
            setPageNumber(recentFile.lastPage);
        }
    };

    const handleNewFileSelect = (file: File) => {
        setFile(file);
        saveRecentFile(file, 1);

        setPageNumber(1);
        resetTranslation();
        clearSelection();
        setOutline([]);
    };

    const handleAddToWordbook = () => {
        addToWordbook(textSelection.text, translation);
        clearSelection();
    };

    const handlePageReload = () => {
        window.location.reload();
    };

    // Use hydrated sentences if available, otherwise fallback to parsed sentences (with null translation)
    // This allows hitboxes to render immediately (Req-5) before translation arrives.
    const sentences = currentPageData?.hydratedSentences ||
        (currentPageData?.parsedData?.sentences?.map(s => ({ ...s, translatedText: null })) as HydratedSentence[]) ||
        [];
    const sentenceRefs = useRef<(HTMLDivElement | null)[]>([]);

    const handleSentenceHover = (id: number | null) => {
        setHoveredIndex(id);
        if (id !== null && sentenceRefs.current[id]) {
            sentenceRefs.current[id]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden w-full">
            <MultiStackAlert
                alerts={alerts}
                onClearAlert={clearAlert}
            />

            {popupPosition && (
                <TranslationPopup
                    position={popupPosition}
                    selectedText={textSelection.text}
                    translation={translation}
                    isTranslating={isTranslatingSelection}
                    isSaved={isSaved}
                    wordDetails={wordDetails}
                    showTranslation={showTranslation}
                    onAddToWordbook={handleAddToWordbook}
                    onReloadPage={handlePageReload}
                />
            )}

            {!file ? (
                <FileDropArea
                    isDragOver={isDragOver}
                    recentFiles={recentFiles}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onFileSelect={handleFileSelect}
                    onOpenRecentFile={handleOpenRecentFile}
                    onRemoveRecentFile={removeRecentFile}
                    formatFileSize={formatFileSize}
                    formatDate={formatDate}
                />
            ) : (
                <>
                    <Sidebar
                        isSidebarOpen={isSidebarOpen}
                        outline={outline}
                        totalPages={numPages}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        onOutlineItemClick={handleOutlineClick}
                    />

                    <div className="flex-1 flex flex-col min-h-0 w-0">
                        <div className="flex-1 flex overflow-hidden">
                            {/* PDF Side (Left) */}
                            <div className="w-1/2 min-w-0 overflow-y-auto bg-gray-50 p-4">
                                <div className="bg-white shadow-lg border border-gray-200 rounded-lg flex justify-center p-4">
                                    <div className="flex flex-col items-center relative">
                                        <Document
                                            file={file}
                                            onLoadSuccess={handleDocumentLoadSuccess}
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
                                                    onSentenceHover={handleSentenceHover}
                                                    scale={PDF_CONFIG.SCALE}
                                                />
                                            </Page>
                                        </Document>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="w-px bg-gray-300"></div>

                            {/* Translation Side (Right) */}
                            <div className="w-1/2 min-w-0 flex flex-col">
                                <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between flex-shrink-0">
                                    <h3 className="font-semibold text-gray-800 text-sm">번역</h3>
                                    <div className="flex items-center space-x-2">
                                        {isTranslating && (
                                            <div className="flex items-center text-xs text-blue-600">
                                                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                                                번역 중...
                                            </div>
                                        )}
                                        <div className="text-xs text-gray-600">
                                            {sentences.length} 문장
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <p className="text-sm text-red-600">{error}</p>

                                        </div>
                                    )}

                                    {isTranslating && sentences.length === 0 ? (
                                        <div className="flex items-center justify-center h-32">
                                            <div className="flex flex-col items-center text-gray-500">
                                                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                                                <p className="text-sm">페이지 번역 중...</p>
                                            </div>
                                        </div>
                                    ) : sentences.length === 0 && !error ? (
                                        <div className="text-gray-500 text-sm text-center py-8">
                                            번역된 문장이 없습니다
                                        </div>
                                    ) : (
                                        sentences.map((sentence) => (
                                            <div
                                                key={sentence.id}
                                                ref={(el) => {
                                                    sentenceRefs.current[sentence.id] = el;
                                                }}
                                                className={`border-b border-gray-100 pb-3 last:border-b-0 transition-colors ${hoveredIndex === sentence.id ? 'bg-blue-50' : ''}`}
                                                onMouseEnter={() => setHoveredIndex(sentence.id)}
                                                onMouseLeave={() => setHoveredIndex(null)}
                                            >
                                                <div className="space-y-2">
                                                    <p className="text-sm text-gray-800 leading-relaxed">
                                                        {sentence.sourceText}
                                                    </p>
                                                    {sentence.translatedText ? (
                                                        <p className="text-sm text-blue-700 leading-relaxed bg-blue-50 p-2 rounded">
                                                            {sentence.translatedText}
                                                        </p>
                                                    ) : (
                                                        <div className="flex items-center py-2">
                                                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                            <span className="text-sm text-gray-600">번역 중...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
                            <PDFControls
                                pageNumber={pageNumber}
                                numPages={numPages}
                                onPageChange={handlePageChange}
                                onFileSelect={handleNewFileSelect}
                                isTranslating={isTranslating}
                                translationError={error}
                                isTranslationFailed={!!error}
                                onRetryTranslation={() => loadPageAndTranslate(pageNumber)}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PDFReader;
