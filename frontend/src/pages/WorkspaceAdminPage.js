import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  ArrowLeft,
  Building2,
  Users,
  MapPin,
  Key,
  Plus,
  Trash2,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Settings,
  UserPlus,
  LogOut
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WorkspaceAdminPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'operator', location: '' });
  const [creatingUser, setCreatingUser] = useState(false);

  // API Key state
  const [showApiKey, setShowApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Locations state
  const [locations, setLocations] = useState([]);
  const [savingLocations, setSavingLocations] = useState(false);

  const fetchWorkspace = useCallback(async (wsId) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get(`${API}/admin/workspaces/${wsId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspace(resp.data.workspace);
      setLocations(resp.data.workspace.locations || []);
    } catch (error) {
      toast.error('Error al cargar workspace');
    }
  }, []);

  const fetchUsers = useCallback(async (wsId) => {
    setLoadingUsers(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get(`${API}/admin/workspaces/${wsId}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(resp.data.users || []);
    } catch (error) {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoadingUsers(false);
    }
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
        if (userData.workspace_id) {
          await fetchWorkspace(userData.workspace_id);
          await fetchUsers(userData.workspace_id);
        }
      } catch {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate, fetchWorkspace, fetchUsers]);

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    setCreatingUser(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/workspaces/${user.workspace_id}/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Usuario '${newUser.name}' creado`);
      setNewUser({ email: '', password: '', name: '', role: 'operator', location: '' });
      setShowCreateUser(false);
      await fetchUsers(user.workspace_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear usuario');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`¿Eliminar a ${userName}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/workspaces/${user.workspace_id}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Usuario eliminado');
      await fetchUsers(user.workspace_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleSaveApiKey = async () => {
    if (!newApiKey.trim()) { toast.error('Ingrese una API key'); return; }
    setSavingApiKey(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/admin/workspaces/${user.workspace_id}`, { boomerangme_api_key: newApiKey }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('API Key actualizada');
      setNewApiKey('');
      await fetchWorkspace(user.workspace_id);
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleSaveLocations = async () => {
    if (locations.some(l => !l.name.trim())) { toast.error('Todas las sucursales necesitan un nombre'); return; }
    setSavingLocations(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/admin/workspaces/${user.workspace_id}`, { locations }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sucursales guardadas');
      await fetchWorkspace(user.workspace_id);
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSavingLocations(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#120627]" />
      </div>
    );
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

  const tabs = [
    { key: 'overview', label: 'General', icon: Building2 },
    { key: 'users', label: 'Usuarios', icon: Users },
    { key: 'locations', label: 'Sucursales', icon: MapPin },
    { key: 'api', label: 'API Key', icon: Key },
  ];

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="workspace-admin-page">
      {/* Header */}
      <div className="bg-[#120627] text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-base">{workspace.name}</h1>
              <p className="text-xs text-zinc-300">Panel de Administración</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/settings')} className="p-2 hover:bg-white/10 rounded-lg">
              <Settings className="h-4 w-4" />
            </button>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
              className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#120627] text-[#120627]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Workspace</span>
                <span className="text-sm font-medium">{workspace.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Slug</span>
                <span className="text-sm font-mono text-zinc-600">{workspace.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">API Key</span>
                <span className="text-sm font-medium">{workspace.has_api_key ? 'Configurada' : 'No configurada'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Usuarios</span>
                <span className="text-sm font-medium">{workspace.user_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Sucursales</span>
                <span className="text-sm font-medium">{workspace.locations?.length || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Usuarios del Workspace</h2>
              <Button
                onClick={() => setShowCreateUser(!showCreateUser)}
                size="sm"
                className="bg-[#120627] hover:bg-[#1e0a3d] text-white"
                data-testid="add-user-btn"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Nuevo
              </Button>
            </div>

            {showCreateUser && (
              <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3" data-testid="create-user-form">
                <Input
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Nombre completo"
                  className="h-10"
                  data-testid="new-user-name"
                />
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Email"
                  className="h-10"
                  data-testid="new-user-email"
                />
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Contraseña"
                  className="h-10"
                  data-testid="new-user-password"
                />
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full h-10 border border-zinc-200 rounded-lg px-3 text-sm"
                  data-testid="new-user-role"
                >
                  <option value="operator">Operador</option>
                  <option value="workspace_admin">Administrador</option>
                </select>
                {locations.length > 0 && (
                  <select
                    value={newUser.location}
                    onChange={e => setNewUser({ ...newUser, location: e.target.value })}
                    className="w-full h-10 border border-zinc-200 rounded-lg px-3 text-sm"
                    data-testid="new-user-location"
                  >
                    <option value="">Sin sucursal asignada</option>
                    {locations.map((loc, i) => (
                      <option key={i} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleCreateUser} disabled={creatingUser} className="flex-1 bg-[#120627] hover:bg-[#1e0a3d] text-white" data-testid="confirm-create-user">
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
                {users.map(u => (
                  <div key={u.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center justify-between" data-testid={`user-${u.id}`}>
                    <div>
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'workspace_admin' ? 'bg-purple-100 text-purple-700' : 'bg-zinc-100 text-zinc-600'}`}>
                          {u.role === 'workspace_admin' ? 'Admin' : 'Operador'}
                        </span>
                        {u.location && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            {u.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {u.email !== user?.email && (
                      <button onClick={() => handleDeleteUser(u.id, u.name)} className="p-2 text-zinc-300 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-center text-sm text-zinc-400 py-8">No hay usuarios. Cree el primero.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Locations Tab */}
        {activeTab === 'locations' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Sucursales</h2>

            {locations.map((loc, i) => (
              <div key={i} className="flex gap-2 items-start" data-testid={`location-${i}`}>
                <div className="flex-1 space-y-2">
                  <Input
                    value={loc.name}
                    onChange={e => { const u = [...locations]; u[i] = { ...u[i], name: e.target.value }; setLocations(u); }}
                    placeholder="Nombre de sucursal"
                    className="h-10"
                    data-testid={`location-name-${i}`}
                  />
                  <Input
                    value={loc.address || ''}
                    onChange={e => { const u = [...locations]; u[i] = { ...u[i], address: e.target.value }; setLocations(u); }}
                    placeholder="Dirección (opcional)"
                    className="h-10"
                    data-testid={`location-address-${i}`}
                  />
                </div>
                <button onClick={() => setLocations(locations.filter((_, idx) => idx !== i))} className="p-2 mt-1 text-zinc-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <Button
              onClick={() => setLocations([...locations, { name: '', address: '' }])}
              variant="outline"
              className="w-full h-10 border-2 border-dashed border-zinc-300"
              data-testid="add-location-btn"
            >
              <Plus className="h-4 w-4 mr-2" /> Agregar sucursal
            </Button>

            {locations.length > 0 && (
              <Button onClick={handleSaveLocations} disabled={savingLocations} className="w-full h-12 bg-[#120627] hover:bg-[#1e0a3d] text-white" data-testid="save-locations-btn">
                {savingLocations ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Guardar Sucursales</>}
              </Button>
            )}
          </div>
        )}

        {/* API Key Tab */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">API Key de Devotio Rewards</h2>

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
                    <span className="text-sm font-mono text-zinc-600">
                      {showApiKey ? workspace.api_key_masked : '••••••••' + workspace.api_key_masked.slice(-4)}
                    </span>
                    <button onClick={() => setShowApiKey(!showApiKey)} className="p-1 text-zinc-400 hover:text-zinc-600">
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
              <p className="text-xs text-zinc-500">Ingrese la nueva API Key</p>
              <Input
                type="password"
                value={newApiKey}
                onChange={e => setNewApiKey(e.target.value)}
                placeholder="Nueva API Key"
                className="h-10 font-mono"
                data-testid="new-api-key-input"
              />
              <Button onClick={handleSaveApiKey} disabled={savingApiKey} className="w-full h-10 bg-[#120627] hover:bg-[#1e0a3d] text-white" data-testid="save-api-key-btn">
                {savingApiKey ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Key className="h-4 w-4 mr-2" /> Actualizar API Key</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceAdminPage;
