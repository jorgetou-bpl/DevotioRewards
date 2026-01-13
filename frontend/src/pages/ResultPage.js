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
  X,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Card type configurations - Spanish
const CARD_TYPE_CONFIG = {
  stamp_card: {
    name: 'Tarjeta de Sellos',
    icon: Stamp,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Sellos', endpoint: 'add-stamp' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'redeem-reward' }
    }
  },
  cashback_card: {
    name: 'Tarjeta Cashback',
    icon: Wallet,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' },
      canjear: { label: 'Canjear Puntos', endpoint: 'redeem-points' }
    }
  },
  discount_card: {
    name: 'Tarjeta de Descuento',
    icon: Percent,
    color: '#F040A0',
    tabs: ['Agregar'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' }
    }
  },
  gift_card: {
    name: 'Tarjeta de Regalo',
    icon: Gift,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point' },
      canjear: { label: 'Canjear Puntos', endpoint: 'redeem-points' }
    }
  },
  coupon: {
    name: 'Cupón',
    icon: Ticket,
    color: '#F040A0',
    tabs: ['Usar'],
    singleUse: true,
    actions: {
      usar: { label: 'Usar Cupón', endpoint: 'use-coupon' }
    }
  },
  multipass: {
    name: 'Multipase',
    icon: CreditCard,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear', 'Puntos'],
    actions: {
      agregar: { label: 'Agregar Visitas', endpoint: 'add-visit' },
      canjear: { label: 'Canjear Visitas', endpoint: 'redeem-visit' },
      puntos: { label: 'Canjear Puntos', endpoint: 'redeem-points' }
    }
  },
  points_card: {
    name: 'Tarjeta de Puntos',
    icon: Star,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'redeem-reward' }
    }
  },
  vip_card: {
    name: 'Tarjeta VIP',
    icon: Star,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'redeem-reward' }
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
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all ${
          i < current
            ? 'bg-gradient-to-br from-[#F040A0] to-[#8A2BE2] border-transparent'
            : 'bg-white border-zinc-300'
        }`}
      >
        <Star
          className={`h-4 w-4 sm:h-5 sm:w-5 ${i < current ? 'text-white fill-white' : 'text-zinc-300'}`}
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3 justify-items-center" data-testid="stamp-grid">
      {stamps}
    </div>
  );
};

// Confirmation Modal with detailed info
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, actionType, details, card, config, loading, purchaseAmountFromParent, formatCurrency }) => {
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState(false);
  
  if (!isOpen) return null;

  const handleConfirm = () => {
    // Validate comment is required
    if (!comment.trim()) {
      setCommentError(true);
      toast.error('El comentario es obligatorio');
      return;
    }
    setCommentError(false);
    onConfirm(comment, purchaseAmountFromParent);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="confirmation-modal">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-heading text-lg sm:text-xl">Confirmar {title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Customer ID */}
        <div className="bg-[#120627] text-white rounded-lg p-3 sm:p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">ID de Cliente</p>
          <p className="text-mono font-medium text-sm sm:text-base break-all">{card?.customer?.id || card?.customerId || '-'}</p>
        </div>

        {/* Transaction Details - Read Only */}
        <div className="space-y-2 sm:space-y-3 mb-4">
          {details.map((detail, idx) => (
            <div key={idx} className="flex justify-between text-xs sm:text-sm border-b border-zinc-100 pb-2">
              <span className="text-zinc-500">{detail.label}</span>
              <span className="font-medium text-right">{detail.value}</span>
            </div>
          ))}
        </div>
        
        {/* Comment - MANDATORY */}
        <div className="mb-4 sm:mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
            Comentario <span className="text-red-500">*</span>
          </label>
          <Input
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (e.target.value.trim()) setCommentError(false);
            }}
            placeholder="Nota interna obligatoria..."
            className={`input-brutalist text-sm ${commentError ? 'border-red-500 focus:ring-red-500' : ''}`}
            data-testid="confirmation-comment"
          />
          <p className="text-xs text-zinc-400 mt-1">Este comentario no será visible para el cliente</p>
          {commentError && (
            <p className="text-xs text-red-500 mt-1">* Campo obligatorio</p>
          )}
        </div>
        
        <div className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={onClose}
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

// Success Modal
const SuccessModal = ({ isOpen, onClose, message, details }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="success-modal">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 sm:p-6 text-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#00C853] to-[#00E676] rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
        </div>
        <h3 className="text-heading text-lg sm:text-xl mb-2">Transacción Exitosa</h3>
        <p className="text-zinc-500 text-sm mb-4">{message}</p>
        
        {details && details.length > 0 && (
          <div className="bg-zinc-50 rounded-lg p-3 sm:p-4 mb-4 text-left">
            {details.map((detail, idx) => (
              <div key={idx} className="flex justify-between text-xs sm:text-sm py-1">
                <span className="text-zinc-500">{detail.label}</span>
                <span className="font-medium">{detail.value}</span>
              </div>
            ))}
          </div>
        )}
        
        <Button 
          onClick={onClose} 
          className="w-full h-10 sm:h-12 btn-primary" 
          data-testid="done-button"
        >
          Listo
        </Button>
      </div>
    </div>
  );
};

const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { triggerVibration, triggerBeep, copyToClipboard, formatCurrency, getCurrencyInfo } = useSettings();
  
  const [card, setCard] = useState(location.state?.card || null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Agregar');
  const [actionAmount, setActionAmount] = useState(1);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showCardInfo, setShowCardInfo] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, details: [], purchaseAmount: '' });
  const [successModal, setSuccessModal] = useState({ open: false, message: '', details: [] });

  const currencyInfo = getCurrencyInfo();

  if (!card) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-zinc-300" />
          <h2 className="text-heading text-xl sm:text-2xl mb-2">Sin Datos de Tarjeta</h2>
          <p className="text-zinc-500 text-sm mb-6">Por favor escanea una tarjeta primero</p>
          <Button 
            onClick={() => navigate('/')} 
            className="h-10 sm:h-12 btn-primary px-6 sm:px-8" 
            data-testid="back-to-scanner"
          >
            Volver al Escáner
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
    const actionLower = action.toLowerCase();
    
    details.push({ label: 'ID de Tarjeta', value: card.id });
    details.push({ label: 'Tipo de Tarjeta', value: config.name });
    
    if (actionLower === 'agregar' && config.requiresPurchaseAmount) {
      details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
    } else if (actionLower === 'agregar') {
      details.push({ label: 'Cantidad', value: actionAmount });
    } else if (actionLower === 'canjear') {
      details.push({ label: 'Cantidad a Canjear', value: actionAmount });
    }
    
    if (actionLower === 'usar') {
      details.push({ label: 'Estado del Cupón', value: 'Activo' });
    }
    
    setConfirmModal({ 
      open: true, 
      action, 
      details,
      purchaseAmount: config.requiresPurchaseAmount ? purchaseAmount : ''
    });
  };

  const handleAction = async (comment = '', confirmPurchaseAmount = '') => {
    const action = confirmModal.action;
    setLoading(true);
    
    try {
      const actionKey = action.toLowerCase();
      const actionConfig = config.actions[actionKey];
      if (!actionConfig) {
        throw new Error('Acción desconocida');
      }

      const endpoint = `/cards/${card.id}/${actionConfig.endpoint}`;
      const payload = {
        amount: actionAmount,
        comment: comment || undefined,
        purchaseSum: confirmPurchaseAmount ? parseFloat(confirmPurchaseAmount) : 
                     (config.requiresPurchaseAmount ? parseFloat(purchaseAmount) || 0 : undefined)
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
      
      // Build success details
      const successDetails = [
        { label: 'ID de Cliente', value: card.customer?.id || card.customerId || '-' },
        { label: 'ID de Tarjeta', value: card.id }
      ];
      
      if (confirmPurchaseAmount) {
        successDetails.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(confirmPurchaseAmount)) });
      }
      
      setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' });
      setSuccessModal({ 
        open: true, 
        message: response.data.message || '¡Transacción completada exitosamente!',
        details: successDetails
      });
      
      // Reset inputs
      setActionAmount(1);
      setPurchaseAmount('');
    } catch (error) {
      const message = error.response?.data?.detail || 'La acción falló';
      toast.error(message);
      setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = async () => {
    const success = await copyToClipboard(card.id);
    if (success) {
      toast.success('¡ID de tarjeta copiado!');
    }
  };

  const renderActionTab = () => {
    const tabLower = activeTab.toLowerCase();
    const actionConfig = config.actions[tabLower];
    
    if (!actionConfig) return null;

    // For stamp cards, show stamp grid
    if (cardType === 'stamp_card' && activeTab === 'Agregar') {
      return (
        <div className="space-y-4 sm:space-y-6">
          <StampGrid 
            current={balance.currentNumberOfUses || 0} 
            total={balance.numberStampsTotal || 10} 
          />
          
          <div className="text-center">
            <p className="text-xs sm:text-sm text-zinc-500">
              {balance.stampsBeforeReward || 0} sellos hasta la próxima recompensa
            </p>
          </div>
          
          {/* Stamp counter */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50"
              style={{ borderColor: '#120627', color: '#120627' }}
              data-testid="decrease-amount"
            >
              <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            <div className="text-center">
              <span className="text-4xl sm:text-5xl font-mono font-bold text-[#120627]" data-testid="action-amount">
                {actionAmount}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(actionAmount + 1)}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50"
              style={{ borderColor: '#120627', color: '#120627' }}
              data-testid="increase-amount"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>
          
          <Button
            onClick={() => openConfirmation('Agregar')}
            disabled={loading}
            className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
            data-testid="add-stamp-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // For discount/cashback cards with purchase amount
    if (config.requiresPurchaseAmount && activeTab === 'Agregar') {
      return (
        <div className="space-y-4 sm:space-y-6">
          {/* Discount/Cashback level display */}
          {balance.discountLevel && (
            <div className="text-center">
              <span className="text-5xl sm:text-6xl font-mono font-bold gradient-text">
                {balance.discountLevel}%
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">Nivel de descuento</p>
            </div>
          )}
          
          {balance.cashbackPercent && (
            <div className="text-center">
              <span className="text-5xl sm:text-6xl font-mono font-bold gradient-text">
                {balance.cashbackPercent}%
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">Tasa de cashback</p>
            </div>
          )}
          
          {/* Purchase amount input */}
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              {actionConfig.amountLabel || 'Ingrese monto de compra'} ({currencyInfo.code})
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
              <Input
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="0"
                className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                data-testid="purchase-amount-input"
              />
            </div>
          </div>
          
          <Button
            onClick={() => openConfirmation('Agregar')}
            disabled={loading || !purchaseAmount}
            className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary disabled:opacity-50"
            data-testid="add-points-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // For redeem/points tabs
    if (activeTab === 'Canjear' || activeTab === 'Puntos') {
      const availableAmount = activeTab === 'Canjear' 
        ? (balance.numberRewardsUnused || balance.bonusBalance || balance.visitsAvailable || 0)
        : (balance.bonusBalance || 0);
      
      return (
        <div className="space-y-4 sm:space-y-6">
          {/* Available balance display */}
          <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
            <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
              {availableAmount}
            </span>
            <p className="text-xs sm:text-sm text-zinc-500 mt-2">
              {activeTab === 'Puntos' ? 'Puntos disponibles' : 
               balance.numberRewardsUnused ? 'Recompensas disponibles' : 
               balance.visitsAvailable ? 'Visitas disponibles' : 'Puntos disponibles'}
            </p>
          </div>
          
          {/* Amount selector */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50"
              style={{ borderColor: '#120627', color: '#120627' }}
              data-testid="decrease-redeem"
            >
              <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            <div className="text-center">
              <span className="text-4xl sm:text-5xl font-mono font-bold text-[#120627]" data-testid="redeem-amount">
                {actionAmount}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(Math.min(availableAmount, actionAmount + 1))}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50"
              style={{ borderColor: '#120627', color: '#120627' }}
              disabled={actionAmount >= availableAmount}
              data-testid="increase-redeem"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>
          
          <Button
            onClick={() => openConfirmation(activeTab)}
            disabled={loading || availableAmount === 0 || actionAmount > availableAmount}
            className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary disabled:opacity-50"
            data-testid="redeem-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // For coupon use
    if (activeTab === 'Usar') {
      return (
        <div className="space-y-4 sm:space-y-6">
          <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
            <div className="status-badge success mx-auto mb-4">
              <Check className="h-4 w-4" />
              <span>Activo</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500">Este cupón está listo para usar</p>
          </div>
          
          <Button
            onClick={() => openConfirmation('Usar')}
            disabled={loading}
            className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
            data-testid="use-coupon-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // Default: simple counter with action
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
            className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50"
            style={{ borderColor: '#120627', color: '#120627' }}
          >
            <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
          <span className="text-4xl sm:text-5xl font-mono font-bold text-[#120627]">{actionAmount}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setActionAmount(actionAmount + 1)}
            className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50"
            style={{ borderColor: '#120627', color: '#120627' }}
          >
            <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
        
        <Button
          onClick={() => openConfirmation(activeTab)}
          disabled={loading}
          className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
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
          className="flex items-center gap-1 sm:gap-2 p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5 text-[#120627]" />
          <span className="font-medium text-[#120627] hidden sm:inline">Volver</span>
        </button>
        <img 
          src="/fonts/logo.png" 
          alt="Devotio Rewards" 
          className="h-8 sm:h-10"
        />
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-md mx-auto p-4 sm:p-6 pb-20 sm:pb-24">
        {/* Customer ID - Visible on Top */}
        <div className="customer-id-banner mb-3 sm:mb-4" data-testid="customer-id-banner">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">ID de Cliente</p>
              <p className="text-mono text-sm sm:text-lg font-medium truncate">{card.customer?.id || card.customerId || '-'}</p>
            </div>
            <button
              onClick={handleCopyId}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 ml-2"
              data-testid="copy-customer-id"
              aria-label="Copiar ID"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Customer Name (VISIBLE - not masked) */}
        <div className="text-center mb-3 sm:mb-4">
          <p className="text-xs sm:text-sm text-zinc-500">Cliente:</p>
          <h2 className="text-heading text-xl sm:text-2xl" data-testid="customer-display-name">
            {card.customer?.firstName || 'N/A'} {card.customer?.surname || ''}
          </h2>
        </div>

        {/* Card Type Badge */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <div 
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            <CardIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="font-semibold text-xs sm:text-sm uppercase tracking-wider">{config.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border rounded-xl mb-4 sm:mb-6 overflow-hidden" style={{ borderColor: '#120627' }}>
          {config.tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setActionAmount(1);
              }}
              className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'bg-[#120627] text-white'
                  : 'bg-white text-[#120627] hover:bg-zinc-50'
              }`}
              data-testid={`tab-${tab.toLowerCase()}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Action Content */}
        <div className="mb-4 sm:mb-6">
          {renderActionTab()}
        </div>

        {/* Customer Information (Collapsible - Email/Phone Masked, Name Visible) */}
        <div className="border border-zinc-200 rounded-xl mb-3 sm:mb-4">
          <button
            onClick={() => setShowCustomerInfo(!showCustomerInfo)}
            className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-zinc-50 transition-colors rounded-xl"
            data-testid="toggle-customer-info"
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#120627]" />
              <span className="font-semibold text-xs sm:text-sm uppercase tracking-wider text-[#120627]">Información del cliente</span>
            </div>
            {showCustomerInfo ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
          </button>
          
          {showCustomerInfo && (
            <div className="border-t border-zinc-200 divide-y divide-zinc-100">
              <div className="flex justify-between p-3 sm:p-4">
                <span className="text-zinc-500 text-sm">Nombre</span>
                <span className="font-medium text-sm">{card.customer?.firstName || 'N/A'}</span>
              </div>
              <div className="flex justify-between p-3 sm:p-4">
                <span className="text-zinc-500 text-sm">Apellido</span>
                <span className="font-medium text-sm">{card.customer?.surname || 'N/A'}</span>
              </div>
              <div className="flex justify-between p-3 sm:p-4">
                <span className="text-zinc-500 text-sm">Teléfono</span>
                <span className="masked-data text-sm">{card.customer?.phone || '***-***-****'}</span>
              </div>
              <div className="flex justify-between p-3 sm:p-4">
                <span className="text-zinc-500 text-sm">Correo</span>
                <span className="masked-data text-sm">{card.customer?.email || '***@***.***'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card Information (Collapsible) */}
        <div className="border border-zinc-200 rounded-xl mb-4 sm:mb-6">
          <button
            onClick={() => setShowCardInfo(!showCardInfo)}
            className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-zinc-50 transition-colors rounded-xl"
            data-testid="toggle-card-info"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-[#120627]" />
              <span className="font-semibold text-xs sm:text-sm uppercase tracking-wider text-[#120627]">Información de tarjeta</span>
            </div>
            {showCardInfo ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
          </button>
          
          {showCardInfo && (
            <div className="border-t border-zinc-200 divide-y divide-zinc-100">
              {/* Dynamic fields based on card type */}
              {balance.currentNumberOfUses !== undefined && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Sellos activos</span>
                  <span className="font-medium text-sm">{balance.currentNumberOfUses}/{balance.numberStampsTotal || 10}</span>
                </div>
              )}
              {balance.numberRewardsUnused !== undefined && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Recompensas disponibles</span>
                  <span className="font-medium text-sm">{balance.numberRewardsUnused}</span>
                </div>
              )}
              {balance.bonusBalance !== undefined && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Balance de puntos</span>
                  <span className="font-medium text-sm">{balance.bonusBalance}</span>
                </div>
              )}
              {balance.balance !== undefined && balance.balance > 0 && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Balance total</span>
                  <span className="font-medium text-sm">{formatCurrency(balance.balance)}</span>
                </div>
              )}
              {balance.discountLevel && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Nivel de descuento</span>
                  <span className="font-medium text-sm">{balance.discountLevel}%</span>
                </div>
              )}
              {balance.discountStatus && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Estado de descuento</span>
                  <span className="font-medium text-sm">{balance.discountStatus}</span>
                </div>
              )}
              {balance.totalSavings !== undefined && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Ahorro total</span>
                  <span className="font-medium text-sm">{formatCurrency(balance.totalSavings)}</span>
                </div>
              )}
              {card.countVisits !== undefined && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Total de visitas</span>
                  <span className="font-medium text-sm">{card.countVisits}</span>
                </div>
              )}
              {card.totalRewardsRedeemed !== undefined && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Recompensas canjeadas</span>
                  <span className="font-medium text-sm">{card.totalRewardsRedeemed}</span>
                </div>
              )}
              <div className="flex justify-between p-3 sm:p-4">
                <span className="text-zinc-500 text-sm">ID de tarjeta</span>
                <span className="text-mono text-xs sm:text-sm truncate ml-2">{card.id}</span>
              </div>
              {card.serialNumber && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Número de serie</span>
                  <span className="text-mono text-xs sm:text-sm">{card.serialNumber}</span>
                </div>
              )}
              {card.installDate && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Fecha de instalación</span>
                  <span className="font-medium text-sm">{card.installDate}</span>
                </div>
              )}
              {card.lastAccrual && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Última acumulación</span>
                  <span className="font-medium text-sm">{card.lastAccrual}</span>
                </div>
              )}
              {card.expirationDate && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Fecha de expiración</span>
                  <span className="font-medium text-sm">{card.expirationDate}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scan Another */}
        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="w-full h-10 sm:h-12 btn-secondary text-sm sm:text-base"
          data-testid="scan-another-button"
        >
          Escanear Otra Tarjeta
        </Button>
      </main>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' })}
        onConfirm={handleAction}
        title={confirmModal.action}
        actionType={confirmModal.action}
        details={confirmModal.details}
        card={card}
        config={config}
        loading={loading}
        purchaseAmountFromParent={confirmModal.purchaseAmount}
        formatCurrency={formatCurrency}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModal.open}
        onClose={() => setSuccessModal({ open: false, message: '', details: [] })}
        message={successModal.message}
        details={successModal.details}
      />
    </div>
  );
};

export default ResultPage;
