import { KpiCard } from '../../../pages/dashboard/components/KpiCard';
import { formatMonto, type ResumenPeriodo, type MontoPorMoneda } from '../../../utils/analitica/presupuestosMetrics';

interface Props {
  resumen: ResumenPeriodo;
  ocAdeudada: { count: number; monto: MontoPorMoneda };
  /** Rótulo del período activo (ej. "01/07 – 17/07" o "Histórico completo"). */
  periodoLabel: string;
  onEnviadosClick: () => void;
  onAceptadosClick: () => void;
  onOCAdeudadaClick: () => void;
}

const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

/** Fila de KPIs del período + OC adeudada (snapshot). Reusa KpiCard del dashboard. */
export const AnaliticaKpiRow: React.FC<Props> = ({
  resumen, ocAdeudada, periodoLabel, onEnviadosClick, onAceptadosClick, onOCAdeudadaClick,
}) => {
  const { enviados, aceptados, conversion, tiempoAprobacion, sinFechaEnvio } = resumen;
  return (
    <section>
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        Período: {periodoLabel}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiCard
          label="Enviados en el período"
          value={enviados.count}
          hint={
            <>
              {formatMonto(enviados.monto)}
              {sinFechaEnvio > 0 && (
                <span className="block text-amber-600">{sinFechaEnvio} sin fecha de envío (fuera del conteo)</span>
              )}
            </>
          }
          onClick={onEnviadosClick}
        />
        <KpiCard
          label="Aprobados en el período"
          value={aceptados.count}
          tone={aceptados.count > 0 ? 'positive' : 'default'}
          hint={
            <>
              {formatMonto(aceptados.monto)}
              {resumen.sinFechaAceptacion > 0 && (
                <span className="block text-amber-600">{resumen.sinFechaAceptacion} sin fecha de aceptación</span>
              )}
            </>
          }
          onClick={onAceptadosClick}
        />
        <KpiCard
          label="Conversión"
          value={conversion !== null ? fmtPct(conversion) : '—'}
          hint={`${aceptados.count} aprobados / ${enviados.count} enviados`}
        />
        <KpiCard
          label="Tiempo de aprobación"
          value={tiempoAprobacion.mediana !== null ? `${tiempoAprobacion.mediana}d` : '—'}
          hint={
            tiempoAprobacion.muestras > 0
              ? `Mediana · promedio ${tiempoAprobacion.promedio}d · ${tiempoAprobacion.muestras} muestras`
              : 'Sin aprobaciones con ambas fechas en el período'
          }
        />
        <KpiCard
          label="OC adeudadas (hoy)"
          value={ocAdeudada.count}
          tone={ocAdeudada.count > 0 ? 'danger' : 'positive'}
          hint={ocAdeudada.count > 0 ? formatMonto(ocAdeudada.monto) : 'Sin deudas de OC con servicio realizado'}
          onClick={onOCAdeudadaClick}
        />
      </div>
    </section>
  );
};
