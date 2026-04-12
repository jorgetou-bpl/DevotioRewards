import React from 'react';
import { Input } from '../../ui/input';
import { PurchaseAmountInput, BalanceDisplay, ActionButton } from '../shared';

export const MultipassPointsAction = ({
  balance, purchaseAmount, setPurchaseAmount, actionAmount, setActionAmount,
  loading, openConfirmation, currencyInfo
}) => {
  const bonusPoints = balance.bonusBalance || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <BalanceDisplay value={bonusPoints} label="Puntos acumulados" />
      
      <PurchaseAmountInput
        value={purchaseAmount}
        onChange={setPurchaseAmount}
        currencyInfo={currencyInfo}
        testId="multipass-points-purchase-amount"
      />
      
      <div className="card-brutalist">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
          Cantidad de puntos
        </label>
        <Input
          type="number"
          value={actionAmount}
          onChange={(e) => setActionAmount(Math.max(0, parseInt(e.target.value) || 0))}
          min="0" placeholder="0"
          className="input-brutalist text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
          data-testid="points-amount-input"
        />
        {actionAmount > bonusPoints && (
          <p className="text-xs text-red-500 mt-2 text-center">Solo hay {bonusPoints} puntos disponibles para canjear</p>
        )}
      </div>
      
      <div className="space-y-3">
        <ActionButton
          onClick={() => openConfirmation('AgregarPuntos')}
          disabled={loading || actionAmount < 1}
          loading={loading}
          label="Agregar Puntos"
          testId="add-points-button"
        />
        <ActionButton
          onClick={() => openConfirmation('CanjearPuntos')}
          disabled={loading || actionAmount < 1 || actionAmount > bonusPoints}
          loading={loading}
          label="Canjear Puntos"
          variant="secondary"
          testId="redeem-points-button"
        />
      </div>
    </div>
  );
};
