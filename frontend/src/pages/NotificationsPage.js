import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PushNotificationsPanel } from '../components/dashboard/PushNotificationsPanel';
import { API_BASE_URL as API } from '../config/api';

// Route `/notifications`, labeled "Mensajería" in AppLayout's sidebar —
// scoped to push notifications for now; will grow with WhatsApp etc. in
// Fase 2 without needing a new top-level destination.
//
// Reads `?template_id=` so the Tarjetas detail page's "Enviar notificación"
// button lands here with that card already selected in the composer.
const NotificationsPage = () => {
  const { token } = useAuth();
  const location = useLocation();
  const [templatesList, setTemplatesList] = useState([]);

  const initialTemplateId = new URLSearchParams(location.search).get('template_id') || '';

  useEffect(() => {
    axios.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setTemplatesList(res.data?.templates || []))
      .catch(() => setTemplatesList([]));
  }, [token]);

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6" data-testid="notifications-page">
      <div className="mb-6">
        <h2 className="text-heading text-2xl sm:text-3xl" data-testid="notifications-title">
          Mensajería
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Envía un mensaje a los clientes con tarjeta en su wallet
        </p>
      </div>

      <PushNotificationsPanel token={token} templatesList={templatesList} initialTemplateId={initialTemplateId} />
    </div>
  );
};

export default NotificationsPage;
