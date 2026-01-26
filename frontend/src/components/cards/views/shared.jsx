// Shared components and utilities for card views
import React from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, Plus, Minus } from 'lucide-react';

// Amount counter component with +/- buttons
export const AmountCounter = ({ 
  value, 
  onChange, 
  min = 1, 
  max = 999,
  label,
  testIdPrefix,
  loading = false 
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
        disabled={loading}
        className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
        style={{ borderColor: '#120627', color: '#120627' }}
        data-testid={`${testIdPrefix}-decrease`}
      >
        <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const val = parseInt(e.target.value) || min;
          onChange(Math.max(min, Math.min(val, max)));
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
        disabled={loading}
        className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
        style={{ borderColor: '#120627', color: '#120627' }}
        data-testid={`${testIdPrefix}-increase`}
      >
        <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    </div>
  </div>
);

// Currency input component
export const CurrencyInput = ({ 
  value, 
  onChange, 
  currencyInfo,
  label,
  testId,
  placeholder = "0"
}) => (
  <div className="card-brutalist">
    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
      {label} ({currencyInfo.code})
    </label>
    <div className="relative">
      <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">
        {currencyInfo.symbol}
      </span>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
        data-testid={testId}
      />
    </div>
  </div>
);

// Balance display component
export const BalanceDisplay = ({ 
  value, 
  label, 
  large = false,
  className = ""
}) => (
  <div className={`text-center p-4 sm:p-6 bg-zinc-50 rounded-xl ${className}`}>
    <span className={`font-mono font-bold gradient-text ${large ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>
      {value}
    </span>
    <p className="text-xs sm:text-sm text-zinc-500 mt-2">{label}</p>
  </div>
);

// Action button component
export const ActionButton = ({ 
  onClick, 
  disabled, 
  loading, 
  label, 
  testId,
  variant = "primary" // primary or secondary
}) => {
  const isPrimary = variant === "primary";
  
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full h-12 sm:h-14 text-base sm:text-lg ${
        isPrimary 
          ? 'btn-primary' 
          : 'border-2 bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white'
      }`}
      style={!isPrimary ? { borderColor: '#120627', color: '#120627' } : {}}
      data-testid={testId}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
    </Button>
  );
};

// Empty state component
export const EmptyState = ({ 
  icon: Icon, 
  title, 
  subtitle 
}) => (
  <div className="text-center p-6 bg-zinc-50 rounded-xl">
    <Icon className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
    <p className="text-zinc-500 text-sm">{title}</p>
    {subtitle && <p className="text-zinc-400 text-xs mt-2">{subtitle}</p>}
  </div>
);

// Status badge component
export const StatusBadge = ({ 
  status, 
  label 
}) => {
  const isActive = status === 'active' || status === 'Activo' || status === 1;
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white ${
      isActive ? 'bg-green-500' : 'bg-gray-500'
    }`}>
      {label || (isActive ? 'Activo' : 'Inactivo')}
    </span>
  );
};
