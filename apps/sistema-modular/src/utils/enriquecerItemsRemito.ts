import type { RemitoItem, Minikit } from '@ags/shared';
import { CATEGORIA_INSTRUMENTO_LABELS, CATEGORIA_PATRON_LABELS } from '@ags/shared';
import { minikitsService } from '../services/stockService';
import { instrumentosService } from '../services/catalogService';
import { asignacionesService } from '../services/asignacionesService';
import { esItemInstrumento } from './inventarioToRemitoItem';

/** "termometro" → "Termómetro". Sirve para instrumentos y para patrones. */
function etiquetaCategoria(categorias: string[] | undefined): string {
  for (const c of categorias ?? []) {
    const label = (CATEGORIA_INSTRUMENTO_LABELS as Record<string, string>)[c]
      ?? (CATEGORIA_PATRON_LABELS as Record<string, string>)[c];
    if (label) return label;
  }
  return '';
}

/**
 * Completa los campos de display que la ASIGNACIÓN no guarda (2026-08-12).
 *
 * Al asignar un minikit se guarda solo `minikitCodigo`, y de un instrumento
 * solo su nombre ("TER-03"). Con eso el papel salía con el código en su columna
 * y la **descripción vacía**: no había de dónde sacar el texto. Acá se resuelve
 * contra los catálogos justo antes de imprimir, así también salen bien las
 * REIMPRESIONES de remitos viejos, que es la mayoría del problema.
 *
 * Deja los items intactos si no hay nada que completar, y ante cualquier fallo
 * de lectura devuelve lo que había: un remito con la descripción incompleta se
 * imprime igual — no se bloquea la salida de mercadería por esto.
 */
export async function enriquecerItemsRemito(items: RemitoItem[]): Promise<RemitoItem[]> {
  const minikitPend = items.filter(i => i.tipoEntidad === 'minikit' && !i.minikitDescripcion);
  const minikitIds = [...new Set(minikitPend.filter(i => i.minikitId).map(i => i.minikitId as string))];
  // Minikits SIN `minikitId` (2026-08-18): la asignación guarda solo el código,
  // y el enriquecido buscaba únicamente por id — el kit salía impreso con el
  // código en su columna y la Descripción VACÍA. Se resuelven por código contra
  // el catálogo, que es el único dato que tienen.
  const minikitCodigos = [...new Set(
    minikitPend.filter(i => !i.minikitId && i.minikitCodigo)
      .map(i => (i.minikitCodigo as string).trim().toLowerCase()),
  )];
  const instrumentoIds = [...new Set(
    items.filter(i => esItemInstrumento(i) && i.instrumentoId)
      .map(i => i.instrumentoId as string),
  )];
  // Columnas cromatográficas (2026-08-19): el item del remito NO trae ningún
  // dato de la columna —ni id, ni código, ni serie—, solo el vínculo con la
  // asignación. Todo vive del lado de `asignaciones`, así que se resuelven por
  // ahí. Por eso salían con "S/C" en Código y la Descripción vacía.
  const columnaAsigIds = [...new Set(
    items.filter(i => i.tipoEntidad === 'columna' && i.asignacionId && !i.columnaDescripcion)
      .map(i => i.asignacionId as string),
  )];
  if (minikitIds.length === 0 && minikitCodigos.length === 0
    && instrumentoIds.length === 0 && columnaAsigIds.length === 0) return items;

  const [minikits, instrumentos, asignaciones] = await Promise.all([
    Promise.all(minikitIds.map(id => minikitsService.getById(id).catch(() => null))),
    Promise.all(instrumentoIds.map(id => instrumentosService.getById(id).catch(() => null))),
    Promise.all(columnaAsigIds.map(id => asignacionesService.getById(id).catch(() => null))),
  ]);
  /** asignacionItemId → datos de la columna, tomados de la asignación. */
  const columnaPorAsigItem = new Map<string, { codigo: string | null; descripcion: string | null; serie: string | null }>();
  for (const asg of asignaciones) {
    for (const ai of (asg?.items ?? [])) {
      if (ai.tipo !== 'columna') continue;
      columnaPorAsigItem.set(ai.id, {
        codigo: ai.columnaCodigo ?? null,
        descripcion: ai.columnaDescripcion ?? null,
        serie: ai.columnaSerie ?? null,
      });
    }
  }
  const minikitPorId = new Map(minikits.filter(Boolean).map(m => [m!.id, m!]));
  const minikitPorCodigo = new Map<string, Minikit>();
  if (minikitCodigos.length > 0) {
    const todos = await minikitsService.getAll(false).catch(() => [] as Minikit[]);
    for (const m of todos) {
      const cod = (m.codigo || '').trim().toLowerCase();
      if (cod && minikitCodigos.includes(cod)) minikitPorCodigo.set(cod, m);
    }
  }
  const instrumentoPorId = new Map(instrumentos.filter(Boolean).map(i => [i!.id, i!]));

  return items.map(item => {
    if (item.tipoEntidad === 'minikit' && !item.minikitDescripcion) {
      const mk = item.minikitId
        ? minikitPorId.get(item.minikitId)
        : minikitPorCodigo.get((item.minikitCodigo || '').trim().toLowerCase());
      if (!mk) return item;
      // El primero de los dos que NO sea el código (2026-08-19). Varios minikits
      // tienen `nombre` IGUAL al código —MKGC2 se llama "MKGC2"— y el texto útil
      // está en `descripcion` ("Minikit GC 2"). Tomando `nombre` primero, el
      // filtro anti-repetición lo borraba y la Descripción salía vacía: el kit se
      // pisaba a sí mismo.
      const cod = (item.minikitCodigo || mk.codigo || '').trim().toLowerCase();
      const util = [mk.descripcion, mk.nombre]
        .map(t => (t || '').trim())
        .find(t => t && t.toLowerCase() !== cod);
      return { ...item, minikitDescripcion: util || null };
    }
    if (item.tipoEntidad === 'columna' && !item.columnaDescripcion) {
      const col = item.asignacionItemId ? columnaPorAsigItem.get(item.asignacionItemId) : null;
      if (!col) return item;
      return {
        ...item,
        columnaCodigo: item.columnaCodigo || col.codigo,
        columnaDescripcion: col.descripcion,
        // La serie va a la línea de descripción del papel, igual que en los
        // instrumentos: es el dato que identifica la unidad física.
        serie: item.serie || col.serie,
      };
    }
    if (esItemInstrumento(item) && item.instrumentoId) {
      const ins = instrumentoPorId.get(item.instrumentoId);
      if (!ins) return item;
      // El NOMBRE es el identificador interno (TER-03) y va a Código; qué ES el
      // instrumento va a Descripción: "Termómetro Testo 175". Los items viejos
      // guardaron el nombre en `instrumentoDescripcion` y dejaron el código en
      // null — se reacomodan los DOS campos juntos para que el getter no vuelva
      // a repetir el mismo texto en las dos columnas.
      const descripcion = [etiquetaCategoria(ins.categorias), ins.marca, ins.modelo]
        .filter(Boolean).join(' ').trim();
      return {
        ...item,
        instrumentoCodigo: item.instrumentoCodigo || ins.nombre || null,
        instrumentoDescripcion: descripcion || item.instrumentoDescripcion || null,
        // La serie del instrumento no se guarda al asignar; el papel la imprime
        // como "S/N ..." al final de la descripción (2026-08-12).
        serie: item.serie || ins.serie || null,
      };
    }
    return item;
  });
}
