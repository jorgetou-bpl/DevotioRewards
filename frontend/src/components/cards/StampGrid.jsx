import React from 'react';
import { Star } from 'lucide-react';

const StampGrid = ({ activeStamps, stampsUntilReward, totalStampsForReward = 10, numberStampsTotal, hideLabel = false, label = 'sellos activos' }) => {
  // Always show 10 stars (or the actual total from the API)
  const displayTotal = numberStampsTotal || 10;
  // Calculate how many to fill based on stamps earned towards the current reward
  // If activeStamps is explicitly 0 or undefined, show 0 filled
  const fillCount = Math.min(Math.max(0, activeStamps || 0), displayTotal);
  
  const stamps = [];
  for (let i = 0; i < displayTotal; i++) {
    stamps.push(
      <div
        key={i}
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all ${
          i < fillCount
            ? 'bg-[#120627] border-transparent'
            : 'bg-white border-zinc-300'
        }`}
      >
        <Star
          className={`h-4 w-4 sm:h-5 sm:w-5 ${i < fillCount ? 'text-white fill-white' : 'text-zinc-300'}`}
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2 sm:gap-3 justify-items-center" data-testid="stamp-grid">
        {stamps}
      </div>
      {/* Show label count - can be hidden for multipass */}
      {!hideLabel && (
        <div className="text-center">
          <span className="text-3xl sm:text-4xl font-mono font-bold text-[#120627]">{fillCount}</span>
          <span className="text-lg text-zinc-400 ml-2">{label}</span>
        </div>
      )}
    </div>
  );
};

export default StampGrid;
