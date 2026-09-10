import React from 'react';
import { Users } from 'lucide-react';

// Reusable ranked customer list — same visual language as the "Rendimiento
// por Gerente" leaderboard elsewhere on this page (numbered badge, name +
// secondary stat, proportional bar). Used twice: Top 10 by visits, Top 10 by
// purchase amount.
export const TopCustomersList = ({ title, icon: Icon, data = [], valueKey, valueFormatter }) => {
  const maxValue = data[0]?.[valueKey] || 1;

  return (
    <div className="card-brutalist">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#0B0B16] flex items-center gap-2">
          <Icon className="h-5 w-5 text-[#8CA4FE]" />
          {title}
        </h3>
      </div>

      {data.length > 0 ? (
        <div className="space-y-3">
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
                    <p className="font-medium text-[#0B0B16] truncate">{customer.customer_name || 'Sin nombre'}</p>
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
