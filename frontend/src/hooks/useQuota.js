import { useCallback, useEffect } from 'react';
import { useAppState, useAppActions, ActionTypes } from '../context/AppContext';
import { api } from '../services/api';
import clientLogger from '../services/logger';

export function useQuota() {
  const state = useAppState();
  const actions = useAppActions();

  const decreaseQuota = useCallback(() => {
    actions.decreaseQuota();
  }, [actions]);

  const setQuota = useCallback((value) => {
    actions.setQuota(value);
  }, [actions]);

  const checkQuota = useCallback(() => {
    if (state.quota <= 0) {
      alert('今日额度已用完，请明天再试或升级账户。');
      clientLogger.warn('Quota exceeded');
      return false;
    }
    return true;
  }, [state.quota]);

  return {
    quota: state.quota,
    decreaseQuota,
    setQuota,
    checkQuota,
  };
}

export default useQuota;
