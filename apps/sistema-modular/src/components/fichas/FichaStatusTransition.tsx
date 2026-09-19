import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { EstadoFicha } from '@ags/shared';
import { ESTADO_FICHA_LABELS } from '@ags/shared';

import { Select } from '../ui/Select';
const TRANSITIONS: Record<EstadoFicha, EstadoFicha[]> = {
  recibido: ['en_diagnostico'],
  en_diagnostico: ['en_reparacion', 'derivado_proveedor', 'esperando_repuesto', 'listo_para_entrega'],
  en_reparacion: ['listo_para_entrega', 'derivado_proveedor', 'esperando_repuesto'],
  derivado_proveedor: ['en_reparacion', 'esperando_repuesto', 'listo_para_entrega'],
  esperando_repuesto: ['en_reparacion', 'listo_para_entrega'],
  listo_para_entrega: ['en_envio', 'entregado'],
  // 'en_envio' lo setea automáticamente la generación de remito de devolución; las
  // transiciones manuales permitidas son volver atrás (no se entregó) o confirmar entrega.
  en_envio: ['listo_para_entrega', 'entregado'],
  // Reingreso (2026-09-18, ficha FPC-0002145): una placa entregada volvió con
  // falla y hay que derivarla de nuevo. Antes 'entregado' era terminal y el
  // ítem no aparecía como candidato a derivar; ahora vuelve a 'recibido' con
  // motivo obligatorio y toda la historia queda en la misma ficha.
  entregado: ['recibido'],
};

interface Props {
  currentEstado: EstadoFicha;
  onTransition: (nuevoEstado: EstadoFicha, nota: string) => Promise<void>;
}

export function FichaStatusTransition({ currentEstado, onTransition }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedEstado, setSelectedEstado] = useState<EstadoFicha | ''>('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  const options = TRANSITIONS[currentEstado] || [];
  const esReingreso = currentEstado === 'entregado';

  if (options.length === 0) return null;

  const abrir = () => {
    // Con una sola salida posible no hay nada que elegir.
    setSelectedEstado(options.length === 1 ? options[0] : '');
    setOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedEstado || !nota.trim()) return;
    setSaving(true);
    try {
      await onTransition(selectedEstado, nota.trim());
      setOpen(false);
      setSelectedEstado('');
      setNota('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant={esReingreso ? 'outline' : 'primary'} size="sm" onClick={abrir}
        title={esReingreso ? 'El equipo volvió del cliente: vuelve a Recibido para diagnosticarlo o derivarlo de nuevo' : undefined}>
        {esReingreso ? 'Reingresar' : 'Cambiar estado'}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={esReingreso ? 'Reingresar el equipo' : 'Cambiar estado de la ficha'}
        subtitle={esReingreso ? 'Volvió del cliente. Pasa a Recibido y queda disponible para diagnosticar o derivar.' : `Estado actual: ${ESTADO_FICHA_LABELS[currentEstado]}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!selectedEstado || !nota.trim() || saving}>
              {saving ? 'Guardando...' : 'Confirmar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {!esReingreso && <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nuevo estado *</label>
            <Select
              className="w-full" selectSize="md"
              value={selectedEstado}
              onChange={e => setSelectedEstado(e.target.value as EstadoFicha)}
            >
              <option value="">Seleccionar</option>
              {options.map(e => (
                <option key={e} value={e}>{ESTADO_FICHA_LABELS[e]}</option>
              ))}
            </Select>
          </div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{esReingreso ? 'Motivo del reingreso *' : 'Nota / comentario *'}</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px]"
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder={esReingreso ? 'Qué falla volvió a presentar y cómo llegó (remito, quién lo trajo)' : 'Describir el motivo del cambio de estado'}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
