import sampleJson from './sample-protocol.json';
import type { ProtocolTemplateDoc, ProtocolSection, ProtocolData } from '../types';

/** Mapea el JSON de ejemplo (con template.sections) a ProtocolTemplateDoc */
export const sampleProtocolTemplate: ProtocolTemplateDoc = {
  id: sampleJson.id ?? 'sample-protocol',
  name: sampleJson.name ?? 'Protocolo de Ejemplo',
  serviceType: sampleJson.serviceType,
  equipmentType: sampleJson.equipmentType,
  version: sampleJson.version ?? '1.0',
  sections: (sampleJson.template?.sections ?? []) as ProtocolSection[],
};

/** Crea un ProtocolData vacío compatible con una plantilla */
export function createEmptyProtocolDataForTemplate(template: ProtocolTemplateDoc): ProtocolData {
  return {
    protocolTemplateId: template.id,
    sections: Object.fromEntries(
      template.sections.map((section) => {
        switch (section.type) {
          case 'text':
            return [section.id, { content: '' }];
          case 'checklist':
            return [section.id, { checkedItemIds: [] }];
          case 'table':
            return [section.id, { rows: {} }];
          case 'signatures':
            return [section.id, {}];
          default:
            return [section.id, {}];
        }
      })
    ),
  };
}
