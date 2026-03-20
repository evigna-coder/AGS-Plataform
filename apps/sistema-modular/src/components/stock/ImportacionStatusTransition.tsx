import { useState } from 'react';
import { importacionesService } from '../../services/firebaseService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { Importacion, EstadoImportacion } from '@ags/shared';
import { ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS } from '@ags/shared';

interface Props {
  imp: Importacion;
  onClose: () => void;
  onUpdate: () => void;
}

const VALID_TRANSITIONS: Record<EstadoImportacion, EstadoImportacion[]> = {
  preparacion: ['embarcado', 'cancelado'],
  embarcado: ['en_transito', 'cancelado'],
  en_transito: ['en_aduana', 'cancelado'],
  en_aduana: ['despachado', 'cancelado'],
  despachado: ['recibido', 'cancelado'],
  recibido: ['cancelado'],
  cancelado: [],
};

export const ImportacionStatusTransition: React.FC<Props> = ({ imp, onClose, onUpdate }) => {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<EstadoImportacion | null>(null);

  const allowedTransitions = VALID_TRANSITIONS[imp.estado] || [];

  const handleSave = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      await importacionesService.update(imp.id, { estado: selected });
      onUpdate();
    } catch (err) {
      alert('Error al cambiar estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Cambiar estado"
      subtitle={`${imp.numero} - Estado actual: ${ESTADO_IMPORTACION_LABELS[imp.estado]}`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !selected}>
            {saving ? 'Guardando...' : 'Confirmar'}
          </Button>
        </>
      }
    >
      {allowedTransitions.length === 0 ? (
        <p className="text-xs text-slate-500 py-4">No hay transiciones disponibles desde el estado actual.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-3">Selecciona el nuevo estado:</p>
          {allowedTransitions.map(estado => (
            <button
              key={estado}
              onClick={() => setSelected(estado)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                selected === estado
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[estado]}`}>
                {ESTADO_IMPORTACION_LABELS[estado]}
              </span>
              {estado === 'cancelado' && (
                <span className="text-[10px] text-slate-400 ml-auto">Cancelar operacion</span>
              )}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
};
