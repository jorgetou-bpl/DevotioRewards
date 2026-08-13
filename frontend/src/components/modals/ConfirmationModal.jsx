import React, { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { formatActionTitle } from '../../config/cardTypes';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  details,
  config,
  loading,
  purchaseAmountFromParent,
  requireComments = true,
  commentMode = 'open',
  warning = null
}) => {
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const isInvoiceMode = commentMode === 'invoice_number';

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = comment.trim();
    if (requireComments && !trimmed) {
      setCommentError('Campo obligatorio');
      toast.error('El comentario es obligatorio');
      return;
    }
    if (trimmed && isInvoiceMode && !/^\d+$/.test(trimmed)) {
      setCommentError('El número de factura debe ser solo dígitos');
      toast.error('El número de factura debe ser solo dígitos');
      return;
    }
    setCommentError('');
    onConfirm(comment, purchaseAmountFromParent);
    // Reset comment after successful confirm
    setComment('');
  };
  
  const handleClose = () => {
    setComment('');
    setCommentError('');
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="confirmation-modal">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-heading text-lg sm:text-xl">Confirmar {formatActionTitle(title)}</h3>
          <button onClick={handleClose} className="p-1 hover:bg-zinc-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Card Type Header */}
        <div className="bg-[#5B7CF7] text-white rounded-lg p-3 sm:p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">Tipo de Tarjeta</p>
          <p className="font-medium text-sm sm:text-base">{config?.name || 'Tarjeta'}</p>
        </div>

        {/* Simplified Transaction Details - Only essential info */}
        <div className="space-y-2 sm:space-y-3 mb-4">
          {details.map((detail, idx) => (
            <div key={idx} className="flex justify-between text-xs sm:text-sm border-b border-zinc-100 pb-2">
              <span className="text-zinc-500">{detail.label}</span>
              <span className="font-medium text-right">{detail.value}</span>
            </div>
          ))}
        </div>

        {warning && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4" data-testid="high-amount-warning">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">{warning}</p>
          </div>
        )}

        {/* Comment - conditionally mandatory, format depends on the card type's configured mode */}
        <div className="mb-4 sm:mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
            {isInvoiceMode ? 'Número de factura' : 'Comentario'} {requireComments && <span className="text-red-500">*</span>}
          </label>
          <Input
            value={comment}
            inputMode={isInvoiceMode ? 'numeric' : 'text'}
            onChange={(e) => {
              const value = isInvoiceMode ? e.target.value.replace(/\D/g, '') : e.target.value;
              setComment(value);
              if (value.trim()) setCommentError('');
            }}
            placeholder={isInvoiceMode ? '# de factura' : (requireComments ? "Nota interna obligatoria..." : "Nota interna (opcional)...")}
            className={`input-brutalist text-sm ${commentError ? 'border-red-500 focus:ring-red-500' : ''}`}
            data-testid="confirmation-comment"
          />
          {commentError && (
            <p className="text-xs text-red-500 mt-1">* {commentError}</p>
          )}
        </div>
        
        <div className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 h-10 sm:h-12 btn-secondary text-sm"
            disabled={loading}
            data-testid="cancel-action"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 h-10 sm:h-12 btn-primary text-sm"
            data-testid="confirm-action"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
