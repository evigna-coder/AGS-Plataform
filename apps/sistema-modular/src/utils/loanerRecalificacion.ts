/**
 * Ciclo de recalificación de loaners.
 *
 * El loaner NO vuelve disponible cuando regresa: pasa a 'en_recalificacion' y
 * acá se auto-crea la OT de recalificación más un ticket a administración
 * (Cynthia Mele) para coordinarla. Dos orígenes (2026-09-18):
 *  - vuelve de un PRÉSTAMO al cliente → OT interna NUEVA (cliente AGS
 *    Analítica, sin cargo, sin sistema — sobre el módulo/loaner);
 *  - vuelve de una DERIVACIÓN a proveedor externo → siguiente ÍTEM de la OT
 *    del trabajo (30255.01 banco, 30255.02 ELS, 30255.03 RQ): la derivación ya
 *    es un ítem de esa OT. Si el módulo salió sin OT, OT interna nueva.
 *
 * Cuando la OT (el ítem, o todas las hijas del padre) cierra técnicamente, el
 * loaner se libera a 'en_base'. El cierre técnico real suele escribirlo la app
 * de campo (reportes-ot) directo en Firestore, sin pasar por otService — por
 * eso además del hook en otService existe el sweep `liberarLoanersRecalificados`
 * (mismo patrón client-side que `patronesDescartesVencidos`), que corre al
 * montar las pantallas de loaners.
 *
 * Todo best-effort: un fallo en cualquier paso NO debe romper la devolución.
 * La lógica pura (origen vigente, qué OT libera) vive en
 * `loanerCicloRecalificacion` para compartirla con loanersService.
 */
import { Timestamp } from 'firebase/firestore';
import type { Loaner, PrestamoLoaner, LoanerDerivacion, WorkOrder, OTEstadoAdmin, Lead, TicketArea, TicketEstado } from '@ags/shared';
import { esOTCerradaTecnicamente, establecimientoUnicoId } from '@ags/shared';
import {
  ordenesTrabajoService, clientesService, establecimientosService,
  tiposServicioService, leadsService, loanersService, remitosService,
} from '../services/firebaseService';
import { db, docRef, runTransaction } from '../services/firebase';
import { usuariosService } from '../services/personalService';
import {
  OT_RECALIFICACION_CLAIM, idDeOrigen, origenPendienteDeRecalificacion, otRecalificacionVigente,
} from './loanerCicloRecalificacion';
import type { OrigenRecalificacion } from './loanerCicloRecalificacion';

export { OT_RECALIFICACION_CLAIM } from './loanerCicloRecalificacion';

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

