import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  ArrowLeft,
  Stamp,
  Gift,
  Plus,
  Minus,
  Check,
  Copy,
  Loader2,
  AlertCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { triggerVibration, triggerBeep, copyToClipboard } = useSettings();
  
  const [card, setCard] = useState(location.state?.card || null);
  const [loading, setLoading] = useState(null); // Tracks which action is loading
  const [actionAmount, setActionAmount] = useState(1);

  if (!card) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
          <h2 className="text-heading text-2xl mb-2">No Card Data</h2>
          <p className="text-zinc-500 mb-6">Please scan a card first</p>
          <Button onClick={() => navigate('/')} className="btn-primary" data-testid="back-to-scanner">
            Back to Scanner
          </Button>
        </div>
      </div>
    );
  }

  const balance = card.balance || {};

  const handleAction = async (actionType) => {
    setLoading(actionType);
    
    try {
      let endpoint = '';
      switch (actionType) {
        case 'stamp':
          endpoint = `/cards/${card.id}/add-stamp`;
          break;
        case 'point':
          endpoint = `/cards/${card.id}/add-point`;
          break;
        case 'reward':
          endpoint = `/cards/${card.id}/redeem-reward`;
          break;
        default:
          throw new Error('Unknown action');
      }

      const response = await axios.post(`${API}${endpoint}`, { amount: actionAmount });
      
      triggerVibration();
      triggerBeep();
      
      // Update card state with new data
      if (response.data.card) {
        setCard(prevCard => ({
          ...prevCard,
          ...response.data.card,
          balance: { ...prevCard.balance, ...response.data.card.balance }
        }));
      }
      
      toast.success(response.data.message || 'Action completed!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Action failed';
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const handleCopyId = async () => {
    const success = await copyToClipboard(card.id);
    if (success) {
      toast.success('Card ID copied!');
    }
  };

  return (
    <div className="min-h-screen bg-white" data-testid="result-page">
      {/* Header */}
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-sm transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="logo-text text-xl">Boomerang</h1>
        <div className="w-20" /> {/* Spacer for centering */}
      </header>

      <main className="max-w-md mx-auto p-6">
        {/* Status Badge */}
        <div className="flex justify-center mb-6">
          <div className="status-badge success" data-testid="status-badge">
            <Check className="h-4 w-4" />
            <span>Scan Successful</span>
          </div>
        </div>

        {/* Card Info */}
        <div className="card-brutalist mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">Card ID</span>
            <button
              onClick={handleCopyId}
              className="p-2 hover:bg-zinc-100 rounded-sm transition-colors"
              data-testid="copy-id-button"
              aria-label="Copy card ID"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="text-mono text-lg font-medium" data-testid="card-id">{card.id}</p>
          
          {/* Customer Info (Masked) */}
          <div className="mt-4 pt-4 border-t border-zinc-200">
            <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">Customer</span>
            <div className="mt-2 space-y-1">
              <p className="masked-data" data-testid="customer-name">
                Name: {card.customer?.firstName || '***'} {card.customer?.surname || '***'}
              </p>
              <p className="masked-data" data-testid="customer-email">
                Email: {card.customer?.email || '***@***.***'}
              </p>
              <p className="masked-data" data-testid="customer-phone">
                Phone: {card.customer?.phone || '***-***-****'}
              </p>
              {card.customer?.id && (
                <p className="text-mono text-sm text-zinc-600" data-testid="customer-id">
                  ID: {card.customer.id}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Balance Display */}
        <div className="card-brutalist mb-6">
          <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">Balance</span>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Stamps */}
            {(balance.numberStampsTotal > 0 || balance.currentNumberOfUses > 0) && (
              <div className="text-center p-4 bg-zinc-50 rounded-sm" data-testid="stamps-balance">
                <Stamp className="h-6 w-6 mx-auto mb-2" />
                <p className="balance-display">
                  {balance.currentNumberOfUses || 0}
                  <span className="text-xl text-zinc-400">/{balance.numberStampsTotal || 10}</span>
                </p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Stamps</p>
              </div>
            )}

            {/* Points/Balance */}
            {(balance.balance > 0 || balance.bonusBalance > 0) && (
              <div className="text-center p-4 bg-zinc-50 rounded-sm" data-testid="points-balance">
                <Plus className="h-6 w-6 mx-auto mb-2" />
                <p className="balance-display">
                  {balance.bonusBalance || balance.balance || 0}
                </p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Points</p>
              </div>
            )}

            {/* Rewards */}
            {balance.numberRewardsUnused > 0 && (
              <div className="text-center p-4 bg-[#00FF94]/20 rounded-sm col-span-2" data-testid="rewards-balance">
                <Gift className="h-6 w-6 mx-auto mb-2 text-black" />
                <p className="balance-display text-black">
                  {balance.numberRewardsUnused}
                </p>
                <p className="text-xs text-zinc-700 uppercase tracking-wider mt-1">Rewards Available</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 pt-4 border-t border-zinc-200 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" data-testid="total-visits">{card.countVisits || 0}</p>
              <p className="text-xs text-zinc-500 uppercase">Visits</p>
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="total-rewards">{card.totalRewardsRedeemed || 0}</p>
              <p className="text-xs text-zinc-500 uppercase">Rewards Used</p>
            </div>
          </div>
        </div>

        {/* Amount Selector */}
        <div className="card-brutalist mb-6">
          <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">Action Amount</span>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
              className="h-12 w-12 border-2 border-black rounded-sm"
              data-testid="decrease-amount"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <span className="text-3xl font-mono font-bold w-16 text-center" data-testid="action-amount">
              {actionAmount}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(actionAmount + 1)}
              className="h-12 w-12 border-2 border-black rounded-sm"
              data-testid="increase-amount"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-grid">
          <Button
            onClick={() => handleAction('stamp')}
            disabled={loading !== null}
            className="btn-primary flex items-center justify-center gap-2"
            data-testid="add-stamp-button"
          >
            {loading === 'stamp' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Stamp className="h-5 w-5" />
                Add Stamp
              </>
            )}
          </Button>

          <Button
            onClick={() => handleAction('point')}
            disabled={loading !== null}
            className="btn-primary flex items-center justify-center gap-2"
            data-testid="add-points-button"
          >
            {loading === 'point' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Add Points
              </>
            )}
          </Button>

          {balance.numberRewardsUnused > 0 && (
            <Button
              onClick={() => handleAction('reward')}
              disabled={loading !== null}
              className="col-span-2 btn-secondary flex items-center justify-center gap-2 bg-[#00FF94] hover:bg-[#00DD80] border-black text-black"
              data-testid="redeem-reward-button"
            >
              {loading === 'reward' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Gift className="h-5 w-5" />
                  Redeem Reward
                </>
              )}
            </Button>
          )}
        </div>

        {/* Scan Another */}
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="w-full mt-6 btn-secondary"
          data-testid="scan-another-button"
        >
          Scan Another Card
        </Button>
      </main>
    </div>
  );
};

export default ResultPage;
