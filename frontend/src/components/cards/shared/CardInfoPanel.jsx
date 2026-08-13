import React from 'react';
import { User, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';

export const CustomerInfoPanel = ({ card, show, onToggle }) => (
  <div className="border border-zinc-200 rounded-xl mb-3 sm:mb-4">
    <button onClick={onToggle}
      className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-zinc-50 transition-colors rounded-xl"
      data-testid="toggle-customer-info">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#0B0B16]" />
        <span className="font-semibold text-xs sm:text-sm uppercase tracking-wider text-[#0B0B16]">Información del cliente</span>
      </div>
      {show ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
    </button>
    {show && (
      <div className="border-t border-zinc-200 divide-y divide-zinc-100">
        <div className="flex justify-between p-3 sm:p-4">
          <span className="text-zinc-500 text-sm">Nombre</span>
          <span className="font-medium text-sm">{card.customer?.firstName || 'N/A'}</span>
        </div>
        <div className="flex justify-between p-3 sm:p-4">
          <span className="text-zinc-500 text-sm">Apellido</span>
          <span className="font-medium text-sm">{card.customer?.surname || 'N/A'}</span>
        </div>
        <div className="flex justify-between p-3 sm:p-4">
          <span className="text-zinc-500 text-sm">Teléfono</span>
          <span className="masked-data text-sm">{card.customer?.phone || '***-***-****'}</span>
        </div>
        <div className="flex justify-between p-3 sm:p-4">
          <span className="text-zinc-500 text-sm">Correo</span>
          <span className="masked-data text-sm">{card.customer?.email || '***@***.***'}</span>
        </div>
      </div>
    )}
  </div>
);

export const CardInfoPanel = ({ card, cardType, balance, show, onToggle, formatCurrency, discountTiers, tierProgress }) => {
  const isStamp = cardType === 'stamp' || cardType === 'stamp_card';
  const normalizedType = cardType?.replace('_card', '') || '';

  return (
    <div className="border border-zinc-200 rounded-xl mb-4 sm:mb-6">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-zinc-50 transition-colors rounded-xl"
        data-testid="toggle-card-info">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-[#0B0B16]" />
          <span className="font-semibold text-xs sm:text-sm uppercase tracking-wider text-[#0B0B16]">Información de tarjeta</span>
        </div>
        {show ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
      </button>
      {show && (
        <div className="border-t border-zinc-200 divide-y divide-zinc-100">
          {isStamp && (
            <Row label="Sellos activos" value={balance.currentNumberOfUses ?? 0} />
          )}
          {!isStamp && balance.currentNumberOfUses != null && (
            <Row label="Visitas disponibles" value={balance.currentNumberOfUses} />
          )}
          {balance.numberRewardsUnused != null && (
            <Row label="Recompensas disponibles" value={balance.numberRewardsUnused} />
          )}
          {balance.bonusBalance != null && (
            <Row label="Balance de puntos" value={balance.bonusBalance} />
          )}
          {balance.balance != null && balance.balance > 0 && (
            <Row label="Balance total" value={formatCurrency(balance.balance)} />
          )}
          {balance.discountPercentage != null && (() => {
            let tierName = null;
            if (discountTiers?.length > 0) {
              const sorted = [...discountTiers].sort((a, b) => a.threshold - b.threshold);
              for (let i = sorted.length - 1; i >= 0; i--) {
                if (balance.discountPercentage >= sorted[i].percentage) { tierName = sorted[i].name; break; }
              }
            }
            return <Row label="Nivel de descuento actual" value={tierName ? `${tierName} (${balance.discountPercentage}%)` : `${balance.discountPercentage}%`} />;
          })()}
          {['discount', 'cashback'].includes(normalizedType) && (() => {
            const localAmt = tierProgress?.accumulated_amount || 0;
            const apiAmt = (balance.discountAmount || 0) / 100;
            const showAmt = localAmt > 0 ? localAmt : apiAmt;
            if (showAmt <= 0) return null;
            return <Row label="Importe de transacciones" value={formatCurrency(showAmt)} />;
          })()}
          {['cashback', 'discount'].includes(normalizedType) && tierProgress?.next_tier && (
            <Row label={`Hasta ${tierProgress.next_tier}`} value={formatCurrency(tierProgress.amount_to_next || 0)} />
          )}
          {balance.discountLevel != null && !balance.discountPercentage && (
            <Row label="Nivel de descuento" value={`${balance.discountLevel}%`} />
          )}
          {balance.discountStatus && <Row label="Estado de descuento" value={balance.discountStatus} />}
          {balance.totalSavings != null && <Row label="Ahorro total" value={formatCurrency(balance.totalSavings)} />}
          {card.countVisits > 0 && <Row label="Transacciones" value={card.countVisits} />}
          {card.totalRewardsRedeemed > 0 && <Row label="Recompensas canjeadas" value={card.totalRewardsRedeemed} />}
          {card.device && <Row label="Instalada en" value={card.device} />}
          {card.createdAt && <Row label="Fecha de instalación" value={new Date(card.createdAt).toLocaleDateString('es-CR', { year: 'numeric', month: '2-digit', day: '2-digit' })} />}
          {card.updatedAt && <Row label="Última actividad" value={new Date(card.updatedAt).toLocaleDateString('es-CR', { year: 'numeric', month: '2-digit', day: '2-digit' })} />}
          <div className="flex justify-between p-3 sm:p-4">
            <span className="text-zinc-500 text-sm">Número de serie</span>
            <span className="text-mono text-xs sm:text-sm truncate ml-2">{card.id}</span>
          </div>
          {card.serialNumber && card.serialNumber !== card.id && <Row label="Serial adicional" value={card.serialNumber} mono />}
          {card.installDate && !card.createdAt && <Row label="Fecha de instalación" value={card.installDate} />}
          {card.lastAccrual && <Row label="Última acumulación" value={card.lastAccrual} />}
          {card.expirationDate && <Row label="Fecha de expiración" value={card.expirationDate} />}
          {card.expiresAt && <Row label="Expira" value={new Date(card.expiresAt).toLocaleDateString('es')} />}
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value, mono }) => (
  <div className="flex justify-between p-3 sm:p-4">
    <span className="text-zinc-500 text-sm">{label}</span>
    <span className={`font-medium text-sm ${mono ? 'text-mono text-xs sm:text-sm' : ''}`}>{value}</span>
  </div>
);
