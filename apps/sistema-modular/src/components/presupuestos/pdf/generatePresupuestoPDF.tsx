import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

import { pdf } from '@react-pdf/renderer';
import { PresupuestoPDFEstandar } from './PresupuestoPDFEstandar';
import { PresupuestoPDFContrato } from './PresupuestoPDFContrato';
import { PresupuestoPDFEquipos } from './PresupuestoPDFEquipos';
import { fetchFotosAsDataUrls } from './equipos/fotosDataUrl';
import type { ModuloSistema } from '@ags/shared';
// La construcción de datos (impuestos, netos/totales por moneda, monto en letras)
// vive en presupuestoPdfData — fuente única compartida con el backup (pdf-regen).
import { buildPresupuestoPDFData, type GeneratePDFParams } from './presupuestoPdfData';

export type { GeneratePDFParams };

/**
 * Genera el PDF de un presupuesto y devuelve el Blob.
 * Selecciona automáticamente el template según el tipo.
 *
 * La construcción de datos (impuestos, totales, monto en letras) está en
 * `buildPresupuestoPDFData` (presupuestoPdfData) — compartida con el backup.
 * Acá quedan solo los fetch que requieren browser/Firestore: módulos de
 * contrato y fotos de equipos.
 */
export async function generatePresupuestoPDF(params: GeneratePDFParams): Promise<Blob> {
  const { presupuesto } = params;

  // For contrato PDFs, load modules for each linked sistema
  let modulosBySistema: Record<string, ModuloSistema[]> | undefined;
  if (presupuesto.tipo === 'contrato') {
    const sistemaIds = [...new Set(presupuesto.items.map(i => i.sistemaId).filter(Boolean))] as string[];
    if (sistemaIds.length > 0) {
      try {
        const { modulosService } = await import('../../../services/equiposService');
        const entries = await Promise.all(
          sistemaIds.map(async (sid) => {
            const mods = await modulosService.getBySistema(sid).catch(() => [] as ModuloSistema[]);
            return [sid, mods] as const;
          })
        );
        modulosBySistema = Object.fromEntries(entries);
      } catch (err) {
        console.error('[PDF] Error cargando módulos:', err);
      }
    }
  }

  // Equipos ('ventas'): pre-descargar las fotos de sub-ítems como data URLs
  // para que @react-pdf no dependa de fetch remoto al renderizar. Una foto
  // caída se omite sin romper la generación.
  const isEquipos = presupuesto.tipo === 'ventas';
  let fotosDataUrls: Record<string, string> | undefined;
  if (isEquipos) {
    const fotoUrls = presupuesto.items.flatMap(i => (i.subItems || []).flatMap(s => s.fotos || []));
    if (fotoUrls.length > 0) {
      fotosDataUrls = await fetchFotosAsDataUrls(fotoUrls);
    }
  }

  const data = buildPresupuestoPDFData(params, { modulosBySistema, fotosDataUrls });

  const isContrato = presupuesto.tipo === 'contrato';
  const component = isContrato
    ? <PresupuestoPDFContrato data={data} />
    : isEquipos
      ? <PresupuestoPDFEquipos data={data} />
      : <PresupuestoPDFEstandar data={data} />;

  const blob = await pdf(component).toBlob();
  return blob;
}

/** Nombre de archivo del PDF: "P1-005001-01 - Razón Social.pdf" (pedido 2026-07-29). */
export function presupuestoPdfFilename(numero: string, razonSocial?: string | null): string {
  const razon = (razonSocial || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
  return razon ? `${numero} - ${razon}.pdf` : `${numero}.pdf`;
}

/**
 * Genera y descarga el PDF directamente.
 */
export async function downloadPresupuestoPDF(params: GeneratePDFParams): Promise<void> {
  const blob = await generatePresupuestoPDF(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = presupuestoPdfFilename(params.presupuesto.numero, params.cliente?.razonSocial);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Genera y abre el PDF en el visor por defecto del sistema.
 * En Electron usa IPC para guardar el archivo temporal y abrirlo con shell.openPath.
 */
export async function previewPresupuestoPDF(params: GeneratePDFParams): Promise<void> {
  const blob = await generatePresupuestoPDF(params);
  const filename = `preview-${params.presupuesto.numero}-${Date.now()}.pdf`;

  // En Electron: guardar como archivo temporal y abrir con visor del sistema
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.saveTempAndOpen) {
    const arrayBuffer = await blob.arrayBuffer();
    await electronAPI.saveTempAndOpen(new Uint8Array(arrayBuffer), filename);
    return;
  }

  // Fallback navegador: abrir en nueva pestaña
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
