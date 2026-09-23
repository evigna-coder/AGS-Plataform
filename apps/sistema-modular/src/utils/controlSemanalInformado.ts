/**
 * "Informado a facturación" en el control semanal (2026-09-22).
 *
 * Un presupuesto cuyo servicio se hizo en la semana N y cuyo aviso a
 * facturación salió en una semana POSTERIOR desaparecía de la semana N (los
 * avisados se esconden) y en la semana del aviso aparecía en facturación,
 * desconectado del servicio: la agenda de N mostraba el trabajo hecho y
 * ningún presupuesto. Ahora se queda en la semana del servicio con el texto
 * "Informado a facturación · semana dd/mm al dd/mm". Si el aviso salió en la
 * misma semana, sigue como antes: sale de la sección y se informa en facturación.
 *
 * Puro: sin Firebase, testeable con `test:control-informado`.
 */
export interface SemanaRango {
  /** Lunes, yyyy-mm-dd. */
  inicio: string;
  /** Domingo, yyyy-mm-dd. */
  fin: string;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Semana (lunes a domingo, en hora local) a la que pertenece una fecha ISO. */
export function semanaDe(iso: string): SemanaRango | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { inicio: ymd(lunes), fin: ymd(domingo) };
}

/**
 * Semana del aviso si salió DESPUÉS de la semana visible (termina en
 * `weekEnd`, yyyy-mm-dd); `null` si no hay aviso o cayó en la misma semana o antes.
 */
export function semanaInformadoPosterior(fechaAviso: string | null | undefined, weekEnd: string): SemanaRango | null {
  if (!fechaAviso) return null;
  const semana = semanaDe(fechaAviso);
  if (!semana) return null;
  return semana.inicio > weekEnd ? semana : null;
}

const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

/** "Informado a facturación · semana 22/09 al 28/09". */
export function textoInformado(semana: SemanaRango): string {
  return `Informado a facturación · semana ${ddmm(semana.inicio)} al ${ddmm(semana.fin)}`;
}

/** Fecha del aviso por presupuesto: la ÚLTIMA solicitud viva (la que completó la cobertura). */
export function fechaAvisoPorPresupuesto(
  solicitudes: Array<{ presupuestoId: string; estado: string; createdAt: string }>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of solicitudes) {
    if (s.estado === 'anulada' || !s.createdAt) continue;
    const prev = out.get(s.presupuestoId);
    if (!prev || s.createdAt > prev) out.set(s.presupuestoId, s.createdAt);
  }
  return out;
}
