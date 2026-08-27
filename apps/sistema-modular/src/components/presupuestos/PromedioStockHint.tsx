import type { PromedioCostoFactor } from '@ags/shared';

/**
 * Referencia de costeo al presupuestar un artículo de stock (2026-08-27):
 * costo y factor PROMEDIO ponderado del stock vivo — antes había que salir a
 * Unidades a buscarlo. El detalle por embarque vive en Importaciones.
 */
export const PromedioStockHint = ({ promedio }: { promedio: PromedioCostoFactor | null }) => {
  if (!promedio) return null;
  return (
    <p className="text-[10px] font-mono mt-1"
      title={`Promedio ponderado del stock actual (${promedio.unidades} unidad(es))${promedio.algunEstimado ? ' — incluye costeos estimados sin confirmar' : ''}`}>
      <span className="text-slate-400">Stock actual: </span>
      {promedio.costo != null && <span className="text-slate-600">costo prom. {promedio.moneda} {promedio.costo.toFixed(2)}</span>}
      {promedio.costo != null && promedio.factor != null && <span className="text-slate-300"> · </span>}
      {promedio.factor != null && (
        <span className={promedio.algunEstimado ? 'text-amber-600' : 'text-teal-700'}>
          factor prom. {promedio.factor.toFixed(3)}{promedio.algunEstimado ? ' (est.)' : ''}
        </span>
      )}
    </p>
  );
};
