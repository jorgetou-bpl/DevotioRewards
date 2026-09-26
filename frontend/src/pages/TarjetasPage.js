import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, CreditCard, ArrowLeft, Users, Bell, DollarSign, Receipt, UserPlus, Repeat, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { ClientMetricsCards } from '../components/dashboard/ClientMetricsCards';
import { formatDate } from '../utils/format';
import { API_BASE_URL as API } from '../config/api';

// Sidebar destination (`/tarjetas`). Lists the workspace's templates; each
// one drills into an overview + recent transactions, both built on top of
// /operations/summary and /operations' existing template_id filters (the
// same ones Home/Historial already use) — no new aggregation was needed for
// this part. "Ver clientes"/"Enviar notificación" hand off to Clientes and
// Mensajería with the template pre-applied via a query param.
const TarjetasPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { formatCurrency } = useSettings();

  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selected, setSelected] = useState(null);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [recentOps, setRecentOps] = useState([]);
  const [opsLoading, setOpsLoading] = useState(false);

  // Generic self-enrollment QR/link for this card design (template-level,
  // distinct from any one customer's card QR) — comes from the same
  // Boomerangme template object, just not surfaced until now.
  const [templateDetail, setTemplateDetail] = useState(null);
  const [templateDetailLoading, setTemplateDetailLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setTemplates(res.data?.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [token]);

  const fetchDetail = useCallback(async (templateId) => {
    setSummaryLoading(true);
    setOpsLoading(true);
    setTemplateDetailLoading(true);
    try {
      const response = await axios.get(`${API}/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplateDetail(response.data?.template || null);
    } catch { setTemplateDetail(null); }
    finally { setTemplateDetailLoading(false); }

    try {
      const response = await axios.get(`${API}/operations/summary`, {
        params: { template_id: templateId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(response.data?.summary || null);
    } catch { setSummary(null); }
    finally { setSummaryLoading(false); }

    try {
      const response = await axios.get(`${API}/operations`, {
        params: { template_id: templateId, page: 1, items_per_page: 8 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentOps(response.data?.operations || []);
    } catch { setRecentOps([]); }
    finally { setOpsLoading(false); }
  }, [token]);

  const openTemplate = (t) => {
    setSelected(t);
    fetchDetail(t.id);
  };

  const handleCopyLink = async () => {
    if (!templateDetail?.installLink) return;
    await navigator.clipboard.writeText(templateDetail.installLink);
    setLinkCopied(true);
    toast.success('Enlace copiado');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6" data-testid="tarjeta-detail-page">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-[#0B0B16] transition-colors mb-4"
          data-testid="back-to-tarjetas"
        >
          <ArrowLeft className="h-4 w-4" />
          Todas las tarjetas
        </button>

        <div className="mb-6 flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-[#5B7CF7]" />
          <div>
            <h2 className="text-heading text-2xl sm:text-3xl">{selected.name}</h2>
            <p className="text-zinc-500 text-sm capitalize">{selected.type}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Button
            onClick={() => navigate(`/clientes?template_id=${selected.id}`)}
            variant="outline"
            className="border-2 border-zinc-200 gap-2"
            data-testid="tarjeta-ver-clientes"
          >
            <Users className="h-4 w-4" />
            Ver clientes de esta tarjeta
          </Button>
          <Button
            onClick={() => navigate(`/notifications?template_id=${selected.id}`)}
            className="bg-[#0B0B16] hover:bg-[#0B0B16]/90 gap-2"
            data-testid="tarjeta-enviar-push"
          >
            <Bell className="h-4 w-4" />
            Enviar notificación
          </Button>
        </div>

        {/* Generic install QR — a new customer scans this to get their own
            card, independent of any specific customer's card. */}
        {templateDetailLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : templateDetail?.qrLink ? (
          <div className="card-brutalist mb-6 flex flex-col sm:flex-row items-center gap-4">
            <img
              src={templateDetail.qrLink}
              alt={`Código QR para instalar ${selected.name}`}
              className="w-32 h-32 shrink-0 border border-zinc-200 rounded-lg"
              data-testid="tarjeta-install-qr"
            />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h3 className="text-sm font-semibold text-[#0B0B16] mb-1">Instalar tarjeta</h3>
              <p className="text-xs text-zinc-500 mb-3">
                Cualquier cliente puede escanear este código o abrir el enlace para instalar esta tarjeta en su Apple Wallet o Google Wallet.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-zinc-50 rounded-lg px-3 py-2 truncate">{templateDetail.installLink}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="border-2 border-zinc-200 shrink-0"
                  data-testid="copy-install-link"
                >
                  {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {summaryLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : summary ? (
          <div className="space-y-4 mb-6">
            <ClientMetricsCards tiles={[
              { icon: Users, label: 'Total Visitas', value: summary.customer_insights?.total_visitas ?? 0 },
              { icon: DollarSign, label: 'Facturación Total', value: formatCurrency(summary.customer_insights?.total_facturacion || 0) },
              { icon: Receipt, label: 'Venta Promedio', value: formatCurrency(summary.customer_insights?.avg_purchase || 0) },
              { icon: UserPlus, label: 'Nuevos Clientes', value: summary.customer_insights?.nuevos_miembros ?? 0 },
              { icon: Repeat, label: 'Clientes Habituales', value: summary.customer_insights?.clientes_habituales ?? 0 }
            ]} />
          </div>
        ) : null}

        <div className="card-brutalist">
          <h3 className="text-lg font-semibold text-[#0B0B16] mb-4">Últimas Transacciones</h3>
          {opsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : recentOps.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {recentOps.map((op, index) => (
                <div key={op.id || index} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0B0B16] truncate">{op.customer_name || 'Cliente'}</p>
                    <p className="text-xs text-zinc-500">{op.operation_label || op.operation_type}</p>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    {op.purchase_sum > 0 && <p className="text-sm font-semibold text-[#0B0B16]">{formatCurrency(op.purchase_sum)}</p>}
                    <p className="text-xs text-zinc-400">{formatDate(op.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-6">Sin transacciones registradas todavía</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6" data-testid="tarjetas-page">
      <div className="mb-6">
        <h2 className="text-heading text-2xl sm:text-3xl" data-testid="tarjetas-title">
          Tarjetas
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Programas de lealtad configurados en este workspace
        </p>
      </div>

      {loadingTemplates ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
        </div>
      ) : templates.length === 0 ? (
        <div className="card-brutalist text-center py-12">
          <CreditCard className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
          <p className="text-zinc-500">No hay tarjetas configuradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => openTemplate(t)}
              className="card-brutalist p-4 flex items-center gap-3 text-left hover:border-[#5B7CF7] transition-colors"
              data-testid={`tarjeta-card-${t.id}`}
            >
              <CreditCard className="h-6 w-6 text-[#5B7CF7] shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-[#0B0B16] truncate">{t.name}</p>
                <p className="text-xs text-zinc-500 capitalize">{t.type}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TarjetasPage;
