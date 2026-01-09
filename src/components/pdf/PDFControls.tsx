import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, ChevronLeft, ChevronRight } from 'lucide-react';

interface PDFControlsProps {
  pageNumber: number;
  numPages: number;
  onPageChange: (newPage: number) => void;
  onFileSelect: (file: File) => void;
  isTranslating?: boolean;
  translationError?: string | null;
  isTranslationFailed?: boolean;
  onRetryTranslation?: () => void;
}

const PDFControls: React.FC<PDFControlsProps> = ({
  pageNumber,
  numPages,
  onPageChange,
  onFileSelect,
  isTranslating = false,
  translationError = null,
  isTranslationFailed = false,
  onRetryTranslation
}) => {
  const handleFileInputClick = () => {
    const input = document.getElementById('controls-file-input') as HTMLInputElement;
    if (input) {
      input.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onFileSelect(files[0]);
    }
  };
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= numPages) {
      onPageChange(val);
    }
  };

  const goToPreviousPage = () => {
    if (pageNumber > 1) {
      onPageChange(pageNumber - 1);
    }
  };

  const goToNextPage = () => {
    if (pageNumber < numPages) {
      onPageChange(pageNumber + 1);
    }
  };

  return (
    <Card className="shadow-sm border-t border-gray-200 rounded-none bg-white">
      <CardContent className="p-4">
        <div className="w-full flex justify-between items-center px-2">
          <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <span>Page</span>
            <input 
              type="number" 
              value={pageNumber} 
              min={1} 
              max={numPages} 
              onChange={handlePageInputChange} 
              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm" 
            />
            <span>of {numPages}</span>
          </div>
          
          <div className="flex gap-4 items-center">
            <Button
              onClick={handleFileInputClick}
              className="text-sm font-medium"
            >
              <Upload className="w-4 h-4 mr-2" />
              다른 PDF 열기
            </Button>
            <input
              id="controls-file-input"
              data-testid="controls-file-input"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber <= 1}
                onClick={goToPreviousPage}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber >= numPages}
                onClick={goToNextPage}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              
              {/* 번역 상태 및 재시도 버튼 */}
              {isTranslationFailed && (
                <div className="ml-4 flex flex-col gap-2">
                  <span className="text-xs text-red-600 font-medium">번역 실패</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetryTranslation}
                    disabled={isTranslating}
                  >
                    {isTranslating ? '번역 중...' : '다시 시도'}
                  </Button>
                </div>
              )}
              
              {translationError && (
                <div className="ml-4 flex items-center">
                  <span className="text-xs text-red-600 font-medium mr-2">에러</span>
                  <span className="text-xs text-gray-600">{translationError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PDFControls;