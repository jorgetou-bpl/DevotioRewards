import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Pencil, Ban, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
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

// Only these three types have an exact Boomerangme reversal — mirrors
// CANCELABLE_REVERSALS in backend/routes/operations.py. Kept in sync
// manually since it's a short, stable list; not worth a round-trip just to
// ask the backend "is this cancelable" before rendering a button.
const CANCELABLE_TYPES = new Set(['add-point', 'add-scores', 'add-visit']);

// Row-level Editar/Cancelar actions for Historial — admin-only (gated by
// the caller checking user.role), hidden entirely for already-canceled rows
// beyond a status badge. Edit never touches Boomerangme (no endpoint to
// revise a past accrual); Cancel does, via the same subtract-* calls the
// original add-* used.
export const OperationRowActions = ({ operation, token, onChanged }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [purchaseSum, setPurchaseSum] = useState(operation.purchase_sum ?? '');
  const [note, setNote] = useState(operation.note ?? '');
  const [saving, setSaving] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  if (operation.canceled) {
    return <span className="text-xs text-zinc-400 italic" data-testid="op-canceled-badge">Cancelada</span>;
  }

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/operations/${operation.id}`, {
        purchase_sum: purchaseSum === '' ? null : Number(purchaseSum),
        note
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Operación actualizada');
      setEditOpen(false);
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo actualizar la operación');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await axios.post(`${API}/operations/${operation.id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Operación cancelada');
      setCancelOpen(false);
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo cancelar la operación');
      setCancelOpen(false);
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setEditOpen(true)}
        className="p-1.5 text-zinc-400 hover:text-[#5B7CF7] transition-colors"
        aria-label="Editar operación"
        data-testid={`edit-op-${operation.id}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {CANCELABLE_TYPES.has(operation.operation_type) && (
        <button
          onClick={() => setCancelOpen(true)}
          className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
          aria-label="Cancelar operación"
          data-testid={`cancel-op-${operation.id}`}
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar operación</DialogTitle>
            <DialogDescription>
              Corrige el monto de compra o la nota. Esto no modifica el saldo de la tarjeta en Boomerangme.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Monto de compra</label>
              <Input
                type="number"
                value={purchaseSum}
                onChange={(e) => setPurchaseSum(e.target.value)}
                data-testid="edit-op-purchase-sum"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Nota</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                data-testid="edit-op-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-2 border-zinc-200">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="btn-primary" data-testid="save-edit-op">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta operación?</AlertDialogTitle>
            <AlertDialogDescription>
              Va a revertir el saldo en la tarjeta del cliente en Boomerangme y quedará registrada como cancelación. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={canceling} data-testid="confirm-cancel-op">
              {canceling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
