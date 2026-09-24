import React from 'react';
import { Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Reuses the trend `data` already fetched by TrendChart (same series/date
// range/granularity) instead of firing its own identical request — see
// TrendChart's onDataChange prop. Single-metric line chart, used for Active
// Customers and Average Spend.
export const SimpleTrendLineChart = ({ title, icon: Icon, data, loading, dataKey, valueFormatter, color = '#5B7CF7' }) => {
  const isHourly = data?.granularity === 'hour';
  const series = data?.series || [];
  const hasActivity = series.some((d) => (d[dataKey] || 0) > 0);
  const format = valueFormatter || ((v) => v);

  return (
    <div className="card-brutalist">
      <h3 className="text-lg font-semibold text-[#0B0B16] mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-[#8CA4FE]" />
        {title}
      </h3>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : hasActivity ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#71717A' }}
              tickLine={false}
              tickFormatter={isHourly ? undefined : (d) => new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit' })}
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} width={40} tickFormatter={format} />
            <Tooltip
              labelFormatter={isHourly ? undefined : (d) => new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              formatter={(value) => [format(value), title]}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-zinc-500 text-sm text-center py-12">
          Aún no hay suficiente actividad en este período para mostrar una tendencia
        </p>
      )}
    </div>
  );
};
