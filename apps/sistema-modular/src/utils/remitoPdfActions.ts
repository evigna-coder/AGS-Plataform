import { pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

/**
 * Genera el PDF y lo abre en una pestaña nueva, listo para imprimir.
 *
 * Patrón pensado para overlays sobre papel preimpreso: el usuario carga el papel
 * en la impresora, presiona Ctrl+P en la pestaña abierta y queda impreso.
 */
export async function openRemitoPdfInNewTab(doc: ReactElement): Promise<void> {
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Pop-up bloqueado — caemos a download.
    const a = document.createElement('a');
    a.href = url;
    a.download = `remito-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

/** dd-mm-yyyy de la fecha actual, para usar como sufijo en filenames. */
export function todayForFilename(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
