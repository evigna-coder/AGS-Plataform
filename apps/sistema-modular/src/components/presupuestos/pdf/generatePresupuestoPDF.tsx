import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

import { pdf } from '@react-pdf/renderer';
import { PresupuestoPDFEstandar } from './PresupuestoPDFEstandar';
import { PresupuestoPDFContrato } from './PresupuestoPDFContrato';
import type { PresupuestoPDFData } from './PresupuestoPDFEstandar';
import type {
  Presupuesto,
  Cliente,
  Establecimiento,
  ContactoEstablecimiento,
  CondicionPago,
  CategoriaPresupuesto,
  ModuloSistema,
} from '@ags/shared';
import { numberToWords } from '@ags/shared';
import { LOGO_SRC, ISO_LOGO_SRC } from './logos';

/** Calcula impuestos desglosados por categoría */
function calcularImpuestos(
  items: Presupuesto['items'],
  categorias: CategoriaPresupuesto[],
) {
  const catMap = new Map(categorias.map(c => [c.id, c]));
  let iva21 = 0;
  let iva105 = 0;
  let ganancias = 0;
  let iibb = 0;

  for (const item of items) {
    const cat = item.categoriaPresupuestoId ? catMap.get(item.categoriaPresupuestoId) : null;
    if (!cat) continue;
    const base = item.subtotal || 0;

    if (cat.incluyeIva && cat.porcentajeIva) {
      if (cat.porcentajeIva === 10.5) iva105 += base * 0.105;
      else iva21 += base * (cat.porcentajeIva / 100);
    }
    if (cat.ivaReduccion && cat.porcentajeIvaReduccion) {
      iva105 += base * (cat.porcentajeIvaReduccion / 100);
    }
    if (cat.incluyeGanancias && cat.porcentajeGanancias) {
      ganancias += base * (cat.porcentajeGanancias / 100);
    }
    if (cat.incluyeIIBB && cat.porcentajeIIBB) {
      iibb += base * (cat.porcentajeIIBB / 100);
    }
  }

  return { iva21, iva105, ganancias, iibb };
}

export interface GeneratePDFParams {
  presupuesto: Presupuesto;
  cliente: Cliente | null;
  establecimiento: Establecimiento | null;
  contacto: ContactoEstablecimiento | null;
  condicionPago: CondicionPago | null;
  categorias: CategoriaPresupuesto[];
}

/**
 * Genera el PDF de un presupuesto y devuelve el Blob.
 * Selecciona automáticamente el template según el tipo.
 */
export async function generatePresupuestoPDF(params: GeneratePDFParams): Promise<Blob> {
  const { presupuesto, cliente, establecimiento, contacto, condicionPago, categorias } = params;

  const impuestos = calcularImpuestos(presupuesto.items, categorias);
  const montoEnLetras = numberToWords(presupuesto.total || 0, presupuesto.moneda);

  // For contrato PDFs, load modules for each linked sistema
  let modulosBySistema: Record<string, ModuloSistema[]> | undefined;
  if (presupuesto.tipo === 'contrato') {
    const sistemaIds = [...new Set(presupuesto.items.map(i => i.sistemaId).filter(Boolean))] as string[];
    console.log('[PDF] sistemaIds extraídos de items:', sistemaIds, '| items:', presupuesto.items.map(i => ({ id: i.id, sistemaId: i.sistemaId, grupo: i.grupo })));
    if (sistemaIds.length > 0) {
      try {
        const { modulosService } = await import('../../../services/equiposService');
        const entries = await Promise.all(
          sistemaIds.map(async (sid) => {
            const mods = await modulosService.getBySistema(sid).catch((err) => {
              console.error('[PDF] Error cargando módulos para sistema', sid, err);
              return [] as ModuloSistema[];
            });
            console.log(`[PDF] Sistema ${sid}: ${mods.length} módulos`, mods.map(m => m.nombre));
            return [sid, mods] as const;
          })
        );
        modulosBySistema = Object.fromEntries(entries);
        console.log('[PDF] modulosBySistema:', modulosBySistema);
      } catch (err) { console.error('[PDF] Error general cargando módulos:', err); }
    } else {
      console.warn('[PDF] No se encontraron sistemaIds en los items. Los items no tienen sistemaId asignado.');
    }
  }

  const data: PresupuestoPDFData = {
    presupuesto,
    cliente,
    establecimiento,
    contacto,
    condicionPago,
    categorias,
    montoEnLetras,
    logoSrc: LOGO_SRC,
    isoLogoSrc: ISO_LOGO_SRC,
    impuestos,
    modulosBySistema,
  };

  const isContrato = presupuesto.tipo === 'contrato';
  const component = isContrato
    ? <PresupuestoPDFContrato data={data} />
    : <PresupuestoPDFEstandar data={data} />;

  const blob = await pdf(component).toBlob();
  return blob;
}

/**
 * Genera y descarga el PDF directamente.
 */
export async function downloadPresupuestoPDF(params: GeneratePDFParams): Promise<void> {
  const blob = await generatePresupuestoPDF(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.presupuesto.numero}.pdf`;
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
