import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import type { CalificacionProveedor, CriterioEvaluacion, Proveedor } from '@ags/shared';
import { CRITERIOS_DEFAULT, CRITERIOS_POR_ORIGEN, ORIGEN_CALIFICACION_LABELS } from '@ags/shared';
import { calcEstadoCalificacion } from '../../services/calificacionesService';
import { detalleCalificacion } from '../../utils/calificaciones';
import { getCurrentUser } from '../../services/currentUser';
import { CriteriosEditor } from './CriteriosEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Alta manual / edición de una calificada. */
  onSave: (data: Omit<CalificacionProveedor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  /** Completar una pendiente (proveedor y refs quedan readonly). */
  onCalificar?: (id: string, data: { criterios: CriterioEvaluacion[]; puntajeTotal: number; observaciones?: string | null; responsable: string }) => Promise<void>;
  proveedores: Proveedor[];
  editing?: CalificacionProveedor | null;
  pendiente?: CalificacionProveedor | null;
}

/**
 * Criterios iniciales de una pendiente: el set según el origen, con puntaje
 * pre-sugerido desde las métricas del disparador — plazo desde diasAtraso
 * (lineal: 0 atraso = máximo, 30+ días = 0) y cantidad desde completitudPct.
 */
function criteriosParaPendiente(p: CalificacionProveedor): CriterioEvaluacion[] {
  const set = CRITERIOS_POR_ORIGEN[p.origen ?? 'manual'] ?? CRITERIOS_DEFAULT;
  return set.map(c => {
    let puntaje = c.pesoMax;
    if (c.id === 'plazo' && typeof p.diasAtraso === 'number') {
      puntaje = p.diasAtraso <= 0 ? c.pesoMax : Math.max(0, c.pesoMax - Math.ceil(c.pesoMax * p.diasAtraso / 30));
    }
    if (c.id === 'cantidad' && typeof p.completitudPct === 'number') {
      puntaje = Math.max(0, Math.min(c.pesoMax, Math.round(c.pesoMax * p.completitudPct / 100)));
    }
    return { ...c, puntaje };
  });
}

const emptyForm = () => ({
  proveedorId: '',
  proveedorNombre: '',
  ordenCompraNro: '',
  remitoNro: '',
  fechaRecepcion: new Date().toISOString().split('T')[0],
  criterios: CRITERIOS_DEFAULT.map(c => ({ ...c })) as CriterioEvaluacion[],
  observaciones: '',
  responsable: getCurrentUser()?.displayName ?? '',
});

