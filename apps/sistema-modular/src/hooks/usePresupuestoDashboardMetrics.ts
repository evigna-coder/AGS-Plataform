import { useMemo } from 'react';
import type { Presupuesto, SolicitudFacturacion, WorkOrder } from '@ags/shared';
import { presupuestoAceptadoVigente } from '@ags/shared';
import { getDaysSinceEnvio, isExpired } from '../utils/presupuestoHelpers';
import { otsDelPresupuesto } from './useControlSemanal';
import { sumarPorMoneda } from '../utils/montosPorMoneda';
import { computeACertificar, computeCertificadasSinAviso, computePorCobrar } from '../utils/analitica/porCobrar';

const OT_CERRADA_SET = new Set(['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO']);

/**
 * Métricas de las cards del listado de presupuestos. Extraído de
 * `PresupuestoDashboard` (2026-09-08) al sumar "A certificar" y "Por cobrar":
 * el componente ya pasaba las 300 líneas.
 */
export function usePresupuestoDashboardMetrics(
  presupuestos: Presupuesto[],
  solicitudes: SolicitudFacturacion[],
  ots: WorkOrder[],
  /** Universo COMPLETO (todas las solapas) para el total "Por cobrar" (2026-09-08). */
  todos?: { presupuestos: Presupuesto[]; solicitudes: SolicitudFacturacion[] },
) {
  return useMemo(() => {
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
    // Enviados con la OT ya cerrada (2026-09-09): no se pueden dejar vencer.
    const enviadosConTrabajo = enviados.filter(p => {
      const vinculadas = new Set(p.otsVinculadasNumbers ?? []);
      return ots.some(ot => OT_CERRADA_SET.has(ot.estadoAdmin ?? '')
        && ((ot.budgets ?? []).includes(p.numero) || vinculadas.has(ot.otNumber)));
    });
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

    // Vencidos: pasó la validez y todavía es pre-aceptación (2026-08-21).
    //
    // Antes contaba solo entre los ENVIADOS, pero el filtro de la lista usa
    // `isExpired`, que abarca también `pendiente_oc`. Con dos universos
    // distintos el contador decía 1 y el filtro mostraba otra cantidad.
    // Se usa el mismo helper que la lista para que número y filtro coincidan.
    const enviadosVencidos = presupuestos.filter(isExpired);

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

    // OT cerradas SIN aviso a facturación (ampliado 2026-08-27, caso
    // P2-005103-01): además de los que ya están en 'pendiente_facturacion',
    // cuenta los aceptados (pendiente_oc / aceptado / en_ejecucion) cuyas OTs
    // están TODAS cerradas administrativamente — el trabajo terminó y nadie
    // avisó. Antes esos quedaban invisibles salvo mirando "todos".
    const ACEPTADO_FAM = new Set(['pendiente_oc', 'aceptado', 'en_ejecucion']);
    const OT_CERRADA_ADMIN = new Set(['CIERRE_ADMINISTRATIVO', 'FINALIZADO']);
    const pendientesAviso = presupuestos.filter(p => {
      if (solicitadoIds.has(p.id)) return false;
      if (p.estado === 'pendiente_facturacion') return true;
      if (!ACEPTADO_FAM.has(p.estado)) return false;
      const estados = [...otsDelPresupuesto(p, ots)]
        .map(n => estadoPorOt.get(n))
        .filter((e): e is string => e !== undefined);
      return estados.length > 0 && estados.every(e => OT_CERRADA_ADMIN.has(e));
    });

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
    // Por moneda (2026-09-08): antes sumaba pesos y dólares y lo rotulaba USD.
    const montoSinCobrar = sumarPorMoneda(facturadasSinCobrar);

    // A certificar (2026-09-08): trabajo hecho esperando el papel del cliente.
    // Y "por cobrar": todo lo que se hizo y todavía no entró, por moneda.
    const aCertificar = computeACertificar(presupuestos, ots);
    // Papel del cliente ya recibido, aviso a facturación todavía no generado.
    const certificadasSinAviso = computeCertificadasSinAviso(presupuestos, ots, solicitudes);
    const porCobrar = computePorCobrar(aCertificar.monto, solicitudesPendientes, facturadasSinCobrar, certificadasSinAviso.monto);
    // Total de la EMPRESA, sin el filtro de solapa: contratos + comercial.
    const porCobrarTotal = todos
      ? computePorCobrar(
          computeACertificar(todos.presupuestos, ots).monto,
          todos.solicitudes.filter(s => s.estado === 'pendiente'),
          todos.solicitudes.filter(s => s.estado === 'facturada'),
          computeCertificadasSinAviso(todos.presupuestos, ots, todos.solicitudes).monto,
        )
      : porCobrar;

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
      aCertificar,
      certificadasSinAviso,
      porCobrar,
      porCobrarTotal,
      pipeline,
      enEjecucion,
      montoEnEjecucion,
      borradores,
      borradoresConTrabajo,
      enviadosConTrabajo,
    };
  }, [presupuestos, solicitudes, ots, todos]);
}
