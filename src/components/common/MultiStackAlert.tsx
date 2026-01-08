import { AlertCircle, Info, X } from 'lucide-react';
import type { AlertItem } from '@/types/alert';

interface MultiStackAlertProps {
  alerts: AlertItem[];
  onClearAlert: (id: string) => void;
}

const variantStyles = {
  default: {
    border: 'border-l-blue-500',
    iconColor: 'text-blue-500',
    titleColor: 'text-gray-900',
    messageColor: 'text-gray-700',
    Icon: Info,
  },
  destructive: {
    border: 'border-l-red-500',
    iconColor: 'text-red-500',
    titleColor: 'text-red-900',
    messageColor: 'text-red-700',
    Icon: AlertCircle,
  },
};

const MultiStackAlert = ({ alerts, onClearAlert }: MultiStackAlertProps) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-[400px] max-w-[90vw] pointer-events-none">
      {alerts.map((alert) => {
        const styles = variantStyles[alert.variant] || variantStyles.default;
        return (
          <div
            key={alert.id}
            className="pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-300"
          >
            <div className={`bg-white shadow-lg border-l-4 p-4 rounded-r-lg ${styles.border}`}>
              <div className="flex items-start gap-3">
                <styles.Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${styles.iconColor}`} />
                <div className="flex-1">
                  <div className={`text-sm font-medium ${styles.titleColor}`}>
                    알림
                  </div>
                  <div className={`text-sm mt-1 ${styles.messageColor}`}>
                    {alert.message}
                  </div>
                </div>
                <button
                  onClick={() => onClearAlert(alert.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MultiStackAlert;