import React from 'react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Plus, Minus, Loader2 } from 'lucide-react';

export const GenericRedeemAction = ({
  cardType, balance, activeTab, actionAmount, setActionAmount, setPurchaseAmount,
  loading, openConfirmation, formatCurrency, currencyInfo, actionConfig
}) => {
  const normalizedType = cardType.replace('_card', '');

  let availableAmount = 0;
  if (activeTab === 'Puntos') {
    availableAmount = balance.bonusBalance || 0;
  } else {
    if (normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card') {
      availableAmount = balance.balance || balance.bonusBalance || 0;
    } else if (normalizedType === 'cashback' || normalizedType === 'cashback_card') {
      availableAmount = balance.balance || 0;
    } else if (normalizedType === 'membership') {
      availableAmount = balance.currentNumberOfUses || 0;
    } else if (normalizedType === 'multipass' || normalizedType === 'subscription') {
      availableAmount = balance.currentNumberOfUses || 0;
    } else if (balance.numberRewardsUnused != null) {
      availableAmount = balance.numberRewardsUnused;
    } else if (balance.visitsAvailable != null) {
      availableAmount = balance.visitsAvailable;
    } else {
      availableAmount = balance.bonusBalance || balance.balance || 0;
    }
  }

  let availableLabel = 'Puntos disponibles';
  if (normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card') availableLabel = 'Balance Total';
  else if (normalizedType === 'cashback' || normalizedType === 'cashback_card') availableLabel = 'Cashback disponible';
  else if (normalizedType === 'membership') availableLabel = 'Visitas disponibles';
  else if (normalizedType === 'multipass' || normalizedType === 'subscription') availableLabel = 'Visitas disponibles';
  else if (balance.numberRewardsUnused != null) availableLabel = 'Recompensas disponibles';
  else if (balance.visitsAvailable != null) availableLabel = 'Visitas disponibles';

  const isCurrencyType = ['cashback', 'cashback_card', 'certificate', 'gift', 'gift_card'].includes(normalizedType);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
        <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
          {isCurrencyType ? formatCurrency(availableAmount) : availableAmount}
        </span>
        <p className="text-xs sm:text-sm text-zinc-500 mt-2">{availableLabel}</p>
      </div>
      
      {isCurrencyType ? (
        <div className="card-brutalist">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
            Monto a canjear ({currencyInfo.code})
          </label>
          <div className="relative">
            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
            <Input
              type="number"
              value={actionAmount || ''}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                const next = val === '' ? '' : Math.max(0, Math.min(availableAmount || 999999, val));
                setActionAmount(next);
                // Currency amount, not a count — feed purchaseAmount too so the
                // high-amount confirmation warning (reads purchaseAmount only)
                // applies to redemptions as well as additions.
                setPurchaseAmount(next === '' ? '' : String(next));
              }}
              placeholder="0" min="0" max={availableAmount || 999999}
              className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
              data-testid="redeem-amount-input"
            />
          </div>
          <p className="text-xs text-zinc-400 mt-2 text-center">Máximo disponible: {formatCurrency(availableAmount)}</p>
        </div>
      ) : (
        <div className="card-brutalist">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">Cantidad a canjear</label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#5B7CF7] hover:border-[#5B7CF7] hover:text-white flex-shrink-0"
              style={{ borderColor: '#0B0B16', color: '#0B0B16' }} data-testid="decrease-redeem">
              <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            <Input type="number" value={actionAmount}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setActionAmount(Math.max(1, Math.min(availableAmount || 999999, val)));
              }}
              min="1" max={availableAmount || 999999}
              className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
              data-testid="redeem-amount-input" />
            <Button variant="outline" size="icon" 
              onClick={() => setActionAmount(Math.min(availableAmount || 999999, actionAmount + 1))}
              disabled={availableAmount > 0 && actionAmount >= availableAmount}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#5B7CF7] hover:border-[#5B7CF7] hover:text-white flex-shrink-0"
              style={{ borderColor: '#0B0B16', color: '#0B0B16' }} data-testid="increase-redeem">
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>
        </div>
      )}
      
      <Button
        onClick={() => openConfirmation(activeTab)}
        disabled={loading || availableAmount <= 0 || (availableAmount > 0 && actionAmount > availableAmount) || !actionAmount || actionAmount < 1}
        className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary disabled:opacity-50"
        data-testid="redeem-button"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
      </Button>
    </div>
  );
};
