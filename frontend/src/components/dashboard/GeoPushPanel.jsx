import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { MapPin, Loader2, Plus, Pencil, Trash2, X, LocateFixed } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
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
import { API_BASE_URL as API } from '../../config/api';

const MESSAGE_MAX_LENGTH = 85; // Boomerangme cuts off longer text on-device

const EMPTY_FORM = { name: '', address: '', message: '', latitude: '', longitude: '', display: true, template_ids: [] };

// Manages Boomerangme's GeoPush locations — the ~330ft/100m radius and
// non-dismissible-while-in-range behavior are fixed by Apple Wallet's own
// platform mechanism, not configurable here. This screen only manages what
// Boomerangme's API exposes: name/address/message/coordinates/display/which
// templates each location applies to.
export const GeoPushPanel = ({ token, templatesList }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [locating, setLocating] = useState(false);

  // Boomerangme's own dashboard auto-fills lat/long from the device's current
  // position when configuring GeoPush. Kept optional — whoever sets this up
  // might not be standing at the actual store, so manual entry always stays
  // available too.
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Este navegador no soporta geolocalización');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((f) => ({
          ...f,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude)
        }));
        setLocating(false);
        toast.success('Ubicación actual aplicada');
      },
      () => {
        setLocating(false);
        toast.error('No se pudo obtener la ubicación — ingresala manualmente');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const templateName = useCallback(
    (id) => templatesList.find((t) => String(t.id) === String(id))?.name || `#${id}`,
    [templatesList]
  );

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/geo-locations`, {
        params: { items_per_page: 50 },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) setLocations(response.data.locations);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const openNewForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEditForm = (loc) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name || '', address: loc.address || '', message: loc.message || '',
      latitude: loc.latitude || '', longitude: loc.longitude || '',
      display: loc.display !== false, template_ids: loc.template_ids || []
    });
    setFormOpen(true);
  };

  const toggleTemplate = (id) => {
    setForm((f) => ({
      ...f,
      template_ids: f.template_ids.includes(id) ? f.template_ids.filter((t) => t !== id) : [...f.template_ids, id]
    }));
  };

  const canSave = form.name.trim() && form.address.trim() && form.message.trim() && form.latitude.trim() && form.longitude.trim();

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), address: form.address.trim(), message: form.message.trim(),
        latitude: form.latitude.trim(), longitude: form.longitude.trim(),
        display: form.display, template_ids: form.template_ids
      };
      if (editingId) {
        await axios.patch(`${API}/geo-locations/${editingId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Ubicación actualizada');
      } else {
        await axios.post(`${API}/geo-locations`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Ubicación creada');
      }
      setFormOpen(false);
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo guardar la ubicación');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await axios.delete(`${API}/geo-locations/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Ubicación eliminada');
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo eliminar la ubicación');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Cuando un cliente con esta tarjeta esté cerca de la ubicación, la notificación aparece automáticamente en su pantalla de bloqueo — envío geolocalizado dentro de un radio de 100 metros (330 pies), fijado por Apple Wallet y no configurable.
      </p>

      {!formOpen && (
        <Button onClick={openNewForm} variant="outline" className="w-full border-2 border-zinc-200" data-testid="geopush-add-btn">
          <Plus className="h-4 w-4 mr-2" />
          Agregar ubicación
        </Button>
      )}

      {formOpen && (
        <div className="card-brutalist space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0B0B16]">{editingId ? 'Editar ubicación' : 'Nueva ubicación'}</h4>
            <button onClick={() => setFormOpen(false)} className="text-zinc-400 hover:text-zinc-600" data-testid="geopush-form-close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Nombre</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Sucursal Centro" data-testid="geopush-name" />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Dirección</label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección física" data-testid="geopush-address" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-500">Ubicación</label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                className="text-xs font-medium text-[#5B7CF7] hover:underline flex items-center gap-1 disabled:opacity-50"
                data-testid="geopush-use-current-location"
              >
                {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
                Usar mi ubicación actual
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="Latitud, ej. 9.9281" data-testid="geopush-latitude" />
              <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="Longitud, ej. -84.0907" data-testid="geopush-longitude" />
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Útil si estás configurando esto desde el local. Si no, ingresalas a mano — podés sacarlas de Google Maps con clic derecho sobre el punto exacto.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block flex items-center justify-between">
              <span>Mensaje</span>
              <span className={form.message.length > MESSAGE_MAX_LENGTH ? 'text-red-500' : 'text-zinc-400'}>
                {form.message.length}/{MESSAGE_MAX_LENGTH}
              </span>
            </label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value.slice(0, MESSAGE_MAX_LENGTH) })}
              placeholder='Ej. "Estás cerca — pasá por tu café de hoy"'
              rows={2}
              data-testid="geopush-message"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Aplica a</label>
            <div className="space-y-1.5 max-h-32 overflow-y-auto border border-zinc-200 rounded-md p-2">
              {templatesList.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`geopush-tpl-${t.id}`}
                    checked={form.template_ids.includes(t.id)}
                    onCheckedChange={() => toggleTemplate(t.id)}
                  />
                  <label htmlFor={`geopush-tpl-${t.id}`} className="text-sm text-zinc-700 cursor-pointer">{t.name}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="geopush-display" checked={form.display} onCheckedChange={(c) => setForm({ ...form, display: c === true })} />
            <label htmlFor="geopush-display" className="text-sm text-zinc-700 cursor-pointer">Activa</label>
          </div>

          <Button onClick={handleSave} disabled={!canSave || saving} className="w-full bg-[#0B0B16] hover:bg-[#0B0B16]/90" data-testid="geopush-save-btn">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editingId ? 'Guardar cambios' : 'Crear ubicación'}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : locations.length === 0 ? (
        !formOpen && (
          <div className="text-center py-8">
            <MapPin className="h-10 w-10 mx-auto text-zinc-300 mb-2" />
            <p className="text-zinc-500 text-sm">Todavía no hay ubicaciones configuradas</p>
          </div>
        )
      ) : (
        <div className="divide-y divide-zinc-100">
          {locations.map((loc) => (
            <div key={loc.id} className="py-3" data-testid="geopush-location-row">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#0B0B16] truncate">{loc.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${loc.display ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {loc.display ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{loc.address}</p>
                  <p className="text-xs text-zinc-400 mt-1">"{loc.message}"</p>
                  <p className="text-xs text-zinc-400">{(loc.template_ids || []).map(templateName).join(', ') || 'Sin tarjetas asignadas'}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEditForm(loc)} className="p-1.5 text-zinc-400 hover:text-[#5B7CF7]" data-testid="geopush-edit-btn">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(loc.id)} className="p-1.5 text-zinc-400 hover:text-red-500" data-testid="geopush-delete-btn">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta ubicación?</AlertDialogTitle>
            <AlertDialogDescription>
              Los clientes cerca de este punto dejarán de recibir la notificación de proximidad.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="geopush-confirm-delete">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
