import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { unidadesService } from '../../services/firebaseService';
import { kitsService } from '../../services/kitsService';
import { useAuth } from '../../contexts/AuthContext';
import type { Articulo, UnidadStock, UbicacionStock } from '@ags/shared';

interface Props {
  open: boolean;
  articulo: Articulo | null;
  onClose: () => void;
  /** Refrescar la vista del artículo tras explotar. */
  onSuccess?: () => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';
const inputCls = 'w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700';

/**
 * Explotar kit (2026-08-25): consume N unidades del artículo-kit en una ubicación
 * y da de alta sus componentes (BOM del artículo) en la misma ubicación. Análogo
 * de DesagregarStockModal pero 1→N artículos distintos. Sin prorrateo de costo.
 */
export function ExplotarKitModal({ open, articulo, onClose, onSuccess }: Props) {
  const { usuario } = useAuth();
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [ubicacionKey, setUbicacionKey] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !articulo) { setUnidades([]); setUbicacionKey(''); setCantidad('1'); setDone(null); return; }
    setLoading(true);
    unidadesService.getByArticulo(articulo.id)
      .then(setUnidades)
      .finally(() => setLoading(false));
  }, [open, articulo?.id]);

  /** Ubicaciones con stock disponible del kit, agregadas. */
  const posiciones = useMemo(() => {
    const map = new Map<string, { ubicacion: UbicacionStock; cantidad: number }>();
    for (const u of unidades) {
      if (u.estado !== 'disponible' || u.activo === false) continue;
      const key = `${u.ubicacion.tipo}:${u.ubicacion.referenciaId}`;
      const prev = map.get(key) ?? { ubicacion: { ...u.ubicacion }, cantidad: 0 };
      prev.cantidad += u.cantidad ?? 1;
      map.set(key, prev);
    }
    return map;
  }, [unidades]);

  const seleccionada = posiciones.get(ubicacionKey) ?? null;
  const kits = Number(cantidad) || 0;
  const bom = (articulo?.kitComponentes ?? []).filter(c => c.articuloId && c.cantidadPorKit > 0);
  const canConfirm = !!seleccionada && Number.isInteger(kits) && kits >= 1 && kits <= (seleccionada?.cantidad ?? 0) && bom.length > 0;

  const confirmar = async () => {
    if (!articulo || !seleccionada || !canConfirm) return;
    setConfirming(true);
    try {
      const r = await kitsService.explotarKit({
        articuloKit: articulo,
        cantidadKits: kits,
        ubicacion: seleccionada.ubicacion,
        solicitadoPorNombre: usuario?.displayName ?? 'Sistema',
      });
      setDone(`${r.kitsConsumidos} kit(s) consumidos · ${r.componentesCreados} unidad(es) de componentes dadas de alta en ${seleccionada.ubicacion.referenciaNombre}.`);
      onSuccess?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al explotar el kit');
    } finally {
      setConfirming(false);
    }
  };

  if (!articulo) return null;

  return (
    <Modal open={open} onClose={onClose} title="Explotar kit" subtitle={`${articulo.codigo} — ${articulo.descripcion}`} maxWidth="md"
      footer={done ? (
        <Button size="sm" onClick={onClose}>Cerrar</Button>
      ) : (
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => void confirmar()} disabled={!canConfirm || confirming}>
            {confirming ? 'Procesando…' : 'Explotar kit'}
          </Button>
        </>
      )}>
      <div className="space-y-3">
        {done ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <p className="font-semibold mb-1">Explosión completada</p>
            <p>{done}</p>
          </div>
        ) : (
          <>
            <div>
              <label className={lbl}>Ubicación (salen los kits, nacen los componentes) *</label>
              <SearchableSelect
                value={ubicacionKey}
                onChange={setUbicacionKey}
                options={[...posiciones.entries()].map(([key, p]) => ({
                  value: key, label: `${p.ubicacion.referenciaNombre} (×${p.cantidad})`,
                }))}
                placeholder={loading ? 'Cargando…' : posiciones.size === 0 ? 'Sin stock disponible del kit' : 'Seleccionar ubicación'}
              />
            </div>
            <div>
              <label className={lbl}>Kits a explotar *</label>
              <input type="number" min={1} max={seleccionada?.cantidad ?? undefined} value={cantidad}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setCantidad(e.target.value)}
                className={`${inputCls} text-right tabular-nums`} />
              {seleccionada && kits > seleccionada.cantidad && (
                <p className="text-[10px] text-red-500 mt-0.5">Máximo {seleccionada.cantidad} en esa ubicación</p>
              )}
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <p className="font-mono uppercase text-[10px] text-slate-500 mb-1">Resultado ({kits >= 1 ? kits : '…'} kit{kits !== 1 ? 's' : ''})</p>
              {bom.length === 0 ? (
                <p className="text-amber-600">Este artículo no tiene componentes de kit cargados — editalos desde la ficha.</p>
              ) : bom.map(c => (
                <p key={c.articuloId}>
                  <span className="font-mono font-semibold">{c.articuloCodigo}</span> ×{kits >= 1 ? c.cantidadPorKit * kits : c.cantidadPorKit}
                  <span className="text-slate-400"> — {c.articuloDescripcion}</span>
                </p>
              ))}
              <p className="text-[10px] text-slate-400 mt-1.5">
                Los componentes nacen sin costo (el costo queda en el kit consumido). La acción no se deshace sola:
                revisá cantidad y ubicación antes de confirmar.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
