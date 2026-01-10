import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const SettingsProvider = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [settings, setSettings] = useState({
    vibration: false,
    beep: false,
    show_result: true,
    copy_to_clipboard: true
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
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const response = await axios.put(`${API}/settings`, newSettings);
      setSettings(response.data);
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

  const value = {
    settings,
    loading,
    updateSettings,
    triggerVibration,
    triggerBeep,
    copyToClipboard,
    fetchSettings
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
