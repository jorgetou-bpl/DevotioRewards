import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowLeft, AlertCircle } from 'lucide-react';

import { CARD_TYPE_CONFIG, normalizeCardType } from '../config/cardTypes';
import { ConfirmationModal, SuccessModal } from '../components/modals';
import {
  StampAddAction, StampRedeemAction, MembershipAction,
  MultipassVisitsAction, MultipassPointsAction, DiscountCashbackAction,
  RewardAddAction, RewardRedeemAction, CouponAction,
  GenericRedeemAction, DefaultAddAction,
  CustomerInfoPanel, CardInfoPanel
} from '../components/cards';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { triggerVibration, triggerBeep, formatCurrency, getCurrencyInfo, settings } = useSettings();
  const { user } = useAuth();
  
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
  const [detectedAccrualMode, setDetectedAccrualMode] = useState(null);
  const [detectingMode, setDetectingMode] = useState(false);
  const [needsModeSelection, setNeedsModeSelection] = useState(false);
  const [pendingRewards, setPendingRewards] = useState([]);
  const [loadingPendingRewards, setLoadingPendingRewards] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState(null);
  const [stampConfig, setStampConfig] = useState({ stamp_mode: null, spend_threshold: 10000 });
  const [stampProgress, setStampProgress] = useState({ accumulated_amount: 0, threshold: 10000, progress_percent: 0 });
  const [loadingStampConfig, setLoadingStampConfig] = useState(false);
  const [discountTiers, setDiscountTiers] = useState([]);
  const [tierProgress, setTierProgress] = useState(null);

  const currencyInfo = getCurrencyInfo();
  const cardType = card ? normalizeCardType(card.type) : null;
  const config = cardType ? (CARD_TYPE_CONFIG[cardType] || CARD_TYPE_CONFIG.stamp) : null;

  // Set initial tab
  useEffect(() => {
    if (config && config.tabs && config.tabs.length > 0) setActiveTab(config.tabs[0]);
  }, [cardType, config]);

  // Fetch template reward tiers for stamp cards
  useEffect(() => {
    const fetchTemplateRewardTiers = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      const hasUnusedRewards = card?.balance?.numberRewardsUnused > 0;
      const hasTemplateId = card?.templateId;
      const hasNoTiersFromCard = !card?.availableRewardTiers || card.availableRewardTiers.length === 0;
      if (normalizedType === 'stamp' && hasUnusedRewards && hasTemplateId && hasNoTiersFromCard) {
        setLoadingTemplate(true);
        try {
          const response = await axios.get(`${API}/templates/${card.templateId}`);
          if (response.data?.template?.rewardTiers) setTemplateRewardTiers(response.data.template.rewardTiers);
        } catch { setTemplateRewardTiers([]); }
        finally { setLoadingTemplate(false); }
      }
    };
    if (card) fetchTemplateRewardTiers();
  }, [card, cardType]);

  // Fetch pending rewards for stamp Canjear tab
  useEffect(() => {
    const fetchPendingRewards = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (normalizedType === 'stamp' && activeTab === 'Canjear' && card?.id) {
        setLoadingPendingRewards(true);
        try {
          const response = await axios.get(`${API}/cards/${card.id}/pending-rewards`);
          if (response.data?.pending_rewards) {
            setPendingRewards(response.data.pending_rewards);
            if (response.data.pending_rewards.length > 0 && !selectedRewardId) {
              setSelectedRewardId(response.data.pending_rewards[0].id);
            }
          }
        } catch { setPendingRewards([]); }
        finally { setLoadingPendingRewards(false); }
      }
    };
    fetchPendingRewards();
  }, [card, cardType, activeTab, selectedRewardId]);

  // Load stamp config
  useEffect(() => {
    const fetchStampConfig = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (normalizedType !== 'stamp' || !card?.id) return;
      setLoadingStampConfig(true);
      const token = localStorage.getItem('token');
      try {
        const configResponse = await axios.get(`${API}/stamp-config`, { headers: { Authorization: `Bearer ${token}` } });
        if (configResponse.data.stamp_mode) {
          setStampConfig({ stamp_mode: configResponse.data.stamp_mode, spend_threshold: configResponse.data.spend_threshold || 10000 });
        }
        if (configResponse.data.stamp_mode === 'spend') {
          const progressResponse = await axios.get(`${API}/stamp-progress/${card.id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (progressResponse.data) {
            setStampProgress({
              accumulated_amount: progressResponse.data.accumulated_amount || 0,
              threshold: progressResponse.data.threshold || 10000,
              progress_percent: progressResponse.data.progress_percent || 0
            });
          }
        }
      } catch { /* ignore */ }
      finally { setLoadingStampConfig(false); }
    };
    fetchStampConfig();
  }, [card?.id, cardType]);

  // Load discount tiers
  useEffect(() => {
    const fetchDiscountTiers = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (normalizedType !== 'discount' && normalizedType !== 'cashback') return;
      if (!card?.id) return;
      const token = localStorage.getItem('token');
      try {
        const [tiersResp, progressResp] = await Promise.all([
          axios.get(`${API}/discount-tiers`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/tier-progress/${card.id}`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (tiersResp.data.tiers) setDiscountTiers(tiersResp.data.tiers);
        if (progressResp.data) setTierProgress(progressResp.data);
      } catch { /* ignore */ }
    };
    fetchDiscountTiers();
  }, [card?.id, cardType]);

  // Fetch accrual mode for reward cards
  useEffect(() => {
    const fetchAccrualMode = async () => {
      if (!card || cardType !== 'reward' || !card.id) return;
      setDetectingMode(true);
      setNeedsModeSelection(false);
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API}/cards/${card.id}/accrual-mode`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.data.success && response.data.mode) {
          setDetectedAccrualMode(response.data.mode);
          setNeedsModeSelection(false);
        } else {
          setDetectedAccrualMode(null);
          setNeedsModeSelection(true);
        }
      } catch {
        setDetectedAccrualMode(null);
        setNeedsModeSelection(true);
      } finally { setDetectingMode(false); }
    };
    fetchAccrualMode();
  }, [card?.id, cardType]);

  const saveAccrualMode = async (mode) => {
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API}/cards/${card.id}/accrual-mode`, { mode }, { headers: { Authorization: `Bearer ${token}` } });
      setDetectedAccrualMode(mode);
      setNeedsModeSelection(false);
      toast.success(`Modo "${mode === 'spend' ? 'Por Compra' : mode === 'visit' ? 'Por Visita' : 'Manual'}" configurado para esta tarjeta`);
    } catch {
      toast.error('Error al guardar el modo de acumulación');
    }
  };

  if (!card) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-zinc-300" />
          <h2 className="text-heading text-xl sm:text-2xl mb-2">Sin Datos de Tarjeta</h2>
          <p className="text-zinc-500 text-sm mb-6">Por favor escanea una tarjeta primero</p>
          <Button onClick={() => navigate('/')} className="h-10 sm:h-12 btn-primary px-6 sm:px-8" data-testid="back-to-scanner">
            Volver al Escáner
          </Button>
        </div>
      </div>
    );
  }

  const balance = card.balance || {};
  const CardIcon = config.icon;

  // ============ CONFIRMATION LOGIC ============
  const openConfirmation = (action, rewardTier = null) => {
    const details = [];
    const actionLower = action.toLowerCase();
    const normalizedType = cardType ? cardType.replace('_card', '') : '';
    
    details.push({ label: 'ID de Tarjeta', value: card.id });
    
    if (actionLower === 'agregar' && normalizedType === 'stamp') {
      if (purchaseAmount) details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
      const stampMode = stampConfig.stamp_mode;
      if (stampMode === 'spend') details.push({ label: 'Modo', value: `Por Compra (1 sello cada ${formatCurrency(stampConfig.spend_threshold)})` });
      else if (stampMode === 'visit') details.push({ label: 'Sellos', value: '1 (por visita)' });
      else details.push({ label: 'Cantidad de Sellos', value: actionAmount });
    } else if (actionLower === 'agregar' && normalizedType === 'reward') {
      if (detectedAccrualMode === 'spend') {
        details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
      } else if (detectedAccrualMode === 'visit') {
        details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
        details.push({ label: 'Visitas a Agregar', value: actionAmount });
      } else if (detectedAccrualMode === 'points') {
        details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
        details.push({ label: 'Puntos a Agregar', value: actionAmount });
      }
    } else if (actionLower === 'agregar' && config.requiresPurchaseAmount) {
      details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
    } else if (actionLower === 'agregar') {
      details.push({ label: 'Cantidad', value: actionAmount });
    } else if (actionLower === 'canjear') {
      if (rewardTier) {
        details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
        details.push({ label: 'Recompensa', value: rewardTier.name });
        details.push({ label: 'Puntos requeridos', value: rewardTier.threshold });
      } else {
        details.push({ label: 'Cantidad a Canjear', value: actionAmount });
      }
    } else if (actionLower === 'agregarvisitas') {
      details.push({ label: 'Visitas a Agregar', value: actionAmount });
      if (purchaseAmount) details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
    } else if (actionLower === 'canjearvisitas') {
      details.push({ label: 'Visitas a Canjear', value: actionAmount });
      if (purchaseAmount) details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
    } else if (actionLower === 'agregarpuntos') {
      details.push({ label: 'Puntos a Agregar', value: actionAmount });
    } else if (actionLower === 'canjearpuntos') {
      details.push({ label: 'Puntos a Canjear', value: actionAmount });
    }
    if (actionLower === 'usar') {
      details.push({ label: 'Estado del Cupón', value: 'Activo' });
      if (purchaseAmount) details.push({ label: 'Monto de Compra', value: formatCurrency(parseFloat(purchaseAmount) || 0) });
    }
    
    const shouldIncludePurchaseAmount = config.requiresPurchaseAmount || normalizedType === 'stamp' || normalizedType === 'coupon';
    setConfirmModal({ open: true, action, details, purchaseAmount: shouldIncludePurchaseAmount ? purchaseAmount : '', rewardTier });
  };

  // ============ HANDLE ACTION (Transaction Logic) ============
  const handleAction = async (comment = '', confirmPurchaseAmount = '') => {
    const action = confirmModal.action;
    const rewardTier = confirmModal.rewardTier;
    const normalizedType = cardType ? cardType.replace('_card', '') : '';
    setLoading(true);
    
    try {
      const actionKey = action.toLowerCase();
      const token = localStorage.getItem('token');
      const gerente_name = user?.name || '';
      
      // STAMP CARD SPEND MODE
      if (normalizedType === 'stamp' && actionKey === 'agregar' && stampConfig.stamp_mode === 'spend') {
        const amount = parseFloat(confirmPurchaseAmount || purchaseAmount) || 0;
        if (amount <= 0) { toast.error('El monto de compra debe ser mayor a 0'); setLoading(false); return; }
        const progressResponse = await axios.post(`${API}/stamp-progress/${card.id}/add?amount=${amount}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        const { stamps_to_add, accumulated_amount, threshold, progress_percent } = progressResponse.data;
        
        if (stamps_to_add > 0) {
          const comment_with_gerente = gerente_name ? `[Gerente: ${gerente_name}] ${comment || ''}`.trim() : (comment || '');
          const stampPayload = { stamps: stamps_to_add, comment: comment_with_gerente, purchaseSum: threshold * stamps_to_add };
          const apiResponse = await axios.post(`${API}/cards/${card.id}/add-stamp`, {
            amount: stamps_to_add, comment: comment || '', purchaseSum: threshold * stamps_to_add, gerente: gerente_name
          }, { headers: { Authorization: `Bearer ${token}` } });
          
          if (apiResponse.data.success) {
            setCard(apiResponse.data.card);
            setStampProgress({ accumulated_amount, threshold, progress_percent });
            triggerVibration(); triggerBeep();
            const rewardsMsg = apiResponse.data.new_rewards_earned ? ` ¡${apiResponse.data.new_rewards_earned} recompensa(s) ganada(s)!` : '';
            setSuccessModal({ open: true, message: `${stamps_to_add} sello(s) agregado(s) exitosamente.${rewardsMsg} Progreso: ${formatCurrency(accumulated_amount)} de ${formatCurrency(threshold)}` });
          }
        } else {
          setStampProgress({ accumulated_amount, threshold, progress_percent });
          triggerVibration();
          setSuccessModal({ open: true, message: `Compra de ${formatCurrency(amount)} registrada. Progreso: ${formatCurrency(accumulated_amount)} de ${formatCurrency(threshold)} (${progress_percent}%)` });
        }
        setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' });
        setLoading(false);
        return;
      }
      
      // STAMP CARD VISIT MODE
      if (normalizedType === 'stamp' && actionKey === 'agregar' && stampConfig.stamp_mode === 'visit') {
        const apiResponse = await axios.post(`${API}/cards/${card.id}/add-stamp`, {
          amount: 1, comment: comment || '', purchaseSum: parseFloat(confirmPurchaseAmount || purchaseAmount) || 0, gerente: gerente_name
        }, { headers: { Authorization: `Bearer ${token}` } });
        if (apiResponse.data.success) {
          setCard(apiResponse.data.card);
          triggerVibration(); triggerBeep();
          const rewardsMsg = apiResponse.data.new_rewards_earned ? ` ¡${apiResponse.data.new_rewards_earned} recompensa(s) ganada(s)!` : '';
          setSuccessModal({ open: true, message: `Visita registrada exitosamente.${rewardsMsg}` });
        }
        setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' });
        setLoading(false);
        return;
      }

      // Standard actions
      let endpoint, payload;
      const basePayload = { amount: actionAmount, comment: comment || '', gerente: gerente_name };
      const purchaseVal = parseFloat(confirmPurchaseAmount || purchaseAmount) || 0;
      if (purchaseVal > 0) basePayload.purchaseSum = purchaseVal;
      
      if (normalizedType === 'stamp' && actionKey === 'agregar') {
        endpoint = `${API}/cards/${card.id}/add-stamp`;
        payload = { ...basePayload };
      } else if (normalizedType === 'stamp' && actionKey === 'canjear') {
        endpoint = `${API}/cards/${card.id}/subtract-reward`;
        payload = { ...basePayload, amount: 1 };
        if (selectedRewardId) { payload.reward_id = selectedRewardId; }
        if (purchaseVal > 0) payload.purchaseSum = purchaseVal;
      } else if (actionKey === 'canjear' && normalizedType === 'reward') {
        endpoint = `${API}/cards/${card.id}/receive-reward`;
        payload = { ...basePayload, amount: rewardTier?.id || actionAmount };
        if (rewardTier) payload.reward_value = rewardTier.value;
      } else if (actionKey === 'agregar' && normalizedType === 'reward') {
        if (detectedAccrualMode === 'spend') {
          endpoint = `${API}/cards/${card.id}/add-purchase`;
          payload = { ...basePayload, amount: purchaseVal, purchaseSum: purchaseVal };
        } else if (detectedAccrualMode === 'visit') {
          endpoint = `${API}/cards/${card.id}/add-visit-reward`;
          payload = { ...basePayload, amount: actionAmount || 1, purchaseSum: purchaseVal };
        } else {
          endpoint = `${API}/cards/${card.id}/add-scores`;
          payload = { ...basePayload, purchaseSum: purchaseVal };
        }
      } else if (actionKey === 'agregarvisitas') {
        endpoint = `${API}/cards/${card.id}/add-visit`;
        payload = { ...basePayload };
      } else if (actionKey === 'canjearvisitas') {
        endpoint = `${API}/cards/${card.id}/subtract-visit`;
        payload = { ...basePayload };
      } else if (actionKey === 'agregarpuntos') {
        endpoint = `${API}/cards/${card.id}/add-scores`;
        payload = { ...basePayload };
      } else if (actionKey === 'canjearpuntos') {
        endpoint = `${API}/cards/${card.id}/subtract-scores`;
        payload = { ...basePayload };
      } else if (actionKey === 'usar') {
        endpoint = `${API}/cards/${card.id}/use-coupon`;
        payload = { ...basePayload, amount: 1 };
      } else {
        const tabConfig = config.actions[activeTab.toLowerCase()];
        if (!tabConfig) throw new Error('No action config found');
        endpoint = `${API}/cards/${card.id}/${tabConfig.endpoint}`;
        payload = { ...basePayload };
      }
      
      const response = await axios.post(endpoint, payload, { headers: { Authorization: `Bearer ${token}` } });
      
      if (response.data.success) {
        setCard(response.data.card);
        triggerVibration(); triggerBeep();
        
        // Update tier progress for discount/cashback
        if (['discount', 'cashback'].includes(normalizedType) && purchaseVal > 0) {
          try {
            const tpResp = await axios.post(`${API}/tier-progress/${card.id}/add?amount=${purchaseVal}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (tpResp.data) setTierProgress(tpResp.data);
          } catch { /* ignore */ }
        }
        
        const rewardsMsg = response.data.new_rewards_earned ? ` ¡${response.data.new_rewards_earned} recompensa(s) ganada(s)!` : '';
        setSuccessModal({ open: true, message: `${response.data.message || 'Operación exitosa'}${rewardsMsg}` });
      }
      setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' });
    } catch (error) {
      let message = 'Ocurrió un error. Inténtelo de nuevo.';
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string') message = detail;
      else if (detail?.msg) message = detail.msg;
      toast.error(message);
      setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' });
    } finally {
      setLoading(false);
    }
  };

  // ============ RENDER ACTION TAB ============
  const renderActionTab = () => {
    const tabLower = activeTab.toLowerCase();
    const actionConfig = config.actions[tabLower];
    if (!actionConfig) return null;
    const normalizedType = cardType.replace('_card', '');
    const commonProps = { balance, purchaseAmount, setPurchaseAmount, actionAmount, setActionAmount, loading, openConfirmation, formatCurrency, currencyInfo };

    // Stamp Agregar
    if (normalizedType === 'stamp' && activeTab === 'Agregar') {
      return <StampAddAction {...commonProps} stampConfig={stampConfig} stampProgress={stampProgress} />;
    }
    // Stamp Canjear
    if (normalizedType === 'stamp' && activeTab === 'Canjear') {
      return <StampRedeemAction {...commonProps} pendingRewards={pendingRewards} loadingPendingRewards={loadingPendingRewards} selectedRewardId={selectedRewardId} setSelectedRewardId={setSelectedRewardId} />;
    }
    // Membership
    if (normalizedType === 'membership') {
      return <MembershipAction {...commonProps} card={card} />;
    }
    // Multipass Visitas
    if ((normalizedType === 'multipass' || normalizedType === 'subscription') && activeTab === 'Visitas') {
      return <MultipassVisitsAction {...commonProps} />;
    }
    // Multipass Puntos
    if ((normalizedType === 'multipass' || normalizedType === 'subscription') && activeTab === 'Puntos') {
      return <MultipassPointsAction {...commonProps} />;
    }
    // Discount/Cashback Agregar
    if (config.requiresPurchaseAmount && (activeTab === 'Agregar' || activeTab === 'Aplicar') && normalizedType !== 'reward') {
      return <DiscountCashbackAction {...commonProps} cardType={cardType} discountTiers={discountTiers} tierProgress={tierProgress} activeTab={activeTab} actionConfig={actionConfig} />;
    }
    // Reward Agregar
    if (normalizedType === 'reward' && activeTab === 'Agregar') {
      return <RewardAddAction {...commonProps} card={card} detectedAccrualMode={detectedAccrualMode} detectingMode={detectingMode} needsModeSelection={needsModeSelection} saveAccrualMode={saveAccrualMode} actionConfig={actionConfig} />;
    }
    // Reward Canjear
    if (normalizedType === 'reward' && activeTab === 'Canjear') {
      return <RewardRedeemAction {...commonProps} card={card} />;
    }
    // Generic Canjear/Puntos (cashback, gift, etc.)
    if (activeTab === 'Canjear' || activeTab === 'Puntos') {
      return <GenericRedeemAction {...commonProps} cardType={cardType} activeTab={activeTab} actionConfig={actionConfig} />;
    }
    // Coupon
    if (activeTab === 'Usar') {
      return <CouponAction card={card} purchaseAmount={purchaseAmount} setPurchaseAmount={setPurchaseAmount} loading={loading} openConfirmation={openConfirmation} currencyInfo={currencyInfo} actionConfig={actionConfig} />;
    }
    // Default (gift card Agregar, etc.)
    return <DefaultAddAction cardType={cardType} balance={balance} actionAmount={actionAmount} setActionAmount={setActionAmount} loading={loading} openConfirmation={openConfirmation} activeTab={activeTab} formatCurrency={formatCurrency} currencyInfo={currencyInfo} actionConfig={actionConfig} />;
  };

  // ============ MAIN RENDER ============
  return (
    <div className="min-h-screen bg-white" data-testid="result-page">
      <header className="nav-header">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 sm:gap-2 p-2 hover:bg-[#ee478a] hover:text-white rounded-lg transition-colors" data-testid="back-button">
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium hidden sm:inline">Volver</span>
        </button>
        <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-md mx-auto p-4 sm:p-6 pb-20 sm:pb-24">
        <div className="customer-id-banner mb-3 sm:mb-4" data-testid="card-type-banner">
          <div className="flex items-center justify-center gap-2">
            <CardIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            <p className="font-semibold text-sm sm:text-lg uppercase tracking-wider">{config.name}</p>
          </div>
        </div>

        {cardType !== 'membership' && (
          <div className="text-center mb-4 sm:mb-6">
            <p className="text-xs sm:text-sm text-zinc-500">Cliente:</p>
            <h2 className="text-heading text-xl sm:text-2xl" data-testid="customer-display-name">
              {card.customer?.firstName || 'N/A'} {card.customer?.surname || ''}
            </h2>
          </div>
        )}

        {config.tabs.length > 1 && (
          <div className="flex border rounded-xl mb-4 sm:mb-6 overflow-hidden" style={{ borderColor: '#120627' }}>
            {config.tabs.map((tab) => (
              <button key={tab} onClick={() => { setActiveTab(tab); setActionAmount(1); }}
                className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-colors ${activeTab === tab ? 'bg-[#120627] text-white hover:bg-[#ffca32] hover:text-[#120627]' : 'bg-white text-[#120627] hover:bg-[#ee478a] hover:text-white'}`}
                data-testid={`tab-${tab.toLowerCase()}`}>
                {tab}
              </button>
            ))}
          </div>
        )}

        <div className="mb-4 sm:mb-6">{renderActionTab()}</div>

        <CustomerInfoPanel card={card} show={showCustomerInfo} onToggle={() => setShowCustomerInfo(!showCustomerInfo)} />
        <CardInfoPanel card={card} cardType={cardType} balance={balance} show={showCardInfo} onToggle={() => setShowCardInfo(!showCardInfo)} formatCurrency={formatCurrency} discountTiers={discountTiers} tierProgress={tierProgress} />

        <Button onClick={() => navigate('/')} variant="outline" className="w-full h-10 sm:h-12 btn-secondary text-sm sm:text-base" data-testid="scan-another-button">
          Escanear Otra Tarjeta
        </Button>
      </main>

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

      <SuccessModal
        isOpen={successModal.open}
        onClose={() => { setSuccessModal({ open: false, message: '' }); navigate('/'); }}
        message={successModal.message}
      />
    </div>
  );
};

export default ResultPage;
