import clientLogger from './logger';

let initialized = false;
const errorCallbacks = [];

export function onError(callback) {
  errorCallbacks.push(callback);
  return () => {
    const idx = errorCallbacks.indexOf(callback);
    if (idx >= 0) errorCallbacks.splice(idx, 1);
  };
}

function triggerCallbacks(errorInfo) {
  errorCallbacks.forEach((cb) => {
    try {
      cb(errorInfo);
    } catch (e) {
      // ignore
    }
  });
}

export function initErrorMonitoring() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    const errorInfo = {
      type: 'window_error',
      message: event.message || 'Unknown error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    clientLogger.error(`Window error: ${errorInfo.message}`, {
      ...errorInfo,
    });

    triggerCallbacks({
      ...errorInfo,
      originalError: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    let reasonMessage = 'Unhandled promise rejection';
    let reasonStack = null;

    if (typeof event.reason === 'string') {
      reasonMessage = event.reason;
    } else if (event.reason instanceof Error) {
      reasonMessage = event.reason.message;
      reasonStack = event.reason.stack;
    } else if (event.reason && typeof event.reason === 'object') {
      try {
        reasonMessage = JSON.stringify(event.reason);
      } catch (e) {
        reasonMessage = String(event.reason);
      }
    }

    const errorInfo = {
      type: 'unhandled_rejection',
      message: reasonMessage,
      stack: reasonStack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    clientLogger.error(`Unhandled rejection: ${reasonMessage}`, {
      ...errorInfo,
    });

    triggerCallbacks({
      ...errorInfo,
      originalError: event.reason,
    });
  });

  clientLogger.info('Error monitoring initialized');
}
