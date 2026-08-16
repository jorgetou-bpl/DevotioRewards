import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Vibrate,
  Volume2,
  Eye,
  Clipboard,
  Loader2
} from 'lucide-react';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, loading } = useSettings();

  const handleToggle = async (key, value) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Configuración actualizada');
    } catch (error) {
      toast.error('Error al actualizar configuración');
    }
  };

  const settingsItems = [
    {
      key: 'vibration',
      label: 'Vibración',
      description: 'Vibrar al escanear un código',
      icon: Vibrate,
      testId: 'setting-vibration'
    },
    {
      key: 'beep',
      label: 'Sonido',
      description: 'Reproducir sonido al escanear',
      icon: Volume2,
      testId: 'setting-beep'
    },
    {
      key: 'show_result',
      label: 'Mostrar resultado',
      description: 'Mostrar detalles de tarjeta después de escanear',
      icon: Eye,
      testId: 'setting-show-result'
    },
    {
      key: 'copy_to_clipboard',
      label: 'Copiar al portapapeles',
      description: 'Copiar ID de tarjeta después de escanear',
      icon: Clipboard,
      testId: 'setting-copy-clipboard'
    }
  ];

  return (
    <div className="min-h-screen bg-white" data-testid="settings-page">
      {/* Header */}
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5 text-[#0B0B16]" />
          <span className="font-medium text-[#0B0B16] hidden sm:inline">Volver</span>
        </button>
        <img 
          src="/fonts/logo.png" 
          alt="Devotio Rewards" 
          className="h-8 sm:h-10"
        />
        <div className="w-16 sm:w-20" />
      </header>

      <main className="max-w-md mx-auto p-4 sm:p-6">
        <h2 className="text-heading text-2xl sm:text-3xl text-center mb-6 sm:mb-8" data-testid="settings-title">
          Configuración
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
          </div>
        ) : (
          <>
            {/* Scan Settings */}
            <div className="card-brutalist mb-6">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                Al escanear un código
              </p>

              <div className="divide-y divide-zinc-200">
                {settingsItems.map((item) => (
                  <div key={item.key} className="settings-row py-3 sm:py-4" data-testid={item.testId}>
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <item.icon className="h-5 w-5 text-[#0B0B16] flex-shrink-0" strokeWidth={2} />
                      <div className="min-w-0">
                        <p className="font-medium text-[#0B0B16] text-sm sm:text-base">{item.label}</p>
                        <p className="text-xs sm:text-sm text-zinc-500 truncate">{item.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings[item.key] || false}
                      onCheckedChange={(checked) => handleToggle(item.key, checked)}
                      className="data-[state=checked]:bg-[#5B7CF7] flex-shrink-0"
                      data-testid={`${item.testId}-switch`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Version Info */}
        <div className="text-center mt-8 text-zinc-400 text-xs sm:text-sm">
          <p>Devotio Rewards Scanner v1.0.0</p>
          <p className="mt-1">Powered by Devotio Rewards</p>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
