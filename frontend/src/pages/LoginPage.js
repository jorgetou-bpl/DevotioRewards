import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('¡Bienvenido de nuevo!');
      } else {
        await register(email, password, name);
        toast.success('¡Cuenta creada exitosamente!');
      }
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
          <h2 className="text-xl sm:text-2xl text-heading text-center mb-2" data-testid="form-title">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          <p className="text-center text-zinc-500 text-xs sm:text-sm mb-6 sm:mb-8">
            Bienvenido al escáner de tarjetas de fidelidad
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs sm:text-sm font-medium uppercase tracking-wider">
                  Nombre
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="input-brutalist text-sm sm:text-base"
                  required={!isLogin}
                  data-testid="name-input"
                />
              </div>
            )}

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
              ) : isLogin ? (
                'Iniciar Sesión'
              ) : (
                'Crear Cuenta'
              )}
            </Button>
          </form>

          <div className="mt-4 sm:mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs sm:text-sm text-zinc-500 hover:text-[#120627] transition-colors underline"
              data-testid="toggle-mode"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>

          {isLogin && (
            <div className="mt-3 sm:mt-4 text-center">
              <button
                type="button"
                className="text-xs sm:text-sm font-semibold text-[#120627] hover:underline"
                data-testid="forgot-password"
              >
                ¿Olvidaste tu contraseña?
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
