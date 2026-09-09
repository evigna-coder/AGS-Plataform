import { useMemo } from 'react';
import { sumarPorMoneda, fmtPorMoneda } from '../../utils/montosPorMoneda';
import type { Presupuesto, SolicitudFacturacion, WorkOrder } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { usePresupuestoDashboardMetrics } from '../../hooks/usePresupuestoDashboardMetrics';

/** Claves de filtro que dispara cada tarjeta KPI (UAT 2026-07-17: KPI = filtro). */
export type KpiFilter = '' | 'borradores' | 'enviados' | 'aceptados' | 'en_ejecucion' | 'a_certificar' | 'fact_pendientes' | 'pend_cobro' | 'pendiente_aviso' | 'vencidos';

interface Props {
  presupuestos: Presupuesto[];
  solicitudes: SolicitudFacturacion[];
  /** TODAS las OTs (2026-08-06): necesarias para saber si un ppto ya tiene OT. */
  ots?: WorkOrder[];
  /** Universo completo, sin filtro de solapa, para el total "Por cobrar" (2026-09-08). */
  presupuestosTodos?: Presupuesto[];
  solicitudesTodas?: SolicitudFacturacion[];
  /** KPI activo como filtro de la lista ('' = ninguno). */
  activeKpi?: KpiFilter;
  /** Click en una tarjeta/indicador — el padre togglea el filtro. */
  onKpiClick?: (kpi: KpiFilter) => void;
  /** "Ver todos" (2026-08-05): limpia cards + estado — muestra todo. */
  onVerTodos?: () => void;
  verTodosActivo?: boolean;
}

