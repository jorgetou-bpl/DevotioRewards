import React from 'react';
import { Input } from '../../ui/input';
import { User } from 'lucide-react';
import StampGrid from '../StampGrid';
import { PurchaseAmountInput, AmountCounter, ActionButton } from '../shared';

export const StampAddAction = ({
  balance, stampConfig, purchaseAmount, setPurchaseAmount,
  actionAmount, setActionAmount, loading, openConfirmation, formatCurrency, currencyInfo,
  stampRewardTiers = [], minAmount = 0, stampsPerVisit = 1
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

  // The generic rate ("1 sello por cada X") reads as ambiguous about whether
  // the leftover carries over — showing the actual stamps/loss for the
  // amount just typed removes that ambiguity entirely.
  const spendThreshold = stampConfig.spend_threshold || 0;
  const stampsToAward = spendThreshold > 0 ? Math.floor(purchaseVal / spendThreshold) : 0;
  const remainderLost = purchaseVal - (stampsToAward * spendThreshold);
  const spendHint = purchaseVal > 0
    ? (stampsToAward > 0
        ? `Con ${formatCurrency(purchaseVal)} se otorgan ${stampsToAward} sello${stampsToAward !== 1 ? 's' : ''}${remainderLost > 0 ? ` — los ${formatCurrency(remainderLost)} restantes no se guardan para la próxima compra` : ''}.`
        : `Se necesitan al menos ${formatCurrency(spendThreshold)} para ganar 1 sello. Este monto no se guarda para la próxima compra.`)
    : `Se gana 1 sello por cada ${formatCurrency(spendThreshold)} de esta compra. El resto no se guarda para la próxima.`;

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
        hint={isSpendMode ? spendHint : null}
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
