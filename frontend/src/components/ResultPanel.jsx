import React from 'react';
import PropTypes from 'prop-types';
import { ChevronRight } from 'lucide-react';

function ScoreBar({ originalScore, rewrittenScore }) {
  return (
    <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex">
      <div
        className={`h-full transition-all duration-1000 ${
          originalScore > 50 ? 'bg-red-500' : 'bg-green-500'
        }`}
        style={{ width: `${originalScore}%` }}
      />
      {rewrittenScore != null && (
        <div
          className="h-full bg-indigo-500 transition-all duration-1000 border-l-2 border-slate-900"
          style={{ width: `${rewrittenScore}%` }}
        />
      )}
    </div>
  );
}

ScoreBar.propTypes = {
  originalScore: PropTypes.number.isRequired,
  rewrittenScore: PropTypes.number,
};

ScoreBar.defaultProps = {
  rewrittenScore: undefined,
};

export default function ResultPanel({ result, rewriteResult }) {
  if (!result && !rewriteResult) return null;

  const originalScore = result?.overall_ai_score ?? rewriteResult?.detection_before?.overall_ai_score;
  const rewrittenScore = rewriteResult?.detection_after?.overall_ai_score;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 overflow-hidden relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">分析报告</h2>
          <p className="text-slate-400 text-sm">基于 RoBERTa 及语义突发性检测引擎</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase font-bold mb-1">原文 AI 率</p>
            <p
              className={`text-3xl font-black ${
                originalScore > 50 ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {originalScore}%
            </p>
          </div>
          {rewriteResult && (
            <div className="flex items-center gap-6 pl-6 border-l border-slate-800">
              <ChevronRight className="text-slate-700" />
              <div className="text-center">
                <p className="text-xs text-indigo-400 uppercase font-bold mb-1">改写后 AI 率</p>
                <p className="text-3xl font-black text-indigo-400">{rewrittenScore}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ScoreBar originalScore={originalScore} rewrittenScore={rewrittenScore} />
    </div>
  );
}

ResultPanel.propTypes = {
  result: PropTypes.shape({
    overall_ai_score: PropTypes.number,
    details: PropTypes.array,
  }),
  rewriteResult: PropTypes.shape({
    detection_before: PropTypes.shape({
      overall_ai_score: PropTypes.number,
    }),
    detection_after: PropTypes.shape({
      overall_ai_score: PropTypes.number,
    }),
    rewritten_text: PropTypes.string,
    iterations: PropTypes.number,
  }),
};

ResultPanel.defaultProps = {
  result: null,
  rewriteResult: null,
};
