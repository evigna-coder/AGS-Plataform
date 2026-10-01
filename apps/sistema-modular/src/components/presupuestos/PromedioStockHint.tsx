import type { PromedioCostoFactor } from '@ags/shared';
import type { CostoEnvase } from '../../utils/envasePresupuesto';

/**
 * Referencia de costeo al presupuestar un artículo de stock (2026-08-27):
 * costo y factor PROMEDIO ponderado del stock vivo — antes había que salir a
 * Unidades a buscarlo. El detalle por embarque vive en Importaciones.
 *
 * Por envase (2026-10-01): el costo es el del envase que se cotiza, tomado de
 * lo que ingresó en ese envase (el kit de 1000 sale más barato que 10 × 100).
 * Si nunca ingresó así, el promedio general multiplicado por el factor.
 */
export const PromedioStockHint = ({ promedio }: { promedio: PromedioCostoFactor | CostoEnvase | null }) => {
  if (!promedio) return null;
  const envase = 'factorEnvase' in promedio ? promedio : null;
  const porEnvase = !!envase && envase.factorEnvase > 1;
  const general = envase?.fuente === 'general';
  const titulo = [
    `Promedio ponderado del stock actual (${promedio.unidades} unidad(es) base)`,
    porEnvase ? `por envase de ${envase!.factorEnvase}` : null,
    general ? 'sin ingresos en este envase: promedio de todo el stock' : envase ? 'de lo que ingresó en este envase' : null,
    promedio.algunEstimado ? 'incluye costeos estimados sin confirmar' : null,
  ].filter(Boolean).join(' — ');
  return (
    <p className="text-[10px] font-mono mt-1" title={titulo}>
      <span className="text-slate-400">Stock actual: </span>
      {promedio.costo != null && (
        <span className="text-slate-600">
          costo prom.{porEnvase ? ` envase ×${envase!.factorEnvase}` : ''} {promedio.moneda} {promedio.costo.toFixed(2)}
          {general && <span className="text-slate-400"> (promedio general)</span>}
        </span>
      )}
      {promedio.costo != null && promedio.factor != null && <span className="text-slate-300"> · </span>}
      {promedio.factor != null && (
        <span className={promedio.algunEstimado ? 'text-amber-600' : 'text-teal-700'}>
          factor prom. {promedio.factor.toFixed(3)}{promedio.algunEstimado ? ' (est.)' : ''}
        </span>
      )}
    </p>
  );
};