export function CalificacionModal({ open, onClose, onSave, onCalificar, proveedores, editing, pendiente }: Props) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pendiente) {
      setForm({
        proveedorId: pendiente.proveedorId,
        proveedorNombre: pendiente.proveedorNombre,
        ordenCompraNro: pendiente.ordenCompraNro || '',
        remitoNro: pendiente.remitoNro || '',
        fechaRecepcion: pendiente.fechaRecepcion,
        criterios: criteriosParaPendiente(pendiente),
        observaciones: '',
        responsable: getCurrentUser()?.displayName ?? '',
      });
    } else if (editing) {
      setForm({
        proveedorId: editing.proveedorId,
        proveedorNombre: editing.proveedorNombre,
        ordenCompraNro: editing.ordenCompraNro || '',
        remitoNro: editing.remitoNro || '',
        fechaRecepcion: editing.fechaRecepcion,
        criterios: editing.criterios ?? CRITERIOS_DEFAULT.map(c => ({ ...c })),
        observaciones: editing.observaciones || '',
        responsable: editing.responsable || '',
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, pendiente, open]);

  const readonlyRefs = !!pendiente;
  const puntajeTotal = form.criterios.reduce((sum, c) => sum + c.puntaje, 0);
  const estado = calcEstadoCalificacion(puntajeTotal);

  const updateCriterio = (id: string, puntaje: number) => {
    setForm(prev => ({
      ...prev,
      criterios: prev.criterios.map(c => c.id === id ? { ...c, puntaje: Math.min(puntaje, c.pesoMax) } : c),
    }));
  };

  const handleSubmit = async () => {
    if (!form.proveedorId || !form.fechaRecepcion || !form.responsable) return;
    setSaving(true);
    try {
      if (pendiente && onCalificar) {
        await onCalificar(pendiente.id, {
          criterios: form.criterios,
          puntajeTotal,
          observaciones: form.observaciones || null,
          responsable: form.responsable,
        });
      } else {
        await onSave({
          proveedorId: form.proveedorId,
          proveedorNombre: form.proveedorNombre,
          ordenCompraNro: form.ordenCompraNro || null,
          remitoNro: form.remitoNro || null,
          fechaRecepcion: form.fechaRecepcion,
          criterios: form.criterios,
          puntajeTotal,
          estado,
          observaciones: form.observaciones || null,
          responsable: form.responsable,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const proveedorOptions = proveedores.filter(p => p.activo).map(p => ({ value: p.id, label: p.nombre }));
  const label = 'text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1';
  const ctrl = 'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm';
  const metricas: string[] = pendiente ? [
    typeof pendiente.diasAtraso === 'number' ? `Atraso: ${pendiente.diasAtraso} d` : '',
    typeof pendiente.completitudPct === 'number' ? `Completitud: ${pendiente.completitudPct}%` : '',
    typeof pendiente.diasEnProveedor === 'number' ? `En proveedor: ${pendiente.diasEnProveedor} d` : '',
  ].filter(Boolean) : [];

  return (
    <Modal open={open} onClose={onClose} title={pendiente ? 'Calificar Proveedor' : editing ? 'Editar Calificación' : 'Nueva Calificación'}>
      <div className="space-y-4 p-4">
        {pendiente && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600">
            <span className="font-medium">{ORIGEN_CALIFICACION_LABELS[pendiente.origen ?? 'manual']}</span>
            {' — '}{detalleCalificacion(pendiente)}
            {metricas.length > 0 && (
              <span className="block mt-0.5 font-mono text-[10px] text-slate-400">{metricas.join(' · ')}</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Proveedor *</label>
            {readonlyRefs ? (
              <p className="text-sm font-semibold text-teal-700 py-1.5">{form.proveedorNombre}</p>
            ) : (
              <SearchableSelect
                value={form.proveedorId}
                onChange={(v: string) => {
                  const prov = proveedores.find(p => p.id === v);
                  setForm(prev => ({ ...prev, proveedorId: v, proveedorNombre: prov?.nombre || '' }));
                }}
                options={proveedorOptions}
                placeholder="Seleccionar proveedor..."
              />
            )}
          </div>
          <div>
            <label className={label}>Fecha recepción *</label>
            {readonlyRefs ? (
              <p className="text-sm text-slate-700 py-1.5 font-mono">{form.fechaRecepcion}</p>
            ) : (
              <input type="date" value={form.fechaRecepcion}
                onChange={e => setForm(prev => ({ ...prev, fechaRecepcion: e.target.value }))} className={ctrl} />
            )}
          </div>
          {(!readonlyRefs || form.ordenCompraNro) && (
            <div>
              <label className={label}>Orden de compra</label>
              {readonlyRefs ? (
                <p className="text-sm text-slate-700 py-1.5">{form.ordenCompraNro}</p>
              ) : (
                <input value={form.ordenCompraNro} placeholder="Nro OC" className={ctrl}
                  onChange={e => setForm(prev => ({ ...prev, ordenCompraNro: e.target.value }))} />
              )}
            </div>
          )}
          {(!readonlyRefs || form.remitoNro) && (
            <div>
              <label className={label}>Remito</label>
              {readonlyRefs ? (
                <p className="text-sm text-slate-700 py-1.5">{form.remitoNro}</p>
              ) : (
                <input value={form.remitoNro} placeholder="Nro remito" className={ctrl}
                  onChange={e => setForm(prev => ({ ...prev, remitoNro: e.target.value }))} />
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Criterios de evaluación</label>
          <CriteriosEditor criterios={form.criterios} puntajeTotal={puntajeTotal} estado={estado} onChange={updateCriterio} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Responsable *</label>
            <input value={form.responsable} placeholder="Iniciales o nombre" className={ctrl}
              onChange={e => setForm(prev => ({ ...prev, responsable: e.target.value }))} />
          </div>
          <div>
            <label className={label}>Observaciones</label>
            <input value={form.observaciones} placeholder="Notas adicionales" className={ctrl}
              onChange={e => setForm(prev => ({ ...prev, observaciones: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving || !form.proveedorId || !form.responsable}>
          {saving ? 'Guardando...' : pendiente ? 'Calificar' : editing ? 'Actualizar' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
}
