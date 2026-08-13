import React from 'react';
import { Star } from 'lucide-react';

const StampGrid = ({ activeStamps, stampsUntilReward, totalStampsForReward = 10, numberStampsTotal, hideLabel = false, label = 'sellos activos' }) => {
  // Use the actual total from the card configuration
  const displayTotal = numberStampsTotal || totalStampsForReward || 10;
  // Calculate how many to fill based on stamps earned towards the current reward
  // If activeStamps is explicitly 0 or undefined, show 0 filled
  const fillCount = Math.min(Math.max(0, activeStamps || 0), displayTotal);
  
  // Calculate grid columns based on total stamps
  // For small numbers (<=5): show all in one row
  // For 6-10: show 5 per row
  // For >10: show 5 per row with multiple rows
  const getGridCols = () => {
    if (displayTotal <= 5) return displayTotal;
    return 5;
  };
  
  const stamps = [];
  for (let i = 0; i < displayTotal; i++) {
    stamps.push(
      <div
        key={i}
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all ${
          i < fillCount
            ? 'bg-[#5B7CF7] border-transparent'
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
      <div 
        className="grid gap-2 sm:gap-3 justify-items-center" 
        style={{ gridTemplateColumns: `repeat(${getGridCols()}, minmax(0, 1fr))` }}
        data-testid="stamp-grid"
      >
        {stamps}
      </div>
      {/* Show label count - can be hidden for multipass */}
      {!hideLabel && (
        <div className="text-center">
          <span className="text-3xl sm:text-4xl font-mono font-bold text-[#0B0B16]">{fillCount}</span>
          <span className="text-lg text-zinc-400 ml-2">{label}</span>
        </div>
      )}
    </div>
  );
};

export default StampGrid;
