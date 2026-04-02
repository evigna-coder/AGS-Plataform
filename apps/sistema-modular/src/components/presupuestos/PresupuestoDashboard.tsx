import { useMemo } from 'react';
import type { Presupuesto, SolicitudFacturacion } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { getDaysUntilExpiry, getDaysSinceEnvio } from '../../utils/presupuestoHelpers';

interface Props {
  presupuestos: Presupuesto[];
  solicitudes: SolicitudFacturacion[];
}

export const PresupuestoDashboard: React.FC<Props> = ({ presupuestos, solicitudes }) => {
  const metrics = useMemo(() => {
    const enviados = presupuestos.filter(p => p.estado === 'enviado');
    const aceptados = presupuestos.filter(p => p.estado === 'aceptado');

    // Enviados sin respuesta (> 7 días)
    const enviadosSinRespuesta = enviados.filter(p => {
      const days = getDaysSinceEnvio(p.fechaEnvio);
      return days !== null && days > 7;
    });

    // Enviados vencidos (pasó la validez)
    const enviadosVencidos = enviados.filter(p => {
      const days = getDaysUntilExpiry(p.validUntil, p.fechaEnvio, p.validezDias);
      return days !== null && days < 0;
    });

    // Aceptados sin OT creada
    const aceptadosSinOT = aceptados.filter(p => !p.otVinculadaNumber);

    // Aceptados sin facturar (no tienen solicitud de facturación)
    const solicitadoIds = new Set(solicitudes.filter(s => s.estado !== 'anulada').map(s => s.presupuestoId));
    const aceptadosSinFacturar = aceptados.filter(p => !solicitadoIds.has(p.id));

    // Solicitudes pendientes de facturación
    const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente');

    // Solicitudes facturadas pendientes de cobro
    const facturadosSinCobrar = solicitudes.filter(s => s.estado === 'facturada');

    // Monto pipeline por moneda
    const pipeline: Record<string, number> = {};
    enviados.forEach(p => {
      const m = p.moneda || 'USD';
      pipeline[m] = (pipeline[m] || 0) + (p.total || 0);
    });

    return {
      enviadosTotal: enviados.length,
      enviadosSinRespuesta,
      enviadosVencidos,
      aceptadosTotal: aceptados.length,
      aceptadosSinOT,
      aceptadosSinFacturar,
      solicitudesPendientes,
      facturadosSinCobrar,
      pipeline,
    };
  }, [presupuestos, solicitudes]);

  const fmtPipeline = (map: Record<string, number>) =>
    Object.entries(map).filter(([, v]) => v > 0)
      .map(([m, v]) => `${MONEDA_SIMBOLO[m as keyof typeof MONEDA_SIMBOLO] || '$'} ${v.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`)
      .join(' · ');

  return (
    <div className="grid grid-cols-4 gap-2 px-5 pb-3">
      {/* Enviados */}
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">Enviados</p>
        <p className="text-lg font-black text-blue-600">{metrics.enviadosTotal}</p>
        <div className="space-y-0.5 mt-1">
          {metrics.enviadosSinRespuesta.length > 0 && (
            <p className="text-[10px] text-amber-600">{metrics.enviadosSinRespuesta.length} sin respuesta (&gt;7d)</p>
          )}
          {metrics.enviadosVencidos.length > 0 && (
            <p className="text-[10px] text-red-600">{metrics.enviadosVencidos.length} vencidos</p>
          )}
          {fmtPipeline(metrics.pipeline) && (
            <p className="text-[10px] text-slate-400 mt-1">{fmtPipeline(metrics.pipeline)}</p>
          )}
        </div>
      </div>

      {/* Aceptados */}
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">Aceptados</p>
        <p className="text-lg font-black text-emerald-600">{metrics.aceptadosTotal}</p>
        <div className="space-y-0.5 mt-1">
          {metrics.aceptadosSinOT.length > 0 && (
            <p className="text-[10px] text-amber-600">{metrics.aceptadosSinOT.length} sin OT creada</p>
          )}
          {metrics.aceptadosSinFacturar.length > 0 && (
            <p className="text-[10px] text-orange-600">{metrics.aceptadosSinFacturar.length} sin facturar</p>
          )}
        </div>
      </div>

      {/* Facturación pendiente */}
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">Fact. pendientes</p>
        <p className="text-lg font-black text-amber-600">{metrics.solicitudesPendientes.length}</p>
        {metrics.solicitudesPendientes.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1">
            {metrics.solicitudesPendientes.reduce((s, x) => s + x.montoTotal, 0).toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
          </p>
        )}
      </div>

      {/* Cobro pendiente */}
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">Pend. cobro</p>
        <p className="text-lg font-black text-purple-600">{metrics.facturadosSinCobrar.length}</p>
        {metrics.facturadosSinCobrar.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1">
            {metrics.facturadosSinCobrar.reduce((s, x) => s + x.montoTotal, 0).toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
          </p>
        )}
      </div>
    </div>
  );
};
