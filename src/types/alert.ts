export interface AlertItem {
  id: string;
  message: string;
  variant: 'default' | 'destructive';
}

export interface MultiAlertState {
  alerts: AlertItem[];
  addAlert: (message: string, variant?: 'default' | 'destructive') => void;
  clearAlert: (id: string) => void;
}