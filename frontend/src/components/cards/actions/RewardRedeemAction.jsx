import React from 'react';
import { Gift } from 'lucide-react';
import { PurchaseAmountInput, BalanceDisplay } from '../shared';

export const RewardRedeemAction = ({
  balance, card, purchaseAmount, setPurchaseAmount, actionAmount, setActionAmount,
  loading, openConfirmation, currencyInfo
}) => {
  const availableAmount = balance.bonusBalance || 0;
  const availableRewardTiers = card.availableRewardTiers || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <BalanceDisplay value={availableAmount} label="Puntos acumulados" />
      
      <PurchaseAmountInput
        value={purchaseAmount}
        onChange={setPurchaseAmount}
        currencyInfo={currencyInfo}
        required
        hint="Ingrese el monto de la transacción del cliente"
        testId="reward-redeem-purchase-amount"
      />
      
      {availableRewardTiers.length > 0 ? (
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">
            Recompensas disponibles
          </label>
          {availableRewardTiers.map((tier) => (
            <button
              key={tier.id}
              onClick={() => { setActionAmount(tier.id); openConfirmation('Canjear', tier); }}
              disabled={loading || !purchaseAmount}
              className={`w-full p-4 border-2 rounded-xl text-left transition-all ${!purchaseAmount ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#0B0B16] hover:bg-zinc-50'}`}
              style={{ borderColor: actionAmount === tier.id ? '#0B0B16' : '#e4e4e7' }}
              data-testid={`reward-tier-${tier.id}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm sm:text-base">{tier.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">Requiere: {tier.threshold} puntos</p>
                </div>
                <Gift className="h-5 w-5 text-[#0B0B16]" />
              </div>
            </button>
          ))}
          {!purchaseAmount && (
            <p className="text-xs text-[#5B7CF7] text-center">Ingrese el monto de compra para canjear una recompensa</p>
          )}
        </div>
      ) : (
        <div className="text-center p-6 bg-zinc-50 rounded-xl">
          <p className="text-zinc-500 text-sm">No hay recompensas disponibles aún.</p>
          <p className="text-zinc-400 text-xs mt-2">Acumula más puntos para desbloquear recompensas.</p>
        </div>
      )}
    </div>
  );
};
