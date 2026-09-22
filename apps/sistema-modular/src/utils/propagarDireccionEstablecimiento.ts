/**
 * Propagación de la dirección de un establecimiento a sus OT abiertas (2026-09-22).
 *
 * La OT guarda una COPIA de la dirección al crearse (el informe firmado tiene
 * que decir dónde se hizo el servicio aunque el establecimiento se mude). Por
 * eso editar el establecimiento no tocaba ninguna OT, ni las que todavía no
 * se hicieron: la app de campo mostraba la dirección vieja (caso Corteva /
 * 30187.01). Acá se decide qué OT siguen al establecimiento: las abiertas y
 * con una dirección distinta. Las cerradas o canceladas conservan la copia.
 *
 * Puro: sin Firebase, testeable con `test:propagar-direccion`.
 */
export interface DireccionEstablecimiento {
  direccion?: string | null;
  localidad?: string | null;
  provincia?: string | null;
}

const CAMPOS = ['direccion', 'localidad', 'provincia'] as const;
const ESTADOS_CERRADOS = new Set(['CIERRE_ADMINISTRATIVO', 'FINALIZADO', 'CANCELADA']);

/** Parte de un update de establecimiento que toca la dirección; `null` si no la toca. */
export function cambioDeDireccion(data: Record<string, unknown>): DireccionEstablecimiento | null {
  const out: DireccionEstablecimiento = {};
  let hay = false;
  for (const k of CAMPOS) {
    if (k in data && typeof data[k] === 'string') { out[k] = (data[k] as string).trim(); hay = true; }
  }
  return hay ? out : null;
}

export interface OTParaPropagar extends DireccionEstablecimiento {
  otNumber: string;
  status?: string | null;
  estadoAdmin?: string | null;
}

export function otAbierta(ot: Pick<OTParaPropagar, 'status' | 'estadoAdmin'>): boolean {
  if (ot.status === 'FINALIZADO') return false;
  if (ot.estadoAdmin && ESTADOS_CERRADOS.has(ot.estadoAdmin)) return false;
  return true;
}

/**
 * OT abiertas cuya copia difiere de la dirección nueva, con el patch a aplicar
 * (solo los campos que cambian). Una OT ya alineada no se reescribe.
 */
export function otsQueSiguenAlEstablecimiento(
  ots: OTParaPropagar[],
  nueva: DireccionEstablecimiento,
): Array<{ otNumber: string; patch: DireccionEstablecimiento }> {
  const out: Array<{ otNumber: string; patch: DireccionEstablecimiento }> = [];
  for (const ot of ots) {
    if (!otAbierta(ot)) continue;
    const patch: DireccionEstablecimiento = {};
    for (const k of CAMPOS) {
      if (nueva[k] === undefined) continue;
      if ((ot[k] ?? '') !== (nueva[k] ?? '')) patch[k] = nueva[k] ?? '';
    }
    if (Object.keys(patch).length > 0) out.push({ otNumber: ot.otNumber, patch });
  }
  return out;
}
