import type { ItemOC } from '@ags/shared';

/**
 * Lo ya cargado a la OC, mostrado DENTRO del wizard (2026-09-03).
 *
 * El wizard se queda abierto para cargar el renglón siguiente y su fondo tapa
 * la tabla de la OC, así que sin esto se carga a ciegas: no se ve si el ítem
 * entró ni con qué cantidad. Se muestran los últimos, con el más reciente
 * abajo y resaltado — que es donde está mirando el que carga.
 */
export function OCWizardCargados({ items }: { items: ItemOC[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1">
        En esta OC · {items.length}
      </p>
      <ul className="max-h-24 overflow-y-auto space-y-0.5">
        {items.slice(-4).map((it, i, arr) => (
          <li key={it.id}
            className={`text-[11px] flex items-baseline gap-1.5 ${
              i === arr.length - 1 ? 'text-teal-700 font-medium' : 'text-slate-500'}`}>
            <span className="font-mono truncate max-w-[7rem]">
              {it.presentacion?.codigoParte || it.articuloCodigo || '—'}
            </span>
            <span className="truncate flex-1">{it.descripcion}</span>
            <span className="tabular-nums shrink-0">×{it.cantidad}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
