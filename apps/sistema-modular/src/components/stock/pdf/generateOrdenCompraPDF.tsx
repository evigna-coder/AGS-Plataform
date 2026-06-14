import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

import { pdf } from '@react-pdf/renderer';
import type { OrdenCompra, Proveedor } from '@ags/shared';
import { OrdenCompraPDF } from './OrdenCompraPDF';

/** Genera el PDF de una orden de compra y devuelve el Blob. */
export async function generateOrdenCompraPDF(oc: OrdenCompra, proveedor?: Proveedor | null): Promise<Blob> {
  return pdf(<OrdenCompraPDF oc={oc} proveedor={proveedor} />).toBlob();
}

/** Genera y descarga el PDF de la OC. */
export async function downloadOrdenCompraPDF(oc: OrdenCompra, proveedor?: Proveedor | null): Promise<void> {
  const blob = await generateOrdenCompraPDF(oc, proveedor);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${oc.numero}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Abre el PDF en el visor del sistema (Electron) o nueva pestaña (browser). */
export async function previewOrdenCompraPDF(oc: OrdenCompra, proveedor?: Proveedor | null): Promise<void> {
  const blob = await generateOrdenCompraPDF(oc, proveedor);
  const filename = `preview-${oc.numero}-${Date.now()}.pdf`;

  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.saveTempAndOpen) {
    const arrayBuffer = await blob.arrayBuffer();
    await electronAPI.saveTempAndOpen(new Uint8Array(arrayBuffer), filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
