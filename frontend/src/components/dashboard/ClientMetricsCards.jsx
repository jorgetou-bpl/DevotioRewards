import React from 'react';

// Tailwind's JIT scanner only picks up class names that appear literally in
// source — a template-literal grid-cols-${n} would silently produce no CSS.
const GRID_CLASS_BY_COUNT = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
};

// Generic tile-row renderer — the actual metric sets (Finanzas vs. Visitas)
// are built by the caller (OperationsPage.js) so the same component serves
// both pillars without hardcoding which metrics belong to which section.
export const ClientMetricsCards = ({ tiles = [] }) => {
  const gridClass = GRID_CLASS_BY_COUNT[tiles.length] || 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="card-brutalist" data-testid="client-metrics-cards">
      <div className={`grid ${gridClass} gap-3`}>
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-4 bg-zinc-50 rounded-xl text-center">
            <Icon className="h-5 w-5 mx-auto text-[#5B7CF7] mb-2" />
            <p className="text-xl font-bold text-[#0B0B16]">{value}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
