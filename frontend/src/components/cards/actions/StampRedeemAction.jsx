import React from 'react';
import { Loader2, Check, Gift, Calendar } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { ActionButton } from '../shared';

export const StampRedeemAction = ({
  balance, pendingRewards, loadingPendingRewards, selectedRewardId, setSelectedRewardId,
  purchaseAmount, setPurchaseAmount, loading, openConfirmation, currencyInfo
}) => {
  const numberRewardsUnused = balance.numberRewardsUnused ?? 0;

  const formatRewardDate = (isoDate) => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleString('es-CR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return isoDate; }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
        <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">{numberRewardsUnused}</span>
        <p className="text-xs sm:text-sm text-zinc-500 mt-2">Recompensas disponibles</p>
      </div>
      
      {loadingPendingRewards && (
        <div className="text-center p-4">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
          <p className="text-xs text-zinc-500 mt-2">Cargando recompensas...</p>
        </div>
      )}
      
      {!loadingPendingRewards && pendingRewards.length > 0 && (
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">
            Recompensas Pendientes (más antigua primero)
          </label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pendingRewards.map((reward, index) => {
              const isSelected = selectedRewardId === reward.id;
              return (
                <button
                  key={reward.id}
                  onClick={() => setSelectedRewardId(reward.id)}
                  disabled={loading}
                  className={`w-full p-4 border-2 rounded-xl text-left transition-all ${isSelected ? 'border-[#0B0B16] bg-zinc-50' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
                  data-testid={`pending-reward-${index}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#8CA4FE] text-white text-xs font-bold">{index + 1}</span>
                        <p className="font-medium text-sm sm:text-base text-[#0B0B16]">
                          Recompensa {reward.reward_threshold !== '?' ? `(${reward.reward_threshold} sellos)` : ''}
                        </p>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 ml-8">
                        <Calendar className="inline h-3 w-3 mr-1" />
                        Ganado: {formatRewardDate(reward.earned_at)}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#0B0B16] bg-[#5B7CF7]' : 'border-zinc-300'}`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      {!loadingPendingRewards && pendingRewards.length === 0 && numberRewardsUnused > 0 && (
        <div className="card-brutalist text-center p-4">
          <p className="text-zinc-500 text-sm">Hay {numberRewardsUnused} recompensa(s) disponible(s) sin registro de fecha.</p>
          <p className="text-zinc-400 text-xs mt-1">Las nuevas recompensas ganadas se registrarán con fecha.</p>
        </div>
      )}
      
      {(pendingRewards.length > 0 || numberRewardsUnused > 0) && (
        <div className="card-brutalist">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
            Monto de compra ({currencyInfo.code})
          </label>
          <div className="relative">
            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
            <Input
              type="number" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)}
              placeholder="0" className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
              data-testid="stamp-redeem-purchase-amount"
            />
          </div>
        </div>
      )}
      
      {numberRewardsUnused > 0 && (
        <ActionButton
          onClick={() => openConfirmation('Canjear')}
          disabled={loading || numberRewardsUnused < 1}
          loading={loading}
          label="Canjear Recompensa"
          testId="redeem-reward-button"
        />
      )}
      
      {numberRewardsUnused === 0 && (
        <div className="text-center p-6 bg-zinc-50 rounded-xl">
          <Gift className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm">No hay recompensas disponibles para canjear.</p>
          <p className="text-zinc-400 text-xs mt-2">Sigue acumulando sellos para ganar recompensas.</p>
        </div>
      )}
    </div>
  );
};
