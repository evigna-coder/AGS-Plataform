import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { articulosService, unidadesService, marcasService } from '../../services/firebaseService';
import type { Articulo, UnidadStock, Marca, CondicionUnidad } from '@ags/shared';

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
  posicion: 'Posicion', minikit: 'Minikit', ingeniero: 'Ingeniero', cliente: 'Cliente', proveedor: 'Proveedor', transito: 'En transito',
};

const lbl = "text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide";

export const ViewArticuloModal: React.FC<Props> = ({ open, articuloId, onClose, onEdit }) => {
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [marca, setMarca] = useState<Marca | null>(null);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(false);

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

  if (loading || !articulo) {
    return (
      <Modal open={open} onClose={onClose} title="Articulo">
        <p className="text-slate-400 text-xs py-8 text-center">{loading ? 'Cargando...' : 'Articulo no encontrado'}</p>
      </Modal>
    );
  }

  return (
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
        </div>

        {articulo.notas && (
          <div className="bg-slate-50 rounded-md px-3 py-2">
            <p className={lbl}>Notas</p>
            <p className="text-xs text-slate-600 mt-0.5">{articulo.notas}</p>
          </div>
        )}

        {/* Unidades */}
        <hr className="border-[#E5E5E5]" />
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">
          Unidades en stock ({unidades.length})
        </p>

        {unidades.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No hay unidades registradas.</p>
        ) : (
          <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F0F0F0]">
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-left">S/N</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-left">Lote</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-left">Condicion</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-left">Estado</th>
                  <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-1.5 px-2 text-left">Ubicacion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unidades.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 font-mono text-slate-700">{u.nroSerie || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-600">{u.nroLote || '—'}</td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CONDICION_COLORS[u.condicion]}`}>
                        {CONDICION_LABELS[u.condicion]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLORS[u.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                        {u.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">
                      {TIPO_UBICACION_LABELS[u.ubicacion.tipo] || u.ubicacion.tipo}: {u.ubicacion.referenciaNombre}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
