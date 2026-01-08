import { useState, useCallback } from 'react';
import type { AlertItem, MultiAlertState } from '@/types/alert';

export const useMultiAlert = (): MultiAlertState => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const addAlert = useCallback((message: string, variant: 'default' | 'destructive' = 'destructive') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);
    
    setAlerts((prev) => [...prev, { id, message, variant }]);
    
    setTimeout(() => {
      setAlerts((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  const clearAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    alerts,
    addAlert,
    clearAlert
  };
};