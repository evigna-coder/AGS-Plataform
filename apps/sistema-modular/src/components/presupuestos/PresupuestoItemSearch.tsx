import { useMemo } from 'react';
import type { Articulo, ConceptoServicio } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { StockAmplioIndicator } from '../stock/StockAmplioIndicator';
import { useStockAmplio } from '../../hooks/useStockAmplio';
import { itemRequiresImportacion } from '../../services/atpHelpers';

interface Props {
  /** Servicios del catálogo (se listan los activos). */
  conceptos: ConceptoServicio[];
  /** Artículos de stock (vacío si el tipo de ppto no los usa). */
  articulos: Articulo[];
  /** Artículo actualmente ligado al item (para el valor y el indicador de stock). */
  stockArticuloId: string | null;
  /** Concepto de servicio actualmente ligado al item (para el valor). */
  conceptoServicioId: string | null;
  onSelectConcepto: (conceptoId: string) => void;
  onSelectArticulo: (art: Articulo | null, meta: { itemRequiereImportacion: boolean }) => void;
  /** Limpiar la vinculación (carga manual). */
  onClear: () => void;
}

/**
 * Buscador UNIFICADO del presupuestador: servicios y artículos de stock en un mismo
 * campo, en vez de dos pickers separados. Los valores se prefijan `srv:`/`art:` para
 * enrutar al handler correcto. Debajo muestra el stock del artículo elegido.
 */
export const PresupuestoItemSearch: React.FC<Props> = ({
  conceptos, articulos, stockArticuloId, conceptoServicioId,
  onSelectConcepto, onSelectArticulo, onClear,
}) => {
  const options = useMemo(() => [
    { value: '', label: 'Carga manual…' },
    ...conceptos.filter(c => c.activo).map(c => ({
      value: `srv:${c.id}`,
      label: `Servicio · ${c.codigo ? `[${c.codigo}] ` : ''}${c.descripcion}`,
      subLabel: `${MONEDA_SIMBOLO[c.moneda]} ${(c.valorBase * c.factorActualizacion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      linkedCode: c.codigo || undefined,
    })),
    ...articulos.map(a => ({
      value: `art:${a.id}`,
      label: `Artículo · [${a.codigo || '—'}] ${a.descripcion}`,
      linkedCode: a.codigo || undefined,
    })),
  ], [conceptos, articulos]);

  const { stockAmplio, loading, source } = useStockAmplio(stockArticuloId);

  const value = stockArticuloId ? `art:${stockArticuloId}` : (conceptoServicioId ? `srv:${conceptoServicioId}` : '');

  const handleChange = async (v: string) => {
    if (!v) { onClear(); return; }
    if (v.startsWith('srv:')) { onSelectConcepto(v.slice(4)); return; }
    if (v.startsWith('art:')) {
      const art = articulos.find(a => a.id === v.slice(4));
      if (!art) return;
      let requiere = false;
      try { requiere = await itemRequiresImportacion(art.id); } catch { requiere = false; }
      onSelectArticulo(art, { itemRequiereImportacion: requiere });
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Buscar servicio o artículo</label>
      <SearchableSelect
        value={value}
        onChange={(v) => { void handleChange(v); }}
        options={options}
        placeholder="Buscar por código o descripción (servicios y artículos)…"
      />
      {stockArticuloId && (
        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
          {loading ? (
            <p className="text-[10px] text-slate-400 italic">Cargando stock…</p>
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
