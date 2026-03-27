import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useEditArticuloForm, formatPA } from '../../hooks/useEditArticuloForm';
import type { CategoriaEquipoStock, TipoArticulo, TratamientoArancelario } from '@ags/shared';

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

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";
const selectCls = "w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700";
const inputCls = "w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700";
const section = "text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest";

export const EditArticuloModal: React.FC<Props> = ({ open, articuloId, onClose, onSaved }) => {
  const h = useEditArticuloForm(open, articuloId, onClose, onSaved);

  if (h.loading) return <Modal open={open} onClose={h.handleClose} title="Editar articulo"><p className="text-slate-400 text-xs py-8 text-center">Cargando...</p></Modal>;

  return (
    <Modal open={open} onClose={h.handleClose} title="Editar articulo"
      subtitle={h.form.codigo ? `${h.form.codigo} — ${h.form.descripcion.slice(0, 50)}` : undefined}
      maxWidth="lg"
      footer={<>
        <Button variant="secondary" size="sm" onClick={h.handleClose}>Cancelar</Button>
        <Button size="sm" onClick={h.handleSave} disabled={h.saving || !!h.codigoDupWarning}>
          {h.saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </>}>
      <div className="space-y-3">
        <p className={section}>Informacion general</p>
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <div>
            <label className={lbl}>Código *</label>
            <input value={h.form.codigo} onChange={e => h.set('codigo', e.target.value)} className={inputCls} />
            {h.codigoDupWarning && <p className="mt-0.5 text-[10px] text-amber-600">{h.codigoDupWarning}</p>}
          </div>
          <div>
            <label className={lbl}>Descripcion *</label>
            <input value={h.form.descripcion} onChange={e => h.set('descripcion', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          <div>
            <label className={lbl}>Categoria</label>
            <select value={h.form.categoriaEquipo} onChange={e => h.set('categoriaEquipo', e.target.value)} className={selectCls}>
              {CATEGORIA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Marca</label>
            <SearchableSelect value={h.form.marcaId} onChange={v => h.set('marcaId', v)}
              options={h.marcas.map(m => ({ value: m.id, label: m.nombre }))} placeholder="Seleccionar..." />
          </div>
          <div>
            <label className={lbl}>Tipo</label>
            <select value={h.form.tipo} onChange={e => h.set('tipo', e.target.value)} className={selectCls}>
              {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Unidad</label>
            <select value={h.form.unidadMedida} onChange={e => h.set('unidadMedida', e.target.value)} className={selectCls}>
              {UNIDAD_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          <div>
            <label className={lbl}>Stock min.</label>
            <input type="number" value={h.form.stockMinimo} onChange={e => h.set('stockMinimo', Number(e.target.value) || 0)} className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Precio ref.</label>
            <input type="number" step="0.01" value={h.form.precioReferencia != null ? h.form.precioReferencia : ''} onChange={e => h.set('precioReferencia', e.target.value ? Number(e.target.value) : null)} className={inputCls} />
          </div>
          {(h.form.precioReferencia ?? 0) > 0 && (
            <div>
              <label className={lbl}>Moneda</label>
              <select value={h.form.monedaPrecio} onChange={e => h.set('monedaPrecio', e.target.value)} className={selectCls}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          )}
          <div>
            <label className={lbl}>Origen</label>
            <input value={h.form.origen} onChange={e => h.set('origen', e.target.value)} className={inputCls} placeholder="Nacional, Importado..." />
          </div>
        </div>

        {/* Proveedores */}
        {h.proveedores.length > 0 && (
          <>
            <hr className="border-[#E5E5E5]" />
            <p className={section}>Proveedores</p>
            <div className="flex flex-wrap gap-1.5">
              {h.proveedores.map(prov => (
                <label key={prov.id} className={`flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer transition-colors text-[11px] ${
                  h.form.proveedorIds.includes(prov.id)
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-white border-[#E5E5E5] text-slate-500 hover:bg-slate-50'
                }`}>
                  <input type="checkbox" checked={h.form.proveedorIds.includes(prov.id)}
                    onChange={() => h.toggleProveedor(prov.id)} className="w-3 h-3 accent-teal-700" />
                  {prov.nombre}
                </label>
              ))}
            </div>
          </>
        )}

        {/* Comercio exterior */}
        <hr className="border-[#E5E5E5]" />
        <button type="button" onClick={() => h.setComexOpen(!h.comexOpen)}
          className="flex items-center gap-1.5 w-full text-left">
          <svg className={`w-3 h-3 text-slate-400 transition-transform ${h.comexOpen ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={section}>Comercio exterior</span>
          {h.form.posicionArancelaria && <span className="text-[10px] text-slate-400 font-mono ml-2">{h.form.posicionArancelaria}</span>}
        </button>
        {h.comexOpen && (
          <div className="space-y-2.5 pl-4">
            <div className="max-w-[200px]">
              <label className={lbl}>Pos. arancelaria</label>
              <input type="text" value={h.form.posicionArancelaria}
                onChange={e => h.set('posicionArancelaria', formatPA(e.target.value))}
                placeholder="9027.90.90.900A" maxLength={17}
                className={`${inputCls} font-mono tracking-wider`} />
            </div>
            {h.form.posicionArancelaria.trim() && (
              <div className="grid grid-cols-3 gap-2">
                {ARANCEL_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className={lbl}>{label} %</label>
                    <input type="number" step="0.01"
                      value={h.form.tratamiento[key] != null ? String(h.form.tratamiento[key]) : ''}
                      onChange={e => h.updateTratamiento(key, e.target.value)} className={inputCls} />
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
          <textarea value={h.form.notas} onChange={e => h.set('notas', e.target.value)} rows={2}
            placeholder="Notas internas..."
            className={`${inputCls} resize-y`} />
        </div>
      </div>
    </Modal>
  );
};
