import React from 'react';
import { Input } from '../../ui/input';
import { formatWithThousands, stripThousandsFormatting } from './numberFormat';

export const PurchaseAmountInput = ({
  value,
  onChange,
  currencyInfo,
  required = false,
  optional = false,
  hint = null,
  testId = "purchase-amount-input",
  error = null
}) => (
  <div className="card-brutalist">
    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
      Monto de compra ({currencyInfo.code}) {required && <span className="text-red-500">*</span>}{optional && <span className="text-zinc-400">(opcional)</span>}
    </label>
    {hint && <p className="text-xs text-zinc-400 mb-3">{hint}</p>}
    <div className="relative">
      <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
      <Input
        type="text"
        inputMode="decimal"
        value={formatWithThousands(value)}
        onChange={(e) => onChange(stripThousandsFormatting(e.target.value))}
        placeholder="0"
        className={`input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center ${error ? 'border-red-300' : ''}`}
        data-testid={testId}
      />
    </div>
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);
