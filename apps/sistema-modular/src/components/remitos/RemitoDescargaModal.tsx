import { useEffect, useMemo, useState } from 'react';
import type { Remito, RemitoItem } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { asignacionesService } from '../../services/firebaseService';
import { movimientosAplicarService, itemRemitoConEfectoAplicado } from '../../services/movimientosAplicar';
import { nombreUsuarioActual } from '../../services/asignacionesStockHelpers';

interface Props {
  open: boolean;
  remito: Remito;
  onClose: () => void;
}

interface Fila {
  item: RemitoItem;
  /** 'stock' = remito manual con efecto aplicado; 'asignacion' = vía comprobante. */
  origen: 'stock' | 'asignacion';
  incluir: boolean;
  consumir: number;
}

const descargable = (it: RemitoItem): 'stock' | 'asignacion' | null => {
  if (it.devuelto || it.consumido || it.tipoItem !== 'sale_y_vuelve') return null;
  if (it.asignacionId) return 'asignacion';
  if (itemRemitoConEfectoAplicado(it)) return 'stock';
  return null;
};

/**
 * Descarga del remito (2026-08-04): por item, cuánto se CONSUME (movimiento
 * 'consumo' contra la OT) y el resto VUELVE a stock. Al resolver todo, el
 * remito se cierra (completado / completado_parcial). Los items de asignación
 * pasan por asignacionesService para mantener también el comprobante.
 */
