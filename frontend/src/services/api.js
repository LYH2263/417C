import axios from 'axios';
import clientLogger from './logger';

const API_BASE = (typeof window !== 'undefined' && window.ENV?.API_BASE) || 'http://localhost:8417/api';

const apiLogStore = [];
const MAX_API_LOGS = 20;

const pendingRequests = new Map();

export function getApiLogs() {
  return [...apiLogStore];
}

export function getPendingRequestCount() {
  return pendingRequests.size;
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

function updateApiLog(id, updates) {
  const logEntry = apiLogStore.find((l) => l.id === id);
  if (logEntry) {
    Object.assign(logEntry, updates);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pw-api-log-update', {
          detail: { id, ...updates },
        })
      );
    }
  }
}

function formatResponseData(response) {
  const data = response?.data;
  if (data && typeof data === 'object') {
    if ('data' in data && data.data !== undefined) {
      return data.data;
    }
  }
  return data;
}

function formatError(error) {
  const status = error.response?.status || 0;
  const detail = error.response?.data?.detail || error.response?.data;
  let message = error.message || '未知错误';

  if (typeof detail === 'string') {
    message = detail;
  } else if (detail && typeof detail === 'object' && detail.message) {
    message = detail.message;
  } else if (status === 400) {
    message = '请求参数错误';
  } else if (status === 401) {
    message = '未授权，请重新登录';
  } else if (status === 403) {
    message = '权限不足';
  } else if (status === 404) {
    message = '请求的资源不存在';
  } else if (status === 408) {
    message = '请求超时，请重试';
  } else if (status === 413) {
    message = '上传文件过大';
  } else if (status >= 500) {
    message = '服务器错误，请稍后重试';
  }

  const formattedError = new Error(message);
  formattedError.status = status;
  formattedError.originalError = error;
  formattedError.detail = detail;
  formattedError.url = error.config?.url;
  return formattedError;
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
    pendingRequests.set(logEntry.id, true);
    addApiLog(logEntry);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pw-loading-change', {
          detail: { pending: pendingRequests.size },
        })
      );
    }

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
    return Promise.reject(formatError(error));
  }
);

apiClient.interceptors.response.use(
  (response) => {
    const config = response.config;
    const duration = Date.now() - (config.__startTime || Date.now());
    const logId = config.__logId;

    if (logId) {
      pendingRequests.delete(logId);
      updateApiLog(logId, {
        status: response.status,
        duration,
        responseSize: response.data ? JSON.stringify(response.data).length : 0,
        endTime: Date.now(),
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pw-loading-change', {
            detail: { pending: pendingRequests.size },
          })
        );
      }
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

    return formatResponseData(response);
  },
  (error) => {
    const config = error.config || {};
    const duration = Date.now() - (config.__startTime || Date.now());
    const logId = config.__logId;

    if (logId) {
      pendingRequests.delete(logId);
      updateApiLog(logId, {
        status: error.response?.status || 0,
        duration,
        error: error.message,
        endTime: Date.now(),
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pw-loading-change', {
            detail: { pending: pendingRequests.size },
          })
        );
      }
    }

    const formattedError = formatError(error);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pw-api-error', {
          detail: {
            method: config.method?.toUpperCase(),
            url: config.url,
            status: formattedError.status,
            duration,
            params: clientLogger.maskData(config.params),
            requestData: clientLogger.maskData(config.data),
            responseData: error.response?.data ? clientLogger.maskData(error.response.data) : null,
            errorMessage: formattedError.message,
            message: formattedError.message,
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
        status: formattedError.status,
        statusText: error.response?.statusText,
        body: error.response?.data ? clientLogger.maskData(error.response.data) : null,
        duration_ms: duration,
      },
      error: {
        message: error.message,
        stack: error.stack,
      },
    });

    return Promise.reject(formattedError);
  }
);

export const api = {
  detectText: (text) => apiClient.post('/detect-text', { text }),
  detectFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/detect-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  rewrite: (text, level) => apiClient.post('/rewrite', { text, level }),
  submitClientLogs: (logs) => apiClient.post('/client-logs', { logs }),
  submitErrorFeedback: (data) => apiClient.post('/error-feedback', data),
};

export default apiClient;
