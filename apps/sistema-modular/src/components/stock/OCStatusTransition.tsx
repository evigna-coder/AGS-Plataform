import { useState } from 'react';
import type { OrdenCompra, EstadoOC } from '@ags/shared';
import { ESTADO_OC_LABELS, ESTADO_OC_COLORS } from '@ags/shared';
import { ordenesCompraService } from '../../services/firebaseService';
import { calificacionesService } from '../../services/calificacionesService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

const VALID_TRANSITIONS: Record<EstadoOC, EstadoOC[]> = {
  borrador: ['enviada_proveedor', 'cancelada'],
  enviada_proveedor: ['embarcada', 'recibida', 'cancelada'],
  embarcada: ['recibida', 'cancelada'],
  recibida: [],
  cancelada: [],
};

interface Props {
  oc: OrdenCompra;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const OCStatusTransition: React.FC<Props> = ({ oc, open, onClose, onUpdated }) => {
  const [newEstado, setNewEstado] = useState<EstadoOC | ''>('');
  const [saving, setSaving] = useState(false);

  const allowedStates = VALID_TRANSITIONS[oc.estado] || [];

  /**
   * Cuánto de la OC todavía no entró a stock (2026-08-18). Marcar 'recibida'
   * acá NO da de alta nada: si además falta ingresar, la OC queda cerrada con
   * mercadería que el sistema no tiene. Pasó con SIN001.
   */
  const faltaIngresar = (oc.items ?? []).reduce(
    (acc, it) => acc + Math.max(0, (it.cantidad ?? 0) - (it.cantidadRecibida ?? 0)), 0);

  const handleConfirm = async () => {
    if (!newEstado) return;
    setSaving(true);
    try {
      // Al marcar recibida a mano, estampar fechaRecepcion si falta (2026-08-12).
      const fechaRecepcion = oc.fechaRecepcion || new Date().toISOString();
      await ordenesCompraService.update(oc.id, {
        estado: newEstado,
        ...(newEstado === 'recibida' ? { fechaRecepcion } : {}),
      });
      // Calificación pendiente del proveedor (best-effort, idempotente por
      // origenKey; las OC de importación se califican por embarque, no acá).
      if (newEstado === 'recibida') {
        await calificacionesService.crearPendienteDesdeOC({ ...oc, fechaRecepcion })
          .catch(err => console.warn('[OCStatusTransition] calificación pendiente falló:', err));
      }
      setNewEstado('');
      onUpdated();
    } catch (err) {
      console.error('Error actualizando estado:', err);
      alert('Error al cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambiar estado"
      subtitle={`Orden ${oc.numero}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!newEstado || saving}>
            {saving ? 'Guardando...' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-medium text-slate-400 mb-1">Estado actual</p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_OC_COLORS[oc.estado]}`}>
            {ESTADO_OC_LABELS[oc.estado]}
          </span>
        </div>

        {allowedStates.length === 0 ? (
          <p className="text-xs text-slate-500">No hay transiciones disponibles desde este estado.</p>
        ) : (
          <div>
            <p className="text-[11px] font-medium text-slate-400 mb-1">Nuevo estado</p>
            <select
              value={newEstado}
              onChange={e => setNewEstado(e.target.value as EstadoOC)}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Seleccionar estado...</option>
              {allowedStates.map(s => (
                <option key={s} value={s}>{ESTADO_OC_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {newEstado === 'recibida' && faltaIngresar > 0 && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-[11px] text-amber-900 font-medium">
            Quedan {faltaIngresar} unidad(es) sin ingresar a stock.
          </p>
          <p className="text-[10px] text-amber-800/90 mt-0.5">
            Este cambio de estado NO da de alta mercadería. El alta se hace con
            «Ingresar stock de esta OC», en el detalle de la orden. Si marcás
            recibida sin ingresar, la OC queda cerrada y el stock no existe.
          </p>
        </div>
      )}
    </Modal>
  );
};
