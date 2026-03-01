import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { articulosService, unidadesService, marcasService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { AddUnitForm } from './AddUnitForm';
import type { Articulo, UnidadStock, Marca, CondicionUnidad } from '@ags/shared';
import type { UnitFormData } from './AddUnitForm';

const CONDICION_COLORS: Record<CondicionUnidad, string> = {
  nuevo: 'bg-green-100 text-green-700', bien_de_uso: 'bg-blue-100 text-blue-700',
  reacondicionado: 'bg-amber-100 text-amber-700', vendible: 'bg-indigo-100 text-indigo-700', scrap: 'bg-red-100 text-red-700',
};
const CONDICION_LABELS: Record<CondicionUnidad, string> = {
  nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap',
};
const ESTADO_COLORS: Record<string, string> = {
  disponible: 'bg-green-100 text-green-700', reservado: 'bg-amber-100 text-amber-700',
  asignado: 'bg-blue-100 text-blue-700', en_transito: 'bg-purple-100 text-purple-700',
  consumido: 'bg-slate-100 text-slate-500', vendido: 'bg-slate-100 text-slate-500', baja: 'bg-red-100 text-red-700',
};
const TIPO_UBICACION_LABELS: Record<string, string> = {
  posicion: 'Posicion', minikit: 'Minikit', ingeniero: 'Ingeniero', cliente: 'Cliente', proveedor: 'Proveedor', transito: 'En transito',
};

const LV = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '--'}</p>
  </div>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${color}`}>{label}</span>
);

export const ArticuloDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [marca, setMarca] = useState<Marca | null>(null);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [art, units] = await Promise.all([articulosService.getById(id), unidadesService.getByArticulo(id)]);
      setArticulo(art);
      setUnidades(units);
      if (art?.marcaId) {
        const allMarcas = await marcasService.getAll();
        setMarca(allMarcas.find(m => m.id === art.marcaId) ?? null);
      }
    } catch (e) { console.error('Error loading articulo:', e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form: UnitFormData, refOptions: { id: string; label: string }[]) => {
    if (!articulo || !id) return;
    setSaving(true);
    try {
      const selRef = refOptions.find(r => r.id === form.ubicacionRefId);
      await unidadesService.create({
        articuloId: id, articuloCodigo: articulo.codigo, articuloDescripcion: articulo.descripcion,
        nroSerie: form.nroSerie || null, nroLote: form.nroLote || null,
        condicion: form.condicion, estado: form.estado,
        ubicacion: { tipo: form.ubicacionTipo, referenciaId: form.ubicacionRefId, referenciaNombre: selRef?.label ?? form.ubicacionRefNombre },
        costoUnitario: form.costoUnitario ? Number(form.costoUnitario) : null,
        monedaCosto: form.costoUnitario ? form.monedaCosto : null,
        observaciones: form.observaciones || null, activo: true,
      });
      setShowForm(false);
      await load();
    } catch (e) { console.error('Error creating unit:', e); alert('Error al crear unidad'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando articulo...</p></div>;
  if (!articulo) return <div className="text-center py-12"><p className="text-slate-400">Articulo no encontrado</p><Link to="/stock" className="text-indigo-600 hover:underline mt-2 inline-block">Volver</Link></div>;

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">{articulo.codigo} - {articulo.descripcion}</h2>
              <p className="text-xs text-slate-400">{articulo.tipo}{marca ? ` / ${marca.nombre}` : ''}{!articulo.activo ? ' — Inactivo' : ''}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/stock/articulos/${id}/editar`}><Button variant="outline" size="sm">Editar</Button></Link>
            <Link to="/stock"><Button variant="ghost" size="sm">Volver</Button></Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <div className="w-72 shrink-0 space-y-4">
            <Card compact>
              <div className="space-y-2.5">
                <LV label="Codigo" value={<span className="font-mono">{articulo.codigo}</span>} />
                <LV label="Descripcion" value={articulo.descripcion} />
                <LV label="Categoria equipo" value={articulo.categoriaEquipo} />
                <LV label="Marca" value={marca?.nombre} />
                <LV label="Tipo" value={articulo.tipo} />
                <LV label="Unidad de medida" value={articulo.unidadMedida} />
                <LV label="Stock minimo" value={String(articulo.stockMinimo)} />
              </div>
            </Card>
            <Card compact title="Precio">
              <div className="space-y-2.5">
                <LV label="Precio referencia" value={articulo.precioReferencia != null ? `${articulo.monedaPrecio ?? ''} ${articulo.precioReferencia}` : null} />
                <LV label="Moneda" value={articulo.monedaPrecio} />
              </div>
            </Card>
            {(articulo.posicionArancelaria || articulo.proveedorIds?.length || articulo.notas) && (
              <Card compact title="Otros">
                <div className="space-y-2.5">
                  {articulo.posicionArancelaria && <LV label="Posicion arancelaria" value={articulo.posicionArancelaria} />}
                  {articulo.proveedorIds?.length ? <LV label="Proveedores" value={articulo.proveedorIds.join(', ')} /> : null}
                  {articulo.notas && <LV label="Notas" value={articulo.notas} />}
                </div>
              </Card>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <Card compact title={`Unidades en stock (${unidades.length})`} actions={!showForm && <Button size="sm" onClick={() => setShowForm(true)}>+ Nueva unidad</Button>}>
              {showForm && <div className="mb-3"><AddUnitForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} saving={saving} /></div>}
              {unidades.length === 0 && !showForm ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay unidades registradas para este articulo.</p>
              ) : (
                <div className="space-y-1.5">
                  {unidades.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {u.nroSerie && <span className="text-xs font-mono text-slate-800">S/N: {u.nroSerie}</span>}
                        {u.nroLote && <span className="text-xs font-mono text-slate-600">Lote: {u.nroLote}</span>}
                        <Badge label={CONDICION_LABELS[u.condicion]} color={CONDICION_COLORS[u.condicion]} />
                        <Badge label={u.estado.replace('_', ' ')} color={ESTADO_COLORS[u.estado] ?? 'bg-slate-100 text-slate-600'} />
                        <span className="text-[11px] text-slate-500">{TIPO_UBICACION_LABELS[u.ubicacion.tipo]}: {u.ubicacion.referenciaNombre}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
