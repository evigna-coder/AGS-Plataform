import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { articulosService, marcasService, proveedoresService } from '../../services/firebaseService';
import type { Articulo, Marca, Proveedor, CategoriaEquipoStock, TipoArticulo, TratamientoArancelario } from '@ags/shared';

interface Props {
  open: boolean;
  articuloId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIA_OPTIONS: CategoriaEquipoStock[] = ['HPLC', 'GC', 'MSD', 'UV', 'OSMOMETRO', 'GENERAL'];
const TIPO_OPTIONS: TipoArticulo[] = ['repuesto', 'consumible', 'equipo', 'columna', 'accesorio', 'muestra', 'otro'];
const UNIDAD_OPTIONS = ['unidad', 'metro', 'litro', 'ml', 'kg', 'g'];
const ARANCEL_FIELDS: { key: keyof TratamientoArancelario; label: string }[] = [
  { key: 'derechoImportacion', label: 'Der. imp.' },
  { key: 'estadistica', label: 'Estadistica' },
  { key: 'iva', label: 'IVA' },
  { key: 'ivaAdicional', label: 'IVA adic.' },
  { key: 'ganancias', label: 'Ganancias' },
  { key: 'ingresosBrutos', label: 'IIBB' },
];

const formatPA = (raw: string): string => {
  const c = raw.replace(/[^0-9a-zA-Z]/g, '');
  const p: string[] = [];
  if (c.length > 0) p.push(c.slice(0, 4));
  if (c.length > 4) p.push(c.slice(4, 6));
  if (c.length > 6) p.push(c.slice(6, 8));
  if (c.length > 8) p.push(c.slice(8, 14));
  return p.join('.');
};

interface FormState {
  codigo: string; descripcion: string; categoriaEquipo: CategoriaEquipoStock;
  marcaId: string; tipo: TipoArticulo; unidadMedida: string; stockMinimo: number;
  precioReferencia: number | null; monedaPrecio: 'ARS' | 'USD'; proveedorIds: string[];
  posicionArancelaria: string; tratamiento: TratamientoArancelario; notas: string; origen: string;
}

const EMPTY: FormState = {
  codigo: '', descripcion: '', categoriaEquipo: 'GENERAL', marcaId: '', tipo: 'repuesto',
  unidadMedida: 'unidad', stockMinimo: 0, precioReferencia: null, monedaPrecio: 'USD',
  proveedorIds: [], posicionArancelaria: '', tratamiento: {}, notas: '', origen: '',
};

export const EditArticuloModal: React.FC<Props> = ({ open, articuloId, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [codigoDupWarning, setCodigoDupWarning] = useState('');
  const [comexOpen, setComexOpen] = useState(false);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  useEffect(() => {
    if (!open) return;
    marcasService.getAll().then(setMarcas);
    proveedoresService.getAll().then(setProveedores);
  }, [open]);

  useEffect(() => {
    if (!open || !articuloId) { setForm(EMPTY); return; }
    setLoading(true);
    articulosService.getById(articuloId).then(art => {
      if (!art) { onClose(); return; }
      setForm({
        codigo: art.codigo, descripcion: art.descripcion, categoriaEquipo: art.categoriaEquipo,
        marcaId: art.marcaId, tipo: art.tipo, unidadMedida: art.unidadMedida,
        stockMinimo: art.stockMinimo, precioReferencia: art.precioReferencia ?? null,
        monedaPrecio: art.monedaPrecio ?? 'USD', proveedorIds: art.proveedorIds ?? [],
        posicionArancelaria: art.posicionArancelaria ?? '',
        tratamiento: art.tratamientoArancelario ?? {}, notas: art.notas ?? '',
        origen: (art as any).origen ?? '',
      });
      if (art.posicionArancelaria) setComexOpen(true);
      setLoading(false);
    });
  }, [open, articuloId]);

  useEffect(() => {
    if (!form.codigo.trim()) { setCodigoDupWarning(''); return; }
    const timer = setTimeout(async () => {
      const existing = await articulosService.getByCodigo(form.codigo.trim());
      setCodigoDupWarning(existing && existing.id !== articuloId
        ? `Ya existe un articulo con codigo "${form.codigo}"` : '');
    }, 500);
    return () => clearTimeout(timer);
  }, [form.codigo, articuloId]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleProveedor = (pid: string) =>
    setForm(prev => ({
      ...prev,
      proveedorIds: prev.proveedorIds.includes(pid)
        ? prev.proveedorIds.filter(p => p !== pid)
        : [...prev.proveedorIds, pid],
    }));
  const updateTratamiento = (key: keyof TratamientoArancelario, val: string) =>
    setForm(prev => ({ ...prev, tratamiento: { ...prev.tratamiento, [key]: val ? Number(val) : null } }));

  const handleClose = () => { onClose(); setForm(EMPTY); setCodigoDupWarning(''); setComexOpen(false); };

  const handleSave = async () => {
    if (!form.codigo.trim()) { alert('El codigo es obligatorio'); return; }
    if (!form.descripcion.trim()) { alert('La descripcion es obligatoria'); return; }
    if (codigoDupWarning) { alert(codigoDupWarning); return; }
    if (!articuloId) return;
    setSaving(true);
    try {
      await articulosService.update(articuloId, {
        codigo: form.codigo.trim(), descripcion: form.descripcion.trim(),
        categoriaEquipo: form.categoriaEquipo, marcaId: form.marcaId, tipo: form.tipo,
        unidadMedida: form.unidadMedida, stockMinimo: form.stockMinimo,
        precioReferencia: form.precioReferencia ?? null,
        monedaPrecio: form.precioReferencia && form.precioReferencia > 0 ? form.monedaPrecio : null,
        proveedorIds: form.proveedorIds,
        posicionArancelaria: form.posicionArancelaria.trim() || null,
        tratamientoArancelario: form.posicionArancelaria.trim() ? form.tratamiento : null,
        notas: form.notas.trim() || null, activo: true,
        origen: form.origen.trim() || null,
      });
      handleClose();
      onSaved();
    } catch { alert('Error al guardar el articulo'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";
  const selectCls = "w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700";
  const inputCls = "w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700";
  const section = "text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest";

  if (loading) return <Modal open={open} onClose={handleClose} title="Editar articulo"><p className="text-slate-400 text-xs py-8 text-center">Cargando...</p></Modal>;

  return (
    <Modal open={open} onClose={handleClose} title="Editar articulo"
      subtitle={form.codigo ? `${form.codigo} — ${form.descripcion.slice(0, 50)}` : undefined}
      maxWidth="lg"
      footer={<>
        <Button variant="secondary" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !!codigoDupWarning}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </>}>
      <div className="space-y-3">
        <p className={section}>Informacion general</p>
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <div>
            <label className={lbl}>Código *</label>
            <input value={form.codigo} onChange={e => set('codigo', e.target.value)} className={inputCls} />
            {codigoDupWarning && <p className="mt-0.5 text-[10px] text-amber-600">{codigoDupWarning}</p>}
          </div>
          <div>
            <label className={lbl}>Descripcion *</label>
            <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          <div>
            <label className={lbl}>Categoria</label>
            <select value={form.categoriaEquipo} onChange={e => set('categoriaEquipo', e.target.value)} className={selectCls}>
              {CATEGORIA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Marca</label>
            <SearchableSelect value={form.marcaId} onChange={v => set('marcaId', v)}
              options={marcas.map(m => ({ value: m.id, label: m.nombre }))} placeholder="Seleccionar..." />
          </div>
          <div>
            <label className={lbl}>Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={selectCls}>
              {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Unidad</label>
            <select value={form.unidadMedida} onChange={e => set('unidadMedida', e.target.value)} className={selectCls}>
              {UNIDAD_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          <div>
            <label className={lbl}>Stock min.</label>
            <input type="number" value={form.stockMinimo} onChange={e => set('stockMinimo', Number(e.target.value) || 0)} className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Precio ref.</label>
            <input type="number" step="0.01" value={form.precioReferencia != null ? form.precioReferencia : ''} onChange={e => set('precioReferencia', e.target.value ? Number(e.target.value) : null)} className={inputCls} />
          </div>
          {(form.precioReferencia ?? 0) > 0 && (
            <div>
              <label className={lbl}>Moneda</label>
              <select value={form.monedaPrecio} onChange={e => set('monedaPrecio', e.target.value)} className={selectCls}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          )}
          <div>
            <label className={lbl}>Origen</label>
            <input value={form.origen} onChange={e => set('origen', e.target.value)} className={inputCls} placeholder="Nacional, Importado..." />
          </div>
        </div>

        {/* Proveedores */}
        {proveedores.length > 0 && (
          <>
            <hr className="border-[#E5E5E5]" />
            <p className={section}>Proveedores</p>
            <div className="flex flex-wrap gap-1.5">
              {proveedores.map(prov => (
                <label key={prov.id} className={`flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer transition-colors text-[11px] ${
                  form.proveedorIds.includes(prov.id)
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-white border-[#E5E5E5] text-slate-500 hover:bg-slate-50'
                }`}>
                  <input type="checkbox" checked={form.proveedorIds.includes(prov.id)}
                    onChange={() => toggleProveedor(prov.id)} className="w-3 h-3 accent-teal-700" />
                  {prov.nombre}
                </label>
              ))}
            </div>
          </>
        )}

        {/* Comercio exterior - collapsible */}
        <hr className="border-[#E5E5E5]" />
        <button type="button" onClick={() => setComexOpen(!comexOpen)}
          className="flex items-center gap-1.5 w-full text-left">
          <svg className={`w-3 h-3 text-slate-400 transition-transform ${comexOpen ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={section}>Comercio exterior</span>
          {form.posicionArancelaria && <span className="text-[10px] text-slate-400 font-mono ml-2">{form.posicionArancelaria}</span>}
        </button>
        {comexOpen && (
          <div className="space-y-2.5 pl-4">
            <div className="max-w-[200px]">
              <label className={lbl}>Pos. arancelaria</label>
              <input type="text" value={form.posicionArancelaria}
                onChange={e => set('posicionArancelaria', formatPA(e.target.value))}
                placeholder="9027.90.90.900A" maxLength={17}
                className={`${inputCls} font-mono tracking-wider`} />
            </div>
            {form.posicionArancelaria.trim() && (
              <div className="grid grid-cols-3 gap-2">
                {ARANCEL_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className={lbl}>{label} %</label>
                    <input type="number" step="0.01"
                      value={form.tratamiento[key] != null ? String(form.tratamiento[key]) : ''}
                      onChange={e => updateTratamiento(key, e.target.value)} className={inputCls} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notas */}
        <hr className="border-[#E5E5E5]" />
        <div>
          <label className={lbl}>Notas</label>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
            placeholder="Notas internas..."
            className={`${inputCls} resize-y`} />
        </div>
      </div>
    </Modal>
  );
};
