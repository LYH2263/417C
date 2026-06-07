import { useCallback } from 'react';
import { useAppState, useAppActions, ActionTypes } from '../context/AppContext';
import { api } from '../services/api';
import { useQuota } from './useQuota';
import clientLogger from '../services/logger';

function scrollToResults() {
  setTimeout(() => {
    document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
  }, 500);
}

export function useRewrite() {
  const state = useAppState();
  const actions = useAppActions();
  const { decreaseQuota, checkQuota } = useQuota();

  const rewrite = useCallback(async () => {
    if (!state.text.trim()) return;
    if (!checkQuota()) return;

    clientLogger.addUserPath(`rewrite:${state.rewriteLevel}`);
    actions.dispatch({ type: ActionTypes.REWRITE_START });

    try {
      const response = await api.rewrite(state.text, state.rewriteLevel);
      actions.dispatch({
        type: ActionTypes.REWRITE_SUCCESS,
        payload: response,
      });
      decreaseQuota();
      clientLogger.info('Rewrite succeeded', {
        text_length: state.text.length,
        rewrite_level: state.rewriteLevel,
        iterations: response.iterations,
        ai_score_after: response.detection_after?.overall_ai_score,
      });
      scrollToResults();
    } catch (err) {
      actions.dispatch({ type: ActionTypes.REWRITE_FAILURE });
      clientLogger.error('Rewrite failed', { error: err.message });
      alert('Rewriting failed: ' + err.message);
    }
  }, [state.text, state.rewriteLevel, actions, decreaseQuota, checkQuota]);

  const setRewriteLevel = useCallback((level) => {
    actions.setRewriteLevel(level);
  }, [actions]);

  return {
    rewriting: state.rewriting,
    rewriteLevel: state.rewriteLevel,
    rewriteResult: state.rewriteResult,
    rewrite,
    setRewriteLevel,
  };
}

export default useRewrite;
