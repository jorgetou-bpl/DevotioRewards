import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { Loader2, ArrowLeft, User, Calendar, Repeat, DollarSign, AlertCircle } from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';
import { formatDate, formatAmount } from '../utils/format';

const CustomerProfilePage = () => {
  const { phone } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { formatCurrency } = useSettings();

  const [customer, setCustomer] = useState(location.state?.customer || null);
  const [customerLoading, setCustomerLoading] = useState(!location.state?.customer);

  const [card, setCard] = useState(null);
  const [cardLoading, setCardLoading] = useState(true);
  const [cardError, setCardError] = useState(null);

  const [operations, setOperations] = useState([]);
  const [opsLoading, setOpsLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });

  // 1. Customer header — from router state if we arrived via a row click,
  // otherwise fetched (e.g. direct URL / page refresh).
  useEffect(() => {
    if (customer) return;
    setCustomerLoading(true);
    axios.get(`${API}/customer-insights/customers/${encodeURIComponent(phone)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => setCustomer(res.data?.customer || null))
      .catch(() => setCustomer(null))
      .finally(() => setCustomerLoading(false));
  }, [phone, token, customer]);

  // 2. Live card data — independent, own error state, never blocks the rest
  // of the page if the external provider call is slow or fails.
  useEffect(() => {
    if (!customer?.card_id) { setCardLoading(false); return; }
    setCardLoading(true);
    setCardError(null);
    axios.get(`${API}/cards/${customer.card_id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setCard(res.data?.card || null))
      .catch(() => setCardError('No se pudo cargar la información de la tarjeta'))
      .finally(() => setCardLoading(false));
  }, [customer?.card_id, token]);

  // 3. Transaction history — local, independent.
  const fetchOperations = useCallback(async (page = 1) => {
    setOpsLoading(true);
    try {
      const response = await axios.get(`${API}/operations`, {
        params: { customer_phone: phone, page, items_per_page: 20 },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setOperations(response.data.operations);
        setMeta(response.data.meta);
      }
    } catch {
      setOperations([]);
    } finally {
      setOpsLoading(false);
    }
  }, [phone, token]);

  useEffect(() => { fetchOperations(1); }, [fetchOperations]);

  return (
    <div className="min-h-screen bg-white" data-testid="customer-profile-page">
      <header className="nav-header">
        <button
          onClick={() => navigate('/?tab=clientes')}
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5 text-[#0B0B16]" />
          <span className="font-medium text-[#0B0B16] hidden sm:inline">Clientes</span>
        </button>
        <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10" />
        <div className="w-16 sm:w-20" />
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {/* 1. Header */}
        {customerLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" /></div>
        ) : customer ? (
          <div className="card-brutalist">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1447E6] to-[#8CA4FE] flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-heading text-xl sm:text-2xl">{customer.customer_name || 'Sin nombre'}</h2>
                <p className="text-zinc-500 text-sm font-mono">{customer.customer_phone}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-zinc-50 rounded-xl text-center">
                <Calendar className="h-4 w-4 mx-auto text-[#5B7CF7] mb-1" />
                <p className="text-sm font-bold text-[#0B0B16]">{formatDate(customer.first_seen_at).split(',')[0]}</p>
                <p className="text-xs text-zinc-500">Cliente desde</p>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl text-center">
                <Repeat className="h-4 w-4 mx-auto text-[#5B7CF7] mb-1" />
                <p className="text-sm font-bold text-[#0B0B16]">{customer.total_visits ?? 0}</p>
                <p className="text-xs text-zinc-500">Visitas totales</p>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl text-center">
                <DollarSign className="h-4 w-4 mx-auto text-[#5B7CF7] mb-1" />
                <p className="text-sm font-bold text-[#0B0B16]">{formatCurrency(customer.total_purchase_sum || 0)}</p>
                <p className="text-xs text-zinc-500">Facturación total</p>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl text-center">
                <Calendar className="h-4 w-4 mx-auto text-[#5B7CF7] mb-1" />
                <p className="text-sm font-bold text-[#0B0B16]">{formatDate(customer.last_seen_at).split(',')[0]}</p>
                <p className="text-xs text-zinc-500">Última visita</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">No se encontró este cliente</p>
          </div>
        )}

        {/* 2. Live card data panel */}
        {customer && (
          <div className="card-brutalist">
            <h3 className="text-lg font-semibold text-[#0B0B16] mb-4">Datos de la tarjeta</h3>
            {cardLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
            ) : cardError ? (
              <p className="text-zinc-500 text-sm text-center py-4">{cardError}</p>
            ) : card ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <p className="text-sm font-bold text-[#0B0B16] capitalize">{card.type || '-'}</p>
                  <p className="text-xs text-zinc-500">Tipo de tarjeta</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <p className="text-sm font-bold text-[#0B0B16]">
                    {card.balance?.balance ?? card.balance?.bonusBalance ?? card.balance?.currentNumberOfUses ?? '-'}
                  </p>
                  <p className="text-xs text-zinc-500">Saldo/Balance</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <p className="text-sm font-bold text-[#0B0B16]">{card.balance?.discountPercentage != null ? `${card.balance.discountPercentage}%` : '-'}</p>
                  <p className="text-xs text-zinc-500">Nivel actual</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <p className="text-sm font-bold text-[#0B0B16]">{formatDate(card.customer?.createdAt).split(',')[0]}</p>
                  <p className="text-xs text-zinc-500">Fecha de alta</p>
                </div>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">Sin datos en vivo disponibles</p>
            )}
          </div>
        )}

        {/* 3. Transaction history */}
        <div className="card-brutalist">
          <h3 className="text-lg font-semibold text-[#0B0B16] mb-4">Historial de Transacciones</h3>
          {opsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
          ) : operations.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="p-2 text-left text-xs font-semibold uppercase">Fecha</th>
                      <th className="p-2 text-left text-xs font-semibold uppercase">Tipo</th>
                      <th className="p-2 text-left text-xs font-semibold uppercase">Tarjeta</th>
                      <th className="p-2 text-left text-xs font-semibold uppercase">Monto</th>
                      <th className="p-2 text-left text-xs font-semibold uppercase">Compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((op, i) => (
                      <tr key={op.id || i} className="border-b border-zinc-100">
                        <td className="p-2 text-zinc-600">{formatDate(op.created_at)}</td>
                        <td className="p-2 text-zinc-600">{op.operation_label || op.operation_type}</td>
                        <td className="p-2 text-zinc-600">{op.card_type_label || '-'}</td>
                        <td className="p-2 text-zinc-600">{formatAmount(op)}</td>
                        <td className="p-2 text-zinc-600">{op.purchase_sum ? formatCurrency(op.purchase_sum) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meta.total_pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" onClick={() => fetchOperations(meta.page - 1)} disabled={meta.page <= 1} className="border-2 border-zinc-200">
                    Anterior
                  </Button>
                  <span className="text-sm text-zinc-600 px-4">Página {meta.page} de {meta.total_pages}</span>
                  <Button variant="outline" onClick={() => fetchOperations(meta.page + 1)} disabled={meta.page >= meta.total_pages} className="border-2 border-zinc-200">
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-6">Sin transacciones registradas</p>
          )}
        </div>
      </main>
    </div>
  );
};

export default CustomerProfilePage;
