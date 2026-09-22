import React, { useState } from 'react';

const TABS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Personalizado' },
];

export const PeriodFilter = ({ period, onChange }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange({ period: tab.id })}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === tab.id ? 'bg-[#5B7CF7] text-white' : 'bg-zinc-100 text-zinc-500 hover:text-[#0B0B16] hover:bg-zinc-200'
            }`}
            data-testid={`period-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={from}
            max={today}
            onChange={(e) => setFrom(e.target.value)}
            className="input-brutalist text-sm px-3 py-1.5"
          />
          <span className="text-zinc-400 text-sm">→</span>
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            className="input-brutalist text-sm px-3 py-1.5"
          />
          <button
            onClick={() => from && to && onChange({ period: 'custom', from, to })}
            disabled={!from || !to}
            className="btn-primary px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
};
