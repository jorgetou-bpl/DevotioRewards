import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { API_BASE_URL as API } from '../../config/api';

const PERIODS = [7, 30, 90];

const calcDelta = (current, previous) => {
  if (!previous) return current > 0 ? { pct: null, direction: 'up' } : { pct: 0, direction: 'flat' };
  const pct = ((current - previous) / previous) * 100;
  return { pct, direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
};

const DeltaBadge = ({ label, delta }) => {
  const Icon = delta.direction === 'up' ? TrendingUp : delta.direction === 'down' ? TrendingDown : Minus;
  const color = delta.direction === 'up' ? 'text-green-600' : delta.direction === 'down' ? 'text-red-500' : 'text-zinc-400';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`flex items-center gap-0.5 text-xs font-semibold ${color}`}>
        <Icon className="h-3 w-3" />
        {delta.pct === null ? 'nuevo' : `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(0)}%`}
      </span>
    </div>
  );
};

// First multi-series chart in the app (AgeDistributionChart is single-series)
// — reuses the same visual language: card-brutalist wrapper, #8CA4FE/#5B7CF7
// palette, CartesianGrid horizontal-only, same loading/empty conventions.
export const TrendChart = ({ token, cardType, templateId, formatCurrency }) => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    try {
      const params = { days };
      if (cardType) params.card_type = cardType;
      if (templateId) params.template_id = templateId;
      const response = await axios.get(`${API}/operations/trend`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, days, cardType, templateId]);

  useEffect(() => { fetchTrend(); }, [fetchTrend]);

  const hasActivity = data?.series?.some((d) => d.operations_count > 0);
  const opsDelta = data ? calcDelta(data.current_period.operations_count, data.previous_period.operations_count) : null;
  const salesDelta = data ? calcDelta(data.current_period.sales_total, data.previous_period.sales_total) : null;

  return (
    <div className="card-brutalist" data-testid="trend-chart">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-lg font-semibold text-[#0B0B16]">Tendencia en el Tiempo</h3>
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                days === p ? 'bg-white text-[#0B0B16] shadow-sm' : 'text-zinc-500 hover:text-[#0B0B16]'
              }`}
              data-testid={`trend-period-${p}`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : hasActivity ? (
        <>
          <div className="flex items-center gap-6 mb-4">
            <DeltaBadge label="Operaciones vs período anterior" delta={opsDelta} />
            <DeltaBadge label="Ventas vs período anterior" delta={salesDelta} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#71717A' }}
                tickLine={false}
                tickFormatter={(d) => new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit' })}
                minTickGap={20}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#71717A' }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip
                labelFormatter={(d) => new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                formatter={(value, name) => name === 'sales_total' ? [formatCurrency(value), 'Ventas'] : [value, 'Operaciones']}
              />
              <Legend formatter={(value) => value === 'sales_total' ? 'Ventas' : 'Operaciones'} wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="operations_count" fill="#8CA4FE" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="sales_total" stroke="#5B7CF7" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      ) : (
        <p className="text-zinc-500 text-sm text-center py-12">
          Aún no hay suficiente actividad en este período para mostrar una tendencia
        </p>
      )}
    </div>
  );
};
