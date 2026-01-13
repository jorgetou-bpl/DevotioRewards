import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings, CURRENCIES } from '../context/SettingsContext';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Vibrate, 
  Volume2, 
  Eye, 
  Clipboard, 
  Loader2, 
  DollarSign,
  ChevronDown,
  Check
} from 'lucide-react';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, loading } = useSettings();
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const handleToggle = async (key, value) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Configuración actualizada');
    } catch (error) {
      toast.error('Error al actualizar configuración');
    }
  };

  const handleCurrencyChange = async (currencyCode) => {
    try {
      await updateSettings({ currency: currencyCode });
      toast.success('Moneda actualizada');
      setCurrencyOpen(false);
    } catch (error) {
      toast.error('Error al actualizar moneda');
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

  const currentCurrency = CURRENCIES.find(c => c.code === settings.currency) || CURRENCIES[0];

  return (
    <div className="min-h-screen bg-white" data-testid="settings-page">
      {/* Header */}
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5 text-[#120627]" />
          <span className="font-medium text-[#120627] hidden sm:inline">Volver</span>
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
            <Loader2 className="h-8 w-8 animate-spin text-[#120627]" />
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
                      <item.icon className="h-5 w-5 text-[#120627] flex-shrink-0" strokeWidth={2} />
                      <div className="min-w-0">
                        <p className="font-medium text-[#120627] text-sm sm:text-base">{item.label}</p>
                        <p className="text-xs sm:text-sm text-zinc-500 truncate">{item.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings[item.key] || false}
                      onCheckedChange={(checked) => handleToggle(item.key, checked)}
                      className="data-[state=checked]:bg-[#120627] flex-shrink-0"
                      data-testid={`${item.testId}-switch`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Currency Settings */}
            <div className="card-brutalist">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                Moneda
              </p>

              <div className="relative">
                <button
                  onClick={() => setCurrencyOpen(!currencyOpen)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 border-2 border-zinc-200 rounded-xl hover:border-[#120627] transition-colors"
                  data-testid="currency-selector"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#F040A0] to-[#120627] rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{currentCurrency.symbol}</span>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-[#120627] text-sm sm:text-base">{currentCurrency.name}</p>
                      <p className="text-xs sm:text-sm text-zinc-500">{currentCurrency.code}</p>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-zinc-400 transition-transform ${currencyOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Currency Dropdown */}
                {currencyOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                    {CURRENCIES.map((currency) => (
                      <button
                        key={currency.code}
                        onClick={() => handleCurrencyChange(currency.code)}
                        className={`w-full flex items-center justify-between p-3 hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0 ${
                          currency.code === settings.currency ? 'bg-purple-50' : ''
                        }`}
                        data-testid={`currency-${currency.code}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center font-semibold text-[#120627]">
                            {currency.symbol}
                          </span>
                          <div className="text-left">
                            <p className="font-medium text-[#120627] text-sm">{currency.name}</p>
                            <p className="text-xs text-zinc-500">{currency.code}</p>
                          </div>
                        </div>
                        {currency.code === settings.currency && (
                          <Check className="h-5 w-5 text-[#120627]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-zinc-400 mt-3">
                Esta moneda se usará para mostrar los montos de compra y transacciones
              </p>
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
