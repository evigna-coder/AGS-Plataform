import { agendaService } from '../services/agendaService';
import type { AgendaEntry } from '@ags/shared';

/** dd/mm/aaaa a partir de 'YYYY-MM-DD' (sin pasar por Date, que corre el día). */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/**
 * Entradas VIVAS de esas OTs que estén en otra fecha que la de destino
 * (2026-08-12, caso 29616.02): pegar crea siempre una entrada nueva, así que un
 * Ctrl+V en la celda equivocada duplica el servicio sin avisar. Consulta global
 * a propósito — `entries` solo tiene el rango visible y el duplicado suele caer
 * justamente en otra semana o en otro año.
 */
export async function otrasEntradasDeOTs(
  otNumbers: string[],
  fechaDestino: string,
): Promise<string[]> {
  const unicos = [...new Set(otNumbers.filter(Boolean))];
  const avisos: string[] = [];
  for (const ot of unicos) {
    let existentes: AgendaEntry[] = [];
    try {
      existentes = await agendaService.getByOtNumber(ot);
    } catch (err) {
      // Sin lectura no hay aviso, pero tampoco se bloquea el pegado.
      console.error('[otrasEntradasDeOTs] lectura falló:', err);
      continue;
    }
    const otras = existentes.filter(e =>
      e.estadoAgenda !== 'cancelado' && e.fechaInicio !== fechaDestino);
    if (otras.length === 0) continue;
    const fechas = [...new Set(otras.map(e => fechaCorta(e.fechaInicio)))].sort();
    avisos.push(`OT ${ot} — ya agendada el ${fechas.join(', ')}`);
  }
  return avisos;
}

/** Etiqueta corta de una entrada, para nombrarla en un confirm de borrado. */
export function etiquetaEntrada(e: AgendaEntry): string {
  const cabeza = e.otNumber ? `OT ${e.otNumber}` : (e.titulo || 'la tarea');
  return e.clienteNombre ? `${cabeza} — ${e.clienteNombre}` : cabeza;
}
