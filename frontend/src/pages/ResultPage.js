import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  AlertCircle,
  Star,
  CreditCard,
  Percent,
  Ticket,
  Wallet,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Card type configurations
const CARD_TYPE_CONFIG = {
  stamp_card: {
    name: 'Stamp Card',
    icon: Stamp,
    color: '#00FF94',
    tabs: ['Add', 'Redeem'],
    actions: {
      add: { label: 'Add Stamps', endpoint: 'add-stamp' },
      redeem: { label: 'Redeem Reward', endpoint: 'redeem-reward' }
    }
  },
  cashback_card: {
    name: 'Cashback Card',
    icon: Wallet,
    color: '#0099FF',
    tabs: ['Add', 'Redeem'],
    requiresPurchaseAmount: true,
    actions: {
      add: { label: 'Add Points', endpoint: 'add-point', amountLabel: 'Enter purchase amount' },
      redeem: { label: 'Redeem Points', endpoint: 'redeem-points' }
    }
  },
  discount_card: {
    name: 'Discount Card',
    icon: Percent,
    color: '#FF6B35',
    tabs: ['Add'],
    requiresPurchaseAmount: true,
    actions: {
      add: { label: 'Add Points', endpoint: 'add-point', amountLabel: 'Fill in the purchase amount' }
    }
  },
  gift_card: {
    name: 'Gift Card',
    icon: Gift,
    color: '#9333EA',
    tabs: ['Add', 'Redeem'],
    actions: {
      add: { label: 'Add Points', endpoint: 'add-point' },
      redeem: { label: 'Redeem Points', endpoint: 'redeem-points' }
    }
  },
  coupon: {
    name: 'Coupon',
    icon: Ticket,
    color: '#EC4899',
    tabs: ['Use'],
    singleUse: true,
    actions: {
      use: { label: 'Use Coupon', endpoint: 'use-coupon' }
    }
  },
  multipass: {
    name: 'Multipass',
    icon: CreditCard,
    color: '#14B8A6',
    tabs: ['Add', 'Redeem', 'Points'],
    actions: {
      add: { label: 'Add Visits', endpoint: 'add-visit' },
      redeem: { label: 'Redeem Visits', endpoint: 'redeem-visit' },
      points: { label: 'Redeem Points', endpoint: 'redeem-points' }
    }
  },
  points_card: {
    name: 'Points Card',
    icon: Star,
    color: '#F59E0B',
    tabs: ['Add', 'Redeem'],
    actions: {
      add: { label: 'Add Points', endpoint: 'add-point' },
      redeem: { label: 'Redeem Reward', endpoint: 'redeem-reward' }
    }
  },
  vip_card: {
    name: 'VIP Card',
    icon: Star,
    color: '#FFD700',
    tabs: ['Add', 'Redeem'],
    actions: {
      add: { label: 'Add Points', endpoint: 'add-point' },
      redeem: { label: 'Redeem Reward', endpoint: 'redeem-reward' }
    }
  }
};

