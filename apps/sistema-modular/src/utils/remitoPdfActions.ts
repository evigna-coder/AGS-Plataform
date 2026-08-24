import { pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { mostrarPdfEnVentana, mostrarPdfEnOverlay } from './ventanaPdf';

/**
 * Genera el PDF y lo abre en una pestaña nueva, listo para imprimir.
 *
 * Patrón pensado para overlays sobre papel preimpreso: el usuario carga el papel
 * en la impresora, presiona Ctrl+P en la pestaña abierta y queda impreso.
 */
export async function openRemitoPdfInNewTab(doc: ReactElement, ventana?: Window | null): Promise<void> {
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);

  // Si el caller no la pre-abrió, se intenta igual: funciona cuando la
  // generación fue lo bastante rápida como para no perder el gesto.
  const win = ventana ?? window.open(url, '_blank');

  if (!win) {
    // Pop-up bloqueado — se muestra ACÁ en vez de descargar. Descargar era lo
    // que hacía aparecer "Guardar como" cuando el usuario pedía ver el PDF.
    mostrarPdfEnOverlay(url);
    setTimeout(() => URL.revokeObjectURL(url), 300_000);
    return;
  }

  if (ventana) {
    mostrarPdfEnVentana(ventana, url);
  }

  // Liberamos el blob URL después de un rato (la pestaña ya cargó el PDF).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Genera el PDF y dispara la descarga directa con el nombre indicado.
 *
 * En Electron, abrir blob: en una nueva ventana fallaba ("obtener aplicación
 * para este vínculo"). Usar el patrón <a download> evita el handler de blob
 * y aterriza directo en el diálogo "Guardar como" con el nombre correcto.
 *
 * Usar para listados/reportes que se descargan, no para overlays a imprimir.
 */
export async function downloadPdf(doc: ReactElement, filename: string): Promise<void> {
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Genera el PDF e intenta IMPRIMIRLO EN SILENCIO a la impresora predeterminada
 * (vía Electron `electronAPI.printPdfSilent` → main process, ventana oculta + print).
 * Sin abrir nada. Fallbacks: si no estamos en Electron, o si la impresión falla,
 * cae al patrón de abrir el PDF en pestaña para Ctrl+P. El PDF ya trae las N copias
 * como páginas (RemitoOverlayPDF copies=3), así que sale el triplicado en una operación.
 *
 * Devuelve `true` si imprimió en silencio; `false` si cayó al fallback de abrir.
 */
export async function printRemitoSilentOrOpen(doc: ReactElement): Promise<boolean> {
  const api = typeof window !== 'undefined'
    ? (window as unknown as { electronAPI?: { printPdfSilent?: (buf: Uint8Array) => Promise<{ success: boolean; failureReason?: string | null }> } }).electronAPI
    : undefined;
  if (api?.printPdfSilent) {
    try {
      const blob = await pdf(doc).toBlob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      const res = await api.printPdfSilent(buf);
      if (res?.success) return true;
      console.warn('[printRemitoSilent] la impresión falló, abro el PDF:', res?.failureReason);
    } catch (err) {
      console.warn('[printRemitoSilent] IPC falló, abro el PDF:', err);
    }
  }
  // No Electron (browser) o falló la impresión → abrir para Ctrl+P.
  await openRemitoPdfInNewTab(doc);
  return false;
}

/** dd-mm-yyyy de la fecha actual, para usar como sufijo en filenames. */
export function todayForFilename(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
