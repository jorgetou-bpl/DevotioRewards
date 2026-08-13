import React from 'react';
import { PurchaseAmountInput, ActionButton, getCurrentTierInfo } from '../shared';

export const DiscountCashbackAction = ({
  cardType, balance, discountTiers, tierProgress, purchaseAmount, setPurchaseAmount,
  activeTab, loading, openConfirmation, formatCurrency, currencyInfo, actionConfig, minAmount = 0
}) => {
  const normalizedType = cardType.replace('_card', '');
  const discountLevel = balance.discountLevel ?? balance.discountPercentage ?? null;
  const isCashback = normalizedType === 'cashback' || normalizedType === 'cashback_card';
  const rateLabel = isCashback ? 'Cashback actual' : 'Descuento actual';
  const purchaseVal = parseFloat(purchaseAmount) || 0;
  const belowMinimum = minAmount > 0 && purchaseAmount !== '' && purchaseVal < minAmount;

  const {
    percentage: displayPercentage,
    tierName: currentTierName,
    accumulatedAmount,
    nextTierName,
    nextThreshold,
    amountToNext,
    nextTierPercentage: nextTierPct
  } = getCurrentTierInfo(discountTiers, tierProgress, balance);

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
        error={belowMinimum ? `El monto mínimo es ${formatCurrency(minAmount)} — montos menores no acumulan` : null}
      />

      <ActionButton
        onClick={() => openConfirmation(activeTab)}
        disabled={loading || !purchaseAmount || belowMinimum}
        loading={loading}
        label={actionConfig.label}
        testId="add-points-button"
      />
    </div>
  );
};
