import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Shield, Building2, Users, Activity, ChevronDown, ChevronUp,
  Key, RefreshCw, Loader2, ArrowLeft, MapPin, UserPlus,
  ToggleLeft, ToggleRight, Copy, Check, Plus, X, Settings, Trash2, AlertTriangle
} from 'lucide-react';

import { API_BASE_URL as API } from '../config/api';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [masterCode, setMasterCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [expandedWorkspace, setExpandedWorkspace] = useState(null);
  const [workspaceUsers, setWorkspaceUsers] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(null);

  // View mode: 'dashboard' or 'create'
  const [view, setView] = useState('dashboard');

  // Reset password state
  const [resetModal, setResetModal] = useState({ open: false, user: null });
  const [resetMode, setResetMode] = useState('auto');
  const [manualPassword, setManualPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  // Delete workspace state
  const [deleteModal, setDeleteModal] = useState({ open: false, workspace: null });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Reset statistics state
  const [resetStatsModal, setResetStatsModal] = useState({ open: false, workspace: null });
  const [resetStatsConfirmText, setResetStatsConfirmText] = useState('');
  const [resettingStats, setResettingStats] = useState(false);

  // Create workspace state
  const [workspaceName, setWorkspaceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [locations, setLocations] = useState([{ name: '', address: '' }]);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdWorkspace, setCreatedWorkspace] = useState(null);

  const handleVerify = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/admin/verify-master-code`, { master_code: masterCode });
      setVerified(true);
      toast.success('Acceso verificado');
      fetchDashboard();
    } catch {
      toast.error('Código maestro incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    const token = localStorage.getItem('token');
    if (!token) { toast.error('Debe iniciar sesión primero'); return; }
    setLoading(true);
    try {
      const resp = await axios.get(`${API}/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      setDashboard(resp.data);
    } catch (err) {
      if (err.response?.status === 403) toast.error('Acceso restringido a super administradores');
      else toast.error('Error al cargar dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaceUsers = async (wsId) => {
    const token = localStorage.getItem('token');
    setLoadingUsers(wsId);
    try {
      const resp = await axios.get(`${API}/admin/dashboard/workspaces/${wsId}/users`, { headers: { Authorization: `Bearer ${token}` } });
      setWorkspaceUsers(prev => ({ ...prev, [wsId]: resp.data.users }));
    } catch { toast.error('Error al cargar usuarios'); }
    finally { setLoadingUsers(null); }
  };

  const toggleWorkspace = (wsId) => {
    if (expandedWorkspace === wsId) {
      setExpandedWorkspace(null);
    } else {
      setExpandedWorkspace(wsId);
      if (!workspaceUsers[wsId]) fetchWorkspaceUsers(wsId);
    }
  };

  const handleToggleActive = async (wsId) => {
    const token = localStorage.getItem('token');
    try {
      const resp = await axios.patch(`${API}/admin/dashboard/workspaces/${wsId}/toggle-active`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(resp.data.message);
      fetchDashboard();
    } catch { toast.error('Error al cambiar estado'); }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteModal.workspace) return;
    setDeleting(true);
    const token = localStorage.getItem('token');
    try {
      const resp = await axios.delete(`${API}/admin/dashboard/workspaces/${deleteModal.workspace.id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(resp.data.message);
      setDeleteModal({ open: false, workspace: null });
      setDeleteConfirmText('');
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar workspace');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetStats = async () => {
    if (!resetStatsModal.workspace) return;
    setResettingStats(true);
    const token = localStorage.getItem('token');
    try {
      const resp = await axios.delete(`${API}/operations/reset`, {
        params: { workspace_id: resetStatsModal.workspace.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${resp.data.deleted_count} operación(es) eliminada(s)`);
      setResetStatsModal({ open: false, workspace: null });
      setResetStatsConfirmText('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al resetear estadísticas');
    } finally {
      setResettingStats(false);
    }
  };

  const handleResetPassword = async () => {
    setResetting(true);
    setResetResult(null);
    const token = localStorage.getItem('token');
    try {
      const payload = { master_code: masterCode };
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleUpdateRole = async (wsId, userId, newRole) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API}/admin/workspaces/${wsId}/users/${userId}/role`, { role: newRole }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Rol actualizado');
      setEditingRole(null);
      fetchWorkspaceUsers(wsId);
    } catch (err) { toast.error(err.response?.data?.detail || 'Error al actualizar rol'); }
  };

  // Create workspace
  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) { toast.error('Ingrese el nombre del workspace'); return; }
    if (!apiKey.trim()) { toast.error('Ingrese la API Key de Boomerangme'); return; }
    if (!adminEmail || !adminPassword || !adminName) { toast.error('Complete los datos del administrador'); return; }
    setCreating(true);
    try {
      const resp = await axios.post(`${API}/admin/workspaces`, {
        master_code: masterCode,
        name: workspaceName,
        boomerangme_api_key: apiKey,
        locations: locations.filter(l => l.name.trim()),
        admin_email: adminEmail,
        admin_password: adminPassword,
        admin_name: adminName
      });
      setCreatedWorkspace(resp.data);
      toast.success(`Workspace '${workspaceName}' creado exitosamente`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear workspace');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreatedWorkspace(null);
    setWorkspaceName('');
    setApiKey('');
    setLocations([{ name: '', address: '' }]);
    setAdminEmail('');
    setAdminPassword('');
    setAdminName('');
  };

  const backToDashboard = () => {
    resetCreateForm();
    setView('dashboard');
    fetchDashboard();
  };

  // Master code verification screen
  if (!verified) {
    return (
      <div className="min-h-screen bg-white">
        <header className="nav-header">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 p-2 hover:bg-[#5B7CF7] hover:text-white rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" /><span className="font-medium hidden sm:inline">Volver</span>
          </button>
          <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
          <div className="w-14 sm:w-20" />
        </header>
        <main className="max-w-md mx-auto p-6 pt-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#5B7CF7] flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#0B0B16] mb-2">Panel Super Admin</h1>
            <p className="text-sm text-zinc-500">Ingrese el código maestro para acceder</p>
          </div>
          <div className="space-y-4">
            <Input type="password" value={masterCode} onChange={(e) => setMasterCode(e.target.value)}
              placeholder="Código maestro" className="input-brutalist h-14 text-center text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()} data-testid="master-code-input" />
            <Button onClick={handleVerify} disabled={loading || !masterCode}
              className="w-full h-14 btn-primary text-lg" data-testid="verify-master-code-btn">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verificar Acceso'}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ============ CREATE WORKSPACE VIEW ============
  if (view === 'create') {
    return (
      <div className="min-h-screen bg-zinc-50">
        <header className="nav-header">
          <button onClick={backToDashboard} className="flex items-center gap-2 p-2 hover:bg-[#5B7CF7] hover:text-white rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" /><span className="font-medium hidden sm:inline">Dashboard</span>
          </button>
          <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
          <div className="w-14 sm:w-20" />
        </header>

        <main className="max-w-lg mx-auto p-4 sm:p-6">
          <h1 className="text-xl font-bold text-[#0B0B16] mb-6">Crear Nuevo Workspace</h1>

          {!createdWorkspace ? (
            <div className="space-y-4">
              {/* Workspace Info */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-[#0B0B16]" />
                  <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-700">Datos del Workspace</h2>
                </div>
                <Input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)}
                  placeholder="Nombre del negocio" className="h-10" data-testid="workspace-name" />
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="API Key de Boomerangme" className="h-10 pl-10 font-mono text-sm" data-testid="workspace-api-key" />
                </div>
              </div>

              {/* Locations */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-5 w-5 text-[#0B0B16]" />
                  <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-700">Sucursales</h2>
                </div>
                {locations.map((loc, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <Input value={loc.name}
                        onChange={e => { const u = [...locations]; u[i] = { ...u[i], name: e.target.value }; setLocations(u); }}
                        placeholder="Nombre sucursal" className="h-10" data-testid={`location-name-${i}`} />
                      <Input value={loc.address}
                        onChange={e => { const u = [...locations]; u[i] = { ...u[i], address: e.target.value }; setLocations(u); }}
                        placeholder="Dirección" className="h-10" data-testid={`location-address-${i}`} />
                    </div>
                    {locations.length > 1 && (
                      <button onClick={() => setLocations(locations.filter((_, idx) => idx !== i))} className="p-2 mt-1 text-zinc-400 hover:text-red-500">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <Button onClick={() => setLocations([...locations, { name: '', address: '' }])} variant="outline" className="w-full h-9 border-dashed border-zinc-300 text-sm">
                  <Plus className="h-4 w-4 mr-1" /> Agregar sucursal
                </Button>
              </div>

              {/* Admin User */}
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="h-5 w-5 text-[#0B0B16]" />
                  <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-700">Administrador del Workspace</h2>
                </div>
                <p className="text-xs text-zinc-500">Este usuario podrá gestionar el workspace, crear operadores y configurar settings.</p>
                <Input value={adminName} onChange={e => setAdminName(e.target.value)}
                  placeholder="Nombre del administrador" className="h-10" data-testid="admin-name" />
                <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                  placeholder="Email del administrador" className="h-10" data-testid="admin-email" />
                <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Contraseña" className="h-10" data-testid="admin-password" />
              </div>

              <Button onClick={handleCreateWorkspace} disabled={creating}
                className="w-full h-12 btn-primary" data-testid="create-workspace-btn">
                {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Building2 className="h-4 w-4 mr-2" /> Crear Workspace</>}
              </Button>
            </div>
          ) : (
            /* Success */
            <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4" data-testid="workspace-created">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <h2 className="font-bold text-lg">Workspace Creado</h2>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Nombre</span><span className="font-medium">{createdWorkspace.workspace?.name}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Slug</span><span className="font-mono">{createdWorkspace.workspace?.slug}</span></div>
                {createdWorkspace.workspace?.locations?.length > 0 && (
                  <div className="flex justify-between"><span className="text-zinc-500">Sucursales</span><span>{createdWorkspace.workspace.locations.length}</span></div>
                )}
                {createdWorkspace.admin_created && (
                  <>
                    <div className="border-t border-zinc-200 mt-2 pt-2" />
                    <div className="flex justify-between"><span className="text-zinc-500">Admin</span><span className="font-medium">{createdWorkspace.admin_created.name}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Email</span><span>{createdWorkspace.admin_created.email}</span></div>
                  </>
                )}
              </div>
              <Button onClick={() => navigate(`/admin/workspace?workspace=${createdWorkspace.workspace.id}`)}
                className="w-full btn-primary gap-2" data-testid="manage-new-workspace-btn">
                <Settings className="h-4 w-4" /> Gestionar este workspace
              </Button>
              <div className="flex gap-2">
                <Button onClick={resetCreateForm} variant="outline" className="flex-1" data-testid="create-another-btn">
                  <Plus className="h-4 w-4 mr-1" /> Crear otro
                </Button>
                <Button onClick={backToDashboard} variant="outline" className="flex-1">Volver al Dashboard</Button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============ DASHBOARD VIEW ============
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="nav-header">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 p-2 hover:bg-[#5B7CF7] hover:text-white rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" /><span className="font-medium hidden sm:inline">Volver</span>
        </button>
        <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B0B16]">Panel Super Admin</h1>
            <p className="text-sm text-zinc-500">Gestión de todos los workspaces</p>
          </div>
          <Button onClick={fetchDashboard} variant="outline" size="sm" className="gap-2" data-testid="refresh-dashboard">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        {loading && !dashboard && (
          <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#0B0B16]" /></div>
        )}

        {dashboard && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Building2 className="h-6 w-6 mx-auto mb-2 text-[#0B0B16]" />
                <p className="text-2xl sm:text-3xl font-bold text-[#0B0B16]" data-testid="total-workspaces">{dashboard.totals.workspaces}</p>
                <p className="text-xs text-zinc-500">Workspaces</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-[#5B7CF7]" />
                <p className="text-2xl sm:text-3xl font-bold text-[#0B0B16]" data-testid="total-users">{dashboard.totals.users}</p>
                <p className="text-xs text-zinc-500">Usuarios</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Activity className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <p className="text-2xl sm:text-3xl font-bold text-[#0B0B16]" data-testid="total-operations">{dashboard.totals.operations}</p>
                <p className="text-xs text-zinc-500">Operaciones</p>
              </div>
            </div>

            {/* Workspaces list */}
            <div className="space-y-3">
              {dashboard.workspaces.map((ws) => (
                <div key={ws.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden" data-testid={`workspace-card-${ws.slug}`}>
                  <button onClick={() => toggleWorkspace(ws.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors text-left">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${ws.active ? 'bg-[#5B7CF7]' : 'bg-zinc-300'}`}>
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[#0B0B16] truncate">{ws.name}</h3>
                          {!ws.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium flex-shrink-0">Inactivo</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ws.user_count}</span>
                          <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {ws.operations_count} ops</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ws.locations?.length || 0} suc.</span>
                          {ws.has_api_key && <span className="flex items-center gap-1"><Key className="h-3 w-3 text-green-500" /> API</span>}
                        </div>
                      </div>
                    </div>
                    {expandedWorkspace === ws.id ? <ChevronUp className="h-5 w-5 text-zinc-400 flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-zinc-400 flex-shrink-0" />}
                  </button>

                  {expandedWorkspace === ws.id && (
                    <div className="border-t border-zinc-200 p-4 bg-zinc-50">
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-[#0B0B16]">{ws.admin_count}</p>
                          <p className="text-xs text-zinc-500">Admins</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-[#0B0B16]">{ws.operator_count}</p>
                          <p className="text-xs text-zinc-500">Operadores</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-[#0B0B16]">{ws.locations?.length || 0}</p>
                          <p className="text-xs text-zinc-500">Sucursales</p>
                        </div>
                      </div>

                      {ws.locations?.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Sucursales</p>
                          <div className="space-y-1">
                            {ws.locations.map((loc, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm bg-white p-2 rounded-lg">
                                <MapPin className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                                <span className="font-medium">{loc.name}</span>
                                {loc.address && <span className="text-zinc-400 text-xs truncate">— {loc.address}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Usuarios</p>
                        {loadingUsers === ws.id ? (
                          <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-zinc-400" /></div>
                        ) : workspaceUsers[ws.id]?.length > 0 ? (
                          <div className="space-y-2">
                            {workspaceUsers[ws.id].map((u) => {
                              const isEditing = editingRole === u.id;
                              const canEditRole = u.role !== 'super_admin';
                              const roleLabel = u.role === 'super_admin' ? 'Super Admin' : u.role === 'workspace_admin' ? 'Admin' : 'Operador';
                              const roleCls = u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : u.role === 'workspace_admin' ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600';
                              return (
                              <div key={u.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                                <div>
                                  <p className="font-medium text-sm text-[#0B0B16]">{u.name}</p>
                                  <p className="text-xs text-zinc-500">{u.email}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {isEditing ? (
                                      <select value={u.role} onChange={(e) => handleUpdateRole(ws.id, u.id, e.target.value)}
                                        onBlur={() => setEditingRole(null)}
                                        className="text-xs border border-zinc-300 rounded-lg px-2 py-1 bg-white" autoFocus
                                        data-testid={`role-select-${u.id}`}>
                                        <option value="operator">Operador</option>
                                        <option value="workspace_admin">Administrador</option>
                                      </select>
                                    ) : (
                                      <button onClick={() => canEditRole && setEditingRole(u.id)}
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleCls} ${canEditRole ? 'cursor-pointer hover:ring-2 hover:ring-[#0B0B16]/20' : 'cursor-default'}`}
                                        title={canEditRole ? 'Click para cambiar rol' : ''}
                                        data-testid={`role-badge-${u.id}`}>
                                        {roleLabel}
                                      </button>
                                    )}
                                    {u.location && <span className="text-xs text-zinc-400">{u.location}</span>}
                                  </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { setResetModal({ open: true, user: u }); setResetResult(null); setManualPassword(''); setResetMode('auto'); }}
                                  className="text-xs gap-1 shrink-0 text-[#5B7CF7] border-[#5B7CF7]/30 hover:bg-[#5B7CF7]/10" data-testid={`reset-password-${u.email}`}>
                                  <Key className="h-3.5 w-3.5" /> Restablecer contraseña
                                </Button>
                              </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-400 text-center py-4">No hay usuarios en este workspace</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/workspace?workspace=${ws.id}`)}
                          className="gap-2 text-xs text-[#0B0B16] hover:bg-[#5B7CF7]/5"
                          data-testid={`manage-workspace-${ws.slug}`}>
                          <Settings className="h-4 w-4" /> Gestionar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleToggleActive(ws.id)}
                          className={`gap-2 text-xs ${ws.active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                          data-testid={`toggle-workspace-${ws.slug}`}>
                          {ws.active ? <><ToggleRight className="h-4 w-4" /> Desactivar</> : <><ToggleLeft className="h-4 w-4" /> Activar</>}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setResetStatsModal({ open: true, workspace: ws }); setResetStatsConfirmText(''); }}
                          className="gap-2 text-xs text-amber-700 hover:bg-amber-50 border-amber-200"
                          data-testid={`reset-stats-${ws.slug}`}>
                          <RefreshCw className="h-4 w-4" /> Reset Estadísticas
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setDeleteModal({ open: true, workspace: ws }); setDeleteConfirmText(''); }}
                          className="gap-2 text-xs text-red-700 hover:bg-red-50 border-red-200"
                          data-testid={`delete-workspace-${ws.slug}`}>
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Create new workspace */}
            <div className="mt-6 text-center">
              <Button onClick={() => setView('create')} className="gap-2 btn-primary" data-testid="create-workspace-nav-btn">
                <Plus className="h-4 w-4" /> Crear Nuevo Workspace
              </Button>
            </div>
          </>
        )}
      </main>

      {/* Delete Workspace Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal({ open: false, workspace: null })}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-[#0B0B16]">Eliminar workspace</h3>
            </div>
            <p className="text-sm text-zinc-500 mt-3 mb-4">
              Esto borra permanentemente <strong>{deleteModal.workspace?.name}</strong>: sus usuarios (excepto
              cuentas Devotio), sucursales, configuración de tarjetas e historial de operaciones. No se puede deshacer.
            </p>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Escriba <span className="font-mono normal-case">{deleteModal.workspace?.slug}</span> para confirmar
            </label>
            <Input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deleteModal.workspace?.slug} className="input-brutalist mb-4" data-testid="delete-confirm-input" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteModal({ open: false, workspace: null })} className="flex-1">Cancelar</Button>
              <Button onClick={handleDeleteWorkspace} disabled={deleting || deleteConfirmText !== deleteModal.workspace?.slug}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-delete-workspace-btn">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar permanentemente'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Statistics Modal */}
      {resetStatsModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setResetStatsModal({ open: false, workspace: null })}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-[#0B0B16]">Resetear estadísticas</h3>
            </div>
            <p className="text-sm text-zinc-500 mt-3 mb-4">
              Esto borra permanentemente todo el historial de operaciones de <strong>{resetStatsModal.workspace?.name}</strong> (dashboard,
              exportes y reportes). Las tarjetas y usuarios no se ven afectados. No se puede deshacer.
            </p>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">
              Escriba <span className="font-mono normal-case">{resetStatsModal.workspace?.slug}</span> para confirmar
            </label>
            <Input type="text" value={resetStatsConfirmText} onChange={(e) => setResetStatsConfirmText(e.target.value)}
              placeholder={resetStatsModal.workspace?.slug} className="input-brutalist mb-4" data-testid="reset-stats-confirm-input" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResetStatsModal({ open: false, workspace: null })} className="flex-1">Cancelar</Button>
              <Button onClick={handleResetStats} disabled={resettingStats || resetStatsConfirmText !== resetStatsModal.workspace?.slug}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" data-testid="confirm-reset-stats-btn">
                {resettingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resetear estadísticas'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(resetResult.new_password)} data-testid="copy-password-btn">
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

export default SuperAdminDashboard;
