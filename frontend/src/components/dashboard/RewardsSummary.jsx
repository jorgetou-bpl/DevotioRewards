import React from 'react';
import { Gift, CheckCircle2, Percent, Coins, Loader2 } from 'lucide-react';

// Emitted-vs-redeemed rewards — db.rewards_earned had a redeemed_value field
// captured on every redemption that was never aggregated anywhere before
// this. Same tile style as ClientMetricsCards.
export const RewardsSummary = ({ rewards, formatCurrency, loading }) => {
  const tiles = [
    { icon: Gift, label: 'Recompensas Emitidas', value: rewards?.issued_count ?? 0 },
    { icon: CheckCircle2, label: 'Recompensas Canjeadas', value: rewards?.redeemed_count ?? 0 },
    { icon: Percent, label: 'Tasa de Canje', value: `${Math.round((rewards?.redemption_rate ?? 0) * 100)}%` },
    { icon: Coins, label: 'Valor Canjeado', value: formatCurrency(rewards?.redeemed_value_total || 0) }
  ];

  return (
    <div className="card-brutalist" data-testid="rewards-summary">
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map(({ icon: Icon, label, value }) => (
            <div key={label} className="p-4 bg-zinc-50 rounded-xl text-center">
              <Icon className="h-5 w-5 mx-auto text-[#5B7CF7] mb-2" />
              <p className="text-xl font-bold text-[#0B0B16]">{value}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
