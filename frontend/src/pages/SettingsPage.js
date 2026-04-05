import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings, CURRENCIES } from '../context/SettingsContext';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  ArrowLeft, 
  Vibrate, 
  Volume2, 
  Eye, 
  Clipboard, 
  Loader2, 
  DollarSign,
  ChevronDown,
  Check,
  MessageSquare,
  Search,
  Stamp,
  Save,
  Percent,
  Plus,
  Trash2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SettingsPage = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, loading } = useSettings();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  
  // Stamp configuration state
  const [stampConfig, setStampConfig] = useState({
    stamp_mode: null,
    spend_threshold: 10000
  });
  const [stampConfigLoading, setStampConfigLoading] = useState(true);
  const [savingStampConfig, setSavingStampConfig] = useState(false);

  // Discount tier configuration state
  const [discountTiers, setDiscountTiers] = useState([]);
  const [discountTiersLoading, setDiscountTiersLoading] = useState(true);
  const [savingDiscountTiers, setSavingDiscountTiers] = useState(false);

  // Load stamp configuration on mount
  useEffect(() => {
    const loadStampConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/api/stamp-config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.stamp_mode) {
          setStampConfig({
            stamp_mode: response.data.stamp_mode,
            spend_threshold: response.data.spend_threshold || 10000
          });
        }
      } catch (error) {
        console.error('Error loading stamp config:', error);
      } finally {
        setStampConfigLoading(false);
      }
    };
    loadStampConfig();
  }, []);

  // Load discount tier configuration on mount
  useEffect(() => {
    const loadDiscountTiers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/api/discount-tiers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.tiers && response.data.tiers.length > 0) {
          setDiscountTiers(response.data.tiers);
        }
      } catch (error) {
        console.error('Error loading discount tiers:', error);
      } finally {
        setDiscountTiersLoading(false);
      }
    };
    loadDiscountTiers();
  }, []);

  const handleSaveStampConfig = async () => {
    if (!stampConfig.stamp_mode) {
      toast.error('Seleccione un modo de acumulación');
      return;
    }
    
    setSavingStampConfig(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/stamp-config`, stampConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuración de sellos guardada');
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setSavingStampConfig(false);
    }
  };

  const handleAddDiscountTier = () => {
    const lastTier = discountTiers[discountTiers.length - 1];
    setDiscountTiers([...discountTiers, {
      name: '',
      threshold: lastTier ? lastTier.threshold + 5000 : 0,
      percentage: lastTier ? lastTier.percentage + 2 : 1
    }]);
  };

  const handleUpdateDiscountTier = (index, field, value) => {
    const updated = [...discountTiers];
    updated[index] = { ...updated[index], [field]: field === 'name' ? value : (parseFloat(value) || 0) };
    setDiscountTiers(updated);
  };

  const handleRemoveDiscountTier = (index) => {
    setDiscountTiers(discountTiers.filter((_, i) => i !== index));
  };

  const handleSaveDiscountTiers = async () => {
    if (discountTiers.length === 0) {
      toast.error('Agregue al menos un nivel');
      return;
    }
    if (discountTiers.some(t => !t.name.trim())) {
      toast.error('Todos los niveles necesitan un nombre');
      return;
    }
    
    setSavingDiscountTiers(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/discount-tiers`, { tiers: discountTiers }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Niveles de descuento guardados');
    } catch (error) {
      toast.error('Error al guardar niveles');
    } finally {
      setSavingDiscountTiers(false);
    }
  };

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

  const stampModes = [
    { value: 'manual', label: 'Manual', description: 'El gerente ingresa la cantidad de sellos manualmente' },
    { value: 'visit', label: 'Por Visita', description: '1 sello por cada visita/transacción' },
    { value: 'spend', label: 'Por Gasto', description: 'Sellos basados en el monto de compra' }
  ];

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
    },
    {
      key: 'require_comments',
      label: 'Comentarios obligatorios',
      description: 'Requerir comentario en cada transacción',
      icon: MessageSquare,
      testId: 'setting-require-comments'
    },
    {
      key: 'enable_manual_search',
      label: 'Búsqueda manual',
      description: 'Habilitar búsqueda por nombre o ID de tarjeta',
      icon: Search,
      testId: 'setting-manual-search'
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

            {/* Stamp Card Configuration */}
            <div className="card-brutalist mt-6">
              <div className="flex items-center gap-3 mb-4">
                <Stamp className="h-5 w-5 text-[#120627]" />
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  Tarjetas de Sellos
                </p>
              </div>

              {stampConfigLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-[#120627]" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-[#120627] mb-2">Modo de acumulación</p>
                    <p className="text-xs text-zinc-500 mb-3">Cómo se ganan los sellos en las tarjetas de estampillas</p>
                    
                    <div className="space-y-2">
                      {stampModes.map((mode) => (
                        <button
                          key={mode.value}
                          onClick={() => setStampConfig({ ...stampConfig, stamp_mode: mode.value })}
                          className={`w-full flex items-center gap-3 p-3 border-2 rounded-xl transition-all ${
                            stampConfig.stamp_mode === mode.value 
                              ? 'border-[#120627] bg-purple-50' 
                              : 'border-zinc-200 hover:border-zinc-300'
                          }`}
                          data-testid={`stamp-mode-${mode.value}`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            stampConfig.stamp_mode === mode.value 
                              ? 'border-[#120627] bg-[#120627]' 
                              : 'border-zinc-300'
                          }`}>
                            {stampConfig.stamp_mode === mode.value && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-[#120627] text-sm">{mode.label}</p>
                            <p className="text-xs text-zinc-500">{mode.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Spend threshold - only show when spend mode is selected */}
                  {stampConfig.stamp_mode === 'spend' && (
                    <div className="pt-4 border-t border-zinc-200">
                      <p className="text-sm font-medium text-[#120627] mb-2">Monto por sello</p>
                      <p className="text-xs text-zinc-500 mb-3">Cuánto debe gastar el cliente para ganar 1 sello</p>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">{currentCurrency.symbol}</span>
                        <Input
                          type="number"
                          value={stampConfig.spend_threshold}
                          onChange={(e) => setStampConfig({ ...stampConfig, spend_threshold: parseFloat(e.target.value) || 0 })}
                          className="pl-12 h-12 border-2 border-zinc-200 rounded-xl"
                          placeholder="10000"
                          data-testid="stamp-spend-threshold"
                        />
                      </div>
                      <p className="text-xs text-zinc-400 mt-2">
                        El progreso se acumula entre transacciones hasta alcanzar este monto
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleSaveStampConfig}
                    disabled={savingStampConfig || !stampConfig.stamp_mode}
                    className="w-full h-12 bg-[#120627] hover:bg-[#1e0a3d] text-white"
                    data-testid="save-stamp-config"
                  >
                    {savingStampConfig ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </>
                    )}
                  </Button>

                  {!stampConfig.stamp_mode && (
                    <p className="text-xs text-amber-600 text-center">
                      ⚠️ Configure el modo de sellos para habilitar la funcionalidad
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Discount Tier Configuration */}
            <div className="card-brutalist mt-6">
              <div className="flex items-center gap-3 mb-4">
                <Percent className="h-5 w-5 text-[#120627]" />
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  Niveles de Descuento
                </p>
              </div>

              {discountTiersLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-[#120627]" />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-500">
                    Configure los niveles de descuento que coincidan con su configuración en Boomerangme
                  </p>

                  {discountTiers.map((tier, index) => (
                    <div key={index} className="flex gap-2 items-start" data-testid={`discount-tier-${index}`}>
                      <div className="flex-1">
                        <Input
                          value={tier.name}
                          onChange={(e) => handleUpdateDiscountTier(index, 'name', e.target.value)}
                          placeholder="Nombre"
                          className="h-10 border-2 border-zinc-200 rounded-lg text-sm"
                          data-testid={`discount-tier-name-${index}`}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          value={tier.threshold}
                          onChange={(e) => handleUpdateDiscountTier(index, 'threshold', e.target.value)}
                          placeholder="Gasto"
                          className="h-10 border-2 border-zinc-200 rounded-lg text-sm"
                          disabled={index === 0}
                          data-testid={`discount-tier-threshold-${index}`}
                        />
                      </div>
                      <div className="w-16">
                        <div className="relative">
                          <Input
                            type="number"
                            value={tier.percentage}
                            onChange={(e) => handleUpdateDiscountTier(index, 'percentage', e.target.value)}
                            placeholder="%"
                            className="h-10 border-2 border-zinc-200 rounded-lg text-sm pr-6"
                            data-testid={`discount-tier-percentage-${index}`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveDiscountTier(index)}
                        className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        data-testid={`discount-tier-remove-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <Button
                    onClick={handleAddDiscountTier}
                    variant="outline"
                    className="w-full h-10 border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-[#120627] hover:text-[#120627]"
                    data-testid="add-discount-tier"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar nivel
                  </Button>

                  {discountTiers.length > 0 && (
                    <Button
                      onClick={handleSaveDiscountTiers}
                      disabled={savingDiscountTiers}
                      className="w-full h-12 bg-[#120627] hover:bg-[#1e0a3d] text-white"
                      data-testid="save-discount-tiers"
                    >
                      {savingDiscountTiers ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar Niveles
                        </>
                      )}
                    </Button>
                  )}

                  <p className="text-xs text-zinc-400">
                    Los nombres y umbrales deben coincidir con la configuración de Boomerangme
                  </p>
                </div>
              )}
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
