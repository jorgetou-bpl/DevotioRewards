import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '../ui/alert-dialog';
import { PushHistoryList } from './PushHistoryList';
import { API_BASE_URL as API } from '../../config/api';

// Replaces the reserved Dashboard placeholder. v1 scope: broadcast to the
// whole workspace audience (no cardId) with optional scheduling — audience
// segmentation is a fast-follow pending a Boomerangme API confirmation
// (see project plan), so no segment selector ships yet. GeoPush ("Ubicaciones")
// used to be a third sub-tab here — it's now its own top-level page
// (`/ubicaciones`) since Mensajería is meant to stay scoped to messaging.
export const PushNotificationsPanel = ({ token, templatesList, initialTemplateId }) => {
  const [view, setView] = useState('compose'); // 'compose' | 'history'
  const [message, setMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId ? String(initialTemplateId) : '');
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const canSubmit = message.trim().length > 0 && selectedTemplateId && (!scheduled || scheduledAt);

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      await axios.post(`${API}/notifications/push`, {
        message: message.trim(),
        template_id: Number(selectedTemplateId),
        scheduled_at: scheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null
      }, { headers: { Authorization: `Bearer ${token}` } });

      toast.success(scheduled ? 'Notificación programada' : 'Notificación enviada');
      setMessage('');
      setScheduled(false);
      setScheduledAt('');
      setHistoryRefreshKey((k) => k + 1);
      setView('history');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo enviar la notificación');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card-brutalist">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-[#0B0B16] flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#8CA4FE]" />
          Notificaciones
        </h3>
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setView('compose')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'compose' ? 'bg-white text-[#0B0B16] shadow-sm' : 'text-zinc-500 hover:text-[#0B0B16]'
            }`}
            data-testid="push-view-compose"
          >
            Nuevo mensaje
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'history' ? 'bg-white text-[#0B0B16] shadow-sm' : 'text-zinc-500 hover:text-[#0B0B16]'
            }`}
            data-testid="push-view-history"
          >
            Historial
          </button>
        </div>
      </div>

      {view === 'compose' ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Tarjeta / programa de lealtad</label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger data-testid="push-template-select">
                <SelectValue placeholder="Seleccionar tarjeta" />
              </SelectTrigger>
              <SelectContent>
                {templatesList.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Mensaje</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='Ej. "Hoy 2x1 en todas las bebidas"'
              maxLength={500}
              rows={3}
              data-testid="push-message-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="push-schedule-toggle"
              checked={scheduled}
              onCheckedChange={(checked) => setScheduled(checked === true)}
            />
            <label htmlFor="push-schedule-toggle" className="text-sm text-zinc-700 cursor-pointer">
              Programar envío
            </label>
          </div>

          {scheduled && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              data-testid="push-schedule-datetime"
            />
          )}

          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit || sending}
            className="w-full bg-[#0B0B16] hover:bg-[#0B0B16]/90"
            data-testid="push-submit-btn"
          >
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {scheduled ? 'Programar' : 'Enviar ahora'}
          </Button>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {scheduled ? '¿Programar esta notificación?' : '¿Enviar esta notificación ahora?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Va a llegar a todos los clientes con esta tarjeta instalada en su Apple Wallet o Google Wallet. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSend} data-testid="push-confirm-send">
                  {scheduled ? 'Programar' : 'Enviar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <PushHistoryList token={token} templatesList={templatesList} refreshKey={historyRefreshKey} />
      )}
    </div>
  );
};
