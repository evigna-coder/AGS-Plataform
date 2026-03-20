import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { articulosService, marcasService, proveedoresService } from '../../services/firebaseService';
import type { Marca, Proveedor, CategoriaEquipoStock, TipoArticulo, TratamientoArancelario } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIA_OPTIONS: CategoriaEquipoStock[] = ['HPLC', 'GC', 'MSD', 'UV', 'OSMOMETRO', 'GENERAL'];
const TIPO_OPTIONS: TipoArticulo[] = ['repuesto', 'consumible', 'equipo', 'columna', 'accesorio', 'muestra', 'otro'];
const UNIDAD_OPTIONS = ['unidad', 'metro', 'litro', 'ml', 'kg', 'g'];
const ARANCEL_FIELDS: { key: keyof TratamientoArancelario; label: string }[] = [
  { key: 'derechoImportacion', label: 'Derecho importacion' },
  { key: 'estadistica', label: 'Estadistica' },
  { key: 'iva', label: 'IVA' },
  { key: 'ivaAdicional', label: 'IVA adicional' },
  { key: 'ganancias', label: 'Ganancias' },
  { key: 'ingresosBrutos', label: 'Ingresos brutos' },
];

const formatPosicionArancelaria = (raw: string): string => {
  const clean = raw.replace(/[^0-9a-zA-Z]/g, '');
  const parts: string[] = [];
  if (clean.length > 0) parts.push(clean.slice(0, 4));
  if (clean.length > 4) parts.push(clean.slice(4, 6));
  if (clean.length > 6) parts.push(clean.slice(6, 8));
  if (clean.length > 8) parts.push(clean.slice(8, 14));
  return parts.join('.');
};

const emptyForm = {
  codigo: '', descripcion: '', categoriaEquipo: 'GENERAL' as CategoriaEquipoStock,
  marcaId: '', tipo: 'repuesto' as TipoArticulo, unidadMedida: 'unidad',
  stockMinimo: 0, precioReferencia: null as number | null, monedaPrecio: 'USD' as 'ARS' | 'USD',
  proveedorIds: [] as string[], posicionArancelaria: '', tratamiento: {} as TratamientoArancelario,
  notas: '',
};

