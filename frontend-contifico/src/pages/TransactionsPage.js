import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { RedeemModal } from '../components/RedeemModal';
import { Button } from '../components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Loader2, RefreshCw } from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';
import { formatCurrency } from '../lib/currency';

const ITEMS_PER_PAGE = 25;

// Every operation shown here is auto-scoped to this workspace server-side
// (backend/routes/operations.py resolves workspace_id from the logged-in
// user), so no client-side filtering by workspace is needed.
const TransactionsPage = () => {
  const [operations, setOperations] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [redeemCardId, setRedeemCardId] = useState(null);

  const fetchOperations = async (page = 1) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/operations`, {
        params: { page, items_per_page: ITEMS_PER_PAGE },
      });
      setOperations(response.data.operations || []);
      setMeta(response.data.meta || { page: 1, total_pages: 1 });
    } catch (error) {
      toast.error('Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations(1);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-heading text-xl sm:text-2xl">Historial de cashback</h2>
          <Button variant="outline" size="sm" onClick={() => fetchOperations(meta.page)} data-testid="refresh-button">
            <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
          </div>
        ) : operations.length === 0 ? (
          <div className="empty-state card-brutalist">
            <p className="font-medium text-sm sm:text-base">Todavía no hay transacciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table data-testid="operations-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Operación</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((op) => (
                  <TableRow key={op.id} data-testid={`operation-row-${op.id}`}>
                    <TableCell className="whitespace-nowrap text-xs sm:text-sm text-zinc-500">
                      {op.created_at ? new Date(op.created_at).toLocaleString('es-EC') : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{op.customer_name || 'N/A'}</div>
                      <div className="text-xs text-zinc-400">{op.customer_phone || ''}</div>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{op.operation_label || op.operation_type}</TableCell>
                    <TableCell className="text-sm font-mono">{formatCurrency(op.purchase_sum ?? op.amount)}</TableCell>
                    <TableCell className="text-sm font-mono">{formatCurrency(op.balance)}</TableCell>
                    <TableCell>
                      {op.card_id && (
                        <Button
                          size="sm"
                          className="btn-primary"
                          onClick={() => setRedeemCardId(op.card_id)}
                          data-testid={`redeem-button-${op.id}`}
                        >
                          Canjear
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {meta.total_pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => fetchOperations(meta.page - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs sm:text-sm text-zinc-500">
              Página {meta.page} de {meta.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.total_pages}
              onClick={() => fetchOperations(meta.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </main>

      {redeemCardId && (
        <RedeemModal
          cardId={redeemCardId}
          onClose={() => setRedeemCardId(null)}
          onRedeemed={() => fetchOperations(meta.page)}
        />
      )}
    </div>
  );
};

export default TransactionsPage;
