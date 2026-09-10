import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Loader2, Users, Menu, Home, Settings, LogOut, Building2, ChevronUp, ChevronDown } from 'lucide-react';
import { AppMenu } from '../components/AppMenu';
import { API_BASE_URL as API } from '../config/api';
import { formatDate } from '../utils/format';

const COLUMNS = [
  { key: 'customer_name', label: 'Nombre', sortable: true },
  { key: 'customer_phone', label: 'Teléfono', sortable: false },
  { key: 'first_seen_at', label: 'Cliente desde', sortable: true },
  { key: 'total_visits', label: 'Total Visitas', sortable: true },
  { key: 'last_seen_at', label: 'Última Visita', sortable: true }
];

const CustomersPage = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });
  const [sortBy, setSortBy] = useState('last_seen_at');
  const [sortDir, setSortDir] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/customer-insights/customers`, {
        params: { page, items_per_page: 25, sort_by: sortBy, sort_dir: sortDir },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setCustomers(response.data.customers);
        setMeta(response.data.meta);
      }
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [token, sortBy, sortDir]);

  useEffect(() => { fetchCustomers(1); }, [fetchCustomers]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => -d);
    } else {
      setSortBy(key);
      setSortDir(-1);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const configPath = ['super_admin', 'workspace_admin'].includes(user?.role) ? '/admin/workspace' : '/settings';
  const menuItems = [
    { icon: Home, label: 'Inicio', action: () => navigate('/'), testId: 'menu-home' },
    { icon: Users, label: 'Clientes', action: () => navigate('/clientes'), testId: 'menu-clientes' },
    { icon: Settings, label: 'Configuración', action: () => navigate(configPath), testId: 'menu-settings' },
    ...(user?.role === 'workspace_admin' ? [
      { icon: Building2, label: 'Admin Workspace', action: () => navigate('/admin/workspace'), testId: 'menu-admin' }
    ] : []),
    ...(user?.role === 'super_admin' ? [
      { icon: Building2, label: 'Panel Super Admin', action: () => navigate('/admin/dashboard'), testId: 'menu-admin' }
    ] : []),
    { icon: LogOut, label: 'Cerrar Sesión', action: handleLogout, testId: 'menu-logout' }
  ];

  return (
    <div className="min-h-screen bg-white" data-testid="customers-page">
      <header className="nav-header">
        <div className="w-10" />
        <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
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
        <div className="mb-6">
          <h2 className="text-heading text-2xl sm:text-3xl">Base de Clientes</h2>
          <p className="text-zinc-500 text-sm mt-1">Todos los clientes con actividad registrada en este negocio</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
          </div>
        ) : customers.length > 0 ? (
          <>
            <div className="card-brutalist overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="p-3 text-left text-xs font-semibold uppercase">
                        {col.sortable ? (
                          <button
                            onClick={() => toggleSort(col.key)}
                            className="flex items-center gap-1 hover:text-[#5B7CF7] transition-colors"
                          >
                            {col.label}
                            {sortBy === col.key && (sortDir === -1 ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
                          </button>
                        ) : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.customer_phone}
                      className="border-b border-zinc-100 hover:bg-zinc-50"
                    >
                      <td className="p-3">
                        <button
                          onClick={() => navigate(`/clientes/${encodeURIComponent(c.customer_phone)}`, { state: { customer: c } })}
                          className="font-medium text-[#5B7CF7] hover:underline"
                          data-testid="customer-row-name"
                        >
                          {c.customer_name || 'Sin nombre'}
                        </button>
                      </td>
                      <td className="p-3 text-zinc-600 font-mono">{c.customer_phone}</td>
                      <td className="p-3 text-zinc-600">{formatDate(c.first_seen_at)}</td>
                      <td className="p-3 text-zinc-600">{c.total_visits ?? 0}</td>
                      <td className="p-3 text-zinc-600">{formatDate(c.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta.total_pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => fetchCustomers(meta.page - 1)}
                  disabled={meta.page <= 1}
                  className="border-2 border-zinc-200"
                >
                  Anterior
                </Button>
                <span className="text-sm text-zinc-600 px-4">Página {meta.page} de {meta.total_pages}</span>
                <Button
                  variant="outline"
                  onClick={() => fetchCustomers(meta.page + 1)}
                  disabled={meta.page >= meta.total_pages}
                  className="border-2 border-zinc-200"
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">Todavía no hay clientes registrados</p>
          </div>
        )}
      </main>

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
    </div>
  );
};

export default CustomersPage;
