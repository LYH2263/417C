let metrics = {
  fcp: null,
  lcp: null,
  cls: null,
  clsEntries: [],
};

const callbacks = [];

export function getPerformanceMetrics() {
  return { ...metrics };
}

export function onMetricsChange(callback) {
  callbacks.push(callback);
  return () => {
    const idx = callbacks.indexOf(callback);
    if (idx >= 0) callbacks.splice(idx, 1);
  };
}

function notify() {
  const snapshot = { ...metrics };
  callbacks.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (e) {
      // ignore
    }
  });
}

export function initPerformanceMonitoring() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = Math.round(entry.startTime);
          notify();
        }
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
  } catch (e) {
    // ignore
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        metrics.lcp = Math.round(lastEntry.startTime);
        notify();
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    // ignore
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          metrics.clsEntries.push(entry.value);
          metrics.cls = metrics.clsEntries.reduce((a, b) => a + b, 0);
          notify();
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    // ignore
  }
}
