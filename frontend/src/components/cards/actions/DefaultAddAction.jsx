import React from 'react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Plus, Minus, Loader2 } from 'lucide-react';

export const DefaultAddAction = ({
  cardType, balance, actionAmount, setActionAmount, setPurchaseAmount,
  loading, openConfirmation, activeTab, formatCurrency, currencyInfo, actionConfig
}) => {
  const normalizedType = cardType.replace('_card', '');
  const isGiftType = ['certificate', 'gift', 'gift_card'].includes(normalizedType);

  return (
    <div className="space-y-4 sm:space-y-6">
      {isGiftType && (
        <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
          <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
            {formatCurrency(balance.balance || 0)}
          </span>
          <p className="text-xs sm:text-sm text-zinc-500 mt-2">Balance Total</p>
        </div>
      )}
      
      {isGiftType ? (
        <div className="card-brutalist">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
            Monto a agregar ({currencyInfo.code})
          </label>
          <div className="relative">
            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
            <Input
              type="number"
              value={actionAmount || ''}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                const next = val === '' ? '' : Math.max(0, val);
                setActionAmount(next);
                // This is a currency amount, not a count — feed it into
                // purchaseAmount too so the high-amount confirmation warning
                // (which only reads purchaseAmount) actually applies here.
                setPurchaseAmount(next === '' ? '' : String(next));
              }}
              placeholder="0" min="0"
              className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
              data-testid="default-amount-input"
            />
          </div>
        </div>
      ) : normalizedType === 'reward' ? (
        <div className="card-brutalist">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">Cantidad de puntos</label>
          <Input type="number" value={actionAmount || ''}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
              setActionAmount(val === '' ? '' : Math.max(0, val));
            }}
            placeholder="0" min="0"
            className="input-brutalist text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
            data-testid="default-amount-input" />
        </div>
      ) : (
        <div className="card-brutalist">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">Cantidad</label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50 flex-shrink-0"
              style={{ borderColor: '#0B0B16', color: '#0B0B16' }}>
              <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            <Input type="number" value={actionAmount}
              onChange={(e) => setActionAmount(Math.max(1, parseInt(e.target.value) || 1))}
              min="1" className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
              data-testid="default-amount-input" />
            <Button variant="outline" size="icon" onClick={() => setActionAmount(actionAmount + 1)}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50 flex-shrink-0"
              style={{ borderColor: '#0B0B16', color: '#0B0B16' }}>
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>
        </div>
      )}
      
      <Button
        onClick={() => openConfirmation(activeTab)}
        disabled={loading || !actionAmount || actionAmount < 1}
        className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
      </Button>
    </div>
  );
};
