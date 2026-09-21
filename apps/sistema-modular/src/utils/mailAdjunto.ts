/**
 * Correos como adjuntos de OC (2026-09-19). Outlook no entrega el mail como
 * archivo al arrastrarlo directo a la app (Chromium no lee su formato de
 * arrastre), pero sí al arrastrarlo primero a una carpeta: .msg en el Outlook
 * clásico, .eml en el nuevo. Ese archivo se acepta acá y se convierte a PDF
 * en el navegador (encabezado + cuerpo + lista de adjuntos); el original y los
 * PDF/imágenes que traía adentro se adjuntan aparte.
 *
 * Las librerías de parseo se cargan bajo demanda: solo pesan cuando alguien
 * suelta un mail.
 */
import { pdf } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import { MailPDF } from '../components/presupuestos/pdf/MailPDF';
import { esArchivoDeMail, parsearMail, type MailParseado } from './mailParse';

export { esArchivoDeMail, parsearMail } from './mailParse';
export type { MailParseado, MailAdjuntoInterno } from './mailParse';

const EXT_MAIL = /\.(msg|eml)$/i;
/** Lo que los modales de OC ya aceptaban por selector; se aplica a lo que trae el mail adentro. */
const EXT_ADJUNTO_UTIL = /\.(pdf|jpe?g|png|docx?|xlsx?)$/i;

function nombreDePdf(mail: MailParseado, original: string): string {
  const base = (mail.asunto || original.replace(EXT_MAIL, '')).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `Mail - ${base || 'correo'}.pdf`;
}

export interface MailConvertido {
  /** El correo convertido a PDF: encabezado, cuerpo y lista de adjuntos. */
  pdf: File;
  /** El .msg / .eml tal cual llegó. */
  original: File;
  /** PDF, imágenes y documentos que venían adentro del mail. */
  adjuntosInternos: File[];
  mail: MailParseado;
}

export async function convertirMailAPdf(file: File): Promise<MailConvertido> {
  const mail = await parsearMail(file);
  // createElement devuelve el elemento tipado con las props del componente; pdf() pide DocumentProps.
  const blob = await pdf(createElement(MailPDF, { mail, archivoOriginal: file.name }) as ReactElement).toBlob();
  const pdfFile = new File([blob], nombreDePdf(mail, file.name), { type: 'application/pdf' });
  const adjuntosInternos = mail.adjuntos
    .filter(a => EXT_ADJUNTO_UTIL.test(a.nombre))
    .map(a => new File([a.datos as BlobPart], a.nombre, { type: a.mime }));
  return { pdf: pdfFile, original: file, adjuntosInternos, mail };
}

/**
 * Lo que se sube por un mail: el PDF, el original y lo útil que traía adentro.
 * Los archivos que no son mails pasan tal cual. Un mail que no se pudo leer
 * se sube igual como archivo (mejor el .msg crudo que perder la OC) y se avisa.
 */
export async function expandirArchivosOC(
  files: File[],
  avisar?: (msg: string, tipo: 'ok' | 'error') => void,
): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    if (!esArchivoDeMail(f)) { out.push(f); continue; }
    try {
      const c = await convertirMailAPdf(f);
      out.push(c.pdf, c.original, ...c.adjuntosInternos);
      avisar?.(
        `Correo convertido a PDF${c.adjuntosInternos.length > 0 ? ` (+${c.adjuntosInternos.length} adjunto(s) del mail)` : ''}: ${c.mail.asunto || f.name}`,
        'ok',
      );
    } catch (err) {
      console.error('[mailAdjunto] no se pudo convertir el correo:', err);
      out.push(f);
      avisar?.(`No se pudo convertir ${f.name} a PDF; se adjunta el correo tal cual.`, 'error');
    }
  }
  return out;
}
