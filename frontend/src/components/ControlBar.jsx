import React from 'react';
import PropTypes from 'prop-types';
import { ShieldCheck, Zap, RefreshCcw, Layers } from 'lucide-react';

const REWRITE_LEVELS = [
  { value: 'low', label: '轻微' },
  { value: 'medium', label: '中度' },
  { value: 'high', label: '深度' },
];

export default function ControlBar({
  rewriteLevel,
  onRewriteLevelChange,
  loading,
  rewriting,
  text,
  onDetect,
  onRewrite,
  onBatchClick,
}) {
  const textEmpty = !text.trim();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          {REWRITE_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => onRewriteLevelChange?.(level.value)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                rewriteLevel === level.value
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {level.label}改写
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Layers className="w-4 h-4" />
          <span>术语锁定已开启</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onDetect}
          disabled={loading || textEmpty}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all border border-slate-700"
        >
          {loading ? (
            <RefreshCcw className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          仅检测 AI 率
        </button>
        <button
          onClick={onRewrite}
          disabled={rewriting || textEmpty}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-xl shadow-indigo-500/20"
        >
          {rewriting ? (
            <RefreshCcw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          一键人性化改写
        </button>
      </div>
    </div>
  );
}

ControlBar.propTypes = {
  rewriteLevel: PropTypes.oneOf(['low', 'medium', 'high']).isRequired,
  onRewriteLevelChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  rewriting: PropTypes.bool,
  text: PropTypes.string.isRequired,
  onDetect: PropTypes.func.isRequired,
  onRewrite: PropTypes.func.isRequired,
  onBatchClick: PropTypes.func,
};

ControlBar.defaultProps = {
  loading: false,
  rewriting: false,
  onBatchClick: undefined,
};
