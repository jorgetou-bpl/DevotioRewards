import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Inline "forgot password" mode — no separate route needed for the
  // request step (only the emailed reset link needs its own page); this
  // just swaps the card's content in place.
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'forgot-sent'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: forgotEmail });
      setMode('forgot-sent');
    } catch {
      toast.error('No se pudo procesar la solicitud, intenta de nuevo');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('¡Bienvenido de nuevo!');
      navigate('/');
    } catch (error) {
      let message = 'Error de autenticación';
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail[0]?.msg || 'Error de validación';
      } else if (detail?.msg) {
        message = detail.msg;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container min-h-screen" data-testid="login-page">
      <div className="w-full max-w-md px-4 sm:px-0">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <img 
            src="/fonts/logo.png" 
            alt="Devotio Rewards" 
            className="h-16 sm:h-24 mx-auto mb-4"
            data-testid="logo-image"
          />
        </div>

        {/* Form Card */}
        <div className="card-brutalist p-4 sm:p-6">
          {mode === 'login' && (
            <>
              <h2 className="text-xl sm:text-2xl text-heading text-center mb-2" data-testid="form-title">
                Iniciar Sesión
              </h2>
              <p className="text-center text-zinc-500 text-xs sm:text-sm mb-6 sm:mb-8">
                Bienvenido al escáner de tarjetas de fidelidad
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs sm:text-sm font-medium uppercase tracking-wider">
                    Correo Electrónico
                  </Label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 h-5 w-5 text-zinc-400 pointer-events-none z-10" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder=""
                      className="input-brutalist text-sm sm:text-base w-full"
                      style={{ paddingLeft: '3.5rem' }}
                      required
                      data-testid="email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs sm:text-sm font-medium uppercase tracking-wider">
                    Contraseña
                  </Label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 h-5 w-5 text-zinc-400 pointer-events-none z-10" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder=""
                      className="input-brutalist text-sm sm:text-base w-full"
                      style={{ paddingLeft: '3.5rem', paddingRight: '3.5rem' }}
                      required
                      data-testid="password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 text-zinc-400 hover:text-zinc-600 transition-colors z-10"
                      data-testid="toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary text-sm sm:text-base"
                  data-testid="submit-button"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Iniciar Sesión'
                  )}
                </Button>
              </form>

              <button
                onClick={() => setMode('forgot')}
                className="w-full text-center text-xs sm:text-sm text-[#5B7CF7] hover:underline mt-4"
                data-testid="forgot-password-link"
              >
                ¿Olvidaste tu contraseña?
              </button>

              {/* Help text */}
              <p className="text-center text-xs text-zinc-400 mt-6">
                ¿Necesitas una cuenta? Contacta al administrador de Devotio Rewards.
              </p>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <button
                onClick={() => setMode('login')}
                className="flex items-center gap-1 text-xs sm:text-sm text-zinc-500 hover:text-[#0B0B16] mb-4"
                data-testid="back-to-login"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
              <h2 className="text-xl sm:text-2xl text-heading text-center mb-2">
                Restablecer contraseña
              </h2>
              <p className="text-center text-zinc-500 text-xs sm:text-sm mb-6">
                Te enviaremos un enlace a tu correo (principal o de respaldo) para crear una nueva contraseña.
              </p>
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 h-5 w-5 text-zinc-400 pointer-events-none z-10" />
                  <Input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="input-brutalist text-sm sm:text-base w-full"
                    style={{ paddingLeft: '3.5rem' }}
                    required
                    data-testid="forgot-email-input"
                  />
                </div>
                <Button type="submit" disabled={forgotLoading} className="w-full btn-primary" data-testid="forgot-submit-button">
                  {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar enlace'}
                </Button>
              </form>
            </>
          )}

          {mode === 'forgot-sent' && (
            <div className="text-center py-4">
              <Mail className="h-10 w-10 mx-auto text-[#5B7CF7] mb-4" />
              <h2 className="text-xl text-heading mb-2">Revisa tu correo</h2>
              <p className="text-zinc-500 text-sm mb-6">
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. El enlace vence en 15 minutos.
              </p>
              <button
                onClick={() => setMode('login')}
                className="text-sm text-[#5B7CF7] hover:underline"
                data-testid="back-to-login-from-sent"
              >
                Volver a iniciar sesión
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-400 mt-6 sm:mt-8 px-4">
          Este sitio está protegido por reCAPTCHA y aplican la{' '}
          <a href="#" className="underline">Política de Privacidad</a> y los{' '}
          <a href="#" className="underline">Términos de Servicio</a> de Google.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
