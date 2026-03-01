import { useState, useEffect } from 'react';
import { posicionesStockService, minikitsService, ingenierosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { CondicionUnidad, TipoUbicacionStock } from '@ags/shared';

const CONDICION_LABELS: Record<CondicionUnidad, string> = {
  nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap',
};
const TIPO_UBICACION_LABELS: Record<TipoUbicacionStock, string> = {
  posicion: 'Posicion', minikit: 'Minikit', ingeniero: 'Ingeniero', cliente: 'Cliente', proveedor: 'Proveedor', transito: 'En transito',
};
const CONDICIONES: CondicionUnidad[] = ['nuevo', 'bien_de_uso', 'reacondicionado', 'vendible', 'scrap'];
const TIPOS_UBICACION: TipoUbicacionStock[] = ['posicion', 'minikit', 'ingeniero', 'cliente', 'proveedor', 'transito'];

export interface UnitFormData {
  nroSerie: string; nroLote: string; condicion: CondicionUnidad; estado: 'disponible';
  ubicacionTipo: TipoUbicacionStock; ubicacionRefId: string; ubicacionRefNombre: string;
  costoUnitario: string; monedaCosto: 'ARS' | 'USD'; observaciones: string;
}

export const emptyUnitForm = (): UnitFormData => ({
  nroSerie: '', nroLote: '', condicion: 'nuevo', estado: 'disponible',
  ubicacionTipo: 'posicion', ubicacionRefId: '', ubicacionRefNombre: '',
  costoUnitario: '', monedaCosto: 'USD', observaciones: '',
});

interface Props {
  onSubmit: (form: UnitFormData, refOptions: { id: string; label: string }[]) => void;
  onCancel: () => void;
  saving: boolean;
}

export const AddUnitForm = ({ onSubmit, onCancel, saving }: Props) => {
  const [form, setForm] = useState(emptyUnitForm());
  const [refOptions, setRefOptions] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    const loadRefs = async () => {
      if (form.ubicacionTipo === 'posicion') {
        const items = await posicionesStockService.getAll();
        setRefOptions(items.map(i => ({ id: i.id, label: `${i.codigo} - ${i.nombre}` })));
      } else if (form.ubicacionTipo === 'minikit') {
        const items = await minikitsService.getAll();
        setRefOptions(items.map(i => ({ id: i.id, label: `${i.codigo} - ${i.nombre}` })));
      } else if (form.ubicacionTipo === 'ingeniero') {
        const items = await ingenierosService.getAll();
        setRefOptions(items.map(i => ({ id: i.id, label: i.nombre })));
      } else { setRefOptions([]); }
    };
    loadRefs();
  }, [form.ubicacionTipo]);

  const sel = 'w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs';

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
      <p className="text-xs font-semibold text-slate-700">Nueva unidad</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Nro serie</label><Input value={form.nroSerie} onChange={e => setForm({ ...form, nroSerie: e.target.value })} className="text-xs" /></div>
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Nro lote</label><Input value={form.nroLote} onChange={e => setForm({ ...form, nroLote: e.target.value })} className="text-xs" /></div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-0.5">Condicion</label>
          <select className={sel} value={form.condicion} onChange={e => setForm({ ...form, condicion: e.target.value as CondicionUnidad })}>
            {CONDICIONES.map(c => <option key={c} value={c}>{CONDICION_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-0.5">Tipo ubicacion</label>
          <select className={sel} value={form.ubicacionTipo} onChange={e => setForm({ ...form, ubicacionTipo: e.target.value as TipoUbicacionStock, ubicacionRefId: '', ubicacionRefNombre: '' })}>
            {TIPOS_UBICACION.map(t => <option key={t} value={t}>{TIPO_UBICACION_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-0.5">Ubicacion ref.</label>
          {refOptions.length > 0 ? (
            <select className={sel} value={form.ubicacionRefId} onChange={e => setForm({ ...form, ubicacionRefId: e.target.value })}>
              <option value="">Seleccionar...</option>
              {refOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          ) : (
            <Input value={form.ubicacionRefNombre} onChange={e => setForm({ ...form, ubicacionRefNombre: e.target.value })} placeholder="Nombre referencia" className="text-xs" />
          )}
        </div>
        <div><label className="block text-[11px] text-slate-500 mb-0.5">Costo unitario</label><Input type="number" value={form.costoUnitario} onChange={e => setForm({ ...form, costoUnitario: e.target.value })} className="text-xs" /></div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-0.5">Moneda costo</label>
          <select className={sel} value={form.monedaCosto} onChange={e => setForm({ ...form, monedaCosto: e.target.value as 'ARS' | 'USD' })}>
            <option value="USD">USD</option><option value="ARS">ARS</option>
          </select>
        </div>
        <div className="md:col-span-2"><label className="block text-[11px] text-slate-500 mb-0.5">Observaciones</label><Input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="text-xs" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSubmit(form, refOptions)} disabled={saving}>{saving ? 'Guardando...' : 'Crear unidad'}</Button>
      </div>
    </div>
  );
};
