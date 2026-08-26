import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { articulosService, unidadesService, marcasService } from '../../services/firebaseService';
import { EquivalenciaDualDisplay } from './EquivalenciaDualDisplay';
import { DesagregarStockModal } from './DesagregarStockModal';
import { ExplotarKitModal } from './ExplotarKitModal';
import { PresentacionesInfo } from './PresentacionesInfo';
import { PresentacionInversaInfo } from './PresentacionInversaInfo';
import { costoUnitarioVigente, factorImportacionVigente } from '@ags/shared';
import type { Articulo, UnidadStock, Marca, CondicionUnidad, EstadoUnidad } from '@ags/shared';

// Estados que cuentan como stock real (para el desglose por depósito). Los terminales
// (entregado/consumido/vendido/baja) ya salieron y no suman.
const ESTADOS_EN_STOCK: EstadoUnidad[] = ['disponible', 'reservado', 'asignado', 'en_transito'];

interface Props {
  open: boolean;
  articuloId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}

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
  posicion: 'Posicion', minikit: 'Minikit', ingeniero: 'Ingeniero', cliente: 'Cliente', proveedor: 'Proveedor', transito: 'En transito', remito: 'Remito',
};

const lbl = "text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide";

/**
 * Costo y factor de la unidad. El estimado se distingue del confirmado: tomar
 * uno por el otro termina en un precio mal puesto (2026-08-24).
 */
const CostoFactorUnidad = ({ u }: { u: UnidadStock }) => {
  const costo = costoUnitarioVigente(u);
  const factor = factorImportacionVigente(u);
  if (costo == null && factor == null) return <span className="text-slate-300">—</span>;
  const confirmado = !!u.costeoConfirmadoAt;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      {costo != null && <span className="font-mono text-slate-700 tabular-nums">{u.monedaCosto ?? 'USD'} {costo.toFixed(2)}</span>}
      {factor != null && (
        <span className={`font-mono text-[10px] tabular-nums ${confirmado ? 'text-teal-600' : 'text-amber-600'}`}
          title={confirmado
            ? `Costeo confirmado el ${u.costeoConfirmadoAt!.slice(0, 10)}`
            : 'Costeo estimado — todavía sin confirmar contra las facturas reales'}>
          factor {factor.toFixed(3)}{confirmado ? '' : ' (est.)'}
        </span>
      )}
    </span>
  );
};

