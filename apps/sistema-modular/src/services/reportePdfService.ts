/**
 * Anexa documentos al PDF definitivo de un reporte YA finalizado.
 *
 * Caso de uso: el ingeniero olvidó adjuntar documentación; la OT quedó cerrada
 * con su PDF definitivo. El admin agrega el documento desde el cierre y queda
 * incorporado al MISMO archivo (un solo PDF), como si se hubiera adjuntado desde
 * el principio.
 *
 * Diseño deliberado: NO se re-corre el pipeline frágil de reportes-ot (Hoja 1 →
 * html2canvas → merge). El PDF definitivo ya existe en Storage; acá solo se le
 * ANEXAN páginas con pdf-lib y se vuelve a subir al mismo path. Por eso esta
 * lógica puede vivir en sistema-modular sin tocar la superficie congelada.
 *
 * Reversibilidad: antes de sobrescribir se guarda un backup del PDF previo, y el
 * archivo fuente se sube aparte. Ambos paths quedan registrados en el doc del
 * reporte (`documentosAdicionales[]`).
 */
import { ref, getDownloadURL, getBytes, uploadBytes } from 'firebase/storage';
import { PDFDocument } from 'pdf-lib';
import { storage } from './firebase';
import { ordenesTrabajoService } from './otService';
import { getCurrentUserTrace } from './currentUser';
import type { DocumentoAdicionalReporte } from '@ags/shared';

// Candidatos donde puede vivir el PDF definitivo. El canónico (lo que escribe
// reportes-ot) es `reports/${ot}/reporte.pdf`; el resto son fallbacks legacy.
// OJO: las reglas de Storage (apps/sistema-modular/storage.rules) solo permiten
// escribir bajo `reports/` — backups y archivos fuente van SIEMPRE ahí.
const candidatePaths = (ot: string) => [
  `reports/${ot}/reporte.pdf`,
  `reportes/${ot}/reporte.pdf`,
  `reportes/${ot}.pdf`,
];

const A4 = { w: 595.28, h: 841.89 }; // puntos PDF
const MARGIN = 36;
const MAX_DOWNLOAD = 80 * 1024 * 1024; // 80 MB tope de descarga del PDF actual

const ACCEPTED_MIMES = ['application/pdf', 'image/png', 'image/jpeg'];

export interface ResolvedReportePdf {
  path: string;
  url: string;
}

/**
 * Extrae el path de Storage de una download URL de Firebase.
 * `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>?...`
 * → decodeURIComponent(ENCODED_PATH).
 */
function storagePathFromDownloadUrl(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/\/o\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Resuelve el path + URL del PDF definitivo del reporte, o null si no existe.
 *
 * Fuente principal: el campo `pdfUrl` que reportes-ot guarda en `reportes/{ot}`.
 * El nombre real del archivo NO es `reporte.pdf` sino algo como
 * "Reporte de servicio N° 25660 - HPLC.pdf", así que adivinar el path no sirve;
 * de la `pdfUrl` derivamos el path real para poder re-subir/backupear.
 * Los `candidatePaths` quedan solo como fallback para OTs legacy sin `pdfUrl`.
 */
async function resolveReportePdf(otNumber: string): Promise<ResolvedReportePdf | null> {
  try {
    const ot = await ordenesTrabajoService.getByOtNumber(otNumber);
    if (ot?.pdfUrl) {
      const path = storagePathFromDownloadUrl(ot.pdfUrl);
      if (path) return { path, url: ot.pdfUrl };
    }
  } catch {
    // sigue al fallback por paths
  }

  for (const path of candidatePaths(otNumber)) {
    try {
      const url = await getDownloadURL(ref(storage, path));
      return { path, url };
    } catch {
      // siguiente candidato
    }
  }
  return null;
}

/**
 * Anexa `file` (PDF, JPG o PNG) al final del PDF definitivo del reporte y
 * sobrescribe el archivo en Storage. Registra el documento en el doc del reporte.
 *
 * @throws si el tipo de archivo no es soportado o si no hay PDF definitivo.
 */
async function appendDocumentToReportPdf(
  otNumber: string,
  file: File,
): Promise<{ paginasAgregadas: number }> {
  const mime = file.type;
  if (!ACCEPTED_MIMES.includes(mime)) {
    throw new Error('Solo se pueden anexar archivos PDF, JPG o PNG al reporte.');
  }

  const resolved = await resolveReportePdf(otNumber);
  if (!resolved) {
    throw new Error(
      'No se encontró el PDF definitivo del reporte en Storage. Generá el reporte desde reportes-ot antes de anexar documentos.',
    );
  }

  // 1. Descargar el PDF definitivo actual.
  const existingBytes = await getBytes(ref(storage, resolved.path), MAX_DOWNLOAD);

  const ts = Date.now();

  // 2. Backup del PDF previo (reversible) antes de sobrescribir.
  //    Bajo `reports/` para respetar las reglas de Storage.
  const backupPath = `reports/${otNumber}/backups/reporte_${ts}.pdf`;
  await uploadBytes(ref(storage, backupPath), existingBytes, { contentType: 'application/pdf' });

  // 3. Guardar el archivo fuente aparte (trazabilidad / recuperable).
  const safeName = file.name.replace(/[^\w.\-]/g, '_');
  const sourcePath = `reports/${otNumber}/documentos-adicionales/${ts}_${safeName}`;
  await uploadBytes(ref(storage, sourcePath), file, {
    contentType: mime || 'application/octet-stream',
  });
  const sourceUrl = await getDownloadURL(ref(storage, sourcePath));

  // 4. Anexar al PDF con pdf-lib.
  const base = await PDFDocument.load(existingBytes);
  const docBytes = new Uint8Array(await file.arrayBuffer());
  let paginasAgregadas = 0;

  if (mime === 'application/pdf') {
    const donor = await PDFDocument.load(docBytes);
    const pages = await base.copyPages(donor, donor.getPageIndices());
    pages.forEach(p => base.addPage(p));
    paginasAgregadas = pages.length;
  } else {
    const img = mime === 'image/png'
      ? await base.embedPng(docBytes)
      : await base.embedJpg(docBytes);
    const page = base.addPage([A4.w, A4.h]);
    const maxW = A4.w - MARGIN * 2;
    const maxH = A4.h - MARGIN * 2;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (A4.w - w) / 2, y: (A4.h - h) / 2, width: w, height: h });
    paginasAgregadas = 1;
  }

  const mergedBytes = await base.save();

  // 5. Re-subir al MISMO path. OJO: sobrescribir genera un downloadToken nuevo,
  //    así que la pdfUrl vieja queda inválida → hay que releer la URL y persistirla.
  await uploadBytes(ref(storage, resolved.path), mergedBytes, { contentType: 'application/pdf' });
  const newPdfUrl = await getDownloadURL(ref(storage, resolved.path));

  // 6. Registrar en reportes/{otNumber} (incluye la pdfUrl refrescada).
  const actor = getCurrentUserTrace();
  const entry: DocumentoAdicionalReporte = {
    fileName: file.name,
    storagePath: sourcePath,
    url: sourceUrl,
    mimeType: mime,
    sizeBytes: file.size,
    paginasAgregadas,
    backupPath,
    agregadoAt: new Date().toISOString(),
    agregadoPor: actor ? { uid: actor.uid, nombre: actor.name } : null,
  };
  await ordenesTrabajoService.registrarDocumentoAdicional(otNumber, entry, newPdfUrl);

  return { paginasAgregadas };
}

export const reportePdfService = {
  resolveReportePdf,
  appendDocumentToReportPdf,
};
