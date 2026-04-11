import type { PresupuestoItem, Sistema, ModuloSistema, TipoEquipoPlantilla } from '@ags/shared';

/**
 * Heurística simple: matchea el nombre del sistema contra el nombre de las
 * plantillas. "Sistema HPLC 1100" → plantilla "HPLC 1100". Case-insensitive,
 * substring match. Devuelve la mejor coincidencia o null.
 */
export function findPlantillaForSistema(
  sistema: Pick<Sistema, 'nombre'>,
  plantillas: TipoEquipoPlantilla[],
): TipoEquipoPlantilla | null {
  if (!sistema?.nombre) return null;
  const sistemaNombre = sistema.nombre.toLowerCase();
  const activas = plantillas.filter(p => p.activo);
  // Match por longitud de nombre descendente — las más específicas primero
  // ("HPLC 1260 Infinity" antes que "HPLC 1260")
  const sorted = [...activas].sort((a, b) => b.nombre.length - a.nombre.length);
  for (const p of sorted) {
    if (sistemaNombre.includes(p.nombre.toLowerCase())) return p;
  }
  return null;
}

/**
 * Calcula el siguiente `grupo` disponible para un nuevo sistema en el
 * presupuesto. Grupo 1 = primer sistema agregado, 2 = segundo, etc.
 */
export function nextGrupoNumber(items: PresupuestoItem[]): number {
  const grupos = items.map(i => i.grupo || 0).filter(g => g > 0);
  return grupos.length === 0 ? 1 : Math.max(...grupos) + 1;
}

/**
 * Dado un grupo (sistema) existente, calcula el próximo `sub` disponible
 * para agregar un ítem manual. Mira los subItems actuales del grupo y
 * devuelve max+1. Si no hay ninguno, empieza en 30 (después de los rangos
 * estándar 1.x para header, 2.x-9.x componentes, 10.x-29.x servicios).
 */
export function nextSubForGrupo(items: PresupuestoItem[], grupo: number): number {
  const subs = items
    .filter(i => (i.grupo || 0) === grupo)
    .map(i => parseFloat((i.subItem || '0').split('.')[1] || '0'))
    .filter(n => !isNaN(n));
  if (subs.length === 0) return 30;
  return Math.max(...subs) + 1;
}

/**
 * Genera subItem string en formato "G.S" (grupo.sub):
 *   grupo=1, sub=1  → "1.1"
 *   grupo=1, sub=10 → "1.10"
 *   grupo=12, sub=21 → "12.21"
 */
export function makeSubItem(grupo: number, sub: number): string {
  return `${grupo}.${sub}`;
}

/**
 * Dada una plantilla + módulos reales del cliente (opcional), construye la
 * lista de PresupuestoItems que se deben crear al agregar este sistema al
 * presupuesto.
 *
 * Estrategia híbrida:
 *   - Item principal (X.1): el Sistema como cabecera con esSinCargo=true
 *   - Componentes S/L (X.2..X.9): si el sistema tiene módulos reales, se usan
 *     esos; si no, se usan los componentes de la plantilla.
 *   - Servicios (X.10..X.19 mantenimientos, X.20..X.29 regulatorios): siempre
 *     desde la plantilla (precio editable por el usuario).
 */
export interface BuildItemsInput {
  grupo: number;
  sector: string | null;
  sistema: Sistema;
  modulosReales: ModuloSistema[];
  plantilla: TipoEquipoPlantilla;
  moduloPrincipalSerie?: string | null;
}

