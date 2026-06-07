import React from 'react';
import PropTypes from 'prop-types';

function ChunkCard({ index, aiScore, text }) {
  const percentage = Math.round(aiScore * 100);

  return (
    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
          段落 {index + 1}
        </span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            aiScore > 0.5
              ? 'bg-red-500/10 text-red-500'
              : 'bg-green-500/10 text-green-500'
          }`}
        >
          {percentage}%
        </span>
      </div>
      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{text}</p>
    </div>
  );
}

ChunkCard.propTypes = {
  index: PropTypes.number.isRequired,
  aiScore: PropTypes.number.isRequired,
  text: PropTypes.string.isRequired,
};

export default function ChunkGrid({ chunks }) {
  if (!chunks || chunks.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {chunks.map((chunk, idx) => (
        <ChunkCard key={idx} index={idx} aiScore={chunk.ai_score} text={chunk.text} />
      ))}
    </div>
  );
}

ChunkGrid.propTypes = {
  chunks: PropTypes.arrayOf(
    PropTypes.shape({
      ai_score: PropTypes.number,
      text: PropTypes.string,
    })
  ),
};

ChunkGrid.defaultProps = {
  chunks: [],
};
