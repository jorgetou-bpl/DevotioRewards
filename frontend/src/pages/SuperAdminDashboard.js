import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Shield, Building2, Users, Activity, ChevronDown, ChevronUp,
  Key, RefreshCw, Loader2, ArrowLeft, MapPin, Eye, EyeOff,
  ToggleLeft, ToggleRight, Copy, Check
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [masterCode, setMasterCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [expandedWorkspace, setExpandedWorkspace] = useState(null);
  const [workspaceUsers, setWorkspaceUsers] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(null);

  // Reset password state
  const [resetModal, setResetModal] = useState({ open: false, user: null });
  const [resetMode, setResetMode] = useState('auto');
  const [manualPassword, setManualPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

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

  // Master code verification screen
  if (!verified) {
    return (
      <div className="min-h-screen bg-white">
        <header className="nav-header">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 p-2 hover:bg-[#ee478a] hover:text-white rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" /><span className="font-medium hidden sm:inline">Volver</span>
          </button>
          <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
          <div className="w-14 sm:w-20" />
        </header>
        <main className="max-w-md mx-auto p-6 pt-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#120627] flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#120627] mb-2">Panel Super Admin</h1>
            <p className="text-sm text-zinc-500">Ingrese el código maestro para acceder</p>
          </div>
          <div className="space-y-4">
            <Input
              type="password" value={masterCode} onChange={(e) => setMasterCode(e.target.value)}
              placeholder="Código maestro" className="input-brutalist h-14 text-center text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              data-testid="master-code-input"
            />
            <Button onClick={handleVerify} disabled={loading || !masterCode}
              className="w-full h-14 btn-primary text-lg" data-testid="verify-master-code-btn">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verificar Acceso'}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="nav-header">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 p-2 hover:bg-[#ee478a] hover:text-white rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" /><span className="font-medium hidden sm:inline">Volver</span>
        </button>
        <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#120627]">Panel Super Admin</h1>
            <p className="text-sm text-zinc-500">Gestión de todos los workspaces</p>
          </div>
          <Button onClick={fetchDashboard} variant="outline" size="sm" className="gap-2" data-testid="refresh-dashboard">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        {loading && !dashboard && (
          <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#120627]" /></div>
        )}

        {dashboard && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Building2 className="h-6 w-6 mx-auto mb-2 text-[#120627]" />
                <p className="text-2xl sm:text-3xl font-bold text-[#120627]" data-testid="total-workspaces">{dashboard.totals.workspaces}</p>
                <p className="text-xs text-zinc-500">Workspaces</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-[#ee478a]" />
                <p className="text-2xl sm:text-3xl font-bold text-[#120627]" data-testid="total-users">{dashboard.totals.users}</p>
                <p className="text-xs text-zinc-500">Usuarios</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-200 text-center">
                <Activity className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <p className="text-2xl sm:text-3xl font-bold text-[#120627]" data-testid="total-operations">{dashboard.totals.operations}</p>
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
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${ws.active ? 'bg-[#120627]' : 'bg-zinc-300'}`}>
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[#120627] truncate">{ws.name}</h3>
                          {!ws.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium flex-shrink-0">Inactivo</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ws.user_count} usuarios</span>
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
                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-[#120627]">{ws.admin_count}</p>
                          <p className="text-xs text-zinc-500">Admins</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-[#120627]">{ws.operator_count}</p>
                          <p className="text-xs text-zinc-500">Operadores</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-lg font-bold text-[#120627]">{ws.locations?.length || 0}</p>
                          <p className="text-xs text-zinc-500">Sucursales</p>
                        </div>
                      </div>

                      {/* Locations */}
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

                      {/* Users */}
                      <div className="mb-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Usuarios</p>
                        {loadingUsers === ws.id ? (
                          <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-zinc-400" /></div>
                        ) : workspaceUsers[ws.id]?.length > 0 ? (
                          <div className="space-y-2">
                            {workspaceUsers[ws.id].map((u) => (
                              <div key={u.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                                <div>
                                  <p className="font-medium text-sm text-[#120627]">{u.name}</p>
                                  <p className="text-xs text-zinc-500">{u.email}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                                      u.role === 'workspace_admin' ? 'bg-blue-100 text-blue-700' :
                                      'bg-zinc-100 text-zinc-600'
                                    }`}>{u.role === 'super_admin' ? 'Super Admin' : u.role === 'workspace_admin' ? 'Admin' : 'Operador'}</span>
                                    {u.location && <span className="text-xs text-zinc-400">{u.location}</span>}
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => { setResetModal({ open: true, user: u }); setResetResult(null); setManualPassword(''); setResetMode('auto'); }}
                                  className="text-xs gap-1 text-[#ee478a] hover:bg-[#ee478a]/10" data-testid={`reset-password-${u.email}`}>
                                  <RefreshCw className="h-3 w-3" /> Restablecer
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-400 text-center py-4">No hay usuarios en este workspace</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleToggleActive(ws.id)}
                          className={`gap-2 text-xs ${ws.active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                          data-testid={`toggle-workspace-${ws.slug}`}>
                          {ws.active ? <><ToggleRight className="h-4 w-4" /> Desactivar</> : <><ToggleLeft className="h-4 w-4" /> Activar</>}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Create new workspace link */}
            <div className="mt-6 text-center">
              <Button onClick={() => navigate('/admin/setup')} variant="outline" className="gap-2" data-testid="create-workspace-btn">
                <Building2 className="h-4 w-4" /> Crear Nuevo Workspace
              </Button>
            </div>
          </>
        )}
      </main>

      {/* Reset Password Modal */}
      {resetModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setResetModal({ open: false, user: null })}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#120627] mb-1">Restablecer Contraseña</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Usuario: <span className="font-medium">{resetModal.user?.name}</span> ({resetModal.user?.email})
            </p>

            {!resetResult ? (
              <>
                <div className="space-y-3 mb-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Método</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setResetMode('auto')}
                      className={`p-3 border-2 rounded-xl text-center text-sm transition-all ${resetMode === 'auto' ? 'border-[#120627] bg-[#120627]/5 font-semibold' : 'border-zinc-200'}`}
                      data-testid="reset-mode-auto">
                      Automática
                    </button>
                    <button onClick={() => setResetMode('manual')}
                      className={`p-3 border-2 rounded-xl text-center text-sm transition-all ${resetMode === 'manual' ? 'border-[#120627] bg-[#120627]/5 font-semibold' : 'border-zinc-200'}`}
                      data-testid="reset-mode-manual">
                      Manual
                    </button>
                  </div>
                </div>

                {resetMode === 'manual' && (
                  <div className="mb-4">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">Nueva contraseña</label>
                    <Input type="text" value={manualPassword} onChange={(e) => setManualPassword(e.target.value)}
                      placeholder="Escriba la nueva contraseña" className="input-brutalist"
                      data-testid="manual-password-input" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setResetModal({ open: false, user: null })} className="flex-1">Cancelar</Button>
                  <Button onClick={handleResetPassword}
                    disabled={resetting || (resetMode === 'manual' && !manualPassword)}
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
                    <code className="flex-1 text-lg font-mono font-bold text-[#120627]" data-testid="new-password-display">{resetResult.new_password}</code>
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
