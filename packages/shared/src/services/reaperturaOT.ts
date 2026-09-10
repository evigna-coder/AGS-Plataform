import {
  Firestore, Timestamp, collection, doc, getDoc, getDocs, query, where, runTransaction, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { FirebaseStorage, getBytes, ref, uploadBytes } from 'firebase/storage';
import type { Lead, OTEstadoAdmin, Posta, WorkOrder } from '../types';
import { deepCleanForFirestore } from '../utils';

/**
 * Reapertura de OT (2026-09-10). Diseño en `.claude/plans/reapertura-ot.md`.
 *
 * Vive en shared porque la disparan DOS apps sobre el mismo doc `reportes/{ot}`:
 * sistema-modular (administración) y portal-ingeniero (el técnico en el cliente
 * a las 19 hs, sin depender de nadie). Misma lógica, misma traza.
 *
 * Principios:
 *  - Reabrir NO revierte stock ni facturación: lo hecho queda hecho y marcado;
 *    el re-cierre solo aplica lo nuevo (modelo de delta).
 *  - La facturación manda: si la OT ya está en una solicitud viva, no se toca y
 *    el re-cierre no la vuelve a ofrecer (`facturacionBloqueada`).
 *  - Nada se borra: historial append, tickets con posta, PDF con backup.
 */

export type NivelReapertura = 'administrativa' | 'tecnica';

export interface ReaperturaOT {
  id: string;
  fecha: string;
  actorUid: string;
  actorNombre: string;
  motivo: string;
  nivel: NivelReapertura;
  estadoDesde: OTEstadoAdmin | null;
  estadoHasta: OTEstadoAdmin;
  origen: 'sistema-modular' | 'portal-ingeniero';
  /** Lo que el usuario vio antes de confirmar (facturada, stock descontado, etc.). */
  avisos: string[];
}

/** OT ya incluida en una solicitud de facturación viva al momento de reabrir. */
export interface FacturacionBloqueadaOT {
  solicitudId: string;
  solicitudNumero?: string | null;
  estado: string;
  fecha: string;
}

/** PDF definitivo previo a una reapertura técnica (el técnico lo regenera). */
export interface PdfAnteriorOT {
  pdfUrl: string | null;
  protocolPdfUrl: string | null;
  pdfGeneratedAt: string | null;
  fecha: string;
  backups: string[];
}

export const REAPERTURA_ESTADOS_ORIGEN: readonly OTEstadoAdmin[] = ['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO'];
const SOLICITUD_ESTADOS_VIVOS = new Set(['pendiente', 'enviada', 'facturada', 'cobrada']);

export const TEXTO_AVISO_REAPERTURA_TECNICA =
  'Al reabrir el reporte se borra la firma del cliente. Tenés que informarle al cliente y el reporte se vuelve a firmar al finalizar.';

/** Estado destino de cada nivel. */
export function destinoReapertura(nivel: NivelReapertura): OTEstadoAdmin {
  return nivel === 'tecnica' ? 'EN_CURSO' : 'CIERRE_TECNICO';
}

/**
 * ¿Se puede reabrir esta OT en ese nivel? Administrativa: solo con cierre
 * administrativo hecho. Técnica: con el reporte finalizado (status) o cualquier
 * cierre posterior.
 */
export function puedeReabrirOT(ot: Pick<WorkOrder, 'status' | 'estadoAdmin' | 'otNumber'>, nivel: NivelReapertura): { ok: boolean; motivo?: string } {
  if (!ot.otNumber?.includes('.')) return { ok: false, motivo: 'Solo se reabren OTs hijas (NN.NN); el padre es un contenedor.' };
  const estado = ot.estadoAdmin;
  if (estado === 'CANCELADA') return { ok: false, motivo: 'La OT está cancelada.' };
  if (nivel === 'administrativa') {
    return estado === 'CIERRE_ADMINISTRATIVO' || estado === 'FINALIZADO'
      ? { ok: true }
      : { ok: false, motivo: 'La reapertura administrativa requiere que la OT tenga cierre administrativo.' };
  }
  const cerradaTecnicamente = ot.status === 'FINALIZADO' || (!!estado && REAPERTURA_ESTADOS_ORIGEN.includes(estado));
  return cerradaTecnicamente ? { ok: true } : { ok: false, motivo: 'El reporte todavía no está finalizado; no hay nada que reabrir.' };
}

export interface SolicitudVivaOT { id: string; numero?: string | null; estado: string }

/**
 * Qué hacer con un presupuesto vinculado al reabrir la OT.
 * - Sin solicitud viva que la incluya: la OT deja de estar "lista para facturar"
 *   y, si el presupuesto quedó en pendiente_facturacion solo por ella, vuelve a
 *   en_ejecucion (mismo criterio que quitar un presupuesto de una OT cerrada).
 * - Con solicitud viva: no se toca nada; se bloquea el re-cierre para que no la
 *   vuelva a ofrecer. Refacturar = anular la solicitud desde Facturación.
 */
export function decidirFacturacionAlReabrir(args: {
  otNumber: string;
  ppto: { estado: string; otsListasParaFacturar?: string[] | null };
  solicitudesVivas: SolicitudVivaOT[];
}): { quitarDeListas: boolean; nuevoEstado: 'en_ejecucion' | null; bloqueo: FacturacionBloqueadaOT | null; aviso: string | null } {
  const { otNumber, ppto, solicitudesVivas } = args;
  const viva = solicitudesVivas.find(s => SOLICITUD_ESTADOS_VIVOS.has(s.estado));
  if (viva) {
    const etiqueta = viva.numero ? `${viva.numero} (${viva.estado})` : `solicitud ${viva.estado}`;
    return {
      quitarDeListas: false,
      nuevoEstado: null,
      bloqueo: { solicitudId: viva.id, solicitudNumero: viva.numero ?? null, estado: viva.estado, fecha: new Date().toISOString() },
      aviso: `La OT ya está en el aviso de facturación ${etiqueta}: no se toca. Si hay que refacturar, anulá la solicitud desde Facturación.`,
    };
  }
  const listas = ppto.otsListasParaFacturar ?? [];
  const quitarDeListas = listas.includes(otNumber);
  const quedanOtras = listas.some(n => n !== otNumber);
  const nuevoEstado = ppto.estado === 'pendiente_facturacion' && !quedanOtras ? 'en_ejecucion' : null;
  return { quitarDeListas, nuevoEstado, bloqueo: null, aviso: null };
}

/** Solicitudes de facturación vivas que incluyen la OT. */
export async function solicitudesVivasDeOT(db: Firestore, otNumber: string): Promise<SolicitudVivaOT[]> {
  const snap = await getDocs(query(collection(db, 'solicitudesFacturacion'), where('otNumbers', 'array-contains', otNumber)));
  return snap.docs
    .map(d => ({ id: d.id, numero: (d.data().numero as string) ?? null, estado: (d.data().estado as string) ?? '' }))
    .filter(s => SOLICITUD_ESTADOS_VIVOS.has(s.estado));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Presupuestos vinculados por número (`budgets[]` guarda números, no ids). */
async function presupuestosDeOT(db: Firestore, numeros: string[]): Promise<{ id: string; numero: string }[]> {
  const out: { id: string; numero: string }[] = [];
  for (const parte of chunk([...new Set(numeros.filter(Boolean))], 10)) {
    const snap = await getDocs(query(collection(db, 'presupuestos'), where('numero', 'in', parte)));
    snap.docs.forEach(d => out.push({ id: d.id, numero: d.data().numero as string }));
  }
  return out;
}

export interface ReabrirOTArgs {
  otNumber: string;
  nivel: NivelReapertura;
  motivo: string;
  actor: { uid: string; nombre: string };
  origen: ReaperturaOT['origen'];
}

export interface ReabrirOTResultado {
  reapertura: ReaperturaOT;
  ot: WorkOrder;
  presupuestosTocados: string[];
  pdfAnterior: PdfAnteriorOT | null;
}

/**
 * Reabre la OT en una transacción sobre `reportes/{ot}` y sus presupuestos.
 * No toca stock, tickets ni Storage: eso lo hacen los helpers de abajo, que el
 * caller invoca best-effort después del commit.
 */
export async function reabrirOT(db: Firestore, args: ReabrirOTArgs): Promise<ReabrirOTResultado> {
  const { otNumber, nivel, actor, origen } = args;
  const motivo = args.motivo.trim();
  if (!motivo) throw new Error('El motivo de la reapertura es obligatorio.');

  const otRef = doc(db, 'reportes', otNumber);
  const preSnap = await getDoc(otRef);
  if (!preSnap.exists()) throw new Error(`OT ${otNumber} no encontrada`);
  const pre = { ...(preSnap.data() as WorkOrder), otNumber };
  const chequeo = puedeReabrirOT(pre, nivel);
  if (!chequeo.ok) throw new Error(chequeo.motivo);

  // Pre-reads fuera de la tx: presupuestos por número y solicitudes vivas.
  const pptos = await presupuestosDeOT(db, pre.budgets ?? []);
  const solicitudesVivas = await solicitudesVivasDeOT(db, otNumber);

  const fecha = new Date().toISOString();
  const estadoHasta = destinoReapertura(nivel);
  const avisos: string[] = [];
  if (pre.cierreAdmin?.stockDeducido) avisos.push('El stock ya se descontó en el cierre anterior: se mantiene y no se vuelve a descontar. Los consumos que se agreguen ahora se descuentan a mano (el descuento por línea es la próxima fase).');
  if (nivel === 'tecnica') avisos.push(TEXTO_AVISO_REAPERTURA_TECNICA);

  const presupuestosTocados: string[] = [];
  let bloqueo: FacturacionBloqueadaOT | null = null;

  const resultado = await runTransaction(db, async tx => {
    const otSnap = await tx.get(otRef);
    if (!otSnap.exists()) throw new Error(`OT ${otNumber} no encontrada (tx)`);
    const ot = otSnap.data() as WorkOrder;
    const pptoSnaps = await Promise.all(pptos.map(async p => ({ ...p, snap: await tx.get(doc(db, 'presupuestos', p.id)) })));

    for (const p of pptoSnaps) {
      if (!p.snap.exists()) continue;
      const data = p.snap.data() as { estado: string; otsListasParaFacturar?: string[] | null };
      const d = decidirFacturacionAlReabrir({ otNumber, ppto: data, solicitudesVivas });
      if (d.aviso && !avisos.includes(d.aviso)) avisos.push(d.aviso);
      if (d.bloqueo && !bloqueo) bloqueo = d.bloqueo;
      if (d.quitarDeListas || d.nuevoEstado) {
        tx.update(doc(db, 'presupuestos', p.id), deepCleanForFirestore({
          ...(d.quitarDeListas ? { otsListasParaFacturar: (data.otsListasParaFacturar ?? []).filter(n => n !== otNumber) } : {}),
          ...(d.nuevoEstado ? { estado: d.nuevoEstado } : {}),
          updatedAt: fecha,
        }));
        presupuestosTocados.push(p.id);
      }
    }

    const reapertura: ReaperturaOT = {
      id: crypto.randomUUID(), fecha, actorUid: actor.uid, actorNombre: actor.nombre, motivo, nivel,
      estadoDesde: ot.estadoAdmin ?? null, estadoHasta, origen, avisos,
    };
    const pdfAnterior: PdfAnteriorOT | null = nivel === 'tecnica' && (ot.pdfUrl || ot.pdfGeneratedAt)
      ? { pdfUrl: ot.pdfUrl ?? null, protocolPdfUrl: ot.protocolPdfUrl ?? null, pdfGeneratedAt: ot.pdfGeneratedAt ?? null, fecha, backups: [] }
      : null;

    const patch: Record<string, unknown> = {
      estadoAdmin: estadoHasta,
      estadoAdminFecha: fecha,
      estadoHistorial: [...(ot.estadoHistorial ?? []), { estado: estadoHasta, fecha, usuario: actor.nombre, nota: `Reabierta (${nivel}): ${motivo}` }],
      fechaCierre: null,
      reaperturas: [...(ot.reaperturas ?? []), reapertura],
      facturacionBloqueada: bloqueo,
      updatedAt: Timestamp.now(),
      updatedBy: actor.uid,
      updatedByName: actor.nombre,
    };
    if (ot.cierreAdmin) {
      patch['cierreAdmin.avisoAdminEnviado'] = false;
      patch['cierreAdmin.fechaCierreAdmin'] = null;
    }
    if (nivel === 'tecnica') {
      // BORRADOR = el técnico vuelve a editar en reportes-ot. Sin `pdfGeneratedAt`
      // el guard anti-pisado de esa app deja pasar el autosave (el PDF viejo
      // sigue en `pdfUrl` y se resguarda aparte). Firma del cliente: se borra
      // (decisión D1) — el cliente vuelve a firmar al finalizar.
      patch.status = 'BORRADOR';
      patch.pdfGeneratedAt = null;
      patch.pdfAnterior = pdfAnterior;
      patch.signatureClient = null;
      patch.signedAt = null;
      patch.signedFrom = null;
      patch.clientSignatureNotified = null;
    }
    tx.update(otRef, patch as { [k: string]: any });
    return { reapertura, pdfAnterior, ot: { ...ot, ...patch, otNumber } as WorkOrder };
  });

  return { ...resultado, presupuestosTocados };
}

/** Path de Storage dentro de una download URL de Firebase. */
function storagePathFromUrl(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/\/o\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

/**
 * Copia los PDFs del cierre anterior a `reports/{ot}/backups/` antes de que
 * el técnico los regenere (re-finalizar pisa el mismo path). Best-effort:
 * devuelve los paths que sí se resguardaron y los deja en `pdfAnterior.backups`.
 */
export async function resguardarPdfsReapertura(db: Firestore, storage: FirebaseStorage, otNumber: string, pdfAnterior: PdfAnteriorOT | null): Promise<string[]> {
  if (!pdfAnterior) return [];
  const ts = pdfAnterior.fecha.replace(/[:.]/g, '-');
  const backups: string[] = [];
  for (const url of [pdfAnterior.pdfUrl, pdfAnterior.protocolPdfUrl]) {
    if (!url) continue;
    const path = storagePathFromUrl(url);
    if (!path) continue;
    try {
      const bytes = await getBytes(ref(storage, path), 80 * 1024 * 1024);
      const nombre = path.split('/').pop() || 'reporte.pdf';
      const destino = `reports/${otNumber}/backups/reapertura_${ts}_${nombre}`;
      await uploadBytes(ref(storage, destino), bytes, { contentType: 'application/pdf' });
      backups.push(destino);
    } catch (err) {
      console.warn(`[reaperturaOT] no se pudo resguardar ${path}:`, err);
    }
  }
  if (backups.length > 0) {
    await updateDoc(doc(db, 'reportes', otNumber), { 'pdfAnterior.backups': backups }).catch(() => undefined);
  }
  return backups;
}

/**
 * Deja constancia en los tickets abiertos que referencian la OT (el de origen,
 * el "Revisar cierre de OT", el de acciones). No cambia estados (decisión D4).
 */
export async function anotarReaperturaEnTickets(db: Firestore, otNumber: string, reapertura: ReaperturaOT): Promise<number> {
  const snap = await getDocs(query(collection(db, 'leads'), where('otIds', 'array-contains', otNumber)));
  const abiertos = snap.docs.filter(d => !['finalizado', 'no_concretado'].includes(d.data().estado as string));
  await Promise.all(abiertos.map(d => {
    const lead = d.data() as Lead;
    const posta: Posta = {
      id: crypto.randomUUID(),
      fecha: reapertura.fecha,
      deUsuarioId: reapertura.actorUid,
      deUsuarioNombre: reapertura.actorNombre,
      aUsuarioId: lead.asignadoA || reapertura.actorUid,
      aUsuarioNombre: lead.asignadoNombre || reapertura.actorNombre,
      estadoAnterior: lead.estado,
      estadoNuevo: lead.estado,
      evento: `OT ${otNumber} reabierta (${reapertura.nivel === 'tecnica' ? 'reporte técnico' : 'cierre administrativo'}) por ${reapertura.actorNombre}`,
      comentario: reapertura.motivo,
    };
    return updateDoc(d.ref, { postas: arrayUnion(deepCleanForFirestore(posta)), updatedAt: Timestamp.now() });
  }));
  return abiertos.length;
}

/**
 * Ticket para el ingeniero asignado tras una reapertura TÉCNICA: tiene que
 * avisarle al cliente y volver a firmar. El caller lo crea con su
 * `leadsService.create` (numeración y auto-asignación propias de cada app).
 */
export function buildTicketAvisoReaperturaTecnica(ot: WorkOrder, reapertura: ReaperturaOT): Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    clienteId: ot.clienteId ?? null,
    contactoId: null,
    razonSocial: ot.razonSocial || '',
    contactos: [],
    contacto: ot.contacto || '',
    email: ot.emailPrincipal || '',
    telefono: '',
    motivoLlamado: 'soporte',
    motivoContacto: `Reapertura de reporte — OT ${ot.otNumber}`,
    descripcion: `El reporte de la OT ${ot.otNumber} fue reabierto por ${reapertura.actorNombre}.\nMotivo: ${reapertura.motivo}\n\n${TEXTO_AVISO_REAPERTURA_TECNICA}`,
    sistemaId: ot.sistemaId ?? null,
    moduloId: ot.moduloId ?? null,
    estado: 'nuevo',
    postas: [],
    asignadoA: ot.ingenieroAsignadoId ?? null,
    asignadoNombre: ot.ingenieroAsignadoNombre ?? null,
    derivadoPor: reapertura.actorUid,
    areaActual: 'ing_soporte',
    esAutogenerado: true,
    accionPendiente: 'Informar al cliente y volver a firmar el reporte',
    adjuntos: [],
    presupuestosIds: [],
    otIds: [ot.otNumber],
    finalizadoAt: null,
    prioridad: 'urgente',
    proximoContacto: null,
    valorEstimado: null,
  } as unknown as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>;
}
