import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import type { CalificacionProveedor, CriterioEvaluacion, Proveedor, EstadoCalificacion } from '@ags/shared';
import { CRITERIOS_DEFAULT } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<CalificacionProveedor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  proveedores: Proveedor[];
  editing?: CalificacionProveedor | null;
}

const CRITERIO_DESCRIPCION: Record<string, string> = {
  conformidad: 'El producto recibido cumple con las especificaciones técnicas, número de parte y condiciones solicitadas en la orden de compra.',
  plazo: 'La entrega se realizó dentro del plazo acordado. Penalizar proporcionalmente por días de atraso.',
  cantidad: 'La cantidad recibida coincide con la cantidad solicitada. Sin faltantes ni excedentes.',
  documentacion: 'Incluye remito, certificado de análisis (CoA), MSDS, factura y toda documentación requerida.',
  embalaje: 'El producto llegó correctamente embalado, sin daños ni contaminación. Especialmente importante para componentes sensibles.',
  respuesta: 'Tiempo desde la emisión de la orden de compra hasta el despacho efectivo por parte del proveedor.',
  precio: 'El precio facturado coincide con el cotizado. Sin recargos no pactados.',
};

function calcEstado(puntaje: number): EstadoCalificacion {
  if (puntaje >= 80) return 'aprobado';
  if (puntaje >= 60) return 'condicional';
  return 'no_aprobado';
}

const emptyForm = () => ({
  proveedorId: '',
  proveedorNombre: '',
  ordenCompraNro: '',
  remitoNro: '',
  fechaRecepcion: new Date().toISOString().split('T')[0],
  criterios: CRITERIOS_DEFAULT.map(c => ({ ...c, puntaje: c.pesoMax })) as CriterioEvaluacion[],
  observaciones: '',
  responsable: '',
});

export function CalificacionModal({ open, onClose, onSave, proveedores, editing }: Props) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        proveedorId: editing.proveedorId,
        proveedorNombre: editing.proveedorNombre,
        ordenCompraNro: editing.ordenCompraNro || '',
        remitoNro: editing.remitoNro || '',
        fechaRecepcion: editing.fechaRecepcion,
        criterios: editing.criterios,
        observaciones: editing.observaciones || '',
        responsable: editing.responsable,
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, open]);

  const puntajeTotal = form.criterios.reduce((sum, c) => sum + c.puntaje, 0);
  const estado = calcEstado(puntajeTotal);

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
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const proveedorOptions = proveedores.filter(p => p.activo).map(p => ({ value: p.id, label: p.nombre }));

  const estadoColor = estado === 'aprobado' ? 'bg-emerald-100 text-emerald-700'
    : estado === 'condicional' ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';

  const estadoLabel = estado === 'aprobado' ? 'Aprobado' : estado === 'condicional' ? 'Condicional' : 'No aprobado';

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar Calificación' : 'Nueva Calificación'}>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Proveedor *</label>
            <SearchableSelect
              value={form.proveedorId}
              onChange={(v: string) => {
                const prov = proveedores.find(p => p.id === v);
                setForm(prev => ({ ...prev, proveedorId: v, proveedorNombre: prov?.nombre || '' }));
              }}
              options={proveedorOptions}
              placeholder="Seleccionar proveedor..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Fecha recepción *</label>
            <input type="date" value={form.fechaRecepcion}
              onChange={e => setForm(prev => ({ ...prev, fechaRecepcion: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Orden de compra</label>
            <input value={form.ordenCompraNro}
              onChange={e => setForm(prev => ({ ...prev, ordenCompraNro: e.target.value }))}
              placeholder="Nro OC"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Remito</label>
            <input value={form.remitoNro}
              onChange={e => setForm(prev => ({ ...prev, remitoNro: e.target.value }))}
              placeholder="Nro remito"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Criterios de evaluación</label>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-400 uppercase">Criterio</th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-slate-400 uppercase w-20">Máx</th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-slate-400 uppercase w-28">Puntaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.criterios.map(c => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 text-slate-700 group relative cursor-help" title={CRITERIO_DESCRIPCION[c.id] || ''}>
                      <span className="border-b border-dashed border-slate-300">{c.nombre}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-400 font-mono text-xs">{c.pesoMax}</td>
                    <td className="px-3 py-2 text-center">
                      <input type="number" min={0} max={c.pesoMax} value={c.puntaje}
                        onChange={e => updateCriterio(c.id, Number(e.target.value) || 0)}
                        className="w-16 border border-slate-300 rounded px-2 py-1 text-center text-sm font-mono" />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className="px-3 py-2 font-bold text-slate-700">Total</td>
                  <td className="px-3 py-2 text-center font-mono text-xs text-slate-400">100</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${estadoColor}`}>
                      {puntajeTotal} — {estadoLabel}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Responsable *</label>
            <input value={form.responsable}
              onChange={e => setForm(prev => ({ ...prev, responsable: e.target.value }))}
              placeholder="Iniciales o nombre"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Observaciones</label>
            <input value={form.observaciones}
              onChange={e => setForm(prev => ({ ...prev, observaciones: e.target.value }))}
              placeholder="Notas adicionales"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving || !form.proveedorId || !form.responsable}>
          {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
}
