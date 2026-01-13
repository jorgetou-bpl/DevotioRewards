import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import {
  ArrowLeft,
  Search,
  User,
  CreditCard,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('phone'); // 'phone' or 'email'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const params = searchType === 'phone' 
        ? { phone: searchQuery.trim() }
        : { email: searchQuery.trim() };
      
      const response = await axios.get(`${API}/customers`, { params });
      setResults(response.data.customers || []);
      
      if (response.data.customers?.length === 0) {
        toast.info('No se encontraron clientes');
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Error en la búsqueda';
      toast.error(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (customerId) => {
    setLoading(true);
    try {
      // Get customer's cards
      const response = await axios.get(`${API}/customers/${customerId}/cards`);
      const cards = response.data.cards || [];
      
      if (cards.length === 0) {
        toast.info('No se encontraron tarjetas para este cliente');
        return;
      }

      // If single card, go directly to result
      if (cards.length === 1) {
        navigate('/result', { state: { card: cards[0] } });
      } else {
        // Show card selection (for now, just pick first one)
        navigate('/result', { state: { card: cards[0] } });
        toast.info(`El cliente tiene ${cards.length} tarjetas. Mostrando la primera.`);
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al cargar tarjetas del cliente';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" data-testid="search-page">
      {/* Header */}
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 sm:gap-2 p-2 hover:bg-zinc-100 rounded-lg transition-colors"
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
        <div className="w-14 sm:w-20" />
      </header>

      <main className="max-w-md mx-auto p-4 sm:p-6">
        <h2 className="text-heading text-2xl sm:text-3xl text-center mb-2" data-testid="search-title">
          Buscar Clientes
        </h2>
        <p className="text-center text-zinc-500 text-xs sm:text-sm mb-6 sm:mb-8">
          Busca clientes por teléfono o correo electrónico
        </p>

        {/* Search Type Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={searchType === 'phone' ? 'default' : 'outline'}
            className={`${searchType === 'phone' ? 'btn-primary' : 'btn-secondary'} flex-1 text-sm sm:text-base`}
            onClick={() => setSearchType('phone')}
            data-testid="search-by-phone"
          >
            Teléfono
          </Button>
          <Button
            variant={searchType === 'email' ? 'default' : 'outline'}
            className={`${searchType === 'email' ? 'btn-primary' : 'btn-secondary'} flex-1 text-sm sm:text-base`}
            onClick={() => setSearchType('email')}
            data-testid="search-by-email"
          >
            Correo
          </Button>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6 sm:mb-8">
          <div className="search-input-wrapper">
            <Search className="h-5 w-5" />
            <Input
              type={searchType === 'email' ? 'email' : 'tel'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchType === 'phone' ? '+506 1234 5678' : 'cliente@correo.com'}
              className="input-brutalist pl-12 text-sm sm:text-base"
              data-testid="search-input"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="w-full mt-4 btn-primary text-sm sm:text-base"
            data-testid="search-button"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Buscar
              </>
            )}
          </Button>
        </form>

        {/* Results */}
        {searched && !loading && (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Resultados ({results.length})
            </p>

            {results.length === 0 ? (
              <div className="empty-state card-brutalist">
                <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-zinc-300" />
                <p className="font-medium text-sm sm:text-base">No se encontraron clientes</p>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Intenta con un {searchType === 'phone' ? 'teléfono' : 'correo'} diferente
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer.id)}
                    className="customer-card w-full text-left"
                    data-testid={`customer-${customer.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#F040A0] to-[#120627] rounded-lg flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#120627] text-sm sm:text-base truncate" data-testid="customer-name">
                            {customer.firstName || 'N/A'} {customer.surname || ''}
                          </p>
                          <p className="text-xs sm:text-sm masked-data truncate" data-testid="customer-contact-masked">
                            {searchType === 'phone' 
                              ? (customer.phone || '***-***-****')
                              : (customer.email || '***@***.***')
                            }
                          </p>
                          <p className="text-xs text-zinc-400 mt-1 text-mono truncate">
                            ID: {customer.id}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-zinc-400 flex-shrink-0 ml-2" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && searched && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#120627]" />
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchPage;
