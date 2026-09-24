import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Repeat2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { API_BASE_URL as API } from '../../config/api';

// Weekly, not daily — with one-day windows "2+ visits" or "retention" has
// almost no signal (most businesses don't see the same customer twice in
// 24h). See GET /operations/weekly-performance-trend for the exact
// definitions: engagement = % of this week's active customers with 2+
// visits this week; retention = % of last week's active customers who came
// back this week (period-over-period, not cohort-based).
export const EngagementRetentionChart = ({ token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/operations/weekly-performance-trend`, {
        params: { weeks: 8 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const series = data?.series || [];
  const hasActivity = series.some((d) => d.active_customers > 0);

  return (
    <div className="card-brutalist">
      <h3 className="text-lg font-semibold text-[#0B0B16] mb-1 flex items-center gap-2">
        <Repeat2 className="h-5 w-5 text-[#8CA4FE]" />
        Interacción y Retención (semanal)
      </h3>
      <p className="text-xs text-zinc-500 mb-4">
        Interacción: % de clientes activos con 2+ visitas esa semana. Retención: % de los clientes de la semana anterior que volvieron.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : hasActivity ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
            <XAxis
              dataKey="week_start"
              tick={{ fontSize: 11, fill: '#71717A' }}
              tickLine={false}
              tickFormatter={(d) => new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit' })}
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <Tooltip
              labelFormatter={(d) => `Semana del ${new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
              formatter={(value, name) => [`${Math.round(value * 100)}%`, name === 'engagement_rate' ? 'Interacción' : 'Retención']}
            />
            <Legend formatter={(value) => value === 'engagement_rate' ? 'Interacción' : 'Retención'} wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="engagement_rate" stroke="#8CA4FE" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="retention_rate" stroke="#0B0B16" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-zinc-500 text-sm text-center py-12">
          Aún no hay suficiente actividad en las últimas semanas para mostrar una tendencia
        </p>
      )}
    </div>
  );
};
