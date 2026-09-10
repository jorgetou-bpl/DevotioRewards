import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Loader2, Users, ChevronUp, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react';
import { API_BASE_URL as API } from '../../config/api';
import { formatDate } from '../../utils/format';

const COLUMNS = [
  { key: 'customer_name', label: 'Nombre', sortable: true },
  { key: 'customer_phone', label: 'Teléfono', sortable: false },
  { key: 'first_seen_at', label: 'Cliente desde', sortable: true },
  { key: 'total_visits', label: 'Total Visitas', sortable: true },
  { key: 'last_seen_at', label: 'Última Visita', sortable: true }
];

// Customer Base — a tab within Home (alongside Dashboard/Historial), not a
// separate destination, so a business owner sees it as part of the same
// place they already check daily rather than a hidden admin-only page.
export const CustomerBaseTab = ({ token }) => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });
  const [sortBy, setSortBy] = useState('last_seen_at');
  const [sortDir, setSortDir] = useState(-1);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-zinc-500 text-sm">Todos los clientes con actividad registrada en este negocio</p>
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
                {customers.map((c) => (
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
                ))}
              </tbody>
            </table>
          </div>

          {meta.total_pages > 1 && (
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
      ) : (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-500">Todavía no hay clientes registrados</p>
        </div>
      )}
    </div>
  );
};
