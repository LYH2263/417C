import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Upload, RefreshCcw } from 'lucide-react';

export default function TextEditor({ text, onChange, loading, onFileUpload }) {
  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (file) {
        onFileUpload?.(file);
      }
    },
    [onFileUpload]
  );

  return (
    <div className="relative mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium border border-slate-700">
            文本模式
          </button>
          <div className="relative group">
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                loading
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  上传文件
                </>
              )}
            </button>
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt"
              disabled={loading}
            />
          </div>
        </div>
        <div className="text-xs text-slate-500">
          当前字数: {text.length} / 5000
        </div>
      </div>

      <textarea
        className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-h-[300px] transition-all text-sm leading-relaxed"
        placeholder="在此输入您的学术论文片段，或上传附件..."
        value={text}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

TextEditor.propTypes = {
  text: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  onFileUpload: PropTypes.func,
};

TextEditor.defaultProps = {
  loading: false,
  onFileUpload: undefined,
};
