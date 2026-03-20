import califHplcJson from './calif-operacion-hplc.json';
import type { ProtocolTemplateDoc, ProtocolSection } from '../types';

/** Plantilla real: Calificación de operación HPLC 1100-1200-1260 (Word → JSON) */
export const califOperacionHplcTemplate: ProtocolTemplateDoc = {
  id: califHplcJson.id ?? 'calif-operacion-hplc',
  name: califHplcJson.name ?? 'Calificación de operación HPLC 1100-1200-1260',
  serviceType: califHplcJson.serviceType,
  equipmentType: califHplcJson.equipmentType,
  version: (califHplcJson as { version?: string }).version ?? '1.0',
  sections: (califHplcJson.template?.sections ?? []) as ProtocolSection[],
};
