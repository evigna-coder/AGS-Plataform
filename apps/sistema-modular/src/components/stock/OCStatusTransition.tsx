import { useState } from 'react';
import type { OrdenCompra, EstadoOC } from '@ags/shared';
import { ESTADO_OC_LABELS, ESTADO_OC_COLORS } from '@ags/shared';
import { ordenesCompraService } from '../../services/firebaseService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

const VALID_TRANSITIONS: Record<EstadoOC, EstadoOC[]> = {
  borrador: ['pendiente_aprobacion', 'cancelada'],
  pendiente_aprobacion: ['aprobada', 'cancelada'],
  aprobada: ['enviada_proveedor', 'cancelada'],
  enviada_proveedor: ['confirmada', 'cancelada'],
  confirmada: ['en_transito', 'cancelada'],
  en_transito: ['recibida', 'recibida_parcial', 'cancelada'],
  recibida_parcial: ['recibida', 'cancelada'],
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

  const handleConfirm = async () => {
    if (!newEstado) return;
    setSaving(true);
    try {
      await ordenesCompraService.update(oc.id, { estado: newEstado });
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
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar estado...</option>
              {allowedStates.map(s => (
                <option key={s} value={s}>{ESTADO_OC_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
};