export function buildItemsFromPlantilla(input: BuildItemsInput): PresupuestoItem[] {
  const { grupo, sector, sistema, modulosReales, plantilla, moduloPrincipalSerie } = input;
  const items: PresupuestoItem[] = [];

  // --- Header del sistema (X.1) ---
  items.push({
    id: crypto.randomUUID(),
    codigoProducto: sistema.nombre, // ej "HPLC 1100"
    descripcion: `${sistema.nombre} / SISTEMA`,
    cantidad: 0,
    unidad: 'servicio',
    precioUnitario: 0,
    subtotal: 0,
    esSinCargo: true,
    grupo,
    subItem: makeSubItem(grupo, 1),
    sistemaId: sistema.id,
    sistemaCodigoInterno: sistema.codigoInternoCliente ?? null,
    sistemaNombre: sistema.nombre,
    sectorNombre: sector,
    moduloSerie: moduloPrincipalSerie ?? null,
    servicioCode: 'AT1_BAS',
  });

  // --- Componentes S/L (X.2..) ---
  // Opción C híbrido: si hay módulos reales del cliente, usarlos; si no, plantilla.
  let subCounter = 2;
  if (modulosReales.length > 0) {
    for (const mod of modulosReales) {
      items.push({
        id: crypto.randomUUID(),
        codigoProducto: mod.marca ? `${mod.marca} ${mod.nombre}` : mod.nombre,
        descripcion: mod.descripcion || `${mod.nombre} - ${sistema.nombre}`,
        cantidad: 0,
        unidad: 'servicio',
        precioUnitario: 0,
        subtotal: 0,
        esSinCargo: true,
        grupo,
        subItem: makeSubItem(grupo, subCounter++),
        sistemaId: sistema.id,
        sistemaCodigoInterno: sistema.codigoInternoCliente ?? null,
        sistemaNombre: sistema.nombre,
        sectorNombre: sector,
        moduloId: mod.id,
        moduloNombre: mod.nombre,
        moduloSerie: mod.serie ?? null,
        moduloMarca: mod.marca ?? null,
      });
    }
  } else {
    // Fallback: componentes de la plantilla (sin serie porque no hay módulo real)
    for (const comp of [...plantilla.componentes].sort((a, b) => a.orden - b.orden)) {
      items.push({
        id: crypto.randomUUID(),
        codigoProducto: comp.codigo,
        descripcion: comp.descripcion,
        cantidad: 0,
        unidad: 'servicio',
        precioUnitario: 0,
        subtotal: 0,
        esSinCargo: true,
        grupo,
        subItem: makeSubItem(grupo, subCounter++),
        sistemaId: sistema.id,
        sistemaCodigoInterno: sistema.codigoInternoCliente ?? null,
        sistemaNombre: sistema.nombre,
        sectorNombre: sector,
        servicioCode: comp.servicioCode ?? null,
      });
    }
  }

  // --- Servicios con precio (desde plantilla) ---
  // El orden de la plantilla define el sub (10, 11, 20, 21...)
  for (const serv of [...plantilla.servicios].sort((a, b) => a.orden - b.orden)) {
    const cantidad = serv.cantidadDefault;
    const esSL = cantidad === 0;
    const precio = serv.precioDefault ?? 0;
    items.push({
      id: crypto.randomUUID(),
      codigoProducto: serv.servicioCode,
      descripcion: serv.descripcion,
      cantidad: esSL ? 0 : cantidad,
      unidad: 'servicio',
      precioUnitario: precio,
      subtotal: esSL ? 0 : cantidad * precio,
      esSinCargo: esSL,
      grupo,
      subItem: makeSubItem(grupo, serv.orden),
      sistemaId: sistema.id,
      sistemaCodigoInterno: sistema.codigoInternoCliente ?? null,
      sistemaNombre: sistema.nombre,
      sectorNombre: sector,
      servicioCode: serv.servicioCode,
    });
  }

  return items;
}

/**
 * Agrupa items de presupuesto contrato en una estructura jerárquica Sector → Sistema.
 * Mantiene el orden original de grupos y sub-items.
 */
export interface SistemaBucket {
  grupo: number;
  sistemaId: string | null;
  sistemaNombre: string;
  sistemaCodigoInterno: string | null;
  items: PresupuestoItem[];
}

export interface SectorBucket {
  sectorNombre: string; // "" para items sin sector
  sistemas: SistemaBucket[];
}

export function groupItemsForContrato(items: PresupuestoItem[]): SectorBucket[] {
  const sectorMap = new Map<string, Map<number, SistemaBucket>>();

  // Sort items by grupo then subItem numerically
  const sorted = [...items].sort((a, b) => {
    const ga = a.grupo ?? 9999;
    const gb = b.grupo ?? 9999;
    if (ga !== gb) return ga - gb;
    const sa = parseFloat((a.subItem || '0').split('.')[1] || '0');
    const sb = parseFloat((b.subItem || '0').split('.')[1] || '0');
    return sa - sb;
  });

  for (const item of sorted) {
    const sector = item.sectorNombre || '';
    const grupo = item.grupo || 0;
    if (!sectorMap.has(sector)) sectorMap.set(sector, new Map());
    const grupoMap = sectorMap.get(sector)!;
    if (!grupoMap.has(grupo)) {
      grupoMap.set(grupo, {
        grupo,
        sistemaId: item.sistemaId ?? null,
        sistemaNombre: item.sistemaNombre || 'Sin sistema',
        sistemaCodigoInterno: item.sistemaCodigoInterno ?? null,
        items: [],
      });
    }
    grupoMap.get(grupo)!.items.push(item);
  }

  // Flatten back to ordered array
  const result: SectorBucket[] = [];
  for (const [sectorNombre, grupoMap] of sectorMap.entries()) {
    result.push({
      sectorNombre,
      sistemas: Array.from(grupoMap.values()).sort((a, b) => a.grupo - b.grupo),
    });
  }
  return result;
}