export function RemitoDescargaModal({ open, remito, onClose }: Props) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [otNumber, setOtNumber] = useState('');
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFilas(remito.items
      .map(item => ({ item, origen: descargable(item) }))
      .filter((f): f is { item: RemitoItem; origen: 'stock' | 'asignacion' } => f.origen !== null)
      .map(f => ({ ...f, incluir: true, consumir: 0 })));
    setOtNumber(remito.otNumbers?.[0] ?? '');
  }, [open, remito]);

  const setFila = (id: string, patch: Partial<Fila>) =>
    setFilas(prev => prev.map(f => (f.item.id === id ? { ...f, ...patch } : f)));

  const incluidas = useMemo(() => filas.filter(f => f.incluir), [filas]);

  const ejecutar = async () => {
    if (incluidas.length === 0) { alert('No hay items seleccionados para descargar.'); return; }
    setProcesando(true);
    try {
      const creadoPor = nombreUsuarioActual();
      const ot = otNumber || null;

      // 1) Items de ASIGNACIÓN: consumir/devolver vía el comprobante (mantiene
      //    asignación + entidades + remito, todo en los servicios existentes).
      const porAsignacion = new Map<string, Fila[]>();
      for (const f of incluidas.filter(x => x.origen === 'asignacion')) {
        const asgId = f.item.asignacionId!;
        porAsignacion.set(asgId, [...(porAsignacion.get(asgId) ?? []), f]);
      }
      for (const [asgId, grupo] of porAsignacion) {
        const asg = await asignacionesService.getById(asgId);
        if (!asg) throw new Error(`La asignación del remito ya no existe (${asgId})`);
        const itemIdDe = (ri: RemitoItem): string | null => {
          if (ri.asignacionItemId) return ri.asignacionItemId;
          const m = asg.items.find(ai =>
            (ri.unidadId && ai.unidadId === ri.unidadId)
            || (ri.instrumentoId && ai.instrumentoId === ri.instrumentoId)
            || (ri.minikitId && ai.minikitId === ri.minikitId)
            || (ri.dispositivoId && ai.dispositivoId === ri.dispositivoId));
          return m?.id ?? null;
        };
        const consumos: { itemId: string; cantidad: number; otNumber?: string }[] = [];
        const devoluciones: { itemId: string; cantidad: number }[] = [];
        for (const f of grupo) {
          const itemId = itemIdDe(f.item);
          if (!itemId) {
            throw new Error(`${f.item.articuloCodigo || f.item.articuloDescripcion || 'Un item'}: no se pudo vincular con la asignación — descargarlo desde el inventario del ingeniero`);
          }
          const consumir = Math.min(Math.max(0, f.consumir), f.item.cantidad);
          const devolver = f.item.cantidad - consumir;
          if (consumir > 0) consumos.push({ itemId, cantidad: consumir, ...(ot ? { otNumber: ot } : {}) });
          if (devolver > 0) devoluciones.push({ itemId, cantidad: devolver });
        }
        if (consumos.length > 0) await asignacionesService.consumirItems(asgId, consumos);
        if (devoluciones.length > 0) await asignacionesService.devolverItems(asgId, devoluciones);
      }

      // 2) Items de STOCK propio: transacción única (unidades + movimientos +
      //    cierre del remito).
      const deStock = incluidas.filter(x => x.origen === 'stock');
      if (deStock.length > 0) {
        await movimientosAplicarService.descargarItemsStockRemito({
          remito,
          resoluciones: deStock.map(f => ({ itemId: f.item.id, consumir: f.consumir })),
          otNumber: ot,
          creadoPor,
        });
      }
      onClose();
    } catch (err) {
      console.error('[RemitoDescargaModal] descarga:', err);
      alert(err instanceof Error ? err.message : 'Error al descargar el remito');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Descargar remito ${remito.numero}`} maxWidth="lg">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Por cada item, indicá cuánto se <span className="font-medium text-orange-600">consumió</span> — el resto
          <span className="font-medium text-teal-700"> vuelve a stock</span>. Destildá lo que sigue en campo.
          Con todo resuelto, el remito se cierra solo.
        </p>

        {(remito.otNumbers?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-slate-500">OT del consumo</label>
            <select value={otNumber} onChange={e => setOtNumber(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400">
              {remito.otNumbers!.map(n => <option key={n} value={n}>OT-{n}</option>)}
              <option value="">Sin OT</option>
            </select>
          </div>
        )}

        {filas.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No hay items pendientes de descarga.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-1.5 w-8" />
                  <th className="px-2 py-1.5 text-left text-[10px] font-mono text-slate-500 uppercase">Artículo</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-mono text-slate-500 uppercase w-14">Cant.</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-mono text-slate-500 uppercase w-20">Consumir</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-mono text-slate-500 uppercase w-20">Vuelve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map(f => {
                  const consumir = f.incluir ? Math.min(Math.max(0, f.consumir), f.item.cantidad) : 0;
                  return (
                    <tr key={f.item.id} className={f.incluir ? '' : 'opacity-40'}>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" checked={f.incluir}
                          onChange={e => setFila(f.item.id, { incluir: e.target.checked })}
                          className="rounded border-slate-300" />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="block font-mono font-semibold text-teal-800">{f.item.articuloCodigo || f.item.instrumentoCodigo || f.item.minikitCodigo || '—'}</span>
                        <span className="block text-[10px] text-slate-500 truncate max-w-[260px]">
                          {f.item.articuloDescripcion || f.item.instrumentoDescripcion || f.item.dispositivoDescripcion || ''}
                          {f.item.serie ? ` · S/N ${f.item.serie}` : ''}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center text-slate-600">{f.item.cantidad}</td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} max={f.item.cantidad} value={f.consumir}
                          disabled={!f.incluir}
                          onChange={e => setFila(f.item.id, { consumir: Number(e.target.value) || 0 })}
                          onFocus={e => e.target.select()}
                          className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400 disabled:bg-slate-50" />
                      </td>
                      <td className="px-2 py-1.5 text-center font-medium text-teal-700">
                        {f.incluir ? f.item.cantidad - consumir : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={procesando}>Cancelar</Button>
          <Button size="sm" onClick={ejecutar} disabled={procesando || incluidas.length === 0}>
            {procesando ? 'Descargando…' : 'Descargar y cerrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
