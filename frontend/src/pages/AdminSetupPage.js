import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Shield, Building2, Loader2, Plus, MapPin, Key, UserPlus, ArrowLeft, Check } from 'lucide-react';

import { API_BASE_URL as API } from '../config/api';

const AdminSetupPage = () => {
  const navigate = useNavigate();
  const [masterCode, setMasterCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Workspace creation
  const [workspaceName, setWorkspaceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [locations, setLocations] = useState([{ name: '', address: '' }]);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdWorkspace, setCreatedWorkspace] = useState(null);

  const handleVerify = () => {
    if (masterCode === 'DEVOTIO-2026-ADMIN') {
      setVerified(true);
      toast.success('Código maestro verificado');
    } else {
      toast.error('Código maestro incorrecto');
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) { toast.error('Ingrese el nombre del workspace'); return; }
    if (!apiKey.trim()) { toast.error('Ingrese la API Key de Devotio Rewards'); return; }
    if (!adminEmail || !adminPassword || !adminName) { toast.error('Complete los datos del administrador'); return; }

    setCreating(true);
    try {
      const payload = {
        master_code: masterCode,
        name: workspaceName,
        boomerangme_api_key: apiKey,
        locations: locations.filter(l => l.name.trim()),
        admin_email: adminEmail,
        admin_password: adminPassword,
        admin_name: adminName
      };

      const resp = await axios.post(`${API}/admin/workspaces`, payload);
      setCreatedWorkspace(resp.data);
      toast.success(`Workspace '${workspaceName}' creado exitosamente`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear workspace');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setCreatedWorkspace(null);
    setWorkspaceName('');
    setApiKey('');
    setLocations([{ name: '', address: '' }]);
    setAdminEmail('');
    setAdminPassword('');
    setAdminName('');
  };

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="admin-setup-page">
      <div className="bg-[#5B7CF7] text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Shield className="h-5 w-5" />
          <div>
            <h1 className="font-bold text-base">Admin Setup</h1>
            <p className="text-xs text-zinc-300">Gestión de Workspaces — Devotio</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* Step 1: Master Code Verification */}
        {!verified && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4" data-testid="master-code-section">
            <div className="text-center mb-4">
              <Shield className="h-10 w-10 text-[#0B0B16] mx-auto mb-2" />
              <h2 className="font-bold text-lg">Acceso Restringido</h2>
              <p className="text-sm text-zinc-500">Ingrese el código maestro para continuar</p>
            </div>
            <Input
              type="password"
              value={masterCode}
              onChange={e => setMasterCode(e.target.value)}
              placeholder="Código Maestro"
              className="h-12 text-center font-mono tracking-widest"
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              data-testid="master-code-input"
            />
            <Button onClick={handleVerify} disabled={verifying} className="w-full h-12 bg-[#5B7CF7] hover:bg-[#3D64EF] text-white" data-testid="verify-btn">
              {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verificar'}
            </Button>
          </div>
        )}

        {/* Step 2: Workspace Creation */}
        {verified && !createdWorkspace && (
          <div className="space-y-4">
            {/* Workspace Info */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-[#0B0B16]" />
                <h2 className="font-semibold text-sm uppercase tracking-wider text-zinc-700">Nuevo Workspace</h2>
              </div>
              <Input
                value={workspaceName}
                onChange={e => setWorkspaceName(e.target.value)}
                placeholder="Nombre del negocio"
                className="h-10"
                data-testid="workspace-name"
              />
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="API Key de Devotio Rewards"
                  className="h-10 pl-10 font-mono text-sm"
                  data-testid="workspace-api-key"
                />
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
                    <Input
                      value={loc.name}
                      onChange={e => { const u = [...locations]; u[i] = { ...u[i], name: e.target.value }; setLocations(u); }}
                      placeholder="Nombre sucursal"
                      className="h-10"
                      data-testid={`setup-location-name-${i}`}
                    />
                    <Input
                      value={loc.address}
                      onChange={e => { const u = [...locations]; u[i] = { ...u[i], address: e.target.value }; setLocations(u); }}
                      placeholder="Dirección"
                      className="h-10"
                      data-testid={`setup-location-address-${i}`}
                    />
                  </div>
                  {locations.length > 1 && (
                    <button onClick={() => setLocations(locations.filter((_, idx) => idx !== i))} className="p-2 mt-1 text-zinc-400 hover:text-red-500">
                      <span className="text-lg">x</span>
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
              <Input
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                placeholder="Nombre del administrador"
                className="h-10"
                data-testid="admin-name"
              />
              <Input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="Email del administrador"
                className="h-10"
                data-testid="admin-email"
              />
              <Input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="Contraseña"
                className="h-10"
                data-testid="admin-password"
              />
            </div>

            <Button onClick={handleCreateWorkspace} disabled={creating} className="w-full h-12 bg-[#5B7CF7] hover:bg-[#3D64EF] text-white" data-testid="create-workspace-btn">
              {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Building2 className="h-4 w-4 mr-2" /> Crear Workspace</>}
            </Button>
          </div>
        )}

        {/* Step 3: Success */}
        {createdWorkspace && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4" data-testid="workspace-created">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="font-bold text-lg">Workspace Creado</h2>
            </div>

            <div className="bg-zinc-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Nombre</span>
                <span className="font-medium">{createdWorkspace.workspace?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Slug</span>
                <span className="font-mono">{createdWorkspace.workspace?.slug}</span>
              </div>
              {createdWorkspace.workspace?.locations?.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Sucursales</span>
                  <span>{createdWorkspace.workspace.locations.length}</span>
                </div>
              )}
              {createdWorkspace.admin_created && (
                <>
                  <div className="border-t border-zinc-200 mt-2 pt-2" />
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Admin</span>
                    <span className="font-medium">{createdWorkspace.admin_created.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Email</span>
                    <span>{createdWorkspace.admin_created.email}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={resetForm} className="flex-1 bg-[#5B7CF7] hover:bg-[#3D64EF] text-white" data-testid="create-another-btn">
                <Plus className="h-4 w-4 mr-1" /> Crear otro
              </Button>
              <Button onClick={() => navigate('/')} variant="outline" className="flex-1">Volver</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSetupPage;
