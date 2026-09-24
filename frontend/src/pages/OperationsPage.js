import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Filter,
  Loader2,
  Calendar,
  User,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Check,
  X,
  RefreshCw,
  Users,
  Award,
  BarChart3,
  ClipboardList,
  ScanLine,
  Search,
  Settings,
  Bell,
  ArrowRight,
  Menu,
  Home,
  LogOut,
  Building2,
  DollarSign,
  Receipt,
  UserPlus,
  Repeat
} from 'lucide-react';

import { AppMenu } from '../components/AppMenu';
import { ClientMetricsCards } from '../components/dashboard/ClientMetricsCards';
import { TrendChart } from '../components/dashboard/TrendChart';
import { TopCustomersList } from '../components/dashboard/TopCustomersList';
import { AgeDistributionChart } from '../components/dashboard/AgeDistributionChart';
import { RecurrenceChart } from '../components/dashboard/RecurrenceChart';
import { RewardsSummary } from '../components/dashboard/RewardsSummary';
import { CustomerBaseTab } from '../components/dashboard/CustomerBaseTab';
import { formatDate, formatAmount } from '../utils/format';
import { API_BASE_URL as API } from '../config/api';

const OperationsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, logout } = useAuth();
  const { formatCurrency } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);

  // Tab state — this page is Home now, so it opens on the dashboard view;
  // "Historial"/"Clientes" are one tap away via the tab toggle below. Also
  // readable from ?tab=clientes so the Customer Profile page's back button
  // can return here with the right tab already active.
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    return ['dashboard', 'historial', 'clientes'].includes(tab) ? tab : 'dashboard';
  }); // 'historial' | 'dashboard' | 'clientes'
  
  // Operations state
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });
  const [filters, setFilters] = useState({
    gerentes: [],
    operation_types: [],
    card_types: []
  });
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardFilters, setDashboardFilters] = useState({ card_types: [] });
  const [dashboardCardType, setDashboardCardType] = useState('');
  const [dashboardCardTypeDropdownOpen, setDashboardCardTypeDropdownOpen] = useState(false);
  const [dashboardTemplateId, setDashboardTemplateId] = useState('');
  const [dashboardTemplateDropdownOpen, setDashboardTemplateDropdownOpen] = useState(false);
  const [showDashboardFilters, setShowDashboardFilters] = useState(false);

  // Dashboard's own date range — deliberately separate from Historial's
  // startDate/endDate below. Sharing that state would make "Hoy" leak in as
  // Historial's default too, which wasn't asked for. Defaults to today.
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

  // Home-style additions: a quick activity feed (the old fixed rolling
  // 7-day trend badges were replaced by TrendChart, which has its own
  // period selector and fetch).
  const [recentOps, setRecentOps] = useState([]);
  const [loadingRecentOps, setLoadingRecentOps] = useState(false);
  const [ageDistribution, setAgeDistribution] = useState(null);
  const [ageDistributionLoading, setAgeDistributionLoading] = useState(false);

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGerente, setSelectedGerente] = useState('');
  const [selectedOperationType, setSelectedOperationType] = useState('');
  const [selectedCardType, setSelectedCardType] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [gerenteDropdownOpen, setGerenteDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [cardTypeDropdownOpen, setCardTypeDropdownOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  // Real Boomerangme templates for this workspace — used to let the filter
  // target a specific card (e.g. one of two "Sellos" templates with
  // different rules), not just the card type.
  const [templatesList, setTemplatesList] = useState([]);

  useEffect(() => {
    axios.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setTemplatesList(res.data?.templates || []))
      .catch(() => setTemplatesList([]));
  }, [token]);

  const fetchOperations = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('items_per_page', 50);
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedGerente) params.append('gerente', selectedGerente);
      if (selectedOperationType) params.append('operation_type', selectedOperationType);
      if (selectedCardType) params.append('card_type', selectedCardType);
      if (selectedTemplateId) params.append('template_id', selectedTemplateId);

      const response = await axios.get(`${API}/operations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setOperations(response.data.operations);
        setMeta(response.data.meta);
        setFilters(response.data.filters);
      }
    } catch (error) {
      console.error('Error fetching operations:', error);
      toast.error('Error al cargar operaciones');
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, selectedGerente, selectedOperationType, selectedCardType, selectedTemplateId]);

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
    // Backend-gated to workspace_admin/super_admin — skip the call entirely
    // for operators instead of firing a request that's guaranteed to 403.
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
    if (activeTab === 'historial') {
      fetchOperations();
    } else if (activeTab === 'dashboard') {
      fetchDashboard();
      fetchRecentOps();
      fetchAgeDistribution();
      fetchRewardsSummary();
      fetchRecurrence();
    }
    // 'clientes' fetches its own data internally (CustomerBaseTab) — nothing to do here.
  }, [activeTab, fetchOperations, fetchDashboard, fetchRecentOps, fetchAgeDistribution, fetchRewardsSummary, fetchRecurrence]);

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.append('format', format);
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedGerente) params.append('gerente', selectedGerente);
      if (selectedOperationType) params.append('operation_type', selectedOperationType);
      if (selectedCardType) params.append('card_type', selectedCardType);
      if (selectedTemplateId) params.append('template_id', selectedTemplateId);

      const response = await axios.get(`${API}/operations/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `operaciones_${today}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Archivo ${format.toUpperCase()} descargado`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al exportar operaciones');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedGerente('');
    setSelectedOperationType('');
    setSelectedCardType('');
    setSelectedTemplateId('');
  };

  const hasActiveFilters = startDate || endDate || selectedGerente || selectedOperationType || selectedCardType || selectedTemplateId;

  const configPath = (user?.role === 'super_admin' || user?.role === 'workspace_admin') ? '/admin/workspace' : '/settings';
  // "Hoy" is the natural default, not a custom filter — only count the date
  // range if it was moved off of that default, so the badge doesn't show
  // "2 filtros activos" on a fresh page load.
  const isDefaultDashboardDateRange = dashboardStartDate === todayStr() && dashboardEndDate === todayStr();
  const dashboardActiveFilterCount = [
    !isDefaultDashboardDateRange, dashboardCardType, dashboardTemplateId
  ].filter(Boolean).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Same menu everywhere (Home, Scanner) — "Inicio" stays in the list even
  // though we're already here, for consistency with the other pages.
  // "Clientes" is a Home tab now (not a separate destination), so it isn't
  // duplicated here.
  const menuItems = [
    { icon: Home, label: 'Inicio', action: () => navigate('/'), testId: 'menu-home' },
    { icon: Settings, label: 'Configuración', action: () => navigate('/settings'), testId: 'menu-settings' },
    ...(['workspace_admin', 'super_admin'].includes(user?.role) ? [
      { icon: Bell, label: 'Notificaciones', action: () => navigate('/notifications'), testId: 'menu-notifications' }
    ] : []),
    ...(user?.role === 'workspace_admin' ? [
      { icon: Building2, label: 'Admin Workspace', action: () => navigate('/admin/workspace'), testId: 'menu-admin' }
    ] : []),
    ...(user?.role === 'super_admin' ? [
      { icon: Building2, label: 'Panel Super Admin', action: () => navigate('/admin/dashboard'), testId: 'menu-admin' }
    ] : []),
    { icon: LogOut, label: 'Cerrar Sesión', action: handleLogout, testId: 'menu-logout' }
  ];

  return (
    <div className="min-h-screen bg-white" data-testid="operations-page">
      {/* Header */}
      <header className="nav-header">
        <div className="w-10" />
        <img
          src="/fonts/logo.png"
          alt="Devotio Rewards"
          className="h-8 sm:h-10"
        />
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 hover:bg-[#5B7CF7] hover:text-white rounded-lg transition-colors"
          data-testid="menu-button"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6 text-[#0B0B16]" strokeWidth={2} />
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-heading text-2xl sm:text-3xl" data-testid="operations-title">
            Dashboard
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Historial y rendimiento de transacciones
          </p>
        </div>

        {/* Sub-tabs — Dashboard first since this page is Home now */}
        <div className="flex items-center gap-1 mb-6 bg-zinc-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-[#0B0B16] shadow-sm'
                : 'text-zinc-500 hover:text-[#0B0B16]'
            }`}
            data-testid="tab-dashboard"
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'historial'
                ? 'bg-white text-[#0B0B16] shadow-sm'
                : 'text-zinc-500 hover:text-[#0B0B16]'
            }`}
            data-testid="tab-historial"
          >
            <ClipboardList className="h-4 w-4" />
            Historial
          </button>
          {['workspace_admin', 'super_admin'].includes(user?.role) && (
            <button
              onClick={() => setActiveTab('clientes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'clientes'
                  ? 'bg-white text-[#0B0B16] shadow-sm'
                  : 'text-zinc-500 hover:text-[#0B0B16]'
              }`}
              data-testid="tab-clientes"
            >
              <Users className="h-4 w-4" />
              Clientes
            </button>
          )}
        </div>

        {/* Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Escanear is the single most-used action on this screen — it used
                to be the whole app's landing page, so losing one-tap access to
                it would be a real regression for operators. It keeps its own
                prominent primary button; admins get Notificaciones right next
                to it (not in the Buscar/Configuración grid below, which is
                secondary by comparison). */}
            <div className={['workspace_admin', 'super_admin'].includes(user?.role) ? 'grid grid-cols-2 gap-3' : ''}>
              <button onClick={() => navigate('/scanner')}
                className="w-full flex items-center justify-center gap-3 p-5 rounded-xl bg-[#5B7CF7] text-white font-semibold text-base shadow-sm hover:bg-[#4A6AE0] transition-colors"
                data-testid="quick-access-scan">
                <ScanLine className="h-6 w-6" />
                Escanear
              </button>
              {['workspace_admin', 'super_admin'].includes(user?.role) && (
                <button onClick={() => navigate('/notifications')}
                  className="w-full flex items-center justify-center gap-3 p-5 rounded-xl bg-[#0B0B16] text-white font-semibold text-base shadow-sm hover:bg-[#0B0B16]/90 transition-colors"
                  data-testid="quick-access-notifications">
                  <Bell className="h-6 w-6" />
                  Notificaciones
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3" data-testid="quick-access-row">
              <button onClick={() => navigate('/search')}
                className="card-brutalist p-4 flex flex-col items-center gap-2 hover:border-[#5B7CF7] transition-colors"
                data-testid="quick-access-search">
                <Search className="h-6 w-6 text-[#5B7CF7]" />
                <span className="text-xs font-medium text-[#0B0B16]">Buscar cliente</span>
              </button>
              <button onClick={() => navigate(configPath)}
                className="card-brutalist p-4 flex flex-col items-center gap-2 hover:border-[#5B7CF7] transition-colors"
                data-testid="quick-access-config">
                <Settings className="h-6 w-6 text-[#5B7CF7]" />
                <span className="text-xs font-medium text-[#0B0B16]">Configuración</span>
              </button>
            </div>

            {/* Filtros del Dashboard — justo debajo de los accesos rápidos,
                para que sea fácil ver qué filtro está aplicado contra la data
                de abajo, en vez de vivir escondido arriba de todo. Colapsado
                por defecto; el badge muestra cuántos filtros están activos. */}
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
                tiene su propio fetch y su propio selector de 7/30/90 días,
                no depende del filtro de fecha del resto del Dashboard. */}
            <TrendChart
              token={token}
              cardType={dashboardCardType}
              templateId={dashboardTemplateId}
              formatCurrency={formatCurrency}
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
                      <TopCustomersList
                        title="Top 10 por Visitas"
                        icon={Users}
                        data={dashboardData.customer_insights?.top_customers_by_visits}
                        valueKey="visit_count"
                      />
                      {['workspace_admin', 'super_admin'].includes(user?.role) && (
                        <AgeDistributionChart data={ageDistribution?.buckets} loading={ageDistributionLoading} />
                      )}
                    </div>
                    <RecurrenceChart data={recurrence} loading={recurrenceLoading} />
                  </div>
                </section>

                {/* Pilar: Desempeño */}
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#5B7CF7] mb-3">Desempeño</h2>
                  <TopCustomersList
                    title={`Rendimiento por Gerente (${dashboardData.by_gerente?.length || 0} activos)`}
                    icon={Award}
                    data={(dashboardData.by_gerente || []).map((g) => ({ ...g, gerente_name: g._id }))}
                    nameKey="gerente_name"
                    valueKey="count"
                    renderSubtitle={(g) => `${formatCurrency(g.total_purchase_sum || 0)} en ventas`}
                  />
                </section>

                {/* Actividad Reciente — al final: es la vista operativa del
                    día a día, no parte del resumen ejecutivo de arriba. */}
                <div className="card-brutalist">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#0B0B16] flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-[#8CA4FE]" />
                      Actividad Reciente
                    </h3>
                    <button onClick={() => setActiveTab('historial')}
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
        )}

        {/* Historial View */}
        {activeTab === 'historial' && (
          <>
            {/* Actions Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <p className="text-zinc-500 text-sm">
                {meta.total} operaciones registradas
              </p>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`border-2 ${hasActiveFilters ? 'border-[#8CA4FE] text-[#8CA4FE]' : 'border-zinc-200'}`}
                  data-testid="toggle-filters-btn"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {hasActiveFilters && <span className="ml-2 bg-[#8CA4FE] text-white text-xs px-2 py-0.5 rounded-full">!</span>}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => fetchOperations(meta.page)}
                  className="border-2 border-zinc-200"
                  data-testid="refresh-btn"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="card-brutalist mb-6" data-testid="filters-panel">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">
                    Filtros
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-[#8CA4FE] hover:underline flex items-center gap-1"
                      data-testid="clear-filters-btn"
                    >
                      <X className="h-3 w-3" />
                      Limpiar filtros
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Fecha inicio
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="border-2 border-zinc-200"
                      data-testid="start-date-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Fecha fin
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="border-2 border-zinc-200"
                      data-testid="end-date-input"
                    />
                  </div>
                  
                  {/* Gerente Dropdown */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Gerente
                    </label>
                    <button
                      onClick={() => {
                        setGerenteDropdownOpen(!gerenteDropdownOpen);
                        setTypeDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2 border-2 border-zinc-200 rounded-md hover:border-[#0B0B16] transition-colors bg-white"
                      data-testid="gerente-dropdown"
                    >
                      <span className={selectedGerente ? 'text-[#0B0B16]' : 'text-zinc-400'}>
                        {selectedGerente || 'Todos'}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${gerenteDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {gerenteDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedGerente('');
                            setGerenteDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${!selectedGerente ? 'bg-purple-50' : ''}`}
                        >
                          <span>Todos</span>
                          {!selectedGerente && <Check className="h-4 w-4 text-[#0B0B16]" />}
                        </button>
                        {filters.gerentes.map((gerente) => (
                          <button
                            key={gerente}
                            onClick={() => {
                              setSelectedGerente(gerente);
                              setGerenteDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${selectedGerente === gerente ? 'bg-purple-50' : ''}`}
                          >
                            <span>{gerente}</span>
                            {selectedGerente === gerente && <Check className="h-4 w-4 text-[#0B0B16]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Operation Type Dropdown */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Tipo de operación
                    </label>
                    <button
                      onClick={() => {
                        setTypeDropdownOpen(!typeDropdownOpen);
                        setGerenteDropdownOpen(false);
                        setCardTypeDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2 border-2 border-zinc-200 rounded-md hover:border-[#0B0B16] transition-colors bg-white"
                      data-testid="operation-type-dropdown"
                    >
                      <span className={selectedOperationType ? 'text-[#0B0B16]' : 'text-zinc-400'}>
                        {filters.operation_types.find((t) => t.value === selectedOperationType)?.label || 'Todos'}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {typeDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedOperationType('');
                            setTypeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${!selectedOperationType ? 'bg-purple-50' : ''}`}
                        >
                          <span>Todos</span>
                          {!selectedOperationType && <Check className="h-4 w-4 text-[#0B0B16]" />}
                        </button>
                        {filters.operation_types.map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => {
                              setSelectedOperationType(value);
                              setTypeDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${selectedOperationType === value ? 'bg-purple-50' : ''}`}
                          >
                            <span>{label}</span>
                            {selectedOperationType === value && <Check className="h-4 w-4 text-[#0B0B16]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Type Dropdown */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Tipo de tarjeta
                    </label>
                    <button
                      onClick={() => {
                        setCardTypeDropdownOpen(!cardTypeDropdownOpen);
                        setGerenteDropdownOpen(false);
                        setTypeDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2 border-2 border-zinc-200 rounded-md hover:border-[#0B0B16] transition-colors bg-white"
                      data-testid="card-type-dropdown"
                    >
                      <span className={selectedCardType ? 'text-[#0B0B16]' : 'text-zinc-400'}>
                        {selectedCardType || 'Todos'}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${cardTypeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {cardTypeDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedCardType('');
                            setSelectedTemplateId('');
                            setCardTypeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${!selectedCardType ? 'bg-purple-50' : ''}`}
                        >
                          <span>Todos</span>
                          {!selectedCardType && <Check className="h-4 w-4 text-[#0B0B16]" />}
                        </button>
                        {filters.card_types?.map((cardType) => (
                          <button
                            key={cardType}
                            onClick={() => {
                              setSelectedCardType(cardType);
                              setSelectedTemplateId('');
                              setCardTypeDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${selectedCardType === cardType ? 'bg-purple-50' : ''}`}
                          >
                            <span className="capitalize">{cardType || 'Sin tipo'}</span>
                            {selectedCardType === cardType && <Check className="h-4 w-4 text-[#0B0B16]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Specific Card (Template) Dropdown — only when a type is selected and it has multiple templates */}
                  {selectedCardType && templatesList.some((t) => t.type === selectedCardType) && (
                    <div className="relative">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">
                        Tarjeta específica
                      </label>
                      <button
                        onClick={() => {
                          setTemplateDropdownOpen(!templateDropdownOpen);
                          setGerenteDropdownOpen(false);
                          setTypeDropdownOpen(false);
                          setCardTypeDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 border-2 border-zinc-200 rounded-md hover:border-[#0B0B16] transition-colors bg-white"
                        data-testid="template-dropdown"
                      >
                        <span className={selectedTemplateId ? 'text-[#0B0B16]' : 'text-zinc-400'}>
                          {templatesList.find((t) => String(t.id) === selectedTemplateId)?.name || 'Todas'}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${templateDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {templateDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          <button
                            onClick={() => { setSelectedTemplateId(''); setTemplateDropdownOpen(false); }}
                            className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${!selectedTemplateId ? 'bg-purple-50' : ''}`}
                          >
                            <span>Todas</span>
                            {!selectedTemplateId && <Check className="h-4 w-4 text-[#0B0B16]" />}
                          </button>
                          {templatesList.filter((t) => t.type === selectedCardType).map((t) => (
                            <button
                              key={t.id}
                              onClick={() => { setSelectedTemplateId(String(t.id)); setTemplateDropdownOpen(false); }}
                              className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${selectedTemplateId === String(t.id) ? 'bg-purple-50' : ''}`}
                            >
                              <span>{t.name}</span>
                              {selectedTemplateId === String(t.id) && <Check className="h-4 w-4 text-[#0B0B16]" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Apply Filters Button */}
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => fetchOperations(1)}
                    className="btn-primary"
                    data-testid="apply-filters-btn"
                  >
                    Aplicar filtros
                  </Button>
                </div>
              </div>
            )}

            {/* Export Buttons */}
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                onClick={() => handleExport('csv')}
                disabled={exporting || operations.length === 0}
                className="border-2 border-zinc-200"
                data-testid="export-csv-btn"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Exportar CSV
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleExport('xlsx')}
                disabled={exporting || operations.length === 0}
                className="border-2 border-zinc-200"
                data-testid="export-xlsx-btn"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Exportar Excel
              </Button>
            </div>

            {/* Operations Table */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
              </div>
            ) : operations.length === 0 ? (
              <div className="card-brutalist text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
                <p className="text-zinc-500">No hay operaciones registradas</p>
                <p className="text-zinc-400 text-sm mt-1">Las operaciones aparecerán aquí después de realizar transacciones</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full border-collapse" data-testid="operations-table">
                    <thead>
                      <tr className="bg-[#5B7CF7] text-white">
                        <th className="p-3 text-left text-xs font-semibold uppercase">Fecha</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Cliente</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Tarjeta</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Tipo Tarjeta</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Operación</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Monto</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Saldo</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Compra</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Gerente</th>
                        <th className="p-3 text-left text-xs font-semibold uppercase">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.map((op, index) => (
                        <tr 
                          key={op.id || index} 
                          className={`border-b border-zinc-100 hover:bg-zinc-50 ${index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}`}
                        >
                          <td className="p-3 text-sm text-zinc-600">{formatDate(op.created_at)}</td>
                          <td className="p-3 text-sm font-medium text-[#0B0B16]">{op.customer_name || '-'}</td>
                          <td className="p-3 text-sm text-zinc-600 font-mono">{op.card_id}</td>
                          <td className="p-3">
                            {op.card_type_label ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {op.card_type_label}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {op.operation_label || op.operation_type}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-zinc-600">{formatAmount(op)}</td>
                          <td className="p-3 text-sm text-zinc-600">{op.balance ?? '-'}</td>
                          <td className="p-3 text-sm text-zinc-600">
                            {op.purchase_sum ? formatCurrency(op.purchase_sum) : '-'}
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3 text-zinc-400" />
                              <span className="text-sm font-medium text-[#0B0B16]">{op.gerente}</span>
                            </span>
                          </td>
                          <td className="p-3 text-sm text-zinc-500 max-w-[150px] truncate" title={op.note}>
                            {op.note || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3" data-testid="operations-cards">
                  {operations.map((op, index) => (
                    <div key={op.id || index} className="card-brutalist p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {op.operation_label || op.operation_type}
                          </span>
                          {op.card_type_label && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {op.card_type_label}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-400">{formatDate(op.created_at)}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="font-medium text-[#0B0B16]">{op.customer_name || 'Sin nombre'}</p>
                        <p className="text-xs text-zinc-500 font-mono">{op.card_id}</p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100">
                        <div>
                          <p className="text-xs text-zinc-400">Monto</p>
                          <p className="text-sm font-medium">{formatAmount(op)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400">Saldo</p>
                          <p className="text-sm font-medium">{op.balance ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400">Compra</p>
                          <p className="text-sm font-medium">{op.purchase_sum ? formatCurrency(op.purchase_sum) : '-'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 text-zinc-400" />
                          <span className="font-medium text-[#0B0B16]">{op.gerente}</span>
                        </span>
                        {op.note && (
                          <span className="text-xs text-zinc-400 truncate max-w-[120px]" title={op.note}>
                            {op.note}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {meta.total_pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => fetchOperations(meta.page - 1)}
                      disabled={meta.page <= 1}
                      className="border-2 border-zinc-200"
                      data-testid="prev-page-btn"
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-zinc-600 px-4">
                      Página {meta.page} de {meta.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => fetchOperations(meta.page + 1)}
                      disabled={meta.page >= meta.total_pages}
                      className="border-2 border-zinc-200"
                      data-testid="next-page-btn"
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'clientes' && ['workspace_admin', 'super_admin'].includes(user?.role) && (
          <CustomerBaseTab token={token} />
        )}

        {/* Version Info */}
        <div className="text-center mt-8 text-zinc-400 text-xs sm:text-sm">
          <p>Devotio Rewards Scanner v1.1.0</p>
        </div>
      </main>

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
    </div>
  );
};

export default OperationsPage;
