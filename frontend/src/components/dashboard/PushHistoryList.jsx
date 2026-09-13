import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Loader2, Bell } from 'lucide-react';
import { API_BASE_URL as API } from '../../config/api';
import { formatDate } from '../../utils/format';

const STATUS_LABEL = {
  sent: 'Enviado',
  scheduled: 'Programado',
  pending: 'Pendiente',
  failed: 'Fallido'
};

// History of past pushes — same fetch/pagination shape as CustomerBaseTab,
// proxied live from Boomerangme (no local copy, see project plan).
export const PushHistoryList = ({ token, templatesList, refreshKey }) => {
  const [pushes, setPushes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });

  const templateName = useCallback(
    (templateId) => templatesList.find((t) => String(t.id) === String(templateId))?.name || `#${templateId}`,
    [templatesList]
  );

  const fetchPushes = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/notifications/pushes`, {
        params: { page, items_per_page: 10 },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setPushes(response.data.pushes);
        setMeta(response.data.meta);
      }
    } catch {
      setPushes([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPushes(1); }, [fetchPushes, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (pushes.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="h-10 w-10 mx-auto text-zinc-300 mb-2" />
        <p className="text-zinc-500 text-sm">Todavía no se ha enviado ninguna notificación</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-zinc-100">
        {pushes.map((p) => (
          <div key={p.id} className="py-3" data-testid="push-history-row">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-[#0B0B16] break-words">{p.message}</p>
              <span className="text-xs font-medium text-zinc-500 shrink-0 whitespace-nowrap">
                {STATUS_LABEL[p.status] || p.status || '-'}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-zinc-400">
              <span>{templateName(p.template_id)}</span>
              <span>
                {p.sent_amount != null && `${p.delivered_amount ?? 0}/${p.sent_amount} entregados · `}
                {formatDate(p.scheduled_at || p.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {meta.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => fetchPushes(meta.page - 1)} disabled={meta.page <= 1} className="border-2 border-zinc-200">
            Anterior
          </Button>
          <span className="text-sm text-zinc-600 px-4">Página {meta.page} de {meta.total_pages}</span>
          <Button variant="outline" onClick={() => fetchPushes(meta.page + 1)} disabled={meta.page >= meta.total_pages} className="border-2 border-zinc-200">
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
};
