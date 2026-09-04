import React from 'react';
import { Loader2, User } from 'lucide-react';
import { PurchaseAmountInput, AmountCounter, BalanceDisplay, ActionButton } from '../shared';

export const RewardAddAction = ({
  balance, card, detectedAccrualMode, detectingMode, needsModeSelection,
  purchaseAmount, setPurchaseAmount, actionAmount, setActionAmount,
  loading, openConfirmation, currencyInfo, formatCurrency, pointsRatio, actionConfig
}) => {
  const bonusBalance = balance.bonusBalance || 0;
  const availableRewardTiers = card.availableRewardTiers || [];
  const nextRewardThreshold = availableRewardTiers.length > 0 
    ? availableRewardTiers.find(t => t.threshold > bonusBalance)?.threshold || 'Max'
    : null;
  const modeLabels = { spend: 'Por Compra', visit: 'Por Visita', points: 'Manual' };

  return (
    <div className="space-y-4 sm:space-y-6">
      <BalanceDisplay 
        value={bonusBalance} 
        label="Puntos acumulados"
        subtext={nextRewardThreshold && nextRewardThreshold !== 'Max' ? `Siguiente recompensa a los ${nextRewardThreshold} puntos` : null}
      />
      
      {detectingMode && (
        <div className="card-brutalist text-center py-4">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B0B16]" />
          <p className="text-sm text-zinc-500">Cargando configuración...</p>
        </div>
      )}
      
      {needsModeSelection && !detectingMode && (
        <div className="text-center p-6 bg-amber-50 border border-amber-200 rounded-xl" data-testid="no-accrual-mode-configured">
          <p className="text-sm text-amber-800 font-medium">
            Este negocio no tiene configurado el tipo de acumulación para tarjetas de puntos.
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Contacte a Devotio para configurarlo en el panel de administración antes de acumular.
          </p>
        </div>
      )}
      
      {detectedAccrualMode && !detectingMode && !needsModeSelection && (
        <div className="flex justify-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#5B7CF7]/10 text-[#0B0B16]">
            Modo: {modeLabels[detectedAccrualMode] || detectedAccrualMode}
          </span>
        </div>
      )}
      
      {detectedAccrualMode === 'spend' && !detectingMode && !needsModeSelection && (
        <PurchaseAmountInput value={purchaseAmount} onChange={setPurchaseAmount} currencyInfo={currencyInfo}
          required
          hint={pointsRatio
            ? `${formatCurrency(pointsRatio.spentValue)} = ${pointsRatio.earnedValue} puntos`
            : 'Los puntos se calcularán automáticamente según las reglas del programa'}
          testId="reward-purchase-amount" />
      )}
      
      {detectedAccrualMode === 'visit' && !detectingMode && !needsModeSelection && (
        <>
          <PurchaseAmountInput value={purchaseAmount} onChange={setPurchaseAmount} currencyInfo={currencyInfo}
            required testId="reward-visit-purchase-amount" />
          <div className="card-brutalist bg-blue-50">
            <div className="flex items-center justify-center gap-3">
              <User className="h-6 w-6 text-blue-600" />
              <div className="text-center">
                <span className="text-3xl font-mono font-bold text-[#0B0B16]">1</span>
                <p className="text-xs text-zinc-500">visita por transacción</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 text-center mt-2">En modo visita, cada escaneo registra 1 visita</p>
          </div>
        </>
      )}
      
      {detectedAccrualMode === 'points' && !detectingMode && !needsModeSelection && (
        <>
          <PurchaseAmountInput value={purchaseAmount} onChange={setPurchaseAmount} currencyInfo={currencyInfo}
            required testId="reward-purchase-amount-manual" />
          <AmountCounter value={actionAmount} onChange={setActionAmount}
            label={<>Puntos a agregar <span className="text-[#5B7CF7]">*</span></>}
            testIdPrefix="reward-points" />
        </>
      )}
      
      {detectedAccrualMode && !needsModeSelection && (
        <ActionButton
          onClick={() => openConfirmation('Agregar')}
          disabled={loading || detectingMode || !detectedAccrualMode || !purchaseAmount || (detectedAccrualMode !== 'spend' && actionAmount < 1)}
          loading={loading}
          label={detectedAccrualMode === 'visit' ? 'Agregar Visita' : detectedAccrualMode === 'points' ? 'Agregar Puntos' : actionConfig.label}
          testId="add-reward-points-button"
        />
      )}
    </div>
  );
};
