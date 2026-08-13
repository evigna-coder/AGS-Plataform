import type { RemitoItem } from '@ags/shared';
import { CATEGORIA_INSTRUMENTO_LABELS, CATEGORIA_PATRON_LABELS } from '@ags/shared';
import { minikitsService } from '../services/stockService';
import { instrumentosService } from '../services/catalogService';

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
  const minikitIds = [...new Set(
    items.filter(i => i.tipoEntidad === 'minikit' && i.minikitId && !i.minikitDescripcion)
      .map(i => i.minikitId as string),
  )];
  const instrumentoIds = [...new Set(
    items.filter(i => i.tipoEntidad === 'instrumento' && i.instrumentoId)
      .map(i => i.instrumentoId as string),
  )];
  if (minikitIds.length === 0 && instrumentoIds.length === 0) return items;

  const [minikits, instrumentos] = await Promise.all([
    Promise.all(minikitIds.map(id => minikitsService.getById(id).catch(() => null))),
    Promise.all(instrumentoIds.map(id => instrumentosService.getById(id).catch(() => null))),
  ]);
  const minikitPorId = new Map(minikits.filter(Boolean).map(m => [m!.id, m!]));
  const instrumentoPorId = new Map(instrumentos.filter(Boolean).map(i => [i!.id, i!]));

  return items.map(item => {
    if (item.tipoEntidad === 'minikit' && item.minikitId && !item.minikitDescripcion) {
      const mk = minikitPorId.get(item.minikitId);
      if (!mk) return item;
      return { ...item, minikitDescripcion: mk.nombre || mk.descripcion || null };
    }
    if (item.tipoEntidad === 'instrumento' && item.instrumentoId) {
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
