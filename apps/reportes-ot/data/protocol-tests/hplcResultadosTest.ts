import type { ProtocolTemplateDoc, ProtocolSection } from '../../types';
import raw from './hplc-resultados-test.json';

/** Plantilla de prueba para modo DEV (?protocolTest=1). JSON del convertidor Word→JSON. */
export const HPLC_RESULTADOS_TEST: ProtocolTemplateDoc = {
  id: (raw as { id?: string }).id ?? 'hplc-resultados-test',
  name: (raw as { name?: string }).name ?? 'HPLC Resultados (test)',
  serviceType: (raw as { serviceType?: string }).serviceType,
  equipmentType: (raw as { equipmentType?: string }).equipmentType,
  version: (raw as { version?: string }).version ?? '1.0',
  sections: ((raw as { template?: { sections?: ProtocolSection[] }; sections?: ProtocolSection[] }).template?.sections ??
    (raw as { sections?: ProtocolSection[] }).sections ??
    []) as ProtocolSection[],
};
