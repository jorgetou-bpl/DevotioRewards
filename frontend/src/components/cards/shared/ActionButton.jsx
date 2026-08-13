import React from 'react';
import { Button } from '../../ui/button';
import { Loader2 } from 'lucide-react';

export const ActionButton = ({ onClick, disabled, loading, label, variant = 'primary', testId }) => {
  const cls = variant === 'primary' 
    ? 'btn-primary' 
    : 'border-2 bg-white hover:bg-[#5B7CF7] hover:border-[#5B7CF7] hover:text-white';
  const style = variant === 'secondary' ? { borderColor: '#0B0B16', color: '#0B0B16' } : {};

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
