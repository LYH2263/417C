import React from 'react';
import clientLogger from '../services/logger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const errorData = {
      type: 'react_error_boundary',
      message: error?.message || 'Unknown React error',
      stack: error?.stack,
      component_stack: errorInfo?.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    };

    clientLogger.error(`React Error Boundary: ${errorData.message}`, errorData);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pw-react-error', {
          detail: {
            ...errorData,
            originalError: error,
            originalErrorInfo: errorInfo,
          },
        })
      );
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({
            error: this.state.error,
            reset: this.handleReset,
          });
        }
        return this.props.fallback;
      }

      return (
        <div className="p-6 bg-red-900/30 border border-red-800 rounded-xl">
          <h2 className="text-lg font-bold text-red-400 mb-2">出错了</h2>
          <p className="text-sm text-slate-400 mb-4">
            组件渲染时发生错误，已为您捕获。
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
