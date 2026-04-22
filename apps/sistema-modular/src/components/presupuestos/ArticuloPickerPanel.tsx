import { useMemo } from 'react';
import type { Articulo } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { StockAmplioIndicator } from '../stock/StockAmplioIndicator';
import { useStockAmplio } from '../../hooks/useStockAmplio';
import { itemRequiresImportacion } from '../../services/atpHelpers';

interface Props {
  /** Catalog completo — caller lo pasa ya cargado (evita re-fetch por render). */
  articulos: Articulo[];
  /** Id actual del artículo ligado al item (null si no hay). */
  articuloSeleccionadoId: string | null;
  /** Callback: parent debe setear stockArticuloId, codigoProducto, descripcion en newItem. */
  onSelect: (
    articulo: Articulo | null,                  // null = unlink
    meta: { itemRequiereImportacion: boolean },
  ) => void;
  /** Si true, oculta el label superior — usado cuando el panel va dentro de otro con título. */
  compact?: boolean;
}

/**
 * Panel de selección de artículo de stock con StockAmplioIndicator inline.
 * Usado en AddItemModal para tipos partes/mixto/ventas.
 * Al seleccionar, computa itemRequiereImportacion via atpHelpers y llama onSelect.
 */
export const ArticuloPickerPanel: React.FC<Props> = ({
  articulos, articuloSeleccionadoId, onSelect, compact,
}) => {
  const options = useMemo(
    () => articulos.map(a => ({
      value: a.id,
      label: `[${a.codigo || '—'}] ${a.descripcion}`,
    })),
    [articulos],
  );

  const { stockAmplio, loading, source } = useStockAmplio(articuloSeleccionadoId);

  const handleChange = async (id: string) => {
    if (!id) {
      onSelect(null, { itemRequiereImportacion: false });
      return;
    }
    const art = articulos.find(a => a.id === id);
    if (!art) return;
    // Compute flag at select-time; fail-soft if unavailable
    let requiere = false;
    try { requiere = await itemRequiresImportacion(id); } catch { requiere = false; }
    onSelect(art, { itemRequiereImportacion: requiere });
  };

  return (
    <div className="space-y-1.5">
      {!compact && (
        <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 block">
          Artículo de stock
        </label>
      )}
      <SearchableSelect
        value={articuloSeleccionadoId || ''}
        onChange={(v) => { void handleChange(v); }}
        options={[{ value: '', label: 'Sin vincular (carga manual)' }, ...options]}
        placeholder="Buscar por código o descripción..."
      />
      {articuloSeleccionadoId && (
        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
          {loading ? (
            <p className="text-[10px] text-slate-400 italic">Cargando stock...</p>
          ) : stockAmplio ? (
            <StockAmplioIndicator stockAmplio={stockAmplio} size="sm" source={source} />
          ) : (
            <p className="text-[10px] text-slate-400 italic">Sin datos de stock</p>
          )}
        </div>
      )}
    </div>
  );
};
