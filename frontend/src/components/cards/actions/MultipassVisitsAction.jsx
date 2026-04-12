import React from 'react';
import { Input } from '../../ui/input';
import StampGrid from '../StampGrid';
import { PurchaseAmountInput, ActionButton } from '../shared';

export const MultipassVisitsAction = ({
  balance, purchaseAmount, setPurchaseAmount, actionAmount, setActionAmount,
  loading, openConfirmation, currencyInfo
}) => {
  const availableVisits = balance.currentNumberOfUses || 0;
  const totalVisits = balance.numberOfUses || 10;

  return (
    <div className="space-y-4 sm:space-y-6">
      <StampGrid 
        activeStamps={availableVisits} 
        stampsUntilReward={totalVisits - availableVisits}
        totalStampsForReward={totalVisits}
        numberStampsTotal={totalVisits}
        hideLabel={true}
      />
      
      <PurchaseAmountInput
        value={purchaseAmount}
        onChange={setPurchaseAmount}
        currencyInfo={currencyInfo}
        testId="multipass-purchase-amount"
      />
      
      <div className="card-brutalist">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
          Cantidad de visitas
        </label>
        <Input
          type="number"
          value={actionAmount}
          onChange={(e) => setActionAmount(Math.max(0, parseInt(e.target.value) || 0))}
          min="0" placeholder="0"
          className="input-brutalist text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
          data-testid="visits-amount-input"
        />
        {actionAmount > availableVisits && (
          <p className="text-xs text-red-500 mt-2 text-center">Solo hay {availableVisits} visitas disponibles para canjear</p>
        )}
      </div>
      
      <div className="space-y-3">
        <ActionButton
          onClick={() => openConfirmation('AgregarVisitas')}
          disabled={loading || actionAmount < 1}
          loading={loading}
          label="Agregar Visitas"
          testId="add-visits-button"
        />
        <ActionButton
          onClick={() => openConfirmation('CanjearVisitas')}
          disabled={loading || actionAmount < 1 || actionAmount > availableVisits}
          loading={loading}
          label="Canjear Visitas"
          variant="secondary"
          testId="redeem-visits-button"
        />
      </div>
    </div>
  );
};
