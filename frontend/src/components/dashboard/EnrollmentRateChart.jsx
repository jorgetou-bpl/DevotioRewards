import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, UserPlus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL as API } from '../../config/api';

// % de las visitas de cada día que fueron de un cliente nuevo — sin
// selector propio, driven por startDate/endDate (el filtro de página en
// OperationsPage.js), mismo contrato que TrendChart.
export const EnrollmentRateChart = ({ token, startDate, endDate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/operations/enrollment-trend`, {
        params: { start_date: startDate, end_date: endDate },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const series = data?.series || [];
  const hasActivity = series.some((d) => d.total_visits > 0);

  return (
    <div className="card-brutalist">
      <h3 className="text-lg font-semibold text-[#0B0B16] flex items-center gap-2 mb-1">
        <UserPlus className="h-5 w-5 text-[#8CA4FE]" />
        Tasa de Inscripción
      </h3>
      <p className="text-xs text-zinc-500 mb-4">% de las visitas del día que fueron de un cliente nuevo (primera vez)</p>

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
              tickFormatter={(d) => new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit' })}
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <Tooltip
              labelFormatter={(d) => new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              formatter={(value, name, props) => [`${Math.round(value * 100)}% (${props.payload.new_customers}/${props.payload.total_visits})`, 'Tasa de Inscripción']}
            />
            <Line type="monotone" dataKey="enrollment_rate" stroke="#5B7CF7" strokeWidth={2} dot={false} />
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
