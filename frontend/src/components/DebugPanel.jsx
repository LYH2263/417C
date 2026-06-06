import React, { useState, useEffect, useCallback } from 'react';
import { X, Activity, Zap, Clock, Database, Server, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiLogs } from '../services/api';
import { getPerformanceMetrics, onMetricsChange } from '../services/performance';
import clientLogger from '../services/logger';

let logoClickCount = 0;
let logoClickTimer = null;
const activationCallbacks = [];

export function triggerLogoClick() {
  logoClickCount++;
  clearTimeout(logoClickTimer);
  logoClickTimer = setTimeout(() => {
    logoClickCount = 0;
  }, 2000);

  if (logoClickCount >= 5) {
    logoClickCount = 0;
    activationCallbacks.forEach((cb) => {
      try {
        cb(true);
      } catch (e) {
        // ignore
      }
    });
  }
}

export function onDebugPanelActivate(callback) {
  activationCallbacks.push(callback);
  return () => {
    const idx = activationCallbacks.indexOf(callback);
    if (idx >= 0) activationCallbacks.splice(idx, 1);
  };
}

function StatusBadge({ status }) {
  if (!status || status === 'pending') {
    return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px] font-bold">PENDING</span>;
  }
  if (status >= 200 && status < 300) {
    return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-bold">{status}</span>;
  }
  if (status >= 400 && status < 500) {
    return <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] font-bold">{status}</span>;
  }
  return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">{status || 'ERR'}</span>;
}

export default function DebugPanel({ appState }) {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('api');
  const [apiLogs, setApiLogs] = useState([]);
  const [metrics, setMetrics] = useState(getPerformanceMetrics());

  const refreshLogs = useCallback(() => {
    setApiLogs(getApiLogs().slice().reverse());
  }, []);

  useEffect(() => {
    const unsubActivate = onDebugPanelActivate(() => {
      setVisible((v) => !v);
    });

    const unsubMetrics = onMetricsChange(setMetrics);

    const handleApiLog = () => refreshLogs();
    const handleApiLogUpdate = () => refreshLogs();

    window.addEventListener('pw-api-log', handleApiLog);
    window.addEventListener('pw-api-log-update', handleApiLogUpdate);

    refreshLogs();
    const interval = setInterval(refreshLogs, 1000);

    return () => {
      unsubActivate();
      unsubMetrics();
      window.removeEventListener('pw-api-log', handleApiLog);
      window.removeEventListener('pw-api-log-update', handleApiLogUpdate);
      clearInterval(interval);
    };
  }, [refreshLogs]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!visible) return null;

  const tabs = [
    { id: 'api', label: 'API 请求', icon: <Server className="w-3.5 h-3.5" /> },
    { id: 'state', label: '状态快照', icon: <Database className="w-3.5 h-3.5" /> },
    { id: 'perf', label: '性能指标', icon: <Gauge className="w-3.5 h-3.5" /> },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 bottom-0 w-[480px] max-w-[95vw] bg-slate-950/98 backdrop-blur-xl border-l border-slate-800 z-[9999] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">调试面板</h2>
              <p className="text-[10px] text-slate-500">
                Session: {clientLogger.getSessionId()?.slice(0, 12)}...
              </p>
            </div>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex gap-1 px-3 py-2 border-b border-slate-800 bg-slate-900/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'api' && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>最近 {apiLogs.length} 条请求</span>
                <button
                  onClick={refreshLogs}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  刷新
                </button>
              </div>
              {apiLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  暂无 API 请求记录
                </div>
              ) : (
                apiLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                          {log.method}
                        </span>
                        <StatusBadge status={log.status} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {log.duration != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {log.duration}ms
                          </span>
                        )}
                        {log.responseSize != null && (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {log.responseSize < 1024 ? `${log.responseSize}B` : `${(log.responseSize / 1024).toFixed(1)}KB`}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 font-mono truncate">{log.url}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'state' && (
            <div className="p-3">
              <p className="text-xs text-slate-500 mb-3">当前应用状态快照</p>
              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-green-400 overflow-x-auto font-mono leading-relaxed max-h-full">
                {JSON.stringify(appState || {}, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'perf' && (
            <div className="p-3 space-y-3">
              <p className="text-xs text-slate-500 mb-2">Core Web Vitals</p>

              <MetricCard
                label="First Contentful Paint (FCP)"
                value={metrics.fcp != null ? `${metrics.fcp}ms` : '测量中...'}
                good={metrics.fcp != null && metrics.fcp < 1800}
                warn={metrics.fcp != null && metrics.fcp >= 1800 && metrics.fcp < 3000}
              />
              <MetricCard
                label="Largest Contentful Paint (LCP)"
                value={metrics.lcp != null ? `${metrics.lcp}ms` : '测量中...'}
                good={metrics.lcp != null && metrics.lcp < 2500}
                warn={metrics.lcp != null && metrics.lcp >= 2500 && metrics.lcp < 4000}
              />
              <MetricCard
                label="Cumulative Layout Shift (CLS)"
                value={metrics.cls != null ? metrics.cls.toFixed(4) : '测量中...'}
                good={metrics.cls != null && metrics.cls < 0.1}
                warn={metrics.cls != null && metrics.cls >= 0.1 && metrics.cls < 0.25}
              />

              <div className="pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-2">性能评分</p>
                <div className="flex gap-2">
                  <ScorePill label="FCP" value={metrics.fcp} type="ms" good={1800} warn={3000} />
                  <ScorePill label="LCP" value={metrics.lcp} type="ms" good={2500} warn={4000} />
                  <ScorePill label="CLS" value={metrics.cls} type="score" good={0.1} warn={0.25} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900 text-[10px] text-slate-600 text-center">
          快捷键 Ctrl+Shift+D 切换面板 · 连按 Logo 5 次激活
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function MetricCard({ label, value, good, warn }) {
  let colorClass = 'text-slate-400';
  let bgClass = 'bg-slate-800/50 border-slate-700';
  if (good) {
    colorClass = 'text-green-400';
    bgClass = 'bg-green-950/30 border-green-900/50';
  } else if (warn) {
    colorClass = 'text-orange-400';
    bgClass = 'bg-orange-950/30 border-orange-900/50';
  } else if (value && !value.includes('测量')) {
    colorClass = 'text-red-400';
    bgClass = 'bg-red-950/30 border-red-900/50';
  }

  return (
    <div className={`p-4 rounded-xl border ${bgClass}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${colorClass}`}>{value}</p>
    </div>
  );
}

function ScorePill({ label, value, type, good, warn }) {
  if (value == null) {
    return (
      <div className="flex-1 py-2 px-3 bg-slate-800/50 rounded-lg text-center">
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-600">-</p>
      </div>
    );
  }

  let score = 'good';
  if ((type === 'ms' && value >= good && value < warn) || (type === 'score' && value >= good && value < warn)) {
    score = 'warn';
  } else if ((type === 'ms' && value >= warn) || (type === 'score' && value >= warn)) {
    score = 'bad';
  }

  const colors = {
    good: 'text-green-400 bg-green-950/30',
    warn: 'text-orange-400 bg-orange-950/30',
    bad: 'text-red-400 bg-red-950/30',
  };

  return (
    <div className={`flex-1 py-2 px-3 ${colors[score]} rounded-lg text-center`}>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${colors[score].split(' ')[0]}`}>
        {score === 'good' ? '良好' : score === 'warn' ? '一般' : '较差'}
      </p>
    </div>
  );
}
