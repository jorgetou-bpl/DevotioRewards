import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Supported currencies
export const CURRENCIES = [
  { code: 'CRC', symbol: '₡', name: 'Colón Costarricense', locale: 'es-CR' },
  { code: 'USD', symbol: '$', name: 'Dólar Estadounidense', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'es-ES' },
  { code: 'MXN', symbol: '$', name: 'Peso Mexicano', locale: 'es-MX' },
  { code: 'COP', symbol: '$', name: 'Peso Colombiano', locale: 'es-CO' },
  { code: 'PEN', symbol: 'S/', name: 'Sol Peruano', locale: 'es-PE' },
  { code: 'ARS', symbol: '$', name: 'Peso Argentino', locale: 'es-AR' },
  { code: 'CLP', symbol: '$', name: 'Peso Chileno', locale: 'es-CL' },
  { code: 'GTQ', symbol: 'Q', name: 'Quetzal Guatemalteco', locale: 'es-GT' },
  { code: 'HNL', symbol: 'L', name: 'Lempira Hondureño', locale: 'es-HN' },
  { code: 'NIO', symbol: 'C$', name: 'Córdoba Nicaragüense', locale: 'es-NI' },
  { code: 'PAB', symbol: 'B/.', name: 'Balboa Panameño', locale: 'es-PA' },
  { code: 'DOP', symbol: 'RD$', name: 'Peso Dominicano', locale: 'es-DO' },
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileño', locale: 'pt-BR' },
];

export const SettingsProvider = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [settings, setSettings] = useState({
    vibration: false,
    beep: false,
    show_result: true,
    copy_to_clipboard: true,
    currency: 'CRC',
    require_comments: true,
    enable_manual_search: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchSettings();
    }
  }, [isAuthenticated, token]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const response = await axios.put(`${API}/settings`, newSettings);
      setSettings(prev => ({ ...prev, ...response.data }));
      return response.data;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  const triggerVibration = () => {
    if (settings.vibration && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  const triggerBeep = () => {
    if (settings.beep) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), 100);
    }
  };

  const copyToClipboard = async (text) => {
    if (settings.copy_to_clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.error('Failed to copy:', error);
        return false;
      }
    }
    return false;
  };

  // Currency formatting helper - uses period as thousand separator for Latin American currencies
  const formatCurrency = (amount) => {
    const currencyConfig = CURRENCIES.find(c => c.code === settings.currency) || CURRENCIES[0];
    
    // For Latin American currencies (CRC, COP, CLP, ARS, etc.), use period as thousand separator
    // Format: ₡10.000 instead of ₡10,000 or ₡10 000
    const latinAmericanCurrencies = ['CRC', 'COP', 'CLP', 'ARS', 'PEN', 'GTQ', 'HNL', 'NIO', 'PAB', 'DOP'];
    
    if (latinAmericanCurrencies.includes(currencyConfig.code)) {
      // Manual formatting for Latin American style: 10.000
      const formattedNumber = Math.round(amount)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `${currencyConfig.symbol}${formattedNumber}`;
    }
    
    // For USD, EUR, MXN, BRL use standard Intl formatting
    return new Intl.NumberFormat(currencyConfig.locale, {
      style: 'currency',
      currency: currencyConfig.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Get current currency info
  const getCurrencyInfo = () => {
    return CURRENCIES.find(c => c.code === settings.currency) || CURRENCIES[0];
  };

  const value = {
    settings,
    loading,
    updateSettings,
    triggerVibration,
    triggerBeep,
    copyToClipboard,
    fetchSettings,
    formatCurrency,
    getCurrencyInfo,
    CURRENCIES
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
