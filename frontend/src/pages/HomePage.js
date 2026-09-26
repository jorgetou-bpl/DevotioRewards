import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Filter,
  Loader2,
  ChevronDown,
  Check,
  X,
  Users,
  BarChart3,
  ClipboardList,
  ArrowRight,
  DollarSign,
  Receipt,
  UserPlus,
  Repeat,
  Activity,
  Wallet
} from 'lucide-react';

import { ClientMetricsCards } from '../components/dashboard/ClientMetricsCards';
import { TrendChart } from '../components/dashboard/TrendChart';
import { SimpleTrendLineChart } from '../components/dashboard/SimpleTrendLineChart';
import { TopCustomersList } from '../components/dashboard/TopCustomersList';
import { AgeDistributionChart } from '../components/dashboard/AgeDistributionChart';
import { RecurrenceChart } from '../components/dashboard/RecurrenceChart';
import { NewCustomersByMonthChart } from '../components/dashboard/NewCustomersByMonthChart';
import { RewardsSummary } from '../components/dashboard/RewardsSummary';
import { EnrollmentRateChart } from '../components/dashboard/EnrollmentRateChart';
import { EngagementRetentionChart } from '../components/dashboard/EngagementRetentionChart';
import { formatDate } from '../utils/format';
import { API_BASE_URL as API } from '../config/api';

