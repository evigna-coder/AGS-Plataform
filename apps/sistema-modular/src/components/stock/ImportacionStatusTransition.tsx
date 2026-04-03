import { useState } from 'react';
import { importacionesService } from '../../services/firebaseService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
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

const REQUIRED_FIELDS_FOR_STATE: Partial<Record<EstadoImportacion, (imp: Importacion) => string | null>> = {
  embarcado: (imp) => {
    if (!imp.fechaEmbarque) return 'Ingresá la fecha de embarque en la sección Embarque';
    if (!imp.booking) return 'Ingresá el número de booking en la sección Embarque';
    return null;
  },
  en_aduana: (imp) => {
    if (!imp.fechaArriboReal) return 'Ingresá la fecha de arribo real en la sección Embarque';
    return null;
  },
  despachado: (imp) => {
    if (!imp.despachoNumero) return 'Ingresá el número DUA en la sección Aduana';
    return null;
  },
  recibido: (imp) => {
    if (!imp.fechaRecepcion) return 'Ingresá la fecha de recepción';
    return null;
  },
};

export const ImportacionStatusTransition: React.FC<Props> = ({ imp, onClose, onUpdate }) => {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<EstadoImportacion | null>(null);
  const [fechaRecepcion, setFechaRecepcion] = useState<string>(imp.fechaRecepcion ? imp.fechaRecepcion.slice(0, 10) : '');

  const allowedTransitions = VALID_TRANSITIONS[imp.estado] || [];

  // Build a local copy of imp for validation, reflecting the in-flight fechaRecepcion input
  const impWithLocalRecepcion: Importacion = selected === 'recibido'
    ? { ...imp, fechaRecepcion: fechaRecepcion || null }
    : imp;

  const validationError = selected
    ? (REQUIRED_FIELDS_FOR_STATE[selected]?.(impWithLocalRecepcion) ?? null)
    : null;

  const handleFechaRecepcionChange = async (value: string) => {
    setFechaRecepcion(value);
    // Persist immediately so it's available even if user saves via other path
    await importacionesService.update(imp.id, { fechaRecepcion: value || null });
  };

  const handleSave = async () => {
    if (!selected) return;
    if (validationError) return;
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
          <Button size="sm" onClick={handleSave} disabled={saving || !selected || validationError !== null}>
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
                  ? 'border-teal-500 bg-teal-50'
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

          {selected === 'recibido' && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <Input
                inputSize="sm"
                label="Fecha de recepción"
                type="date"
                value={fechaRecepcion}
                onChange={(e) => handleFechaRecepcionChange(e.target.value)}
              />
            </div>
          )}

          {validationError !== null && (
            <p className="text-xs text-red-500 mt-2">{validationError}</p>
          )}
        </div>
      )}
    </Modal>
  );
};
