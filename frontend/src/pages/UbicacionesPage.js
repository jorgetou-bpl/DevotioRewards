import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { GeoPushPanel } from '../components/dashboard/GeoPushPanel';
import { API_BASE_URL as API } from '../config/api';

// Was a sub-tab inside PushNotificationsPanel ("Ubicaciones"), now its own
// route (`/ubicaciones`) in AppLayout's sidebar — GeoPush is a distinct
// concept from push messaging (Mensajería will grow with WhatsApp etc. in
// Fase 2), so it gets its own destination instead of living inside it.
const UbicacionesPage = () => {
  const { token } = useAuth();
  const [templatesList, setTemplatesList] = useState([]);

  useEffect(() => {
    axios.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setTemplatesList(res.data?.templates || []))
      .catch(() => setTemplatesList([]));
  }, [token]);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6" data-testid="ubicaciones-page">
      <div className="mb-6">
        <h2 className="text-heading text-2xl sm:text-3xl" data-testid="ubicaciones-title">
          Ubicaciones
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Notificaciones geolocalizadas de Boomerangme
        </p>
      </div>
      <GeoPushPanel token={token} templatesList={templatesList} />
    </div>
  );
};

export default UbicacionesPage;
