/**
 * Builders puros para el subject + body HTML del mail de envío de reportes.
 *
 * Dos variantes:
 *  - 'reporte-solo': adjunta únicamente el reporte de OT (sin protocolo ni docs)
 *  - 'reporte-con-anexos': adjunta reporte + protocolo + certificados/trazabilidad
 *
 * El switch se hace en `useSendReportByEmail` según haya protocolBlob o no.
 */

import { formatDateToDDMMYYYY } from '../services/utils';

export type EmailVariant = 'reporte-solo' | 'reporte-con-anexos';

export interface EmailContentParams {
  otNumber: string;
  razonSocial: string;
  contactoPrincipal: string;   // Persona de contacto (form.contacto). Si vacío → fallback "Estimado/a"
  sistema: string;
  moduloModelo: string;
  moduloSerie: string;
  fechaInicio: string;          // ISO
  fechaFin: string;              // ISO
  tecnicoNombre: string;         // aclaracionEspecialista
}

export function buildSubject(params: EmailContentParams): string {
  const { otNumber, razonSocial, sistema } = params;
  const parts = [`Reporte de OT #${otNumber}`];
  if (razonSocial) parts.push(razonSocial);
  if (sistema) parts.push(sistema);
  return parts.join(' — ');
}

function greeting(contactoPrincipal: string): string {
  const name = contactoPrincipal?.trim();
  return name ? `Estimado/a ${name},` : 'Estimado / Estimada,';
}

function fmtDateRange(fechaInicio: string, fechaFin: string): string {
  const ini = fechaInicio ? formatDateToDDMMYYYY(fechaInicio) : '';
  const fin = fechaFin ? formatDateToDDMMYYYY(fechaFin) : '';
  if (ini && fin && ini !== fin) return `${ini} → ${fin}`;
  return ini || fin || 's/d';
}

function fmtFechaIntervencion(fechaInicio: string): string {
  return fechaInicio ? formatDateToDDMMYYYY(fechaInicio) : 'la fecha indicada';
}

function buildResumenLines(params: EmailContentParams): string {
  const { otNumber, sistema, moduloModelo, tecnicoNombre, fechaInicio, fechaFin } = params;
  const lines: string[] = [];
  lines.push(`<li>OT: #${escapeHtml(otNumber)}</li>`);
  if (sistema) {
    const equipo = moduloModelo ? `${sistema} — ${moduloModelo}` : sistema;
    lines.push(`<li>Equipo: ${escapeHtml(equipo)}</li>`);
  }
  if (tecnicoNombre) lines.push(`<li>Técnico: ${escapeHtml(tecnicoNombre)}</li>`);
  lines.push(`<li>Fecha: ${escapeHtml(fmtDateRange(fechaInicio, fechaFin))}</li>`);
  return lines.join('\n      ');
}

function buildIntro(params: EmailContentParams, variant: EmailVariant): string {
  const fechaInt = fmtFechaIntervencion(params.fechaInicio);
  const equipo = params.sistema || 'el equipo';
  const sn = params.moduloSerie ? ` (S/N ${escapeHtml(params.moduloSerie)})` : '';

  if (variant === 'reporte-con-anexos') {
    return `Adjuntamos el reporte de la orden de trabajo realizada el día ${escapeHtml(fechaInt)} ` +
           `sobre el equipo ${escapeHtml(equipo)}${sn}, junto con el protocolo de calificación ` +
           `y los certificados de los instrumentos utilizados.`;
  }
  return `Adjuntamos el reporte de la orden de trabajo realizada el día ${escapeHtml(fechaInt)} ` +
         `sobre el equipo ${escapeHtml(equipo)}${sn}.`;
}

function buildAttachmentList(variant: EmailVariant): string {
  if (variant === 'reporte-solo') return '';
  return `
      <p style="margin: 16px 0 6px 0;">Archivos adjuntos:</p>
      <ul style="margin: 0 0 16px 18px; padding: 0;">
        <li>Reporte de OT</li>
        <li>Protocolo de calificación</li>
        <li>Certificados de trazabilidad de instrumentos</li>
      </ul>`;
}

export function buildHtmlBody(params: EmailContentParams, variant: EmailVariant): string {
  const greetingText = escapeHtml(greeting(params.contactoPrincipal));
  const intro = buildIntro(params, variant);
  const resumen = buildResumenLines(params);
  const attachmentList = buildAttachmentList(variant);
  const tecnico = escapeHtml(params.tecnicoNombre || 'Equipo Técnico AGS');

  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.55; max-width: 640px; margin: 0 auto; padding: 16px;">
  <div>
    <p style="margin: 0 0 12px 0;">${greetingText}</p>

    <p style="margin: 0 0 12px 0;">${intro}</p>

    <p style="margin: 12px 0 6px 0;">Resumen:</p>
    <ul style="margin: 0 0 12px 18px; padding: 0;">
      ${resumen}
    </ul>
${attachmentList}
    <p style="margin: 16px 0 12px 0;">
      Cualquier consulta sobre los trabajos realizados, no dude en responder a este mail.
    </p>

    <p style="margin: 16px 0 4px 0;">Saludos cordiales,</p>
    <p style="margin: 0; font-weight: bold;">${tecnico}</p>
    <p style="margin: 0; color: #4b5563; font-size: 13px;">AGS Analítica</p>
  </div>
</body>
</html>`;
}

/**
 * Resolver de destinatarios. Toma el principal (si tiene email) + extras DB +
 * manuales (los que tengan email cargado). Deduplica case-insensitive.
 */
export function resolveRecipients(
  emailPrincipal: string,
  destinatariosExtras: string[],
  destinatariosManuales: { nombre: string; email: string }[],
  contactosDB: { id: string; email: string }[],
): string[] {
  const out = new Set<string>();
  const push = (e: string | undefined | null) => {
    const trimmed = (e ?? '').trim().toLowerCase();
    if (trimmed && /\S+@\S+\.\S+/.test(trimmed)) out.add(trimmed);
  };
  push(emailPrincipal);
  for (const id of destinatariosExtras) {
    const c = contactosDB.find(x => x.id === id);
    if (c) push(c.email);
  }
  for (const m of destinatariosManuales) push(m.email);
  return Array.from(out);
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
