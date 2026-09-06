import React from 'react';
import { Star } from 'lucide-react';
import { PurchaseAmountInput, AmountCounter, ActionButton } from '../shared';
import { isUnlimitedMembership } from '../shared/membershipUtils';

export const MembershipAction = ({
  card, balance, purchaseAmount, setPurchaseAmount, actionAmount, setActionAmount,
  loading, openConfirmation, currencyInfo
}) => {
  const membershipTier = card.membershipTier || {};
  const customerSubscription = card.customerSubscription || {};
  const subscriptionStatus = customerSubscription.status === 1 ? 'Activo' : 'Inactivo';
  const availableVisits = balance.currentNumberOfUses || 0;
  const isUnlimited = isUnlimitedMembership(card);
  const customerName = card.customer?.firstName
    ? `${card.customer.firstName} ${card.customer.surname || ''}`.trim()
    : 'Cliente';
  const initials = customerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center p-4 sm:p-6 bg-gradient-to-br from-zinc-50 to-zinc-100 rounded-2xl border border-zinc-200">
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#1447E6] to-[#8CA4FE] flex items-center justify-center shadow-lg">
          <span className="text-2xl sm:text-3xl font-bold text-white">{initials}</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-[#0B0B16] mb-3">{customerName}</h3>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5B7CF7] text-white text-sm font-semibold mb-2">
          <Star className="h-4 w-4" />
          {membershipTier.name || 'Membresía'}
        </div>
        <div className="flex justify-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white ${subscriptionStatus === 'Activo' ? 'bg-green-500' : 'bg-gray-500'}`}>
            {subscriptionStatus}
          </span>
        </div>
      </div>
      
      <div className="text-center p-6 bg-white rounded-xl border-2 border-[#0B0B16]">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Visitas Disponibles</p>
        {isUnlimited ? (
          <span className="text-3xl sm:text-4xl font-bold gradient-text">Ilimitadas</span>
        ) : (
          <span className="text-5xl sm:text-6xl font-mono font-bold gradient-text">{availableVisits}</span>
        )}
      </div>

      {isUnlimited || availableVisits > 0 ? (
        <>
          <PurchaseAmountInput
            value={purchaseAmount}
            onChange={setPurchaseAmount}
            currencyInfo={currencyInfo}
            optional
            hint="Monto de la transacción del cliente (si aplica)"
            testId="membership-redeem-purchase-amount"
          />

          <AmountCounter
            value={actionAmount}
            onChange={setActionAmount}
            label="Visitas a canjear"
            max={isUnlimited ? undefined : availableVisits}
            testIdPrefix="membership-redeem-visits"
          />

          <ActionButton
            onClick={() => openConfirmation('CanjearVisitas')}
            disabled={loading || actionAmount < 1 || (!isUnlimited && (availableVisits <= 0 || actionAmount > availableVisits))}
            loading={loading}
            label="Canjear Visita"
            testId="redeem-membership-visits-button"
          />
        </>
      ) : (
        <div className="text-center p-6 bg-zinc-50 rounded-xl">
          <p className="text-zinc-500">No hay visitas disponibles para canjear</p>
        </div>
      )}
    </div>
  );
};