function deDondeVuelve(origen: OrigenRecalificacion): string {
  if (origen.tipo === 'prestamo') return `retorno de préstamo a ${origen.prestamo.clienteNombre}`;
  const d = origen.derivacion;
  const que = d.alcance === 'parte' ? `retorno de la parte${d.parteDescripcion ? ` "${d.parteDescripcion}"` : ''} desde` : 'retorno de';
  return `${que} ${d.proveedorNombre ?? 'proveedor externo'}${d.remitoNumero ? ` — remito ${d.remitoNumero}` : ''}`;
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
  // Exacto primero: con la ampliación 2026-07-29 existe 'Recalificación de operación'
  // (tipo de apertura de OT, NO el de las OTs internas de loaner) y el fuzzy solo,
  // sobre la lista alfabética, pasaría a elegirlo. Se excluye del fallback.
  const exacto = tipos.find(t => t.nombre.trim().toLowerCase() === TIPO_SERVICIO_RECALIFICACION.toLowerCase());
  if (exacto) return exacto.nombre;
  const match = tipos.find(t => /recalif/i.test(t.nombre) && !/operaci/i.test(t.nombre));
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
 * OT del trabajo al que pertenece una derivación a proveedor: el padre cuya
 * hija de tipo proveedor externo es la derivación. Se busca primero en las OT
 * elegidas al generar el remito y después en las vinculadas al loaner; entre
 * varios padres gana el que tiene la hija de proveedor externo todavía abierta
 * (el .02 se cierra después de la vuelta). null = el módulo salió sin OT.
 */
async function resolverPadreDelTrabajo(loaner: Loaner, derivacion: LoanerDerivacion): Promise<string | null> {
  const candidatos: string[] = [];
  try {
    const remito = await remitosService.getById(derivacion.remitoId);
    for (const n of remito?.otNumbers ?? []) candidatos.push(n);
  } catch (err) {
    console.warn('[loanerRecalificacion] remito de la derivación no disponible:', err);
  }
  // Las vinculadas al loaner, de la más reciente a la más vieja.
  for (const n of [...(loaner.otIds ?? [])].reverse()) candidatos.push(n);
  const padres = [...new Set(candidatos.map(n => (n || '').trim().split('.')[0]).filter(Boolean))];
  let conExternoCerrado: string | null = null;
  for (const padre of padres) {
    let hijas: WorkOrder[] = [];
    try { hijas = await ordenesTrabajoService.getItemsByOtPadre(padre); } catch { continue; }
    const externas = hijas.filter(h => h.tipoOT === 'proveedor_externo' && h.estadoAdmin !== 'CANCELADA');
    if (externas.length === 0) continue;
    if (externas.some(h => !esOTCerradaTecnicamente(h))) return padre;
    conExternoCerrado ??= padre;
  }
  return conExternoCerrado;
}

/**
 * Crea el siguiente ítem del padre como ítem de recalificación, heredando el
 * contexto del trabajo (mismo shape que "+ Ítem" en useOTActions). Devuelve el
 * número del ítem (30255.03).
 */
async function crearItemRecalificacion(loaner: Loaner, padre: string, origen: OrigenRecalificacion): Promise<string> {
  const otPadre = await ordenesTrabajoService.getByOtNumber(padre);
  if (!otPadre) throw new Error(`OT padre ${padre} no encontrada`);
  const tipoServicioNombre = await resolverTipoServicioRecalificacion();
  const itemNum = await ordenesTrabajoService.getNextItemNumber(padre);
  const ahora = new Date().toISOString();
  const hoy = ahora.split('T')[0];
  const descripcion = `Recalificación de loaner ${loaner.codigo} — ${descripcionLoaner(loaner)} (${deDondeVuelve(origen)})`;
  await ordenesTrabajoService.create({
    otNumber: itemNum,
    tipoOT: 'servicio',
    status: 'BORRADOR',
    estadoAdmin: 'CREADA' as OTEstadoAdmin,
    estadoAdminFecha: ahora,
    estadoHistorial: [{ estado: 'CREADA' as OTEstadoAdmin, fecha: ahora }],
    budgets: [],
    ordenCompra: otPadre.ordenCompra ?? '',
    ordenesCompra: otPadre.ordenesCompra ?? [],
    tipoServicio: tipoServicioNombre,
    // Hereda la base de facturación del trabajo: una RQ interna nace sin cargo
    // porque su padre lo es; una OT de cliente conserva su condición.
    esFacturable: otPadre.esFacturable ?? false,
    tieneContrato: otPadre.tieneContrato ?? false,
    esGarantia: otPadre.esGarantia ?? false,
    esSinCargo: otPadre.esSinCargo ?? false,
    presupuestoPendiente: false,
    razonSocial: otPadre.razonSocial,
    contacto: otPadre.contacto ?? '',
    sector: otPadre.sector,
    direccion: otPadre.direccion ?? '', localidad: otPadre.localidad ?? '', provincia: otPadre.provincia ?? '',
    establecimientoId: otPadre.establecimientoId ?? undefined,
    sistema: otPadre.sistema || `Loaner ${loaner.codigo}`,
    moduloModelo: otPadre.moduloModelo || loaner.moduloCodigo || '',
    moduloDescripcion: otPadre.moduloDescripcion || loaner.moduloDescripcion || loaner.descripcion || '',
    moduloSerie: otPadre.moduloSerie || loaner.serie || '',
    moduloMarca: otPadre.moduloMarca ?? undefined,
    codigoInternoCliente: otPadre.codigoInternoCliente ?? '',
    fechaInicio: hoy, fechaFin: hoy,
    fechaServicioAprox: '',
    horasTrabajadas: '', tiempoViaje: '',
    reporteTecnico: '', accionesTomar: '', articulos: [],
    emailPrincipal: otPadre.emailPrincipal ?? '',
    signatureEngineer: null, aclaracionEspecialista: '',
    signatureClient: null, aclaracionCliente: '',
    updatedAt: ahora,
    clienteId: otPadre.clienteId,
    sistemaId: otPadre.sistemaId ?? undefined,
    moduloId: otPadre.moduloId ?? undefined,
    ingenieroAsignadoId: null,
    ingenieroAsignadoNombre: null,
    problemaFallaInicial: descripcion,
    contratoId: otPadre.contratoId ?? null,
    comentarioFacturacion: null,
    materialesParaServicio: '',
    leadId: otPadre.leadId ?? undefined,
    presupuestoOrigenId: otPadre.presupuestoOrigenId ?? null,
    loanerId: loaner.id,
    loanerCodigo: loaner.codigo,
  });
  return itemNum;
}

/** Crea la OT interna NUEVA (padre + hija .01) a nombre de AGS. Devuelve el padre. */
async function crearOTInternaRecalificacion(
  loaner: Loaner, origen: OrigenRecalificacion, clienteAGS: { id: string; razonSocial: string },
): Promise<string> {
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

  const descripcion = `Recalificación de loaner ${loaner.codigo} — ${descripcionLoaner(loaner)} (${deDondeVuelve(origen)})`;
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
  // create() devuelve la hija auto-creada — no asumir ".01" (un contador
  // reciclado puede correr la numeración; ver otService.create 2026-08-11).
  const otHija = await ordenesTrabajoService.create(otData);
  // Igual que useCreateOTForm: solo se overridean las fechas de la hija
  // (el parent es contenedor, queda vacío).
  const today = ahora.split('T')[0];
  if (otHija.includes('.')) {
    await ordenesTrabajoService.update(otHija, {
      fechaInicio: today,
      fechaFin: today,
    }).catch(err => console.warn('[loanerRecalificacion] fechas de la hija fallaron:', err));
  }
  // Vincular OT (padre e hija) al loaner. otService.create ya vincula
  // best-effort cuando la OT trae loanerId; repetir acá es idempotente.
  try {
    await loanersService.vincularOT(loaner.id, otNum);
    await loanersService.vincularOT(loaner.id, otHija);
  } catch (err) {
    console.warn('[loanerRecalificacion] vincularOT falló:', err);
  }
  return otNum;
}

async function anotarOT(loaner: Loaner, origen: OrigenRecalificacion, otNumber: string): Promise<void> {
  if (origen.tipo === 'prestamo') await loanersService.setOtRecalificacionEnPrestamo(loaner.id, origen.prestamo.id, otNumber);
  else await loanersService.setOtRecalificacionEnDerivacion(loaner.id, origen.derivacion.id, otNumber);
}

/**
 * Crea la OT de recalificación + el ticket de coordinación. Best-effort por
 * paso: si no se puede crear la OT el ticket avisa que hay que crearla a
 * mano; si la OT falla, el ticket igual se crea. Nunca lanza.
 *
 * ARRANCA RECLAMANDO EL ORIGEN (2026-09-01, caso LNR-0014 → OTs 30241 y
 * 30242 con un segundo de diferencia). El guard vivía solo en el sweep, así que
 * la devolución creaba la OT sin reclamar y anotaba su número recién al final:
 * en esa ventana —dos segundos— la suscripción empujaba el loaner ya
 * 'en_recalificacion' a una lista abierta en otra solapa, cuyo sweep lo veía
 * "sin OT", lo reclamaba y arrancaba una segunda OT completa. Reclamando acá,
 * el que llega segundo se va sin crear nada, venga del camino que venga.
 */
export async function iniciarRecalificacion(
  loaner: Loaner,
  origenOPrestamo: OrigenRecalificacion | PrestamoLoaner,
): Promise<{ otNumber: string | null; ticketId: string | null; yaEnCurso?: boolean }> {
  const origen: OrigenRecalificacion = 'tipo' in origenOPrestamo && (origenOPrestamo.tipo === 'prestamo' || origenOPrestamo.tipo === 'derivacion')
    ? origenOPrestamo as OrigenRecalificacion
    : { tipo: 'prestamo', prestamo: origenOPrestamo as PrestamoLoaner };
  let otNumber: string | null = null;
  let ticketId: string | null = null;

  if (!await reclamarOrigenParaRecalificacion(loaner.id, origen)) {
    console.log(`[loanerRecalificacion] ${loaner.codigo}: la recalificación ya está en curso (o creada) — no se duplica.`);
    return { otNumber: null, ticketId: null, yaEnCurso: true };
  }

  // 1. Vuelta de proveedor externo: siguiente ítem de la OT del trabajo.
  let padreDelTrabajo: string | null = null;
  if (origen.tipo === 'derivacion') {
    try {
      padreDelTrabajo = await resolverPadreDelTrabajo(loaner, origen.derivacion);
      if (padreDelTrabajo) {
        otNumber = await crearItemRecalificacion(loaner, padreDelTrabajo, origen);
        await loanersService.vincularOT(loaner.id, otNumber).catch(err => console.warn('[loanerRecalificacion] vincularOT falló:', err));
      }
    } catch (err) {
      console.error('[loanerRecalificacion] creación del ítem de recalificación falló (se intenta OT nueva):', err);
      otNumber = null;
    }
  }

  // 2. OT interna nueva: vuelta de préstamo, o módulo derivado sin OT.
  const clienteAGS = otNumber ? null : await resolverClienteAGS();
  if (!otNumber && !clienteAGS) {
    console.warn('[loanerRecalificacion] cliente "AGS Analítica" no encontrado — se saltea la OT (el ticket avisa).');
  }
  if (!otNumber && clienteAGS) {
    try {
      otNumber = await crearOTInternaRecalificacion(loaner, origen, clienteAGS);
    } catch (err) {
      console.error('[loanerRecalificacion] creación de OT falló (la devolución sigue):', err);
    }
  }

  // 3. Anotar el número en el origen (pisa el claim).
  if (otNumber) {
    try {
      await anotarOT(loaner, origen, otNumber);
    } catch (err) {
      console.warn('[loanerRecalificacion] anotar otRecalificacionNumber falló:', err);
    }
  }

  // 4. Ticket de coordinación a administración (Cynthia Mele).
  try {
    const responsable = await resolverResponsable();
    const esItem = !!otNumber && otNumber.includes('.');
    const vuelta = origen.tipo === 'prestamo'
      ? `devuelto por ${origen.prestamo.clienteNombre}`
      : origen.derivacion.alcance === 'parte'
        ? `con su parte${origen.derivacion.parteDescripcion ? ` "${origen.derivacion.parteDescripcion}"` : ''} de vuelta de ${origen.derivacion.proveedorNombre ?? 'proveedor externo'} (rearmar el módulo)`
        : `de vuelta de ${origen.derivacion.proveedorNombre ?? 'proveedor externo'}`;
    const descTicket = [
      `Loaner ${loaner.codigo} (${descripcionLoaner(loaner)}) ${vuelta}.`,
      otNumber
        ? (esItem
            ? `Se creó el ítem de recalificación ${otNumber} en la OT del trabajo.`
            : `Se creó la OT de recalificación ${otNumber}.`)
        : (clienteAGS || padreDelTrabajo)
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
      esAutogenerado: true,
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

  // Sin OT el claim se libera para que un sweep futuro reintente; con OT ya
  // quedó pisado por el número real en anotarOT.
  if (!otNumber) await revertirClaimRecalificacion(loaner.id, origen);

  return { otNumber, ticketId };
}

/**
 * Post-commit del retorno desde proveedor (2026-09-18): relee el loaner y, si
 * la derivación de ese remito quedó marcada para recalificar y sin OT, crea el
 * ítem/OT + ticket. Best-effort; si falla, el sweep de las pantallas de
 * loaners lo completa.
 */
export async function recalificarTrasRetornoProveedor(loanerId: string, remitoId: string): Promise<void> {
  const loaner = await loanersService.getById(loanerId);
  if (!loaner || loaner.estado !== 'en_recalificacion') return;
  const derivacion = [...(loaner.derivaciones ?? [])].reverse()
    .find(d => d.remitoId === remitoId && d.fechaRetorno && d.requiereRecalificacion && !d.otRecalificacionNumber);
  if (!derivacion) return;
  await iniciarRecalificacion(loaner, { tipo: 'derivacion', derivacion });
}

/**
 * Sweep de liberación: para cada loaner 'en_recalificacion' con OT de
 * recalificación anotada, verifica que cerró técnicamente (criterio compartido
 * `esOTCerradaTecnicamente`, que también cubre `status === 'FINALIZADO'`
 * escrito por la app de campo) y libera el loaner a 'en_base'. Con el ciclo
 * anclado a un ÍTEM (vuelta de proveedor) mira solo ese ítem; con un padre,
 * todas sus hijas. Devuelve la cantidad liberada en esta pasada.
 */
export async function liberarLoanersRecalificados(loaners: Loaner[]): Promise<number> {
  let liberados = 0;
  for (const loaner of loaners) {
    if (loaner.estado !== 'en_recalificacion') continue;
    const otNum = otRecalificacionVigente(loaner);
    if (!otNum) continue;
    try {
      // CANCELADA cuenta como resuelta (2026-09-02, caso LNR-0014): se creó una
      // recalificación a un módulo que no la requería y se canceló la OT. El
      // loaner quedaba 'en_recalificacion' PARA SIEMPRE — ni este sweep ni el
      // gancho del cierre en otService la liberaban, porque los dos exigen
      // cierre técnico y una OT cancelada nunca lo alcanza. Cancelar la
      // recalificación es decir "no hacía falta": el módulo vuelve a base.
      const resuelta = (o: WorkOrder) =>
        esOTCerradaTecnicamente(o) || o.estadoAdmin === 'CANCELADA';
      let cerrada: boolean;
      if (otNum.includes('.')) {
        const item = await ordenesTrabajoService.getByOtNumber(otNum);
        cerrada = !!item && resuelta(item);
      } else {
        const hijas = await ordenesTrabajoService.getItemsByOtPadre(otNum);
        if (hijas.length > 0) {
          // La(s) work unit(s) son las hijas; el padre es contenedor y nunca cierra.
          cerrada = hijas.every(resuelta);
        } else {
          const ot = await ordenesTrabajoService.getByOtNumber(otNum);
          cerrada = !!ot && resuelta(ot);
        }
      }
      if (cerrada && await loanersService.liberarTrasRecalificacion(loaner.id, otNum)) {
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
 * Guard anti-duplicado: "reclama" el origen (préstamo o derivación) en una
 * transacción sobre el doc del loaner, seteando otRecalificacionNumber =
 * 'PENDIENTE' solo si sigue vacío. Si dos PCs corren el sweep a la vez, una
 * sola gana el claim y crea la OT; la otra ve el claim y saltea. Devuelve true
 * si esta sesión ganó.
 */
async function reclamarOrigenParaRecalificacion(loanerId: string, origen: OrigenRecalificacion): Promise<boolean> {
  const id = idDeOrigen(origen);
  return runTransaction(db, async tx => {
    const ref = docRef('loaners', loanerId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as { estado?: string; prestamos?: PrestamoLoaner[]; derivaciones?: LoanerDerivacion[] };
    if (data.estado !== 'en_recalificacion') return false;
    if (origen.tipo === 'prestamo') {
      const prestamos = data.prestamos ?? [];
      const p = prestamos.find(x => x.id === id);
      if (!p || p.otRecalificacionNumber) return false; // ya reclamado o con OT real
      tx.update(ref, {
        prestamos: prestamos.map(x => x.id === id ? { ...x, otRecalificacionNumber: OT_RECALIFICACION_CLAIM } : x),
        updatedAt: Timestamp.now(),
      });
    } else {
      const derivaciones = data.derivaciones ?? [];
      const d = derivaciones.find(x => x.id === id);
      if (!d || d.otRecalificacionNumber) return false;
      tx.update(ref, {
        derivaciones: derivaciones.map(x => x.id === id ? { ...x, otRecalificacionNumber: OT_RECALIFICACION_CLAIM } : x),
        updatedAt: Timestamp.now(),
      });
    }
    return true;
  });
}

/** Revierte el claim a null (solo si sigue en 'PENDIENTE') para reintento futuro. */
async function revertirClaimRecalificacion(loanerId: string, origen: OrigenRecalificacion): Promise<void> {
  const id = idDeOrigen(origen);
  try {
    await runTransaction(db, async tx => {
      const ref = docRef('loaners', loanerId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data() as { prestamos?: PrestamoLoaner[]; derivaciones?: LoanerDerivacion[] };
      if (origen.tipo === 'prestamo') {
        const prestamos = data.prestamos ?? [];
        if (prestamos.find(x => x.id === id)?.otRecalificacionNumber !== OT_RECALIFICACION_CLAIM) return;
        tx.update(ref, {
          prestamos: prestamos.map(x => x.id === id ? { ...x, otRecalificacionNumber: null } : x),
          updatedAt: Timestamp.now(),
        });
      } else {
        const derivaciones = data.derivaciones ?? [];
        if (derivaciones.find(x => x.id === id)?.otRecalificacionNumber !== OT_RECALIFICACION_CLAIM) return;
        tx.update(ref, {
          derivaciones: derivaciones.map(x => x.id === id ? { ...x, otRecalificacionNumber: null } : x),
          updatedAt: Timestamp.now(),
        });
      }
    });
  } catch (err) {
    console.warn('[loanerRecalificacion] revertir claim falló (quedará PENDIENTE):', err);
  }
}

/**
 * Sweep de creación: completa las OTs de recalificación que faltan. Para cada
 * loaner 'en_recalificacion' cuyo origen vigente (préstamo devuelto o
 * derivación retornada) requiere recalificación y NO tiene OT anotada
 * (devolución desde el portal, o post-commit del retorno de proveedor que
 * falló), crea la OT/ítem + ticket vía `iniciarRecalificacion`.
 *
 * El guard anti-duplicado NO vive acá desde 2026-09-01: lo hace
 * `iniciarRecalificacion`, que reclama el origen antes de crear nada. Así
 * queda un solo lugar que decide quién crea, y el sweep no puede pisarse con la
 * devolución (que llama a `iniciarRecalificacion` directo). Best-effort por
 * loaner; nunca lanza. Devuelve cuántas OTs creó.
 */
export async function procesarRecalificacionesPendientes(loaners: Loaner[]): Promise<number> {
  let creadas = 0;
  for (const loaner of loaners) {
    if (loaner.estado !== 'en_recalificacion') continue;
    const origen = origenPendienteDeRecalificacion(loaner);
    if (!origen) continue;
    try {
      const { otNumber } = await iniciarRecalificacion(loaner, origen);
      if (otNumber) {
        // El número real ya lo anota iniciarRecalificacion, pero ese write es
        // best-effort: repetirlo es idempotente y evita dejar el claim colgado.
        await anotarOT(loaner, origen, otNumber)
          .catch(err => console.warn('[loanerRecalificacion] re-anotar OT tras sweep falló:', err));
        creadas++;
      }
    } catch (err) {
      console.warn(`[loanerRecalificacion] procesar pendiente del loaner ${loaner.codigo} falló:`, err);
      await revertirClaimRecalificacion(loaner.id, origen);
    }
  }
  return creadas;
}
