import React from 'react';
import type { PresupuestoCuotaFacturacion, PresupuestoItem, MonedaPresupuesto } from '@ags/shared';
import { CuotasDelEsquemaSection } from './CuotasDelEsquemaSection';
import { OtsSinAsociarSection } from './OtsSinAsociarSection';

interface Props {
  presupuestoId: string;
  esquemaFacturacion: PresupuestoCuotaFacturacion[] | null | undefined;
  otsListasParaFacturar: string[];
  moneda: MonedaPresupuesto;
  itemsForTotals: PresupuestoItem[];
  onChanged: () => void;
  actor?: { uid: string; name?: string };
}

/**
 * Top-level facturación section — pure orchestration.
 *
 * Sub-section A (CuotasDelEsquemaSection): visible when esquema.length > 0.
 * Sub-section B (OtsSinAsociarSection): visible when:
 *   - No esquema (legacy mode) AND otsListas.length > 0, OR
 *   - Has esquema, all cuotas are terminal (facturada/cobrada), AND otsListas.length > 0 (saldo path).
 *
 * When neither condition is met, shows a neutral empty message.
 */
export const PresupuestoFacturacionSection: React.FC<Props> = ({
  presupuestoId,
  esquemaFacturacion,
  otsListasParaFacturar,
  moneda,
  itemsForTotals,
  onChanged,
  actor,
}) => {
  const esquema = esquemaFacturacion ?? [];
  const hasEsquema = esquema.length > 0;
  const allCuotasTerminal =
    hasEsquema &&
    esquema.every(c => c.estado === 'facturada' || c.estado === 'cobrada');

  // Sub-section B visible: no esquema (legacy) with OTs, OR esquema all-terminal with leftover OTs
  const showB =
    otsListasParaFacturar.length > 0 && (!hasEsquema || allCuotasTerminal);

  return (
    <section className="space-y-1">
      {hasEsquema && (
        <CuotasDelEsquemaSection
          presupuestoId={presupuestoId}
          esquema={esquema}
          moneda={moneda}
          itemsForTotals={itemsForTotals}
          otsListasParaFacturar={otsListasParaFacturar}
          onGenerated={() => onChanged()}
          actor={actor}
        />
      )}

      {showB && (
        <OtsSinAsociarSection
          presupuestoId={presupuestoId}
          otsListasParaFacturar={otsListasParaFacturar}
          currency={moneda}
          onGenerated={() => onChanged()}
          actor={actor}
        />
      )}

      {!hasEsquema && otsListasParaFacturar.length === 0 && (
        <p className="px-3 py-2 text-[10px] uppercase tracking-wide font-mono text-slate-400">
          Sin actividad de facturación.
        </p>
      )}
    </section>
  );
};
