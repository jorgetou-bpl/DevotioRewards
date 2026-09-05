import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  ArrowLeft, Building2, Users, MapPin, Key, Plus, Trash2, Loader2, Save,
  Eye, EyeOff, UserPlus, Activity, ChevronDown, ChevronUp, RefreshCw,
  Settings, Stamp, Percent, Gift, MessageSquare, DollarSign, AlertTriangle, Star, Search, Copy, Check, Camera
} from 'lucide-react';

import { API_BASE_URL as API } from '../config/api';
import { formatWithThousands, stripThousandsFormatting } from '../components/cards/shared/numberFormat';
import { CURRENCIES } from '../context/SettingsContext';
import { useTemplatedConfig } from '../hooks/useTemplatedConfig';
import { TemplatePicker, TemplateConfigHeader } from '../components/admin/TemplatePicker';

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', bg: 'bg-purple-100', text: 'text-purple-700' },
  workspace_admin: { label: 'Admin', bg: 'bg-blue-100', text: 'text-blue-700' },
  operator: { label: 'Operador', bg: 'bg-zinc-100', text: 'text-zinc-600' }
};

const WorkspaceAdminPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  // Which workspace this page is managing — a super_admin can be sent here
  // to manage a different business than their own (?workspace=<id> from the
  // Super Admin Dashboard); everyone else always manages their own.
  const [targetWorkspaceId, setTargetWorkspaceId] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'operator', location: '' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [locations, setLocations] = useState([]);
  const [savingLocations, setSavingLocations] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [resetModal, setResetModal] = useState({ open: false, user: null });
  const [resetMode, setResetMode] = useState('auto');
  const [manualPassword, setManualPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Card configuration state (Config. Tarjetas tab) — all scoped to targetWorkspaceId
  const [configLoading, setConfigLoading] = useState(true);
  const [stampConfig, setStampConfig] = useState({ stamp_mode: null, spend_threshold: 10000 });
  const [savingStampConfig, setSavingStampConfig] = useState(false);
  const [commentMode, setCommentMode] = useState('open');
  const [savingCommentMode, setSavingCommentMode] = useState(false);
  const [stampTemplates, setStampTemplates] = useState([]);
  const [loadingStampTemplates, setLoadingStampTemplates] = useState(true);
  const [stampConfigOverrides, setStampConfigOverrides] = useState([]);
  const [selectedStampTemplateId, setSelectedStampTemplateId] = useState('');
  const [deletingStampOverride, setDeletingStampOverride] = useState(false);
  // Puntos, Gift Card, and Cashback/Descuento tiers can each be overridden
  // per specific Boomerangme template (not just once per card type) — same
  // pattern piloted with Sellos above.
  const rewardAccrualTpl = useTemplatedConfig({ basePath: '/reward-accrual-config', templateType: 'reward', targetWorkspaceId, active: user?.role === 'super_admin' });
  // "Por Compra" ratio (e.g. ₡1 = 10 puntos) — read-only, sourced live from the
  // selected template itself (mechanics.program.spentValue/earnedValue), same
  // treatment as Sellos' stamps-per-visit: Boomerangme is the source of truth.
  const [rewardTemplateRatio, setRewardTemplateRatio] = useState(null);
  useEffect(() => {
    if (!rewardAccrualTpl.selectedTemplateId) { setRewardTemplateRatio(null); return; }
    const token = localStorage.getItem('token');
    axios.get(`${API}/templates/${rewardAccrualTpl.selectedTemplateId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setRewardTemplateRatio(res.data?.template?.pointsRatio || null))
      .catch(() => setRewardTemplateRatio(null));
  }, [rewardAccrualTpl.selectedTemplateId]);
  const giftCardTpl = useTemplatedConfig({ basePath: '/gift-card-config', templateType: 'certificate', targetWorkspaceId, active: user?.role === 'super_admin' });
  const cashbackTiersTpl = useTemplatedConfig({ basePath: '/discount-tiers/cashback', templateType: 'cashback', targetWorkspaceId, active: user?.role === 'super_admin' });
  const discountTiersTpl = useTemplatedConfig({ basePath: '/discount-tiers/discount', templateType: 'discount', targetWorkspaceId, active: user?.role === 'super_admin' });
  const [cashbackDraftTiers, setCashbackDraftTiers] = useState([]);
  const [discountDraftTiers, setDiscountDraftTiers] = useState([]);
  useEffect(() => { setCashbackDraftTiers(cashbackTiersTpl.currentConfig?.tiers || []); }, [cashbackTiersTpl.currentConfig]);
  useEffect(() => { setDiscountDraftTiers(discountTiersTpl.currentConfig?.tiers || []); }, [discountTiersTpl.currentConfig]);
  // Currency, mandatory comments, and manual search — moved here from the
  // personal Settings page at the client's request: business-wide policy
  // Devotio controls, not something each operator opts into individually.
  const [workspacePrefs, setWorkspacePrefs] = useState({ currency: 'CRC', require_comments: false, enable_manual_search: true, preferred_camera_facing: 'back' });
  const [savingWorkspacePrefs, setSavingWorkspacePrefs] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);

  // Montos tab — visible to workspace_admin too, not Devotio-only, since this
  // is the business's own minimum-purchase and data-entry-safety policy.
  // Each card type can also be overridden per specific template.
  const [amountsLoading, setAmountsLoading] = useState(true);
  const minAmountCashbackTpl = useTemplatedConfig({ basePath: '/min-amount/cashback', templateType: 'cashback', targetWorkspaceId, active: !!targetWorkspaceId });
  const minAmountDiscountTpl = useTemplatedConfig({ basePath: '/min-amount/discount', templateType: 'discount', targetWorkspaceId, active: !!targetWorkspaceId });
  const minAmountStampTpl = useTemplatedConfig({ basePath: '/min-amount/stamp', templateType: 'stamp', targetWorkspaceId, active: !!targetWorkspaceId });
  const minAmountRewardTpl = useTemplatedConfig({ basePath: '/min-amount/reward', templateType: 'reward', targetWorkspaceId, active: !!targetWorkspaceId });
  const minAmountTpls = { cashback: minAmountCashbackTpl, discount: minAmountDiscountTpl, stamp: minAmountStampTpl, reward: minAmountRewardTpl };
  const [minAmountDrafts, setMinAmountDrafts] = useState({ cashback: 0, discount: 0, stamp: 0, reward: 0 });
  useEffect(() => { setMinAmountDrafts((d) => ({ ...d, cashback: minAmountCashbackTpl.currentConfig?.min_amount || 0 })); }, [minAmountCashbackTpl.currentConfig]);
  useEffect(() => { setMinAmountDrafts((d) => ({ ...d, discount: minAmountDiscountTpl.currentConfig?.min_amount || 0 })); }, [minAmountDiscountTpl.currentConfig]);
  useEffect(() => { setMinAmountDrafts((d) => ({ ...d, stamp: minAmountStampTpl.currentConfig?.min_amount || 0 })); }, [minAmountStampTpl.currentConfig]);
  useEffect(() => { setMinAmountDrafts((d) => ({ ...d, reward: minAmountRewardTpl.currentConfig?.min_amount || 0 })); }, [minAmountRewardTpl.currentConfig]);
  const [highAmountThreshold, setHighAmountThreshold] = useState(1000000);
  const [savingHighAmountThreshold, setSavingHighAmountThreshold] = useState(false);

  const fetchWorkspace = useCallback(async (wsId) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get(`${API}/admin/workspaces/${wsId}`, { headers: { Authorization: `Bearer ${token}` } });
      setWorkspace(resp.data.workspace);
      setLocations(resp.data.workspace.locations || []);
    } catch { toast.error('Error al cargar workspace'); }
  }, []);

  const fetchUsers = useCallback(async (wsId) => {
    setLoadingUsers(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get(`${API}/admin/workspaces/${wsId}/users`, { headers: { Authorization: `Bearer ${token}` } });
      setUsers(resp.data.users || []);
    } catch { toast.error('Error al cargar usuarios'); }
    finally { setLoadingUsers(false); }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }
      try {
        const resp = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const userData = resp.data;
        if (!['super_admin', 'workspace_admin'].includes(userData.role)) {
          toast.error('No tiene permisos de administrador');
          navigate('/');
          return;
        }
        setUser(userData);
        const requestedWorkspace = userData.role === 'super_admin' ? searchParams.get('workspace') : null;
        const wsId = requestedWorkspace || userData.workspace_id;
        setTargetWorkspaceId(wsId);
        if (wsId) {
          await fetchWorkspace(wsId);
          await fetchUsers(wsId);
        }
      } catch { navigate('/login'); }
      finally { setLoading(false); }
    };
    checkAuth();
  }, [navigate, fetchWorkspace, fetchUsers, searchParams]);

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) { toast.error('Complete todos los campos requeridos'); return; }
    setCreatingUser(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/workspaces/${targetWorkspaceId}/users`, newUser, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Usuario '${newUser.name}' creado`);
      setNewUser({ email: '', password: '', name: '', role: 'operator', location: '' });
      setShowCreateUser(false);
      await fetchUsers(targetWorkspaceId);
    } catch (error) { toast.error(error.response?.data?.detail || 'Error al crear usuario'); }
    finally { setCreatingUser(false); }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`¿Eliminar a ${userName}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/workspaces/${targetWorkspaceId}/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Usuario eliminado');
      await fetchUsers(targetWorkspaceId);
    } catch (error) { toast.error(error.response?.data?.detail || 'Error al eliminar'); }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/admin/workspaces/${targetWorkspaceId}/users/${userId}/role`, { role: newRole }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Rol actualizado');
      setEditingRole(null);
      await fetchUsers(targetWorkspaceId);
    } catch (error) { toast.error(error.response?.data?.detail || 'Error al actualizar rol'); }
  };

  const handleResetPassword = async () => {
    setResetting(true);
    setResetResult(null);
    const token = localStorage.getItem('token');
    try {
      const payload = {};
      if (resetMode === 'manual' && manualPassword) payload.new_password = manualPassword;
      const resp = await axios.post(`${API}/admin/dashboard/users/${resetModal.user.id}/reset-password`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setResetResult(resp.data);
      toast.success('Contraseña restablecida');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al restablecer contraseña');
    } finally {
      setResetting(false);
    }
  };

  const copyResetPassword = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleSaveApiKey = async () => {
    if (!newApiKey.trim()) { toast.error('Ingrese una API key'); return; }
    setSavingApiKey(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/admin/workspaces/${targetWorkspaceId}`, { boomerangme_api_key: newApiKey }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('API Key actualizada');
      setNewApiKey('');
      await fetchWorkspace(targetWorkspaceId);
    } catch { toast.error('Error al guardar'); }
    finally { setSavingApiKey(false); }
  };

  const handleSaveLocations = async () => {
    if (locations.some(l => !l.name.trim())) { toast.error('Todas las sucursales necesitan un nombre'); return; }
    setSavingLocations(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/admin/workspaces/${targetWorkspaceId}`, { locations }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Sucursales guardadas');
      await fetchWorkspace(targetWorkspaceId);
    } catch { toast.error('Error al guardar'); }
    finally { setSavingLocations(false); }
  };

  // Load card configuration for the target workspace (Devotio-only tab)
  useEffect(() => {
    if (!targetWorkspaceId || user?.role !== 'super_admin') return;
    const token = localStorage.getItem('token');
    const params = { workspace_id: targetWorkspaceId };
    const headers = { Authorization: `Bearer ${token}` };
    setConfigLoading(true);

    Promise.all([
      axios.get(`${API}/stamp-config`, { params, headers }),
      axios.get(`${API}/stamp-config/all`, { params, headers }),
      axios.get(`${API}/comment-config`, { params, headers }),
      axios.get(`${API}/workspace-preferences`, { params, headers })
    ])
      .then(([stampResp, stampAllResp, commentResp, prefsResp]) => {
        if (stampResp.data.stamp_mode) {
          setStampConfig({
            stamp_mode: stampResp.data.stamp_mode,
            spend_threshold: stampResp.data.spend_threshold || 10000
          });
        } else {
          setStampConfig({ stamp_mode: null, spend_threshold: 10000 });
        }
        setStampConfigOverrides(stampAllResp.data.configs || []);
        setCommentMode(commentResp.data.mode || 'open');
        setWorkspacePrefs({
          currency: prefsResp.data.currency || 'CRC',
          require_comments: !!prefsResp.data.require_comments,
          enable_manual_search: prefsResp.data.enable_manual_search !== false,
          preferred_camera_facing: prefsResp.data.preferred_camera_facing || 'back'
        });
      })
      .catch((error) => console.error('Error loading card configuration:', error))
      .finally(() => setConfigLoading(false));
  }, [targetWorkspaceId, user]);

  // Switch the displayed Sellos config when the admin picks a specific
  // template — falls back to the workspace default's values as a starting
  // point when that template has no override of its own yet.
  useEffect(() => {
    const defaultConfig = stampConfigOverrides.find((c) => !c.template_id);
    const specificConfig = selectedStampTemplateId
      ? stampConfigOverrides.find((c) => c.template_id === selectedStampTemplateId)
      : null;
    const source = specificConfig || defaultConfig;
    setStampConfig({
      stamp_mode: source?.stamp_mode || null,
      spend_threshold: source?.spend_threshold || 10000
    });
  }, [selectedStampTemplateId, stampConfigOverrides]);

  const hasStampOverride = selectedStampTemplateId
    ? stampConfigOverrides.some((c) => c.template_id === selectedStampTemplateId)
    : false;

  const handleDeleteStampOverride = async () => {
    if (!selectedStampTemplateId) return;
    setDeletingStampOverride(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/stamp-config/by-template/${selectedStampTemplateId}`, {
        params: { workspace_id: targetWorkspaceId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setStampConfigOverrides((prev) => prev.filter((c) => c.template_id !== selectedStampTemplateId));
      toast.success('Configuración específica eliminada — vuelve a usar el valor por defecto');
    } catch { toast.error('Error al eliminar configuración específica'); }
    finally { setDeletingStampOverride(false); }
  };

  // Reward tier structure for each stamp card, read directly from Boomerangme —
  // this is the source of truth (e.g. rewards at 2 and 5 stamps), not something
  // we duplicate as app-side config. Fetched separately since it hits Boomerangme
  // directly and shouldn't block the rest of the config UI if it's slow or errors.
  useEffect(() => {
    if (!targetWorkspaceId || user?.role !== 'super_admin') return;
    const token = localStorage.getItem('token');
    setLoadingStampTemplates(true);
    axios.get(`${API}/templates/stamp-cards`, {
      params: { workspace_id: targetWorkspaceId },
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((resp) => setStampTemplates(resp.data.templates || []))
      .catch((error) => { console.error('Error loading stamp templates:', error); setStampTemplates([]); })
      .finally(() => setLoadingStampTemplates(false));
  }, [targetWorkspaceId, user]);

  // Montos tab data — available to workspace_admin AND super_admin (unlike the
  // rest of Config. Tarjetas, this isn't Devotio-only). Min-amounts load via
  // their own useTemplatedConfig hooks above; only the (global,
  // non-per-template) high-amount alert threshold is fetched here.
  useEffect(() => {
    if (!targetWorkspaceId) return;
    const token = localStorage.getItem('token');
    const params = { workspace_id: targetWorkspaceId };
    const headers = { Authorization: `Bearer ${token}` };
    setAmountsLoading(true);

    axios.get(`${API}/high-amount-alert-config`, { params, headers })
      .then((res) => setHighAmountThreshold(res.data.threshold || 1000000))
      .catch((error) => console.error('Error loading amount settings:', error))
      .finally(() => setAmountsLoading(false));
  }, [targetWorkspaceId, user]);

  const handleSaveMinAmount = async (cardType) => {
    const tpl = minAmountTpls[cardType];
    const ok = await tpl.save({ min_amount: minAmountDrafts[cardType] || 0 });
    if (ok) toast.success(tpl.selectedTemplateId ? 'Monto mínimo específico guardado' : 'Monto mínimo guardado');
  };

  const handleSaveHighAmountThreshold = async () => {
    setSavingHighAmountThreshold(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/high-amount-alert-config`, { threshold: highAmountThreshold || 1000000 }, {
        params: { workspace_id: targetWorkspaceId },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Umbral de alerta guardado');
    } catch { toast.error('Error al guardar umbral de alerta'); }
    finally { setSavingHighAmountThreshold(false); }
  };

  const handleSaveStampConfig = async () => {
    if (!stampConfig.stamp_mode) { toast.error('Seleccione un modo de acumulación'); return; }
    setSavingStampConfig(true);
    try {
      const token = localStorage.getItem('token');
      const params = { workspace_id: targetWorkspaceId };
      if (selectedStampTemplateId) params.template_id = selectedStampTemplateId;
      await axios.post(`${API}/stamp-config`, stampConfig, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setStampConfigOverrides((prev) => {
        const withoutCurrent = prev.filter((c) => (c.template_id || null) !== (selectedStampTemplateId || null));
        return [...withoutCurrent, { ...stampConfig, template_id: selectedStampTemplateId || null }];
      });
      toast.success(selectedStampTemplateId ? 'Configuración específica guardada' : 'Configuración de sellos guardada');
    } catch { toast.error('Error al guardar configuración'); }
    finally { setSavingStampConfig(false); }
  };

  const getTierState = (cardType) => cardType === 'cashback'
    ? { tiers: cashbackDraftTiers, setTiers: setCashbackDraftTiers, tpl: cashbackTiersTpl }
    : { tiers: discountDraftTiers, setTiers: setDiscountDraftTiers, tpl: discountTiersTpl };

  const handleAddTier = (cardType) => {
    const { tiers, setTiers } = getTierState(cardType);
    const lastTier = tiers[tiers.length - 1];
    setTiers([...tiers, {
      name: '',
      threshold: lastTier ? lastTier.threshold + 5000 : 0,
      percentage: lastTier ? lastTier.percentage + 2 : 1
    }]);
  };

  const handleUpdateTier = (cardType, index, field, value) => {
    const { tiers, setTiers } = getTierState(cardType);
    const updated = [...tiers];
    updated[index] = { ...updated[index], [field]: field === 'name' ? value : (parseFloat(value) || 0) };
    setTiers(updated);
  };

  const handleRemoveTier = (cardType, index) => {
    const { tiers, setTiers } = getTierState(cardType);
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleSaveTiers = async (cardType) => {
    const { tiers, tpl } = getTierState(cardType);
    if (tiers.length === 0) { toast.error('Agregue al menos un nivel'); return; }
    if (tiers.some(t => !t.name.trim())) { toast.error('Todos los niveles necesitan un nombre'); return; }
    const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
    const ok = await tpl.save({ tiers: sorted });
    if (ok) toast.success(tpl.selectedTemplateId ? 'Niveles específicos guardados' : 'Niveles guardados');
  };

  const handleSaveGiftCardConfig = async (nextValue) => {
    const ok = await giftCardTpl.save({ allow_add: nextValue });
    if (ok) toast.success(giftCardTpl.selectedTemplateId ? 'Configuración específica guardada' : 'Configuración de tarjeta de regalo guardada');
  };

  const handleSaveCommentMode = async (mode) => {
    setSavingCommentMode(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/comment-config`, { mode }, {
        params: { workspace_id: targetWorkspaceId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setCommentMode(mode);
      toast.success('Modo de comentario guardado');
    } catch { toast.error('Error al guardar configuración'); }
    finally { setSavingCommentMode(false); }
  };

  const handleSaveRewardAccrualMode = async (mode) => {
    const ok = await rewardAccrualTpl.save({ mode });
    if (ok) toast.success(rewardAccrualTpl.selectedTemplateId ? 'Modo específico guardado' : 'Modo de acumulación de puntos guardado');
  };

  const handleSaveWorkspacePrefs = async (field, value) => {
    setSavingWorkspacePrefs(field);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/workspace-preferences`, { [field]: value }, {
        params: { workspace_id: targetWorkspaceId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspacePrefs((prev) => ({ ...prev, [field]: value }));
      toast.success('Preferencia guardada');
      if (field === 'currency') setCurrencyOpen(false);
    } catch { toast.error('Error al guardar preferencia'); }
    finally { setSavingWorkspacePrefs(''); }
  };

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" /></div>;
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">No tiene un workspace asignado.</p>
          <Button onClick={() => navigate('/')} variant="outline" className="mt-4">Volver</Button>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'super_admin';

  const tabs = [
    { key: 'overview', label: 'General', icon: Building2 },
    { key: 'users', label: 'Usuarios', icon: Users },
    { key: 'locations', label: 'Sucursales', icon: MapPin },
    // Montos is the business's own transaction-amount policy — visible to
    // workspace_admin too, unlike the Devotio-only sections below.
    { key: 'amounts', label: 'Montos', icon: DollarSign },
    // API Key and card configuration are Devotio-only — the client's own
    // workspace_admin never sees them.
    ...(isSuperAdmin ? [
      { key: 'api', label: 'API Key', icon: Key },
      { key: 'config', label: 'Config. Tarjetas', icon: Settings },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="workspace-admin-page">
      {/* Header — matching SuperAdminDashboard style */}
      <header className="nav-header">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 p-2 hover:bg-[#5B7CF7] hover:text-white rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" /><span className="font-medium hidden sm:inline">Volver</span>
        </button>
        <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Title section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B0B16]">{workspace.name}</h1>
            <p className="text-sm text-zinc-500">Panel de Administración</p>
          </div>
          <Button onClick={() => { fetchWorkspace(targetWorkspaceId); fetchUsers(targetWorkspaceId); }} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        {/* Tabs — pill style matching dashboard cards */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} data-testid={`tab-${tab.key}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key ? 'bg-[#5B7CF7] text-white' : 'bg-white text-zinc-600 border border-zinc-200 hover:border-[#0B0B16] hover:text-[#0B0B16]'
              }`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Stats cards — matching dashboard style */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-[#0B0B16]" />
                <p className="text-2xl font-bold text-[#0B0B16]">{workspace.user_count}</p>
                <p className="text-xs text-zinc-500">Usuarios</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <MapPin className="h-6 w-6 mx-auto mb-2 text-[#5B7CF7]" />
                <p className="text-2xl font-bold text-[#0B0B16]">{workspace.locations?.length || 0}</p>
                <p className="text-xs text-zinc-500">Sucursales</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Key className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold text-[#0B0B16]">{workspace.has_api_key ? 'OK' : 'No'}</p>
                <p className="text-xs text-zinc-500">API Key</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="flex justify-between"><span className="text-sm text-zinc-500">Workspace</span><span className="text-sm font-medium">{workspace.name}</span></div>
              <div className="flex justify-between"><span className="text-sm text-zinc-500">Slug</span><span className="text-sm font-mono text-zinc-600">{workspace.slug}</span></div>
              <div className="flex justify-between"><span className="text-sm text-zinc-500">Estado</span><span className="text-sm font-medium text-green-600">Activo</span></div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Usuarios</h2>
              <Button onClick={() => setShowCreateUser(!showCreateUser)} size="sm" className="gap-2 btn-primary" data-testid="add-user-btn">
                <UserPlus className="h-4 w-4" /> Nuevo
              </Button>
            </div>

            {showCreateUser && (
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3" data-testid="create-user-form">
                <Input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nombre completo" className="h-10" data-testid="new-user-name" />
                <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" className="h-10" data-testid="new-user-email" />
                <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Contraseña" className="h-10" data-testid="new-user-password" />
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full h-10 border border-zinc-200 rounded-lg px-3 text-sm bg-white" data-testid="new-user-role">
                  <option value="operator">Operador</option>
                  <option value="workspace_admin">Administrador</option>
                </select>
                <p className="text-xs text-zinc-400 -mt-2">
                  <span className="font-medium text-zinc-500">Operador:</span> solo puede escanear tarjetas y registrar ventas.{' '}
                  <span className="font-medium text-zinc-500">Administrador:</span> además puede gestionar usuarios, sucursales y configuración del workspace.
                </p>
                {locations.length > 0 && (
                  <select value={newUser.location} onChange={e => setNewUser({ ...newUser, location: e.target.value })}
                    className="w-full h-10 border border-zinc-200 rounded-lg px-3 text-sm bg-white" data-testid="new-user-location">
                    <option value="">Sin sucursal asignada</option>
                    {locations.map((loc, i) => <option key={i} value={loc.name}>{loc.name}</option>)}
                  </select>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleCreateUser} disabled={creatingUser} className="flex-1 btn-primary" data-testid="confirm-create-user">
                    {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear Usuario'}
                  </Button>
                  <Button onClick={() => setShowCreateUser(false)} variant="outline" className="flex-1">Cancelar</Button>
                </div>
              </div>
            )}

            {loadingUsers ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="space-y-2">
                {users.map(u => {
                  const roleInfo = ROLE_CONFIG[u.role] || ROLE_CONFIG.operator;
                  const isEditing = editingRole === u.id;
                  const canEdit = u.email !== user?.email && u.role !== 'super_admin';

                  return (
                    <div key={u.id} className="bg-white rounded-xl border border-zinc-200 p-4" data-testid={`user-${u.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-[#0B0B16]">{u.name}</p>
                          <p className="text-xs text-zinc-500">{u.email}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {isEditing ? (
                              <select value={u.role} onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                onBlur={() => setEditingRole(null)}
                                className="text-xs border border-zinc-300 rounded-lg px-2 py-1 bg-white"
                                data-testid={`role-select-${u.id}`} autoFocus>
                                <option value="operator">Operador</option>
                                <option value="workspace_admin">Administrador</option>
                                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                              </select>
                            ) : (
                              <button
                                onClick={() => canEdit && setEditingRole(u.id)}
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleInfo.bg} ${roleInfo.text} ${canEdit ? 'cursor-pointer hover:ring-2 hover:ring-[#0B0B16]/20' : 'cursor-default'}`}
                                title={canEdit ? 'Click para cambiar rol' : ''}
                                data-testid={`role-badge-${u.id}`}
                              >
                                {roleInfo.label}
                              </button>
                            )}
                            {u.location && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{u.location}</span>}
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="outline" size="sm"
                              onClick={() => { setResetModal({ open: true, user: u }); setResetResult(null); setManualPassword(''); setResetMode('auto'); }}
                              className="text-xs gap-1 text-[#5B7CF7] border-[#5B7CF7]/30 hover:bg-[#5B7CF7]/10"
                              data-testid={`reset-password-${u.id}`}>
                              <Key className="h-3.5 w-3.5" /> Restablecer contraseña
                            </Button>
                            <button onClick={() => handleDeleteUser(u.id, u.name)} className="p-2 text-zinc-300 hover:text-red-500" data-testid={`delete-user-${u.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {users.length === 0 && <p className="text-center text-sm text-zinc-400 py-8">No hay usuarios. Cree el primero.</p>}
              </div>
            )}
          </div>
        )}

        {/* Locations Tab */}
        {activeTab === 'locations' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Sucursales</h2>
            <p className="text-xs text-zinc-400 -mt-2">
              Los puntos físicos de este negocio (locales, sedes). Se usan para asignar operadores a una sucursal específica y para filtrar reportes por ubicación.
            </p>
            {locations.map((loc, i) => (
              <div key={i} className="flex gap-2 items-center" data-testid={`location-${i}`}>
                <Input value={loc.name} onChange={e => { const u = [...locations]; u[i] = { ...u[i], name: e.target.value }; setLocations(u); }}
                  placeholder="Nombre de sucursal" className="h-10 flex-1" data-testid={`location-name-${i}`} />
                <button onClick={() => setLocations(locations.filter((_, idx) => idx !== i))} className="p-2 text-zinc-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button onClick={() => setLocations([...locations, { name: '' }])} variant="outline"
              className="w-full h-10 border-2 border-dashed border-zinc-300" data-testid="add-location-btn">
              <Plus className="h-4 w-4 mr-2" /> Agregar sucursal
            </Button>
            {locations.length > 0 && (
              <Button onClick={handleSaveLocations} disabled={savingLocations} className="w-full h-12 btn-primary" data-testid="save-locations-btn">
                {savingLocations ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Guardar Sucursales</>}
              </Button>
            )}
          </div>
        )}

        {/* Montos Tab — visible to workspace_admin and super_admin */}
        {activeTab === 'amounts' && (
          amountsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" /></div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-[#0B0B16]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Monto Mínimo de Compra</p>
                </div>
                <p className="text-xs text-zinc-500">
                  Si la compra es menor al mínimo configurado, el escáner no permite acumular y muestra un aviso
                  con el monto requerido. 0 significa sin mínimo.
                </p>
                {[
                  { type: 'cashback', label: 'Cashback' },
                  { type: 'discount', label: 'Descuento' },
                  { type: 'stamp', label: 'Sellos (por monto o por visita)' },
                  { type: 'reward', label: 'Puntos (por monto, por visita o manual)' }
                ].map(({ type, label }) => {
                  const tpl = minAmountTpls[type];
                  return (
                    <div key={type} className="space-y-1.5" data-testid={`min-amount-row-${type}`}>
                      <label className="text-xs text-zinc-500 block">{label}</label>
                      <TemplatePicker templates={tpl.templates} loading={tpl.loadingTemplates}
                        selectedId={tpl.selectedTemplateId} onSelect={tpl.setSelectedTemplateId}
                        testIdPrefix={`min-amount-${type}-template`} />
                      <TemplateConfigHeader
                        selectedName={tpl.templates.find((t) => String(t.id) === tpl.selectedTemplateId)?.name}
                        hasOverride={tpl.hasOverride} onDeleteOverride={tpl.remove} deleting={tpl.deleting} />
                      <div className="flex gap-2 items-end">
                        <Input type="text" inputMode="decimal" value={formatWithThousands(minAmountDrafts[type])}
                          onChange={(e) => setMinAmountDrafts({ ...minAmountDrafts, [type]: parseFloat(stripThousandsFormatting(e.target.value)) || 0 })}
                          className="h-10 flex-1" data-testid={`min-amount-input-${type}`} />
                        <Button onClick={() => handleSaveMinAmount(type)} disabled={tpl.saving}
                          className="h-10 btn-primary shrink-0" data-testid={`save-min-amount-${type}`}>
                          {tpl.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-[#0B0B16]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Alerta de Monto Alto</p>
                </div>
                <p className="text-xs text-zinc-500">
                  Si el operador ingresa un monto igual o mayor a este valor, se muestra una advertencia antes de
                  confirmar — ayuda a detectar errores de digitación (ej. un cero de más) sin bloquear la operación.
                </p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 block mb-1">Monto que dispara la alerta</label>
                    <Input type="text" inputMode="decimal" value={formatWithThousands(highAmountThreshold)}
                      onChange={(e) => setHighAmountThreshold(parseFloat(stripThousandsFormatting(e.target.value)) || 0)}
                      className="h-10" data-testid="high-amount-threshold-input" />
                  </div>
                  <Button onClick={handleSaveHighAmountThreshold} disabled={savingHighAmountThreshold}
                    className="h-10 btn-primary shrink-0" data-testid="save-high-amount-threshold">
                    {savingHighAmountThreshold ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )
        )}

        {/* API Key Tab */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">API Key de Boomerangme</h2>
            <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Estado</span>
                <span className={`text-sm font-medium ${workspace.has_api_key ? 'text-emerald-600' : 'text-red-500'}`}>
                  {workspace.has_api_key ? 'Configurada' : 'No configurada'}
                </span>
              </div>
              {workspace.api_key_masked && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Key actual</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-zinc-600">{showApiKey ? workspace.api_key_masked : '••••••••' + workspace.api_key_masked.slice(-4)}</span>
                    <button onClick={() => setShowApiKey(!showApiKey)} className="p-1 text-zinc-400 hover:text-zinc-600">
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
              <p className="text-xs text-zinc-500">Ingrese la nueva API Key</p>
              <Input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)}
                placeholder="Nueva API Key" className="h-10 font-mono" data-testid="new-api-key-input" />
              <Button onClick={handleSaveApiKey} disabled={savingApiKey} className="w-full h-10 btn-primary" data-testid="save-api-key-btn">
                {savingApiKey ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Key className="h-4 w-4 mr-2" /> Actualizar API Key</>}
              </Button>
            </div>
          </div>
        )}

        {/* Config. Tarjetas Tab */}
        {activeTab === 'config' && (
          configLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" /></div>
          ) : (
            <div className="space-y-4">
              {/* Workspace-wide scanner preferences — moved from the personal
                  Settings page: business policy, not an individual choice. */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-[#0B0B16]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Preferencias del Escáner</p>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 block mb-2">Moneda</label>
                  <div className="relative">
                    <button onClick={() => setCurrencyOpen((open) => !open)}
                      className="w-full flex items-center justify-between p-3 border-2 border-zinc-200 rounded-xl hover:border-[#0B0B16] transition-colors"
                      data-testid="workspace-currency-selector">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#8CA4FE] to-[#1447E6] rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {(CURRENCIES.find((c) => c.code === workspacePrefs.currency) || CURRENCIES[0]).symbol}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-[#0B0B16]">
                          {(CURRENCIES.find((c) => c.code === workspacePrefs.currency) || CURRENCIES[0]).name}
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${currencyOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {currencyOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                        {CURRENCIES.map((currency) => (
                          <button key={currency.code} onClick={() => handleSaveWorkspacePrefs('currency', currency.code)}
                            className={`w-full flex items-center justify-between p-3 hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0 ${
                              currency.code === workspacePrefs.currency ? 'bg-[#5B7CF7]/5' : ''
                            }`} data-testid={`workspace-currency-${currency.code}`}>
                            <span className="text-sm text-[#0B0B16]">{currency.name} ({currency.code})</span>
                            {currency.code === workspacePrefs.currency && <span className="text-[#5B7CF7]">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-[#0B0B16] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#0B0B16]">Comentarios obligatorios</p>
                      <p className="text-xs text-zinc-500">Requerir comentario en cada transacción</p>
                    </div>
                  </div>
                  <button onClick={() => handleSaveWorkspacePrefs('require_comments', !workspacePrefs.require_comments)}
                    disabled={savingWorkspacePrefs === 'require_comments'}
                    className={`shrink-0 w-11 h-6 rounded-full transition-colors ${workspacePrefs.require_comments ? 'bg-[#5B7CF7]' : 'bg-zinc-300'}`}
                    data-testid="workspace-require-comments-switch">
                    <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${workspacePrefs.require_comments ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Search className="h-4 w-4 text-[#0B0B16] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#0B0B16]">Búsqueda manual</p>
                      <p className="text-xs text-zinc-500">Habilitar búsqueda por nombre o ID de tarjeta</p>
                    </div>
                  </div>
                  <button onClick={() => handleSaveWorkspacePrefs('enable_manual_search', !workspacePrefs.enable_manual_search)}
                    disabled={savingWorkspacePrefs === 'enable_manual_search'}
                    className={`shrink-0 w-11 h-6 rounded-full transition-colors ${workspacePrefs.enable_manual_search ? 'bg-[#5B7CF7]' : 'bg-zinc-300'}`}
                    data-testid="workspace-manual-search-switch">
                    <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${workspacePrefs.enable_manual_search ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="h-4 w-4 text-[#0B0B16] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#0B0B16]">Cámara preferida</p>
                      <p className="text-xs text-zinc-500">
                        Cámara que se abre por defecto al escanear en un dispositivo nuevo. No se puede fijar una
                        cámara exacta por negocio (cada celular tiene sus propias cámaras), pero sí preferir trasera o frontal.
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex rounded-lg border border-zinc-200 overflow-hidden">
                    {[{ value: 'back', label: 'Trasera' }, { value: 'front', label: 'Frontal' }].map((opt) => (
                      <button key={opt.value} onClick={() => handleSaveWorkspacePrefs('preferred_camera_facing', opt.value)}
                        disabled={savingWorkspacePrefs === 'preferred_camera_facing'}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          workspacePrefs.preferred_camera_facing === opt.value ? 'bg-[#5B7CF7] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
                        }`}
                        data-testid={`camera-facing-${opt.value}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sellos — one unified section: pick which card (when the
                  business has more than one Sellos template), then its mode
                  and settings adapt right below, in the same box. */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Stamp className="h-5 w-5 text-[#0B0B16]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Tarjetas de Sellos</p>
                </div>

                {loadingStampTemplates ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
                ) : stampTemplates.length > 1 ? (
                  <>
                    <p className="text-xs text-zinc-500">
                      Este negocio tiene más de una tarjeta de sellos. Elige cuál configurar — o deja "Todas" para la
                      configuración por defecto.
                    </p>
                    <div className="space-y-2">
                      <button onClick={() => setSelectedStampTemplateId('')}
                        className={`w-full text-left rounded-lg p-3 border-2 transition-colors ${
                          !selectedStampTemplateId ? 'border-[#0B0B16] bg-[#5B7CF7]/5' : 'border-transparent bg-zinc-50'
                        }`} data-testid="stamp-template-default">
                        <p className="text-sm font-medium text-[#0B0B16]">Todas (configuración por defecto)</p>
                      </button>
                      {stampTemplates.map((tpl) => (
                        <button key={tpl.id} onClick={() => setSelectedStampTemplateId(String(tpl.id))}
                          className={`w-full text-left rounded-lg p-3 border-2 transition-colors ${
                            selectedStampTemplateId === String(tpl.id) ? 'border-[#0B0B16] bg-[#5B7CF7]/5' : 'border-transparent bg-zinc-50'
                          }`} data-testid={`stamp-template-${tpl.id}`}>
                          <p className="text-sm font-medium text-[#0B0B16]">{tpl.name}</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {tpl.stampsPerVisit} sello{tpl.stampsPerVisit !== 1 ? 's' : ''} por visita
                          </p>
                          {tpl.rewardTiers.length > 0 ? (
                            <p className="text-xs text-zinc-500 mt-1">
                              Recompensas en {tpl.rewardTiers.map((t) => t.threshold).join(' y ')} sellos
                              {tpl.rewardTiers.length > 1 ? ' — tarjeta con múltiples niveles' : ''}
                            </p>
                          ) : (
                            <p className="text-xs text-zinc-400 mt-1">Sin niveles de recompensa configurados</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {selectedStampTemplateId && (
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500">
                      Configurando: <span className="font-medium text-[#0B0B16]">{stampTemplates.find((t) => String(t.id) === selectedStampTemplateId)?.name || 'Tarjeta'}</span>
                    </p>
                    {hasStampOverride && (
                      <Button variant="outline" size="sm" onClick={handleDeleteStampOverride} disabled={deletingStampOverride}
                        className="text-xs text-red-700 hover:bg-red-50 border-red-200 shrink-0" data-testid="delete-stamp-override">
                        {deletingStampOverride ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Usar la de por defecto'}
                      </Button>
                    )}
                  </div>
                )}
                {selectedStampTemplateId && !hasStampOverride && (
                  <p className="text-xs text-amber-600">
                    Esta tarjeta no tiene configuración propia — muestra los valores por defecto como punto de partida; al guardar se crea una específica solo para ella.
                  </p>
                )}
                <div className="space-y-2">
                  {[
                    { value: 'spend', label: 'Por Monto de Compra' },
                    { value: 'visit', label: 'Por Visita' },
                    { value: 'manual', label: 'Manual' }
                  ].map(mode => (
                    <button key={mode.value} onClick={() => setStampConfig({ ...stampConfig, stamp_mode: mode.value })}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-colors ${
                        stampConfig.stamp_mode === mode.value ? 'border-[#0B0B16] bg-[#5B7CF7]/5 font-medium' : 'border-zinc-200'
                      }`}>
                      {mode.label}
                    </button>
                  ))}
                </div>
                {stampConfig.stamp_mode === 'spend' && (
                  <div className="pt-2">
                    <p className="text-xs text-zinc-500 mb-2">Monto por sello</p>
                    <Input type="text" inputMode="decimal" value={formatWithThousands(stampConfig.spend_threshold)}
                      onChange={(e) => setStampConfig({ ...stampConfig, spend_threshold: parseFloat(stripThousandsFormatting(e.target.value)) || 0 })}
                      className="h-10" data-testid="stamp-spend-threshold" />
                  </div>
                )}
                {stampConfig.stamp_mode === 'visit' && (
                  <div className="pt-2 bg-zinc-50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Sellos por visita</p>
                    {selectedStampTemplateId ? (
                      <p className="text-sm font-medium text-[#0B0B16] mt-1">
                        {stampTemplates.find((t) => String(t.id) === selectedStampTemplateId)?.stampsPerVisit || 1} — configurado en la plataforma del proveedor, no editable desde acá
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-500 mt-1">
                        Cada tarjeta usa su propia cantidad, configurada en la plataforma del proveedor — selecciona una arriba para verla
                      </p>
                    )}
                  </div>
                )}
                <Button onClick={handleSaveStampConfig} disabled={savingStampConfig || !stampConfig.stamp_mode} className="w-full h-10 btn-primary" data-testid="save-stamp-config">
                  {savingStampConfig ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Guardar Configuración</>}
                </Button>
              </div>

              {/* Puntos (Reward) accrual mode — was decided per-card on first scan,
                  blocking the operator; now a workspace setting configured once here.
                  Can be overridden per specific Puntos template. */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-[#0B0B16]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Tarjetas de Puntos</p>
                </div>
                <p className="text-xs text-zinc-500">
                  Define cómo acumulan puntos las tarjetas de este negocio. Mientras no se configure, el escáner
                  bloquea la acumulación y pide contactar a Devotio, en vez de dejar que el operador elija.
                </p>
                <TemplatePicker templates={rewardAccrualTpl.templates} loading={rewardAccrualTpl.loadingTemplates}
                  selectedId={rewardAccrualTpl.selectedTemplateId} onSelect={rewardAccrualTpl.setSelectedTemplateId}
                  testIdPrefix="reward-template" />
                <TemplateConfigHeader
                  selectedName={rewardAccrualTpl.templates.find((t) => String(t.id) === rewardAccrualTpl.selectedTemplateId)?.name}
                  hasOverride={rewardAccrualTpl.hasOverride} onDeleteOverride={rewardAccrualTpl.remove} deleting={rewardAccrualTpl.deleting} />
                <div className="space-y-2">
                  {[
                    { value: 'spend', label: 'Por Compra', desc: 'Puntos según el monto de compra' },
                    { value: 'visit', label: 'Por Visita', desc: 'Puntos por cada visita registrada' },
                    { value: 'points', label: 'Manual', desc: 'El operador ingresa los puntos' }
                  ].map(mode => (
                    <button key={mode.value} onClick={() => handleSaveRewardAccrualMode(mode.value)}
                      disabled={rewardAccrualTpl.saving}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-colors ${
                        rewardAccrualTpl.currentConfig?.mode === mode.value ? 'border-[#0B0B16] bg-[#5B7CF7]/5 font-medium' : 'border-zinc-200'
                      }`} data-testid={`reward-accrual-mode-${mode.value}`}>
                      <p>{mode.label}</p>
                      <p className="text-xs text-zinc-500 font-normal">{mode.desc}</p>
                    </button>
                  ))}
                </div>
                {['spend', 'visit'].includes(rewardAccrualTpl.currentConfig?.mode) && (
                  <div className="pt-2 bg-zinc-50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">
                      {rewardAccrualTpl.currentConfig.mode === 'spend' ? 'Tasa de puntos por compra' : 'Tasa de puntos por visita'}
                    </p>
                    {rewardAccrualTpl.selectedTemplateId ? (
                      rewardTemplateRatio ? (
                        <p className="text-sm font-medium text-[#0B0B16] mt-1">
                          {rewardAccrualTpl.currentConfig.mode === 'spend'
                            ? `${formatWithThousands(rewardTemplateRatio.spentValue)} ${workspacePrefs.currency} = ${rewardTemplateRatio.earnedValue} puntos`
                            : `${rewardTemplateRatio.spentValue} visita${rewardTemplateRatio.spentValue !== 1 ? 's' : ''} = ${rewardTemplateRatio.earnedValue} puntos`}
                          {' '}— configurado en la plataforma del proveedor, no editable desde acá
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-400 mt-1">Sin tasa configurada en la plataforma del proveedor</p>
                      )
                    ) : (
                      <p className="text-sm text-zinc-500 mt-1">
                        Cada tarjeta usa su propia tasa, configurada en la plataforma del proveedor — selecciona una arriba para verla
                      </p>
                    )}
                  </div>
                )}
                {rewardAccrualTpl.saving && <Loader2 className="h-4 w-4 animate-spin mx-auto text-zinc-400" />}
              </div>

              {/* Tier sections — Cashback and Descuento, independent, each with
                  its own optional per-template override. */}
              {[{ type: 'cashback', label: 'Niveles — Cashback', tpl: cashbackTiersTpl, draft: cashbackDraftTiers }, { type: 'discount', label: 'Niveles — Descuento', tpl: discountTiersTpl, draft: discountDraftTiers }].map(({ type, label, tpl, draft }) => (
                <div key={type} className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Percent className="h-5 w-5 text-[#0B0B16]" />
                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
                  </div>
                  <TemplatePicker templates={tpl.templates} loading={tpl.loadingTemplates}
                    selectedId={tpl.selectedTemplateId} onSelect={tpl.setSelectedTemplateId}
                    testIdPrefix={`${type}-template`} />
                  <TemplateConfigHeader
                    selectedName={tpl.templates.find((t) => String(t.id) === tpl.selectedTemplateId)?.name}
                    hasOverride={tpl.hasOverride} onDeleteOverride={tpl.remove} deleting={tpl.deleting} />
                  {draft.map((tier, index) => (
                    <div key={index} className="flex gap-2 items-start" data-testid={`${type}-tier-${index}`}>
                      <Input value={tier.name} onChange={(e) => handleUpdateTier(type, index, 'name', e.target.value)}
                        placeholder="Nombre" className="h-10 text-sm flex-1" data-testid={`${type}-tier-name-${index}`} />
                      <Input type="text" inputMode="decimal" value={formatWithThousands(tier.threshold)}
                        onChange={(e) => handleUpdateTier(type, index, 'threshold', stripThousandsFormatting(e.target.value))}
                        placeholder="Gasto" className="h-10 text-sm w-24" disabled={index === 0} data-testid={`${type}-tier-threshold-${index}`} />
                      <div className="relative w-16">
                        <Input type="number" value={tier.percentage} onChange={(e) => handleUpdateTier(type, index, 'percentage', e.target.value)}
                          placeholder="%" className="h-10 text-sm pr-6" data-testid={`${type}-tier-percentage-${index}`} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">%</span>
                      </div>
                      <button onClick={() => handleRemoveTier(type, index)} className="p-2 text-zinc-400 hover:text-red-500" data-testid={`${type}-tier-remove-${index}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button onClick={() => handleAddTier(type)} variant="outline"
                    className="w-full h-10 border-2 border-dashed border-zinc-300" data-testid={`add-${type}-tier`}>
                    <Plus className="h-4 w-4 mr-2" /> Agregar nivel
                  </Button>
                  {draft.length > 0 && (
                    <Button onClick={() => handleSaveTiers(type)} disabled={tpl.saving} className="w-full h-10 btn-primary" data-testid={`save-${type}-tiers`}>
                      {tpl.saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Guardar Niveles</>}
                    </Button>
                  )}
                </div>
              ))}

              {/* Gift Card "Agregar" Toggle — can be overridden per specific
                  gift card template. */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Gift className="h-5 w-5 text-[#0B0B16]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Tarjetas de Regalo</p>
                </div>
                <TemplatePicker templates={giftCardTpl.templates} loading={giftCardTpl.loadingTemplates}
                  selectedId={giftCardTpl.selectedTemplateId} onSelect={giftCardTpl.setSelectedTemplateId}
                  testIdPrefix="gift-template" />
                <TemplateConfigHeader
                  selectedName={giftCardTpl.templates.find((t) => String(t.id) === giftCardTpl.selectedTemplateId)?.name}
                  hasOverride={giftCardTpl.hasOverride} onDeleteOverride={giftCardTpl.remove} deleting={giftCardTpl.deleting} />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="font-medium text-[#0B0B16] text-sm">Permitir "Agregar" saldo</p>
                    <p className="text-xs text-zinc-500">Por defecto los operadores solo canjean. Actívelo si este negocio necesita cargar saldo desde el escáner.</p>
                  </div>
                  <button onClick={() => handleSaveGiftCardConfig(!giftCardTpl.currentConfig?.allow_add)} disabled={giftCardTpl.saving}
                    className={`shrink-0 w-11 h-6 rounded-full transition-colors ${giftCardTpl.currentConfig?.allow_add ? 'bg-[#5B7CF7]' : 'bg-zinc-300'}`}
                    data-testid="gift-card-allow-add-switch">
                    <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${giftCardTpl.currentConfig?.allow_add ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Comment Mode */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <MessageSquare className="h-5 w-5 text-[#0B0B16]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Comentario</p>
                </div>
                <p className="text-xs text-zinc-500 mb-3">Aplica a todas las acciones del escáner por igual.</p>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-[#0B0B16] text-sm">Modo de comentario</p>
                  <select value={commentMode} onChange={(e) => handleSaveCommentMode(e.target.value)} disabled={savingCommentMode}
                    className="h-9 border border-zinc-200 rounded-lg px-3 text-sm bg-white" data-testid="comment-mode">
                    <option value="open">Abierto</option>
                    <option value="invoice_number"># de Factura</option>
                  </select>
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Reset Password Modal */}
      {resetModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setResetModal({ open: false, user: null })}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0B0B16] mb-1">Restablecer Contraseña</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Usuario: <span className="font-medium">{resetModal.user?.name}</span> ({resetModal.user?.email})
            </p>

            {!resetResult ? (
              <>
                <div className="space-y-3 mb-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Método</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setResetMode('auto')}
                      className={`p-3 border-2 rounded-xl text-center text-sm transition-all ${resetMode === 'auto' ? 'border-[#0B0B16] bg-[#5B7CF7]/5 font-semibold' : 'border-zinc-200'}`}
                      data-testid="reset-mode-auto">Automática</button>
                    <button onClick={() => setResetMode('manual')}
                      className={`p-3 border-2 rounded-xl text-center text-sm transition-all ${resetMode === 'manual' ? 'border-[#0B0B16] bg-[#5B7CF7]/5 font-semibold' : 'border-zinc-200'}`}
                      data-testid="reset-mode-manual">Manual</button>
                  </div>
                </div>
                {resetMode === 'manual' && (
                  <div className="mb-4">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">Nueva contraseña</label>
                    <Input type="text" value={manualPassword} onChange={(e) => setManualPassword(e.target.value)}
                      placeholder="Escriba la nueva contraseña" className="input-brutalist" data-testid="manual-password-input" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setResetModal({ open: false, user: null })} className="flex-1">Cancelar</Button>
                  <Button onClick={handleResetPassword} disabled={resetting || (resetMode === 'manual' && !manualPassword)}
                    className="flex-1 btn-primary" data-testid="confirm-reset-btn">
                    {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Restablecer'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-sm text-green-800 font-medium mb-2">Contraseña restablecida exitosamente</p>
                  <div className="flex items-center gap-2 bg-white p-3 rounded-lg border">
                    <code className="flex-1 text-lg font-mono font-bold text-[#0B0B16]" data-testid="new-password-display">{resetResult.new_password}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyResetPassword(resetResult.new_password)} data-testid="copy-password-btn">
                      {copiedPassword ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-green-700 mt-2">Comparta esta contraseña de forma segura con el usuario.</p>
                </div>
                <Button onClick={() => setResetModal({ open: false, user: null })} className="w-full btn-primary">Cerrar</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceAdminPage;
