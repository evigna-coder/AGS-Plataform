import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
import { pdf } from '@react-pdf/renderer';
import type { PresupuestoComex } from '@ags/shared';
import { PresupuestoComexPDF } from './PresupuestoComexPDF';
import { calcularPresupuestoComex } from '../../utils/presupuestoComex';

/** Abre el PDF del presupuesto de comex: visor del sistema en Electron, pestaña nueva en browser. */
export async function abrirPresupuestoComexPDF(p: PresupuestoComex): Promise<void> {
  const blob = await pdf(<PresupuestoComexPDF p={p} r={calcularPresupuestoComex(p)} />).toBlob();
  const filename = `${p.numero || 'presupuesto-comex'}-${Date.now()}.pdf`;
  const electronAPI = (window as unknown as { electronAPI?: { saveTempAndOpen?: (b: Uint8Array, n: string) => Promise<void> } }).electronAPI;
  if (electronAPI?.saveTempAndOpen) {
    await electronAPI.saveTempAndOpen(new Uint8Array(await blob.arrayBuffer()), filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
