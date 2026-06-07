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

export function useDetection() {
  const state = useAppState();
  const actions = useAppActions();
  const { decreaseQuota, checkQuota } = useQuota();

  const detectText = useCallback(async () => {
    if (!state.text.trim()) return;
    if (!checkQuota()) return;

    clientLogger.addUserPath('detect_text');
    actions.dispatch({ type: ActionTypes.DETECT_START });

    try {
      const response = await api.detectText(state.text);
      actions.dispatch({
        type: ActionTypes.DETECT_SUCCESS,
        payload: { result: response },
      });
      decreaseQuota();
      clientLogger.info('Text detection succeeded', {
        text_length: state.text.length,
        ai_score: response.overall_ai_score,
      });
      scrollToResults();
    } catch (err) {
      actions.dispatch({ type: ActionTypes.DETECT_FAILURE });
      clientLogger.error('Text detection failed', { error: err.message });
      alert('Error: ' + err.message);
    }
  }, [state.text, actions, decreaseQuota, checkQuota]);

  const detectFile = useCallback(async (file) => {
    if (!file) return;
    if (!checkQuota()) return;

    clientLogger.addUserPath('upload_file');
    actions.dispatch({ type: ActionTypes.DETECT_START });
    actions.setFile(file);

    try {
      const response = await api.detectFile(file);
      actions.dispatch({
        type: ActionTypes.DETECT_SUCCESS,
        payload: {
          result: response,
          textFromResult: response.text,
        },
      });
      decreaseQuota();
      clientLogger.info('File detection succeeded', {
        filename: response.filename,
        text_length: response.text?.length,
        ai_score: response.overall_ai_score,
      });
      scrollToResults();
    } catch (err) {
      actions.dispatch({ type: ActionTypes.DETECT_FAILURE });
      clientLogger.error('File upload failed', { error: err.message });
      alert('Error uploading file: ' + err.message);
    }
  }, [actions, decreaseQuota, checkQuota]);

  return {
    loading: state.loading,
    result: state.result,
    detectText,
    detectFile,
  };
}

export default useDetection;
