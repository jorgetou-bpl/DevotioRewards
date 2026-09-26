import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL as API } from '../config/api';

// New sidebar destination (`/tarjetas`). This first pass only lists the
// workspace's templates — overview/transacciones/clientes/push por tarjeta
// (using the already-existing template_id filters on /operations/summary
// and /operations) lands as a follow-up pass on top of this shell.
const TarjetasPage = () => {
  const { token } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setTemplates(res.data?.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6" data-testid="tarjetas-page">
      <div className="mb-6">
        <h2 className="text-heading text-2xl sm:text-3xl" data-testid="tarjetas-title">
          Tarjetas
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Programas de lealtad configurados en este workspace
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
        </div>
      ) : templates.length === 0 ? (
        <div className="card-brutalist text-center py-12">
          <CreditCard className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
          <p className="text-zinc-500">No hay tarjetas configuradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="card-brutalist p-4 flex items-center gap-3" data-testid={`tarjeta-card-${t.id}`}>
              <CreditCard className="h-6 w-6 text-[#5B7CF7] shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-[#0B0B16] truncate">{t.name}</p>
                <p className="text-xs text-zinc-500 capitalize">{t.type}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TarjetasPage;
