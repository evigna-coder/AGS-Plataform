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
}

const devolvible = (it: RemitoItem): 'stock' | 'asignacion' | null => {
  if (it.devuelto || it.consumido || it.tipoItem !== 'sale_y_vuelve') return null;
  if (it.asignacionId) return 'asignacion';
  if (itemRemitoConEfectoAplicado(it)) return 'stock';
  return null;
};

/**
 * Retorno de un remito: marca qué volvió y devuelve cada unidad a su ubicación
 * de origen. Al no quedar items pendientes, el remito se cierra solo.
 *
 * NO consume (2026-08-09). Antes este modal permitía descargar contra una OT
 * —e incluso "Sin OT"—, lo que abría una segunda vía de baja de stock por fuera
 * del cierre administrativo: movimientos con `otNumber: null` que no llegaban
 * ni al `cierreAdmin` ni a facturación. El consumo vive únicamente en el cierre
 * administrativo de la OT, que ya sabe descargar desde el remito
 * (`consumirSeleccionDesdeRemito`) y deja el remanente en poder del ingeniero.
 */
export function RemitoDescargaModal({ open, remito, onClose }: Props) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFilas(remito.items
      .map(item => ({ item, origen: devolvible(item) }))
      .filter((f): f is { item: RemitoItem; origen: 'stock' | 'asignacion' } => f.origen !== null)
      .map(f => ({ ...f, incluir: true })));
  }, [open, remito]);

  const setFila = (id: string, patch: Partial<Fila>) =>
    setFilas(prev => prev.map(f => (f.item.id === id ? { ...f, ...patch } : f)));

  const incluidas = useMemo(() => filas.filter(f => f.incluir), [filas]);

  const ejecutar = async () => {
    if (incluidas.length === 0) { alert('No hay items seleccionados para devolver.'); return; }
    setProcesando(true);
    try {
      const creadoPor = nombreUsuarioActual();

      // 1) Items de ASIGNACIÓN: devolver vía el comprobante (mantiene
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
        const devoluciones: { itemId: string; cantidad: number }[] = [];
        for (const f of grupo) {
          const itemId = itemIdDe(f.item);
          if (!itemId) {
            throw new Error(`${f.item.articuloCodigo || f.item.articuloDescripcion || 'Un item'}: no se pudo vincular con la asignación — devolverlo desde el inventario del ingeniero`);
          }
          devoluciones.push({ itemId, cantidad: f.item.cantidad });
        }
        if (devoluciones.length > 0) await asignacionesService.devolverItems(asgId, devoluciones);
      }

      // 2) Items de STOCK propio: transacción única (unidades + movimientos +
      //    cierre del remito). `consumir: 0` = vuelve todo a su ubicación de origen.
      const deStock = incluidas.filter(x => x.origen === 'stock');
      if (deStock.length > 0) {
        await movimientosAplicarService.descargarItemsStockRemito({
          remito,
          resoluciones: deStock.map(f => ({ itemId: f.item.id, consumir: 0 })),
          otNumber: null,
          creadoPor,
        });
      }
      onClose();
    } catch (err) {
      console.error('[RemitoDescargaModal] devolución:', err);
      alert(err instanceof Error ? err.message : 'Error al registrar la devolución');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Devolver remito ${remito.numero}`} maxWidth="lg">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Tildá lo que <span className="font-medium text-teal-700">volvió</span> — cada unidad regresa a su
          ubicación de origen. Destildá lo que sigue en campo. Con todo resuelto, el remito se cierra solo.
        </p>
        <p className="text-[11px] text-slate-400 border-l-2 border-slate-200 pl-2">
          ¿Se consumió en la OT? No se descarga desde acá: al cerrar la OT administrativamente,
          el selector de stock ofrece este remito como origen de la parte.
        </p>

        {filas.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No hay items pendientes de devolución.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-1.5 w-8" />
                  <th className="px-2 py-1.5 text-left text-[10px] font-mono text-slate-500 uppercase">Artículo</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-mono text-slate-500 uppercase w-20">Cant.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map(f => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={procesando}>Cancelar</Button>
          <Button size="sm" onClick={ejecutar} disabled={procesando || incluidas.length === 0}>
            {procesando ? 'Devolviendo…' : 'Devolver y cerrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
