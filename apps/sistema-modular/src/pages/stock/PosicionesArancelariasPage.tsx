import { useState, useEffect, useRef, useCallback } from 'react';
import { posicionesArancelariasService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import type { PosicionArancelaria, TratamientoArancelario } from '@ags/shared';

interface FormState {
  codigo: string;
  descripcion: string;
  derechoImportacion: string;
  estadistica: string;
  iva: string;
  ivaAdicional: string;
  ganancias: string;
  ingresosBrutos: string;
  notas: string;
}

const emptyForm: FormState = {
  codigo: '', descripcion: '', derechoImportacion: '', estadistica: '',
  iva: '', ivaAdicional: '', ganancias: '', ingresosBrutos: '', notas: '',
};

const parseNum = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const fmtNum = (v: number | null | undefined): string => (v != null ? String(v) : '');

/** Auto-format SIM tariff code: 9027.90.99.999A → NNNN.NN.NN.NNNA */
const formatCodigoSIM = (raw: string): string => {
  const upper = raw.toUpperCase();
  // Separate trailing letter (if any) from digits
  let digits = '';
  let suffix = '';
  for (const ch of upper) {
    if (/\d/.test(ch)) digits += ch;
    else if (/[A-Z]/.test(ch) && digits.length >= 10) suffix = ch; // letter only after 10 digits
  }
  digits = digits.slice(0, 11); // max 11 digits (some NCM codes)
  // Insert dots: NNNN.NN.NN.NNN
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 4 || i === 6 || i === 8) out += '.';
    out += digits[i];
  }
  return out + suffix;
};

const toTratamiento = (f: FormState): TratamientoArancelario => ({
  derechoImportacion: parseNum(f.derechoImportacion),
  estadistica: parseNum(f.estadistica),
  iva: parseNum(f.iva),
  ivaAdicional: parseNum(f.ivaAdicional),
  ganancias: parseNum(f.ganancias),
  ingresosBrutos: parseNum(f.ingresosBrutos),
});

const fromItem = (p: PosicionArancelaria): FormState => ({
  codigo: p.codigo, descripcion: p.descripcion,
  derechoImportacion: fmtNum(p.tratamiento?.derechoImportacion),
  estadistica: fmtNum(p.tratamiento?.estadistica),
  iva: fmtNum(p.tratamiento?.iva),
  ivaAdicional: fmtNum(p.tratamiento?.ivaAdicional),
  ganancias: fmtNum(p.tratamiento?.ganancias),
  ingresosBrutos: fmtNum(p.tratamiento?.ingresosBrutos),
  notas: p.notas || '',
});

