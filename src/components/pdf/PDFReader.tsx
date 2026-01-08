import { useState, useEffect } from 'react';
import { pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { PDF_CONFIG } from '@/config/constants';

import { useTranslation } from '@/hooks/useTranslation';
import { usePDFStorage } from '@/hooks/usePDFStorage';
import { extractOutlineDirectly } from '@/utils/outlineUtils';

import type { OutlineItem } from '@/types';
import { Sidebar, PDFViewer, PDFControls } from './';
import { FileDropArea } from '@/components/common';
import { TranslationPopup } from '../';

const PDFReader = () => {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_CONFIG.WORKER_SRC;
    
    const [file, setFile] = useState<File | string | Blob | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDragOver, setIsDragOver] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    const {
        selectedText,
        translation,
        isTranslating,
        isSaved,
        wordDetails,
        showTranslation,
        translateText,
        addToWordbook,
        setSelectedText,
        resetTranslation
    } = useTranslation();

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

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const pdfUrl = urlParams.get('pdf');
        
        if (pdfUrl) {
            console.log('PDF URL parameter detected:', pdfUrl);
        }
        
        loadRecentFiles();
    }, []);

    useEffect(() => {
        console.log('File state changed:', file ? 'File set' : 'No file');
    }, [file]);

    const onDocumentLoadSuccess = (pdf: PDFDocumentProxy) => {
        console.log('PDF loaded successfully, pages:', pdf.numPages);
        setNumPages(pdf.numPages);
        extractOutlineDirectly(pdf).then(setOutline);
    };

    const onDocumentLoadError = (error: Error) => {
        console.error('PDF loading error:', error);
        alert(`PDF 로딩 실패: ${error.message}\n\n파일이 손상되지 않았는지 확인해주세요.`);
    };

    const handleOutlineClick = (dest: any, _title: string, pageNumber?: number) => {
        let targetPage: number;
        
        if (pageNumber) {
            targetPage = pageNumber;
        } else if (dest && typeof dest === 'object' && dest.num !== undefined) {
            targetPage = dest.num + 1;
        } else if (typeof dest === 'string') {
            console.log('Named destination:', dest);
            return;
        } else {
            return;
        }
        
        setPageNumber(targetPage);
        updateLastPage(file, targetPage);
    };

    const handlePageChange = (newPage: number) => { 
        if (!isNaN(newPage) && newPage >= 1 && newPage <= numPages) { 
            setPageNumber(newPage);
            updateLastPage(file, newPage);
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
            setOutline([]);
        }
    };

    const handleOpenRecentFile = async (recentFile: any) => {
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
        setOutline([]);
    };

    useEffect(() => {
        let debounceTimer: number;
        let isProcessing = false;
        let isDragging = false;
        let lastTranslationTime = 0;

        const throttledTranslate = (text: string) => {
            const now = Date.now();
            
            if (isProcessing) {
                return;
            }

            setSelectedText(text);
            translateText(text);
            isProcessing = true;
            
            if (isDragging) {
                lastTranslationTime = now;
            }
            
            debounceTimer = setTimeout(() => {
                isProcessing = false;
            }, isDragging ? 800 : 300);
        };

        const handleMouseUp = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('#translate-popup') || target.closest('#translate-button')) return;
            
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            
            isDragging = false;
            
            const selection = window.getSelection();
            
            if (!selection || selection.toString().trim().length === 0) {
                resetTranslation();
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
            
            const text = selection.toString().trim();
            if (text === selectedText && showTranslation) {
                return; 
            }

            throttledTranslate(text);
        };

        const handleMouseMove = (_e: MouseEvent) => {
            if (!isDragging) return;
            
            const now = Date.now();
            
            const selection = window.getSelection();
            if (!selection || selection.toString().trim().length === 0) return;
            
            const text = selection.toString().trim();
            if (text !== selectedText || !showTranslation) {
                if (now - lastTranslationTime > 100) {
                    throttledTranslate(text);
                }
            }
        };

        const handleMouseDown = () => {
            isDragging = true;
        };

        const handleMouseUpGlobal = () => {
            isDragging = false;
        };

        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!selection || selection.toString().trim().length === 0) {
                resetTranslation();
            }
        };

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUpGlobal);
        document.addEventListener('selectionchange', handleSelectionChange);
        
        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUpGlobal);
            document.removeEventListener('selectionchange', handleSelectionChange);
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [selectedText, showTranslation, setSelectedText, translateText, resetTranslation]);

    const handleAddToWordbook = () => {
        addToWordbook(selectedText, translation);
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <TranslationPopup
                position={position}
                selectedText={selectedText}
                translation={translation}
                isTranslating={isTranslating}
                isSaved={isSaved}
                wordDetails={wordDetails}
                showTranslation={showTranslation}
                onAddToWordbook={handleAddToWordbook}
            />
            
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
                    
                    <div className="flex-1 flex flex-col h-screen">
                        {!isSidebarOpen && outline.length > 0 && (
                            <div className="bg-white shadow-sm border-b border-gray-200 p-4 flex-shrink-0">
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="ml-4 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                    title="목차 열기"
                                >
                                    <span>▶ 목차</span>
                                </button>
                                <input
                                    id="header-file-input"
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </div>
                        )}

                        <div className="flex-1 overflow-auto bg-gray-50 p-4 min-h-0">
                            <PDFViewer
                                file={file}
                                pageNumber={pageNumber}
                                onDocumentLoadSuccess={onDocumentLoadSuccess}
                                onDocumentLoadError={onDocumentLoadError}
                            />
                        </div>
                        
                        <PDFControls
                            pageNumber={pageNumber}
                            numPages={numPages}
                            onPageChange={handlePageChange}
                            onFileSelect={handleNewFileSelect}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default PDFReader;