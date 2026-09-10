import React from 'react';
import { Users, UserPlus, Repeat, DollarSign, Receipt } from 'lucide-react';

// Client-facing loyalty-program health metrics — the set the client asked for
// in place of Boomerangme's own confusing dashboard (ROI/retention-cost
// metrics, unreliable gender/device breakdowns). "Total Visitas" is an alias
// for the same number already shown as "Total Operaciones" elsewhere on this
// page, just relabeled for this client-facing section.
export const ClientMetricsCards = ({ insights, formatCurrency }) => {
  const tiles = [
    { icon: Users, label: 'Total Visitas', value: insights?.total_visitas ?? 0 },
    { icon: UserPlus, label: 'Nuevos Miembros', value: insights?.nuevos_miembros ?? 0 },
    { icon: Repeat, label: 'Clientes Habituales', value: insights?.clientes_habituales ?? 0 },
    { icon: DollarSign, label: 'Facturación Total', value: formatCurrency(insights?.total_facturacion || 0) },
    { icon: Receipt, label: 'Venta Promedio', value: formatCurrency(insights?.avg_purchase || 0) }
  ];

  return (
    <div className="card-brutalist" data-testid="client-metrics-cards">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-4 bg-zinc-50 rounded-xl text-center">
            <Icon className="h-5 w-5 mx-auto text-[#5B7CF7] mb-2" />
            <p className="text-xl font-bold text-[#0B0B16]">{value}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
