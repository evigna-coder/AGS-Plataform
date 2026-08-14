import { useMemo } from 'react';
import type { Articulo } from '@ags/shared';
import { baseDePresentacion } from '../../utils/articuloSearch';

interface Props {
  /** Texto tipeado en el buscador. */
  search: string;
  /** Catálogo ya cargado por la pantalla. */
  articulos: Articulo[];
  /** Stock actual del artículo base, si la pantalla lo conoce (unidades base). */
  stockBase?: (articuloId: string) => number | null;
}

/**
 * Traduce la búsqueda por un N° de parte que NO es un artículo sino un envase
 * (2026-08-13).
 *
 * El caso que resuelve: alguien tiene que cotizar 2 del 5183-2067, busca ese
 * código para ver si hay stock, no encuentra nada y concluye que no puede
 * entregar — cuando en realidad hay 20 unidades del 5182-0714 listas, que son
 * exactamente esas 2. El que no conoce el modelo de presentaciones no tiene
 * cómo saberlo, y el error es caro: se pierde la venta o se compra de más.
 */
export function PresentacionSearchHint({ search, articulos, stockBase }: Props) {
  const rel = useMemo(() => baseDePresentacion(articulos, search.trim()), [articulos, search]);
  if (!rel) return null;

  const stock = stockBase?.(rel.base.id) ?? null;
  const enEnvases = stock != null && rel.factor > 0 ? stock / rel.factor : null;

  return (
    <div className="rounded-md border border-teal-300 bg-teal-50 px-3 py-2 mb-3">
      <p className="text-[11px] text-teal-900">
        <span className="font-mono font-semibold">{search.trim()}</span> no es un artículo: es un
        envase de <span className="font-mono font-semibold">{rel.base.codigo}</span>
        {' '}({rel.base.descripcion}) — <span className="font-semibold">×{rel.factor}</span>.
        El stock se cuenta en unidades de {rel.base.codigo}.
      </p>
      {stock != null && (
        <p className="text-[11px] text-teal-800 mt-0.5">
          Hoy hay <span className="font-semibold">{stock}</span> unidad(es)
          {enEnvases != null && (
            <> = <span className="font-semibold">{Number.isInteger(enEnvases) ? enEnvases : enEnvases.toFixed(2)}</span>
            {' '}× {search.trim()}</>
          )}.
        </p>
      )}
    </div>
  );
}
