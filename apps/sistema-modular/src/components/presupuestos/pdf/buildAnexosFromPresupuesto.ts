import type {
  Presupuesto, PresupuestoItem, Cliente, Sistema, ModuloSistema,
  TipoEquipoPlantilla, ConsumibleModulo,
} from '@ags/shared';
import { findPlantillaForSistema } from '../contrato/contratoItemHelpers';
import { consumiblesPorModuloService } from '../../../services/consumiblesPorModuloService';
import type { AnexoConsumiblesData, AnexoModuloEntry } from './AnexoConsumiblesPDF';

// =============================================
// Types públicos
// =============================================

/**
 * tipo:
 *   - modulo_sin_codigo            → Caso (i) CONTEXT.md: módulo legacy/datos incompletos.
 *   - codigo_no_en_catalogo        → Caso (ii): codigo presente, no está en consumibles_por_modulo.
 *   - sistema_sin_modulos_ni_plantilla → Caso terminal: no hay forma de armar la lista.
 */
export interface AnexoBuildWarning {
  tipo: 'modulo_sin_codigo' | 'codigo_no_en_catalogo' | 'sistema_sin_modulos_ni_plantilla';
  itemId: string;
  sistemaNombre: string | null;
  detalle: string;
}

export interface AnexoBuildResult {
  itemId: string;
  sistemaId: string | null;
  /** Listo para pasarle a generateAnexoConsumiblesPDF(). */
  data: AnexoConsumiblesData;
  /** "Anexo Consumibles - {numero} - {sistema}.pdf" — usado por el modal de envío (plan 04-05). */
  filename: string;
}

export interface BuildAnexosInput {
  presupuesto: Presupuesto;
  cliente: Cliente | null;
  /** sistemaId → Sistema (null aceptado: sistema referenciado pero no se pudo cargar). */
  sistemas: Record<string, Sistema | null>;
  /** sistemaId → ModuloSistema[] (módulos reales pre-cargados por el caller). */
  modulosBySistema: Record<string, ModuloSistema[]>;
  /** Catálogo completo de plantillas (pre-cargado por el caller). */
  plantillas: TipoEquipoPlantilla[];
}

// =============================================
// Helpers internos
// =============================================

/**
 * Detecta si un item del presupuesto tiene flag `requiereAnexoConsumibles=true`
 * en CUALQUIER plantilla que contenga su `servicioCode`.
 *
 * Regla operativa: si un mismo `servicioCode` aparece en varias plantillas
 * (ej: MP1_CN_60 en HPLC 1260 y HPLC 1260 Infinity) y al menos UNA tiene el flag
 * tildado, se respeta. Esto previene falsos negativos cuando el operador tildó
 * el flag en una plantilla pero no en otra equivalente.
 */
function itemRequiereAnexo(item: PresupuestoItem, plantillas: TipoEquipoPlantilla[]): boolean {
  if (!item.servicioCode) return false;
  for (const p of plantillas) {
    for (const s of p.servicios) {
      if (s.servicioCode === item.servicioCode && s.requiereAnexoConsumibles === true) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resuelve la fuente de módulos (codigo + descripcion) para un sistema:
 *   1) Módulos reales del cliente (si hay) — heurística regex Agilent sobre `mod.nombre`.
 *   2) Plantilla matcheada vía `findPlantillaForSistema` — usa `plantilla.componentes`.
 *   3) null → caller emite warning terminal y skip-ea el anexo.
 *
 * NOTA sobre detección de "código de módulo" en módulos reales: `ModuloSistema` no
 * tiene campo explícito `partNumber`. Los datos históricos guardan el código en
 * `nombre` (ej: "G7129A"). Heurística: regex `/^[A-Z][0-9]{3,5}[A-Z]?$/` sobre
 * `nombre.trim()`. Si no matchea → placeholder caso (i).
 */
function resolveFuenteModulos(
  sistema: Sistema | null,
  modulosReales: ModuloSistema[],
  plantillas: TipoEquipoPlantilla[],
): { codigo: string; descripcion: string }[] | null {
  if (modulosReales.length > 0) {
    return modulosReales.map((mod) => {
      const candidato = (mod.nombre || '').trim();
      const isPartNumber = /^[A-Z][0-9]{3,5}[A-Z]?$/.test(candidato);
      return isPartNumber
        ? { codigo: candidato, descripcion: mod.descripcion || mod.nombre }
        : { codigo: '', descripcion: mod.descripcion || mod.nombre || 'Módulo sin código' };
    });
  }
  if (!sistema) return null;
  const plantilla = findPlantillaForSistema(sistema, plantillas);
  if (!plantilla) return null;
  return plantilla.componentes
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((c) => ({ codigo: c.codigo, descripcion: c.descripcion }));
}

// =============================================
// Función principal
// =============================================

