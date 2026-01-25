import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import {
  ArrowLeft,
  Plus,
  Minus,
  Check,
  Loader2,
  AlertCircle,
  Star,
  ChevronDown,
  ChevronUp,
  Gift,
  User,
  CreditCard,
  X
} from 'lucide-react';

// Import extracted components
import { CARD_TYPE_CONFIG, normalizeCardType, formatActionTitle } from '../config/cardTypes';
import { StampGrid } from '../components/cards';
import { ConfirmationModal, SuccessModal } from '../components/modals';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { triggerVibration, triggerBeep, copyToClipboard, formatCurrency, getCurrencyInfo, settings } = useSettings();
  
  const [card, setCard] = useState(location.state?.card || null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Agregar');
  const [actionAmount, setActionAmount] = useState(1);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showCardInfo, setShowCardInfo] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, details: [], purchaseAmount: '' });
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });
  const [templateRewardTiers, setTemplateRewardTiers] = useState([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

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

  // Fetch template data for stamp cards with available rewards
  // This gets the reward tier configuration from the card's template
  useEffect(() => {
    const fetchTemplateRewardTiers = async () => {
      // Only fetch for stamp cards with unused rewards and a valid templateId
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      const hasUnusedRewards = card?.balance?.numberRewardsUnused > 0;
      const hasTemplateId = card?.templateId;
      const hasNoTiersFromCard = !card?.availableRewardTiers || card.availableRewardTiers.length === 0;
      
      if (normalizedType === 'stamp' && hasUnusedRewards && hasTemplateId && hasNoTiersFromCard) {
        setLoadingTemplate(true);
        try {
          const response = await axios.get(`${API}/templates/${card.templateId}`);
          if (response.data?.template?.rewardTiers) {
            setTemplateRewardTiers(response.data.template.rewardTiers);
          }
        } catch (error) {
          console.log('No reward tiers available for this template');
          setTemplateRewardTiers([]);
        } finally {
          setLoadingTemplate(false);
        }
      }
    };
    
    if (card) {
      fetchTemplateRewardTiers();
    }
  }, [card, cardType]);

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
    const normalizedType = cardType ? cardType.replace('_card', '') : '';
    
    details.push({ label: 'ID de Tarjeta', value: card.id });
    
    // Include purchase amount for stamp cards when adding stamps
    if (actionLower === 'agregar' && normalizedType === 'stamp') {
      if (purchaseAmount) {
        details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
      }
      details.push({ label: 'Cantidad de Sellos', value: actionAmount });
    } else if (actionLower === 'agregar' && config.requiresPurchaseAmount) {
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
      if (purchaseAmount) {
        details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
      }
    } else if (actionLower === 'canjearvisitas') {
      // Multipass: Redeem visits
      details.push({ label: 'Visitas a Canjear', value: actionAmount });
      if (purchaseAmount) {
        details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
      }
    } else if (actionLower === 'agregarpuntos') {
      // Multipass: Add bonus points
      details.push({ label: 'Puntos a Agregar', value: actionAmount });
    } else if (actionLower === 'canjearpuntos') {
      // Multipass: Redeem bonus points
      details.push({ label: 'Puntos a Canjear', value: actionAmount });
    }
    
    // Include purchase amount for coupon redemption
    if (actionLower === 'usar') {
      details.push({ label: 'Estado del Cupón', value: 'Activo' });
      if (purchaseAmount) {
        details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
      }
    }
    
    // For stamp cards, always pass purchaseAmount if available
    const shouldIncludePurchaseAmount = config.requiresPurchaseAmount || normalizedType === 'stamp' || normalizedType === 'coupon';
    
    setConfirmModal({ 
      open: true, 
      action, 
      details,
      purchaseAmount: shouldIncludePurchaseAmount ? purchaseAmount : '',
      rewardTier: rewardTier // Store the reward tier for later use
    });
  };

  const handleAction = async (comment = '', confirmPurchaseAmount = '') => {
    const action = confirmModal.action;
    const rewardTier = confirmModal.rewardTier; // Get the reward tier if present
    const normalizedType = cardType ? cardType.replace('_card', '') : '';
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
      
      // Check if this is a multipass bonus points action (now includes purchaseSum)
      const isMultipassPointsAction = ['agregarpuntos', 'canjearpuntos'].includes(actionKey);
      
      // Get the purchase amount from confirmation modal or state
      // Include purchaseSum for: stamp cards, discount/cashback cards, coupon cards, multipass (visits and points)
      const shouldIncludePurchaseSum = config.requiresPurchaseAmount || 
                                        normalizedType === 'stamp' || 
                                        normalizedType === 'coupon' ||
                                        ['agregarvisitas', 'canjearvisitas', 'agregarpuntos', 'canjearpuntos'].includes(actionKey);
      
      const finalPurchaseAmount = confirmPurchaseAmount ? parseFloat(confirmPurchaseAmount) : 
                                  (shouldIncludePurchaseSum ? parseFloat(purchaseAmount) || undefined : undefined);
      
      // Build payload - handle reward tier ID for receive-reward endpoint
      let payload = {
        comment: comment || undefined,
        purchaseSum: finalPurchaseAmount // Include purchaseSum for all card types that need it
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
      // Handle error - detail can be string or object (Pydantic validation error)
      let message = 'La acción falló';
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic validation errors come as array
        message = detail[0]?.msg || 'Error de validación';
      } else if (detail?.msg) {
        message = detail.msg;
      }
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
      // Stamp card display logic:
      // - ALWAYS display 10 stars (standard Boomerang "Recuento de estampillas")
      // - currentNumberOfUses = active stamps in current cycle (resets after reward)
      // - stampsBeforeReward = stamps remaining until NEXT reward
      // 
      // The card can be configured for rewards at any interval (e.g., every 2 stamps or every 10)
      // We use currentNumberOfUses as the source of truth for active stamps
      
      const displayTotal = 10; // Always show 10 stars for visual display
      const stampsBeforeReward = balance.stampsBeforeReward ?? displayTotal;
      
      // Use currentNumberOfUses as the active stamps - this is the correct field from Boomerang
      // It represents stamps collected in the current cycle, resetting after each reward
      const activeStamps = balance.currentNumberOfUses ?? 0;
      
      return (
        <div className="space-y-4 sm:space-y-6">
          <StampGrid 
            activeStamps={activeStamps} 
            stampsUntilReward={stampsBeforeReward}
            totalStampsForReward={displayTotal}
            numberStampsTotal={displayTotal}
          />
          
          <div className="text-center">
            <p className="text-xs sm:text-sm text-zinc-500">
              Sellos activos: {activeStamps}
            </p>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              {stampsBeforeReward > 0 
                ? `${stampsBeforeReward} sello${stampsBeforeReward !== 1 ? 's' : ''} hasta la próxima recompensa`
                : '¡Recompensa disponible!'}
            </p>
          </div>
          
          {/* Purchase amount input for stamp cards */}
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Monto de compra ({currencyInfo.code})
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
              <Input
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="0"
                className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                data-testid="stamp-purchase-amount"
              />
            </div>
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
      // Use card's availableRewardTiers if present, otherwise use template reward tiers
      const availableRewardTiers = (card.availableRewardTiers && card.availableRewardTiers.length > 0) 
        ? card.availableRewardTiers 
        : templateRewardTiers;
      
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
          
          {/* Purchase amount input for reward redemption */}
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Monto de compra ({currencyInfo.code})
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
              <Input
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="0"
                className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                data-testid="stamp-redeem-purchase-amount"
              />
            </div>
          </div>
          
          {/* Loading state for template fetch */}
          {loadingTemplate && (
            <div className="text-center p-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
              <p className="text-xs text-zinc-500 mt-2">Cargando opciones de recompensa...</p>
            </div>
          )}
          
          {/* Multi-reward selection with cards UI (if tiers available) */}
          {!loadingTemplate && availableRewardTiers.length > 0 && numberRewardsUnused > 0 ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">
                Seleccionar recompensa a canjear
              </label>
              <div className="space-y-2">
                {availableRewardTiers.map((tier, index) => {
                  const tierId = tier.id || index + 1;
                  const isSelected = actionAmount === tierId;
                  return (
                    <button
                      key={tierId}
                      onClick={() => setActionAmount(tierId)}
                      disabled={loading}
                      className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                        isSelected 
                          ? 'border-[#120627] bg-zinc-50' 
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                      data-testid={`reward-tier-card-${tierId}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm sm:text-base text-[#120627]">
                            {tier.name || `Recompensa ${index + 1}`}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            A los {tier.threshold || 10} sellos
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected 
                            ? 'border-[#120627] bg-[#120627]' 
                            : 'border-zinc-300'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={() => {
                  const selectedTier = availableRewardTiers.find(t => 
                    t.id === actionAmount || (!t.id && actionAmount === availableRewardTiers.indexOf(t) + 1)
                  );
                  openConfirmation('Canjear', selectedTier);
                }}
                disabled={loading || numberRewardsUnused < 1 || !actionAmount}
                className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
                data-testid="redeem-reward-button"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Canjear Recompensa'}
              </Button>
            </div>
          ) : !loadingTemplate && numberRewardsUnused > 0 ? (
            // Single reward redemption (no tiers configured)
            <Button
              onClick={() => openConfirmation('Canjear')}
              disabled={loading}
              className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary"
              data-testid="redeem-reward-button"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Canjear Recompensa'}
            </Button>
          ) : !loadingTemplate ? (
            <div className="text-center p-6 bg-zinc-50 rounded-xl">
              <Gift className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
              <p className="text-zinc-500 text-sm">
                No hay recompensas disponibles para canjear.
              </p>
              <p className="text-zinc-400 text-xs mt-2">
                Sigue acumulando sellos para ganar recompensas.
              </p>
            </div>
          ) : null}
        </div>
      );
    }

    // For Membership cards - show membership tier, status, and visits
    if (normalizedType === 'membership') {
      const membershipTier = card.membershipTier || {};
      const customerSubscription = card.customerSubscription || {};
      const availableVisits = balance.currentNumberOfUses || 0;
      const totalVisits = customerSubscription.balance || 0;
      const subscriptionStatus = customerSubscription.status === 1 ? 'Activo' : 'Inactivo';
      const countVisits = card.countVisits || 0;
      
      // Calculate expiration date
      let expiresAt = null;
      if (customerSubscription.expiredAt) {
        expiresAt = new Date(customerSubscription.expiredAt * 1000).toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
      
      if (activeTab === 'Agregar') {
        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Membership status card */}
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white mb-3 ${
                subscriptionStatus === 'Activo' ? 'bg-green-500' : 'bg-gray-500'
              }`}>
                {subscriptionStatus}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-[#120627]">
                {membershipTier.name || 'Membresía'}
              </p>
              {membershipTier.description && membershipTier.description !== membershipTier.name && (
                <p className="text-sm text-zinc-500 mt-1">{membershipTier.description}</p>
              )}
              {expiresAt && (
                <p className="text-xs text-zinc-400 mt-2">Vence: {expiresAt}</p>
              )}
            </div>
            
            {/* Visits display with visual */}
            <StampGrid 
              activeStamps={availableVisits} 
              stampsUntilReward={totalVisits - availableVisits}
              totalStampsForReward={totalVisits > 0 ? totalVisits : 10}
              numberStampsTotal={totalVisits > 0 ? totalVisits : 10}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-zinc-50 rounded-xl">
                <span className="text-2xl sm:text-3xl font-mono font-bold gradient-text">
                  {availableVisits}
                </span>
                <p className="text-xs text-zinc-500 mt-1">Visitas disponibles</p>
              </div>
              <div className="text-center p-3 bg-zinc-50 rounded-xl">
                <span className="text-2xl sm:text-3xl font-mono font-bold text-[#120627]">
                  {countVisits}
                </span>
                <p className="text-xs text-zinc-500 mt-1">Visitas totales</p>
              </div>
            </div>
            
            {/* Purchase amount input */}
            <div className="card-brutalist">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
                Monto de compra ({currencyInfo.code})
              </label>
              <div className="relative">
                <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
                <Input
                  type="number"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  placeholder="0"
                  className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                  data-testid="membership-purchase-amount"
                />
              </div>
            </div>
            
            {/* Visits counter */}
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
                  data-testid="membership-visits-input"
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
            
            <Button
              onClick={() => openConfirmation('Agregar')}
              disabled={loading || actionAmount < 1}
              className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary disabled:opacity-50"
              data-testid="add-membership-visits-button"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
            </Button>
          </div>
        );
      }
      
      // Canjear tab for membership
      if (activeTab === 'Canjear') {
        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Membership status card */}
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white mb-3 ${
                subscriptionStatus === 'Activo' ? 'bg-green-500' : 'bg-gray-500'
              }`}>
                {subscriptionStatus}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-[#120627]">
                {membershipTier.name || 'Membresía'}
              </p>
            </div>
            
            {/* Available visits display */}
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
                {availableVisits}
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-2">Visitas disponibles</p>
            </div>
            
            {/* Visits counter for redemption */}
            <div className="card-brutalist">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
                Visitas a canjear
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
                  className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                  style={{ borderColor: '#120627', color: '#120627' }}
                  data-testid="decrease-redeem-visits"
                >
                  <Minus className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
                <Input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setActionAmount(Math.max(1, Math.min(val, availableVisits)));
                  }}
                  min="1"
                  max={availableVisits}
                  className="input-brutalist text-2xl sm:text-3xl font-mono h-12 sm:h-14 text-center flex-1"
                  data-testid="membership-redeem-visits-input"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setActionAmount(Math.min(actionAmount + 1, availableVisits))}
                  className="h-12 w-12 sm:h-14 sm:w-14 border-2 rounded-lg bg-white hover:bg-[#ee478a] hover:border-[#ee478a] hover:text-white flex-shrink-0"
                  style={{ borderColor: '#120627', color: '#120627' }}
                  data-testid="increase-redeem-visits"
                >
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </div>
            </div>
            
            <Button
              onClick={() => openConfirmation('Canjear')}
              disabled={loading || availableVisits <= 0 || actionAmount < 1 || actionAmount > availableVisits}
              className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary disabled:opacity-50"
              data-testid="redeem-membership-visits-button"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
            </Button>
          </div>
        );
      }
    }

    // For Multipass/Subscription cards - special two-tab UI with Visits and Points
    if ((normalizedType === 'multipass' || normalizedType === 'subscription')) {
      const availableVisits = balance.currentNumberOfUses || 0;
      const bonusPoints = balance.bonusBalance || 0;
      const totalVisits = balance.numberOfUses || 10; // Total visits configured on the card
      
      // Visitas tab - shows visits balance with Add/Redeem buttons
      if (activeTab === 'Visitas') {
        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Visual Stamp Grid for Multipass visits */}
            <StampGrid 
              activeStamps={availableVisits} 
              stampsUntilReward={totalVisits - availableVisits}
              totalStampsForReward={totalVisits}
              numberStampsTotal={totalVisits}
            />
            
            {/* Visits balance display */}
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
                {availableVisits}
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-2">
                Visitas disponibles
              </p>
            </div>
            
            {/* Purchase amount input for multipass */}
            <div className="card-brutalist">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
                Monto de compra ({currencyInfo.code})
              </label>
              <div className="relative">
                <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
                <Input
                  type="number"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  placeholder="0"
                  className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                  data-testid="multipass-purchase-amount"
                />
              </div>
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
            
            {/* Purchase amount input for multipass points */}
            <div className="card-brutalist">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
                Monto de compra ({currencyInfo.code})
              </label>
              <div className="relative">
                <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
                <Input
                  type="number"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  placeholder="0"
                  className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                  data-testid="multipass-points-purchase-amount"
                />
              </div>
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

    // For discount/cashback cards with purchase amount (exclude reward cards - they have their own handler)
    if (config.requiresPurchaseAmount && (activeTab === 'Agregar' || activeTab === 'Aplicar') && normalizedType !== 'reward') {
      // Get discount/cashback info from balance - handle different API field names
      const discountLevel = balance.discountLevel ?? balance.discountPercentage ?? null;
      const cashbackPercent = balance.cashbackPercent ?? balance.cashbackPercentage ?? null;
      const discountAmount = balance.discountAmount ?? 0;
      const totalTransactions = balance.transactionsAmount ?? discountAmount;
      
      // Determine tier status based on discount percentage
      const getTierStatus = (percentage) => {
        if (!percentage) return null;
        if (percentage >= 10) return { name: 'Oro', color: '#FFD700' };
        if (percentage >= 5) return { name: 'Plata', color: '#C0C0C0' };
        return { name: 'Bronce', color: '#CD7F32' };
      };
      const tierStatus = getTierStatus(discountLevel);
      
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
            <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
              <span className="text-5xl sm:text-6xl font-mono font-bold gradient-text">
                {discountLevel}%
              </span>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">Nivel de descuento</p>
              {tierStatus && (
                <div className="mt-2">
                  <span 
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: tierStatus.color }}
                  >
                    Estado: {tierStatus.name}
                  </span>
                </div>
              )}
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
              Ingrese el monto de compra ({currencyInfo.code})
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
            onClick={() => openConfirmation(activeTab)}
            disabled={loading || !purchaseAmount}
            className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary disabled:opacity-50"
            data-testid="add-points-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionConfig.label}
          </Button>
        </div>
      );
    }

    // For reward card "Agregar" tab - special handling for points calculation
    if (normalizedType === 'reward' && activeTab === 'Agregar') {
      const bonusBalance = balance.bonusBalance || 0;
      const availableRewardTiers = card.availableRewardTiers || [];
      
      // Find the next reward tier threshold
      const nextRewardThreshold = availableRewardTiers.length > 0 
        ? availableRewardTiers.find(t => t.threshold > bonusBalance)?.threshold || 'Max'
        : null;
      
      return (
        <div className="space-y-4 sm:space-y-6">
          {/* Current points balance display */}
          <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
            <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
              {bonusBalance}
            </span>
            <p className="text-xs sm:text-sm text-zinc-500 mt-2">Puntos acumulados</p>
            {nextRewardThreshold && nextRewardThreshold !== 'Max' && (
              <p className="text-xs text-zinc-400 mt-1">
                Siguiente recompensa a los {nextRewardThreshold} puntos
              </p>
            )}
          </div>
          
          {/* Purchase amount input for reward card */}
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Monto de compra ({currencyInfo.code})
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
              <Input
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="0"
                className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                data-testid="reward-purchase-amount"
              />
            </div>
          </div>
          
          {/* Points to add - based on purchase amount */}
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Puntos a agregar
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
                data-testid="reward-points-input"
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
          
          <Button
            onClick={() => openConfirmation('Agregar')}
            disabled={loading || actionAmount < 1}
            className="w-full h-12 sm:h-14 text-base sm:text-lg btn-primary disabled:opacity-50"
            data-testid="add-reward-points-button"
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
        availableLabel = 'Balance Total';
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
              {(normalizedType === 'cashback' || normalizedType === 'cashback_card' ||
                normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card')
                ? formatCurrency(availableAmount)
                : availableAmount}
            </span>
            <p className="text-xs sm:text-sm text-zinc-500 mt-2">
              {availableLabel}
            </p>
          </div>
          
          {/* Amount input - currency style for cashback/gift, counter style for others */}
          {(normalizedType === 'cashback' || normalizedType === 'cashback_card' ||
            normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card') ? (
            // Currency input style - no +/- buttons, just a clean input with currency symbol
            <div className="card-brutalist">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
                Monto a canjear ({currencyInfo.code})
              </label>
              <div className="relative">
                <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
                <Input
                  type="number"
                  value={actionAmount || ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                    setActionAmount(val === '' ? '' : Math.max(0, Math.min(availableAmount || 999999, val)));
                  }}
                  placeholder="0"
                  min="0"
                  max={availableAmount || 999999}
                  className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                  data-testid="redeem-amount-input"
                />
              </div>
              <p className="text-xs text-zinc-400 mt-2 text-center">
                Máximo disponible: {formatCurrency(availableAmount)}
              </p>
            </div>
          ) : (
            // Counter style for stamps, rewards, visits, etc.
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
          )}
          
          <Button
            onClick={() => openConfirmation(activeTab)}
            disabled={loading || availableAmount <= 0 || (availableAmount > 0 && actionAmount > availableAmount) || !actionAmount || actionAmount < 1}
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
      // Check if coupon is already redeemed
      const isCouponRedeemed = card.couponRedeemed === true;
      
      return (
        <div className="space-y-4 sm:space-y-6">
          <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
            {isCouponRedeemed ? (
              <>
                <div className="status-badge mx-auto mb-4" style={{ backgroundColor: '#6B7280', color: 'white' }}>
                  <X className="h-4 w-4" />
                  <span>Ya Canjeado</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-500">Este cupón ya fue utilizado</p>
              </>
            ) : (
              <>
                <div className="status-badge success mx-auto mb-4">
                  <Check className="h-4 w-4" />
                  <span>Activo</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-500">Este cupón está listo para usar</p>
              </>
            )}
          </div>
          
          {/* Purchase amount input for coupon redemption - only show if not redeemed */}
          {!isCouponRedeemed && (
            <div className="card-brutalist">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
                Monto de compra ({currencyInfo.code})
              </label>
              <div className="relative">
                <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
                <Input
                  type="number"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  placeholder="0"
                  className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                  data-testid="coupon-purchase-amount"
                />
              </div>
            </div>
          )}
          
          <Button
            onClick={() => openConfirmation('Usar')}
            disabled={loading || isCouponRedeemed}
            className={`w-full h-12 sm:h-14 text-base sm:text-lg ${isCouponRedeemed ? 'bg-gray-400 cursor-not-allowed' : 'btn-primary'}`}
            data-testid="use-coupon-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isCouponRedeemed ? 'Cupón Ya Utilizado' : actionConfig.label)}
          </Button>
        </div>
      );
    }

    // Default: simple counter with action (keyboard input enabled)
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Gift card balance display - show current balance */}
        {(normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card') && (
          <div className="text-center p-4 sm:p-6 bg-zinc-50 rounded-xl">
            <span className="text-4xl sm:text-5xl font-mono font-bold gradient-text">
              {formatCurrency(balance.balance || 0)}
            </span>
            <p className="text-xs sm:text-sm text-zinc-500 mt-2">Balance Total</p>
          </div>
        )}
        
        {/* Gift card - currency input style (no +/- buttons) */}
        {(normalizedType === 'certificate' || normalizedType === 'gift' || normalizedType === 'gift_card') ? (
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Monto a agregar ({currencyInfo.code})
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg sm:text-xl">{currencyInfo.symbol}</span>
              <Input
                type="number"
                value={actionAmount || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                  setActionAmount(val === '' ? '' : Math.max(0, val));
                }}
                placeholder="0"
                min="0"
                className="input-brutalist pl-10 sm:pl-12 text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
                data-testid="default-amount-input"
              />
            </div>
          </div>
        ) : normalizedType === 'reward' ? (
          // Reward card - clean number input (no +/- buttons) for adding points
          <div className="card-brutalist">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Cantidad de puntos
            </label>
            <Input
              type="number"
              value={actionAmount || ''}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                setActionAmount(val === '' ? '' : Math.max(0, val));
              }}
              placeholder="0"
              min="0"
              className="input-brutalist text-2xl sm:text-3xl font-mono h-14 sm:h-16 text-center"
              data-testid="default-amount-input"
            />
          </div>
        ) : (
          // Counter style for stamps only (small numbers 1-10)
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
        )}
        
        <Button
          onClick={() => openConfirmation(activeTab)}
          disabled={loading || !actionAmount || actionAmount < 1}
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

        {/* Tabs - Hide for single-tab cards like coupon */}
        {config.tabs.length > 1 && (
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
        )}

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
              {/* Stamp card - use currentNumberOfUses as active stamps */}
              {(cardType === 'stamp' || cardType === 'stamp_card') && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Sellos activos</span>
                  <span className="font-medium text-sm">
                    {balance.currentNumberOfUses ?? 0}
                  </span>
                </div>
              )}
              {/* Non-stamp cards using currentNumberOfUses (visits, etc.) */}
              {(cardType !== 'stamp' && cardType !== 'stamp_card') && (balance.currentNumberOfUses !== undefined && balance.currentNumberOfUses !== null) && (
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
                  <span className="text-zinc-500 text-sm">Porcentaje de cashback</span>
                  <span className="font-medium text-sm">{balance.discountPercentage}%</span>
                </div>
              )}
              {/* Show "Until next level" for cashback cards if tier info available */}
              {(cardType === 'cashback' || cardType === 'cashback_card') && 
               card.nextTierThreshold && balance.discountAmount !== undefined && (
                <div className="flex justify-between p-3 sm:p-4">
                  <span className="text-zinc-500 text-sm">Hasta el siguiente nivel</span>
                  <span className="font-medium text-sm">
                    {formatCurrency((card.nextTierThreshold - (balance.discountAmount / 100)), false)}
                  </span>
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
        requireComments={settings.require_comments !== false}
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
