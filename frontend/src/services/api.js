import axios from 'axios';
import clientLogger from './logger';

const API_BASE = (typeof window !== 'undefined' && window.ENV?.API_BASE) || 'http://localhost:8417/api';

const apiLogStore = [];
const MAX_API_LOGS = 20;

export function getApiLogs() {
  return [...apiLogStore];
}

function addApiLog(entry) {
  apiLogStore.push(entry);
  if (apiLogStore.length > MAX_API_LOGS) {
    apiLogStore.shift();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pw-api-log', { detail: entry }));
  }
}

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

apiClient.interceptors.request.use(
  (config) => {
    const startTime = Date.now();
    config.__startTime = startTime;

    const logEntry = {
      id: `${startTime}-${Math.random().toString(36).slice(2, 8)}`,
      method: config.method?.toUpperCase(),
      url: config.url,
      fullUrl: config.baseURL + config.url,
      params: clientLogger.maskData(config.params),
      dataSize: config.data ? JSON.stringify(config.data).length : 0,
      startTime,
      status: 'pending',
    };

    config.__logId = logEntry.id;
    addApiLog(logEntry);

    clientLogger.debug(`API Request: ${logEntry.method} ${logEntry.url}`, {
      request: {
        method: logEntry.method,
        url: logEntry.url,
        params: logEntry.params,
        dataSize: logEntry.dataSize,
      },
    });
    clientLogger.addUserPath(`API:${logEntry.method}:${logEntry.url}`);

    return config;
  },
  (error) => {
    clientLogger.error('API Request setup error', { error: error.message });
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    const config = response.config;
    const duration = Date.now() - (config.__startTime || Date.now());
    const logId = config.__logId;

    const logEntry = apiLogStore.find((l) => l.id === logId);
    if (logEntry) {
      logEntry.status = response.status;
      logEntry.duration = duration;
      logEntry.responseSize = response.data ? JSON.stringify(response.data).length : 0;
      logEntry.endTime = Date.now();
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pw-api-log-update', {
          detail: { id: logId, status: response.status, duration, responseSize: response.data ? JSON.stringify(response.data).length : 0 },
        })
      );
    }

    clientLogger.info(`API Response: ${config.method?.toUpperCase()} ${config.url} -> ${response.status} (${duration}ms)`, {
      request: {
        method: config.method?.toUpperCase(),
        url: config.url,
      },
      response: {
        status: response.status,
        duration_ms: duration,
        response_size: response.data ? JSON.stringify(response.data).length : 0,
      },
    });

    return response;
  },
  (error) => {
    const config = error.config || {};
    const duration = Date.now() - (config.__startTime || Date.now());
    const logId = config.__logId;

    const logEntry = apiLogStore.find((l) => l.id === logId);
    if (logEntry) {
      logEntry.status = error.response?.status || 0;
      logEntry.duration = duration;
      logEntry.error = error.message;
      logEntry.endTime = Date.now();
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pw-api-error', {
          detail: {
            method: config.method?.toUpperCase(),
            url: config.url,
            status: error.response?.status || 0,
            duration,
            params: clientLogger.maskData(config.params),
            requestData: clientLogger.maskData(config.data),
            responseData: error.response?.data ? clientLogger.maskData(error.response.data) : null,
            errorMessage: error.message,
          },
        })
      );
    }

    clientLogger.error(`API Error: ${config.method?.toUpperCase() || 'UNKNOWN'} ${config.url || 'unknown'}`, {
      request: {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: clientLogger.maskData(config.params),
      },
      response: {
        status: error.response?.status || 0,
        statusText: error.response?.statusText,
        body: error.response?.data ? clientLogger.maskData(error.response.data) : null,
        duration_ms: duration,
      },
      error: {
        message: error.message,
        stack: error.stack,
      },
    });

    return Promise.reject(error);
  }
);

export const api = {
  detectText: (text) => apiClient.post('/detect-text', { text }).then((r) => r.data),
  detectFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/detect-file', formData).then((r) => r.data);
  },
  rewrite: (text, level) => apiClient.post('/rewrite', { text, level }).then((r) => r.data),
  submitClientLogs: (logs) => apiClient.post('/client-logs', { logs }).then((r) => r.data),
  submitErrorFeedback: (data) => apiClient.post('/error-feedback', data).then((r) => r.data),
};

export default apiClient;