/**
 * Construye N AnexoBuildResult (uno por item con flag `requiereAnexoConsumibles`)
 * desde un Presupuesto + sus Sistemas referenciados + plantillas + catálogo
 * `consumibles_por_modulo`.
 *
 * **Casos edge cubiertos** (CONTEXT.md):
 *   - Caso (i) — módulo sin código: placeholder=true + warning `modulo_sin_codigo`.
 *   - Caso (ii) — código existe pero no en catálogo: placeholder=true + warning `codigo_no_en_catalogo`.
 *   - Caso (iii) — entrada en catálogo con `consumibles=[]` intencional: SKIP silencioso (sin warning).
 *   - Caso terminal — sistema sin módulos reales ni plantilla matcheable: NO se genera anexo +
 *     warning `sistema_sin_modulos_ni_plantilla`. El vendedor decide en `EnviarPresupuestoModal`
 *     (banner amarillo "¿Enviar sin anexo?").
 *
 * **Performance**:
 *   - Recibe `modulosBySistema` y `plantillas` pre-cargados (no llama Firestore).
 *   - Cachea lookups por `codigo` para evitar round-trips repetidos.
 *   - Lookups secuenciales (no Promise.all) para mantener consistencia del cache.
 */
export async function buildAnexosFromPresupuesto(
  input: BuildAnexosInput,
): Promise<{ anexos: AnexoBuildResult[]; warnings: AnexoBuildWarning[] }> {
  const { presupuesto, cliente, sistemas, modulosBySistema, plantillas } = input;
  const anexos: AnexoBuildResult[] = [];
  const warnings: AnexoBuildWarning[] = [];

  // Cache: codigoModulo → ConsumibleModulo[] | null
  // null sentinel = lookup hecho, no encontrado (caso ii). undefined = no consultado todavía.
  const lookupCache = new Map<string, ConsumibleModulo[] | null>();

  const lookup = async (codigo: string): Promise<ConsumibleModulo[] | null> => {
    if (lookupCache.has(codigo)) return lookupCache.get(codigo)!;
    const docResult = await consumiblesPorModuloService.getByCodigoModulo(codigo);
    const result = docResult && docResult.activo ? docResult.consumibles : null;
    lookupCache.set(codigo, result);
    return result;
  };

  // NOTE: Presupuesto type has `fechaEnvio` (not `fechaEmision`). El nombre local
  // se mantiene como `fechaEmision` porque mapea a AnexoConsumiblesData.fechaEmision
  // (un display field "Fecha de emisión del anexo").
  const fechaEmision: string =
    presupuesto.fechaEnvio || presupuesto.createdAt || new Date().toISOString();

  for (const item of presupuesto.items) {
    if (!itemRequiereAnexo(item, plantillas)) continue;

    if (!item.sistemaId) {
      warnings.push({
        tipo: 'sistema_sin_modulos_ni_plantilla',
        itemId: item.id,
        sistemaNombre: item.sistemaNombre ?? null,
        detalle: 'El item lleva flag de anexo pero no tiene sistemaId vinculado',
      });
      continue;
    }

    const sistema = sistemas[item.sistemaId] ?? null;
    const sistemaNombre = item.sistemaNombre || sistema?.nombre || 'Sistema desconocido';
    const modulosReales = modulosBySistema[item.sistemaId] || [];

    // 1) Resolver fuente de módulos (real > plantilla > terminal)
    const fuente = resolveFuenteModulos(sistema, modulosReales, plantillas);
    if (!fuente) {
      warnings.push({
        tipo: 'sistema_sin_modulos_ni_plantilla',
        itemId: item.id,
        sistemaNombre,
        detalle: `No se encontraron módulos reales del sistema "${sistemaNombre}" ni una plantilla matcheable. ¿Enviar sin anexo?`,
      });
      continue;
    }

    // 2) Para cada módulo: lookup en consumiblesPorModulo + clasificar
    const modulosOut: AnexoModuloEntry[] = [];
    for (const { codigo, descripcion } of fuente) {
      if (!codigo) {
        // Caso (i): módulo sin código
        modulosOut.push({ codigo: '', descripcion, consumibles: [], placeholder: true });
        warnings.push({
          tipo: 'modulo_sin_codigo',
          itemId: item.id,
          sistemaNombre,
          detalle: `Módulo "${descripcion}" del sistema "${sistemaNombre}" no tiene código — listado sin consumibles específicos`,
        });
        continue;
      }
      const consumibles = await lookup(codigo);
      if (consumibles === null) {
        // Caso (ii): código no está en catálogo (o entrada inactiva)
        modulosOut.push({ codigo, descripcion, consumibles: [], placeholder: true });
        warnings.push({
          tipo: 'codigo_no_en_catalogo',
          itemId: item.id,
          sistemaNombre,
          detalle: `Código ${codigo} no está en consumibles_por_modulo`,
        });
        continue;
      }
      if (consumibles.length === 0) {
        // Caso (iii): catálogo intencionalmente vacío → SKIP silencioso
        continue;
      }
      // Caso happy: incluir
      modulosOut.push({ codigo, descripcion, consumibles, placeholder: false });
    }

    if (modulosOut.length === 0) {
      // Tras todos los skips silenciosos no quedó nada que mostrar.
      // No es error: el item lleva flag pero todos sus módulos están marcados
      // como "sin consumibles". Skip silencioso del anexo entero.
      continue;
    }

    const numero = presupuesto.numero || presupuesto.id;
    const filename = `Anexo Consumibles - ${numero} - ${sistemaNombre}.pdf`;
    anexos.push({
      itemId: item.id,
      sistemaId: item.sistemaId,
      data: {
        presupuestoNumero: numero,
        sistemaNombre,
        clienteRazonSocial: cliente?.razonSocial || 'Cliente sin nombre',
        fechaEmision,
        modulos: modulosOut,
      },
      filename,
    });
  }

  return { anexos, warnings };
}
