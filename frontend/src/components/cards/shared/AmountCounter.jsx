import React from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Plus, Minus } from 'lucide-react';

export const AmountCounter = ({ 
  value, 
  onChange, 
  label, 
  min = 1, 
  max = 999999,
  testIdPrefix = "amount",
  warning = null
}) => (
  <div className="card-brutalist">
    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
      {label}
    </label>
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
        style={{ borderColor: '#120627', color: '#120627' }}
        data-testid={`decrease-${testIdPrefix}`}
      >
        <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const val = parseInt(e.target.value) || min;
          onChange(Math.max(min, Math.min(max, val)));
        }}
        min={min}
        max={max}
        className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
        data-testid={`${testIdPrefix}-input`}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
        style={{ borderColor: '#120627', color: '#120627' }}
        data-testid={`increase-${testIdPrefix}`}
      >
        <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    </div>
    {warning && <p className="text-xs text-red-500 mt-2 text-center">{warning}</p>}
  </div>
);
