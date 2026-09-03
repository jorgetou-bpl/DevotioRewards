import React from 'react';
import { Input } from '../../ui/input';
import { User } from 'lucide-react';
import StampGrid from '../StampGrid';
import { PurchaseAmountInput, AmountCounter, ActionButton } from '../shared';

export const StampAddAction = ({
  balance, stampConfig, purchaseAmount, setPurchaseAmount,
  actionAmount, setActionAmount, loading, openConfirmation, formatCurrency, currencyInfo,
  stampRewardTiers = [], minAmount = 0
}) => {
  const activeStamps = balance.currentNumberOfUses ?? 0;
  const stampsBeforeReward = balance.stampsBeforeReward ?? 0;
  const displayTotal = activeStamps + stampsBeforeReward || 10;
  const isPurchaseValid = parseFloat(purchaseAmount) > 0;

  // The card balance only reflects progress toward the NEXT reward tier — for
  // multi-tier cards (e.g. a reward at 2 stamps and another at 5), find the
  // tier after that one so the operator sees the full structure, not just "de 2".
  const allTierThresholds = stampRewardTiers
    .map((t) => t.threshold)
    .filter((threshold) => typeof threshold === 'number')
    .sort((a, b) => a - b);
  const laterTierThresholds = allTierThresholds.filter((threshold) => threshold > displayTotal);
  const nextTierAfterThreshold = laterTierThresholds[0];
  const hasMultipleTiers = allTierThresholds.length > 1;
  const tierListLabel = allTierThresholds.length > 2
    ? `${allTierThresholds.slice(0, -1).join(', ')} y ${allTierThresholds[allTierThresholds.length - 1]}`
    : allTierThresholds.join(' y ');
  const stampMode = stampConfig.stamp_mode;
  const isSpendMode = stampMode === 'spend';
  const isVisitMode = stampMode === 'visit';
  const isManualMode = stampMode === 'manual' || !stampMode;
  // Minimum purchase amount gates accumulation in every mode that takes a
  // purchase amount — spend, manual, and visit all ask for one.
  const purchaseVal = parseFloat(purchaseAmount) || 0;
  const belowMinimum = minAmount > 0 && purchaseAmount !== '' && purchaseVal < minAmount;
  const stampsPerVisit = stampConfig.visit_stamps_per_visit || 1;

  return (
    <div className="space-y-4 sm:space-y-6">
      <StampGrid 
        activeStamps={activeStamps} 
        stampsUntilReward={stampsBeforeReward}
        totalStampsForReward={displayTotal}
        numberStampsTotal={displayTotal}
      />
      
      <div className="text-center">
        <p className="text-xs sm:text-sm text-zinc-500">
          Sellos activos: {activeStamps} de {displayTotal}
          {nextTierAfterThreshold ? ` — próximo nivel a los ${nextTierAfterThreshold}` : ''}
        </p>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          {stampsBeforeReward > 0
            ? `${stampsBeforeReward} sello${stampsBeforeReward !== 1 ? 's' : ''} hasta la próxima recompensa`
            : '¡Recompensa disponible!'}
        </p>
        {hasMultipleTiers && (
          <p className="text-xs text-zinc-400 mt-1">
            Esta tarjeta tiene recompensas en {tierListLabel} sellos
          </p>
        )}
      </div>
      
      <PurchaseAmountInput
        value={purchaseAmount}
        onChange={setPurchaseAmount}
        currencyInfo={currencyInfo}
        required
        testId="stamp-purchase-amount"
        error={
          !isPurchaseValid && purchaseAmount !== ''
            ? 'El monto de compra debe ser mayor a 0'
            : belowMinimum
              ? `El monto mínimo es ${formatCurrency(minAmount)} — montos menores no acumulan`
              : null
        }
        hint={isSpendMode ? `Se gana 1 sello por cada ${formatCurrency(stampConfig.spend_threshold)} de esta compra. El resto no se acumula para la próxima.` : null}
      />
      
      {isManualMode && (
        <AmountCounter
          value={actionAmount}
          onChange={setActionAmount}
          label="Cantidad de sellos"
          testIdPrefix="amount"
        />
      )}
      
      {isVisitMode && (
        <div className="card-brutalist bg-green-50">
          <div className="flex items-center justify-center gap-3">
            <User className="h-6 w-6 text-green-600" />
            <div className="text-center">
              <span className="text-3xl font-mono font-bold text-[#0B0B16]">{stampsPerVisit}</span>
              <p className="text-xs text-zinc-500">sello{stampsPerVisit !== 1 ? 's' : ''} por visita</p>
            </div>
          </div>
        </div>
      )}
      
      <ActionButton
        onClick={() => openConfirmation('Agregar')}
        disabled={loading || (isManualMode && actionAmount < 1) || !isPurchaseValid || belowMinimum}
        loading={loading}
        label="Agregar Sellos"
        testId="add-stamp-button"
      />
      
      {!stampMode && (
        <p className="text-xs text-amber-600 text-center">
          Configure el modo de sellos en Configuración para optimizar la experiencia
        </p>
      )}
    </div>
  );
};
