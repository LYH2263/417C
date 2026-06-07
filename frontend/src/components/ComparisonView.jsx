import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { FileText, Sparkles, FileDown } from 'lucide-react';
import clientLogger from '../services/logger';

export default function ComparisonView({ originalText, rewrittenText }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([rewrittenText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rewritten_paper.txt';
    a.click();
    clientLogger.addUserPath('download_rewritten');
  }, [rewrittenText]);

  if (!rewrittenText) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur">
        <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" /> 原文 (高风险内容为红色)
        </h3>
        <div className="text-sm leading-relaxed text-slate-400 h-[400px] overflow-y-auto pr-4">
          {originalText}
        </div>
      </div>
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl shadow-indigo-500/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> 人性化改写文
          </h3>
          <button
            onClick={handleDownload}
            className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <FileDown className="w-3 h-3" /> 导出 TXT
          </button>
        </div>
        <div className="text-sm leading-relaxed text-white h-[400px] overflow-y-auto pr-4 font-medium">
          {rewrittenText}
        </div>
      </div>
    </div>
  );
}

ComparisonView.propTypes = {
  originalText: PropTypes.string.isRequired,
  rewrittenText: PropTypes.string.isRequired,
};
