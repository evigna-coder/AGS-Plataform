import { useMemo } from 'react';
import type { Presupuesto, SolicitudFacturacion, WorkOrder } from '@ags/shared';
import { presupuestoAceptadoVigente, MONEDA_SIMBOLO } from '@ags/shared';
import { getDaysUntilExpiry, getDaysSinceEnvio } from '../../utils/presupuestoHelpers';
import { otsDelPresupuesto } from '../../hooks/useControlSemanal';

/** Claves de filtro que dispara cada tarjeta KPI (UAT 2026-07-17: KPI = filtro). */
export type KpiFilter = '' | 'borradores' | 'enviados' | 'aceptados' | 'en_ejecucion' | 'fact_pendientes' | 'pend_cobro' | 'pendiente_aviso';

interface Props {
  presupuestos: Presupuesto[];
  solicitudes: SolicitudFacturacion[];
  /** TODAS las OTs (2026-08-06): necesarias para saber si un ppto ya tiene OT. */
  ots?: WorkOrder[];
  /** KPI activo como filtro de la lista ('' = ninguno). */
  activeKpi?: KpiFilter;
  /** Click en una tarjeta/indicador — el padre togglea el filtro. */
  onKpiClick?: (kpi: KpiFilter) => void;
  /** "Ver todos" (2026-08-05): limpia cards + estado — muestra todo. */
  onVerTodos?: () => void;
  verTodosActivo?: boolean;
}

const OT_CERRADA_SET = new Set(['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO']);

