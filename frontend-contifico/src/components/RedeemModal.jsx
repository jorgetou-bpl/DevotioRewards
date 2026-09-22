import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, X } from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';
import { formatCurrency } from '../lib/currency';

// Cashback redemption uses `subtract-point`, not `redeem-points` — confirmed
// against backend/routes/cards.py:479 ("Subtract points from
// certificate/gift/cashback cards", reads/writes balance.balance) and against
// how the existing Scanner App itself maps the cashback card type's
// "Canjear" action (frontend/src/config/cardTypes.js: cashback.actions.canjear
// -> endpoint 'subtract-point'). `redeem-points` operates on a different
// field (bonusBalance) used by other card types, not cashback.
export const RedeemModal = ({ cardId, onClose, onRedeemed }) => {
  const [card, setCard] = useState(null);
  const [loadingCard, setLoadingCard] = useState(true);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCard = async () => {
      try {
        const response = await axios.get(`${API}/cards/${cardId}`);
        if (!cancelled) setCard(response.data.card || response.data);
      } catch (error) {
        toast.error('No se pudo cargar la tarjeta');
        onClose();
      } finally {
        if (!cancelled) setLoadingCard(false);
      }
    };
    fetchCard();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const balance = card?.balance?.balance || 0;
  const amountValue = parseFloat(amount) || 0;
  const invalid = !amount || amountValue <= 0 || amountValue > balance;

  const handleRedeem = async () => {
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/cards/${cardId}/subtract-point`, {
        amount: amountValue,
        comment: 'Canje desde portal Contífico',
      });
      toast.success('Cashback canjeado exitosamente');
      onRedeemed?.(response.data.card);
      onClose();
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al canjear';
      toast.error(typeof message === 'string' ? message : 'Error al canjear');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="redeem-modal">
      <div className="card-brutalist bg-white w-full max-w-sm p-4 sm:p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600"
          aria-label="Cerrar"
          data-testid="redeem-modal-close"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg sm:text-xl text-heading mb-4">Canjear cashback</h3>

        {loadingCard ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="text-center p-4 bg-zinc-50 rounded-xl mb-4">
              <span className="text-3xl sm:text-4xl font-mono font-bold gradient-text">
                {formatCurrency(balance)}
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">Cashback disponible</p>
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="redeem-amount">Monto a canjear</Label>
              <Input
                id="redeem-amount"
                type="number"
                min="0"
                max={balance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                data-testid="redeem-amount-input"
              />
              {amountValue > balance && (
                <p className="text-xs text-red-500">El monto excede el cashback disponible</p>
              )}
            </div>

            <Button
              onClick={handleRedeem}
              disabled={invalid || submitting}
              className="w-full btn-primary"
              data-testid="confirm-redeem-button"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar canje'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
