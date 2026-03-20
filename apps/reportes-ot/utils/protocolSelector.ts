import type { ProtocolTemplateDoc } from '../types';
import { califOperacionHplcTemplate } from '../data/califOperacionHplcProtocol';
import { HPLC_RESULTADOS_TEST } from '../data/protocol-tests/hplcResultadosTest';
import { normalizeProtocolTemplate } from './protocolNormalizers';

// En el futuro acá importaremos más plantillas
// import { otraPlantilla } from '../data/...';

const TEMPLATES_BY_ID: Record<string, ProtocolTemplateDoc> = {
  [califOperacionHplcTemplate.id]: califOperacionHplcTemplate,
};

function getNormalized(t: ProtocolTemplateDoc): ProtocolTemplateDoc {
  return normalizeProtocolTemplate(t);
}

/** Modo DEV: cargar plantilla de prueba con ?protocolTest=1 (solo anexo, no afecta Hoja 1). */
export function isProtocolTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('protocolTest') === '1';
}

/**
 * Devuelve la plantilla de protocolo que corresponde al tipo de servicio.
 * DESHABILITADO: los protocolos se gestionan ahora a través del catálogo de tablas.
 * Se mantiene la firma para compatibilidad con llamadas existentes en App.tsx.
 */
export function getProtocolTemplateForServiceType(
  _serviceType: string | null | undefined
): ProtocolTemplateDoc | null {
  return null;
}

/**
 * Resuelve protocolTemplateId a la plantilla correspondiente.
 * Útil para mostrar en UI (edición, preview) la plantilla actual del reporte.
 */
export function getProtocolTemplateById(id: string | null | undefined): ProtocolTemplateDoc | null {
  if (!id) return null;
  if (import.meta.env.DEV && isProtocolTestMode() && id === califOperacionHplcTemplate.id) {
    return getNormalized(HPLC_RESULTADOS_TEST);
  }
  const t = TEMPLATES_BY_ID[id] ?? null;
  return t ? getNormalized(t) : null;
}
