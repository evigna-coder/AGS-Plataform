import { useEffect, useMemo, useState } from 'react';
import type { Patron, UnidadStock } from '@ags/shared';
import { unidadesService } from '../../services/stockService';
import { movimientosAplicarService } from '../../services/movimientosAplicar';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';
const inp = 'w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400';

interface Props {
  open: boolean;
  onClose: () => void;
  onConvertido: () => void;
  patron: Patron;
  creadoPor: string;
}

/**
 * Convierte stock existente del artículo vinculado en un lote de este patrón
 * (2026-08-18).
 *
 * Existe porque el puente OC → patrón solo actúa al ingresar: lo que ya estaba
 * en el depósito cuando se declaró el vínculo quedaba varado. Pide
 * explícitamente DE DÓNDE salen las unidades — sin eso, "pasar a patrón" sería
 * inventar un lote y dejar el stock duplicado.
 */
export function ConvertirStockAPatronModal({ open, onClose, onConvertido, patron, creadoPor }: Props) {
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [ubicKey, setUbicKey] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [lote, setLote] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !patron.articuloId) return;
    setUbicKey(''); setCantidad(1); setLote(''); setVencimiento(''); setError('');
    unidadesService.getByArticulo(patron.articuloId)
      .then(us => setUnidades(us.filter(u => u.activo !== false && u.estado === 'disponible')))
      .catch(() => setUnidades([]));
  }, [open, patron.articuloId]);

  /** Stock disponible agrupado por ubicación — es lo que se puede convertir. */
  const porUbicacion = useMemo(() => {
    const m = new Map<string, { key: string; nombre: string; cantidad: number; unidades: UnidadStock[] }>();
    for (const u of unidades) {
      const key = `${u.ubicacion?.tipo}:${u.ubicacion?.referenciaId ?? ''}`;
      const prev = m.get(key) ?? { key, nombre: u.ubicacion?.referenciaNombre ?? 'Sin ubicación', cantidad: 0, unidades: [] };
      prev.cantidad += u.cantidad ?? 1;
      prev.unidades.push(u);
      m.set(key, prev);
    }
    return [...m.values()].sort((a, b) => b.cantidad - a.cantidad);
  }, [unidades]);

  const elegida = porUbicacion.find(g => g.key === ubicKey) ?? null;
  const factor = (patron.componentes?.length ?? 0) > 0 ? 1 : (patron.unidadesPorUnidadDeCompra ?? 1);

  const handleSubmit = async () => {
    if (guardando) return;
    if (!elegida) { setError('Elegí de qué ubicación salen las unidades'); return; }
    if (!lote.trim()) { setError('Cargá el número de lote'); return; }
    if (cantidad <= 0 || cantidad > elegida.cantidad) {
      setError(`La cantidad tiene que estar entre 1 y ${elegida.cantidad}`); return;
    }
    setGuardando(true); setError('');
    try {
      const n = await movimientosAplicarService.convertirStockAPatron({
        patron,
        unidades: elegida.unidades,
        cantidad,
        lote: lote.trim(),
        fechaVencimiento: vencimiento || null,
        creadoPor,
      });
      alert(`${n} unidad(es) convertidas al lote ${lote.trim()}.`);
      onConvertido();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo convertir');
    } finally { setGuardando(false); }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="md"
      title="Convertir stock a lote de patrón"
      subtitle={`${patron.codigoArticulo} — ${patron.descripcion}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => void handleSubmit()} disabled={guardando || !elegida}>
          {guardando ? 'Convirtiendo…' : 'Convertir'}
        </Button>
      </>}>
      <div className="space-y-3">
        {!patron.articuloId ? (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Este patrón no tiene artículo vinculado. Cargalo en «Entrada por compra» y volvé.
          </p>
        ) : porUbicacion.length === 0 ? (
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            No hay stock disponible del artículo vinculado. No hay nada para convertir.
          </p>
        ) : (
          <>
            <div>
              <label className={lbl}>Sale de</label>
              <SearchableSelect
                value={ubicKey}
                onChange={v => {
                  setUbicKey(v);
                  const g = porUbicacion.find(x => x.key === v);
                  if (g) setCantidad(g.cantidad);
                }}
                options={porUbicacion.map(g => ({
                  value: g.key, label: g.nombre, subLabel: `${g.cantidad} u. disponibles`,
                }))}
                placeholder="Elegí la ubicación…" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Cantidad</label>
                <input type="number" min={1} max={elegida?.cantidad ?? 1} value={cantidad}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                  className={inp} />
              </div>
              <div>
                <label className={lbl}>N° de lote</label>
                <input value={lote} onChange={e => setLote(e.target.value)}
                  placeholder="El del fabricante" className={`${inp} font-mono`} />
              </div>
              <div>
                <label className={lbl}>Vencimiento</label>
                <input type="date" value={vencimiento}
                  onChange={e => setVencimiento(e.target.value)} className={inp} />
              </div>
            </div>

            {elegida && (
              <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                Salen {cantidad} u. de {elegida.nombre} y entran {cantidad * factor} al lote {lote.trim() || '—'}.
                {factor !== 1 && <span className="block text-[10px] mt-0.5">Factor del patrón: ×{factor}.</span>}
                <span className="block text-[10px] text-teal-700/80 mt-0.5">
                  El stock del artículo se descuenta: queda una sola existencia.
                </span>
              </p>
            )}
          </>
        )}
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
