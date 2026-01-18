import React, { useState, useEffect } from 'react';
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
// Boomerang API card types: stamp(0), cashback(1), multipass(2), coupon(3), discount(4), gift(5), membership(6), reward(7)
const CARD_TYPE_CONFIG = {
  // Stamp card (type ID 0)
  stamp: {
    name: 'Tarjeta de Sellos',
    icon: Stamp,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Sellos', endpoint: 'add-stamp' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'subtract-reward' }
    }
  },
  stamp_card: { // Alias for demo cards
    name: 'Tarjeta de Sellos',
    icon: Stamp,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Sellos', endpoint: 'add-stamp' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'subtract-reward' }
    }
  },
  // Cashback card (type ID 1)
  cashback: {
    name: 'Tarjeta Cashback',
    icon: Wallet,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Cashback', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  cashback_card: { // Alias for demo cards
    name: 'Tarjeta Cashback',
    icon: Wallet,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Cashback', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  // Multipass card (type ID 2) - Boomerang API returns "subscription" type
  // Has two main sections: Visits (add/redeem) and Points (redeem bonus points)
  multipass: {
    name: 'Multipase',
    icon: CreditCard,
    color: '#8A2BE2',
    tabs: ['Visitas', 'Puntos'],
    actions: {
      visitas: { label: 'Visitas', endpoint: null }, // Parent tab - has sub-actions
      puntos: { label: 'Canjear Puntos', endpoint: 'subtract-point' }
    },
    subActions: {
      visitas: {
        agregar: { label: 'Agregar Visitas', endpoint: 'add-visit' },
        canjear: { label: 'Canjear Visitas', endpoint: 'subtract-visit' }
      }
    }
  },
  // Subscription is the Boomerang API name for Multipass cards
  subscription: {
    name: 'Multipase',
    icon: CreditCard,
    color: '#8A2BE2',
    tabs: ['Visitas', 'Puntos'],
    actions: {
      visitas: { label: 'Visitas', endpoint: null }, // Parent tab - has sub-actions
      puntos: { label: 'Canjear Puntos', endpoint: 'subtract-point' }
    },
    subActions: {
      visitas: {
        agregar: { label: 'Agregar Visitas', endpoint: 'add-visit' },
        canjear: { label: 'Canjear Visitas', endpoint: 'subtract-visit' }
      }
    }
  },
  // Coupon (type ID 3)
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
  // Discount card (type ID 4)
  discount: {
    name: 'Tarjeta de Descuento',
    icon: Percent,
    color: '#F040A0',
    tabs: ['Agregar'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' }
    }
  },
  discount_card: { // Alias for demo cards
    name: 'Tarjeta de Descuento',
    icon: Percent,
    color: '#F040A0',
    tabs: ['Agregar'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' }
    }
  },
  // Gift card (type ID 5) - Boomerang API returns "certificate" type
  gift: {
    name: 'Tarjeta de Regalo',
    icon: Gift,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Saldo', endpoint: 'add-point' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  certificate: { // Boomerang API name for gift cards
    name: 'Tarjeta de Regalo',
    icon: Gift,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Saldo', endpoint: 'add-point' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  gift_card: { // Alias for demo cards
    name: 'Tarjeta de Regalo',
    icon: Gift,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Saldo', endpoint: 'add-point' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  // Membership card (type ID 6) - Uses visits or points based on config
  membership: {
    name: 'Membresía',
    icon: User,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Visitas', endpoint: 'add-visit' },
      canjear: { label: 'Canjear Visita', endpoint: 'subtract-visit' }
    }
  },
  // Reward card (type ID 7) - Uses add-scores to update bonusBalance
  reward: {
    name: 'Tarjeta de Recompensa',
    icon: Star,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-scores' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'receive-reward' }
    }
  },
  // Points card (legacy/demo)
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
  // VIP card (legacy/demo)
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

