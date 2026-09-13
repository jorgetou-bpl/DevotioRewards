import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { PushNotificationsPanel } from '../components/dashboard/PushNotificationsPanel';
import { API_BASE_URL as API } from '../config/api';

// Standalone page, not a Dashboard tab — reachable from the hamburger menu
// and from the Home quick-actions row (next to Escanear), so the Dashboard
// itself stays purely informational.
const NotificationsPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [templatesList, setTemplatesList] = useState([]);

  useEffect(() => {
    axios.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setTemplatesList(res.data?.templates || []))
      .catch(() => setTemplatesList([]));
  }, [token]);

  return (
    <div className="min-h-screen bg-white" data-testid="notifications-page">
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 sm:gap-2 p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5 text-[#0B0B16]" />
          <span className="font-medium text-[#0B0B16] hidden sm:inline">Volver</span>
        </button>
        <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6">
        <h2 className="text-heading text-2xl sm:text-3xl text-center mb-2" data-testid="notifications-title">
          Notificaciones
        </h2>
        <p className="text-center text-zinc-500 text-xs sm:text-sm mb-6 sm:mb-8">
          Envía un mensaje a los clientes con tarjeta en su wallet
        </p>

        <PushNotificationsPanel token={token} templatesList={templatesList} />
      </main>
    </div>
  );
};

export default NotificationsPage;
