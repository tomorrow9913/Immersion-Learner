import alertService from '@/services/AlertService';

// Store original console methods
const original = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  error: console.error,
  warn: console.warn,
};

// Flag to prevent recursive calls
let isOverridden = false;

// Function to perform the override
export function overrideConsole() {
  if (isOverridden) {
    return;
  }

  console.log = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    alertService.show(message, 'default');
    original.log.apply(console, args);
  };

  console.info = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    alertService.show(message, 'default');
    original.info.apply(console, args);
  };

  console.debug = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    alertService.show(message, 'default');
    original.debug.apply(console, args);
  };
  
  console.warn = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    alertService.show(message, 'destructive');
    original.warn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    alertService.show(message, 'destructive');
    original.error.apply(console, args);
  };

  isOverridden = true;
}

// Function to restore original console methods
export function restoreConsole() {
  if (!isOverridden) {
    return;
  }
  console.log = original.log;
  console.info = original.info;
  console.debug = original.debug;
  console.error = original.error;
  console.warn = original.warn;
  isOverridden = false;
}
