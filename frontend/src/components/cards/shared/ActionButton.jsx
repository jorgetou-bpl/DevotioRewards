import React from 'react';
import { Button } from '../../ui/button';
import { Loader2 } from 'lucide-react';

export const ActionButton = ({ onClick, disabled, loading, label, variant = 'primary', testId }) => {
  const cls = variant === 'primary' 
    ? 'btn-primary' 
    : 'border-2 bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white';
  const style = variant === 'secondary' ? { borderColor: '#120627', color: '#120627' } : {};

  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full h-12 sm:h-14 text-base sm:text-lg ${cls} disabled:opacity-50`}
      style={style}
      data-testid={testId}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
    </Button>
  );
};
