import { AlertCircle } from 'lucide-react';
import type { AlertItem } from '@/types/alert';

interface MultiStackAlertProps {
  alerts: AlertItem[];
  onClearAlert: (id: string) => void;
}

const MultiStackAlert = ({ alerts, onClearAlert }: MultiStackAlertProps) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-[400px] max-w-[90vw] pointer-events-none">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-300"
        >
          <div className="bg-white shadow-lg border-l-4 border-l-red-500 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                alert.variant === 'destructive' ? 'text-red-500' : 'text-blue-500'
              }`} />
              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  alert.variant === 'destructive' ? 'text-red-900' : 'text-gray-900'
                }`}>
                  알림
                </div>
                <div className={`text-sm mt-1 ${
                  alert.variant === 'destructive' ? 'text-red-700' : 'text-gray-700'
                }`}>
                  {alert.message}
                </div>
              </div>
              <button
                onClick={() => onClearAlert(alert.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MultiStackAlert;