import { useState } from 'react';
import type { ConceptoServicio, CategoriaPresupuesto, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const MONEDAS: MonedaPresupuesto[] = ['USD', 'ARS', 'EUR'];
const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";

export interface ConceptoServicioFormData {
  codigo: string | null;
  descripcion: string;
  valorBase: number;
  moneda: MonedaPresupuesto;
  factorActualizacion: number;
  categoriaPresupuestoId: string | null;
  activo: boolean;
}

interface Props {
  /** Concepto a editar, o null para alta. */
  initial: ConceptoServicio | null;
  categorias: CategoriaPresupuesto[];
  saving: boolean;
  onSave: (data: ConceptoServicioFormData) => void;
  onCancel: () => void;
}

/**
 * Form de alta/edición de concepto, con estado PROPIO: tipear acá no re-renderiza
 * la tabla del catálogo en el modal padre (UAT 2026-07-30: cada letra demoraba
 * porque el form compartía estado con la lista completa).
 */
export function ConceptoServicioForm({ initial, categorias, saving, onSave, onCancel }: Props) {
  const [codigo, setCodigo] = useState(initial?.codigo || '');
  const [descripcion, setDescripcion] = useState(initial?.descripcion || '');
  const [valorBase, setValorBase] = useState(initial?.valorBase ?? 0);
  const [moneda, setMoneda] = useState<MonedaPresupuesto>(initial?.moneda || 'USD');
  const [factor, setFactor] = useState(initial?.factorActualizacion ?? 1);
  const [catId, setCatId] = useState(initial?.categoriaPresupuestoId || '');
  const [activo, setActivo] = useState(initial?.activo ?? true);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-700">{initial ? 'Editar concepto' : 'Nuevo concepto'}</p>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <div>
          <label className={lbl}>Código</label>
          <Input inputSize="sm" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="MP1_CN_60" />
        </div>
        <div>
          <label className={lbl}>Descripción *</label>
          <Input inputSize="sm" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Servicio de calibración..." />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Valor base *</label>
          <Input inputSize="sm" type="number" min={0} step="any" value={String(valorBase)} onFocus={e => e.currentTarget.select()}
            onChange={e => setValorBase(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className={lbl}>Moneda</label>
          <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
            value={moneda} onChange={e => setMoneda(e.target.value as MonedaPresupuesto)}>
            {MONEDAS.map(m => <option key={m} value={m}>{m} ({MONEDA_SIMBOLO[m]})</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Factor</label>
          <Input inputSize="sm" type="number" min={0} step="any" value={String(factor)} onFocus={e => e.currentTarget.select()}
            onChange={e => setFactor(Number(e.target.value) || 1)} />
        </div>
      </div>
      <p className="text-[10px] text-slate-400">
        Precio efectivo: <span className="font-semibold text-teal-700">{MONEDA_SIMBOLO[moneda]} {(valorBase * factor).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
      </p>
      <div>
        <label className={lbl}>Categoría impositiva</label>
        <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
          value={catId} onChange={e => setCatId(e.target.value)}>
          <option value="">Sin categoría</option>
          {categorias.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="rounded border-slate-300" />
        Activo
      </label>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" disabled={saving || !descripcion.trim()}
          onClick={() => onSave({
            codigo: codigo.trim() || null,
            descripcion: descripcion.trim(),
            valorBase,
            moneda,
            factorActualizacion: factor,
            categoriaPresupuestoId: catId || null,
            activo,
          })}>
          {saving ? 'Guardando...' : initial ? 'Guardar' : 'Crear'}
        </Button>
      </div>
    </div>
  );
}
