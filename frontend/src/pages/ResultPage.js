import React, { useState, useEffect, useMemo } from 'react';
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
  CustomerInfoPanel, CardInfoPanel, getCurrentTierInfo
} from '../components/cards';

import { API_BASE_URL as API } from '../config/api';

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
  const [stampsPerVisit, setStampsPerVisit] = useState(1);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [couponBenefit, setCouponBenefit] = useState(null);
  const [pointsRatio, setPointsRatio] = useState(null);
  const [detectedAccrualMode, setDetectedAccrualMode] = useState(null);
  const [detectingMode, setDetectingMode] = useState(false);
  const [needsModeSelection, setNeedsModeSelection] = useState(false);
  const [pendingRewards, setPendingRewards] = useState([]);
  const [loadingPendingRewards, setLoadingPendingRewards] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState(null);
  const [stampConfig, setStampConfig] = useState({ stamp_mode: null, spend_threshold: 10000 });
  const [loadingStampConfig, setLoadingStampConfig] = useState(false);
  const [discountTiers, setDiscountTiers] = useState([]);
  const [tierProgress, setTierProgress] = useState(null);
  const [commentMode, setCommentMode] = useState('open');
  const [giftCardConfig, setGiftCardConfig] = useState({ allow_add: false });
  const [minAmount, setMinAmount] = useState(0);
  const [highAmountThreshold, setHighAmountThreshold] = useState(1000000);

  const currencyInfo = getCurrencyInfo();
  const cardType = card ? normalizeCardType(card.type) : null;
  const rawConfig = cardType ? (CARD_TYPE_CONFIG[cardType] || CARD_TYPE_CONFIG.stamp) : null;

  // Gift cards default to redeem-only — "Agregar" only appears when
  // allow_add is on for that card, with no role exception. The backend
  // enforces this too, so a direct API call can't bypass it either.
  const isGiftCard = cardType === 'gift' || cardType === 'gift_card' || cardType === 'certificate';
  const restrictGiftCardAdd = isGiftCard && !giftCardConfig.allow_add;
  const config = useMemo(() => {
    if (restrictGiftCardAdd && rawConfig) {
      return { ...rawConfig, tabs: rawConfig.tabs.filter((t) => t !== 'Agregar') };
    }
    return rawConfig;
  }, [rawConfig, restrictGiftCardAdd]);

  // Set initial tab
  useEffect(() => {
    if (config && config.tabs && config.tabs.length > 0) setActiveTab(config.tabs[0]);
  }, [cardType, config]);

  // Fetch template info for stamp cards: reward tiers (only when the card
  // itself doesn't already carry them) and stamps-per-visit, which is
  // always read live from the template — Boomerangme is the source of
  // truth for it, not app-side config.
  useEffect(() => {
    const fetchTemplateInfo = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (normalizedType !== 'stamp' || !card?.templateId) { setStampsPerVisit(1); return; }
      const hasTiersFromCard = card?.availableRewardTiers?.length > 0;
      setLoadingTemplate(true);
      try {
        const response = await axios.get(`${API}/templates/${card.templateId}`);
        if (!hasTiersFromCard && response.data?.template?.rewardTiers) {
          setTemplateRewardTiers(response.data.template.rewardTiers);
        }
        setStampsPerVisit(response.data?.template?.stampsPerVisit || 1);
      } catch { setTemplateRewardTiers([]); setStampsPerVisit(1); }
      finally { setLoadingTemplate(false); }
    };
    if (card) fetchTemplateInfo();
  }, [card, cardType]);

  // Fetch the coupon's benefit description (e.g. "10% OFF") so the operator
  // and the flow can see exactly what the customer is redeeming.
  useEffect(() => {
    const fetchCouponBenefit = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (normalizedType !== 'coupon' || !card?.templateId) { setCouponBenefit(null); return; }
      try {
        const response = await axios.get(`${API}/templates/${card.templateId}`);
        setCouponBenefit(response.data?.template?.benefitDescription || null);
      } catch { setCouponBenefit(null); }
    };
    if (card) fetchCouponBenefit();
  }, [card, cardType]);

  // Fetch the "por compra" points ratio (e.g. ₡1 = 10 puntos) so the operator
  // sees what they're accruing — read live from the template, same source of
  // truth Boomerangme already uses to calculate points on its own end.
  useEffect(() => {
    const fetchPointsRatio = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (normalizedType !== 'reward' || !card?.templateId) { setPointsRatio(null); return; }
      try {
        const response = await axios.get(`${API}/templates/${card.templateId}`);
        setPointsRatio(response.data?.template?.pointsRatio || null);
      } catch { setPointsRatio(null); }
    };
    if (card) fetchPointsRatio();
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
        const templateParam = card?.templateId ? `?template_id=${card.templateId}` : '';
        const configResponse = await axios.get(`${API}/stamp-config${templateParam}`, { headers: { Authorization: `Bearer ${token}` } });
        if (configResponse.data.stamp_mode) {
          setStampConfig({
            stamp_mode: configResponse.data.stamp_mode,
            spend_threshold: configResponse.data.spend_threshold || 10000
          });
        }
      } catch { /* ignore */ }
      finally { setLoadingStampConfig(false); }
    };
    fetchStampConfig();
  }, [card?.id, card?.templateId, cardType]);

  // Load discount tiers
  useEffect(() => {
    const fetchDiscountTiers = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (normalizedType !== 'discount' && normalizedType !== 'cashback') return;
      if (!card?.id) return;
      const token = localStorage.getItem('token');
      try {
        const [tiersResp, progressResp] = await Promise.all([
          axios.get(`${API}/discount-tiers/${normalizedType}`, { params: { template_id: card.templateId }, headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/tier-progress/${card.id}`, { params: { card_type: normalizedType, template_id: card.templateId }, headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (tiersResp.data.tiers) setDiscountTiers(tiersResp.data.tiers);
        if (progressResp.data) setTierProgress(progressResp.data);
      } catch { /* ignore */ }
    };
    fetchDiscountTiers();
  }, [card?.id, card?.templateId, cardType]);

  // Load comment mode (open text vs invoice number) — a single workspace-wide
  // setting, applies the same regardless of card type.
  useEffect(() => {
    const fetchCommentMode = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API}/comment-config`, { headers: { Authorization: `Bearer ${token}` } });
        setCommentMode(response.data?.mode || 'open');
      } catch { setCommentMode('open'); }
    };
    fetchCommentMode();
  }, []);

  // Load gift card "Agregar" toggle
  useEffect(() => {
    const fetchGiftCardConfig = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (!['gift', 'certificate'].includes(normalizedType)) return;
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API}/gift-card-config`, { params: { template_id: card?.templateId }, headers: { Authorization: `Bearer ${token}` } });
        setGiftCardConfig({ allow_add: response.data?.allow_add || false });
      } catch { setGiftCardConfig({ allow_add: false }); }
    };
    fetchGiftCardConfig();
  }, [cardType, card?.templateId]);

  // Load minimum purchase amount for card types where it applies — below this,
  // the scanner blocks accumulation and tells the operator the minimum required.
  useEffect(() => {
    const fetchMinAmount = async () => {
      const normalizedType = cardType ? cardType.replace('_card', '') : '';
      if (!['cashback', 'discount', 'stamp', 'reward'].includes(normalizedType)) { setMinAmount(0); return; }
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API}/min-amount/${normalizedType}`, { params: { template_id: card?.templateId }, headers: { Authorization: `Bearer ${token}` } });
        setMinAmount(response.data?.min_amount || 0);
      } catch { setMinAmount(0); }
    };
    fetchMinAmount();
  }, [cardType, card?.templateId]);

  // Load the amount that triggers a "this looks high, please confirm" warning —
  // a data-entry safety net, not a card-type-specific setting.
  useEffect(() => {
    const fetchHighAmountThreshold = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API}/high-amount-alert-config`, { headers: { Authorization: `Bearer ${token}` } });
        setHighAmountThreshold(response.data?.threshold || 1000000);
      } catch { setHighAmountThreshold(1000000); }
    };
    fetchHighAmountThreshold();
  }, []);

  // Fetch accrual mode for reward cards — a workspace-level setting configured
  // once by Devotio in Config. Tarjetas, not decided per-card by whoever scans
  // it first. needsModeSelection here means "not configured" — the scanner
  // blocks accumulation and points the operator to Devotio, it doesn't let
  // them pick a mode themselves.
  useEffect(() => {
    const fetchAccrualMode = async () => {
      if (!card || cardType !== 'reward') return;
      setDetectingMode(true);
      setNeedsModeSelection(false);
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API}/reward-accrual-config`, { params: { template_id: card?.templateId }, headers: { Authorization: `Bearer ${token}` } });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on card.id, not the whole card object, to avoid refetching on unrelated field changes
  }, [card?.id, cardType]);

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
      else if (stampMode === 'visit') details.push({ label: 'Sellos', value: `${stampsPerVisit} (por visita)` });
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
    const purchaseVal = parseFloat(purchaseAmount) || 0;
    const warning = highAmountThreshold > 0 && purchaseVal >= highAmountThreshold
      ? `El monto ingresado (${formatCurrency(purchaseVal)}) es inusualmente alto. Verifique que sea correcto antes de confirmar.`
      : null;
    setConfirmModal({ open: true, action, details, purchaseAmount: shouldIncludePurchaseAmount ? purchaseAmount : '', rewardTier, warning });
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
        if (minAmount > 0 && amount < minAmount) {
          toast.error(`El monto mínimo es ${formatCurrency(minAmount)} — no aplica para acumular`);
          setLoading(false);
          return;
        }
        const progressResponse = await axios.post(`${API}/stamp-progress/${card.id}/add`, {}, { params: { amount, template_id: card.templateId }, headers: { Authorization: `Bearer ${token}` } });
        const { stamps_to_add, threshold } = progressResponse.data;

        if (stamps_to_add > 0) {
          const comment_with_gerente = gerente_name ? `[Gerente: ${gerente_name}] ${comment || ''}`.trim() : (comment || '');
          const apiResponse = await axios.post(`${API}/cards/${card.id}/add-stamp`, {
            amount: stamps_to_add, comment: comment_with_gerente, purchaseSum: amount, gerente: gerente_name
          }, { headers: { Authorization: `Bearer ${token}` } });

          if (apiResponse.data.success) {
            setCard(apiResponse.data.card);
            triggerVibration(); triggerBeep();
            const rewardsMsg = apiResponse.data.new_rewards_earned ? ` ¡${apiResponse.data.new_rewards_earned} recompensa(s) ganada(s)!` : '';
            setSuccessModal({ open: true, message: `${stamps_to_add} sello(s) agregado(s) exitosamente.${rewardsMsg}` });
          }
        } else {
          triggerVibration();
          setSuccessModal({ open: true, message: `Compra de ${formatCurrency(amount)} registrada. No alcanza el monto para sumar un sello (se requieren ${formatCurrency(threshold)} por sello; el resto no se acumula).` });
        }
        setConfirmModal({ open: false, action: null, details: [], purchaseAmount: '' });
        setLoading(false);
        return;
      }
      
      // STAMP CARD VISIT MODE
      if (normalizedType === 'stamp' && actionKey === 'agregar' && stampConfig.stamp_mode === 'visit') {
        const visitPurchaseVal = parseFloat(confirmPurchaseAmount || purchaseAmount) || 0;
        if (minAmount > 0 && visitPurchaseVal < minAmount) {
          toast.error(`El monto mínimo es ${formatCurrency(minAmount)} — no aplica para acumular`);
          setLoading(false);
          return;
        }
        const apiResponse = await axios.post(`${API}/cards/${card.id}/add-stamp`, {
          amount: stampsPerVisit, comment: comment || '', purchaseSum: visitPurchaseVal, gerente: gerente_name
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

      if ((actionKey === 'agregar' || actionKey === 'aplicar') && ['cashback', 'discount'].includes(normalizedType)) {
        if (discountTiers.length === 0) {
          toast.error('Este tipo de tarjeta no tiene niveles configurados — contacte a Devotio');
          setLoading(false);
          return;
        }
        if (minAmount > 0 && purchaseVal < minAmount) {
          toast.error(normalizedType === 'cashback'
            ? `El monto mínimo es ${formatCurrency(minAmount)} — no aplica para acumular`
            : `Montos menores a ${formatCurrency(minAmount)} no aplican`);
          setLoading(false);
          return;
        }
      }
      // Manual-mode stamps (spend/visit modes already returned above) — the
      // minimum-purchase block previously only applied to spend mode.
      if (actionKey === 'agregar' && normalizedType === 'stamp' && minAmount > 0 && purchaseVal < minAmount) {
        toast.error(`El monto mínimo es ${formatCurrency(minAmount)} — no aplica para acumular`);
        setLoading(false);
        return;
      }
      // Puntos — applies across all three accrual modes (spend/visit/manual),
      // same treatment as Sellos: a purchase amount is collected in every mode.
      if (actionKey === 'agregar' && normalizedType === 'reward' && minAmount > 0 && purchaseVal < minAmount) {
        toast.error(`El monto mínimo es ${formatCurrency(minAmount)} — no aplica para acumular`);
        setLoading(false);
        return;
      }
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
      } else if ((actionKey === 'agregar' || actionKey === 'aplicar') && (normalizedType === 'cashback' || normalizedType === 'discount')) {
        // Send the raw purchase amount, not a pre-computed discount — Boomerangme
        // applies its own configured tier percentage server-side (this mirrors what
        // its native app does). Sending our own pre-computed discount here made
        // Boomerangme apply the percentage a second time on top of it, and also
        // under-counted the card's real cumulative purchase volume (the figure its
        // own tier thresholds are based on). pointsToAdd is kept only to show the
        // operator what's being applied and to log it in our own history.
        const tierInfo = getCurrentTierInfo(discountTiers, tierProgress, balance);
        const pointsToAdd = purchaseVal * ((tierInfo.percentage || 0) / 100);
        endpoint = `${API}/cards/${card.id}/add-point`;
        payload = { ...basePayload, amount: purchaseVal, purchaseSum: purchaseVal, logAmount: pointsToAdd };
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
            const tpResp = await axios.post(`${API}/tier-progress/${card.id}/add`, {}, { params: { amount: purchaseVal, card_type: normalizedType, template_id: card.templateId }, headers: { Authorization: `Bearer ${token}` } });
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
    const commonProps = { balance, purchaseAmount, setPurchaseAmount, actionAmount, setActionAmount, loading, openConfirmation, formatCurrency, currencyInfo, minAmount };

    // Stamp Agregar
    if (normalizedType === 'stamp' && activeTab === 'Agregar') {
      const stampRewardTiers = card?.availableRewardTiers?.length > 0 ? card.availableRewardTiers : templateRewardTiers;
      return <StampAddAction {...commonProps} stampConfig={stampConfig} stampRewardTiers={stampRewardTiers} stampsPerVisit={stampsPerVisit} />;
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
      return <RewardAddAction {...commonProps} card={card} detectedAccrualMode={detectedAccrualMode} detectingMode={detectingMode} needsModeSelection={needsModeSelection} pointsRatio={pointsRatio} actionConfig={actionConfig} />;
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
      return <CouponAction card={card} benefitDescription={couponBenefit} purchaseAmount={purchaseAmount} setPurchaseAmount={setPurchaseAmount} loading={loading} openConfirmation={openConfirmation} currencyInfo={currencyInfo} actionConfig={actionConfig} />;
    }
    // Default (gift card Agregar, etc.)
    return <DefaultAddAction {...commonProps} cardType={cardType} activeTab={activeTab} actionConfig={actionConfig} />;
  };

  // ============ MAIN RENDER ============
  return (
    <div className="min-h-screen bg-white" data-testid="result-page">
      <header className="nav-header">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 sm:gap-2 p-2 hover:bg-[#5B7CF7] hover:text-white rounded-lg transition-colors" data-testid="back-button">
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
          <div className="flex border rounded-xl mb-4 sm:mb-6 overflow-hidden" style={{ borderColor: '#0B0B16' }}>
            {config.tabs.map((tab) => (
              <button key={tab} onClick={() => { setActiveTab(tab); setActionAmount(1); }}
                className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-colors ${activeTab === tab ? 'bg-[#5B7CF7] text-white hover:bg-[#ffca32] hover:text-[#0B0B16]' : 'bg-white text-[#0B0B16] hover:bg-[#5B7CF7] hover:text-white'}`}
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
        commentMode={commentMode}
        warning={confirmModal.warning}
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
