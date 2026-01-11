import { Logger } from '@/utils/logger';

type AddAlertFunction = (message: string, variant?: 'default' | 'destructive') => void;

class AlertService {
  private addAlertHandler: AddAlertFunction | null = null;

  register(addAlertFunction: AddAlertFunction) {
    this.addAlertHandler = addAlertFunction;
  }

  show(message: string, variant: 'default' | 'destructive' = 'default') {
    if (this.addAlertHandler) {
      this.addAlertHandler(message, variant);
    } else {
      // Fallback to original console if not registered yet
      Logger.warn('Alert service not registered. Message:', message);
    }
  }
}

const alertService = new AlertService();
export default alertService;
