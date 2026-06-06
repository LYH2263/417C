const SENSITIVE_KEYS = new Set([
  'apiKey', 'api_key', 'apikey', 'API_KEY',
  'authorization', 'Authorization', 'AUTHORIZATION',
  'token', 'Token', 'TOKEN',
  'password', 'Password', 'PASSWORD',
  'secret', 'Secret', 'SECRET',
]);

function maskSensitiveValue(key, value) {
  if (typeof value !== 'string') return value;
  if (value.length <= 4) return '****';
  return value.slice(0, 4) + '****';
}

function maskData(data) {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(maskData);
  if (typeof data === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(k)) {
        result[k] = maskSensitiveValue(k, v);
      } else {
        result[k] = maskData(v);
      }
    }
    return result;
  }
  return data;
}

let sessionId = localStorage.getItem('pw_session_id');
if (!sessionId) {
  sessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('pw_session_id', sessionId);
}

let userId = localStorage.getItem('pw_user_id') || null;

const userPath = [];
const MAX_PATH_LENGTH = 20;

function addUserPath(action) {
  userPath.push(action);
  if (userPath.length > MAX_PATH_LENGTH) {
    userPath.shift();
  }
}

function getUserPath() {
  return [...userPath];
}

const logQueue = [];
const MAX_QUEUE_SIZE = 100;
const FLUSH_INTERVAL = 5000;
const FLUSH_BATCH_SIZE = 20;

let flushTimer = null;
let isFlushing = false;

const apiBase = (typeof window !== 'undefined' && window.ENV?.API_BASE) || 'http://localhost:8417/api';

function buildLogEntry(level, message, extra = {}) {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    user_id: userId,
    url: typeof window !== 'undefined' ? window.location.href : '',
    user_path: getUserPath(),
    ...maskData(extra),
  };
}

function enqueueLog(entry) {
  logQueue.push(entry);
  if (logQueue.length > MAX_QUEUE_SIZE) {
    logQueue.shift();
  }
  scheduleFlush();
}

async function flushLogs() {
  if (isFlushing || logQueue.length === 0) return;
  isFlushing = true;

  const batch = logQueue.splice(0, Math.min(FLUSH_BATCH_SIZE, logQueue.length));

  try {
    await fetch(`${apiBase}/client-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: batch }),
    });
  } catch (err) {
    logQueue.unshift(...batch);
  } finally {
    isFlushing = false;
    if (logQueue.length > 0) {
      scheduleFlush();
    }
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, FLUSH_INTERVAL);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (navigator.sendBeacon && logQueue.length > 0) {
      const payload = JSON.stringify({ logs: [...logQueue] });
      try {
        navigator.sendBeacon(`${apiBase}/client-logs`, payload);
      } catch (e) {
        // ignore
      }
    }
  });
}

function log(level, message, extra) {
  const entry = buildLogEntry(level, message, extra);
  enqueueLog(entry);

  if (level === 'error' && typeof console !== 'undefined') {
    console.error(`[${level}] ${message}`, extra || '');
  } else if (typeof console !== 'undefined') {
    console.log(`[${level}] ${message}`, extra || '');
  }
}

const clientLogger = {
  debug: (msg, extra) => log('debug', msg, extra),
  info: (msg, extra) => log('info', msg, extra),
  warn: (msg, extra) => log('warn', msg, extra),
  warning: (msg, extra) => log('warn', msg, extra),
  error: (msg, extra) => log('error', msg, extra),
  fatal: (msg, extra) => log('error', msg, extra),

  addUserPath,
  getUserPath,
  getSessionId: () => sessionId,
  getUserId: () => userId,
  setUserId: (id) => {
    userId = id;
    if (id) localStorage.setItem('pw_user_id', id);
    else localStorage.removeItem('pw_user_id');
  },
  flush: flushLogs,
  maskData,
};

export default clientLogger;
