import React from 'react';
import { Users } from 'lucide-react';

// Reusable ranked list — numbered badge, name + primary stat, proportional
// bar, optional secondary line under the name. Used for Top 10 by visits and
// the Gerente Leaderboard (same shape: a name, one ranking number, one
// secondary figure).
export const TopCustomersList = ({ title, icon: Icon, data = [], nameKey = 'customer_name', valueKey, valueFormatter, renderSubtitle, headerRight }) => {
  const maxValue = data[0]?.[valueKey] || 1;

  return (
    <div className="card-brutalist">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h3 className="text-lg font-semibold text-[#0B0B16] flex items-center gap-2">
          <Icon className="h-5 w-5 text-[#8CA4FE]" />
          {title}
        </h3>
        {headerRight}
      </div>

      {data.length > 0 ? (
        // Capped + scrollable so a full top-10 doesn't grow taller than the
        // fixed-height chart cards it sits next to in the grid (was fine at
        // ~5 rows, but a real top-10 list would stretch the whole grid row).
        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
          {data.map((customer, index) => {
            const value = customer[valueKey] || 0;
            const percentage = (value / maxValue) * 100;
            return (
              <div key={customer._id || index} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-zinc-100 text-zinc-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-zinc-50 text-zinc-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-[#0B0B16] truncate">{customer[nameKey] || 'Sin nombre'}</p>
                      {renderSubtitle && <p className="text-xs text-zinc-500">{renderSubtitle(customer)}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#0B0B16] flex-shrink-0 ml-2">
                    {valueFormatter ? valueFormatter(value) : value}
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8CA4FE] to-[#5B7CF7] rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Users className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-500">Aún no hay suficientes datos</p>
        </div>
      )}
    </div>
  );
};
