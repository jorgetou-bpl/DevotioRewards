import React from 'react';

export const BalanceDisplay = ({ value, label, subtext = null }) => (
  <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
    <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
      {value}
    </span>
    <p className="text-xs sm:text-sm text-zinc-500 mt-2">{label}</p>
    {subtext && <p className="text-xs text-zinc-400 mt-1">{subtext}</p>}
  </div>
);