export const PresupuestoDashboard: React.FC<Props> = ({ presupuestos, solicitudes, ots = [], activeKpi = '', onKpiClick, onVerTodos, verTodosActivo = false }) => {
  const metrics = useMemo(() => {
    // Borradores (2026-08-19): sin card no se veían en ningún lado. Es el
    // primer eslabón del circuito y donde caen los pedidos del portal que
    // todavía nadie cotizó.
    const borradores = presupuestos.filter(p => p.estado === 'borrador');
    // Los que NO se pueden descartar: su OT ya cerró, la parte quedó instalada.
    const borradoresConTrabajo = borradores.filter(p => {
      const vinculadas = new Set(p.otsVinculadasNumbers ?? []);
      return ots.some(ot => OT_CERRADA_SET.has(ot.estadoAdmin ?? '')
        && ((ot.budgets ?? []).includes(p.numero) || vinculadas.has(ot.otNumber)));
    });
    const enviados = presupuestos.filter(p => p.estado === 'enviado');
    // Solo los que siguen EN la etapa aceptado: los que ya arrancaron van a la
    // card "En ejecución" y contarlos acá duplicaba (2026-08-09).
    const aceptados = presupuestos.filter(p => presupuestoAceptadoVigente(p.estado));

    // En ejecución (2026-08-18). Antes no tenía card: un ppto que arrancaba
    // desaparecía de "Aceptados" y no aparecía en ningún otro lado, así que
    // para encontrarlo había que pelear con el desplegable de estado. Son
    // aceptados igual — lo que cambia es que el trabajo ya empezó.
    const enEjecucion = presupuestos.filter(p => p.estado === 'en_ejecucion');
    // Monto POR MONEDA, igual que el pipeline de enviados: sumar USD y ARS en un
    // solo número daría un total que no existe (2026-08-19).
    const montoEnEjecucion: Record<string, number> = {};
    enEjecucion.forEach(p => {
      const m = p.moneda || 'USD';
      montoEnEjecucion[m] = (montoEnEjecucion[m] || 0) + (p.total || 0);
    });

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

    // Aceptados sin OT creada. Antes miraba SOLO el campo legacy
    // `otVinculadaNumber` (2026-08-06): un ppto con OTs creadas desde el propio
    // presupuesto — que se vinculan por `budgets` — figuraba "sin OT creada"
    // para siempre (P1-005046-01 con 4 OTs). Ahora usa el mismo join que el
    // control semanal y el KPI de OTs, con herencia padre→hijas.
    const aceptadosSinOT = aceptados.filter(p => otsDelPresupuesto(p, ots).size === 0);

    // Aceptados CON TRABAJO REALIZADO y sin aviso a facturación (2026-08-06).
    // Antes contaba todo aceptado sin solicitud: un ppto recién aceptado, con
    // las OTs sin hacer, figuraba "sin facturar" — ruido, no acción. Ahora pide
    // al menos una OT cerrada técnicamente: ahí sí falta facturar.
    const solicitadoIds = new Set(solicitudes.filter(s => s.estado !== 'anulada').map(s => s.presupuestoId));
    const estadoPorOt = new Map(ots.map(o => [o.otNumber, o.estadoAdmin ?? '']));
    const OT_CERRADA = new Set(['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO']);
    const aceptadosSinFacturar = aceptados.filter(p => {
      if (solicitadoIds.has(p.id)) return false;
      return [...otsDelPresupuesto(p, ots)].some(n => OT_CERRADA.has(estadoPorOt.get(n) ?? ''));
    });

    // OT cerrada lista para facturar pero SIN aviso a facturación generado
    // (UAT 2026-07-17: el estado dice "pendiente de facturación" pero lo que
    // falta es el aviso — hay que mostrarlo explícito).
    const pendientesAviso = presupuestos.filter(p =>
      p.estado === 'pendiente_facturacion' && !solicitadoIds.has(p.id));

    // Solicitudes pendientes de facturación
    const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente');

    // Pendientes de cobro (2026-08-18): PRESUPUESTOS con al menos una factura
    // emitida y sin cobrar. Es una pregunta de PLATA, no de trabajo.
    //
    // Dos intentos previos fallaron por mirar el eje equivocado: contar
    // solicitudes duplicaba el módulo Facturación dentro del listado; contar
    // presupuestos en estado 'facturado' dejaba afuera los ANTICIPOS —
    // facturados con el trabajo todavía en curso, así que su presupuesto sigue
    // 'en_ejecucion'— que son justamente los que hay que perseguir.
    const facturadasSinCobrar = solicitudes.filter(s => s.estado === 'facturada');
    const idsConFacturaAbierta = new Set(facturadasSinCobrar.map(s => s.presupuestoId));
    const facturadosSinCobrar = presupuestos.filter(p => idsConFacturaAbierta.has(p.id));
    const montoSinCobrar = facturadasSinCobrar.reduce((acc, s) => acc + (s.montoTotal ?? 0), 0);

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
      pendientesAviso,
      solicitudesPendientes,
      facturadosSinCobrar,
      montoSinCobrar,
      pipeline,
      enEjecucion,
      montoEnEjecucion,
      borradores,
      borradoresConTrabajo,
    };
  }, [presupuestos, solicitudes]);

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
    <div className="grid grid-cols-[0.42fr_repeat(6,minmax(0,1fr))] gap-1.5 px-5 pb-3">
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
        {(metrics.enviadosSinRespuesta.length > 0 || metrics.enviadosVencidos.length > 0 || fmtPipeline(metrics.pipeline)) && (
          <div className="space-y-0 mt-0.5">
            {metrics.enviadosSinRespuesta.length > 0 && (
              <p className="text-[9px] text-amber-600 truncate">{metrics.enviadosSinRespuesta.length} sin respuesta</p>
            )}
            {metrics.enviadosVencidos.length > 0 && (
              <p className="text-[9px] text-red-600 truncate">{metrics.enviadosVencidos.length} vencidos</p>
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
            {metrics.solicitudesPendientes.reduce((s, x) => s + x.montoTotal, 0).toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
            {' '}esperando factura
          </p>
        )}
        {metrics.pendientesAviso.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); toggle('pendiente_aviso'); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggle('pendiente_aviso'); } }}
            className={`block text-[9px] mt-0.5 text-orange-600 hover:underline truncate ${activeKpi === 'pendiente_aviso' ? 'font-semibold underline' : ''}`}
            title="OT cerrada lista para facturar, pero el aviso a facturación no se generó todavía"
          >
            ⚠ {metrics.pendientesAviso.length} sin aviso
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
          <p className="text-[9px] text-slate-400 mt-0.5 truncate">
            {metrics.montoSinCobrar.toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
          </p>
        )}
      </button>
    </div>
  );
};
