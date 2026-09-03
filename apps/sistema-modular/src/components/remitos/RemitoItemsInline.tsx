import { useEffect, useState } from 'react';
import type { Remito, RemitoItem } from '@ags/shared';
import { getRemitoItemCodigo, getRemitoItemDescripcion } from '../../utils/inventarioToRemitoItem';
import { enriquecerItemsRemito } from '../../utils/enriquecerItemsRemito';
import { RetornoProveedorButton } from './RetornoProveedorButton';

/** Estado resuelto de un item para el desplegable de la lista (2026-08-04). */
function estadoItem(it: RemitoItem): { label: string; cls: string } {
  if (it.consumido) return { label: 'Consumido', cls: 'bg-orange-100 text-orange-700' };
  if (it.devuelto) return { label: 'Devuelto', cls: 'bg-green-100 text-green-700' };
  if (it.tipoItem === 'entrega') return { label: 'Entrega', cls: 'bg-amber-100 text-amber-700' };
  const parcial = (it.cantidadConsumida ?? 0) > 0;
  return parcial
    ? { label: `En campo (${it.cantidadConsumida} cons.)`, cls: 'bg-blue-100 text-blue-700' }
    : { label: 'En campo', cls: 'bg-blue-100 text-blue-700' };
}

/**
 * Mini-tabla de artículos de un remito, para la fila desplegable del listado
 * (2026-08-04: "listado desplegable de remitos para ver los artículos").
 *
 * `clientePorFicha` (2026-08-07): cuando el remito lleva equipos de más de un
 * cliente, la lista muestra "Varios clientes" — acá se detalla de quién es
 * cada línea, que es el dato que hacía falta al desplegar.
 */
export function RemitoItemsInline({ remito, clientePorFicha }: {
  remito: Remito;
  clientePorFicha?: Map<string, string>;
}) {
  /**
   * Mismo enriquecido que el papel y el detalle (2026-08-19). Este desplegable
   * mostraba el dato CRUDO: instrumentos, minikits y columnas salían con "—"
   * mientras el papel salía completo. Tres vistas del mismo remito, tres
   * resultados distintos.
   */
  const [items, setItems] = useState<RemitoItem[]>(remito.items ?? []);
  useEffect(() => {
    let vivo = true;
    setItems(remito.items ?? []);
    enriquecerItemsRemito(remito.items ?? [])
      .then(e => { if (vivo) setItems(e); })
      .catch(() => { /* se muestra lo crudo */ });
    return () => { vivo = false; };
  }, [remito.items]);

  if ((remito.items?.length ?? 0) === 0) {
    return <p className="text-[11px] text-slate-400 px-4 py-2">Sin items.</p>;
  }
  // Columna Cliente solo cuando aporta algo: si todas las líneas son del mismo
  // dueño, ya está en la fila de arriba y repetirla es ruido.
  const duenoDe = (it: RemitoItem): string =>
    (it.fichaId ? clientePorFicha?.get(it.fichaId) : null) || 'AGS';
  const dueños = new Set(items.map(duenoDe));
  const mostrarCliente = dueños.size > 1;

  /**
   * OT de la línea (2026-08-07). Si el item no la trae, se cae a la del remito
   * SOLO cuando hay una sola: con varias no se puede saber cuál le toca a cada
   * uno y adivinar sería peor que mostrar "—".
   */
  const otDe = (it: RemitoItem): string =>
    it.otNumber || it.otNumberOrigen
    || (remito.otNumbers?.length === 1 ? remito.otNumbers[0] : '')
    || '—';

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase">Código</th>
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase">Descripción</th>
          {mostrarCliente && (
            <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase w-44">Cliente</th>
          )}
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase w-24">OT</th>
          <th className="px-3 py-1 text-center text-[10px] font-mono text-slate-400 uppercase w-14">Cant.</th>
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase w-28">N° serie</th>
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase w-32">Estado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map(it => {
          const e = estadoItem(it);
          return (
            <tr key={it.id}>
              {/* Mismos helpers que el papel y el detalle (2026-08-07): esta
                  tabla tenía su propia cadena de fallbacks y por eso mostraba
                  el LNR del loaner como código y la descripción vacía. */}
              <td className="px-3 py-1 text-[11px] font-mono text-slate-700">
                {getRemitoItemCodigo(it) || 'S/C'}
              </td>
              <td className="px-3 py-1 text-[11px] text-slate-600 truncate max-w-[300px]">
                {getRemitoItemDescripcion(it) || '—'}
              </td>
              {mostrarCliente && (
                <td className="px-3 py-1 text-[11px] text-slate-600 truncate max-w-[180px]" title={duenoDe(it)}>
                  {duenoDe(it)}
                </td>
              )}
              <td className="px-3 py-1 text-[11px] font-mono text-slate-600">{otDe(it)}</td>
              <td className="px-3 py-1 text-[11px] text-slate-600 text-center">{it.cantidad}</td>
              <td className="px-3 py-1 text-[11px] font-mono text-slate-500">{it.serie || '—'}</td>
              <td className="px-3 py-1">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${e.cls}`}>{e.label}</span>
                {/* Retorno desde la lista (2026-09-03, caso 0001-00017404): el
                    boton vivia solo en el detalle, y desde la fila desplegada la
                    unica salida era "Completar", que cierra el papel y deja la
                    unidad perdida en transito. Modal-first: la accion va donde
                    esta la linea. La lista esta suscripta, asi que la fila se
                    refresca sola al registrar. */}
                {remito.tipo === 'derivacion_proveedor' && it.unidadId && !it.devuelto && !it.consumido && (
                  <span className="ml-2 inline-flex"><RetornoProveedorButton item={it} /></span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