// Stamp visual component
const StampGrid = ({ current, total }) => {
  const stamps = [];
  for (let i = 0; i < total; i++) {
    stamps.push(
      <div
        key={i}
        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
          i < current
            ? 'bg-black border-black'
            : 'bg-white border-zinc-300'
        }`}
      >
        <Star
          className={`h-5 w-5 ${i < current ? 'text-white fill-white' : 'text-zinc-300'}`}
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-3 justify-items-center" data-testid="stamp-grid">
      {stamps}
    </div>
  );
};

// Confirmation Modal
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, details, loading }) => {
  const [comment, setComment] = useState('');
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="confirmation-modal">
      <div className="bg-white rounded-sm border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-heading text-xl">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-sm">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-3 mb-6">
          {details.map((detail, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-zinc-500">{detail.label}</span>
              <span className="font-medium">{detail.value}</span>
            </div>
          ))}
        </div>
        
        <div className="mb-6">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2">
            Comment (optional)
          </label>
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Internal note..."
            className="input-brutalist text-sm"
            data-testid="confirmation-comment"
          />
          <p className="text-xs text-zinc-400 mt-1">This won't be visible to the customer</p>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 btn-secondary"
            disabled={loading}
            data-testid="cancel-action"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(comment)}
            disabled={loading}
            className="flex-1 btn-primary"
            data-testid="confirm-action"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Success Modal
const SuccessModal = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="success-modal">
      <div className="bg-white rounded-sm border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full p-6 text-center">
        <div className="w-16 h-16 bg-[#00FF94] rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-black" />
        </div>
        <h3 className="text-heading text-xl mb-2">Successful Transaction</h3>
        <p className="text-zinc-500 mb-6">{message}</p>
        <Button onClick={onClose} className="btn-primary w-full" data-testid="done-button">
          Done
        </Button>
      </div>
    </div>
  );
};

const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { triggerVibration, triggerBeep, copyToClipboard } = useSettings();
  
  const [card, setCard] = useState(location.state?.card || null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Add');
  const [actionAmount, setActionAmount] = useState(1);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showCardInfo, setShowCardInfo] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, details: [] });
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });

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

  const cardType = card.type || 'stamp_card';
  const config = CARD_TYPE_CONFIG[cardType] || CARD_TYPE_CONFIG.stamp_card;
  const balance = card.balance || {};
  const CardIcon = config.icon;

  const openConfirmation = (action) => {
    const details = [];
    
    if (action === 'add' && config.requiresPurchaseAmount) {
      details.push({ label: 'Purchase Amount', value: `$${purchaseAmount || '0'}` });
    } else if (action === 'add' || action === 'redeem') {
      details.push({ label: 'Quantity', value: actionAmount });
    }
    
    if (action === 'use') {
      details.push({ label: 'Coupon Status', value: 'Active' });
    }
    
    setConfirmModal({ open: true, action, details });
  };

  const handleAction = async (comment = '') => {
    const action = confirmModal.action;
    setLoading(true);
    setConfirmModal({ open: false, action: null, details: [] });
    
    try {
      const actionConfig = config.actions[action.toLowerCase()];
      if (!actionConfig) {
        throw new Error('Unknown action');
      }

      const endpoint = `/cards/${card.id}/${actionConfig.endpoint}`;
      const payload = {
        amount: actionAmount,
        comment: comment || undefined,
        purchaseSum: config.requiresPurchaseAmount ? parseFloat(purchaseAmount) || 0 : undefined
      };

      const response = await axios.post(`${API}${endpoint}`, payload);
      
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
      
      setSuccessModal({ open: true, message: response.data.message || 'Transaction completed successfully!' });
      
      // Reset inputs
      setActionAmount(1);
      setPurchaseAmount('');
    } catch (error) {
      const message = error.response?.data?.detail || 'Action failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = async () => {
    const success = await copyToClipboard(card.id);
    if (success) {
      toast.success('Card ID copied!');
    }
  };

  const renderActionTab = () => {
    const tabLower = activeTab.toLowerCase();
    const actionConfig = config.actions[tabLower];
    
    if (!actionConfig) return null;

    // For stamp cards, show stamp grid
    if (cardType === 'stamp_card' && activeTab === 'Add') {
      return (
        <div className="space-y-6">
          <StampGrid 
            current={balance.currentNumberOfUses || 0} 
            total={balance.numberStampsTotal || 10} 
          />
          
          <div className="text-center">
            <p className="text-sm text-zinc-500">
              {balance.stampsBeforeReward || 0} stamps until next reward
            </p>
          </div>
          
          {/* Stamp counter */}
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
              className="h-14 w-14 border-2 border-black rounded-sm"
              data-testid="decrease-amount"
            >
              <Minus className="h-6 w-6" />
            </Button>
            <div className="text-center">
              <span className="text-5xl font-mono font-bold" data-testid="action-amount">
                {actionAmount}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(actionAmount + 1)}
              className="h-14 w-14 border-2 border-black rounded-sm"
              data-testid="increase-amount"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          
          <Button
            onClick={() => openConfirmation('Add')}
            disabled={loading}
            className="w-full btn-primary h-14 text-lg"
            data-testid="add-stamp-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // For discount/cashback cards with purchase amount
    if (config.requiresPurchaseAmount && activeTab === 'Add') {
      return (
        <div className="space-y-6">
          {/* Discount/Cashback level display */}
          {balance.discountLevel && (
            <div className="text-center">
              <span className="text-6xl font-mono font-bold" style={{ color: config.color }}>
                {balance.discountLevel}
              </span>
              <p className="text-sm text-zinc-500 mt-1">Discount level</p>
            </div>
          )}
          
          {balance.cashbackPercent && (
            <div className="text-center">
              <span className="text-6xl font-mono font-bold" style={{ color: config.color }}>
                {balance.cashbackPercent}%
              </span>
              <p className="text-sm text-zinc-500 mt-1">Cashback rate</p>
            </div>
          )}
          
          {/* Purchase amount input */}
          <div className="card-brutalist">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2">
              {actionConfig.amountLabel || 'Enter purchase amount'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-xl">$</span>
              <Input
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="0.00"
                className="input-brutalist pl-10 text-3xl font-mono h-16 text-center"
                data-testid="purchase-amount-input"
              />
            </div>
          </div>
          
          <Button
            onClick={() => openConfirmation('Add')}
            disabled={loading || !purchaseAmount}
            className="w-full btn-primary h-14 text-lg"
            data-testid="add-points-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // For redeem/points tabs
    if (activeTab === 'Redeem' || activeTab === 'Points') {
      const availableAmount = activeTab === 'Redeem' 
        ? (balance.numberRewardsUnused || balance.bonusBalance || balance.visitsAvailable || 0)
        : (balance.bonusBalance || 0);
      
      return (
        <div className="space-y-6">
          {/* Available balance display */}
          <div className="text-center p-6 bg-zinc-50 rounded-sm">
            <span className="text-5xl font-mono font-bold" style={{ color: config.color }}>
              {availableAmount}
            </span>
            <p className="text-sm text-zinc-500 mt-2">
              {activeTab === 'Points' ? 'Points available' : 
               balance.numberRewardsUnused ? 'Rewards available' : 
               balance.visitsAvailable ? 'Visits available' : 'Points available'}
            </p>
          </div>
          
          {/* Amount selector */}
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
              className="h-14 w-14 border-2 border-black rounded-sm"
              data-testid="decrease-redeem"
            >
              <Minus className="h-6 w-6" />
            </Button>
            <div className="text-center">
              <span className="text-5xl font-mono font-bold" data-testid="redeem-amount">
                {actionAmount}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(Math.min(availableAmount, actionAmount + 1))}
              className="h-14 w-14 border-2 border-black rounded-sm"
              disabled={actionAmount >= availableAmount}
              data-testid="increase-redeem"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          
          <Button
            onClick={() => openConfirmation(activeTab)}
            disabled={loading || availableAmount === 0 || actionAmount > availableAmount}
            className="w-full h-14 text-lg"
            style={{ backgroundColor: config.color, color: '#000' }}
            data-testid="redeem-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // For coupon use
    if (activeTab === 'Use') {
      return (
        <div className="space-y-6">
          <div className="text-center p-6 bg-zinc-50 rounded-sm">
            <div className="status-badge success mx-auto mb-4">
              <Check className="h-4 w-4" />
              <span>Active</span>
            </div>
            <p className="text-sm text-zinc-500">This coupon is ready to use</p>
          </div>
          
          <Button
            onClick={() => openConfirmation('Use')}
            disabled={loading}
            className="w-full h-14 text-lg"
            style={{ backgroundColor: config.color, color: '#fff' }}
            data-testid="use-coupon-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // Default: simple counter with action
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
            className="h-14 w-14 border-2 border-black rounded-sm"
          >
            <Minus className="h-6 w-6" />
          </Button>
          <span className="text-5xl font-mono font-bold">{actionAmount}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setActionAmount(actionAmount + 1)}
            className="h-14 w-14 border-2 border-black rounded-sm"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
        
        <Button
          onClick={() => openConfirmation(activeTab)}
          disabled={loading}
          className="w-full btn-primary h-14 text-lg"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
        </Button>
      </div>
    );
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
        <h1 className="logo-text text-xl">Devotio Rewards</h1>
        <div className="w-20" />
      </header>

      <main className="max-w-md mx-auto p-6 pb-24">
        {/* Customer Name (masked) */}
        <div className="text-center mb-6">
          <p className="text-sm text-zinc-500">Customer:</p>
          <h2 className="text-heading text-2xl masked-data" data-testid="customer-display-name">
            {card.customer?.firstName || '***'} {card.customer?.surname || '***'}
          </h2>
        </div>

        {/* Card Type Badge */}
        <div className="flex justify-center mb-6">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-sm"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            <CardIcon className="h-5 w-5" />
            <span className="font-bold text-sm uppercase tracking-wider">{config.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-2 border-black rounded-sm mb-6 overflow-hidden">
          {config.tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setActionAmount(1);
              }}
              className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-zinc-100'
              }`}
              data-testid={`tab-${tab.toLowerCase()}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Action Content */}
        <div className="mb-6">
          {renderActionTab()}
        </div>

        {/* Customer Information (Collapsible, Masked) */}
        <div className="border-2 border-zinc-200 rounded-sm mb-4">
          <button
            onClick={() => setShowCustomerInfo(!showCustomerInfo)}
            className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
            data-testid="toggle-customer-info"
          >
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-zinc-500" />
              <span className="font-bold text-sm uppercase tracking-wider">Customer information</span>
            </div>
            {showCustomerInfo ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          
          {showCustomerInfo && (
            <div className="border-t border-zinc-200 divide-y divide-zinc-100">
              <div className="flex justify-between p-4">
                <span className="text-zinc-500">First name</span>
                <span className="masked-data">{card.customer?.firstName || '***'}</span>
              </div>
              <div className="flex justify-between p-4">
                <span className="text-zinc-500">Last name</span>
                <span className="masked-data">{card.customer?.surname || '***'}</span>
              </div>
              <div className="flex justify-between p-4">
                <span className="text-zinc-500">Phone</span>
                <span className="masked-data">{card.customer?.phone || '***-***-****'}</span>
              </div>
              <div className="flex justify-between p-4">
                <span className="text-zinc-500">Email</span>
                <span className="masked-data">{card.customer?.email || '***@***.***'}</span>
              </div>
              <div className="flex justify-between p-4">
                <span className="text-zinc-500">Customer ID</span>
                <span className="text-mono text-sm">{card.customer?.id || card.customerId || '-'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card Information (Collapsible) */}
        <div className="border-2 border-zinc-200 rounded-sm mb-6">
          <button
            onClick={() => setShowCardInfo(!showCardInfo)}
            className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
            data-testid="toggle-card-info"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-zinc-500" />
              <span className="font-bold text-sm uppercase tracking-wider">Card information</span>
            </div>
            {showCardInfo ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          
          {showCardInfo && (
            <div className="border-t border-zinc-200 divide-y divide-zinc-100">
              {/* Dynamic fields based on card type */}
              {balance.currentNumberOfUses !== undefined && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Active stamps</span>
                  <span className="font-medium">{balance.currentNumberOfUses}/{balance.numberStampsTotal || 10}</span>
                </div>
              )}
              {balance.numberRewardsUnused !== undefined && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Available rewards</span>
                  <span className="font-medium">{balance.numberRewardsUnused}</span>
                </div>
              )}
              {balance.bonusBalance !== undefined && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Points balance</span>
                  <span className="font-medium">{balance.bonusBalance}</span>
                </div>
              )}
              {balance.balance !== undefined && balance.balance > 0 && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Total balance</span>
                  <span className="font-medium">${balance.balance.toFixed(2)}</span>
                </div>
              )}
              {balance.discountLevel && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Discount level</span>
                  <span className="font-medium">{balance.discountLevel}%</span>
                </div>
              )}
              {balance.discountStatus && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Discount status</span>
                  <span className="font-medium">{balance.discountStatus}</span>
                </div>
              )}
              {balance.totalSavings !== undefined && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Total savings</span>
                  <span className="font-medium">${balance.totalSavings.toFixed(2)}</span>
                </div>
              )}
              {card.countVisits !== undefined && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Total visits</span>
                  <span className="font-medium">{card.countVisits}</span>
                </div>
              )}
              {card.totalRewardsRedeemed !== undefined && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Rewards redeemed</span>
                  <span className="font-medium">{card.totalRewardsRedeemed}</span>
                </div>
              )}
              <div className="flex justify-between p-4">
                <span className="text-zinc-500">Card ID</span>
                <div className="flex items-center gap-2">
                  <span className="text-mono text-sm">{card.id}</span>
                  <button onClick={handleCopyId} className="p-1 hover:bg-zinc-100 rounded">
                    <Copy className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
              </div>
              {card.serialNumber && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Serial number</span>
                  <span className="text-mono text-sm">{card.serialNumber}</span>
                </div>
              )}
              {card.installDate && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Card installation date</span>
                  <span className="font-medium">{card.installDate}</span>
                </div>
              )}
              {card.lastAccrual && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Last accrual</span>
                  <span className="font-medium">{card.lastAccrual}</span>
                </div>
              )}
              {card.expirationDate && (
                <div className="flex justify-between p-4">
                  <span className="text-zinc-500">Card expiration date</span>
                  <span className="font-medium">{card.expirationDate}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scan Another */}
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="w-full btn-secondary"
          data-testid="scan-another-button"
        >
          Scan Another Card
        </Button>
      </main>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, action: null, details: [] })}
        onConfirm={handleAction}
        title={`Confirm ${confirmModal.action}`}
        details={confirmModal.details}
        loading={loading}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModal.open}
        onClose={() => setSuccessModal({ open: false, message: '' })}
        message={successModal.message}
      />
    </div>
  );
};

export default ResultPage;
