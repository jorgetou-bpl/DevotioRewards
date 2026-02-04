import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Shield, Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle, UserCog } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminSetupPage = () => {
  const [masterCode, setMasterCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdUsers, setCreatedUsers] = useState([]);

  const handleVerifyCode = (e) => {
    e.preventDefault();
    if (masterCode.trim()) {
      setIsVerified(true);
      toast.success('Código verificado. Ahora puede crear usuarios.');
    } else {
      toast.error('Ingrese el código maestro');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/api/auth/admin/create-user`, {
        master_code: masterCode,
        email,
        password,
        name,
        role
      });

      if (response.data.success) {
        toast.success(`Usuario "${name}" creado exitosamente`);
        setCreatedUsers([...createdUsers, response.data.user]);
        // Reset form but keep master code
        setEmail('');
        setPassword('');
        setName('');
        setRole('user');
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al crear usuario';
      toast.error(message);
      
      // If master code is invalid, reset verification
      if (error.response?.status === 403) {
        setIsVerified(false);
        setMasterCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#120627] rounded-2xl mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#120627]">Configuración Admin</h1>
          <p className="text-sm text-zinc-500 mt-1">Devotio Rewards - Gestión de Usuarios</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border-2 border-zinc-200 p-6">
          {!isVerified ? (
            // Master Code Verification
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div className="text-center mb-4">
                <Lock className="h-12 w-12 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">
                  Ingrese el código maestro para continuar
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="masterCode" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Código Maestro
                </Label>
                <Input
                  id="masterCode"
                  type="password"
                  value={masterCode}
                  onChange={(e) => setMasterCode(e.target.value)}
                  placeholder="••••••••••••"
                  className="text-center text-lg tracking-widest font-mono h-14 border-2 border-zinc-200 focus:border-[#120627]"
                  required
                  data-testid="master-code-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#120627] hover:bg-[#1e0a3d] text-white"
                data-testid="verify-code-button"
              >
                Verificar Código
              </Button>
            </form>
          ) : (
            // User Creation Form
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg mb-4">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Código verificado</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Nombre del Gerente
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="pl-10 h-12 border-2 border-zinc-200 focus:border-[#120627]"
                    required
                    data-testid="name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Correo Electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gerente@empresa.com"
                    className="pl-10 h-12 border-2 border-zinc-200 focus:border-[#120627]"
                    required
                    data-testid="email-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12 border-2 border-zinc-200 focus:border-[#120627]"
                    required
                    data-testid="password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Rol del Usuario
                </Label>
                <div className="relative">
                  <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-10 h-12 border-2 border-zinc-200 rounded-lg focus:border-[#120627] focus:outline-none bg-white appearance-none cursor-pointer"
                    data-testid="role-select"
                  >
                    <option value="user">Usuario (Gerente)</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {role === 'admin' ? 'Puede gestionar configuraciones y usuarios' : 'Solo puede operar el escáner'}
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#120627] hover:bg-[#1e0a3d] text-white"
                data-testid="create-user-button"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Crear Usuario'
                )}
              </Button>
            </form>
          )}

          {/* Created Users List */}
          {createdUsers.length > 0 && (
            <div className="mt-6 pt-6 border-t border-zinc-200">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">Usuarios creados en esta sesión:</h3>
              <div className="space-y-2">
                {createdUsers.map((user, index) => (
                  <div key={index} className="flex items-center justify-between bg-zinc-50 px-3 py-2 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-zinc-700">{user.name}</p>
                      <p className="text-xs text-zinc-400">{user.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Usuario'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-400 mt-6">
          Esta página es solo para administradores de Devotio Rewards.
          <br />
          No comparta el código maestro con usuarios finales.
        </p>
      </div>
    </div>
  );
};

export default AdminSetupPage;
