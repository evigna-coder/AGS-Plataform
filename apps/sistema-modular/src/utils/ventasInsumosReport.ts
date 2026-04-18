import type { Lead, UsuarioAGS } from '@ags/shared';
import { TICKET_ESTADO_LABELS } from '@ags/shared';

export interface VentasInsumosReportRow {
  ticketId: string;
  fechaCreacion: string;       // ISO
  razonSocial: string;
  contacto: string;
  creadoPor: string;            // usuario que creó el ticket con motivo ventas_insumos
  responsable: string;          // último que movió el ticket, fallback createdBy
  estadoActual: string;         // label humano
  ultimoMovimiento: string;    // ISO
  valorEstimado: number | null;
  descripcion: string;
  resultado: 'Resuelto' | 'Sin resolver' | 'En curso';
}

export interface VentasInsumosRangeLabel {
  desde: string; // ISO
  hasta: string; // ISO
  label: string; // "Esta semana" / "Este mes" / "Custom"
}

function resolveUserName(userId: string | undefined | null, usuarios: UsuarioAGS[]): string {
  if (!userId) return '—';
  const u = usuarios.find(x => x.id === userId);
  return u?.displayName || u?.email || userId;
}

function resolveResponsable(lead: Lead, usuarios: UsuarioAGS[]): string {
  const lastPosta = (lead.postas || []).slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];
  if (lastPosta?.deUsuarioNombre) return lastPosta.deUsuarioNombre;
  return resolveUserName(lead.createdBy, usuarios);
}

function resolveContactoPrincipal(lead: Lead): string {
  const principal = (lead.contactos || []).find(c => c.esPrincipal);
  if (principal?.nombre) return principal.nombre;
  return lead.contacto || '—';
}

function resolveResultado(lead: Lead): VentasInsumosReportRow['resultado'] {
  if (lead.estado === 'finalizado') return 'Resuelto';
  if (lead.estado === 'no_concretado') return 'Sin resolver';
  return 'En curso';
}

export function buildVentasInsumosRows(leads: Lead[], usuarios: UsuarioAGS[]): VentasInsumosReportRow[] {
  return leads.map(lead => ({
    ticketId: lead.id,
    fechaCreacion: lead.createdAt,
    razonSocial: lead.razonSocial || '—',
    contacto: resolveContactoPrincipal(lead),
    creadoPor: resolveUserName(lead.ventasInsumosCreadoPor || lead.createdBy, usuarios),
    responsable: resolveResponsable(lead, usuarios),
    estadoActual: TICKET_ESTADO_LABELS[lead.estado] || lead.estado,
    ultimoMovimiento: lead.updatedAt,
    valorEstimado: typeof lead.valorEstimado === 'number' ? lead.valorEstimado : null,
    descripcion: (lead.motivoContacto || lead.descripcion || '').trim(),
    resultado: resolveResultado(lead),
  }));
}

export function fmtDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtCurrencyARS(n: number | null): string {
  if (n === null) return '';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

/** Lunes 00:00 → Domingo 23:59 de la semana actual (hora local). */
export function thisWeekRange(): VentasInsumosRangeLabel {
  const now = new Date();
  const offsetSinceMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - offsetSinceMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { desde: monday.toISOString(), hasta: sunday.toISOString(), label: 'Esta semana' };
}

export function thisMonthRange(): VentasInsumosRangeLabel {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { desde: first.toISOString(), hasta: last.toISOString(), label: 'Este mes' };
}

export function lastMonthRange(): VentasInsumosRangeLabel {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { desde: first.toISOString(), hasta: last.toISOString(), label: 'Mes anterior' };
}
