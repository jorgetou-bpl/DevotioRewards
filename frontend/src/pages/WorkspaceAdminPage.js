import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  ArrowLeft, Building2, Users, MapPin, Key, Plus, Trash2, Loader2, Save,
  Eye, EyeOff, UserPlus, Activity, ChevronDown, ChevronUp, RefreshCw,
  Settings, Stamp, Percent, Gift, MessageSquare
} from 'lucide-react';

import { API_BASE_URL as API } from '../config/api';
import { formatWithThousands, stripThousandsFormatting } from '../components/cards/shared/numberFormat';

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

  // Card configuration state (Config. Tarjetas tab) — all scoped to targetWorkspaceId
  const [configLoading, setConfigLoading] = useState(true);
  const [stampConfig, setStampConfig] = useState({ stamp_mode: null, spend_threshold: 10000 });
  const [savingStampConfig, setSavingStampConfig] = useState(false);
  const [tiersByType, setTiersByType] = useState({ cashback: [], discount: [] });
  const [savingTiersType, setSavingTiersType] = useState('');
  const [giftCardAllowAdd, setGiftCardAllowAdd] = useState(false);
  const [savingGiftCardConfig, setSavingGiftCardConfig] = useState(false);
  const [commentMode, setCommentMode] = useState('open');
  const [savingCommentMode, setSavingCommentMode] = useState(false);
  const [stampTemplates, setStampTemplates] = useState([]);
  const [loadingStampTemplates, setLoadingStampTemplates] = useState(true);

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
      axios.get(`${API}/discount-tiers/cashback`, { params, headers }),
      axios.get(`${API}/discount-tiers/discount`, { params, headers }),
      axios.get(`${API}/gift-card-config`, { params, headers }),
      axios.get(`${API}/comment-config`, { params, headers })
    ])
      .then(([stampResp, cashbackResp, discountResp, giftResp, commentResp]) => {
        if (stampResp.data.stamp_mode) {
          setStampConfig({ stamp_mode: stampResp.data.stamp_mode, spend_threshold: stampResp.data.spend_threshold || 10000 });
        } else {
          setStampConfig({ stamp_mode: null, spend_threshold: 10000 });
        }
        setTiersByType({ cashback: cashbackResp.data.tiers || [], discount: discountResp.data.tiers || [] });
        setGiftCardAllowAdd(!!giftResp.data.allow_add);
        setCommentMode(commentResp.data.mode || 'open');
      })
      .catch((error) => console.error('Error loading card configuration:', error))
      .finally(() => setConfigLoading(false));
  }, [targetWorkspaceId, user]);

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

  const handleSaveStampConfig = async () => {
    if (!stampConfig.stamp_mode) { toast.error('Seleccione un modo de acumulación'); return; }
    setSavingStampConfig(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/stamp-config`, stampConfig, {
        params: { workspace_id: targetWorkspaceId },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuración de sellos guardada');
    } catch { toast.error('Error al guardar configuración'); }
    finally { setSavingStampConfig(false); }
  };

  const handleAddTier = (cardType) => {
    const tiers = tiersByType[cardType];
    const lastTier = tiers[tiers.length - 1];
    setTiersByType({
      ...tiersByType,
      [cardType]: [...tiers, {
        name: '',
        threshold: lastTier ? lastTier.threshold + 5000 : 0,
        percentage: lastTier ? lastTier.percentage + 2 : 1
      }]
    });
  };

  const handleUpdateTier = (cardType, index, field, value) => {
    const updated = [...tiersByType[cardType]];
    updated[index] = { ...updated[index], [field]: field === 'name' ? value : (parseFloat(value) || 0) };
    setTiersByType({ ...tiersByType, [cardType]: updated });
  };

  const handleRemoveTier = (cardType, index) => {
    setTiersByType({ ...tiersByType, [cardType]: tiersByType[cardType].filter((_, i) => i !== index) });
  };

  const handleSaveTiers = async (cardType) => {
    const tiers = tiersByType[cardType];
    if (tiers.length === 0) { toast.error('Agregue al menos un nivel'); return; }
    if (tiers.some(t => !t.name.trim())) { toast.error('Todos los niveles necesitan un nombre'); return; }
    setSavingTiersType(cardType);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/discount-tiers/${cardType}`, { tiers }, {
        params: { workspace_id: targetWorkspaceId },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Niveles guardados');
    } catch { toast.error('Error al guardar niveles'); }
    finally { setSavingTiersType(''); }
  };

  const handleSaveGiftCardConfig = async (nextValue) => {
    setSavingGiftCardConfig(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/gift-card-config`, { allow_add: nextValue }, {
        params: { workspace_id: targetWorkspaceId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setGiftCardAllowAdd(nextValue);
      toast.success('Configuración de tarjeta de regalo guardada');
    } catch { toast.error('Error al guardar configuración'); }
    finally { setSavingGiftCardConfig(false); }
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

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#120627]" /></div>;
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
        <button onClick={() => navigate('/')} className="flex items-center gap-2 p-2 hover:bg-[#ee478a] hover:text-white rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" /><span className="font-medium hidden sm:inline">Volver</span>
        </button>
        <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Title section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#120627]">{workspace.name}</h1>
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
                activeTab === tab.key ? 'bg-[#120627] text-white' : 'bg-white text-zinc-600 border border-zinc-200 hover:border-[#120627] hover:text-[#120627]'
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
                <Users className="h-6 w-6 mx-auto mb-2 text-[#120627]" />
                <p className="text-2xl font-bold text-[#120627]">{workspace.user_count}</p>
                <p className="text-xs text-zinc-500">Usuarios</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <MapPin className="h-6 w-6 mx-auto mb-2 text-[#ee478a]" />
                <p className="text-2xl font-bold text-[#120627]">{workspace.locations?.length || 0}</p>
                <p className="text-xs text-zinc-500">Sucursales</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Key className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold text-[#120627]">{workspace.has_api_key ? 'OK' : 'No'}</p>
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
                          <p className="font-medium text-sm text-[#120627]">{u.name}</p>
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
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleInfo.bg} ${roleInfo.text} ${canEdit ? 'cursor-pointer hover:ring-2 hover:ring-[#120627]/20' : 'cursor-default'}`}
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
                          <button onClick={() => handleDeleteUser(u.id, u.name)} className="p-2 text-zinc-300 hover:text-red-500" data-testid={`delete-user-${u.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
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
              <div key={i} className="flex gap-2 items-start" data-testid={`location-${i}`}>
                <div className="flex-1 space-y-2">
                  <Input value={loc.name} onChange={e => { const u = [...locations]; u[i] = { ...u[i], name: e.target.value }; setLocations(u); }}
                    placeholder="Nombre de sucursal" className="h-10" data-testid={`location-name-${i}`} />
                  <Input value={loc.address || ''} onChange={e => { const u = [...locations]; u[i] = { ...u[i], address: e.target.value }; setLocations(u); }}
                    placeholder="Dirección (opcional)" className="h-10" data-testid={`location-address-${i}`} />
                </div>
                <button onClick={() => setLocations(locations.filter((_, idx) => idx !== i))} className="p-2 mt-1 text-zinc-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button onClick={() => setLocations([...locations, { name: '', address: '' }])} variant="outline"
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
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#120627]" /></div>
          ) : (
            <div className="space-y-4">
              {/* Stamp Card Configuration */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Stamp className="h-5 w-5 text-[#120627]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Tarjetas de Sellos</p>
                </div>
                <div className="space-y-2">
                  {[
                    { value: 'spend', label: 'Por Monto de Compra' },
                    { value: 'visit', label: 'Por Visita' },
                    { value: 'manual', label: 'Manual' }
                  ].map(mode => (
                    <button key={mode.value} onClick={() => setStampConfig({ ...stampConfig, stamp_mode: mode.value })}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-colors ${
                        stampConfig.stamp_mode === mode.value ? 'border-[#120627] bg-[#120627]/5 font-medium' : 'border-zinc-200'
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
                <Button onClick={handleSaveStampConfig} disabled={savingStampConfig || !stampConfig.stamp_mode} className="w-full h-10 btn-primary" data-testid="save-stamp-config">
                  {savingStampConfig ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Guardar Configuración</>}
                </Button>
              </div>

              {/* Read-only: reward tier structure per stamp template, sourced live from Boomerangme */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Stamp className="h-5 w-5 text-[#120627]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Estructura de Tarjetas (Boomerangme)</p>
                </div>
                <p className="text-xs text-zinc-500">
                  Niveles de recompensa configurados directamente en Boomerangme para cada tarjeta de sellos de este
                  negocio. Solo lectura — para cambiarlos, se editan desde Boomerangme, no desde acá.
                </p>
                {loadingStampTemplates ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
                ) : stampTemplates.length > 0 ? (
                  <div className="space-y-2">
                    {stampTemplates.map((tpl) => (
                      <div key={tpl.id} className="bg-zinc-50 rounded-lg p-3" data-testid={`stamp-template-${tpl.id}`}>
                        <p className="text-sm font-medium text-[#120627]">{tpl.name}</p>
                        {tpl.rewardTiers.length > 0 ? (
                          <p className="text-xs text-zinc-500 mt-1">
                            Recompensas en {tpl.rewardTiers.map((t) => t.threshold).join(' y ')} sellos
                            {tpl.rewardTiers.length > 1 ? ' — tarjeta con múltiples niveles' : ''}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400 mt-1">Sin niveles de recompensa configurados</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 text-center py-2">
                    No se encontraron tarjetas de sellos configuradas en Boomerangme para este negocio.
                  </p>
                )}
              </div>

              {/* Tier sections — Cashback and Descuento, independent */}
              {[{ type: 'cashback', label: 'Niveles — Cashback' }, { type: 'discount', label: 'Niveles — Descuento' }].map(({ type, label }) => (
                <div key={type} className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Percent className="h-5 w-5 text-[#120627]" />
                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
                  </div>
                  {tiersByType[type].map((tier, index) => (
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
                  {tiersByType[type].length > 0 && (
                    <Button onClick={() => handleSaveTiers(type)} disabled={savingTiersType === type} className="w-full h-10 btn-primary" data-testid={`save-${type}-tiers`}>
                      {savingTiersType === type ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Guardar Niveles</>}
                    </Button>
                  )}
                </div>
              ))}

              {/* Gift Card "Agregar" Toggle */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Gift className="h-5 w-5 text-[#120627]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Tarjetas de Regalo</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="font-medium text-[#120627] text-sm">Permitir "Agregar" saldo</p>
                    <p className="text-xs text-zinc-500">Por defecto los operadores solo canjean. Actívelo si este negocio necesita cargar saldo desde el escáner.</p>
                  </div>
                  <button onClick={() => handleSaveGiftCardConfig(!giftCardAllowAdd)} disabled={savingGiftCardConfig}
                    className={`shrink-0 w-11 h-6 rounded-full transition-colors ${giftCardAllowAdd ? 'bg-[#120627]' : 'bg-zinc-300'}`}
                    data-testid="gift-card-allow-add-switch">
                    <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${giftCardAllowAdd ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Comment Mode */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <MessageSquare className="h-5 w-5 text-[#120627]" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Comentario</p>
                </div>
                <p className="text-xs text-zinc-500 mb-3">Aplica a todas las acciones del escáner por igual.</p>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-[#120627] text-sm">Modo de comentario</p>
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
    </div>
  );
};

export default WorkspaceAdminPage;
