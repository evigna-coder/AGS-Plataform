import React, { useState } from 'react';
import type { PresupuestoCuotaFacturacion, PresupuestoItem, MonedaPresupuesto, MonedaCuota } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { computeTotalsByCurrency } from '../../utils/cuotasFacturacion';
import { GenerarSolicitudCuotaModal } from './GenerarSolicitudCuotaModal';

const HITO_LABELS: Record<string, string> = {
  ppto_aceptado: 'Ppto. aceptado',
  oc_recibida: 'OC recibida',
  pre_embarque: 'Pre-embarque',
  todas_ots_cerradas: 'Todas las OTs cerradas',
  manual: 'Manual',
};

const ESTADO_BADGE: Record<string, { label: string; classes: string }> = {
  pendiente:   { label: 'Esperando hito',  classes: 'bg-slate-100 text-slate-500' },
  habilitada:  { label: 'Habilitada',      classes: 'bg-teal-100 text-teal-800' },
  solicitada:  { label: 'Solicitada',      classes: 'bg-blue-100 text-blue-800' },
  facturada:   { label: 'Facturada',       classes: 'bg-green-100 text-green-800' },
  cobrada:     { label: 'Cobrada',         classes: 'bg-emerald-100 text-emerald-800' },
};

interface Props {
  presupuestoId: string;
  esquema: PresupuestoCuotaFacturacion[];
  moneda: MonedaPresupuesto;
  itemsForTotals: PresupuestoItem[];
  otsListasParaFacturar: string[];
  onGenerated: (solicitudId: string) => void;
  actor?: { uid: string; name?: string };
}

export const CuotasDelEsquemaSection: React.FC<Props> = ({
  presupuestoId,
  esquema,
  moneda,
  itemsForTotals,
  otsListasParaFacturar,
  onGenerated,
  actor,
}) => {
  const [modalState, setModalState] = useState<{ open: boolean; cuota: PresupuestoCuotaFacturacion | null }>({
    open: false,
    cuota: null,
  });

  const totalsByCurrency = computeTotalsByCurrency(itemsForTotals, moneda);

  // Compute Sigma facturado per active moneda for the summary header
  const monedasActivas = Array.from(
    new Set(esquema.flatMap(c => Object.keys(c.porcentajePorMoneda ?? {})))
  ) as MonedaCuota[];

  const sigmaFacturado = (m: MonedaCuota) =>
    esquema.reduce((acc, c) => acc + (c.porcentajePorMoneda?.[m] ?? 0), 0);

  return (
    <div className="p-3 space-y-3">
      {/* Section header + sigma summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 font-mono">
          Cuotas del esquema
        </h3>
        <div className="flex gap-3">
          {monedasActivas.map(m => {
            const sigma = sigmaFacturado(m);
            return (
              <span
                key={m}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${sigma === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
              >
                {m}: {sigma}%
              </span>
            );
          })}
        </div>
      </div>

      {/* Cuota cards */}
      <div className="space-y-2">
        {esquema.map(cuota => {
          const badge = ESTADO_BADGE[cuota.estado] ?? ESTADO_BADGE.pendiente;
          const isTerminal = ['solicitada', 'facturada', 'cobrada'].includes(cuota.estado);
          const solicitudPath = cuota.solicitudFacturacionId
            ? `/facturacion/${cuota.solicitudFacturacionId}`
            : null;

          return (
            <div
              key={cuota.id}
              data-testid={`cuota-card-${cuota.numero}`}
              className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Left: cuota info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400">
                      Cuota {cuota.numero}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.classes}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium truncate">{cuota.descripcion}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Hito: {HITO_LABELS[cuota.hito] ?? cuota.hito}
                    </span>
                    {monedasActivas.map(m => {
                      const pct = cuota.porcentajePorMoneda?.[m];
                      if (!pct) return null;
                      return (
                        <span key={m} className="text-[10px] font-mono text-slate-500">
                          {m}: {pct}%
                          {totalsByCurrency[m] ? ` (${MONEDA_SIMBOLO[m] ?? '$'} ${(pct / 100 * (totalsByCurrency[m] ?? 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })})` : ''}
                        </span>
                      );
                    })}
                  </div>
                  {/* Monto facturado if set */}
                  {cuota.montoFacturadoPorMoneda && (
                    <div className="flex gap-2 flex-wrap pt-0.5">
                      {Object.entries(cuota.montoFacturadoPorMoneda).map(([m, v]) => (
                        <span key={m} className="text-[10px] font-mono text-teal-700">
                          Facturado: {MONEDA_SIMBOLO[m] ?? '$'} {(v as number).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: action button */}
                <div className="flex-shrink-0">
                  {cuota.estado === 'pendiente' && (
                    <button
                      disabled
                      className="px-3 py-1.5 text-[11px] rounded bg-slate-100 text-slate-400 cursor-not-allowed font-medium"
                    >
                      Esperando hito
                    </button>
                  )}
                  {cuota.estado === 'habilitada' && (
                    <button
                      data-testid={`cuota-generar-${cuota.numero}`}
                      onClick={() => setModalState({ open: true, cuota })}
                      className="px-3 py-1.5 text-[11px] rounded bg-teal-700 text-white hover:bg-teal-800 transition-colors font-medium"
                    >
                      Generar solicitud
                    </button>
                  )}
                  {isTerminal && solicitudPath && (
                    <a
                      href={solicitudPath}
                      className="px-3 py-1.5 text-[11px] rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium inline-block"
                    >
                      Ver solicitud
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini-modal for generating cuota solicitud */}
      {modalState.open && modalState.cuota && (
        <GenerarSolicitudCuotaModal
          open={modalState.open}
          cuota={modalState.cuota}
          presupuestoId={presupuestoId}
          itemsForTotals={itemsForTotals}
          pptoMoneda={moneda}
          otsListasParaFacturar={otsListasParaFacturar}
          onClose={() => setModalState({ open: false, cuota: null })}
          onGenerated={(solicitudId) => {
            setModalState({ open: false, cuota: null });
            onGenerated(solicitudId);
          }}
          actor={actor}
        />
      )}
    </div>
  );
};
