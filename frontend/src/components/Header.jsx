import React from 'react';
import PropTypes from 'prop-types';
import { ShieldCheck } from 'lucide-react';
import { triggerLogoClick } from './DebugPanel';

export default function Header({ quota, onLogoClick }) {
  const handleLogoClick = () => {
    triggerLogoClick();
    onLogoClick?.();
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={handleLogoClick}
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white italic">
            Paper<span className="text-indigo-500 font-black">Wise</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            今日额度:{' '}
            <span className={quota > 3 ? 'text-indigo-400' : 'text-red-400'}>
              {quota}/10
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

Header.propTypes = {
  quota: PropTypes.number.isRequired,
  onLogoClick: PropTypes.func,
};

Header.defaultProps = {
  onLogoClick: undefined,
};
