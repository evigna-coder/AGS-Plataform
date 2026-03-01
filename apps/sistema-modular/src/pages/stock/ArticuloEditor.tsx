import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { articulosService, marcasService, proveedoresService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import type { Articulo, Marca, Proveedor, CategoriaEquipoStock, TipoArticulo, TratamientoArancelario } from '@ags/shared';

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

/** Formatea posición arancelaria: 9027.90.90.900A (puntos fijos, solo se tipean dígitos/letras) */
const formatPosicionArancelaria = (raw: string): string => {
  // Quitar todo excepto dígitos y letras
  const clean = raw.replace(/[^0-9a-zA-Z]/g, '');
  const parts: string[] = [];
  if (clean.length > 0) parts.push(clean.slice(0, 4));
  if (clean.length > 4) parts.push(clean.slice(4, 6));
  if (clean.length > 6) parts.push(clean.slice(6, 8));
  if (clean.length > 8) parts.push(clean.slice(8, 14));
  return parts.join('.');
};

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const ArticuloEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [codigoDupWarning, setCodigoDupWarning] = useState('');

  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaEquipo, setCategoriaEquipo] = useState<CategoriaEquipoStock>('GENERAL');
  const [marcaId, setMarcaId] = useState('');
  const [tipo, setTipo] = useState<TipoArticulo>('repuesto');
  const [unidadMedida, setUnidadMedida] = useState('unidad');
  const [stockMinimo, setStockMinimo] = useState(0);
  const [precioReferencia, setPrecioReferencia] = useState<number | null>(null);
  const [monedaPrecio, setMonedaPrecio] = useState<'ARS' | 'USD'>('USD');
  const [proveedorIds, setProveedorIds] = useState<string[]>([]);
  const [posicionArancelaria, setPosicionArancelaria] = useState('');
  const [tratamiento, setTratamiento] = useState<TratamientoArancelario>({});
  const [notas, setNotas] = useState('');
  const [arancelOpen, setArancelOpen] = useState(false);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  useEffect(() => { marcasService.getAll().then(setMarcas); proveedoresService.getAll().then(setProveedores); }, []);
  const marcaOptions = marcas.map(m => ({ value: m.id, label: m.nombre }));

  useEffect(() => {
    if (!isNew && id) {
      articulosService.getById(id).then(art => {
        if (!art) { navigate('/stock/articulos'); return; }
        setCodigo(art.codigo); setDescripcion(art.descripcion);
        setCategoriaEquipo(art.categoriaEquipo); setMarcaId(art.marcaId);
        setTipo(art.tipo); setUnidadMedida(art.unidadMedida);
        setStockMinimo(art.stockMinimo); setPrecioReferencia(art.precioReferencia ?? null);
        setMonedaPrecio(art.monedaPrecio ?? 'USD'); setProveedorIds(art.proveedorIds ?? []);
        setPosicionArancelaria(art.posicionArancelaria ?? '');
        setTratamiento(art.tratamientoArancelario ?? {}); setNotas(art.notas ?? '');
        if (art.posicionArancelaria) setArancelOpen(true);
        setLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    if (!codigo.trim()) { setCodigoDupWarning(''); return; }
    const timer = setTimeout(async () => {
      const existing = await articulosService.getByCodigo(codigo.trim());
      setCodigoDupWarning(existing && existing.id !== id
        ? `Ya existe un articulo con codigo "${codigo}" (${existing.descripcion})` : '');
    }, 500);
    return () => clearTimeout(timer);
  }, [codigo, id]);

  const toggleProveedor = (pid: string) =>
    setProveedorIds(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);

  const updateTratamiento = (key: keyof TratamientoArancelario, val: string) =>
    setTratamiento(prev => ({ ...prev, [key]: val ? Number(val) : null }));

  const handleSave = async () => {
    if (!codigo.trim()) { alert('El codigo es obligatorio'); return; }
    if (!descripcion.trim()) { alert('La descripcion es obligatoria'); return; }
    setSaving(true);
    try {
      const data: Omit<Articulo, 'id' | 'createdAt' | 'updatedAt'> = {
        codigo: codigo.trim(), descripcion: descripcion.trim(), categoriaEquipo, marcaId, tipo,
        unidadMedida, stockMinimo, precioReferencia: precioReferencia ?? null,
        monedaPrecio: precioReferencia && precioReferencia > 0 ? monedaPrecio : null,
        proveedorIds, posicionArancelaria: posicionArancelaria.trim() || null,
        tratamientoArancelario: posicionArancelaria.trim() ? tratamiento : null,
        notas: notas.trim() || null, activo: true,
      };
      if (isNew) {
        const newId = await articulosService.create(data);
        navigate(`/stock/articulos/${newId}`);
      } else {
        await articulosService.update(id!, data);
        navigate(`/stock/articulos/${id}`);
      }
    } catch (err) { alert('Error al guardar el articulo'); console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <div className="shrink-0 px-6 pt-6 pb-4 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              {isNew ? 'Nuevo articulo' : `Editar: ${codigo}`}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{isNew ? 'Complete los datos y guarde' : `ID: ${id}`}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/stock/articulos')}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Informacion general</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input label="Codigo" value={codigo} onChange={e => setCodigo(e.target.value)} required />
              {codigoDupWarning && <p className="mt-1 text-xs text-amber-600">{codigoDupWarning}</p>}
            </div>
            <Input label="Descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} required />
            <SelectField label="Categoria equipo" value={categoriaEquipo}
              onChange={v => setCategoriaEquipo(v as CategoriaEquipoStock)}
              options={CATEGORIA_OPTIONS.map(c => ({ value: c, label: c }))} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
              <SearchableSelect value={marcaId} onChange={setMarcaId} options={marcaOptions} placeholder="Seleccionar marca..." />
            </div>
            <SelectField label="Tipo" value={tipo} onChange={v => setTipo(v as TipoArticulo)}
              options={TIPO_OPTIONS.map(t => ({ value: t, label: t }))} />
            <SelectField label="Unidad de medida" value={unidadMedida} onChange={setUnidadMedida}
              options={UNIDAD_OPTIONS.map(u => ({ value: u, label: u }))} />
            <Input label="Stock minimo" type="number" value={String(stockMinimo)}
              onChange={e => setStockMinimo(Number(e.target.value) || 0)} />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Precio y proveedores</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input label="Precio referencia" type="number" value={precioReferencia != null ? String(precioReferencia) : ''}
              onChange={e => setPrecioReferencia(e.target.value ? Number(e.target.value) : null)} />
            {(precioReferencia ?? 0) > 0 && (
              <SelectField label="Moneda" value={monedaPrecio} onChange={v => setMonedaPrecio(v as 'ARS' | 'USD')}
                options={[{ value: 'USD', label: 'USD' }, { value: 'ARS', label: 'ARS' }]} />
            )}
          </div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Proveedores</label>
          {proveedores.length === 0
            ? <p className="text-sm text-slate-400 italic">No hay proveedores cargados</p>
            : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {proveedores.map(prov => (
                  <label key={prov.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    proveedorIds.includes(prov.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input type="checkbox" checked={proveedorIds.includes(prov.id)}
                      onChange={() => toggleProveedor(prov.id)} className="w-4 h-4 accent-indigo-600" />
                    {prov.nombre}
                  </label>
                ))}
              </div>
          }
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Comercio exterior</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Posicion arancelaria</label>
              <input
                type="text"
                value={posicionArancelaria}
                onChange={e => {
                  const formatted = formatPosicionArancelaria(e.target.value);
                  setPosicionArancelaria(formatted);
                  if (formatted) setArancelOpen(true);
                }}
                placeholder="9027.90.90.900A"
                maxLength={17}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tracking-wider"
              />
            </div>
          </div>
          {posicionArancelaria.trim() && (
            <div className="mt-4">
              <button type="button" onClick={() => setArancelOpen(!arancelOpen)}
                className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors">
                <svg className={`w-4 h-4 transition-transform ${arancelOpen ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Tratamiento arancelario
              </button>
              {arancelOpen && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
                  {ARANCEL_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{label} (%)</label>
                      <input type="number" step="0.01" value={tratamiento[key] != null ? String(tratamiento[key]) : ''}
                        onChange={e => updateTratamiento(key, e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
              placeholder="Notas internas sobre este articulo..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y" />
          </div>
        </Card>
      </div>
    </div>
  );
};
