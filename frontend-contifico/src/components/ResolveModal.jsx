import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Loader2, Search } from 'lucide-react';
import { Input } from './ui/input';
import { API_BASE_URL as API } from '../config/api';
import { formatCurrency } from '../lib/currency';

// Mirrors the "Resolver pendiente" flow from the Interfuerza × Devotio
// project (github.com/jorgetou-bpl/interfuerza-devotio-dashboard), adapted
// to call our own backend instead of Supabase + a separate Next.js app:
// search Devotio by phone/email (reusing the same /customers endpoint the
// rest of this app already uses), pick the right customer, confirm, and the
// backend both credits the cashback and marks the transaction resolved.
export const ResolveModal = ({ transaction, onClose, onResolved }) => {
  const [query, setQuery] = useState(transaction.customer_phone || transaction.customer_email || '');
  const [searchType, setSearchType] = useState(transaction.customer_phone ? 'phone' : 'email');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = searchType === 'phone' ? { phone: query.trim() } : { email: query.trim() };
      const response = await axios.get(`${API}/customers`, { params });
      const customers = response.data.customers || [];
      setResults(customers);
      if (customers.length === 0) toast.info('Sin resultados en Devotio');
    } catch (error) {
      toast.error('Error en la búsqueda');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCustomer = async (customer) => {
    setSearching(true);
    try {
      const response = await axios.get(`${API}/customers/${customer.id}/cards`);
      const cards = response.data.cards || [];
      if (cards.length === 0) {
        toast.info('Este cliente no tiene tarjeta en Devotio');
        return;
      }
      setSelected({ customer, card: cards[0] });
    } catch (error) {
      toast.error('Error al cargar la tarjeta del cliente');
    } finally {
      setSearching(false);
    }
  };

  const confirm = async () => {
    if (!selected) return;
    setConfirming(true);
    try {
      const response = await axios.post(`${API}/contifico/transactions/${transaction.id}/resolve`, {
        card_id: selected.card.id,
        customer_id: selected.customer.id,
      });
      toast.success('Cashback acreditado exitosamente');
      onResolved?.(response.data.card);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al resolver');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="resolve-modal">
      <div className="card-brutalist bg-white w-full max-w-md p-4 sm:p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600" aria-label="Cerrar">
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg sm:text-xl text-heading mb-1">Resolver transacción sin match</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Factura Contífico #{transaction.documento_numero} · {formatCurrency(transaction.amount)}
        </p>

        <div className="bg-zinc-50 rounded-xl p-3 mb-4 text-sm">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Cliente en Contífico</p>
          <p className="font-medium text-[#0B0B16]">{transaction.customer_name || 'Sin nombre'}</p>
          {transaction.customer_phone && <p className="text-zinc-500 text-xs">Tel: {transaction.customer_phone}</p>}
          {transaction.customer_email && <p className="text-zinc-500 text-xs">Email: {transaction.customer_email}</p>}
          {transaction.customer_cedula && <p className="text-zinc-500 text-xs">Cédula: {transaction.customer_cedula}</p>}
        </div>

        {selected ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs text-emerald-700 uppercase tracking-wide mb-1">Acreditar a</p>
              <p className="font-medium text-[#0B0B16] text-sm">
                {selected.customer.firstName} {selected.customer.surname}
              </p>
              <p className="text-xs text-zinc-500">Tarjeta {selected.card.id}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm text-zinc-500 border border-zinc-300 hover:border-zinc-400"
              >
                Cambiar
              </button>
              <button
                onClick={confirm}
                disabled={confirming}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-50"
                data-testid="confirm-resolve-button"
              >
                {confirming ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirmar y acreditar'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSearchType('phone')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${searchType === 'phone' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Teléfono
              </button>
              <button
                onClick={() => setSearchType('email')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${searchType === 'email' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Correo
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 mb-3">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchType === 'phone' ? 'Teléfono del cliente' : 'Correo del cliente'}
                data-testid="resolve-search-input"
              />
              <button type="submit" disabled={searching} className="btn-primary px-3 rounded-lg">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </button>
            </form>

            {results.length > 0 && (
              <div className="space-y-1.5">
                {results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors"
                  >
                    <p className="text-sm font-medium text-[#0B0B16]">{c.firstName} {c.surname}</p>
                    <p className="text-xs text-zinc-400">{c.phone || c.email}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
