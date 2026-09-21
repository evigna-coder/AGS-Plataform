/**
 * Lectura de correos guardados como archivo (2026-09-19): .eml (MIME) con
 * postal-mime y .msg (Outlook) con @kenjiuno/msgreader. Sin react-pdf ni DOM:
 * se testea en node (`test:mail-adjunto`). Las librerías se cargan bajo demanda.
 */
export interface MailAdjuntoInterno {
  nombre: string;
  mime: string;
  datos: Uint8Array;
}

export interface MailParseado {
  asunto: string;
  de: string;
  para: string[];
  cc: string[];
  /** ISO o null si el archivo no la trae. */
  fecha: string | null;
  html: string | null;
  texto: string | null;
  adjuntos: MailAdjuntoInterno[];
}

const EXT_MAIL = /\.(msg|eml)$/i;

export function esArchivoDeMail(file: Pick<File, 'name' | 'type'>): boolean {
  return EXT_MAIL.test(file.name) || file.type === 'message/rfc822' || file.type === 'application/vnd.ms-outlook';
}

function nombreConMail(a: { name?: string | null; address?: string | null } | null | undefined): string {
  if (!a) return '';
  const nombre = (a.name ?? '').trim();
  const mail = (a.address ?? '').trim();
  return nombre && mail && nombre !== mail ? `${nombre} <${mail}>` : (mail || nombre);
}

function decodificar(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  // Muchos .msg guardan el HTML en Windows-1252; si el UTF-8 viene roto, se reintenta.
  if ((utf8.match(/�/g)?.length ?? 0) > 2) {
    try { return new TextDecoder('windows-1252').decode(bytes); } catch { /* sin soporte: queda el utf-8 */ }
  }
  return utf8;
}

async function parsearEml(buffer: ArrayBuffer): Promise<MailParseado> {
  const { default: PostalMime } = await import('postal-mime');
  const m = await PostalMime.parse(buffer);
  const adjuntos: MailAdjuntoInterno[] = m.attachments
    .filter(a => a.disposition !== 'inline' || !a.contentId)
    .map(a => ({
      nombre: a.filename || 'adjunto',
      mime: a.mimeType || 'application/octet-stream',
      datos: typeof a.content === 'string' ? new TextEncoder().encode(a.content) : new Uint8Array(a.content as ArrayBuffer),
    }));
  return {
    asunto: m.subject ?? '',
    de: nombreConMail(m.from),
    para: (m.to ?? []).map(nombreConMail).filter(Boolean),
    cc: (m.cc ?? []).map(nombreConMail).filter(Boolean),
    fecha: m.date ?? null,
    html: m.html ?? null,
    texto: m.text ?? null,
    adjuntos,
  };
}

async function parsearMsg(buffer: ArrayBuffer): Promise<MailParseado> {
  const { default: MsgReader } = await import('@kenjiuno/msgreader');
  const reader = new MsgReader(buffer);
  const f = reader.getFileData();
  const recipientes = (f.recipients ?? []).map(r => ({ nombre: nombreConMail({ name: r.name, address: r.email }), tipo: r.recipType ?? 'to' }));
  const adjuntos: MailAdjuntoInterno[] = [];
  for (const att of f.attachments ?? []) {
    if (att.innerMsgContent) continue; // mail embebido: no es un archivo
    try {
      const a = reader.getAttachment(att);
      adjuntos.push({ nombre: a.fileName || att.fileName || 'adjunto', mime: att.attachMimeTag || 'application/octet-stream', datos: a.content });
    } catch (err) {
      console.warn('[mailAdjunto] adjunto del .msg ilegible:', att.fileName, err);
    }
  }
  return {
    asunto: f.subject ?? '',
    de: nombreConMail({ name: f.senderName, address: f.senderEmail }),
    para: recipientes.filter(r => r.tipo === 'to').map(r => r.nombre).filter(Boolean),
    cc: recipientes.filter(r => r.tipo === 'cc').map(r => r.nombre).filter(Boolean),
    fecha: f.clientSubmitTime ?? f.messageDeliveryTime ?? f.creationTime ?? null,
    html: f.html ? decodificar(f.html) : null,
    texto: f.body ?? null,
    adjuntos,
  };
}

export async function parsearMail(file: File): Promise<MailParseado> {
  const buffer = await file.arrayBuffer();
  return /\.msg$/i.test(file.name) || file.type === 'application/vnd.ms-outlook'
    ? parsearMsg(buffer)
    : parsearEml(buffer);
}

