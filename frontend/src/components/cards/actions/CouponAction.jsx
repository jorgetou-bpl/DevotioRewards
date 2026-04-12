import React from 'react';
import { Check, X } from 'lucide-react';
import { PurchaseAmountInput, ActionButton } from '../shared';

export const CouponAction = ({
  card, purchaseAmount, setPurchaseAmount, loading, openConfirmation, currencyInfo, actionConfig
}) => {
  const isCouponRedeemed = card.couponRedeemed === true;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
        {isCouponRedeemed ? (
          <>
            <div className="status-badge mx-auto mb-4" style={{ backgroundColor: '#6B7280', color: 'white' }}>
              <X className="h-4 w-4" /><span>Ya Canjeado</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500">Este cupón ya fue utilizado</p>
          </>
        ) : (
          <>
            <div className="status-badge success mx-auto mb-4">
              <Check className="h-4 w-4" /><span>Activo</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500">Este cupón está listo para usar</p>
          </>
        )}
      </div>
      
      {!isCouponRedeemed && (
        <PurchaseAmountInput
          value={purchaseAmount}
          onChange={setPurchaseAmount}
          currencyInfo={currencyInfo}
          testId="coupon-purchase-amount"
        />
      )}
      
      <ActionButton
        onClick={() => openConfirmation('Usar')}
        disabled={loading || isCouponRedeemed}
        loading={loading}
        label={isCouponRedeemed ? 'Cupón Ya Utilizado' : actionConfig.label}
        testId="use-coupon-button"
      />
    </div>
  );
};
