import { useEffect, useState } from 'react';
import { asignacionesService } from '../../services/firebaseService';
import type { ItemAsignacion } from '@ags/shared';

/**
 * Vista RÁPIDA del inventario de un ingeniero, inline en la card de
 * asignación rápida (pedido 2026-08-04): ver qué tiene sin abrir el modal.
 * Solo lectura — devolver/consumir/transferir viven en el modal ("Detalle").
 */
export function InventarioIngenieroInline({ ingenieroId }: { ingenieroId: string }) {
  const [items, setItems] = useState<ItemAsignacion[] | null>(null);

  useEffect(() => {
    let cancel = false;
    asignacionesService.getByIngeniero(ingenieroId)
      .then(asgs => {
        if (cancel) return;
        setItems(asgs.flatMap(a => a.items.filter(i => i.estado === 'asignado')));
      })
      .catch(err => {
        console.error('[InventarioIngenieroInline] load:', err);
        if (!cancel) setItems([]);
      });
    return () => { cancel = true; };
  }, [ingenieroId]);

  if (items === null) {
    return <p className="text-[10px] text-slate-400 italic px-1 py-1.5">Cargando inventario…</p>;
  }
  if (items.length === 0) {
    return <p className="text-[10px] text-slate-400 italic px-1 py-1.5">No tiene materiales asignados.</p>;
  }

  const codigo = (i: ItemAsignacion) =>
    i.articuloCodigo || i.minikitCodigo || i.loanerCodigo || i.vehiculoPatente || '';
  const etiqueta = (i: ItemAsignacion) =>
    i.articuloDescripcion || i.instrumentoNombre || i.dispositivoDescripcion || i.minikitCodigo || i.tipo;
  const restante = (i: ItemAsignacion) => i.cantidad - i.cantidadDevuelta - i.cantidadConsumida;

  return (
    <div className="space-y-0.5 max-h-56 overflow-y-auto pr-0.5">
      {items.map((i, idx) => (
        <div key={`${i.id}-${idx}`} className="flex items-center gap-1.5 bg-white/70 rounded px-2 py-1 text-[11px]">
          {codigo(i) && <span className="font-mono text-teal-700 font-semibold text-[10px] shrink-0">{codigo(i)}</span>}
          <span className="text-slate-700 truncate flex-1">{etiqueta(i)}</span>
          {restante(i) > 1 && <span className="text-[10px] text-slate-500 shrink-0">×{restante(i)}</span>}
          <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-px rounded shrink-0">{i.tipo}</span>
          {i.permanente && <span className="text-[9px] bg-teal-50 text-teal-700 px-1 py-px rounded shrink-0">Perm</span>}
        </div>
      ))}
    </div>
  );
}
