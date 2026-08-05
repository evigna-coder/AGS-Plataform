import type { Remito, RemitoItem } from '@ags/shared';

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
 */
export function RemitoItemsInline({ remito }: { remito: Remito }) {
  if ((remito.items?.length ?? 0) === 0) {
    return <p className="text-[11px] text-slate-400 px-4 py-2">Sin items.</p>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase">Código</th>
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase">Descripción</th>
          <th className="px-3 py-1 text-center text-[10px] font-mono text-slate-400 uppercase w-14">Cant.</th>
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase w-28">N° serie</th>
          <th className="px-3 py-1 text-left text-[10px] font-mono text-slate-400 uppercase w-32">Estado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {remito.items.map(it => {
          const e = estadoItem(it);
          return (
            <tr key={it.id}>
              <td className="px-3 py-1 text-[11px] font-mono text-slate-700">
                {it.articuloCodigo || it.instrumentoCodigo || it.minikitCodigo || it.loanerCodigo || '—'}
              </td>
              <td className="px-3 py-1 text-[11px] text-slate-600 truncate max-w-[300px]">
                {it.articuloDescripcion || it.instrumentoDescripcion || it.dispositivoDescripcion || it.fichaDescripcion || '—'}
              </td>
              <td className="px-3 py-1 text-[11px] text-slate-600 text-center">{it.cantidad}</td>
              <td className="px-3 py-1 text-[11px] font-mono text-slate-500">{it.serie || '—'}</td>
              <td className="px-3 py-1">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${e.cls}`}>{e.label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