export const ViewArticuloModal: React.FC<Props> = ({ open, articuloId, onClose, onEdit }) => {
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [marca, setMarca] = useState<Marca | null>(null);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [desagregarTarget, setDesagregarTarget] = useState<Articulo | null>(null);
  const [explotarKitOpen, setExplotarKitOpen] = useState(false);
  const [dualRefreshKey, setDualRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!articuloId) return;
    setLoading(true);
    try {
      const [art, units] = await Promise.all([
        articulosService.getById(articuloId),
        unidadesService.getByArticulo(articuloId),
      ]);
      setArticulo(art);
      setUnidades(units);
      if (art?.marcaId) {
        const allMarcas = await marcasService.getAll();
        setMarca(allMarcas.find(m => m.id === art.marcaId) ?? null);
      } else {
        setMarca(null);
      }
    } catch (e) { console.error('Error loading articulo:', e); }
    finally { setLoading(false); }
  }, [articuloId]);

  useEffect(() => {
    if (open && articuloId) load();
    if (!open) { setArticulo(null); setUnidades([]); setMarca(null); }
  }, [open, articuloId, load]);

  const handleEdit = () => {
    if (articuloId) { onClose(); onEdit(articuloId); }
  };

  // Unidades en stock real (excluye estados terminales: entregado/consumido/vendido/baja) + total físico.
  const unidadesEnStock = useMemo(
    () => unidades.filter(u => ESTADOS_EN_STOCK.includes(u.estado)),
    [unidades],
  );
  const totalEnStock = unidadesEnStock.reduce((s, u) => s + (u.cantidad ?? 1), 0);

  if (loading || !articulo) {
    return (
      <Modal open={open} onClose={onClose} title="Articulo">
        <p className="text-slate-400 text-xs py-8 text-center">{loading ? 'Cargando...' : 'Articulo no encontrado'}</p>
      </Modal>
    );
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title={articulo.codigo}
      subtitle={articulo.descripcion.slice(0, 60)} maxWidth="lg"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
        <Button size="sm" onClick={handleEdit}>Editar</Button>
      </>}>
      <div className="space-y-3">
        {/* Info grid */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-2">
          <div>
            <p className={lbl}>Código</p>
            <p className="text-xs font-mono font-semibold text-teal-700">{articulo.codigo}</p>
          </div>
          <div className="col-span-3">
            <p className={lbl}>Descripcion</p>
            <p className="text-xs text-slate-700">{articulo.descripcion}</p>
          </div>
          <div>
            <p className={lbl}>Categoria</p>
            <p className="text-xs text-slate-600">{articulo.categoriaEquipo}</p>
          </div>
          <div>
            <p className={lbl}>Marca</p>
            <p className="text-xs text-slate-600">{marca?.nombre || (articulo as any).marca || '—'}</p>
          </div>
          <div>
            <p className={lbl}>Tipo</p>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700">
              {articulo.tipo}
            </span>
          </div>
          <div>
            <p className={lbl}>Unidad</p>
            <p className="text-xs text-slate-600">{articulo.unidadMedida}</p>
          </div>
          <div>
            <p className={lbl}>Stock min.</p>
            <p className="text-xs text-slate-600">{articulo.stockMinimo}</p>
          </div>
          <div>
            <p className={lbl}>Precio ref.</p>
            <p className="text-xs text-slate-600">
              {articulo.precioReferencia != null
                ? `${articulo.monedaPrecio === 'USD' ? 'US$' : '$'} ${articulo.precioReferencia.toLocaleString('es-AR')}`
                : '—'}
            </p>
          </div>
          {articulo.ultimoCostoImportacion != null && (
            <div className="col-span-2">
              <p className={lbl}>Último costo de importación</p>
              <p className="text-xs text-slate-600">
                <span className="font-mono font-semibold text-teal-700">
                  {(articulo.ultimoCostoMoneda ?? 'USD')} {articulo.ultimoCostoImportacion.toFixed(2)}
                </span>
                {articulo.ultimoFactorImportacion != null && (
                  <span className="font-mono text-slate-500"> · factor {articulo.ultimoFactorImportacion.toFixed(3)}</span>
                )}
                {articulo.ultimoCostoFecha && (
                  <span className="text-slate-400"> · {new Date(articulo.ultimoCostoFecha).toLocaleDateString('es-AR')}</span>
                )}
              </p>
            </div>
          )}
          {articulo.posicionArancelaria && (
            <div>
              <p className={lbl}>Pos. arancelaria</p>
              <p className="text-xs font-mono text-slate-600">{articulo.posicionArancelaria}</p>
            </div>
          )}
          {(articulo as any).origen && (
            <div>
              <p className={lbl}>Origen</p>
              <p className="text-xs text-slate-600">{(articulo as any).origen}</p>
            </div>
          )}
          {(articulo.requiereNumeroSerie || articulo.requiereNumeroLote) && (
            <div className="col-span-2">
              <p className={lbl}>Trazabilidad</p>
              <div className="flex gap-1.5 mt-0.5">
                {articulo.requiereNumeroSerie && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700">Nº de serie</span>}
                {articulo.requiereNumeroLote && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">Nº de lote</span>}
              </div>
            </div>
          )}
        </div>

        {articulo.notas && (
          <div className="bg-slate-50 rounded-md px-3 py-2">
            <p className={lbl}>Notas</p>
            <p className="text-xs text-slate-600 mt-0.5">{articulo.notas}</p>
          </div>
        )}

        <EquivalenciaDualDisplay
          articulo={articulo}
          onDesagregarClick={(origen) => setDesagregarTarget(origen)}
          refreshKey={dualRefreshKey}
        />

        {/* Presentaciones (N° de parte del mismo artículo) — base y vista inversa */}
        <PresentacionesInfo presentaciones={articulo.presentaciones ?? []} stockBase={totalEnStock} />
        <PresentacionInversaInfo articulo={articulo} />

        {/* Kit de compra: BOM + acción de explosión (2026-08-25) */}
        {(articulo.kitComponentes?.length ?? 0) > 0 && (
          <>
            <hr className="border-[#E5E5E5]" />
            <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">
              Kit de compra — componentes
            </p>
            <div className="border border-indigo-200 bg-indigo-50/40 rounded-md px-3 py-2 text-xs text-slate-700">
              {articulo.kitComponentes!.map(c => (
                <p key={c.articuloId}>
                  <span className="font-mono font-semibold">{c.articuloCodigo}</span> ×{c.cantidadPorKit}
                  <span className="text-slate-400"> — {c.articuloDescripcion}</span>
                </p>
              ))}
              <button onClick={() => setExplotarKitOpen(true)}
                className="mt-1.5 text-[11px] text-teal-700 font-medium hover:underline">
                Explotar kit… (consumir kits y dar de alta los componentes)
              </button>
            </div>
          </>
        )}

        {/* Unidades en stock (unificado: incluye cantidad por ubicación — antes había una tabla aparte
            "Stock por depósito" con la misma información). */}
        <hr className="border-[#E5E5E5]" />
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">
          Unidades en stock ({totalEnStock})
        </p>

        {unidadesEnStock.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">Sin stock disponible.</p>
        ) : (
          <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F0F0F0]">
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-left">Ubicacion</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-right w-16">Cant.</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-center">S/N</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-center">Lote</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-center">Condicion</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-center">Estado</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-right w-28">Costo / factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unidadesEnStock.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-slate-600">
                      {TIPO_UBICACION_LABELS[u.ubicacion.tipo] || u.ubicacion.tipo}: {u.ubicacion.referenciaNombre}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-700 tabular-nums">{u.cantidad ?? 1}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-700 text-center">{u.nroSerie || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-600 text-center">{u.nroLote || '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CONDICION_COLORS[u.condicion]}`}>
                        {CONDICION_LABELS[u.condicion]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLORS[u.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                        {u.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap"><CostoFactorUnidad u={u} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
    <ExplotarKitModal
      open={explotarKitOpen}
      articulo={articulo}
      onClose={() => setExplotarKitOpen(false)}
      onSuccess={() => load()}
    />
    <DesagregarStockModal
      open={!!desagregarTarget}
      onClose={() => setDesagregarTarget(null)}
      articulo={desagregarTarget}
      onSuccess={() => {
        setDesagregarTarget(null);
        setDualRefreshKey(k => k + 1);
        load();
      }}
    />
    </>
  );
};
