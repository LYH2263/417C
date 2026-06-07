import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';

export const ActionTypes = {
  SET_TEXT: 'SET_TEXT',
  SET_FILE: 'SET_FILE',
  SET_REWRITE_LEVEL: 'SET_REWRITE_LEVEL',
  SET_ERROR_INFO: 'SET_ERROR_INFO',
  CLEAR_ERROR_INFO: 'CLEAR_ERROR_INFO',

  DETECT_START: 'DETECT_START',
  DETECT_SUCCESS: 'DETECT_SUCCESS',
  DETECT_FAILURE: 'DETECT_FAILURE',

  REWRITE_START: 'REWRITE_START',
  REWRITE_SUCCESS: 'REWRITE_SUCCESS',
  REWRITE_FAILURE: 'REWRITE_FAILURE',

  QUOTA_DECREASE: 'QUOTA_DECREASE',
  QUOTA_SET: 'QUOTA_SET',

  RESET_ALL: 'RESET_ALL',
};

const initialState = {
  file: null,
  text: '',
  loading: false,
  rewriting: false,
  result: null,
  rewriteLevel: 'medium',
  rewriteResult: null,
  quota: 10,
  errorInfo: null,
};

function reducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_TEXT:
      return { ...state, text: action.payload };

    case ActionTypes.SET_FILE:
      return { ...state, file: action.payload };

    case ActionTypes.SET_REWRITE_LEVEL:
      return { ...state, rewriteLevel: action.payload };

    case ActionTypes.SET_ERROR_INFO:
      return { ...state, errorInfo: state.errorInfo || action.payload };

    case ActionTypes.CLEAR_ERROR_INFO:
      return { ...state, errorInfo: null };

    case ActionTypes.DETECT_START:
      return { ...state, loading: true, rewriteResult: null };

    case ActionTypes.DETECT_SUCCESS: {
      const { result, textFromResult } = action.payload;
      return {
        ...state,
        loading: false,
        result,
        text: textFromResult != null ? textFromResult : state.text,
      };
    }

    case ActionTypes.DETECT_FAILURE:
      return { ...state, loading: false };

    case ActionTypes.REWRITE_START:
      return { ...state, rewriting: true };

    case ActionTypes.REWRITE_SUCCESS:
      return { ...state, rewriting: false, rewriteResult: action.payload };

    case ActionTypes.REWRITE_FAILURE:
      return { ...state, rewriting: false };

    case ActionTypes.QUOTA_DECREASE:
      return { ...state, quota: state.quota > 0 ? state.quota - 1 : state.quota };

    case ActionTypes.QUOTA_SET:
      return { ...state, quota: action.payload };

    case ActionTypes.RESET_ALL:
      return {
        ...initialState,
        quota: state.quota,
        errorInfo: state.errorInfo,
      };

    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children, initialQuota = 10 }) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    quota: initialQuota,
  });

  const actions = useMemo(() => {
    const createAction = (type) => (payload) => dispatch({ type, payload });

    return {
      setText: createAction(ActionTypes.SET_TEXT),
      setFile: createAction(ActionTypes.SET_FILE),
      setRewriteLevel: createAction(ActionTypes.SET_REWRITE_LEVEL),
      setErrorInfo: createAction(ActionTypes.SET_ERROR_INFO),
      clearErrorInfo: () => dispatch({ type: ActionTypes.CLEAR_ERROR_INFO }),
      decreaseQuota: () => dispatch({ type: ActionTypes.QUOTA_DECREASE }),
      setQuota: createAction(ActionTypes.QUOTA_SET),
      resetAll: () => {
        dispatch({ type: ActionTypes.RESET_ALL });
      },
      dispatch,
    };
  }, []);

  const contextValue = useMemo(() => ({
    state,
    actions,
  }), [state, actions]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
  initialQuota: PropTypes.number,
};

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context.state;
}

export function useAppActions() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppActions must be used within an AppProvider');
  }
  return context.actions;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
