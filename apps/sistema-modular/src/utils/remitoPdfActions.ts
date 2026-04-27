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
