import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';

// Route `/reset-password?token=...` — the destination of the link emailed
// by POST /auth/forgot-password. No auth required (the token itself is the
// credential, verified server-side with its own 15-minute expiry).
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { token, new_password: password });
      setDone(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'El enlace es inválido o expiró');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container min-h-screen" data-testid="reset-password-page">
      <div className="w-full max-w-md px-4 sm:px-0">
        <div className="text-center mb-6 sm:mb-8">
          <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-16 sm:h-24 mx-auto mb-4" />
        </div>

        <div className="card-brutalist p-4 sm:p-6">
          {!token ? (
            <div className="text-center py-4">
              <p className="text-zinc-500 text-sm mb-4">Este enlace no es válido.</p>
              <Button onClick={() => navigate('/login')} className="btn-primary">Ir a inicio de sesión</Button>
            </div>
          ) : done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-600 mb-4" />
              <h2 className="text-xl text-heading mb-2">Contraseña actualizada</h2>
              <p className="text-zinc-500 text-sm mb-6">Ya puedes iniciar sesión con tu nueva contraseña.</p>
              <Button onClick={() => navigate('/login')} className="w-full btn-primary" data-testid="go-to-login">
                Iniciar sesión
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-xl sm:text-2xl text-heading text-center mb-2" data-testid="reset-title">
                Crear nueva contraseña
              </h2>
              <p className="text-center text-zinc-500 text-xs sm:text-sm mb-6">
                Este enlace vence en 15 minutos.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-xs sm:text-sm font-medium uppercase tracking-wider">
                    Nueva contraseña
                  </Label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 h-5 w-5 text-zinc-400 pointer-events-none z-10" />
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-brutalist text-sm sm:text-base w-full"
                      style={{ paddingLeft: '3.5rem', paddingRight: '3.5rem' }}
                      required
                      data-testid="new-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 text-zinc-400 hover:text-zinc-600 transition-colors z-10"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-xs sm:text-sm font-medium uppercase tracking-wider">
                    Confirmar contraseña
                  </Label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 h-5 w-5 text-zinc-400 pointer-events-none z-10" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-brutalist text-sm sm:text-base w-full"
                      style={{ paddingLeft: '3.5rem' }}
                      required
                      data-testid="confirm-password-input"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full btn-primary" data-testid="reset-submit-button">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Actualizar contraseña'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