// Home — was the "dashboard" tab inside OperationsPage.js; Historial and
// Clientes are now their own routes (HistorialPage.js, ClientesPage.js)
// reachable from AppLayout's sidebar instead of internal tabs.
const HomePage = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { formatCurrency } = useSettings();

  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardFilters, setDashboardFilters] = useState({ card_types: [] });
  const [dashboardCardType, setDashboardCardType] = useState('');
  const [dashboardCardTypeDropdownOpen, setDashboardCardTypeDropdownOpen] = useState(false);
  const [dashboardTemplateId, setDashboardTemplateId] = useState('');
  const [dashboardTemplateDropdownOpen, setDashboardTemplateDropdownOpen] = useState(false);
  const [showDashboardFilters, setShowDashboardFilters] = useState(true);

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const daysAgoStr = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const [dashboardStartDate, setDashboardStartDate] = useState(todayStr());
  const [dashboardEndDate, setDashboardEndDate] = useState(todayStr());

  const [rewardsSummary, setRewardsSummary] = useState(null);
  const [rewardsSummaryLoading, setRewardsSummaryLoading] = useState(false);
  const [recurrence, setRecurrence] = useState(null);
  const [recurrenceLoading, setRecurrenceLoading] = useState(false);

  // Captured from TrendChart's own fetch (via onDataChange) so
  // ActiveCustomersTrendChart/AvgSpendTrendChart can reuse the same series
  // instead of each firing an identical request for the same date range.
  const [trendData, setTrendData] = useState(null);

  const [recentOps, setRecentOps] = useState([]);
  const [loadingRecentOps, setLoadingRecentOps] = useState(false);
  const [ageDistribution, setAgeDistribution] = useState(null);
  const [ageDistributionLoading, setAgeDistributionLoading] = useState(false);

  // Toggle for the Top 10 list — both rankings already come in the same
  // /operations/summary payload (top_customers_by_visits/by_purchase), so
  // this is purely a client-side switch, no extra fetch.
  const [topRankingMetric, setTopRankingMetric] = useState('visits'); // 'visits' | 'purchase'

  const [templatesList, setTemplatesList] = useState([]);

  useEffect(() => {
    axios.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setTemplatesList(res.data?.templates || []))
      .catch(() => setTemplatesList([]));
  }, [token]);

  const fetchDashboard = useCallback(async () => {
    try {
      setDashboardLoading(true);
      const params = new URLSearchParams();
      if (dashboardStartDate) params.append('start_date', dashboardStartDate);
      if (dashboardEndDate) params.append('end_date', dashboardEndDate);
      if (dashboardCardType) params.append('card_type', dashboardCardType);
      if (dashboardTemplateId) params.append('template_id', dashboardTemplateId);

      const response = await axios.get(`${API}/operations/summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setDashboardData(response.data.summary);
        if (response.data.filters) {
          setDashboardFilters(response.data.filters);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Error al cargar dashboard');
    } finally {
      setDashboardLoading(false);
    }
  }, [token, dashboardStartDate, dashboardEndDate, dashboardCardType, dashboardTemplateId]);

  const fetchRewardsSummary = useCallback(async () => {
    setRewardsSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (dashboardStartDate) params.append('start_date', dashboardStartDate);
      if (dashboardEndDate) params.append('end_date', dashboardEndDate);
      const response = await axios.get(`${API}/operations/rewards-summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRewardsSummary(response.data?.rewards || null);
    } catch { setRewardsSummary(null); }
    finally { setRewardsSummaryLoading(false); }
  }, [token, dashboardStartDate, dashboardEndDate]);

  const fetchRecurrence = useCallback(async () => {
    setRecurrenceLoading(true);
    try {
      const response = await axios.get(`${API}/customer-insights/visit-recurrence`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecurrence(response.data?.buckets || null);
    } catch { setRecurrence(null); }
    finally { setRecurrenceLoading(false); }
  }, [token]);

  const fetchRecentOps = useCallback(async () => {
    setLoadingRecentOps(true);
    try {
      const response = await axios.get(`${API}/operations`, {
        params: { page: 1, items_per_page: 6 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentOps(response.data?.operations || []);
    } catch { setRecentOps([]); }
    finally { setLoadingRecentOps(false); }
  }, [token]);

  const fetchAgeDistribution = useCallback(async () => {
    if (!['workspace_admin', 'super_admin'].includes(user?.role)) return;
    setAgeDistributionLoading(true);
    try {
      const response = await axios.get(`${API}/customer-insights/age-distribution`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgeDistribution(response.data);
    } catch { setAgeDistribution(null); }
    finally { setAgeDistributionLoading(false); }
  }, [token, user?.role]);

  useEffect(() => {
    fetchDashboard();
    fetchRecentOps();
    fetchAgeDistribution();
    fetchRewardsSummary();
    fetchRecurrence();
  }, [fetchDashboard, fetchRecentOps, fetchAgeDistribution, fetchRewardsSummary, fetchRecurrence]);

  const isDefaultDashboardDateRange = dashboardStartDate === todayStr() && dashboardEndDate === todayStr();
  const dashboardActiveFilterCount = [
    !isDefaultDashboardDateRange, dashboardCardType, dashboardTemplateId
  ].filter(Boolean).length;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" data-testid="home-page">
      <div className="mb-6">
        <h2 className="text-heading text-2xl sm:text-3xl" data-testid="home-title">
          Dashboard
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Historial y rendimiento de transacciones
        </p>
      </div>

      <div className="space-y-6">
        {/* Filtros del Dashboard — visibles por defecto: es el único control
            de fecha de toda la página, incluida la Tendencia (que ya no
            tiene su propio selector). */}
        <div>
          <button
            onClick={() => setShowDashboardFilters(!showDashboardFilters)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-[#0B0B16] transition-colors"
            data-testid="toggle-dashboard-filters"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {dashboardActiveFilterCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-[#5B7CF7] text-white text-xs font-semibold">
                {dashboardActiveFilterCount}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${showDashboardFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {showDashboardFilters && (
          <div className="card-brutalist">
            <div className="flex items-center gap-2 mb-4">
              {[
                { label: 'Hoy', start: todayStr(), end: todayStr() },
                { label: '7 días', start: daysAgoStr(6), end: todayStr() },
                { label: '30 días', start: daysAgoStr(29), end: todayStr() },
                { label: '90 días', start: daysAgoStr(89), end: todayStr() },
              ].map((preset) => {
                const active = dashboardStartDate === preset.start && dashboardEndDate === preset.end;
                return (
                  <button
                    key={preset.label}
                    onClick={() => { setDashboardStartDate(preset.start); setDashboardEndDate(preset.end); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      active ? 'bg-[#0B0B16] text-white' : 'bg-zinc-100 text-zinc-600 hover:text-[#0B0B16]'
                    }`}
                    data-testid={`dashboard-preset-${preset.label}`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Fecha inicio
                </label>
                <Input
                  type="date"
                  value={dashboardStartDate}
                  onChange={(e) => setDashboardStartDate(e.target.value)}
                  className="border-2 border-zinc-200"
                  data-testid="dashboard-start-date"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Fecha fin
                </label>
                <Input
                  type="date"
                  value={dashboardEndDate}
                  onChange={(e) => setDashboardEndDate(e.target.value)}
                  className="border-2 border-zinc-200"
                  data-testid="dashboard-end-date"
                />
              </div>
              <div className="flex-1 relative">
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Tipo de tarjeta
                </label>
                <button
                  onClick={() => setDashboardCardTypeDropdownOpen(!dashboardCardTypeDropdownOpen)}
                  className="w-full flex items-center justify-between p-2 border-2 border-zinc-200 rounded-md hover:border-[#0B0B16] transition-colors bg-white h-10"
                  data-testid="dashboard-card-type-dropdown"
                >
                  <span className={dashboardCardType ? 'text-[#0B0B16]' : 'text-zinc-400'}>
                    {dashboardCardType || 'Todos'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${dashboardCardTypeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dashboardCardTypeDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => {
                        setDashboardCardType('');
                        setDashboardCardTypeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${!dashboardCardType ? 'bg-purple-50' : ''}`}
                    >
                      <span>Todos</span>
                      {!dashboardCardType && <Check className="h-4 w-4 text-[#0B0B16]" />}
                    </button>
                    {dashboardFilters.card_types?.map((cardType) => (
                      <button
                        key={cardType}
                        onClick={() => {
                          setDashboardCardType(cardType);
                          setDashboardTemplateId('');
                          setDashboardCardTypeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${dashboardCardType === cardType ? 'bg-purple-50' : ''}`}
                      >
                        <span className="capitalize">{cardType || 'Sin tipo'}</span>
                        {dashboardCardType === cardType && <Check className="h-4 w-4 text-[#0B0B16]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {dashboardCardType && templatesList.some((t) => t.type === dashboardCardType) && (
                <div className="flex-1 relative">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Tarjeta específica
                  </label>
                  <button
                    onClick={() => setDashboardTemplateDropdownOpen(!dashboardTemplateDropdownOpen)}
                    className="w-full flex items-center justify-between p-2 border-2 border-zinc-200 rounded-md hover:border-[#0B0B16] transition-colors bg-white h-10"
                    data-testid="dashboard-template-dropdown"
                  >
                    <span className={dashboardTemplateId ? 'text-[#0B0B16]' : 'text-zinc-400'}>
                      {templatesList.find((t) => String(t.id) === dashboardTemplateId)?.name || 'Todas'}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${dashboardTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dashboardTemplateDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      <button
                        onClick={() => { setDashboardTemplateId(''); setDashboardTemplateDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${!dashboardTemplateId ? 'bg-purple-50' : ''}`}
                      >
                        <span>Todas</span>
                        {!dashboardTemplateId && <Check className="h-4 w-4 text-[#0B0B16]" />}
                      </button>
                      {templatesList.filter((t) => t.type === dashboardCardType).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setDashboardTemplateId(String(t.id)); setDashboardTemplateDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${dashboardTemplateId === String(t.id) ? 'bg-purple-50' : ''}`}
                        >
                          <span>{t.name}</span>
                          {dashboardTemplateId === String(t.id) && <Check className="h-4 w-4 text-[#0B0B16]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button
                onClick={fetchDashboard}
                className="btn-primary"
                disabled={dashboardLoading}
                data-testid="apply-dashboard-filter"
              >
                {dashboardLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
              </Button>
              {(!isDefaultDashboardDateRange || dashboardCardType || dashboardTemplateId) && (
                <Button
                  variant="outline"
                  onClick={() => { setDashboardStartDate(todayStr()); setDashboardEndDate(todayStr()); setDashboardCardType(''); setDashboardTemplateId(''); }}
                  className="border-2 border-zinc-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Tendencia arriba de todo, independiente de dashboardData —
            tiene su propio fetch pero usa el mismo rango de fechas del
            filtro de página (sin selector propio). */}
        <TrendChart
          token={token}
          startDate={dashboardStartDate}
          endDate={dashboardEndDate}
          cardType={dashboardCardType}
          templateId={dashboardTemplateId}
          formatCurrency={formatCurrency}
          onDataChange={setTrendData}
        />

        {dashboardLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
          </div>
        ) : dashboardData ? (
          <>
            {/* Pilar: Finanzas */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#5B7CF7] mb-3">Finanzas</h2>
              <div className="space-y-4">
                <ClientMetricsCards tiles={[
                  { icon: DollarSign, label: 'Facturación Total', value: formatCurrency(dashboardData.customer_insights?.total_facturacion || 0) },
                  { icon: Receipt, label: 'Venta Promedio', value: formatCurrency(dashboardData.customer_insights?.avg_purchase || 0) }
                ]} />
                <RewardsSummary rewards={rewardsSummary} formatCurrency={formatCurrency} loading={rewardsSummaryLoading} />
              </div>
            </section>

            {/* Pilar: Visitas */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#5B7CF7] mb-3">Visitas</h2>
              <div className="space-y-4">
                <ClientMetricsCards tiles={[
                  { icon: Users, label: 'Total Visitas', value: dashboardData.customer_insights?.total_visitas ?? 0 },
                  { icon: UserPlus, label: 'Nuevos Miembros', value: dashboardData.customer_insights?.nuevos_miembros ?? 0 },
                  { icon: Repeat, label: 'Clientes Habituales', value: dashboardData.customer_insights?.clientes_habituales ?? 0 }
                ]} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SimpleTrendLineChart
                    title="Clientes Activos"
                    icon={Activity}
                    data={trendData}
                    loading={!trendData}
                    dataKey="active_customers"
                  />
                  <SimpleTrendLineChart
                    title="Gasto Promedio"
                    icon={Wallet}
                    data={trendData}
                    loading={!trendData}
                    dataKey="avg_spend"
                    valueFormatter={formatCurrency}
                    color="#0B0B16"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TopCustomersList
                    title="Top 10 Clientes"
                    icon={Users}
                    data={topRankingMetric === 'visits'
                      ? dashboardData.customer_insights?.top_customers_by_visits
                      : dashboardData.customer_insights?.top_customers_by_purchase}
                    valueKey={topRankingMetric === 'visits' ? 'visit_count' : 'total_purchase'}
                    valueFormatter={topRankingMetric === 'purchase' ? formatCurrency : undefined}
                    headerRight={
                      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                        <button
                          onClick={() => setTopRankingMetric('visits')}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            topRankingMetric === 'visits' ? 'bg-white text-[#0B0B16] shadow-sm' : 'text-zinc-500 hover:text-[#0B0B16]'
                          }`}
                          data-testid="top-ranking-by-visits"
                        >
                          Visitas
                        </button>
                        <button
                          onClick={() => setTopRankingMetric('purchase')}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            topRankingMetric === 'purchase' ? 'bg-white text-[#0B0B16] shadow-sm' : 'text-zinc-500 hover:text-[#0B0B16]'
                          }`}
                          data-testid="top-ranking-by-purchase"
                        >
                          Compras
                        </button>
                      </div>
                    }
                  />
                  {['workspace_admin', 'super_admin'].includes(user?.role) && (
                    <AgeDistributionChart data={ageDistribution?.buckets} loading={ageDistributionLoading} />
                  )}
                  <NewCustomersByMonthChart token={token} />
                  <RecurrenceChart data={recurrence} loading={recurrenceLoading} />
                </div>
              </div>
            </section>

            {/* Pilar: Desempeño */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#5B7CF7] mb-3">Desempeño</h2>
              <div className="space-y-4">
                <EnrollmentRateChart token={token} startDate={dashboardStartDate} endDate={dashboardEndDate} />
                <EngagementRetentionChart token={token} />
              </div>
            </section>

            {/* Actividad Reciente — al final: es la vista operativa del
                día a día, no parte del resumen ejecutivo de arriba. */}
            <div className="card-brutalist">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#0B0B16] flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-[#8CA4FE]" />
                  Actividad Reciente
                </h3>
                <button onClick={() => navigate('/historial')}
                  className="text-xs font-medium text-[#5B7CF7] hover:underline flex items-center gap-1"
                  data-testid="view-full-history">
                  Ver historial completo <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {loadingRecentOps ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
              ) : recentOps.length > 0 ? (
                <div className="divide-y divide-zinc-100">
                  {recentOps.map((op, index) => (
                    <div key={op.id || index} className="flex items-center justify-between py-3" data-testid={`recent-op-${index}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0B0B16] truncate">{op.customer_name || 'Cliente'}</p>
                        <p className="text-xs text-zinc-500">
                          {op.operation_label || op.operation_type} · {op.card_type_label || op.card_type}
                        </p>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        {op.purchase_sum > 0 && <p className="text-sm font-semibold text-[#0B0B16]">{formatCurrency(op.purchase_sum)}</p>}
                        <p className="text-xs text-zinc-400">{formatDate(op.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClipboardList className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
                  <p className="text-zinc-500">Sin actividad reciente</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">No hay datos disponibles</p>
          </div>
        )}
      </div>

      <div className="text-center mt-8 text-zinc-400 text-xs sm:text-sm">
        <p>Devotio Rewards Scanner v1.1.0</p>
      </div>
    </div>
  );
};

export default HomePage;
