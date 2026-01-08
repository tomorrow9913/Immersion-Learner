import type { RecentFile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, X } from 'lucide-react';

interface FileDropAreaProps {
  isDragOver: boolean;
  recentFiles: RecentFile[];
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenRecentFile: (recentFile: RecentFile) => void;
  onRemoveRecentFile: (fileId: string) => void;
  formatFileSize: (bytes: number) => string;
  formatDate: (timestamp: number) => string;
}

const FileDropArea: React.FC<FileDropAreaProps> = ({
  isDragOver,
  recentFiles,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onOpenRecentFile,
  onRemoveRecentFile,
  formatFileSize,
  formatDate
}) => {
  return (
    <div className="flex-1 flex py-20 px-8">
      <div className="flex gap-8 max-w-7xl mx-auto w-full">
        <div className="flex-1 flex justify-center">
          <div className="max-w-lg w-full">
            <Card className={`transition-colors cursor-pointer bg-white ${
              isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            >
              <CardContent className="p-10 text-center">
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf"
                  onChange={onFileSelect}
                  className="hidden"
                />
                <div className="text-6xl mb-4">
                  {isDragOver ? <Upload className="h-16 w-16 mx-auto text-blue-500" /> : <FileText className="h-16 w-16 mx-auto text-gray-400" />}
                </div>
                <p className="text-xl font-semibold mb-2">
                  {isDragOver ? '파일을 놓으세요' : 'PDF 파일 열기'}
                </p>
                <p className="text-sm mb-4">
                  파일을 드래그 앤 드랍하거나 클릭하여 선택하세요
                </p>
                <Button className="px-6 py-3">
                  <Upload className="w-5 h-5 mr-2" />
                  파일 선택
                </Button>
                <p className="text-xs text-gray-500 mt-4">
                  웹페이지와 마찬가지로 단어를 선택하여 번역할 수 있습니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {recentFiles.length > 0 && (
          <div className="w-80">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg">최근 연 파일</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentFiles.map((recentFile) => (
                  <Card key={recentFile.id} 
                    className="cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200 bg-white"
                    onClick={() => onOpenRecentFile(recentFile)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-medium text-gray-900 truncate text-sm" title={recentFile.name}>
                            {recentFile.name}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveRecentFile(recentFile.id);
                          }}
                          className="p-1 h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50"
                          title="삭제"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 space-x-3">
                        <span>페이지 {recentFile.lastPage}</span>
                        <span>•</span>
                        <span>{formatFileSize(recentFile.size)}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDate(recentFile.lastAccessed)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileDropArea;