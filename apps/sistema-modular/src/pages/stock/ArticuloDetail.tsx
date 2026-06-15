import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { articulosService, unidadesService, marcasService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EquivalenciaDualDisplay } from '../../components/stock/EquivalenciaDualDisplay';
import { DesagregarStockModal } from '../../components/stock/DesagregarStockModal';
import { BulkAddStockModal } from '../../components/stock/BulkAddStockModal';
import type { Articulo, UnidadStock, Marca, CondicionUnidad } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useDeclareParent } from '../../hooks/useDeclareParent';

const CONDICION_COLORS: Record<CondicionUnidad, string> = {
  nuevo: 'bg-green-100 text-green-700', bien_de_uso: 'bg-blue-100 text-blue-700',
  reacondicionado: 'bg-amber-100 text-amber-700', vendible: 'bg-teal-100 text-teal-700', scrap: 'bg-red-100 text-red-700',
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
  const goBack = useNavigateBack();

  useDeclareParent('/stock/articulos');
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [marca, setMarca] = useState<Marca | null>(null);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [cargarStock, setCargarStock] = useState(false);
  const [desagregarTarget, setDesagregarTarget] = useState<Articulo | null>(null);
  const [dualRefreshKey, setDualRefreshKey] = useState(0);

  const loadUnidades = useCallback(async () => {
    if (!id) return;
    const units = await unidadesService.getByArticulo(id);
    setUnidades(units);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = articulosService.subscribeById(id, async (art) => {
      setArticulo(art);
      if (art?.marcaId) {
        const allMarcas = await marcasService.getAll();
        setMarca(allMarcas.find(m => m.id === art.marcaId) ?? null);
      } else {
        setMarca(null);
      }
      await loadUnidades();
      setLoading(false);
    }, (err) => {
      console.error('Error loading articulo:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [id, loadUnidades]);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando articulo...</p></div>;
  if (!articulo) return <div className="text-center py-12"><p className="text-slate-400">Articulo no encontrado</p><Link to="/stock" className="text-teal-600 hover:underline mt-2 inline-block">Volver</Link></div>;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
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
        <div className="mb-4">
          <EquivalenciaDualDisplay
            articulo={articulo}
            onDesagregarClick={(origen) => setDesagregarTarget(origen)}
            refreshKey={dualRefreshKey}
          />
        </div>
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
            {articulo.ultimoCostoImportacion != null && (
              <Card compact title="Costo importación">
                <div className="space-y-2.5">
                  <LV label="Último costo (USD)" value={<span className="font-mono font-semibold text-teal-700">{articulo.ultimoCostoImportacion.toFixed(2)}</span>} />
                  {articulo.ultimoFactorImportacion != null && (
                    <LV label="Factor" value={<span className="font-mono">{articulo.ultimoFactorImportacion.toFixed(3)}</span>} />
                  )}
                  {articulo.ultimoCostoFecha && (
                    <LV label="Última importación" value={new Date(articulo.ultimoCostoFecha).toLocaleDateString('es-AR')} />
                  )}
                  <p className="text-[10px] text-slate-400">Costo computable de la última importación ingresada (no recuperable + IIBB + financiero).</p>
                </div>
              </Card>
            )}
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
            <Card compact title={`Unidades en stock (${unidades.length})`} actions={<Button size="sm" onClick={() => setCargarStock(true)}>+ Cargar stock</Button>}>
              {unidades.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay unidades registradas para este articulo.</p>
              ) : (
                <div className="space-y-1.5">
                  {unidades.map(u => (
                    <div key={u.id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(u.cantidad ?? 1) > 1 && <span className="text-xs font-semibold text-teal-700">×{u.cantidad}</span>}
                        {u.nroSerie && <span className="text-xs font-mono text-slate-800">S/N: {u.nroSerie}</span>}
                        {u.nroLote && <span className="text-xs font-mono text-slate-600">Lote: {u.nroLote}</span>}
                        <Badge label={CONDICION_LABELS[u.condicion]} color={CONDICION_COLORS[u.condicion]} />
                        <Badge label={u.estado.replace('_', ' ')} color={ESTADO_COLORS[u.estado] ?? 'bg-slate-100 text-slate-600'} />
                        <span className="text-[11px] text-slate-500">{TIPO_UBICACION_LABELS[u.ubicacion.tipo]}: {u.ubicacion.referenciaNombre}</span>
                      </div>
                      {u.costoUnitario != null && (
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono text-slate-700">{u.monedaCosto ?? 'USD'} {u.costoUnitario.toFixed(2)}</p>
                          {u.factorImportacion != null && <p className="text-[10px] font-mono text-teal-600">factor {u.factorImportacion.toFixed(3)}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
      <DesagregarStockModal
        open={!!desagregarTarget}
        onClose={() => setDesagregarTarget(null)}
        articulo={desagregarTarget}
        onSuccess={() => {
          setDesagregarTarget(null);
          setDualRefreshKey(k => k + 1);
        }}
      />
      <BulkAddStockModal
        open={cargarStock}
        onClose={() => setCargarStock(false)}
        onCreated={() => { setCargarStock(false); loadUnidades(); }}
        presetArticulo={articulo}
      />
    </div>
  );
};
