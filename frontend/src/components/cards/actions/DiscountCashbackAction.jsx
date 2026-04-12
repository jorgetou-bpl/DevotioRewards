import React from 'react';
import { PurchaseAmountInput, ActionButton } from '../shared';

export const DiscountCashbackAction = ({
  cardType, balance, discountTiers, tierProgress, purchaseAmount, setPurchaseAmount,
  activeTab, loading, openConfirmation, formatCurrency, currencyInfo, actionConfig
}) => {
  const normalizedType = cardType.replace('_card', '');
  const discountLevel = balance.discountLevel ?? balance.discountPercentage ?? null;
  const discountAmount = balance.discountAmount ?? 0;
  const totalTransactions = balance.transactionsAmount ?? discountAmount;
  const isCashback = normalizedType === 'cashback' || normalizedType === 'cashback_card';

  const accumulatedAmount = tierProgress ? tierProgress.accumulated_amount : (totalTransactions / 100);
  const rateLabel = isCashback ? 'Cashback actual' : 'Descuento actual';

  let currentTierName = tierProgress?.current_tier || null;
  let nextTierName = tierProgress?.next_tier || null;
  let nextThreshold = tierProgress?.next_threshold || null;
  let amountToNext = tierProgress?.amount_to_next || null;
  let displayPercentage = discountLevel;

  if (currentTierName && discountTiers.length > 0) {
    const matchedTier = discountTiers.find(t => t.name === currentTierName);
    if (matchedTier) displayPercentage = matchedTier.percentage;
  }

  if (!currentTierName && discountTiers.length > 0) {
    const sortedTiers = [...discountTiers].sort((a, b) => a.threshold - b.threshold);
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      if (accumulatedAmount >= sortedTiers[i].threshold) {
        currentTierName = sortedTiers[i].name;
        displayPercentage = sortedTiers[i].percentage;
        if (i < sortedTiers.length - 1) {
          nextTierName = sortedTiers[i + 1].name;
          nextThreshold = sortedTiers[i + 1].threshold;
          amountToNext = Math.max(0, sortedTiers[i + 1].threshold - accumulatedAmount);
        }
        break;
      }
    }
    if (!currentTierName) {
      currentTierName = sortedTiers[0]?.name;
      displayPercentage = sortedTiers[0]?.percentage || discountLevel;
      if (sortedTiers.length > 1) {
        nextTierName = sortedTiers[1].name;
        nextThreshold = sortedTiers[1].threshold;
        amountToNext = Math.max(0, sortedTiers[1].threshold - accumulatedAmount);
      }
    }
  }

  let nextTierPct = null;
  if (nextTierName && discountTiers.length > 0) {
    const nt = discountTiers.find(t => t.name === nextTierName);
    if (nt) nextTierPct = nt.percentage;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {isCashback && (
        <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
          <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">{formatCurrency(balance.balance || 0)}</span>
          <p className="text-xs sm:text-sm text-zinc-500 mt-2">Cashback disponible</p>
        </div>
      )}
      
      {discountLevel != null && (
        <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
          <span className="text-5xl sm:text-6xl font-mono font-bold gradient-text">{displayPercentage}%</span>
          {currentTierName && <p className="text-sm font-semibold text-[#120627] mt-1">{currentTierName}</p>}
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">{rateLabel}</p>
          
          {accumulatedAmount > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-200">
              <p className="text-sm text-zinc-600">
                Monto acumulado: <span className="font-semibold">{formatCurrency(accumulatedAmount)}</span>
              </p>
            </div>
          )}
          
          {nextTierName && nextThreshold && (
            <div className="mt-3 pt-3 border-t border-zinc-200">
              <p className="text-xs text-zinc-500">
                Falta {formatCurrency(amountToNext ?? 0)} para <span className="font-semibold">{nextTierName}</span>{nextTierPct ? ` (${nextTierPct}%)` : ''}
              </p>
              <div className="w-full bg-zinc-200 rounded-full h-2 mt-2">
                <div
                  className="bg-gradient-to-r from-[#F040A0] to-[#120627] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (accumulatedAmount / nextThreshold) * 100)}%` }}
                />
              </div>
            </div>
          )}
          
          {discountTiers.length > 0 && !nextTierName && currentTierName && (
            <div className="mt-3 pt-3 border-t border-zinc-200">
              <p className="text-xs text-emerald-600 font-medium">Nivel máximo alcanzado</p>
            </div>
          )}
        </div>
      )}
      
      <PurchaseAmountInput
        value={purchaseAmount}
        onChange={setPurchaseAmount}
        currencyInfo={currencyInfo}
        testId="purchase-amount-input"
      />
      
      <ActionButton
        onClick={() => openConfirmation(activeTab)}
        disabled={loading || !purchaseAmount}
        loading={loading}
        label={actionConfig.label}
        testId="add-points-button"
      />
    </div>
  );
};
