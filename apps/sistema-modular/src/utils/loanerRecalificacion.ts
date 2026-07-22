/**
 * Ciclo de recalificación de loaners.
 *
 * Al devolverse un préstamo, el loaner NO vuelve disponible: pasa a
 * 'en_recalificacion' y acá se auto-crea la OT interna de recalificación
 * (cliente AGS Analítica, sin cargo, sin sistema — sobre el módulo/loaner)
 * más un ticket a administración (Cynthia Mele) para coordinarla.
 *
 * Cuando la OT cierra técnicamente, el loaner se libera a 'en_base'. El cierre
 * técnico real suele escribirlo la app de campo (reportes-ot) directo en
 * Firestore, sin pasar por otService — por eso además del hook en otService
 * existe el sweep `liberarLoanersRecalificados` (mismo patrón client-side que
 * `patronesDescartesVencidos`), que corre al montar las pantallas de loaners.
 *
 * Todo best-effort: un fallo en cualquier paso NO debe romper la devolución.
 */
import { Timestamp } from 'firebase/firestore';
import type { Loaner, PrestamoLoaner, WorkOrder, OTEstadoAdmin, Lead, TicketArea, TicketEstado } from '@ags/shared';
import { esOTCerradaTecnicamente, establecimientoUnicoId } from '@ags/shared';
import {
  ordenesTrabajoService, clientesService, establecimientosService,
  tiposServicioService, leadsService, loanersService,
} from '../services/firebaseService';
import { db, docRef, runTransaction } from '../services/firebase';
import { usuariosService } from '../services/personalService';

/** Cliente interno dueño de los loaners. Se resuelve por razón social, no por id. */
const CLIENTE_AGS_REGEX = /ags\s*anal[ií]tica/i;
/** Responsable de coordinar recalificaciones (decisión dirección 2026-07). Por nombre, no uid. */
const RESPONSABLE_RECALIFICACION_REGEX = /cynthia/i;
/** Nombre del tipo de servicio; se crea si el catálogo no tiene uno que matchee /recalif/i. */
const TIPO_SERVICIO_RECALIFICACION = 'Recalificación';

