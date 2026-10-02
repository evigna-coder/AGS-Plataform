import type { AgendaEntry } from '@ags/shared';
import { agendaService } from './agendaService';
import { ordenesTrabajoService } from './otService';
import { bloqueaBorradoEntrada } from '../utils/agendaRevertOT';

/**
 * Motivo para NO borrar una entrada de agenda, o null si se puede (2026-10-02).
 * Si no se puede leer la OT, no se bloquea: el borrado manual sigue andando.
 */
export async function motivoNoBorrarEntrada(entry: Pick<AgendaEntry, 'id' | 'otNumber'> | null | undefined): Promise<string | null> {
  if (!entry?.otNumber) return null;
  try {
    const [ot, entradas] = await Promise.all([
      ordenesTrabajoService.getByOtNumber(entry.otNumber),
      agendaService.getByOtNumber(entry.otNumber),
    ]);
    const restantes = entradas.filter(e => e.id !== entry.id && e.estadoAgenda !== 'cancelado').length;
    if (!ot || !bloqueaBorradoEntrada(ot.estadoAdmin, restantes)) return null;
    return `La OT ${entry.otNumber} ya está ${String(ot.estadoAdmin).toLowerCase().replace(/_/g, ' ')}: esta entrada es el registro de la visita y la usa el control semanal. Si la fecha o el ingeniero están mal, movela en lugar de borrarla.`;
  } catch {
    return null;
  }
}
