import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Filter, X, Plus, Trash2 } from 'lucide-react';

// Shared between Clientes (filter + export) and Mensajería (push audience) —
// a "segment" is just a named preset over these same field/operator/value
// filters, so picking "Habituales" means the same thing in both places.
const FIELD_OPTIONS = [
  { value: 'total_visits', label: 'Total Visitas' },
  { value: 'total_purchase_sum', label: 'Facturación Total' },
  { value: 'avg_spend', label: 'Gasto Promedio' },
  { value: 'stamps', label: 'Sellos' },
  { value: 'points_balance', label: 'Puntos / Cashback' },
  { value: 'rewards_available', label: 'Recompensas Disponibles' },
  { value: 'last_seen_at', label: 'Última Visita (fecha)' },
  { value: 'first_seen_at', label: 'Cliente Desde (fecha)' },
];

const DATE_FIELDS = new Set(['last_seen_at', 'first_seen_at']);

const OPERATOR_OPTIONS = [
  { value: 'gte', label: '≥ mayor o igual' },
  { value: 'lte', label: '≤ menor o igual' },
  { value: 'eq', label: '= igual' },
];

const daysAgoIso = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// Fuzzy segments like "cerca de su recompensa" depend on a per-card reward
// threshold Boomerangme doesn't expose uniformly, so they're deliberately
// left out here — only mechanically well-defined presets ship as one-click
// buttons; anything else is buildable via "Filtro personalizado".
const PRESETS = [
  { key: 'nuevos', label: 'Nuevos', build: () => [{ field: 'first_seen_at', operator: 'gte', value: daysAgoIso(30) }] },
  { key: 'habituales', label: 'Habituales', build: () => [{ field: 'total_visits', operator: 'gte', value: 5 }] },
  { key: 'inactivos', label: 'Inactivos', build: () => [{ field: 'last_seen_at', operator: 'lte', value: daysAgoIso(30) }] },
  { key: 'vip', label: 'Alto Valor (VIP)', build: () => [{ field: 'total_purchase_sum', operator: 'gte', value: 100000 }] },
  { key: 'recompensa', label: 'Con Recompensa Disponible', build: () => [{ field: 'rewards_available', operator: 'gte', value: 1 }] },
];

export const SegmentFilterBar = ({ onApply, onClear }) => {
  const [rows, setRows] = useState([]);
  const [activePreset, setActivePreset] = useState(null);

  const addRow = () => setRows([...rows, { field: 'total_visits', operator: 'gte', value: '' }]);
  const updateRow = (i, patch) => {
    setActivePreset(null);
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const applyPreset = (preset) => {
    setActivePreset(preset.key);
    setRows(preset.build());
  };

  const handleApply = () => {
    const valid = rows.filter((r) => r.value !== '' && r.value !== null && r.value !== undefined);
    onApply(valid);
  };

  const handleClear = () => {
    setRows([]);
    setActivePreset(null);
    onClear();
  };

  return (
    <div className="card-brutalist space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-zinc-500 shrink-0" />
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activePreset === p.key ? 'bg-[#0B0B16] text-white' : 'bg-zinc-100 text-zinc-600 hover:text-[#0B0B16]'
            }`}
            data-testid={`segment-preset-${p.key}`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={addRow}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 hover:text-[#0B0B16] flex items-center gap-1"
          data-testid="segment-add-custom-filter"
        >
          <Plus className="h-3 w-3" /> Filtro personalizado
        </button>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <Select value={row.field} onValueChange={(v) => updateRow(i, { field: v, value: '' })}>
                <SelectTrigger className="w-[180px]" data-testid={`segment-field-${i}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={row.operator} onValueChange={(v) => updateRow(i, { operator: v })}>
                <SelectTrigger className="w-[160px]" data-testid={`segment-operator-${i}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type={DATE_FIELDS.has(row.field) ? 'date' : 'number'}
                value={row.value}
                onChange={(e) => updateRow(i, { value: DATE_FIELDS.has(row.field) ? e.target.value : e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-[140px]"
                data-testid={`segment-value-${i}`}
              />
              <button onClick={() => removeRow(i)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors" aria-label="Quitar filtro">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button onClick={handleApply} className="btn-primary" size="sm" data-testid="segment-apply">
              Aplicar
            </Button>
            <Button variant="outline" onClick={handleClear} size="sm" className="border-2 border-zinc-200" data-testid="segment-clear">
              <X className="h-4 w-4 mr-1" /> Limpiar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
