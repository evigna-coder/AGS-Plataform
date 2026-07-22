/**
 * Baja automática de lotes de patrones vencidos + ticket de descarte.
 *
 * Se dispara al cargar el listado de patrones (client-side sweep, mismo patrón
 * que otras migraciones lazy — no hay cron server-side). Para cada lote activo
 * con fecha de vencimiento pasada:
 *   1. `patronesService.darDeBajaLote` lo mueve al historial (`lotesBaja`) de
 *      forma transaccional — si otro cliente lo procesó primero devuelve null
 *      y acá NO se genera ticket (guard anti-duplicado).
 *   2. Se crea un ticket en área Administración de Soporte para el descarte
 *      físico, asignado al responsable de materiales/comercio exterior.
 *   3. El id del ticket queda vinculado a la entrada del historial.
 */
import { calcularEstadoCertificado, type Patron, type PatronLote, type Lead } from '@ags/shared';
import { patronesService } from '../services/patronesService';
import { leadsService, usuariosService } from '../services/firebaseService';

/** Responsable de materiales y comercio exterior — destinatario del ticket de
 *  descarte (decisión dirección 2026-07-21). Se resuelve por email para no
 *  hardcodear uids; si no está activo, el ticket queda sin asignar en el área. */
const RESPONSABLE_DESCARTE_EMAIL = 'evigna@agsanalitica.com';

function formatFechaAR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

async function resolverResponsable(): Promise<{ id: string; nombre: string } | null> {
  try {
    const usuarios = await usuariosService.getAll();
    const u = usuarios.find(x => x.email?.toLowerCase() === RESPONSABLE_DESCARTE_EMAIL && x.status === 'activo');
    return u ? { id: u.id, nombre: u.displayName } : null;
  } catch {
    return null;
  }
}

async function crearTicketDescarte(
  patron: Patron,
  lote: PatronLote,
  responsable: { id: string; nombre: string } | null,
): Promise<string | null> {
  const desc = [
    `Descartar patrón vencido: ${patron.codigoArticulo} — ${patron.descripcion}${patron.marca ? ` (${patron.marca})` : ''}.`,
    `Lote ${lote.lote}, venció el ${formatFechaAR(lote.fechaVencimiento)}.`,
    typeof lote.cantidad === 'number' ? `Cantidad registrada: ${lote.cantidad}.` : null,
    'El lote fue dado de baja automáticamente del listado de patrones; el certificado queda consultable en el historial del patrón.',
  ].filter(Boolean).join(' ');

  const lead: Omit<Lead, 'id' | 'updatedAt'> = {
    clienteId: null,
    contactoId: null,
    razonSocial: 'AGS Analítica — Interno',
    contacto: '',
    email: '',
    telefono: '',
    motivoLlamado: 'otros',
    motivoOtros: 'Descarte de patrón vencido',
    motivoContacto: `Descarte patrón vencido · ${patron.codigoArticulo} lote ${lote.lote}`,
    sistemaId: null,
    estado: 'nuevo',
    postas: [],
    asignadoA: responsable?.id ?? null,
    asignadoNombre: responsable?.nombre ?? null,
    derivadoPor: null,
    areaActual: 'admin_soporte',
    descripcion: desc,
    prioridad: 'normal',
    otIds: [],
    presupuestosIds: [],
    source: 'manual',
    createdAt: new Date().toISOString(),
  };

  try {
    return await leadsService.create(lead);
  } catch (err) {
    console.error('No se pudo crear ticket de descarte para patrón', patron.codigoArticulo, 'lote', lote.lote, err);
    return null;
  }
}

/** Devuelve la cantidad de lotes dados de baja en esta pasada. */
export async function procesarLotesVencidos(): Promise<number> {
  let procesados = 0;
  let responsable: { id: string; nombre: string } | null | undefined;
  const patrones = await patronesService.getAll({ activoOnly: true });
  for (const patron of patrones) {
    const vencidos = patron.lotes.filter(l => calcularEstadoCertificado(l.fechaVencimiento) === 'vencido');
    for (const lote of vencidos) {
      const entry = await patronesService.darDeBajaLote(patron.id, lote.lote, 'vencido');
      if (!entry) continue; // otro cliente lo procesó — sin ticket duplicado
      procesados++;
      if (responsable === undefined) responsable = await resolverResponsable();
      const ticketId = await crearTicketDescarte(patron, entry.lote, responsable);
      if (ticketId) {
        try { await patronesService.setTicketDeBaja(patron.id, entry.id, ticketId); } catch { /* best-effort */ }
      }
    }
  }
  return procesados;
}
