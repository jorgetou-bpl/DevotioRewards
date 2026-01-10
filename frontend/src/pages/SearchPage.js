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
        toast.info('No customers found');
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Search failed';
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
        toast.info('No cards found for this customer');
        return;
      }

      // If single card, go directly to result
      if (cards.length === 1) {
        navigate('/result', { state: { card: cards[0] } });
      } else {
        // Show card selection (for now, just pick first one)
        navigate('/result', { state: { card: cards[0] } });
        toast.info(`Customer has ${cards.length} cards. Showing first card.`);
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to load customer cards';
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
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-sm transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="logo-text text-xl">Boomerang</h1>
        <div className="w-20" />
      </header>

      <main className="max-w-md mx-auto p-6">
        <h2 className="text-heading text-3xl text-center mb-2" data-testid="search-title">
          Search Customers
        </h2>
        <p className="text-center text-zinc-500 text-sm mb-8">
          Find customers by phone or email
        </p>

        {/* Search Type Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={searchType === 'phone' ? 'default' : 'outline'}
            className={searchType === 'phone' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
            onClick={() => setSearchType('phone')}
            data-testid="search-by-phone"
          >
            Phone
          </Button>
          <Button
            variant={searchType === 'email' ? 'default' : 'outline'}
            className={searchType === 'email' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
            onClick={() => setSearchType('email')}
            data-testid="search-by-email"
          >
            Email
          </Button>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="search-input-wrapper">
            <Search className="h-5 w-5" />
            <Input
              type={searchType === 'email' ? 'email' : 'tel'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchType === 'phone' ? '+1 234 567 8900' : 'customer@email.com'}
              className="input-brutalist pl-12"
              data-testid="search-input"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="w-full mt-4 btn-primary"
            data-testid="search-button"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Search
              </>
            )}
          </Button>
        </form>

        {/* Results */}
        {searched && !loading && (
          <div className="space-y-4">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              Results ({results.length})
            </p>

            {results.length === 0 ? (
              <div className="empty-state card-brutalist">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
                <p className="font-medium">No customers found</p>
                <p className="text-sm text-zinc-400 mt-1">
                  Try a different {searchType}
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
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-100 rounded-sm flex items-center justify-center">
                          <User className="h-6 w-6 text-zinc-400" />
                        </div>
                        <div>
                          <p className="font-medium masked-data" data-testid="customer-name-masked">
                            {customer.firstName || '***'} {customer.surname || '***'}
                          </p>
                          <p className="text-sm masked-data" data-testid="customer-contact-masked">
                            {searchType === 'phone' 
                              ? (customer.phone || '***-***-****')
                              : (customer.email || '***@***.***')
                            }
                          </p>
                          <p className="text-xs text-zinc-400 mt-1 text-mono">
                            ID: {customer.id}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-zinc-400" />
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
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchPage;
