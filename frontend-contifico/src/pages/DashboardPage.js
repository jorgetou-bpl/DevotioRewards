import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { PeriodFilter } from '../components/PeriodFilter';
import { ResolveModal } from '../components/ResolveModal';
import { Loader2, RefreshCw } from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';
import { formatCurrency } from '../lib/currency';

const StatCard = ({ label, value, sub, color }) => {
  const dot = {
    blue: 'bg-[#5B7CF7]', emerald: 'bg-emerald-500', amber: 'bg-amber-400',
  }[color] || 'bg-zinc-400';
  return (
    <div className="card-brutalist px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="text-zinc-500 text-xs uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-[#0B0B16]">{value}</p>
      {sub && <p className="text-zinc-400 text-xs mt-1">{sub}</p>}
    </div>
  );
};

const DashboardPage = () => {
  const [periodState, setPeriodState] = useState({ period: 'today' });
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const statsParams = { period: periodState.period };
      if (periodState.period === 'custom') {
        statsParams.from_date = periodState.from;
        statsParams.to_date = periodState.to;
      }
      const [statsRes, pendingRes, recentRes] = await Promise.all([
        axios.get(`${API}/contifico/stats`, { params: statsParams }),
        axios.get(`${API}/contifico/transactions`, { params: { status: 'pending', items_per_page: 20 } }),
        axios.get(`${API}/contifico/transactions`, { params: { items_per_page: 15 } }),
      ]);
      setStats(statsRes.data.stats);
      setPending(pendingRes.data.transactions || []);
      setRecent(recentRes.data.transactions || []);
    } catch (error) {
      toast.error('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, [periodState]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000); // simple polling refresh, no realtime infra needed at this scale
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleResolved = () => {
    setResolving(null);
    fetchAll();
  };

  const lastSyncLabel = stats?.last_sync
    ? new Date(stats.last_sync).toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Sin sincronizar aún';

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-heading text-xl sm:text-2xl">Panel de cashback</h1>
            <p className="text-zinc-500 text-xs sm:text-sm">Contífico × Devotio Rewards</p>
          </div>
          <button onClick={fetchAll} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors" aria-label="Actualizar">
            <RefreshCw className="h-5 w-5 text-[#0B0B16]" />
          </button>
        </div>

        <PeriodFilter period={periodState.period} onChange={setPeriodState} />

        {loading && !stats ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="Transacciones" value={stats?.total_transactions ?? 0} color="blue" />
              <StatCard label="Cashback acreditado" value={formatCurrency(stats?.total_credited ?? 0)} color="emerald" />
              <StatCard label="Sin match Devotio" value={stats?.pending_count ?? 0} color="amber" />
              <StatCard label="Última sincronización" value={lastSyncLabel} color="blue" />
            </div>

            {/* Pending resolution panel — the "sin match" reconciliation view */}
            <div className="card-brutalist overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#0B0B16]">Transacciones pendientes</h2>
                {pending.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
                )}
              </div>
              {pending.length === 0 ? (
                <div className="px-4 py-8 text-center text-zinc-400 text-sm">
                  Sin pendientes — todas las transacciones tienen match ✓
                </div>
              ) : (
                pending.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 last:border-0" data-testid={`pending-${tx.id}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0B0B16] truncate">{tx.customer_name || tx.customer_phone || tx.customer_cedula || 'Sin datos'}</p>
                      <p className="text-xs text-zinc-400">Factura #{tx.documento_numero}</p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0 flex flex-col items-end gap-1">
                      <p className="text-sm font-semibold">{formatCurrency(tx.amount)}</p>
                      <button
                        onClick={() => setResolving(tx)}
                        className="text-xs px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                        data-testid={`resolve-button-${tx.id}`}
                      >
                        Resolver →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Recent transactions — both matched and pending */}
            <div className="card-brutalist overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200">
                <h2 className="text-sm font-semibold text-[#0B0B16]">Transacciones recientes</h2>
              </div>
              {recent.length === 0 ? (
                <div className="px-4 py-8 text-center text-zinc-400 text-sm">Sin transacciones todavía</div>
              ) : (
                recent.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 last:border-0 text-sm">
                    <div className="min-w-0">
                      <p className="text-[#0B0B16] truncate">{tx.customer_name || 'N/A'}</p>
                      <p className="text-xs text-zinc-400">{tx.created_at ? new Date(tx.created_at).toLocaleString('es-EC') : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="font-mono text-xs">{formatCurrency(tx.amount)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'processed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {tx.status === 'processed' ? 'Match' : 'Sin match'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      {resolving && (
        <ResolveModal transaction={resolving} onClose={() => setResolving(null)} onResolved={handleResolved} />
      )}
    </div>
  );
};

export default DashboardPage;
