import React from 'react';
import { Input } from '../../ui/input';
import { User } from 'lucide-react';
import StampGrid from '../StampGrid';
import { PurchaseAmountInput, AmountCounter, ActionButton } from '../shared';

export const StampAddAction = ({
  balance, stampConfig, stampProgress, purchaseAmount, setPurchaseAmount,
  actionAmount, setActionAmount, loading, openConfirmation, formatCurrency, currencyInfo
}) => {
  const activeStamps = balance.currentNumberOfUses ?? 0;
  const stampsBeforeReward = balance.stampsBeforeReward ?? 0;
  const displayTotal = activeStamps + stampsBeforeReward || 10;
  const isPurchaseValid = parseFloat(purchaseAmount) > 0;
  const stampMode = stampConfig.stamp_mode;
  const isSpendMode = stampMode === 'spend';
  const isVisitMode = stampMode === 'visit';
  const isManualMode = stampMode === 'manual' || !stampMode;

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
        </p>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          {stampsBeforeReward > 0 
            ? `${stampsBeforeReward} sello${stampsBeforeReward !== 1 ? 's' : ''} hasta la próxima recompensa`
            : '¡Recompensa disponible!'}
        </p>
      </div>
      
      {isSpendMode && stampProgress.accumulated_amount > 0 && (
        <div className="card-brutalist bg-blue-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Progreso hacia próximo sello
          </p>
          <div className="w-full bg-zinc-200 rounded-full h-3 mb-2">
            <div 
              className="bg-gradient-to-r from-[#F040A0] to-[#120627] h-3 rounded-full transition-all"
              style={{ width: `${stampProgress.progress_percent}%` }}
            />
          </div>
          <p className="text-xs text-zinc-600 text-center">
            {formatCurrency(stampProgress.accumulated_amount)} de {formatCurrency(stampProgress.threshold)} ({stampProgress.progress_percent}%)
          </p>
        </div>
      )}
      
      <PurchaseAmountInput
        value={purchaseAmount}
        onChange={setPurchaseAmount}
        currencyInfo={currencyInfo}
        required
        testId="stamp-purchase-amount"
        error={!isPurchaseValid && purchaseAmount !== '' ? 'El monto de compra debe ser mayor a 0' : null}
        hint={isSpendMode ? `Se gana 1 sello cada ${formatCurrency(stampConfig.spend_threshold)}. El progreso se acumula entre compras.` : null}
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
              <span className="text-3xl font-mono font-bold text-[#120627]">1</span>
              <p className="text-xs text-zinc-500">sello por visita</p>
            </div>
          </div>
        </div>
      )}
      
      <ActionButton
        onClick={() => openConfirmation('Agregar')}
        disabled={loading || (isManualMode && actionAmount < 1) || !isPurchaseValid}
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
