import type { CierreSemanal } from '@ags/shared';
import type { DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { abrirVentanaParaPdf, mostrarPdfEnVentana, mostrarPdfEnOverlay } from './ventanaPdf';

export const nombreArchivoCierre = (semanaInicio: string) => `Cierre semanal ${semanaInicio}.pdf`;

/** Genera el PDF del cierre en memoria (react-pdf por import dinámico: pesa). */
export async function generarPdfCierreSemanal(cierre: CierreSemanal): Promise<Blob> {
  const [{ CierreSemanalPDF }, React, { pdf }] = await Promise.all([
    import('../components/control-semanal/pdf/CierreSemanalPDF'),
    import('react'),
    import('@react-pdf/renderer'),
  ]);
  const documento = React.createElement(CierreSemanalPDF, { cierre }) as unknown as ReactElement<DocumentProps>;
  return pdf(documento).toBlob();
}

/** Abre un PDF ya generado: visor del sistema en Electron, pestaña en el navegador. */
export async function abrirPdfCierre(blob: Blob, nombre: string, ventana?: Window | null): Promise<void> {
  if (window.electronAPI?.saveTempAndOpen) {
    await window.electronAPI.saveTempAndOpen(new Uint8Array(await blob.arrayBuffer()), nombre);
    return;
  }
  const url = URL.createObjectURL(blob);
  const win = ventana ?? abrirVentanaParaPdf(nombre);
  if (win && !win.closed) mostrarPdfEnVentana(win, url, nombre);
  else mostrarPdfEnOverlay(url, nombre);
}

/**
 * Copia local del PDF (2026-09-09): en la carpeta configurada en Admin →
 * Flujos (por ejemplo la carpeta de Dropbox sincronizada de esa PC). Solo en
 * Electron; en el navegador no hay disco. Best-effort: devuelve la ruta o null.
 */
export async function guardarCopiaLocalCierre(blob: Blob, nombre: string, carpeta: string | null | undefined): Promise<{ path: string | null; motivo: string | null }> {
  const api = window.electronAPI;
  if (!carpeta?.trim() || !api?.saveToFolder) return { path: null, motivo: null };
  const r = await api.saveToFolder(carpeta.trim(), nombre, new Uint8Array(await blob.arrayBuffer()));
  return r.success ? { path: r.path ?? null, motivo: null } : { path: null, motivo: r.failureReason ?? 'no se pudo escribir' };
}