export const PosicionesArancelariasPage = () => {
  const [items, setItems] = useState<PosicionArancelaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = posicionesArancelariasService.subscribe(
      !showInactive,
      (data) => { setItems(data); setLoading(false); },
      (err) => { console.error('Error cargando posiciones arancelarias:', err); setLoading(false); }
    );
    return () => { unsubRef.current?.(); };
  }, [showInactive]);

  const reload = useCallback(() => {}, []);

  const handleCreate = async () => {
    if (!form.codigo.trim() || !form.descripcion.trim()) return;
    setSaving(true);
    try {
      await posicionesArancelariasService.create({
        codigo: form.codigo.trim(),
        descripcion: form.descripcion.trim(),
        tratamiento: toTratamiento(form),
        notas: form.notas.trim() || null,
        activo: true,
      });
      setForm(emptyForm);
      setShowCreate(false);
      reload();
    } catch { alert('Error al crear la posicion arancelaria'); }
    finally { setSaving(false); }
  };

  const startEdit = (p: PosicionArancelaria) => { setEditingId(p.id); setEditForm(fromItem(p)); };

  const handleUpdate = async (id: string) => {
    if (!editForm.codigo.trim() || !editForm.descripcion.trim()) return;
    try {
      await posicionesArancelariasService.update(id, {
        codigo: editForm.codigo.trim(),
        descripcion: editForm.descripcion.trim(),
        tratamiento: toTratamiento(editForm),
        notas: editForm.notas.trim() || null,
      });
      setEditingId(null);
      reload();
    } catch { alert('Error al actualizar'); }
  };

  const handleToggle = async (p: PosicionArancelaria) => {
    try { await posicionesArancelariasService.update(p.id, { activo: !p.activo }); reload(); }
    catch { alert('Error al cambiar estado'); }
  };

  const handleDelete = async (p: PosicionArancelaria) => {
    if (!confirm(`Eliminar permanentemente "${p.codigo}"?`)) return;
    try { await posicionesArancelariasService.delete(p.id); reload(); }
    catch { alert('Error al eliminar'); }
  };

  const numInput = (val: string, key: keyof FormState, setter: React.Dispatch<React.SetStateAction<FormState>>) => (
    <input type="number" step="0.01" value={val} onChange={e => setter(f => ({ ...f, [key]: e.target.value }))}
      className="border border-slate-300 rounded px-2 py-1 text-xs w-20" />
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Posiciones Arancelarias" subtitle="Catalogo de posiciones y tratamientos arancelarios" count={items.length}
        actions={<Button size="sm" onClick={() => setShowCreate(v => !v)}>{showCreate ? 'Cancelar' : '+ Agregar'}</Button>}>
        {showCreate && (
          <Card>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Codigo SIM *" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: formatCodigoSIM(e.target.value) }))} placeholder="9027.90.99.999A" autoFocus />
              <div className="lg:col-span-3">
                <Input label="Descripcion *" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripcion de la posicion" />
              </div>
              <Input label="Derecho Importacion %" type="number" step="0.01" value={form.derechoImportacion} onChange={e => setForm(f => ({ ...f, derechoImportacion: e.target.value }))} />
              <Input label="Estadistica %" type="number" step="0.01" value={form.estadistica} onChange={e => setForm(f => ({ ...f, estadistica: e.target.value }))} />
              <Input label="IVA %" type="number" step="0.01" value={form.iva} onChange={e => setForm(f => ({ ...f, iva: e.target.value }))} />
              <Input label="IVA Adicional %" type="number" step="0.01" value={form.ivaAdicional} onChange={e => setForm(f => ({ ...f, ivaAdicional: e.target.value }))} />
              <Input label="Ganancias %" type="number" step="0.01" value={form.ganancias} onChange={e => setForm(f => ({ ...f, ganancias: e.target.value }))} />
              <Input label="Ingresos Brutos %" type="number" step="0.01" value={form.ingresosBrutos} onChange={e => setForm(f => ({ ...f, ingresosBrutos: e.target.value }))} />
              <div className="lg:col-span-4 col-span-2">
                <Input label="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Notas adicionales" />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={handleCreate} disabled={saving || !form.codigo.trim() || !form.descripcion.trim()}>
                {saving ? 'Creando...' : 'Agregar'}
              </Button>
            </div>
          </Card>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        <div className="flex justify-end">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3.5 h-3.5 accent-teal-600" />
            Mostrar inactivos
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : items.length === 0 ? (
          <Card><div className="text-center py-8"><p className="text-xs text-slate-400">No hay posiciones arancelarias registradas.</p></div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3">Codigo</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3">Descripcion</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2">DI%</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2">Est%</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2">IVA%</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2">IVA Ad%</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2">Gan%</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2">IIBB%</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map(p => (
                  <tr key={p.id} className={!p.activo ? 'opacity-50' : ''}>
                    {editingId === p.id ? (
                      <EditRow form={editForm} setForm={setEditForm} onSave={() => handleUpdate(p.id)} onCancel={() => setEditingId(null)} numInput={numInput} />
                    ) : (
                      <ViewRow p={p} onEdit={() => startEdit(p)} onToggle={() => handleToggle(p)} onDelete={() => handleDelete(p)} />
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ViewRow: React.FC<{
  p: PosicionArancelaria;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ p, onEdit, onToggle, onDelete }) => (
  <>
    <td className="text-xs py-2 px-3 font-medium text-slate-900 font-mono">{p.codigo}</td>
    <td className="text-xs py-2 px-3 text-slate-700 max-w-[200px] truncate">{p.descripcion}</td>
    <td className="text-xs py-2 px-2 text-right tabular-nums">{fmtNum(p.tratamiento?.derechoImportacion)}</td>
    <td className="text-xs py-2 px-2 text-right tabular-nums">{fmtNum(p.tratamiento?.estadistica)}</td>
    <td className="text-xs py-2 px-2 text-right tabular-nums">{fmtNum(p.tratamiento?.iva)}</td>
    <td className="text-xs py-2 px-2 text-right tabular-nums">{fmtNum(p.tratamiento?.ivaAdicional)}</td>
    <td className="text-xs py-2 px-2 text-right tabular-nums">{fmtNum(p.tratamiento?.ganancias)}</td>
    <td className="text-xs py-2 px-2 text-right tabular-nums">{fmtNum(p.tratamiento?.ingresosBrutos)}</td>
    <td className="text-xs py-2 px-3 text-right">
      <div className="flex justify-end gap-2">
        <button onClick={onEdit} className="text-teal-600 hover:underline font-medium text-[11px]">Editar</button>
        <button onClick={onToggle} className={`font-medium text-[11px] ${p.activo ? 'text-amber-600' : 'text-green-600'} hover:underline`}>
          {p.activo ? 'Desactivar' : 'Activar'}
        </button>
        <button onClick={onDelete} className="text-red-600 hover:underline font-medium text-[11px]">Eliminar</button>
      </div>
    </td>
  </>
);

const EditRow: React.FC<{
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void;
  onCancel: () => void;
  numInput: (val: string, key: keyof FormState, setter: React.Dispatch<React.SetStateAction<FormState>>) => React.ReactNode;
}> = ({ form, setForm, onSave, onCancel, numInput }) => (
  <>
    <td className="py-1.5 px-3">
      <input type="text" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: formatCodigoSIM(e.target.value) }))}
        className="border border-slate-300 rounded px-2 py-1 text-xs w-36 font-mono" autoFocus />
    </td>
    <td className="py-1.5 px-3">
      <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
        className="border border-slate-300 rounded px-2 py-1 text-xs w-full" />
    </td>
    <td className="py-1.5 px-2">{numInput(form.derechoImportacion, 'derechoImportacion', setForm)}</td>
    <td className="py-1.5 px-2">{numInput(form.estadistica, 'estadistica', setForm)}</td>
    <td className="py-1.5 px-2">{numInput(form.iva, 'iva', setForm)}</td>
    <td className="py-1.5 px-2">{numInput(form.ivaAdicional, 'ivaAdicional', setForm)}</td>
    <td className="py-1.5 px-2">{numInput(form.ganancias, 'ganancias', setForm)}</td>
    <td className="py-1.5 px-2">{numInput(form.ingresosBrutos, 'ingresosBrutos', setForm)}</td>
    <td className="py-1.5 px-3 text-right">
      <div className="flex justify-end gap-2">
        <button onClick={onSave} className="text-green-600 hover:underline font-medium text-[11px]">Guardar</button>
        <button onClick={onCancel} className="text-slate-500 hover:underline text-[11px]">Cancelar</button>
      </div>
    </td>
  </>
);