export const PresupuestoDashboard: React.FC<Props> = ({ presupuestos, solicitudes, ots = [], presupuestosTodos, solicitudesTodas, activeKpi = '', onKpiClick, onVerTodos, verTodosActivo = false }) => {
  const todos = useMemo(
    () => (presupuestosTodos && solicitudesTodas ? { presupuestos: presupuestosTodos, solicitudes: solicitudesTodas } : undefined),
    [presupuestosTodos, solicitudesTodas]);
  const metrics = usePresupuestoDashboardMetrics(presupuestos, solicitudes, ots, todos);

  const fmtPipeline = (map: Record<string, number>) =>
    Object.entries(map).filter(([, v]) => v > 0)
      .map(([m, v]) => `${MONEDA_SIMBOLO[m as keyof typeof MONEDA_SIMBOLO] || '$'} ${v.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`)
      .join(' · ');

  const toggle = (kpi: KpiFilter) => onKpiClick?.(kpi);
  // `h-full` + grid con columnas iguales = todas del mismo alto y ancho, en una
  // sola línea. Al sumar Borradores pasaron a ser 7 (2026-08-19): se achicaron
  // padding, gap y cuerpo del número para que sigan entrando sin envolver.
  const cardCls = (kpi: KpiFilter) =>
    `h-full bg-white border rounded-lg px-1.5 py-1 text-left w-full transition-colors overflow-hidden ${
      activeKpi === kpi
        ? 'border-teal-500 ring-1 ring-teal-500 bg-teal-50/30'
        : 'border-slate-200 hover:border-teal-300'
    }`;

  // Compactas (UAT 2026-07-18): label y número en una línea; el detalle solo
  // aparece cuando hay contenido — con ceros la fila queda de una sola línea.
  return (
    <div className="px-5 pb-3">
    <div className="grid grid-cols-[0.42fr_repeat(6,minmax(0,1fr))] gap-1.5">
      {/* Ver todos (2026-08-05): limpia el drill-down de cards Y el filtro de
          estado — las cards "tapaban" al desplegable y no había cómo salir. */}
      <button type="button" onClick={onVerTodos}
        className={`h-full bg-white border rounded-lg px-1.5 py-1 text-left w-full transition-colors ${
          verTodosActivo ? 'border-teal-500 ring-1 ring-teal-500 bg-teal-50/30' : 'border-slate-200 hover:border-teal-300'
        }`}
        title="Quitar filtros de cards y estado — ver todos los presupuestos">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide truncate">Todos</p>
        <p className="text-sm font-black text-slate-700 leading-none mt-0.5">{presupuestos.length}</p>
      </button>

      {/* Borradores: el primer eslabón — sin card, invisibles (2026-08-19). */}
      <button type="button" className={cardCls('borradores')} onClick={() => toggle('borradores')}
        title="Filtrar la lista por presupuestos en borrador — falta cotizarlos o enviarlos">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide truncate">Borradores</p>
          <p className="text-sm font-black text-slate-600 leading-none">{metrics.borradores.length}</p>
        </div>
        {metrics.borradoresConTrabajo.length > 0 ? (
          <p className="text-[9px] text-amber-700 mt-0.5 truncate"
            title="Su OT ya cerró: el trabajo se hizo y hay que cotizarlos sí o sí">
            {metrics.borradoresConTrabajo.length} con trabajo hecho
          </p>
        ) : (
          <p className="text-[9px] text-slate-400 mt-0.5 truncate">sin enviar</p>
        )}
      </button>

      {/* Enviados */}
      <button type="button" className={cardCls('enviados')} onClick={() => toggle('enviados')}
        title="Filtrar la lista por presupuestos enviados">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide truncate">Enviados</p>
          <p className="text-sm font-black text-blue-600 leading-none">{metrics.enviadosTotal}</p>
        </div>
        {metrics.enviadosConTrabajo.length > 0 && (
          <p className="text-[9px] text-amber-700 font-semibold truncate"
            title="Enviados cuya OT ya cerró: la parte quedó instalada, hay que conseguir la aceptación">
            {metrics.enviadosConTrabajo.length} con trabajo hecho
          </p>
        )}
        {(metrics.enviadosSinRespuesta.length > 0 || metrics.enviadosVencidos.length > 0 || fmtPipeline(metrics.pipeline)) && (
          <div className="space-y-0 mt-0.5">
            {metrics.enviadosSinRespuesta.length > 0 && (
              <p className="text-[9px] text-amber-600 truncate">{metrics.enviadosSinRespuesta.length} sin respuesta</p>
            )}
            {metrics.enviadosVencidos.length > 0 && (
              /* Clickeable (2026-08-21): el conteo existía pero no filtraba, así
                 que los vencidos solo se veían cazando filas rojas a ojo. */
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggle('vencidos'); }}
                title="Ver solo los presupuestos vencidos"
                className={`text-[9px] truncate text-left w-full hover:underline ${
                  activeKpi === 'vencidos' ? 'text-red-700 font-bold' : 'text-red-600'}`}
              >
                {metrics.enviadosVencidos.length} vencidos
              </button>
            )}
            {fmtPipeline(metrics.pipeline) && (
              <p className="text-[9px] text-slate-400 truncate">{fmtPipeline(metrics.pipeline)}</p>
            )}
          </div>
        )}
      </button>

      {/* Aceptados */}
      <button type="button" className={cardCls('aceptados')} onClick={() => toggle('aceptados')}
        title="Filtrar la lista por presupuestos aceptados">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide truncate">Aceptados</p>
          <p className="text-sm font-black text-emerald-600 leading-none">{metrics.aceptadosTotal}</p>
        </div>
        {(metrics.aceptadosSinOT.length > 0 || metrics.aceptadosSinFacturar.length > 0) && (
          <div className="space-y-0 mt-0.5">
            {metrics.aceptadosSinOT.length > 0 && (
              <p className="text-[9px] text-amber-600 truncate">{metrics.aceptadosSinOT.length} sin OT</p>
            )}
            {metrics.aceptadosSinFacturar.length > 0 && (
              <p className="text-[9px] text-orange-600 truncate">{metrics.aceptadosSinFacturar.length} sin facturar</p>
            )}
          </div>
        )}
      </button>

      {/* En ejecución: aceptados con el trabajo ya arrancado (2026-08-18). */}
      <button type="button" className={cardCls('en_ejecucion')} onClick={() => toggle('en_ejecucion')}
        title="Filtrar la lista por presupuestos en ejecución — aceptados con el trabajo iniciado">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide truncate">En ejecución</p>
          <p className="text-sm font-black text-teal-600 leading-none">{metrics.enEjecucion.length}</p>
        </div>
        <p className="text-[9px] text-slate-400 mt-0.5 truncate"
          title={fmtPipeline(metrics.montoEnEjecucion) || 'Sin monto cargado'}>
          {fmtPipeline(metrics.montoEnEjecucion) || 'trabajo iniciado'}
        </p>
      </button>

      {/* Enviadas a facturación: avisos generados, esperando que Administración
          cargue la factura (solicitud estado 'pendiente'). */}
      <button type="button" className={cardCls('fact_pendientes')} onClick={() => toggle('fact_pendientes')}
        title="Filtrar la lista por presupuestos enviados a facturación (aviso generado, factura sin cargar)">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide truncate">A facturar</p>
          <p className="text-sm font-black text-amber-600 leading-none">{metrics.solicitudesPendientes.length}</p>
        </div>
        {metrics.solicitudesPendientes.length > 0 && (
          <p className="text-[9px] text-slate-400 mt-0.5 truncate"
            title="Esperando que Administración cargue la factura">
            {fmtPorMoneda(sumarPorMoneda(metrics.solicitudesPendientes), 0)}
            {' '}esperando factura
          </p>
        )}
        {/* Certificaciones (2026-09-08): esperando papel del cliente, y papel
            recibido sin aviso. Van acá y no en una card propia — pedido del
            user: menos cards, y el monto se lee en la franja de abajo. */}
        {metrics.aCertificar.presupuestos.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); toggle('a_certificar'); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggle('a_certificar'); } }}
            className={`block text-[9px] mt-0.5 text-sky-700 hover:underline truncate ${activeKpi === 'a_certificar' ? 'font-semibold underline' : ''}`}
            title={`${metrics.aCertificar.otsRetenidas} OT cerradas esperando la certificación del cliente · ${fmtPorMoneda(metrics.aCertificar.monto, 0)} — click para filtrar`}
          >
            ⏳ {metrics.aCertificar.presupuestos.length} a certificar
          </span>
        )}
        {metrics.certificadasSinAviso.otsRetenidas > 0 && (
          <p className="text-[9px] mt-0.5 text-orange-600 truncate"
            title={`Papel del cliente recibido, aviso a facturación sin generar · ${fmtPorMoneda(metrics.certificadasSinAviso.monto, 0)}`}>
            ✓ {metrics.certificadasSinAviso.otsRetenidas} certificadas sin aviso
          </p>
        )}
        {metrics.pendientesAviso.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); toggle('pendiente_aviso'); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggle('pendiente_aviso'); } }}
            className={`block text-[9px] mt-0.5 text-orange-600 hover:underline truncate ${activeKpi === 'pendiente_aviso' ? 'font-semibold underline' : ''}`}
            title="Presupuestos con las OTs ya cerradas y el aviso a facturación sin generar — click para filtrarlos"
          >
            ⚠ {metrics.pendientesAviso.length} OT cerradas sin aviso
          </span>
        )}
      </button>

      {/* Cobro pendiente */}
      <button type="button" className={cardCls('pend_cobro')} onClick={() => toggle('pend_cobro')}
        title="Filtrar la lista por presupuestos facturados pendientes de cobro">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide truncate">Pend. cobro</p>
          <p className="text-sm font-black text-purple-600 leading-none">{metrics.facturadosSinCobrar.length}</p>
        </div>
        {metrics.facturadosSinCobrar.length > 0 && (
          <p className="text-[9px] text-slate-400 mt-0.5 truncate" title={`Facturado sin cobrar: ${fmtPorMoneda(metrics.montoSinCobrar)}`}>
            {fmtPorMoneda(metrics.montoSinCobrar, 0)} facturado
          </p>
        )}
        {/* Por cobrar (2026-09-08): TODO lo hecho y no cobrado — a certificar +
            certificado sin aviso + a facturar + facturado sin cobrar —, de la
            empresa entera (contratos + comercial), por moneda. Va dentro de la
            card, a pedido del user: sin franja aparte. */}
        {fmtPorMoneda(metrics.porCobrarTotal, 0) && (
          <p className="text-[9px] text-purple-700 mt-0.5 truncate"
            title={`Por cobrar en total (contratos + comercial): a certificar ${fmtPorMoneda(metrics.aCertificar.monto, 0) || '—'} · certificado sin aviso ${fmtPorMoneda(metrics.certificadasSinAviso.monto, 0) || '—'} · a facturar ${fmtPorMoneda(sumarPorMoneda(metrics.solicitudesPendientes), 0) || '—'} · facturado sin cobrar ${fmtPorMoneda(metrics.montoSinCobrar, 0) || '—'}${fmtPorMoneda(metrics.porCobrar, 0) !== fmtPorMoneda(metrics.porCobrarTotal, 0) ? ` · esta solapa: ${fmtPorMoneda(metrics.porCobrar, 0) || '—'}` : ''}`}>
            Σ por cobrar {fmtPorMoneda(metrics.porCobrarTotal, 0)}
          </p>
        )}
      </button>
    </div>
    </div>
  );
};