// Helper to normalize card type from API response
const normalizeCardType = (type) => {
  if (!type) return 'stamp';
  // Handle object type (legacy format)
  if (typeof type === 'object' && type.id !== undefined) {
    const typeMap = { 0: 'stamp', 1: 'cashback', 2: 'multipass', 3: 'coupon', 4: 'discount', 5: 'gift', 6: 'membership', 7: 'reward' };
    return typeMap[type.id] || 'stamp';
  }
  // Already a string - return as-is (works for both 'stamp' and 'stamp_card')
  return type.toLowerCase();
};

// Stamp visual component
// Stamp Grid Component - Shows 10 stars by default
// Stars fill progressively based on stamps towards next reward
const StampGrid = ({ activeStamps, stampsUntilReward, totalStampsForReward = 10 }) => {
  // Always show 10 stars
  const displayTotal = 10;
  // Calculate how many to fill based on stamps earned towards the current reward
  // If stampsUntilReward is known, activeStamps = totalStampsForReward - stampsUntilReward
  const fillCount = Math.min(activeStamps, displayTotal);
  
  const stamps = [];
  for (let i = 0; i < displayTotal; i++) {
    stamps.push(
      <div
        key={i}
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all ${
          i < fillCount
            ? 'bg-[#120627] border-transparent'
            : 'bg-white border-zinc-300'
        }`}
      >
        <Star
          className={`h-4 w-4 sm:h-5 sm:w-5 ${i < fillCount ? 'text-white fill-white' : 'text-zinc-300'}`}
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2 sm:gap-3 justify-items-center" data-testid="stamp-grid">
        {stamps}
      </div>
      {/* Show only active stamp count - no "2/12" format */}
      <div className="text-center">
        <span className="text-3xl sm:text-4xl font-mono font-bold text-[#120627]">{fillCount}</span>
        <span className="text-lg text-zinc-400 ml-2">sellos activos</span>
      </div>
    </div>
  );
};

// Confirmation Modal with detailed info
// Helper to format action title nicely
const formatActionTitle = (action) => {
  if (!action) return '';
  const titleMap = {
    'agregarvisitas': 'Agregar Visitas',
    'canjearvisitas': 'Canjear Visitas',
    'agregarpuntos': 'Agregar Puntos',
    'canjearpuntos': 'Canjear Puntos',
    'agregar': 'Agregar',
    'canjear': 'Canjear',
    'usar': 'Usar Cupón',
    'visitas': 'Visitas',
    'puntos': 'Puntos'
  };
  return titleMap[action.toLowerCase()] || action;
};

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
    // Reset comment after successful confirm
    setComment('');
  };
  
  const handleClose = () => {
    setComment('');
    setCommentError(false);
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
        <div className="bg-[#120627] text-white rounded-lg p-3 sm:p-4 mb-4">
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
          {commentError && (
            <p className="text-xs text-red-500 mt-1">* Campo obligatorio</p>
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

// Success Modal - Simplified
const SuccessModal = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="success-modal">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 sm:p-6 text-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#00C853] to-[#00E676] rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
        </div>
        <h3 className="text-heading text-lg sm:text-xl mb-2">Transacción Exitosa</h3>
        <p className="text-zinc-500 text-sm mb-6">{message}</p>
        
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
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });

  const currencyInfo = getCurrencyInfo();

  // Get card type and config (needed for useEffect)
  const cardType = card ? normalizeCardType(card.type) : null;
  const config = cardType ? (CARD_TYPE_CONFIG[cardType] || CARD_TYPE_CONFIG.stamp) : null;

  // Set initial tab based on card type when card changes - must be before early return
  useEffect(() => {
    if (config && config.tabs && config.tabs.length > 0) {
      setActiveTab(config.tabs[0]);
    }
  }, [cardType, config]);

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

  const balance = card.balance || {};
  const CardIcon = config.icon;

  const openConfirmation = (action, rewardTier = null) => {
    const details = [];
    const actionLower = action.toLowerCase();
    
    details.push({ label: 'ID de Tarjeta', value: card.id });
    
    if (actionLower === 'agregar' && config.requiresPurchaseAmount) {
      details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
    } else if (actionLower === 'agregar') {
      details.push({ label: 'Cantidad', value: actionAmount });
    } else if (actionLower === 'canjear') {
      if (rewardTier) {
        // For reward card tier redemption
        details.push({ label: 'Recompensa', value: rewardTier.name });
        details.push({ label: 'Puntos requeridos', value: rewardTier.threshold });
      } else {
        details.push({ label: 'Cantidad a Canjear', value: actionAmount });
      }
    } else if (actionLower === 'agregarvisitas') {
      // Multipass: Add visits
      details.push({ label: 'Visitas a Agregar', value: actionAmount });
    } else if (actionLower === 'canjearvisitas') {
      // Multipass: Redeem visits
      details.push({ label: 'Visitas a Canjear', value: actionAmount });
    } else if (actionLower === 'agregarpuntos') {
      // Multipass: Add bonus points
      details.push({ label: 'Puntos a Agregar', value: actionAmount });
    } else if (actionLower === 'canjearpuntos') {
      // Multipass: Redeem bonus points
      details.push({ label: 'Puntos a Canjear', value: actionAmount });
    }
    
    if (actionLower === 'usar') {
      details.push({ label: 'Estado del Cupón', value: 'Activo' });
    }
    
    setConfirmModal({ 
      open: true, 
      action, 
      details,
      purchaseAmount: config.requiresPurchaseAmount ? purchaseAmount : '',
      rewardTier: rewardTier // Store the reward tier for later use
    });
  };

  const handleAction = async (comment = '', confirmPurchaseAmount = '') => {
    const action = confirmModal.action;
    const rewardTier = confirmModal.rewardTier; // Get the reward tier if present
    setLoading(true);
    
    try {
      const actionKey = action.toLowerCase();
      
      // Map multipass-specific actions to their endpoints
      // currentNumberOfUses = available visits
      // add-visit INCREASES available visits (sell to customer)
      // subtract-visit DECREASES available visits (customer uses a visit)
      let endpoint;
      if (actionKey === 'agregarvisitas') {
        // "Add visits" = SELL visits to customer = add-visit (increases currentNumberOfUses/available)
        endpoint = `/cards/${card.id}/add-visit`;
      } else if (actionKey === 'canjearvisitas') {
        // "Redeem visit" = customer USES a visit = subtract-visit (decreases currentNumberOfUses/available)
        endpoint = `/cards/${card.id}/subtract-visit`;
      } else if (actionKey === 'agregarpuntos') {
        endpoint = `/cards/${card.id}/add-scores`;
      } else if (actionKey === 'canjearpuntos') {
        endpoint = `/cards/${card.id}/subtract-scores`;
      } else {
        // Use config-based endpoint lookup for other actions
        const actionConfig = config.actions[actionKey];
        if (!actionConfig || !actionConfig.endpoint) {
          throw new Error('Acción desconocida');
        }
        endpoint = `/cards/${card.id}/${actionConfig.endpoint}`;
      }
      
      // Check if this is a multipass action (no purchase amount needed)
      const isMultipassAction = ['agregarvisitas', 'canjearvisitas', 'agregarpuntos', 'canjearpuntos'].includes(actionKey);
      
      // Get the purchase amount from confirmation or state
      const finalPurchaseAmount = confirmPurchaseAmount ? parseFloat(confirmPurchaseAmount) : 
                     (config.requiresPurchaseAmount ? parseFloat(purchaseAmount) || 0 : undefined);
      
      // Build payload - handle reward tier ID for receive-reward endpoint
      let payload = {
        comment: comment || undefined,
        purchaseSum: isMultipassAction ? undefined : finalPurchaseAmount
      };
      
      // For receive-reward endpoint, pass the tier ID as amount
      if (rewardTier && endpoint.includes('receive-reward')) {
        payload.amount = rewardTier.id; // The tier ID is needed for receive-reward
      } else if (config.requiresPurchaseAmount && finalPurchaseAmount && endpoint.includes('add-point')) {
        // For discount/cashback cards: calculate points based on percentage
        // points = purchaseSum * (percentage / 100)
        const percentage = balance.discountPercentage || balance.cashbackPercent || 1;
        payload.amount = Math.round(finalPurchaseAmount * (percentage / 100));
      } else {
        payload.amount = actionAmount;
      }

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
      
      setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' });
      setSuccessModal({ 
        open: true, 
        message: response.data.message || '¡Transacción completada exitosamente!'
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

  const renderActionTab = () => {
    const tabLower = activeTab.toLowerCase();
    const actionConfig = config.actions[tabLower];
    
    if (!actionConfig) return null;

    // Normalize card type for logic (remove _card suffix if present)
    const normalizedType = cardType.replace('_card', '');

    // For stamp cards, show stamp grid
    if ((normalizedType === 'stamp') && activeTab === 'Agregar') {
      // Calculate active stamps towards next reward
      // stampsBeforeReward tells us how many stamps until next reward
      // If stampsBeforeReward = 2 and reward is at 10 stamps, then activeStamps = 10 - 2 = 8
      const stampsBeforeReward = balance.stampsBeforeReward ?? 10;
      const stampsPerReward = 10; // Default to 10, will fetch from API if available
      const activeStamps = Math.max(0, stampsPerReward - stampsBeforeReward);
      
      return (
        <div className="space-y-4 sm:space-y-6">
          <StampGrid 
            activeStamps={activeStamps} 
            stampsUntilReward={stampsBeforeReward}
            totalStampsForReward={stampsPerReward}
          />
          
          <div className="text-center">
            <p className="text-xs sm:text-sm text-zinc-500">
              {stampsBeforeReward > 0 
                ? `${stampsBeforeReward} sellos hasta la próxima recompensa`
                : '¡Recompensa disponible!'}
            </p>
          </div>
          
          {/* Stamp counter - with keyboard input */}
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Cantidad de sellos
            </label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
                className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                style={{ borderColor: '#120627', color: '#120627' }}
                data-testid="decrease-amount"
              >
                <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
              <Input
                type="number"
                value={actionAmount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setActionAmount(Math.max(1, val));
                }}
                min="1"
                className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
                data-testid="action-amount-input"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setActionAmount(actionAmount + 1)}
                className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                style={{ borderColor: '#120627', color: '#120627' }}
                data-testid="increase-amount"
              >
                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>
          
          <Button
            onClick={() => openConfirmation('Agregar')}
            disabled={loading || actionAmount < 1}
            className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
            data-testid="add-stamp-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // Stamp card "Canjear" tab - show available rewards to redeem
    if ((normalizedType === 'stamp') && activeTab === 'Canjear') {
      const numberRewardsUnused = balance.numberRewardsUnused ?? 0;
      const availableRewardTiers = card.availableRewardTiers || [];
      
      return (
        <div className="space-y-4 sm:space-y-6">
          {/* Available rewards display */}
          <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
            <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
              {numberRewardsUnused}
            </span>
            <p className="text-xs sm:text-sm text-zinc-500 mt-2">
              Recompensas disponibles
            </p>
          </div>
          
          {/* Multi-reward selection (if available) */}
          {availableRewardTiers.length > 0 ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">
                Seleccionar recompensa
              </label>
              {availableRewardTiers.map((tier, index) => (
                <button
                  key={tier.id || index}
                  onClick={() => {
                    setActionAmount(tier.id || index + 1);
                    openConfirmation('Canjear', tier);
                  }}
                  disabled={loading || numberRewardsUnused < 1}
                  className="w-full p-4 border-2 rounded-xl text-left hover:border-[#120627] hover:bg-zinc-50 transition-all disabled:opacity-50"
                  style={{ borderColor: actionAmount === (tier.id || index + 1) ? '#120627' : '#e4e4e7' }}
                  data-testid={`reward-tier-${index}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm sm:text-base">{tier.name || `Recompensa ${index + 1}`}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        A los {tier.threshold || ((index + 1) * 10)} sellos
                      </p>
                    </div>
                    <div className="text-[#120627]">
                      <Gift className="h-6 w-6" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : numberRewardsUnused > 0 ? (
            // Single reward redemption (no tiers configured)
            <Button
              onClick={() => openConfirmation('Canjear')}
              disabled={loading}
              className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
              data-testid="redeem-reward-button"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Canjear Recompensa'}
            </Button>
          ) : (
            <div className="text-center p-6 bg-zinc-50 rounded-xl">
              <Gift className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
              <p className="text-zinc-500 text-sm">
                No hay recompensas disponibles para canjear.
              </p>
              <p className="text-zinc-400 text-xs mt-2">
                Sigue acumulando sellos para ganar recompensas.
              </p>
            </div>
          )}
        </div>
      );
    }

    // For Multipass/Subscription cards - special two-tab UI with Visits and Points
    if ((normalizedType === 'multipass' || normalizedType === 'subscription')) {
      const availableVisits = balance.currentNumberOfUses || 0;
      const bonusPoints = balance.bonusBalance || 0;
      
      // Visitas tab - shows visits balance with Add/Redeem buttons
      if (activeTab === 'Visitas') {
        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Visits balance display */}
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
                {availableVisits}
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-2">
                Visitas disponibles
              </p>
            </div>
            
            {/* Counter */}
            <div className="card-brutalist">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
                Cantidad de visitas
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
                  className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                  style={{ borderColor: '#120627', color: '#120627' }}
                  data-testid="decrease-visits"
                >
                  <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
                <Input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setActionAmount(Math.max(1, val));
                  }}
                  min="1"
                  className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
                  data-testid="visits-amount-input"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActionAmount(actionAmount + 1)}
                  className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                  style={{ borderColor: '#120627', color: '#120627' }}
                  data-testid="increase-visits"
                >
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </div>
            </div>
            
            {/* Two action buttons: Add visits and Redeem visits */}
            <div className="space-y-3">
              <Button
                onClick={() => openConfirmation('AgregarVisitas')}
                disabled={loading || actionAmount < 1}
                className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
                data-testid="add-visits-button"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Agregar Visitas'}
              </Button>
              <Button
                onClick={() => openConfirmation('CanjearVisitas')}
                disabled={loading || actionAmount < 1 || actionAmount > availableVisits}
                className="w-full h-12 sm:h-14 text-base sm:text-lg border-2 bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white"
                style={{ borderColor: '#120627', color: '#120627' }}
                data-testid="redeem-visits-button"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Canjear Visitas'}
              </Button>
            </div>
          </div>
        );
      }
      
      // Puntos tab - shows bonus points with Add/Redeem buttons
      if (activeTab === 'Puntos') {
        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Points balance display */}
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
                {bonusPoints}
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-2">
                Puntos acumulados
              </p>
            </div>
            
            {/* Counter for points */}
            <div className="card-brutalist">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
                Cantidad de puntos
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
                  className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                  style={{ borderColor: '#120627', color: '#120627' }}
                  data-testid="decrease-points"
                >
                  <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
                <Input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setActionAmount(Math.max(1, val));
                  }}
                  min="1"
                  className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
                  data-testid="points-amount-input"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActionAmount(actionAmount + 1)}
                  className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                  style={{ borderColor: '#120627', color: '#120627' }}
                  data-testid="increase-points"
                >
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </div>
            </div>
            
            {/* Two action buttons: Add points and Redeem points */}
            <div className="space-y-3">
              <Button
                onClick={() => openConfirmation('AgregarPuntos')}
                disabled={loading || actionAmount < 1}
                className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
                data-testid="add-points-button"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Agregar Puntos'}
              </Button>
              <Button
                onClick={() => openConfirmation('CanjearPuntos')}
                disabled={loading || bonusPoints <= 0 || actionAmount > bonusPoints || actionAmount < 1}
                className="w-full h-12 sm:h-14 text-base sm:text-lg border-2 bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white"
                style={{ borderColor: '#120627', color: '#120627' }}
                data-testid="redeem-points-button"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Canjear Puntos'}
              </Button>
            </div>
          </div>
        );
      }
    }

    // For discount/cashback cards with purchase amount
    if (config.requiresPurchaseAmount && activeTab === 'Agregar') {
      // Get discount/cashback info from balance - handle different API field names
      const discountLevel = balance.discountLevel ?? balance.discountPercentage ?? null;
      const cashbackPercent = balance.cashbackPercent ?? balance.cashbackPercentage ?? null;
      const discountAmount = balance.discountAmount ?? 0;
      const totalTransactions = balance.transactionsAmount ?? discountAmount;
      
      return (
        <div className="space-y-4 sm:space-y-6">
          {/* Cashback balance display - show current balance in currency */}
          {(normalizedType === 'cashback' || normalizedType === 'cashback_card') && (
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
                {formatCurrency(balance.balance || 0)}
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-2">Cashback disponible</p>
            </div>
          )}
          
          {/* Discount level display - only for discount cards */}
          {discountLevel && normalizedType !== 'cashback' && normalizedType !== 'cashback_card' && (
            <div className="text-center">
              <span className="text-5xl sm:text-6xl font-mono font-bold gradient-text">
                {discountLevel}%
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">Nivel de descuento</p>
              {totalTransactions > 0 && (
                <p className="text-xs text-zinc-400 mt-2">
                  Total acumulado: {formatCurrency(totalTransactions / 100)}
                </p>
              )}
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
      // Calculate available amount based on card type
      // Gift/certificate cards use 'balance', others use bonusBalance, numberRewardsUnused, etc.
      let availableAmount = 0;
      if (activeTab === 'Puntos') {
        availableAmount = balance.bonusBalance || 0;
      } else {
        // For Canjear tab - check different balance fields based on card type
        if (normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card') {
          // Gift/certificate cards use the 'balance' field
          availableAmount = balance.balance || balance.bonusBalance || 0;
        } else if (normalizedType === 'cashback' || normalizedType === 'cashback_card') {
          // Cashback cards use the 'balance' field for accumulated cashback
          availableAmount = balance.balance || 0;
        } else if (normalizedType === 'reward') {
          // Reward cards use bonusBalance for scores
          availableAmount = balance.bonusBalance || 0;
        } else if (normalizedType === 'membership') {
          // Membership cards - currentNumberOfUses tracks available visits
          availableAmount = balance.currentNumberOfUses || 0;
        } else if (normalizedType === 'multipass' || normalizedType === 'subscription') {
          // Multipass/Subscription cards use currentNumberOfUses for available visits
          availableAmount = balance.currentNumberOfUses || 0;
        } else if (balance.numberRewardsUnused !== undefined && balance.numberRewardsUnused !== null) {
          availableAmount = balance.numberRewardsUnused;
        } else if (balance.visitsAvailable !== undefined && balance.visitsAvailable !== null) {
          availableAmount = balance.visitsAvailable;
        } else {
          availableAmount = balance.bonusBalance || balance.balance || 0;
        }
      }
      
      // Determine the label for available amount
      let availableLabel = 'Puntos disponibles';
      if (normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card') {
        availableLabel = 'Saldo disponible';
      } else if (normalizedType === 'cashback' || normalizedType === 'cashback_card') {
        availableLabel = 'Cashback disponible';
      } else if (normalizedType === 'reward') {
        availableLabel = 'Puntos acumulados';
      } else if (normalizedType === 'membership') {
        availableLabel = 'Visitas disponibles';
      } else if (normalizedType === 'multipass' || normalizedType === 'subscription') {
        availableLabel = 'Visitas disponibles';
      } else if (balance.numberRewardsUnused !== undefined && balance.numberRewardsUnused !== null) {
        availableLabel = 'Recompensas disponibles';
      } else if (balance.visitsAvailable !== undefined && balance.visitsAvailable !== null) {
        availableLabel = 'Visitas disponibles';
      }
      
      // Special handling for reward cards - show available reward tiers
      if (normalizedType === 'reward' && activeTab === 'Canjear') {
        const availableRewardTiers = card.availableRewardTiers || [];
        
        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Points balance display */}
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
                {availableAmount}
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-2">
                {availableLabel}
              </p>
            </div>
            
            {/* Available reward tiers */}
            {availableRewardTiers.length > 0 ? (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">
                  Recompensas disponibles
                </label>
                {availableRewardTiers.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => {
                      setActionAmount(tier.id); // Store the tier ID
                      openConfirmation('Canjear', tier);
                    }}
                    disabled={loading}
                    className="w-full p-4 border-2 rounded-xl text-left hover:border-[#120627] hover:bg-zinc-50 transition-all"
                    style={{ borderColor: actionAmount === tier.id ? '#120627' : '#e4e4e7' }}
                    data-testid={`reward-tier-${tier.id}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm sm:text-base">{tier.name}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Requiere: {tier.threshold} puntos
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-[#120627]">
                          {tier.value > 0 ? `$${tier.value}` : 'Gratis'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 bg-zinc-50 rounded-xl">
                <p className="text-zinc-500 text-sm">
                  No hay recompensas disponibles aún.
                </p>
                <p className="text-zinc-400 text-xs mt-2">
                  Acumula más puntos para desbloquear recompensas.
                </p>
              </div>
            )}
          </div>
        );
      }
      
      return (
        <div className="space-y-4 sm:space-y-6">
          {/* Available balance display */}
          <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
            <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
              {(normalizedType === 'cashback' || normalizedType === 'cashback_card')
                ? formatCurrency(availableAmount)
                : (normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card')
                  ? formatCurrency(availableAmount / 100)
                  : availableAmount}
            </span>
            <p className="text-xs sm:text-sm text-zinc-500 mt-2">
              {availableLabel}
            </p>
          </div>
          
          {/* Amount input - allows keyboard entry */}
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Cantidad a canjear
            </label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
                className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                style={{ borderColor: '#120627', color: '#120627' }}
                data-testid="decrease-redeem"
              >
                <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
              <Input
                type="number"
                value={actionAmount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setActionAmount(Math.max(1, Math.min(availableAmount || 999999, val)));
                }}
                min="1"
                max={availableAmount || 999999}
                className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
                data-testid="redeem-amount-input"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setActionAmount(Math.min(availableAmount || 999999, actionAmount + 1))}
                className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                style={{ borderColor: '#120627', color: '#120627' }}
                disabled={availableAmount > 0 && actionAmount >= availableAmount}
                data-testid="increase-redeem"
              >
                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>
          
          <Button
            onClick={() => openConfirmation(activeTab)}
            disabled={loading || (availableAmount > 0 && actionAmount > availableAmount) || actionAmount < 1}
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

    // Default: simple counter with action (keyboard input enabled)
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="card-brutalist">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
            Cantidad
          </label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50 flex-shrink-0"
              style={{ borderColor: '#120627', color: '#120627' }}
            >
              <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            <Input
              type="number"
              value={actionAmount}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setActionAmount(Math.max(1, val));
              }}
              min="1"
              className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
              data-testid="default-amount-input"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionAmount(actionAmount + 1)}
              className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-zinc-50 flex-shrink-0"
              style={{ borderColor: '#120627', color: '#120627' }}
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>
        </div>
        
        <Button
          onClick={() => openConfirmation(activeTab)}
          disabled={loading || actionAmount < 1}
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
          className="flex items-center gap-1 sm:gap-2 p-2 hover:bg-[#ee478a] hover:text-white rounded-lg transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium hidden sm:inline">Volver</span>
        </button>
        <img 
          src="/fonts/logo.png" 
          alt="Devotio Rewards" 
          className="h-8 sm:h-10"
        />
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-md mx-auto p-4 sm:p-6 pb-20 sm:pb-24">
        {/* Card Type Header - Replaces Client ID */}
        <div className="customer-id-banner mb-3 sm:mb-4" data-testid="card-type-banner">
          <div className="flex items-center justify-center gap-2">
            <CardIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            <p className="font-semibold text-sm sm:text-lg uppercase tracking-wider">{config.name}</p>
          </div>
        </div>

        {/* Customer Name (VISIBLE - not masked) */}
        <div className="text-center mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-zinc-500">Cliente:</p>
          <h2 className="text-heading text-xl sm:text-2xl" data-testid="customer-display-name">
            {card.customer?.firstName || 'N/A'} {card.customer?.surname || ''}
          </h2>
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
                  ? 'bg-[#120627] text-white hover:bg-[#ffca32] hover:text-[#120627]'
                  : 'bg-white text-[#120627] hover:bg-[#ee478a] hover:text-white'
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
              {/* Stamp card - show only current active stamps (not historical total) */}
              {(normalizedType === 'stamp' || normalizedType === 'stamp_card') && (balance.currentNumberOfUses !== undefined && balance.currentNumberOfUses !== null) && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Sellos activos</span>
                  <span className="font-medium text-sm">{balance.currentNumberOfUses}</span>
                </div>
              )}
              {/* Non-stamp cards using currentNumberOfUses (visits, etc.) */}
              {(normalizedType !== 'stamp' && normalizedType !== 'stamp_card') && (balance.currentNumberOfUses !== undefined && balance.currentNumberOfUses !== null) && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Visitas disponibles</span>
                  <span className="font-medium text-sm">{balance.currentNumberOfUses}</span>
                </div>
              )}
              {(balance.numberRewardsUnused !== undefined && balance.numberRewardsUnused !== null) && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Recompensas disponibles</span>
                  <span className="font-medium text-sm">{balance.numberRewardsUnused}</span>
                </div>
              )}
              {(balance.bonusBalance !== undefined && balance.bonusBalance !== null) && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Balance de puntos</span>
                  <span className="font-medium text-sm">{balance.bonusBalance}</span>
                </div>
              )}
              {(balance.balance !== undefined && balance.balance !== null && balance.balance > 0) && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Balance total</span>
                  <span className="font-medium text-sm">{formatCurrency(balance.balance)}</span>
                </div>
              )}
              {/* Discount card specific fields */}
              {(balance.discountPercentage !== undefined && balance.discountPercentage !== null) && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Porcentaje de descuento</span>
                  <span className="font-medium text-sm">{balance.discountPercentage}%</span>
                </div>
              )}
              {(balance.discountAmount !== undefined && balance.discountAmount !== null && balance.discountAmount > 0) && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Monto acumulado</span>
                  <span className="font-medium text-sm">{formatCurrency(balance.discountAmount / 100)}</span>
                </div>
              )}
              {/* Legacy demo fields */}
              {(balance.discountLevel !== undefined && balance.discountLevel !== null && !balance.discountPercentage) && (
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
              {(balance.totalSavings !== undefined && balance.totalSavings !== null) && (
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
              {(card.totalRewardsRedeemed !== undefined && card.totalRewardsRedeemed !== null) && (
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
              {card.expiresAt && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Expira</span>
                  <span className="font-medium text-sm">{new Date(card.expiresAt).toLocaleDateString('es')}</span>
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
        onClose={() => {
          setSuccessModal({ open: false, message: '' });
          navigate('/'); // Return to scanner home after transaction
        }}
        message={successModal.message}
      />
    </div>
  );
};

export default ResultPage;
