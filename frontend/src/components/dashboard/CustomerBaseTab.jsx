import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2, Users, ChevronUp, ChevronDown, FileText, FileSpreadsheet, Search, X } from 'lucide-react';
import { API_BASE_URL as API } from '../../config/api';
import { formatDate } from '../../utils/format';

const COLUMNS = [
  { key: 'customer_name', label: 'Nombre', sortable: true },
  { key: 'customer_phone', label: 'Teléfono', sortable: false },
  { key: 'first_seen_at', label: 'Cliente desde', sortable: true },
  { key: 'total_visits', label: 'Total Visitas', sortable: true },
  { key: 'last_seen_at', label: 'Última Visita', sortable: true }
];

// Customer Base — its own route (/clientes). `templateId`, when passed by
// the Tarjetas detail page, scopes the list to customers who have at least
// one operation against that card (see customer_insights.py's
// _phones_for_template) — customer_stats itself has no per-template field.
export const CustomerBaseTab = ({ token, templateId }) => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });
  const [sortBy, setSortBy] = useState('last_seen_at');
  const [sortDir, setSortDir] = useState(-1);

  // A search in progress replaces the paginated list below with its own
  // flat result set (phone/email/cédula/name — see GET /customers/search)
  // instead of filtering the current page client-side.
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchMatchType, setSearchMatchType] = useState(null);

  const fetchCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, items_per_page: 25, sort_by: sortBy, sort_dir: sortDir };
      if (templateId) params.template_id = templateId;
      const response = await axios.get(`${API}/customer-insights/customers`, {
        params,
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
  }, [token, sortBy, sortDir, templateId]);

  useEffect(() => { fetchCustomers(1); }, [fetchCustomers]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => -d);
    } else {
      setSortBy(key);
      setSortDir(-1);
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearching(true);
    setActiveSearch(q);
    try {
      const response = await axios.get(`${API}/customers/search`, {
        params: { q },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(response.data?.customers || []);
      setSearchMatchType(response.data?.match_type || null);
    } catch {
      setSearchResults([]);
      setSearchMatchType(null);
      toast.error('Error al buscar clientes');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setSearchResults(null);
    setSearchMatchType(null);
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const response = await axios.get(`${API}/customer-insights/customers/export`, {
        params: { format, sort_by: sortBy, sort_dir: sortDir },
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `clientes_${today}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Archivo ${format.toUpperCase()} descargado`);
    } catch {
      toast.error('Error al exportar clientes');
    } finally {
      setExporting(false);
    }
  };

  const isSearchActive = activeSearch.length > 0;
  const displayedCustomers = isSearchActive ? (searchResults || []) : customers;

  const renderRow = (c) => (
    <tr key={c.customer_phone} className="border-b border-zinc-100 hover:bg-zinc-50">
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
  );

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nombre, teléfono, correo o cédula"
          className="pl-9 pr-20"
          data-testid="customer-search-input"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isSearchActive && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-2 text-zinc-400 hover:text-[#0B0B16] transition-colors"
              aria-label="Limpiar búsqueda"
              data-testid="clear-customer-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Button type="submit" size="sm" className="bg-[#5B7CF7] hover:bg-[#4A6AE0]" disabled={searching || !searchInput.trim()} data-testid="customer-search-submit">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-zinc-500 text-sm">
          {isSearchActive
            ? `${displayedCustomers.length} resultado(s) para "${activeSearch}"`
            : 'Todos los clientes con actividad registrada en este negocio'}
        </p>
        {!isSearchActive && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={exporting || customers.length === 0}
              className="border-2 border-zinc-200"
              data-testid="export-customers-csv-btn"
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('xlsx')}
              disabled={exporting || customers.length === 0}
              className="border-2 border-zinc-200"
              data-testid="export-customers-xlsx-btn"
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Excel
            </Button>
          </div>
        )}
      </div>

      {loading && !isSearchActive ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
        </div>
      ) : displayedCustomers.length > 0 ? (
        <>
          <div className="card-brutalist overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  {COLUMNS.map((col) => (
                    <th key={col.key} className="p-3 text-left text-xs font-semibold uppercase">
                      {col.sortable && !isSearchActive ? (
                        <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-[#5B7CF7] transition-colors">
                          {col.label}
                          {sortBy === col.key && (sortDir === -1 ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedCustomers.map(renderRow)}
              </tbody>
            </table>
          </div>

          {!isSearchActive && meta.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => fetchCustomers(meta.page - 1)} disabled={meta.page <= 1} className="border-2 border-zinc-200">
                Anterior
              </Button>
              <span className="text-sm text-zinc-600 px-4">Página {meta.page} de {meta.total_pages}</span>
              <Button variant="outline" onClick={() => fetchCustomers(meta.page + 1)} disabled={meta.page >= meta.total_pages} className="border-2 border-zinc-200">
                Siguiente
              </Button>
            </div>
          )}
        </>
      ) : isSearchActive ? (
        <div className="text-center py-12">
          <Search className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-500">Sin resultados para "{activeSearch}"</p>
          <p className="text-zinc-400 text-xs mt-1">
            La cédula solo resuelve si el cliente ya se concilió por Contífico; el nombre es una búsqueda local, no exacta.
          </p>
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-500">Todavía no hay clientes registrados</p>
        </div>
      )}
    </div>
  );
};
