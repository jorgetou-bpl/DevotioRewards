import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  ArrowLeft, 
  Download, 
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OperationsPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { formatCurrency } = useSettings();
  
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });
  const [filters, setFilters] = useState({
    gerentes: [],
    operation_types: []
  });
  
  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGerente, setSelectedGerente] = useState('');
  const [selectedOperationType, setSelectedOperationType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [gerenteDropdownOpen, setGerenteDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

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
  }, [token, startDate, endDate, selectedGerente, selectedOperationType]);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.append('format', format);
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedGerente) params.append('gerente', selectedGerente);
      if (selectedOperationType) params.append('operation_type', selectedOperationType);
      
      const response = await axios.get(`${API}/operations/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
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
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-CR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const hasActiveFilters = startDate || endDate || selectedGerente || selectedOperationType;

  return (
    <div className="min-h-screen bg-white" data-testid="operations-page">
      {/* Header */}
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5 text-[#120627]" />
          <span className="font-medium text-[#120627] hidden sm:inline">Volver</span>
        </button>
        <img 
          src="/fonts/logo.png" 
          alt="Devotio Rewards" 
          className="h-8 sm:h-10"
        />
        <div className="w-16 sm:w-20" />
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-heading text-2xl sm:text-3xl" data-testid="operations-title">
              Historial de Operaciones
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              {meta.total} operaciones registradas
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-2 ${hasActiveFilters ? 'border-[#F040A0] text-[#F040A0]' : 'border-zinc-200'}`}
              data-testid="toggle-filters-btn"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {hasActiveFilters && <span className="ml-2 bg-[#F040A0] text-white text-xs px-2 py-0.5 rounded-full">!</span>}
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
                  className="text-xs text-[#F040A0] hover:underline flex items-center gap-1"
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
                  className="w-full flex items-center justify-between p-2 border-2 border-zinc-200 rounded-md hover:border-[#120627] transition-colors bg-white"
                  data-testid="gerente-dropdown"
                >
                  <span className={selectedGerente ? 'text-[#120627]' : 'text-zinc-400'}>
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
                      {!selectedGerente && <Check className="h-4 w-4 text-[#120627]" />}
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
                        {selectedGerente === gerente && <Check className="h-4 w-4 text-[#120627]" />}
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
                  }}
                  className="w-full flex items-center justify-between p-2 border-2 border-zinc-200 rounded-md hover:border-[#120627] transition-colors bg-white"
                  data-testid="operation-type-dropdown"
                >
                  <span className={selectedOperationType ? 'text-[#120627]' : 'text-zinc-400'}>
                    {selectedOperationType || 'Todos'}
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
                      {!selectedOperationType && <Check className="h-4 w-4 text-[#120627]" />}
                    </button>
                    {filters.operation_types.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setSelectedOperationType(type);
                          setTypeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 hover:bg-zinc-50 ${selectedOperationType === type ? 'bg-purple-50' : ''}`}
                      >
                        <span>{type}</span>
                        {selectedOperationType === type && <Check className="h-4 w-4 text-[#120627]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
            <Loader2 className="h-8 w-8 animate-spin text-[#120627]" />
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
                  <tr className="bg-[#120627] text-white">
                    <th className="p-3 text-left text-xs font-semibold uppercase">Fecha</th>
                    <th className="p-3 text-left text-xs font-semibold uppercase">Cliente</th>
                    <th className="p-3 text-left text-xs font-semibold uppercase">Tarjeta</th>
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
                      <td className="p-3 text-sm font-medium text-[#120627]">{op.customer_name || '-'}</td>
                      <td className="p-3 text-sm text-zinc-600 font-mono">{op.card_id}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {op.operation_label || op.operation_type}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-zinc-600">{op.amount ?? '-'}</td>
                      <td className="p-3 text-sm text-zinc-600">{op.balance ?? '-'}</td>
                      <td className="p-3 text-sm text-zinc-600">
                        {op.purchase_sum ? formatCurrency(op.purchase_sum) : '-'}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3 text-zinc-400" />
                          <span className="text-sm font-medium text-[#120627]">{op.gerente}</span>
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
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {op.operation_label || op.operation_type}
                    </span>
                    <span className="text-xs text-zinc-400">{formatDate(op.created_at)}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium text-[#120627]">{op.customer_name || 'Sin nombre'}</p>
                    <p className="text-xs text-zinc-500 font-mono">{op.card_id}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100">
                    <div>
                      <p className="text-xs text-zinc-400">Monto</p>
                      <p className="text-sm font-medium">{op.amount ?? '-'}</p>
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
                      <span className="font-medium text-[#120627]">{op.gerente}</span>
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

        {/* Version Info */}
        <div className="text-center mt-8 text-zinc-400 text-xs sm:text-sm">
          <p>Devotio Rewards Scanner v1.0.0</p>
        </div>
      </main>
    </div>
  );
};

export default OperationsPage;
