import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { formatDate, formatAmount } from '../utils/format';
import { API_BASE_URL as API } from '../config/api';

// Extracted from the old OperationsPage "Historial" tab — now its own route
// (`/historial`) reachable from AppLayout's sidebar instead of an internal
// tab. Fetches unconditionally on mount instead of being gated by tab state.
const HistorialPage = () => {
  const { token } = useAuth();
  const { formatCurrency } = useSettings();

  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });
  const [filters, setFilters] = useState({ gerentes: [], operation_types: [], card_types: [] });

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

  useEffect(() => { fetchOperations(); }, [fetchOperations]);

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

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" data-testid="historial-page">
      <div className="mb-6">
        <h2 className="text-heading text-2xl sm:text-3xl" data-testid="historial-title">
          Historial
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Historial y rendimiento de transacciones
        </p>
      </div>

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
    </div>
  );
};

export default HistorialPage;
