import type { Articulo, CategoriaEquipoStock, TipoArticulo } from '@ags/shared';
import { EquivalenciaBadge } from '../../components/stock/EquivalenciaBadge';

const CATEGORIA_LABELS: Record<CategoriaEquipoStock, string> = {
  HPLC: 'HPLC', GC: 'GC', MSD: 'MSD', UV: 'UV', OSMOMETRO: 'Osmometro', GENERAL: 'General',
};
const TIPO_LABELS: Record<TipoArticulo, string> = {
  repuesto: 'Repuesto', consumible: 'Consumible', equipo: 'Equipo', columna: 'Columna',
  accesorio: 'Accesorio', muestra: 'Muestra', otro: 'Otro',
};

interface Props {
  articulo: Articulo;
  marcaName: string;
  colWidths: number[] | null;
  colAligns: string[] | null;
  getAlignClass: (idx: number) => string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onDeactivate: (art: Articulo) => void;
  onDelete: (art: Articulo) => void;
  /** Phase 13 STKE-07 — true when this row has an equivalencia partner (either side). */
  hasEquivalencia?: boolean;
  /** Phase 13 STKE-07 — true when the search matches this row's linked pair. */
  expandDual?: boolean;
  /** Phase 13 STKE-07 — called when user clicks Desagregar ahora in the dual row. */
  onDesagregar?: (art: Articulo) => void;
  /** Phase 13 STKE-07 — total columns for colSpan in expansion row. */
  totalCols?: number;
}

/**
 * Phase 13 STKE-07 — single table row extracted from ArticulosList for LOC budget compliance.
 * Renders all cells (codigo, descripcion, marca, categoria, tipo, stockMinimo, precioRef, acciones).
 * When hasEquivalencia=true, shows the EquivalenciaBadge inline next to the codigo.
 * When expandDual=true, renders an expansion <tr> beneath with EquivalenciaDualDisplay.
 */
export function ArticulosListRow({
  articulo: art,
  marcaName,
  getAlignClass,
  isSelected,
  onSelect,
  onEdit,
  onView,
  onDeactivate,
  onDelete,
  hasEquivalencia = false,
  expandDual = false,
  onDesagregar,
  totalCols = 9,
}: Props) {
  return (
    <>
      <tr className={`hover:bg-slate-50 ${!art.activo ? 'opacity-50' : ''} ${isSelected ? 'bg-teal-50/50' : ''}`}>
        <td className="px-3 py-2 w-8">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(art.id)}
            className="w-3.5 h-3.5 rounded border-slate-300 accent-teal-700"
          />
        </td>
        <td className={`px-4 py-2 whitespace-nowrap ${getAlignClass(1)}`}>
          <span className="inline-flex items-center gap-1">
            <button onClick={() => onView(art.id)} className="font-mono text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline text-left">
              {art.codigo}
            </button>
            {hasEquivalencia && (
              <EquivalenciaBadge
                origenCodigo={art.equivalencias?.[0] ? art.codigo : undefined}
                destinoCodigo={art.equivalencias?.[0]?.articuloCodigoDestino}
                factor={art.equivalencias?.[0]?.factor}
              />
            )}
          </span>
        </td>
        <td className={`px-4 py-2 text-xs text-slate-900 max-w-md truncate ${getAlignClass(2)}`}>
          <button onClick={() => onView(art.id)} className="hover:text-teal-700 hover:underline text-left">
            {art.descripcion}
          </button>
        </td>
        <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(3)}`}>{marcaName}</td>
        <td className={`px-4 py-2 ${getAlignClass(4)}`}>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
            {CATEGORIA_LABELS[art.categoriaEquipo] ?? art.categoriaEquipo}
          </span>
        </td>
        <td className={`px-4 py-2 ${getAlignClass(5)}`}>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700">
            {TIPO_LABELS[art.tipo] ?? art.tipo}
          </span>
        </td>
        <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(6)}`}>{art.stockMinimo}</td>
        <td className={`px-4 py-2 text-xs text-slate-600 ${getAlignClass(7)}`}>
          {art.precioReferencia != null
            ? `${art.monedaPrecio === 'USD' ? 'US$' : '$'} ${art.precioReferencia.toLocaleString('es-AR')}`
            : '-'}
        </td>
        <td className="px-4 py-2">
          <div className="flex justify-end gap-1">
            <button onClick={() => onView(art.id)}
              className="px-2 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
              Ver
            </button>
            <button onClick={() => onEdit(art.id)}
              className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">
              Editar
            </button>
            {art.activo && (
              <button onClick={() => onDeactivate(art)}
                className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 rounded transition-colors">
                Desactivar
              </button>
            )}
            <button
              onClick={() => onDelete(art)}
              className="px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              Eliminar
            </button>
          </div>
        </td>
      </tr>
      {expandDual && (
        <DualExpansionRow articulo={art} onDesagregar={onDesagregar} totalCols={totalCols} />
      )}
    </>
  );
}

// ── Lazy-loaded dual expansion row ───────────────────────────────────────────
// Kept in this file to avoid adding another import layer to ArticulosList.tsx.

import { lazy, Suspense } from 'react';
import type { Articulo as ArticuloT } from '@ags/shared';

const EquivalenciaDualDisplay = lazy(
  () => import('../../components/stock/EquivalenciaDualDisplay').then(m => ({ default: m.EquivalenciaDualDisplay }))
);

function DualExpansionRow({
  articulo,
  onDesagregar,
  totalCols,
}: {
  articulo: ArticuloT;
  onDesagregar?: (art: ArticuloT) => void;
  totalCols: number;
}) {
  return (
    <tr data-testid="dual-row">
      <td colSpan={totalCols} className="px-3 py-2 bg-teal-50/20">
        <Suspense fallback={<span className="text-xs text-slate-400 italic">Cargando…</span>}>
          <EquivalenciaDualDisplay
            articulo={articulo}
            onDesagregarClick={(origen) => onDesagregar?.(origen)}
          />
        </Suspense>
      </td>
    </tr>
  );
}
