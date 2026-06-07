import React, { useEffect, useMemo, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';

import ErrorBoundary from './components/ErrorBoundary';
import ErrorFeedbackModal from './components/ErrorFeedbackModal';
import DebugPanel from './components/DebugPanel';
import Header from './components/Header';
import TextEditor from './components/TextEditor';
import ControlBar from './components/ControlBar';
import ResultPanel from './components/ResultPanel';
import ComparisonView from './components/ComparisonView';
import ChunkGrid from './components/ChunkGrid';

import { useAppState, useAppActions } from './context/AppContext';
import { useDetection } from './hooks/useDetection';
import { useRewrite } from './hooks/useRewrite';
import { useQuota } from './hooks/useQuota';

import { onError } from './services/errorMonitor';
import clientLogger from './services/logger';

const PUBLISHERS = ['IEEE', 'Springer', 'Nature', 'Elsevier', 'ACM'];

function HeroSection() {
  return (
    <div className="text-center mb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold mb-6"
      >
        <Sparkles className="w-3 h-3" />
        全新 Llama 3 改写引擎已上线
      </motion.div>
      <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">
        让 AI 充满{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
          学术人味
        </span>
      </h1>
      <p className="text-lg text-slate-400 max-w-2xl mx-auto">
        一站式学术论文工具：深度 AIGC 检测 + 多级人性化改写。
        <br />锁定术语与格式，只优化叙述逻辑。
      </p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
      <p>© 2026 PaperWise AI. 专业级学术诚信守护者。</p>
    </footer>
  );
}

function PublisherSection() {
  return (
    <div className="max-w-4xl mx-auto px-4 mt-20 opacity-30 grayscale contrast-125">
      <div className="flex flex-wrap justify-center gap-12 items-center">
        {PUBLISHERS.map((p) => (
          <div key={p} className="text-xl font-bold italic">
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

PublisherSection.propTypes = {};

function InputPanel({
  text,
  onTextChange,
  loading,
  onFileUpload,
  rewriteLevel,
  onRewriteLevelChange,
  rewriting,
  onDetect,
  onRewrite,
  onBatchClick,
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 pointer-events-none"></div>
      <div className="relative">
        <ErrorBoundary>
          <TextEditor
            text={text}
            onChange={onTextChange}
            loading={loading}
            onFileUpload={onFileUpload}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <ControlBar
            rewriteLevel={rewriteLevel}
            onRewriteLevelChange={onRewriteLevelChange}
            loading={loading}
            rewriting={rewriting}
            text={text}
            onDetect={onDetect}
            onRewrite={onRewrite}
            onBatchClick={onBatchClick}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

InputPanel.propTypes = {
  text: PropTypes.string.isRequired,
  onTextChange: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  onFileUpload: PropTypes.func.isRequired,
  rewriteLevel: PropTypes.oneOf(['low', 'medium', 'high']).isRequired,
  onRewriteLevelChange: PropTypes.func.isRequired,
  rewriting: PropTypes.bool.isRequired,
  onDetect: PropTypes.func.isRequired,
  onRewrite: PropTypes.func.isRequired,
  onBatchClick: PropTypes.func,
};

InputPanel.defaultProps = {
  onBatchClick: undefined,
};

function ResultsSection({ result, rewriteResult, text }) {
  const hasContent = !!result || !!rewriteResult;

  return (
    <AnimatePresence>
      {hasContent && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          id="results-section"
          className="lg:col-span-12 space-y-8"
        >
          <ErrorBoundary>
            <ResultPanel result={result} rewriteResult={rewriteResult} />
          </ErrorBoundary>

          {rewriteResult && (
            <ErrorBoundary>
              <ComparisonView
                originalText={text}
                rewrittenText={rewriteResult.rewritten_text}
              />
            </ErrorBoundary>
          )}

          {!rewriteResult && result?.details && (
            <ErrorBoundary>
              <ChunkGrid chunks={result.details} />
            </ErrorBoundary>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

ResultsSection.propTypes = {
  result: PropTypes.object,
  rewriteResult: PropTypes.object,
  text: PropTypes.string.isRequired,
};

ResultsSection.defaultProps = {
  result: null,
  rewriteResult: null,
};

function App() {
  const state = useAppState();
  const actions = useAppActions();
  const { detectText, detectFile, loading, result } = useDetection();
  const { rewrite, setRewriteLevel, rewriting, rewriteLevel, rewriteResult } = useRewrite();
  const { quota } = useQuota();

  useEffect(() => {
    const unsub = onError((info) => {
      actions.setErrorInfo(info);
    });

    const handleApiError = (e) => {
      actions.setErrorInfo({
        type: 'api_error',
        message: e.detail?.message || `API 请求失败: ${e.detail?.url || ''}`,
        ...e.detail,
      });
    };

    const handleReactError = (e) => {
      actions.setErrorInfo(e.detail);
    };

    window.addEventListener('pw-api-error', handleApiError);
    window.addEventListener('pw-react-error', handleReactError);

    return () => {
      unsub();
      window.removeEventListener('pw-api-error', handleApiError);
      window.removeEventListener('pw-react-error', handleReactError);
    };
  }, [actions]);

  const appStateSnapshot = useMemo(
    () => ({
      text: state.text ? `${state.text.length} chars` : null,
      hasFile: !!state.file,
      hasResult: !!result,
      hasRewriteResult: !!rewriteResult,
      rewriteLevel,
      quota,
      loading,
      rewriting,
    }),
    [state.text, state.file, result, rewriteResult, rewriteLevel, quota, loading, rewriting]
  );

  const scrollToInput = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    clientLogger.addUserPath('scroll_to_top');
  }, []);

  const handleResetAll = useCallback(() => {
    actions.resetAll();
    scrollToInput();
    clientLogger.info('User reset workspace');
    clientLogger.addUserPath('reset_workspace');
  }, [actions, scrollToInput]);

  const handleBatchClick = useCallback(() => {
    alert('批量处理功能正在内测中。如需大批量处理，请通过 API 接入或联系学术客服。');
    clientLogger.info('User tried batch feature');
    clientLogger.addUserPath('click_batch');
  }, []);

  const handleTextChange = useCallback(
    (value) => {
      actions.setText(value);
    },
    [actions]
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-indigo-500/30 pb-20">
        <ErrorBoundary>
          <Header quota={quota} onLogoClick={handleResetAll} />
        </ErrorBoundary>

        <main className="max-w-6xl mx-auto px-4 py-12">
          <HeroSection />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-12">
              <InputPanel
                text={state.text}
                onTextChange={handleTextChange}
                loading={loading}
                onFileUpload={detectFile}
                rewriteLevel={rewriteLevel}
                onRewriteLevelChange={setRewriteLevel}
                rewriting={rewriting}
                onDetect={detectText}
                onRewrite={rewrite}
                onBatchClick={handleBatchClick}
              />
            </div>

            <ResultsSection result={result} rewriteResult={rewriteResult} text={state.text} />
          </div>
        </main>

        {!result && !rewriteResult && <PublisherSection />}

        <Footer />

        {state.errorInfo && (
          <ErrorFeedbackModal
            errorInfo={state.errorInfo}
            onClose={actions.clearErrorInfo}
            appStateSnapshot={appStateSnapshot}
          />
        )}

        <DebugPanel appState={appStateSnapshot} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