export const CreateArticuloModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
    if (!form.codigo.trim()) { setCodigoDupWarning(''); return; }
    const timer = setTimeout(async () => {
      const existing = await articulosService.getByCodigo(form.codigo.trim());
      setCodigoDupWarning(existing ? `Ya existe un articulo con codigo "${form.codigo}"` : '');
    }, 500);
    return () => clearTimeout(timer);
  }, [form.codigo]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleProveedor = (pid: string) =>
    setForm(prev => ({
      ...prev,
      proveedorIds: prev.proveedorIds.includes(pid)
        ? prev.proveedorIds.filter(p => p !== pid)
        : [...prev.proveedorIds, pid],
    }));
  const updateTratamiento = (key: keyof TratamientoArancelario, val: string) =>
    setForm(prev => ({
      ...prev,
      tratamiento: { ...prev.tratamiento, [key]: val ? Number(val) : null },
    }));

  const handleClose = () => { onClose(); setForm(emptyForm); setCodigoDupWarning(''); setComexOpen(false); };

  const handleSave = async () => {
    if (!form.codigo.trim()) { alert('El codigo es obligatorio'); return; }
    if (!form.descripcion.trim()) { alert('La descripcion es obligatoria'); return; }
    if (codigoDupWarning) { alert(codigoDupWarning); return; }
    setSaving(true);
    try {
      const data = {
        codigo: form.codigo.trim(), descripcion: form.descripcion.trim(),
        categoriaEquipo: form.categoriaEquipo, marcaId: form.marcaId, tipo: form.tipo,
        unidadMedida: form.unidadMedida, stockMinimo: form.stockMinimo,
        precioReferencia: form.precioReferencia ?? null,
        monedaPrecio: form.precioReferencia && form.precioReferencia > 0 ? form.monedaPrecio : null,
        proveedorIds: form.proveedorIds,
        posicionArancelaria: form.posicionArancelaria.trim() || null,
        tratamientoArancelario: form.posicionArancelaria.trim() ? form.tratamiento : null,
        notas: form.notas.trim() || null, activo: true,
      };
      const newId = await articulosService.create(data);
      handleClose();
      onCreated();
      navigate(`/stock/articulos/${newId}`);
    } catch { alert('Error al crear el articulo'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo articulo" maxWidth="lg"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !!codigoDupWarning}>
          {saving ? 'Guardando...' : 'Guardar articulo'}
        </Button>
      </>}>
      <div className="space-y-5">
        {/* Informacion general */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-3">Informacion general</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input inputSize="sm" label="Codigo *" value={form.codigo} onChange={e => set('codigo', e.target.value)} />
              {codigoDupWarning && <p className="mt-0.5 text-[10px] text-amber-600">{codigoDupWarning}</p>}
            </div>
            <Input inputSize="sm" label="Descripcion *" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            <div>
              <label className={lbl}>Categoria equipo</label>
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
              <label className={lbl}>Unidad medida</label>
              <select value={form.unidadMedida} onChange={e => set('unidadMedida', e.target.value)} className={selectCls}>
                {UNIDAD_OPTIONS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
              </select>
            </div>
            <Input inputSize="sm" label="Stock minimo" type="number" value={String(form.stockMinimo)}
              onChange={e => set('stockMinimo', Number(e.target.value) || 0)} />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Precio y proveedores */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-3">Precio y proveedores</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input inputSize="sm" label="Precio referencia" type="number"
              value={form.precioReferencia != null ? String(form.precioReferencia) : ''}
              onChange={e => set('precioReferencia', e.target.value ? Number(e.target.value) : null)} />
            {(form.precioReferencia ?? 0) > 0 && (
              <div>
                <label className={lbl}>Moneda</label>
                <select value={form.monedaPrecio} onChange={e => set('monedaPrecio', e.target.value)} className={selectCls}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
            )}
          </div>
          {proveedores.length > 0 && (
            <>
              <label className={lbl}>Proveedores</label>
              <div className="flex flex-wrap gap-2">
                {proveedores.map(prov => (
                  <label key={prov.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                    form.proveedorIds.includes(prov.id)
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input type="checkbox" checked={form.proveedorIds.includes(prov.id)}
                      onChange={() => toggleProveedor(prov.id)} className="w-3 h-3 accent-indigo-600" />
                    {prov.nombre}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Comercio exterior - collapsible */}
        <div>
          <button type="button" onClick={() => setComexOpen(!comexOpen)}
            className="flex items-center gap-2 w-full text-left">
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${comexOpen ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-semibold text-slate-700">Comercio exterior</span>
            <span className="text-[11px] text-slate-400">Posicion arancelaria, tratamiento tributario</span>
          </button>
          {comexOpen && (
            <div className="mt-3 space-y-3">
              <div className="max-w-xs">
                <label className={lbl}>Posicion arancelaria</label>
                <input type="text" value={form.posicionArancelaria}
                  onChange={e => set('posicionArancelaria', formatPosicionArancelaria(e.target.value))}
                  placeholder="9027.90.90.900A" maxLength={17}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {form.posicionArancelaria.trim() && (
                <div className="grid grid-cols-3 gap-3">
                  {ARANCEL_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <label className={lbl}>{label} (%)</label>
                      <input type="number" step="0.01"
                        value={form.tratamiento[key] != null ? String(form.tratamiento[key]) : ''}
                        onChange={e => updateTratamiento(key, e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Notas */}
        <div>
          <label className={lbl}>Notas</label>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
            placeholder="Notas internas sobre este articulo..."
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
    </Modal>
  );
};