function descripcionLoaner(loaner: Loaner): string {
  const partes = [
    loaner.categoriaModuloNombre || loaner.categoriaEquipo || null,
    loaner.moduloCodigo || null,
    loaner.serie ? `SN ${loaner.serie}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' ') : loaner.descripcion;
}

async function resolverClienteAGS() {
  try {
    const clientes = await clientesService.getAll(true);
    return clientes.find(c => CLIENTE_AGS_REGEX.test(c.razonSocial)) ?? null;
  } catch (err) {
    console.warn('[loanerRecalificacion] no se pudo resolver el cliente AGS:', err);
    return null;
  }
}

async function resolverTipoServicioRecalificacion(): Promise<string> {
  const tipos = await tiposServicioService.getAll();
  const match = tipos.find(t => /recalif/i.test(t.nombre));
  if (match) return match.nombre;
  // No existe en el catálogo → crearlo (queda disponible para futuras OTs).
  await tiposServicioService.create({
    nombre: TIPO_SERVICIO_RECALIFICACION,
    activo: true,
    requiresProtocol: false,
  });
  return TIPO_SERVICIO_RECALIFICACION;
}

async function resolverResponsable(): Promise<{ id: string; nombre: string } | null> {
  try {
    const usuarios = await usuariosService.getAll();
    const u = usuarios.find(x => RESPONSABLE_RECALIFICACION_REGEX.test(x.displayName || '') && x.status === 'activo');
    return u ? { id: u.id, nombre: u.displayName } : null;
  } catch {
    return null;
  }
}

/**
 * Crea la OT interna de recalificación (padre + hija .01) + el ticket de
 * coordinación. Best-effort por paso: si el cliente AGS no se resuelve se
 * saltea la OT (el ticket avisa que falta el cliente); si la OT falla, el
 * ticket igual se crea. Nunca lanza.
 */
export async function iniciarRecalificacion(
  loaner: Loaner,
  prestamo: PrestamoLoaner,
): Promise<{ otNumber: string | null; ticketId: string | null }> {
  let otNumber: string | null = null;
  let ticketId: string | null = null;

  // 1. Cliente interno AGS Analítica (existe como cliente real en producción).
  const clienteAGS = await resolverClienteAGS();
  if (!clienteAGS) {
    console.warn('[loanerRecalificacion] cliente "AGS Analítica" no encontrado — se saltea la OT (el ticket avisa).');
  }

  // 2+3. Tipo de servicio + OT padre e hija .01 (mismo shape que useCreateOTForm,
  // base de facturación "sin cargo", sin presupuesto, sin sistema).
  if (clienteAGS) {
    try {
      const tipoServicioNombre = await resolverTipoServicioRecalificacion();

      let establecimientoId: string | undefined;
      let direccion = '', localidad = '', provincia = '';
      try {
        const ests = await establecimientosService.getByCliente(clienteAGS.id);
        const activos = ests.filter(e => e.activo);
        // Regla del repo: cliente con un único establecimiento → autoseleccionarlo.
        const unico = establecimientoUnicoId(activos);
        if (unico) {
          establecimientoId = unico;
          const est = activos.find(e => e.id === unico);
          direccion = est?.direccion ?? '';
          localidad = est?.localidad ?? '';
          provincia = est?.provincia ?? '';
        }
      } catch (err) {
        console.warn('[loanerRecalificacion] establecimientos de AGS no disponibles:', err);
      }

      const descripcion = `Recalificación de loaner ${loaner.codigo} — ${descripcionLoaner(loaner)} (retorno de préstamo a ${prestamo.clienteNombre})`;
      const ahora = new Date().toISOString();
      const otNum = await ordenesTrabajoService.getNextOtNumber();
      const otData: Omit<WorkOrder, 'otNumber'> & { otNumber: string } = {
        otNumber: otNum,
        tipoOT: 'servicio',
        status: 'BORRADOR',
        estadoAdmin: 'CREADA' as OTEstadoAdmin,
        estadoAdminFecha: ahora,
        estadoHistorial: [{ estado: 'CREADA' as OTEstadoAdmin, fecha: ahora }],
        budgets: [],
        ordenCompra: '',
        tipoServicio: tipoServicioNombre,
        // Base de facturación "sin cargo": OT interna, no va a facturación.
        esFacturable: false,
        tieneContrato: false,
        esGarantia: false,
        esSinCargo: true,
        presupuestoPendiente: false,
        razonSocial: clienteAGS.razonSocial,
        contacto: '',
        direccion, localidad, provincia,
        establecimientoId,
        // OT sobre módulo AGS: sin sistema del cliente; los datos del módulo
        // viajan en los campos de módulo para que el técnico los vea.
        sistema: `Loaner ${loaner.codigo}`,
        moduloModelo: loaner.moduloCodigo ?? '',
        moduloDescripcion: loaner.moduloDescripcion ?? loaner.descripcion ?? '',
        moduloSerie: loaner.serie ?? '',
        codigoInternoCliente: '',
        fechaInicio: '', fechaFin: '',
        fechaServicioAprox: '',
        horasTrabajadas: '', tiempoViaje: '',
        reporteTecnico: '', accionesTomar: '', articulos: [],
        emailPrincipal: '',
        signatureEngineer: null, aclaracionEspecialista: '',
        signatureClient: null, aclaracionCliente: '',
        updatedAt: ahora,
        clienteId: clienteAGS.id,
        sistemaId: undefined,
        moduloId: undefined,
        ingenieroAsignadoId: null,
        ingenieroAsignadoNombre: null,
        problemaFallaInicial: descripcion,
        contratoId: null,
        comentarioFacturacion: null,
        materialesParaServicio: '',
        leadId: undefined,
        presupuestoOrigenId: null,
        loanerId: loaner.id,
        loanerCodigo: loaner.codigo,
      };
      await ordenesTrabajoService.create(otData);
      // Igual que useCreateOTForm: el parent auto-crea la hija .01; solo se
      // overridean las fechas de la hija (el parent es contenedor, queda vacío).
      const today = ahora.split('T')[0];
      await ordenesTrabajoService.update(`${otNum}.01`, {
        fechaInicio: today,
        fechaFin: today,
      }).catch(err => console.warn('[loanerRecalificacion] fechas de la hija .01 fallaron:', err));
      otNumber = otNum;

      // 4. Vincular OT (padre e hija) al loaner + anotar el número en el préstamo.
      // otService.create ya vincula best-effort cuando la OT trae loanerId;
      // repetir acá es idempotente (dedup) y cubre el caso de que aquel hook falle.
      try {
        await loanersService.vincularOT(loaner.id, otNum);
        await loanersService.vincularOT(loaner.id, `${otNum}.01`);
      } catch (err) {
        console.warn('[loanerRecalificacion] vincularOT falló:', err);
      }
      try {
        await loanersService.setOtRecalificacionEnPrestamo(loaner.id, prestamo.id, otNum);
      } catch (err) {
        console.warn('[loanerRecalificacion] anotar otRecalificacionNumber falló:', err);
      }
    } catch (err) {
      console.error('[loanerRecalificacion] creación de OT falló (la devolución sigue):', err);
    }
  }

  // 5. Ticket de coordinación a administración (Cynthia Mele).
  try {
    const responsable = await resolverResponsable();
    const descTicket = [
      `Loaner ${loaner.codigo} (${descripcionLoaner(loaner)}) devuelto por ${prestamo.clienteNombre}.`,
      otNumber
        ? `Se creó la OT de recalificación ${otNumber}.`
        : clienteAGS
          ? 'ATENCIÓN: no se pudo crear la OT de recalificación automáticamente — crearla a mano.'
          : 'ATENCIÓN: no existe el cliente "AGS Analítica" en el sistema — la OT de recalificación no se pudo crear; darlo de alta y crear la OT a mano.',
      'Coordinar la recalificación del módulo antes de volver a prestarlo.',
    ].join(' ');

    const lead: Omit<Lead, 'id' | 'updatedAt'> = {
      clienteId: clienteAGS?.id ?? null,
      contactoId: null,
      razonSocial: clienteAGS?.razonSocial ?? 'AGS Analítica — Interno',
      contacto: '',
      email: '',
      telefono: '',
      motivoLlamado: 'otros',
      motivoOtros: 'Recalificación de loaner',
      motivoContacto: `Recalificación de loaner · ${loaner.codigo}`,
      sistemaId: null,
      estado: 'nuevo' as TicketEstado,
      postas: [],
      asignadoA: responsable?.id ?? null,
      asignadoNombre: responsable?.nombre ?? null,
      derivadoPor: null,
      areaActual: 'administracion' as TicketArea,
      descripcion: descTicket,
      accionPendiente: 'Coordinar recalificación del loaner',
      prioridad: 'normal',
      otIds: otNumber ? [otNumber] : [],
      presupuestosIds: [],
      source: 'manual',
      createdAt: new Date().toISOString(),
    };
    ticketId = await leadsService.create(lead);
  } catch (err) {
    console.error('[loanerRecalificacion] creación de ticket falló (la devolución sigue):', err);
  }

  return { otNumber, ticketId };
}

/**
 * Sentinel del guard anti-duplicado del sweep: un préstamo con
 * `otRecalificacionNumber === 'PENDIENTE'` está "reclamado" por una sesión
 * que está creando la OT en este momento. Nunca es un número de OT real.
 */
export const OT_RECALIFICACION_CLAIM = 'PENDIENTE';

/** Último préstamo del loaner que tiene OT de recalificación anotada (real, no el claim). */
function otRecalificacionDelLoaner(loaner: Loaner): string | null {
  for (let i = loaner.prestamos.length - 1; i >= 0; i--) {
    const num = loaner.prestamos[i].otRecalificacionNumber;
    if (num && num !== OT_RECALIFICACION_CLAIM) return num;
  }
  return null;
}

/**
 * Sweep de liberación: para cada loaner 'en_recalificacion' con OT de
 * recalificación anotada, lee las OTs hijas y — si todas quedaron cerradas
 * técnicamente (criterio compartido `esOTCerradaTecnicamente`, que también
 * cubre `status === 'FINALIZADO'` escrito por la app de campo) — libera el
 * loaner a 'en_base'. Devuelve la cantidad liberada en esta pasada.
 */
export async function liberarLoanersRecalificados(loaners: Loaner[]): Promise<number> {
  let liberados = 0;
  for (const loaner of loaners) {
    if (loaner.estado !== 'en_recalificacion') continue;
    const otNum = otRecalificacionDelLoaner(loaner);
    if (!otNum) continue;
    try {
      const base = otNum.split('.')[0];
      const hijas = await ordenesTrabajoService.getItemsByOtPadre(base);
      let cerrada: boolean;
      if (hijas.length > 0) {
        // La(s) work unit(s) son las hijas; el padre es contenedor y nunca cierra.
        cerrada = hijas.every(h => esOTCerradaTecnicamente(h));
      } else {
        const ot = await ordenesTrabajoService.getByOtNumber(otNum);
        cerrada = !!ot && esOTCerradaTecnicamente(ot);
      }
      if (cerrada && await loanersService.liberarTrasRecalificacion(loaner.id)) {
        liberados++;
        console.log(`[loanerRecalificacion] loaner ${loaner.codigo} liberado (OT ${otNum} cerrada técnicamente)`);
      }
    } catch (err) {
      console.warn(`[loanerRecalificacion] sweep del loaner ${loaner.codigo} falló:`, err);
    }
  }
  return liberados;
}

/**
 * Último préstamo devuelto del loaner que quedó pendiente de recalificación:
 * requiereRecalificacion y sin OT anotada (ni claim de otra sesión). Es el
 * caso de las devoluciones registradas desde portal-ingeniero, que NO crean
 * OT ni ticket — eso lo completa este sweep en el back-office.
 */
function prestamoPendienteDeRecalificacion(loaner: Loaner): PrestamoLoaner | null {
  for (let i = loaner.prestamos.length - 1; i >= 0; i--) {
    const p = loaner.prestamos[i];
    if (p.estado !== 'devuelto') continue;
    return p.requiereRecalificacion && !p.otRecalificacionNumber ? p : null;
  }
  return null;
}

/**
 * Guard anti-duplicado: "reclama" el préstamo en una transacción sobre el doc
 * del loaner, seteando otRecalificacionNumber = 'PENDIENTE' solo si sigue
 * vacío. Si dos PCs corren el sweep a la vez, una sola gana el claim y crea
 * la OT; la otra ve el claim y saltea. Devuelve true si esta sesión ganó.
 */
async function reclamarPrestamoParaRecalificacion(loanerId: string, prestamoId: string): Promise<boolean> {
  return runTransaction(db, async tx => {
    const ref = docRef('loaners', loanerId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as { estado?: string; prestamos?: PrestamoLoaner[] };
    if (data.estado !== 'en_recalificacion') return false;
    const prestamos = data.prestamos ?? [];
    const prestamo = prestamos.find(p => p.id === prestamoId);
    if (!prestamo || prestamo.otRecalificacionNumber) return false; // ya reclamado o con OT real
    tx.update(ref, {
      prestamos: prestamos.map(p =>
        p.id === prestamoId ? { ...p, otRecalificacionNumber: OT_RECALIFICACION_CLAIM } : p),
      updatedAt: Timestamp.now(),
    });
    return true;
  });
}

/** Revierte el claim a null (solo si sigue en 'PENDIENTE') para reintento futuro. */
async function revertirClaimRecalificacion(loanerId: string, prestamoId: string): Promise<void> {
  try {
    await runTransaction(db, async tx => {
      const ref = docRef('loaners', loanerId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const prestamos = ((snap.data() as { prestamos?: PrestamoLoaner[] }).prestamos) ?? [];
      const prestamo = prestamos.find(p => p.id === prestamoId);
      if (!prestamo || prestamo.otRecalificacionNumber !== OT_RECALIFICACION_CLAIM) return;
      tx.update(ref, {
        prestamos: prestamos.map(p =>
          p.id === prestamoId ? { ...p, otRecalificacionNumber: null } : p),
        updatedAt: Timestamp.now(),
      });
    });
  } catch (err) {
    console.warn('[loanerRecalificacion] revertir claim falló (quedará PENDIENTE):', err);
  }
}

/**
 * Sweep de creación: completa las OTs de recalificación que faltan. Para cada
 * loaner 'en_recalificacion' cuyo último préstamo devuelto requiere
 * recalificación y NO tiene OT anotada (devolución registrada desde el portal),
 * crea la OT interna + ticket vía `iniciarRecalificacion` con guard
 * anti-duplicado transaccional (ver `reclamarPrestamoParaRecalificacion`).
 * `iniciarRecalificacion` anota el número real al final (pisa el 'PENDIENTE');
 * acá se re-anota idempotente por si aquel write best-effort falló, y si la OT
 * no se pudo crear el claim se revierte a null para reintento en el próximo
 * sweep. Best-effort por loaner; nunca lanza. Devuelve cuántas OTs creó.
 */
export async function procesarRecalificacionesPendientes(loaners: Loaner[]): Promise<number> {
  let creadas = 0;
  for (const loaner of loaners) {
    if (loaner.estado !== 'en_recalificacion') continue;
    const prestamo = prestamoPendienteDeRecalificacion(loaner);
    if (!prestamo) continue;
    try {
      const gano = await reclamarPrestamoParaRecalificacion(loaner.id, prestamo.id);
      if (!gano) continue; // otra sesión lo está creando (o ya lo creó)

      const { otNumber } = await iniciarRecalificacion(loaner, prestamo);
      if (otNumber) {
        // iniciarRecalificacion ya pisa el 'PENDIENTE' con el número real
        // (setOtRecalificacionEnPrestamo), pero ese write es best-effort:
        // repetirlo acá es idempotente y evita que quede el claim colgado.
        await loanersService.setOtRecalificacionEnPrestamo(loaner.id, prestamo.id, otNumber)
          .catch(err => console.warn('[loanerRecalificacion] re-anotar OT tras sweep falló:', err));
        creadas++;
      } else {
        // La OT no se pudo crear (p. ej. falta el cliente AGS) → liberar el
        // claim para que un sweep futuro reintente. El ticket de aviso puede
        // haberse creado igual (iniciarRecalificacion es best-effort por paso).
        await revertirClaimRecalificacion(loaner.id, prestamo.id);
      }
    } catch (err) {
      console.warn(`[loanerRecalificacion] procesar pendiente del loaner ${loaner.codigo} falló:`, err);
      await revertirClaimRecalificacion(loaner.id, prestamo.id);
    }
  }
  return creadas;
}
