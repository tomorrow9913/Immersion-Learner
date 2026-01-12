import { useState, useEffect, useRef } from 'react';
import { pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PanelLeft } from 'lucide-react'; 
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

import { PDF_CONFIG } from '@/config/constants';

import { useTranslation } from '@/hooks/useTranslation';
import { useTextSelection } from '@/hooks/useTextSelection';
import { useMultiAlert } from '@/hooks/useMultiAlert';
import { usePDFStorage } from '@/hooks/usePDFStorage';
import { usePageTranslation } from '@/hooks/usePageTranslation';
import { usePDFResize } from '@/hooks/usePDFResize'; 
import { extractOutlineDirectly } from '@/utils/outlineUtils';

import type { OutlineItem, OutlineDestination, RecentFile, HydratedSentence } from '@/types';
import { Sidebar, PDFControls, PDFViewerContainer, TranslationPanel } from './';
import { FileDropArea, MultiStackAlert } from '@/components/common';
import { TranslationPopup } from '../';

import alertService from '@/services/AlertService';
import { Logger } from '@/utils/logger';

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

    const containerRef = useRef<HTMLDivElement>(null);
    const {
        pdfPanelWidth,
        isTranslationCollapsed,
        handleMouseDown,
        toggleTranslationPanel
    } = usePDFResize(containerRef);

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
            Logger.debug('PDF URL parameter detected:', pdfUrl);
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

    const pdfContainerRef = useRef<HTMLDivElement>(null);
    const translationContainerRef = useRef<HTMLDivElement>(null);

    const handleDocumentLoadSuccess = (pdf: PDFDocumentProxy) => {
        setNumPages(pdf.numPages);
        setPdfDocument(pdf);
        extractOutlineDirectly(pdf).then(setOutline);
    };

    const handlePageChange = (newPage: number) => {
        if (!isNaN(newPage) && newPage >= 1 && newPage <= numPages) {
            setPageNumber(newPage);
            updateLastPage(file, newPage);

            pdfContainerRef.current?.scrollTo(0, 0);
            translationContainerRef.current?.scrollTo(0, 0);
        }
    };

    const onDocumentLoadError = (error: Error) => {
        Logger.error(`PDF 로딩 실패: ${error.message}\n파일이 손상되지 않았는지 확인해주세요.`);
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
                        Logger.warn(`Named destination "${dest}" not found.`);
                    }
                } catch (error) {
                    Logger.warn('Error resolving named destination:', error);
                }
            } else {
                Logger.warn('PDF document not loaded, cannot resolve named destination.');
            }
        }

        if (targetPage !== undefined) {
            setPageNumber(targetPage);
            updateLastPage(file, targetPage);
        } else {
            Logger.warn('Could not determine target page for outline item.');
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
    
    const sentences = currentPageData?.hydratedSentences ||
        (currentPageData?.parsedData?.sentences?.map(s => ({ ...s, translatedText: null })) as HydratedSentence[]) ||
        [];
    const highlightRefs = useRef<(HTMLDivElement | null)[]>([]);

    const handleSentenceHover = (id: number | null) => {
        setHoveredIndex(id);
    };

    const handleTranslatedSentenceHover = (id: number | null) => {
        setHoveredIndex(id);
        if (id !== null && highlightRefs.current[id]) {
            highlightRefs.current[id]?.scrollIntoView({
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

                    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 w-0 pb-20 relative">
                        <div className="flex-1 flex overflow-hidden">
                            <div
                                ref={pdfContainerRef}
                                className="min-w-0 overflow-y-auto bg-gray-50 p-4"
                                style={{ width: isTranslationCollapsed ? '100%' : `${pdfPanelWidth}%` }}
                            >
                                <PDFViewerContainer
                                    file={file}
                                    pageNumber={pageNumber}
                                    onDocumentLoadSuccess={handleDocumentLoadSuccess}
                                    onDocumentLoadError={onDocumentLoadError}
                                    sentences={sentences}
                                    hoveredIndex={hoveredIndex}
                                    onSentenceHover={handleSentenceHover}
                                    highlightRefs={highlightRefs}
                                />
                            </div>

                            {!isTranslationCollapsed && (
                                <div
                                    className="w-1.5 bg-gray-300 hover:bg-blue-500 transition-colors duration-200 cursor-col-resize flex items-center justify-center"
                                    onMouseDown={handleMouseDown}
                                >
                                    <div className="w-1 h-8 bg-gray-400 rounded-full" />
                                </div>
                            )}

                            {!isTranslationCollapsed && (
                                <div
                                    className="min-w-0 flex flex-col"
                                    style={{ width: `${100 - pdfPanelWidth}%` }}
                                >
                                    <TranslationPanel
                                        isTranslating={isTranslating}
                                        error={error}
                                        sentences={sentences}
                                        hoveredIndex={hoveredIndex}
                                        onTranslatedSentenceHover={handleTranslatedSentenceHover}
                                        toggleTranslationPanel={toggleTranslationPanel}
                                        translationContainerRef={translationContainerRef}
                                    />
                                </div>
                            )}

                            {isTranslationCollapsed && (
                                <button
                                    onClick={toggleTranslationPanel}
                                    className="absolute top-1/2 right-0 transform -translate-y-1/2 z-30 bg-blue-600 text-white p-2 rounded-l-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                                    title="번역 패널 열기"
                                >
                                    <PanelLeft size={16} />
                                </button>
                            )}
                        </div>

                        <div className="fixed inset-x-0 bottom-4 flex justify-center z-20">
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
