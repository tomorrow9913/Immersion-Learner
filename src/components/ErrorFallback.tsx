import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div className="min-h-96 flex items-center justify-center p-8">
      <Card className="max-w-md w-full border-red-200 bg-white">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-lg">오류가 발생했습니다</CardTitle>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            페이지를 표시하는 중 문제가 발생했습니다. 다시 시도하거나 다른 탭으로 전환해보세요.
          </p>
          
          {import.meta.env.DEV && (
            <details className="p-3 bg-gray-50 rounded border text-sm">
              <summary className="cursor-pointer font-medium text-gray-700 mb-2">오류 정보</summary>
              <pre className="text-red-600 whitespace-pre-wrap">{error.message}</pre>
            </details>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={resetErrorBoundary}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              다시 시도
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              페이지 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorFallback;