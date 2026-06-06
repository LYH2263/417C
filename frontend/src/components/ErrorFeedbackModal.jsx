import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Send, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clientLogger from '../services/logger';
import { api } from '../services/api';

export default function ErrorFeedbackModal({ errorInfo, onClose, appStateSnapshot }) {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setDescription('');
    setSubmitted(false);
  }, [errorInfo]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      await api.submitErrorFeedback({
        session_id: clientLogger.getSessionId(),
        user_id: clientLogger.getUserId(),
        error_message: errorInfo?.message || 'Unknown error',
        error_stack: errorInfo?.stack || errorInfo?.component_stack,
        user_description: description,
        user_path: clientLogger.getUserPath(),
        app_state: appStateSnapshot || null,
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose?.();
      }, 1500);
    } catch (err) {
      clientLogger.error('Failed to submit error feedback', { error: err.message });
      setSubmitted(true);
      setTimeout(() => onClose?.(), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-red-950/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {submitted ? '反馈已发送' : '遇到了问题'}
                </h3>
                <p className="text-xs text-slate-400">
                  {submitted ? '感谢您的帮助！' : '您的反馈将帮助我们改进'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {!submitted ? (
            <div className="p-5 space-y-4">
              {errorInfo?.message && (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <p className="text-xs text-slate-500 mb-1">错误信息</p>
                  <p className="text-sm text-red-400 font-mono break-all">
                    {errorInfo.message}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  您在做什么操作时遇到了这个问题？（可选）
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="请描述您的操作步骤，我们将尽快修复..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>发送中...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      提交反馈
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-slate-300">感谢您的反馈，我们将尽快处理！</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
