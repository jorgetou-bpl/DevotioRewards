import React from 'react';
import { Loader2, Cake } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#8CA4FE', '#5B7CF7', '#4A6AE0', '#3955C4', '#0B0B16'];

// First real usage of recharts in this app (already installed, unused until
// now). Age comes from customer_stats.date_of_birth, populated
// opportunistically on scan (see upsert_customer_stats) — no bulk backfill,
// so this starts sparse for a new workspace and fills in with real usage.
export const AgeDistributionChart = ({ data, loading }) => {
  const hasData = data?.some((d) => d.count > 0);

  return (
    <div className="card-brutalist">
      <h3 className="text-lg font-semibold text-[#0B0B16] mb-4 flex items-center gap-2">
        <Cake className="h-5 w-5 text-[#8CA4FE]" />
        Distribución por Edad
      </h3>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#71717A' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#71717A' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip cursor={{ fill: 'rgba(91,124,247,0.08)' }} formatter={(v) => [`${v} clientes`, '']} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => <Cell key={entry.label} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-zinc-500 text-sm text-center py-8">
          Aún no hay suficientes datos de edad — se irán agregando con cada escaneo
        </p>
      )}
    </div>
  );
};
