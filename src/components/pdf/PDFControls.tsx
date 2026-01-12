import React from 'react';
import { Button } from '@/components/ui/button';
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
    <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-full shadow-lg p-2 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          disabled={pageNumber <= 1}
          onClick={goToPreviousPage}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
          <input
            type="number"
            value={pageNumber}
            min={1}
            max={numPages}
            onChange={handlePageInputChange}
            className="w-12 bg-transparent text-center focus:outline-none"
          />
          <span>/ {numPages}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          disabled={pageNumber >= numPages}
          onClick={goToNextPage}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="h-6 w-px bg-gray-300"></div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={handleFileInputClick}
        >
          <Upload className="h-5 w-5" />
        </Button>
        <input
          id="controls-file-input"
          data-testid="controls-file-input"
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {isTranslationFailed && (
        <>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 font-semibold">번역 실패</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryTranslation}
              disabled={isTranslating}
              className="rounded-full"
            >
              {isTranslating ? '번역 중...' : '다시 시도'}
            </Button>
          </div>
        </>
      )}

      {translationError && !isTranslationFailed && (
        <>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="flex items-center">
            <span className="text-xs text-red-600 font-semibold">{translationError}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default PDFControls;