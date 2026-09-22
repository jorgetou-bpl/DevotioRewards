import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { RedeemModal } from '../components/RedeemModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, User, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('phone');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [redeemCardId, setRedeemCardId] = useState(null);

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
      toast.error(error.response?.data?.detail || 'Error en la búsqueda');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (customerId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/customers/${customerId}/cards`);
      const cards = response.data.cards || [];

      if (cards.length === 0) {
        toast.info('No se encontraron tarjetas para este cliente');
        return;
      }
      // Este workspace es cashback-only (una sola tarjeta por cliente), así
      // que no hace falta un selector de tarjeta como en el Scanner App.
      setRedeemCardId(cards[0].id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cargar tarjetas del cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-md mx-auto p-4 sm:p-6">
        <h2 className="text-heading text-2xl sm:text-3xl text-center mb-2" data-testid="search-title">
          Buscar Clientes
        </h2>
        <p className="text-center text-zinc-500 text-xs sm:text-sm mb-6 sm:mb-8">
          Busca clientes por teléfono o correo electrónico
        </p>

        <div className="flex gap-2 mb-4">
          <Button
            variant={searchType === 'phone' ? 'default' : 'outline'}
            className={`${searchType === 'phone' ? 'btn-primary' : 'btn-secondary'} flex-1 text-sm sm:text-base`}
            onClick={() => setSearchType('phone')}
          >
            Teléfono
          </Button>
          <Button
            variant={searchType === 'email' ? 'default' : 'outline'}
            className={`${searchType === 'email' ? 'btn-primary' : 'btn-secondary'} flex-1 text-sm sm:text-base`}
            onClick={() => setSearchType('email')}
          >
            Correo
          </Button>
        </div>

        <form onSubmit={handleSearch} className="mb-6 sm:mb-8">
          <div className="search-input-wrapper">
            <Search className="h-5 w-5" />
            <Input
              type={searchType === 'email' ? 'email' : 'tel'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchType === 'phone' ? '+593 99 123 4567' : 'cliente@correo.com'}
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
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><Search className="mr-2 h-4 w-4" /> Buscar</>)}
          </Button>
        </form>

        {searched && !loading && (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Resultados ({results.length})
            </p>

            {results.length === 0 ? (
              <div className="empty-state card-brutalist">
                <AlertCircle className="h-10 w-10 mx-auto mb-4 text-zinc-300" />
                <p className="font-medium text-sm sm:text-base">No se encontraron clientes</p>
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
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#8CA4FE] to-[#1447E6] rounded-lg flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#0B0B16] text-sm truncate">
                            {customer.firstName || 'N/A'} {customer.surname || ''}
                          </p>
                          <p className="text-xs sm:text-sm masked-data truncate">
                            {searchType === 'phone' ? (customer.phone || '***-***-****') : (customer.email || '***@***.***')}
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
      </main>

      {redeemCardId && (
        <RedeemModal cardId={redeemCardId} onClose={() => setRedeemCardId(null)} />
      )}
    </div>
  );
};

export default SearchPage;
