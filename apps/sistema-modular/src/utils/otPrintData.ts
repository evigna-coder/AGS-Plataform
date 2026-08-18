import type {
  Cliente, Establecimiento, ModuloSistema, Presupuesto, Sistema, WorkOrder,
} from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { ordenesTrabajoService } from '../services/otService';
import { sistemasService, modulosService } from '../services/equiposService';
import { clientesService } from '../services/clientesService';
import { establecimientosService } from '../services/firebaseService';
import { presupuestosService } from '../services/presupuestosService';

/** Una linea del checklist "tareas a realizar". */
export interface TareaOT {
  descripcion: string;
  detalle: string | null;
}

/** Una linea de "materiales asignados al servicio". */
export interface MaterialOT {
  cantidad: string;
  codigo: string;
  descripcion: string;
}

export interface DatosImpresionOT {
  ot: WorkOrder;
  estadoLabel: string;
  sistema: Sistema | null;
  /** Todos los modulos del sistema — el corazon de la hoja (2026-08-14). */
  modulos: ModuloSistema[];
  /** Id del modulo intervenido, resuelto por serie o por id. `null` si no se pudo. */
  moduloEnBenchId: string | null;
  cliente: Cliente | null;
  establecimiento: Establecimiento | null;
  presupuesto: Presupuesto | null;
  tareas: TareaOT[];
  materiales: MaterialOT[];
}

/**
 * Cual de los modulos del sistema es el que se esta interviniendo.
 *
 * Se prueba por `moduloId` y, si la OT no lo tiene (el caso comun en las OTs
 * cargadas a mano), por numero de SERIE, que es el dato que siempre se escribe.
 * El modelo solo no alcanza: un sistema puede tener dos modulos del mismo
 * modelo y marcar el equivocado en el papel es peor que no marcar ninguno.
 */
export function resolverModuloEnBench(ot: WorkOrder, modulos: ModuloSistema[]): string | null {
  if (ot.moduloId && modulos.some(m => m.id === ot.moduloId)) return ot.moduloId;
  const serie = (ot.moduloSerie ?? '').trim().toLowerCase();
  if (serie) {
    const porSerie = modulos.filter(m => (m.serie ?? '').trim().toLowerCase() === serie);
    if (porSerie.length === 1) return porSerie[0].id;
  }
  return null;
}

/**
 * Tareas a realizar = items del presupuesto vinculado.
 *
 * El alcance acordado con el cliente ES la lista de tareas; la OT no tiene un
 * campo propio para esto y duplicarlo a mano se desincroniza al primer cambio
 * de presupuesto. Los items con articulo de stock se excluyen: esos son
 * materiales, no trabajo, y salen en su propia tabla.
 */
export function tareasDesdePresupuesto(pres: Presupuesto | null): TareaOT[] {
  if (!pres) return [];
  return (pres.items ?? [])
    .filter(it => !it.stockArticuloId && (it.descripcion ?? '').trim())
    .map(it => ({
      descripcion: it.descripcion.trim(),
      detalle: [
        it.cantidad > 1 ? `${it.cantidad} ${it.unidad || 'u'}` : null,
        it.moduloNombre || it.sistemaCodigoInterno || null,
      ].filter(Boolean).join(' · ') || null,
    }));
}

/** Materiales = items del presupuesto que SI son articulo de stock. */
export function materialesDesdePresupuesto(pres: Presupuesto | null): MaterialOT[] {
  if (!pres) return [];
  return (pres.items ?? [])
    .filter(it => it.stockArticuloId)
    .map(it => ({
      cantidad: `${it.cantidad}×`,
      codigo: it.presentacion?.codigoParte || it.codigoProducto || '—',
      descripcion: (it.descripcion ?? '').trim() || '—',
    }));
}

/**
 * Junta todo lo que imprime la hoja de OT. Lecturas acotadas y en paralelo; lo
 * que falla cae a `null` en vez de voltear la impresion — una OT sin
 * presupuesto vinculado se imprime igual, sin la seccion de tareas.
 */
export async function cargarDatosImpresionOT(otNumber: string): Promise<DatosImpresionOT> {
  const ot = await ordenesTrabajoService.getByOtNumber(otNumber);
  if (!ot) throw new Error(`No se encontro la OT ${otNumber}`);

  const [sistema, modulos, cliente, establecimiento, presupuesto] = await Promise.all([
    ot.sistemaId ? sistemasService.getById(ot.sistemaId).catch(() => null) : Promise.resolve(null),
    ot.sistemaId ? modulosService.getBySistema(ot.sistemaId).catch(() => []) : Promise.resolve([]),
    ot.clienteId ? clientesService.getById(ot.clienteId).catch(() => null) : Promise.resolve(null),
    ot.establecimientoId
      ? establecimientosService.getById(ot.establecimientoId).catch(() => null)
      : Promise.resolve(null),
    ot.budgets?.[0]
      ? presupuestosService.getByNumero(ot.budgets[0]).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    ot,
    estadoLabel: ot.estadoAdmin ? (OT_ESTADO_LABELS[ot.estadoAdmin] ?? ot.estadoAdmin) : '—',
    sistema: sistema as Sistema | null,
    modulos: modulos as ModuloSistema[],
    moduloEnBenchId: resolverModuloEnBench(ot, modulos as ModuloSistema[]),
    cliente: cliente as Cliente | null,
    establecimiento: establecimiento as Establecimiento | null,
    presupuesto,
    tareas: tareasDesdePresupuesto(presupuesto),
    materiales: materialesDesdePresupuesto(presupuesto),
  };
}
